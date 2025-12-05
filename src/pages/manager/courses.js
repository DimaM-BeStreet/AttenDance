import './courses-styles.js';
import { createNavbar } from '../../components/navbar.js';
import { showModal, closeModal, showConfirm, showToast } from '../../components/modal.js';
import { auth } from '../../config/firebase-config.js';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  getAllEnrichedCourses,
  getCourseById,
  createCourse,
  updateCourse,
  updateCourseActiveStatus,
  addTemplatesToCourse,
  removeTemplatesFromCourse,
  getEnrichedCourse,
  searchCourses
} from '../../services/course-service.js';
import {
  enrollStudentInCourse,
  removeStudentFromCourse,
  getActiveCourseEnrollments,
  getCourseStudentIds
} from '../../services/enrollment-service.js';
import { getAllTeachers } from '../../services/teacher-service.js';
import { getAllStudents } from '../../services/student-service.js';
import { getAllClassTemplates, searchClassTemplates, getClassTemplateById } from '../../services/class-template-service.js';
import { getFutureInstances, addStudentToInstance, removeStudentFromInstance } from '../../services/class-instance-service.js';
import { getAllBranches } from '../../services/branch-service.js';
import { UniversalImportWizard } from '../../components/UniversalImportWizard.js';
import { validateCourseImport, importCourses } from '../../services/import-service.js';

// Helper functions for date formatting
function formatDateToDDMMYYYY(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function parseDDMMYYYYToDate(dateString) {
  const [day, month, year] = dateString.split('/');
  return new Date(year, month - 1, day);
}

let businessId = null;
let currentCourseId = null;
let courses = [];
let teachers = [];
let students = [];
let templates = [];
let branches = [];
let selectedTemplatesMap = new Map(); // id -> template object
let currentSearchResults = [];
let searchTimeout;

// Pagination state
let coursesLastDoc = null;
let coursesHasMore = true;
let isLoadingMoreCourses = false;
let selectedEnrolledStudents = new Set();
let isSearching = false;
let searchResults = [];
let showProblemsOnly = false;

// Debounce utility
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  createNavbar();
  initAuth();
  initEventListeners();
});

/**
 * Initialize authentication
 */
function initAuth() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = '/login.html';
      return;
    }

    try {
      // Get user data to find businessId
      const userDoc = await getUserData(user.uid);
      if (!userDoc || !userDoc.businessId) {
        console.error('No business ID found for user');
        showToast('שגיאה בטעינת נתוני המשתמש', 'error');
        return;
      }

      // Check user role
      if (!['superAdmin', 'admin', 'branchManager'].includes(userDoc.role)) {
        showToast('אין לך הרשאות לצפות בדף זה', 'error');
        window.location.href = '/';
        return;
      }

      businessId = userDoc.businessId;
      // Store user for filtering
      window.currentUser = userDoc;
      
      await loadInitialData();
    } catch (error) {
      console.error('Error initializing:', error);
      showToast('שגיאה בטעינת הנתונים', 'error');
    }
  });
}

/**
 * Get user data from Firestore
 */
async function getUserData(uid) {
  const { doc, getDoc, getFirestore } = await import('firebase/firestore');
  const db = getFirestore();
  const userDoc = await getDoc(doc(db, 'users', uid));
  return userDoc.exists() ? userDoc.data() : null;
}

/**
 * Load initial data with pagination
 */
async function loadInitialData() {
  try {
    renderLoadingState();
    
    // Load first page of courses (5 items) and other data
    const { getPaginatedCourses } = await import('../../services/course-service.js');
    const options = getFilterOptions();
    const coursesResult = await getPaginatedCourses(businessId, options);
    
    courses = coursesResult.courses;
    coursesLastDoc = coursesResult.lastDoc;
    coursesHasMore = coursesResult.hasMore;
    
    // Note: Teachers, students, and branches loaded on demand for dialogs
    // to avoid loading thousands of items unnecessarily
    [teachers, branches] = await Promise.all([
      getAllTeachers(businessId),
      getAllBranches(businessId, { isActive: true })
    ]);
    
    // Templates and students loaded only when needed
    templates = [];
    students = [];
    
    populateBranchDropdown();
    updateCoursesCount();
    renderCourses();
    addLoadMoreCoursesButton();
  } catch (error) {
    console.error('Error loading data:', error);
    showToast('שגיאה בטעינת הנתונים', 'error');
  }
}

/**
 * Load all inactive courses (cancelled)
 */
async function loadAllInactiveCourses() {
  try {
    renderLoadingState();
    const dropdown = document.getElementById('moreActionsDropdown');
    if (dropdown) dropdown.classList.remove('show');

    // Update status filter UI to reflect we are showing cancelled
    const filterStatus = document.getElementById('filterStatus');
    if (filterStatus) filterStatus.value = 'cancelled';

    const { getAllCourses } = await import('../../services/course-service.js');
    const options = getFilterOptions(); // This will pick up 'cancelled' from the dropdown
    
    // Remove limit to get all
    delete options.limit;
    
    const allCourses = await getAllCourses(businessId, options);
    
    courses = allCourses;
    coursesLastDoc = null;
    coursesHasMore = false;
    
    updateCoursesCount();
    renderCourses();
    addLoadMoreCoursesButton();
    
  } catch (error) {
    console.error('Error loading inactive courses:', error);
    showToast('שגיאה בטעינת קורסים לא פעילים', 'error');
    
  }
}

/**
 * Load all courses for the current filter (ignoring pagination)
 */
async function loadAllCoursesForBranch() {
  try {
    renderLoadingState();
    const dropdown = document.getElementById('moreActionsDropdown');
    if (dropdown) dropdown.classList.remove('show');

    const { getAllCourses } = await import('../../services/course-service.js');
    const options = getFilterOptions();
    
    // Remove limit to get all
    delete options.limit;
    
    // Use getAllCourses instead of getPaginatedCourses
    const allCourses = await getAllCourses(businessId, options);
    
    courses = allCourses;
    coursesLastDoc = null;
    coursesHasMore = false; // No more to load
    
    updateCoursesCount();
    renderCourses();
    addLoadMoreCoursesButton(); // Will hide the button since hasMore is false
    
    // Update button text to indicate "All Loaded"
    const btn = document.getElementById('showAllBranchBtn');
    if (btn) btn.innerHTML = '<span class="dropdown-item-icon">✓</span> מוצג הכל';
    
  } catch (error) {
    console.error('Error loading all courses:', error);
    showToast('שגיאה בטעינת כל הקורסים', 'error');
    
  }
}

/**
 * Load more courses
 */
async function loadMoreCourses() {
  if (!coursesHasMore || isLoadingMoreCourses || !coursesLastDoc) return;
  
  try {
    isLoadingMoreCourses = true;
    const loadMoreBtn = document.getElementById('loadMoreCoursesBtn');
    if (loadMoreBtn) {
      loadMoreBtn.disabled = true;
      loadMoreBtn.textContent = 'טוען...';
    }
    
    const { getPaginatedCourses } = await import('../../services/course-service.js');
    const options = getFilterOptions();
    options.startAfterDoc = coursesLastDoc;
    
    // If a branch is selected, we might need to fetch multiple pages to find matching courses
    // But to avoid infinite loops or too many reads, we'll just fetch one page for now
    // and let the user click again if needed, OR we can fetch a larger batch.
    // Let's try fetching a larger batch if branch is selected.
    const branchFilter = document.getElementById('branchFilter');
    if (branchFilter && branchFilter.value) {
        options.limit = 10; // Fetch more if filtering client-side
    }
    
    const result = await getPaginatedCourses(businessId, options);
    
    courses = [...courses, ...result.courses];
    coursesLastDoc = result.lastDoc;
    coursesHasMore = result.hasMore;
    
    updateCoursesCount();
    renderCourses();
    addLoadMoreCoursesButton();
    
    // If we fetched data but nothing is shown (due to filtering), we could auto-fetch more.
    // But for now, let's stick to user interaction to be safe.
    
  } catch (error) {
    console.error('Error loading more courses:', error);
    showToast('שגיאה בטעינת קורסים נוספים', 'error');
  } finally {
    isLoadingMoreCourses = false;
  }
}

/**
 * Add Load More button if needed
 */
function addLoadMoreCoursesButton() {
  const container = document.getElementById('coursesContainer');
  if (!container) return;
  
  // Remove existing button
  const existingBtn = document.getElementById('loadMoreCoursesBtn');
  if (existingBtn) {
    existingBtn.parentElement.remove(); // Remove container
  }
  
  // Don't show if searching
  if (isSearching) return;
  
  // Add button if there are more courses
  if (coursesHasMore) {
    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = 'text-align: center; padding: 20px; grid-column: 1 / -1;';
    btnContainer.innerHTML = `
      <button id="loadMoreCoursesBtn" class="btn-secondary" style="min-width: 200px;">
        טען עוד קורסים
      </button>
      <div style="font-size: 13px; color: var(--text-secondary); margin-top: 8px;">
        יש עוד קורסים זמינים
      </div>
    `;
    container.appendChild(btnContainer);
    
    const btn = document.getElementById('loadMoreCoursesBtn');
    btn.addEventListener('click', loadMoreCourses);
  }
}

/**
 * Update courses count display
 */
function updateCoursesCount() {
  const sourceCourses = isSearching ? searchResults : courses;
  const activeCount = sourceCourses.filter(c => c.isActive !== false).length;
  const totalCount = sourceCourses.length;
  
  if (isSearching) {
    document.getElementById('coursesCount').textContent = 
      `נמצאו ${totalCount} קורסים (${activeCount} פעילים)`;
  } else if (coursesHasMore) {
    document.getElementById('coursesCount').textContent = 
      `מציג ${activeCount} קורסים פעילים מתוך ${totalCount}+ טעונים`;
  } else {
    document.getElementById('coursesCount').textContent = 
      `${activeCount} קורסים פעילים מתוך ${totalCount}`;
  }
}

/**
 * Initialize event listeners
 */
function initEventListeners() {
  // Add course buttons
  document.getElementById('addCourseBtn').addEventListener('click', openAddCourseModal);
  document.getElementById('addCourseEmptyBtn')?.addEventListener('click', openAddCourseModal);
  
  // Import button
  const importBtn = document.getElementById('importCoursesBtn');
  if (importBtn) {
    importBtn.addEventListener('click', openImportWizard);
  }

  // Course form
  document.getElementById('courseForm').addEventListener('submit', handleCourseSubmit);
  document.getElementById('cancelCourseBtn').addEventListener('click', closeCourseModal);
  document.getElementById('cancelCourseStatusBtn').addEventListener('click', handleCancelCourseStatus);
  document.getElementById('closeCourseModal').addEventListener('click', closeCourseModal);
  
  // Enrollments modal
  document.getElementById('closeEnrollmentsModal').addEventListener('click', closeEnrollmentsModal);
  document.getElementById('closeEnrollmentsBtn').addEventListener('click', closeEnrollmentsModal);
  document.getElementById('addEnrollmentBtn').addEventListener('click', handleAddEnrollment);
  
  // Add Student Toggle
  document.getElementById('showAddStudentBtn').addEventListener('click', () => {
    document.getElementById('addStudentSection').style.display = 'block';
    document.getElementById('showAddStudentBtn').style.display = 'none';
  });
  
  document.getElementById('hideAddStudentBtn').addEventListener('click', () => {
    document.getElementById('addStudentSection').style.display = 'none';
    document.getElementById('showAddStudentBtn').style.display = 'block';
  });
  
  // Course details modal
  document.getElementById('closeCourseDetailsModal').addEventListener('click', closeCourseDetailsModal);
  document.getElementById('closeCourseDetailsBtn').addEventListener('click', closeCourseDetailsModal);
  document.getElementById('editCourseDetailsBtn').addEventListener('click', handleEditCourseFromDetails);
  
  // Filters
  document.getElementById('filterStatus').addEventListener('change', () => {
    reloadCourses();
  });
  document.getElementById('searchCourse').addEventListener('input', handleCourseSearch);
  
  const branchFilter = document.getElementById('branchFilter');
  if (branchFilter) {
    branchFilter.addEventListener('change', renderCourses);
  }

  // Problems Filter
  const problemsBtn = document.getElementById('showProblemsBtn');
  if (problemsBtn) {
    problemsBtn.addEventListener('click', toggleShowProblems);
  }

  // More Actions Menu
  const moreActionsBtn = document.getElementById('moreActionsBtn');
  const moreActionsDropdown = document.getElementById('moreActionsDropdown');
  const showAllBranchBtn = document.getElementById('showAllBranchBtn');
  const showInactiveBtn = document.getElementById('showInactiveBtn');
  
  if (moreActionsBtn && moreActionsDropdown) {
      moreActionsBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          moreActionsDropdown.classList.toggle('show');
      });
      
      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
          if (!moreActionsBtn.contains(e.target) && !moreActionsDropdown.contains(e.target)) {
              moreActionsDropdown.classList.remove('show');
          }
      });
  }

  if (showAllBranchBtn) {
      showAllBranchBtn.addEventListener('click', loadAllCoursesForBranch);
  }

  if (showInactiveBtn) {
      showInactiveBtn.addEventListener('click', loadAllInactiveCourses);
  }

  // Template search
  const templateSearchInput = document.getElementById('templateSearchInput');
  if (templateSearchInput) {
    templateSearchInput.addEventListener('input', handleTemplateSearch);
  }

  // Template selection delegation
  const templatesSelection = document.getElementById('templatesSelection');
  if (templatesSelection) {
    templatesSelection.addEventListener('change', (e) => {
      if (e.target.name === 'template') {
        handleTemplateSelectionChange(e.target);
      }
    });
  }
}

/**
 * Handle template search
 */
async function handleTemplateSearch(e) {
  const searchTerm = e.target.value.trim();
  
  if (searchTerm.length < 2) {
    clearTimeout(searchTimeout);
    currentSearchResults = [];
    renderTemplatesSelection();
    return;
  }
  
  clearTimeout(searchTimeout);
  
  searchTimeout = setTimeout(async () => {
      try {
        currentSearchResults = await searchClassTemplates(businessId, searchTerm);
        renderTemplatesSelection();
      } catch (error) {
        console.error('Error searching templates:', error);
      }
  }, 300);
}

/**
 * Handle template selection change
 */
function handleTemplateSelectionChange(checkbox) {
  const templateId = checkbox.value;
  if (checkbox.checked) {
    // Find template in currentSearchResults or selectedTemplatesMap
    const template = currentSearchResults.find(t => t.id === templateId) || selectedTemplatesMap.get(templateId);
    if (template) {
      selectedTemplatesMap.set(templateId, template);
    }
  } else {
    selectedTemplatesMap.delete(templateId);
  }
  // Re-render to update list
  // We pass the disabled state if we are in view/edit mode of auto-created course?
  // Actually handleTemplateSelectionChange is only called when user clicks, so it's not disabled.
  renderTemplatesSelection(); 
}

/**
 * Toggle Show Problems filter
 */
function toggleShowProblems() {
  showProblemsOnly = !showProblemsOnly;
  const btn = document.getElementById('showProblemsBtn');
  const dropdown = document.getElementById('moreActionsDropdown');
  
  if (showProblemsOnly) {
    btn.classList.add('active');
    btn.innerHTML = '<span class="dropdown-item-icon">✓</span> הצג הכל';
  } else {
    btn.classList.remove('active');
    btn.innerHTML = '<span class="dropdown-item-icon">⚠️</span> הצג קורסים בעייתיים';
  }
  
  // Close dropdown after selection
  if (dropdown) {
      dropdown.classList.remove('show');
  }
  
  renderCourses();
}

/**
 * Populate branch filter dropdown only (courses don't have branchId)
 */
function populateBranchDropdown() {
  // Populate filter dropdown and show/hide based on branch count
  const filterGroup = document.getElementById('branchFilterGroup');
  const branchFilter = document.getElementById('branchFilter');
  
  let displayBranches = branches;
  
  // Filter for Branch Manager
  if (window.currentUser && window.currentUser.role === 'branchManager') {
      const allowedIds = window.currentUser.allowedBranchIds || [];
      displayBranches = branches.filter(b => allowedIds.includes(b.id));
  }
  
  if (displayBranches.length > 0) { // Changed from > 1 to > 0 to allow single branch filtering
    branchFilter.innerHTML = '<option value="">כל הסניפים</option>' + 
      displayBranches.map(branch => `<option value="${branch.id}">${branch.name}</option>`).join('');
    filterGroup.style.display = 'block';
  } else {
    filterGroup.style.display = 'none';
  }
}

/**
 * Render courses list
 */
function renderCourses() {
  const filterStatus = document.getElementById('filterStatus').value;
  const branchFilter = document.getElementById('branchFilter');
  const selectedBranch = branchFilter ? branchFilter.value : '';
  
  const sourceCourses = isSearching ? searchResults : courses;
  
  let filtered = sourceCourses.filter(course => {
    // Check for problems
    const hasPriceProblem = !course.price || course.price <= 0;
    
    if (showProblemsOnly) {
        if (!hasPriceProblem) return false;
    }

    // Filter by branch: check if any template in the course belongs to the selected branch
    // OR if user is Branch Manager, check if course belongs to allowed branches
    
    // 1. Branch Manager Restriction
    if (window.currentUser && window.currentUser.role === 'branchManager') {
        const allowedIds = window.currentUser.allowedBranchIds || [];
        if (course.schedule && course.schedule.length > 0) {
            const hasAllowedBranch = course.schedule.some(s => allowedIds.includes(s.branchId));
            if (!hasAllowedBranch) return false;
        } else {
            // If no schedule, we can't determine branch, so hide it for safety
            // Unless we want to show courses with no schedule? 
            // Usually courses should have schedule.
            return false;
        }
    }

    // 2. UI Filter Selection
    if (selectedBranch) {
      // Check schedule for branchId (new way)
      if (course.schedule && course.schedule.length > 0) {
        const hasMatchingBranch = course.schedule.some(s => s.branchId === selectedBranch);
        if (!hasMatchingBranch) return false;
      } else {
        // Fallback for old data or if schedule is missing branchId
        return false;
      }
    }
    
    if (filterStatus) {
      if (filterStatus === 'cancelled') {
        if (course.isActive !== false) return false;
      } else if (course.isActive === false) {
        // If filtering for anything other than cancelled, exclude cancelled
        return false;
      } else {
        // Date-based filtering for active courses
        const now = new Date();
        const startDate = course.startDate && course.startDate.toDate ? course.startDate.toDate() : new Date(course.startDate);
        const endDate = course.endDate && course.endDate.toDate ? course.endDate.toDate() : new Date(course.endDate);
        
        // Reset time
        now.setHours(0, 0, 0, 0);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        if (filterStatus === 'upcoming') {
          if (startDate <= now) return false;
        } else if (filterStatus === 'completed') {
          if (endDate >= now) return false;
        } else if (filterStatus === 'active') {
          // Active means currently running (started and not ended)
          if (startDate > now || endDate < now) return false;
        }
      }
    }
    
    return true;
  });
  
  const container = document.getElementById('coursesList');
  const emptyState = document.getElementById('emptyState');
  
  if (filtered.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'flex';
    
    const createBtn = document.getElementById('addCourseEmptyBtn');
    const title = emptyState.querySelector('h3');
    const text = emptyState.querySelector('p');
    
    // Check if we are in a filtered state
    const isFiltered = isSearching || filterStatus || selectedBranch || showProblemsOnly;

    if (isFiltered) {
        title.textContent = 'לא נמצאו תוצאות';
        text.textContent = 'נסה לשנות את סינון החיפוש';
        if(createBtn) createBtn.style.display = 'none';
    } else {
        // Initial empty state (no courses at all)
        title.textContent = 'אין קורסים';
        text.textContent = 'התחל על ידי יצירת קורס ראשון';
        if(createBtn) createBtn.style.display = 'inline-flex';
    }
    return;
  }
  
  emptyState.style.display = 'none';
  
  container.innerHTML = filtered.map(course => {
    const hasPriceProblem = !course.price || course.price <= 0;
    const problemClass = hasPriceProblem ? 'problematic' : '';
    
    return `
    <div class="course-card ${problemClass}" data-course-id="${course.id}">
      ${hasPriceProblem ? '<div class="problem-indicator">⚠️ מחיר חסר</div>' : ''}
      <div class="course-header">
        <h3>${course.name}</h3>
        <span class="course-status status-${getCourseStateClass(course)}">${getCourseStateText(course)}</span>
      </div>
      
      <div class="course-info">
        <div class="info-item">
          <span class="info-label">תאריכים:</span>
          <span class="info-value">${formatDate(course.startDate)} - ${formatDate(course.endDate)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">תלמידים:</span>
          <span class="info-value">${course.enrollmentCount || 0}${course.maxStudents ? ` / ${course.maxStudents}` : ''}</span>
        </div>
        <div class="info-item">
          <span class="info-label">שיעורים:</span>
          <span class="info-value">${getTemplatesSummary(course.schedule)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">מחיר:</span>
          <span class="info-value">
            ${course.price || 0} ₪
          </span>
        </div>
      </div>
      
      <div class="course-actions">
        <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); openManageEnrollmentsModal('${course.id}')">נהל רישום</button>
        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); openEditCourseModal('${course.id}')">ערוך</button>
      </div>
    </div>
  `}).join('');
  
  // Add click handlers to course cards
  container.querySelectorAll('.course-card').forEach(card => {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      window.viewCourse(card.dataset.courseId);
    });
  });
}

/**
 * Get templates summary for course display
 */
function getTemplatesSummary(schedule) {
  if (!schedule || schedule.length === 0) return 'אין שיעורים';
  
  // Day names by numeric index (0=Sunday, 6=Saturday)
  const dayNames = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
  
  const sorted = [...schedule].sort((a, b) => {
    const dayDiff = (a.dayOfWeek || 0) - (b.dayOfWeek || 0);
    if (dayDiff !== 0) return dayDiff;
    return (a.startTime || '').localeCompare(b.startTime || '');
  });
  
  // Show up to 3 templates with day, time, and teacher
  const summary = sorted.slice(0, 3).map(t => {
    const day = dayNames[t.dayOfWeek] || '?';
    const time = (t.startTime || '00:00').substring(0, 5);
    
    // Find teacher name
    let teacherName = '';
    if (t.teacherId) {
      const teacher = teachers.find(teacher => teacher.id === t.teacherId);
      if (teacher) {
        teacherName = ` - ${teacher.firstName}`;
      }
    }
    
    return `${day} ${time}${teacherName}`;
  }).join(', ');
  
  return sorted.length > 3 ? `${summary} +${sorted.length - 3}` : summary;
}

/**
 * Get status text in Hebrew based on course dates and status
 */
function getCourseStateText(course) {
  if (course.isActive === false) return 'בוטל';
  
  const now = new Date();
  const startDate = course.startDate && course.startDate.toDate ? course.startDate.toDate() : new Date(course.startDate);
  const endDate = course.endDate && course.endDate.toDate ? course.endDate.toDate() : new Date(course.endDate);
  
  // Reset time part for accurate date comparison
  now.setHours(0, 0, 0, 0);
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);

  if (startDate > now) return 'עתידי';
  if (endDate < now) return 'הסתיים';
  return 'פעיל';
}

/**
 * Get status class for CSS
 */
function getCourseStateClass(course) {
  if (course.isActive === false) return 'cancelled';
  
  const now = new Date();
  const startDate = course.startDate && course.startDate.toDate ? course.startDate.toDate() : new Date(course.startDate);
  const endDate = course.endDate && course.endDate.toDate ? course.endDate.toDate() : new Date(course.endDate);
  
  // Reset time part
  now.setHours(0, 0, 0, 0);
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);

  if (startDate > now) return 'upcoming';
  if (endDate < now) return 'completed';
  return 'active';
}

/**
 * Format Firestore timestamp to date string
 */
function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('he-IL');
}

/**
 * Open add course modal
 */
function openAddCourseModal() {
  currentCourseId = null;
  document.getElementById('courseModalTitle').textContent = 'קורס חדש';
  document.getElementById('courseForm').reset();
  
  // Reset template search state
  selectedTemplatesMap.clear();
  currentSearchResults = [];
  const searchInput = document.getElementById('templateSearchInput');
  if (searchInput) {
    searchInput.value = '';
    searchInput.disabled = false;
  }
  
  // Remove any auto-created warning
  const modalBody = document.querySelector('#courseModal .modal-body');
  const existingWarning = modalBody.querySelector('.auto-created-warning');
  if (existingWarning) existingWarning.remove();

  // Hide cancel button for new course
  document.getElementById('cancelCourseStatusBtn').style.display = 'none';
    
  // Enable fields for new course
  document.getElementById('courseName').disabled = false;

  // Set default dates (today + 3 months) in dd/mm/yyyy format
  const today = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 3);
  
  document.getElementById('courseStartDate').value = formatDateToDDMMYYYY(today);
  document.getElementById('courseEndDate').value = formatDateToDDMMYYYY(endDate);
  
  renderTemplatesSelection();
  showModal('courseModal');
}

/**
 * Open edit course modal
 */
window.openEditCourseModal = async function(courseId) {
  try {
    currentCourseId = courseId;
    const course = await getCourseById(businessId, courseId);
    
    document.getElementById('courseModalTitle').textContent = 'ערוך קורס';
    document.getElementById('courseName').value = course.name || '';
    
    // Check if auto-created
    const isAutoCreated = course.autoCreated === true;
    
    // Disable name and templates if auto-created
    document.getElementById('courseName').disabled = isAutoCreated;
    const searchInput = document.getElementById('templateSearchInput');
    if (searchInput) {
        searchInput.value = '';
        searchInput.disabled = isAutoCreated;
    }
    
    // Show cancel button only for active courses
    const cancelBtn = document.getElementById('cancelCourseStatusBtn');
    if (course.isActive !== false) {
      cancelBtn.style.display = 'inline-block';
    } else {
      cancelBtn.style.display = 'none';
    }
    
    // Courses don't have branchId - they can span multiple branches via templates
    
    // Format dates for input in dd/mm/yyyy format
    const startDate = course.startDate ? (course.startDate.toDate ? course.startDate.toDate() : new Date(course.startDate)) : new Date();
    const endDate = course.endDate ? (course.endDate.toDate ? course.endDate.toDate() : new Date(course.endDate)) : new Date();
    document.getElementById('courseStartDate').value = formatDateToDDMMYYYY(startDate);
    document.getElementById('courseEndDate').value = formatDateToDDMMYYYY(endDate);
    
    document.getElementById('coursePrice').value = course.price || 0;
    document.getElementById('courseMaxStudents').value = course.maxStudents || '';
    document.getElementById('courseDescription').value = course.description || '';
    
    // Reset template search state
    selectedTemplatesMap.clear();
    currentSearchResults = [];
    // searchInput is already handled above
    
    // Load selected templates
    if (course.templateIds && course.templateIds.length > 0) {
        const templates = await Promise.all(course.templateIds.map(id => getClassTemplateById(businessId, id)));
        templates.forEach(t => {
            if (t) selectedTemplatesMap.set(t.id, t);
        });
    }
    
    renderTemplatesSelection(null, isAutoCreated);
    
    // Add warning if auto-created
    const modalBody = document.querySelector('#courseModal .modal-body');
    const existingWarning = modalBody.querySelector('.auto-created-warning');
    if (existingWarning) existingWarning.remove();
    
    if (isAutoCreated) {
        modalBody.insertAdjacentHTML('afterbegin', '<div class="auto-created-warning" style="color: var(--text-secondary); font-size: 0.9em; margin-bottom: 16px; padding: 8px; background-color: #fff3cd; border-radius: 4px; border: 1px solid #ffeeba;">⚠️ קורס זה נוצר אוטומטית מתבנית ולא ניתן לשנות את התבניות או השם שלו כאן.</div>');
    }

    showModal('courseModal');
  } catch (error) {
    console.error('Error loading course:', error);
    showToast('שגיאה בטעינת פרטי הקורס', 'error');
  }
};

/**
 * Render templates selection checkboxes
 */
function renderTemplatesSelection(selectedIds = null, isDisabled = false) {
  const container = document.getElementById('templatesSelection');
  
  // Combine selected and search results, removing duplicates
  const selectedTemplates = Array.from(selectedTemplatesMap.values());
  const displayTemplates = [...selectedTemplates];
  
  currentSearchResults.forEach(result => {
    if (!selectedTemplatesMap.has(result.id)) {
      displayTemplates.push(result);
    }
  });
  
  if (displayTemplates.length === 0) {
      if (document.getElementById('templateSearchInput').value.trim().length > 0) {
          container.innerHTML = '<div class="no-results" style="padding: 10px; color: var(--text-secondary);">לא נמצאו תבניות תואמות.</div>';
      } else if (selectedTemplates.length === 0) {
          container.innerHTML = '<div class="no-results" style="padding: 10px; color: var(--text-secondary);">חפש תבנית שיעור כדי להוסיף לקורס.</div>';
      }
      return;
  }
  
  container.innerHTML = displayTemplates.map(template => `
    <label class="template-checkbox">
      <input type="checkbox" name="template" value="${template.id}" 
        ${selectedTemplatesMap.has(template.id) ? 'checked' : ''}
        ${isDisabled ? 'disabled' : ''}>
      <span>${template.name} - ${getDayName(template.dayOfWeek)} ${template.startTime}</span>
    </label>
  `).join('');
}

/**
 * Get day name in Hebrew
 */
function getDayName(dayOfWeek) {
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  return days[dayOfWeek];
}

/**
 * Close course modal
 */
function closeCourseModal() {
  closeModal();
  currentCourseId = null;
}

/**
 * Handle course form submit
 */
async function handleCourseSubmit(e) {
  e.preventDefault();
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> שומר...';
  
  try {
    const selectedTemplates = Array.from(document.querySelectorAll('input[name="template"]:checked'))
      .map(cb => cb.value);
    
    if (selectedTemplates.length === 0) {
      showToast('יש לבחור לפחות תבנית שיעור אחת', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
      return;
    }

    // Check for duplicates (same templates)
    if (!currentCourseId) {
        const { getAllCourses } = await import('../../services/course-service.js');
        const allCourses = await getAllCourses(businessId, { isActive: true });
        
        const isDuplicate = allCourses.some(course => {
            if (!course.templateIds || course.templateIds.length !== selectedTemplates.length) return false;
            
            const courseTemplates = [...course.templateIds].sort();
            const newTemplates = [...selectedTemplates].sort();
            
            return courseTemplates.every((id, index) => id === newTemplates[index]);
        });

        if (isDuplicate) {
            showToast('קיים כבר קורס פעיל עם אותן תבניות שיעור. לא ניתן ליצור קורס כפול.', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
            return;
        }
    }
    
    // Build schedule from selected templates
    const schedule = selectedTemplates.map(id => {
        const template = selectedTemplatesMap.get(id);
        if (!template) return null;
        return {
            dayOfWeek: template.dayOfWeek,
            startTime: template.startTime,
            duration: template.duration,
            templateId: id,
            teacherId: template.teacherId,
            templateName: template.name,
            branchId: template.branchId
        };
    }).filter(item => item !== null);

    const courseData = {
      name: document.getElementById('courseName').value.trim(),
      startDate: parseDDMMYYYYToDate(document.getElementById('courseStartDate').value),
      endDate: parseDDMMYYYYToDate(document.getElementById('courseEndDate').value),
      price: parseFloat(document.getElementById('coursePrice').value) || 0,
      maxStudents: parseInt(document.getElementById('courseMaxStudents').value) || null,
      description: document.getElementById('courseDescription').value.trim(),
      templateIds: selectedTemplates,
      schedule: schedule
    };
    
    if (currentCourseId) {
      // Update existing course
      await updateCourse(businessId, currentCourseId, courseData);
      showToast('הקורס עודכן בהצלחה!');
    } else {
      // Create new course
      await createCourse(businessId, courseData);
      showToast('הקורס נוצר בהצלחה!');
    }
    
    closeCourseModal();
    await loadInitialData();
  } catch (error) {
    console.error('Error saving course:', error);
    showToast('שגיאה בשמירת הקורס: ' + error.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}

/**
 * Open manage enrollments modal
 */
window.openManageEnrollmentsModal = async function(courseId) {
  try {
    currentCourseId = courseId;

    // Load students if not already loaded (needed for search and displaying enrolled list)
    if (students.length === 0) {
      students = await getAllStudents(businessId);
    }

    const course = await getCourseById(businessId, courseId);
    
    document.getElementById('enrollmentCourseName').textContent = course.name;
    
    // Reset Add Student Section visibility
    document.getElementById('addStudentSection').style.display = 'none';
    document.getElementById('showAddStudentBtn').style.display = 'block';

    // Setup student search
    const searchInput = document.getElementById('enrollStudentSearch');
    const searchResults = document.getElementById('studentSearchResults');
    const studentIdInput = document.getElementById('enrollStudentId');
    
    // Clear search
    searchInput.value = '';
    studentIdInput.value = '';
    searchResults.style.display = 'none';
    
    // Search functionality
    let searchTimeout;
    searchInput.addEventListener('input', function(e) {
      clearTimeout(searchTimeout);
      const query = e.target.value.trim().toLowerCase();
      
      if (query.length < 2) {
        searchResults.style.display = 'none';
        studentIdInput.value = '';
        return;
      }
      
      searchTimeout = setTimeout(() => {
        const filtered = students.filter(s => {
          const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
          const phone = s.phone || '';
          return fullName.includes(query) || phone.includes(query);
        });
        
        if (filtered.length > 0) {
          searchResults.innerHTML = filtered.slice(0, 10).map(student => {
            const fullName = `${student.firstName} ${student.lastName}`;
            const phone = student.phone || '';
            const parentName = student.parentName || '';
            
            // Helper function to highlight matched text
            const highlightMatch = (text, query) => {
              if (!text) return text;
              const regex = new RegExp(`(${query})`, 'gi');
              return text.replace(regex, '<strong>$1</strong>');
            };
            
            // Determine what matched and highlight it
            const displayName = fullName.toLowerCase().includes(query) ? highlightMatch(fullName, query) : fullName;
            const displayPhone = phone.includes(query) ? highlightMatch(phone, query) : phone;
            const displayParent = parentName.toLowerCase().includes(query) ? highlightMatch(parentName, query) : parentName;
            
            return `
              <div class="search-result-item" data-student-id="${student.id}">
                <div class="search-result-item-name">${displayName}</div>
                <div class="search-result-item-details">
                  ${phone ? `טלפון: ${displayPhone}` : ''}
                  ${parentName ? ` | הורה: ${displayParent}` : ''}
                </div>
              </div>
            `;
          }).join('');
          
          // Add click handlers
          searchResults.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', function() {
              const studentId = this.dataset.studentId;
              const student = students.find(s => s.id === studentId);
              searchInput.value = `${student.firstName} ${student.lastName}`;
              studentIdInput.value = studentId;
              searchResults.style.display = 'none';
            });
          });
          
          searchResults.style.display = 'block';
        } else {
          searchResults.innerHTML = '<div class="search-no-results">לא נמצאו תלמידים</div>';
          searchResults.style.display = 'block';
          studentIdInput.value = '';
        }
      }, 300);
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
      if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.style.display = 'none';
      }
    });
    
    // Set default effective from date to today
    document.getElementById('enrollEffectiveFrom').value = formatDateToDDMMYYYY(new Date());
    
    // Load enrolled students
    await loadEnrolledStudents(courseId);
    
    showModal('enrollmentsModal');
  } catch (error) {
    console.error('Error opening enrollments modal:', error);
    showToast('שגיאה בטעינת פרטי הקורס', 'error');
  }
};

/**
 * Load enrolled students for a course
 */
async function loadEnrolledStudents(courseId) {
  try {
    const enrollments = await getActiveCourseEnrollments(businessId, courseId, new Date());
    
    document.getElementById('enrolledCount').textContent = enrollments.length;
    
    const container = document.getElementById('enrolledStudentsList');
    
    if (enrollments.length === 0) {
      container.innerHTML = '<p class="text-muted">אין תלמידים רשומים לקורס זה</p>';
      return;
    }
    
    // Get student details
    const studentsMap = {};
    students.forEach(s => studentsMap[s.id] = s);
    
    // Clear selection when reloading
    selectedEnrolledStudents.clear();

    // Create toolbar
    const toolbarHtml = `
      <div class="enrollment-actions-toolbar" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #eee;">
        <div class="bulk-selection-controls" style="display: flex; align-items: center; gap: 10px;">
          <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
            <input type="checkbox" id="selectAllEnrollments"> 
            <span>בחר הכל</span>
          </label>
          <span id="selectedEnrollmentsCount" style="font-size: 0.9em; color: #666; display: none;">0 נבחרו</span>
        </div>
        <button id="bulkRemoveBtn" class="btn btn-sm btn-danger" style="display: none;">
          הסר נבחרים
        </button>
      </div>
      <div id="enrollmentsListItems"></div>
    `;
    
    container.innerHTML = toolbarHtml;
    const listContainer = document.getElementById('enrollmentsListItems');

    listContainer.innerHTML = enrollments.map(enrollment => {
      const student = studentsMap[enrollment.studentId];
      if (!student) return '';
      
      return `
        <div class="enrolled-student-item" style="display: flex; align-items: center; gap: 10px; padding: 10px; border-bottom: 1px solid #f0f0f0;">
          <input type="checkbox" class="enrollment-checkbox" data-student-id="${student.id}" data-student-name="${student.firstName} ${student.lastName}">
          <div class="student-info" style="flex: 1;">
            <strong>${student.firstName} ${student.lastName}</strong>
            <small style="display: block; color: #666;">הצטרף ב: ${formatDate(enrollment.effectiveFrom)}</small>
          </div>
          <button class="btn btn-sm btn-outline-danger" onclick="handleRemoveEnrollment('${courseId}', '${student.id}', '${student.firstName} ${student.lastName}')">
            הסר
          </button>
        </div>
      `;
    }).join('');

    // Add event listeners
    const selectAllCheckbox = document.getElementById('selectAllEnrollments');
    const checkboxes = container.querySelectorAll('.enrollment-checkbox');
    const bulkRemoveBtn = document.getElementById('bulkRemoveBtn');
    const countLabel = document.getElementById('selectedEnrollmentsCount');

    function updateBulkUI() {
      const count = selectedEnrolledStudents.size;
      if (count > 0) {
        bulkRemoveBtn.style.display = 'block';
        countLabel.style.display = 'block';
        countLabel.textContent = `${count} נבחרו`;
      } else {
        bulkRemoveBtn.style.display = 'none';
        countLabel.style.display = 'none';
      }
      
      // Update select all checkbox state
      const allChecked = Array.from(checkboxes).every(cb => cb.checked);
      const someChecked = Array.from(checkboxes).some(cb => cb.checked);
      selectAllCheckbox.checked = allChecked && checkboxes.length > 0;
      selectAllCheckbox.indeterminate = someChecked && !allChecked;
    }

    selectAllCheckbox.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      checkboxes.forEach(cb => {
        cb.checked = isChecked;
        const sId = cb.dataset.studentId;
        if (isChecked) selectedEnrolledStudents.add(sId);
        else selectedEnrolledStudents.delete(sId);
      });
      updateBulkUI();
    });

    checkboxes.forEach(cb => {
      cb.addEventListener('change', (e) => {
        const sId = e.target.dataset.studentId;
        if (e.target.checked) selectedEnrolledStudents.add(sId);
        else selectedEnrolledStudents.delete(sId);
        updateBulkUI();
      });
    });

    bulkRemoveBtn.addEventListener('click', () => {
      const studentsToRemove = [];
      checkboxes.forEach(cb => {
        if (cb.checked) {
          studentsToRemove.push({
            id: cb.dataset.studentId,
            name: cb.dataset.studentName
          });
        }
      });
      openRemoveEnrollmentModal(courseId, studentsToRemove);
    });

  } catch (error) {
    console.error('Error loading enrolled students:', error);
    showToast('שגיאה בטעינת רשימת התלמידים', 'error');
  }
}

/**
 * Handle add enrollment
 */
async function handleAddEnrollment() {
  const btn = document.getElementById('addEnrollmentBtn');
  const originalText = btn.textContent;
  
  const studentId = document.getElementById('enrollStudentId').value;
  const effectiveFrom = parseDDMMYYYYToDate(document.getElementById('enrollEffectiveFrom').value);
  
  if (!studentId) {
    showToast('יש לבחור תלמיד', 'error');
    return;
  }
  
  try {
    // Loading state
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> רושם...';
    
    // Enroll student in course
    await enrollStudentInCourse(businessId, currentCourseId, studentId, effectiveFrom);
    
    // Sync to future instances
    await syncEnrollmentToInstances(currentCourseId, studentId, effectiveFrom, 'add');
    
    // Success state
    btn.textContent = 'נרשם!';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-success');
    
    // Reset form and reload
    document.getElementById('enrollStudentSearch').value = '';
    document.getElementById('enrollStudentId').value = '';
    await loadEnrolledStudents(currentCourseId);
    
    // Revert button after delay
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = originalText;
      btn.classList.remove('btn-success');
      btn.classList.add('btn-primary');
    }, 500);
    
  } catch (error) {
    console.error('Error adding enrollment:', error);
    showToast('שגיאה בהוספת התלמיד: ' + error.message, 'error');
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

/**
 * Handle remove enrollment (Single)
 */
window.handleRemoveEnrollment = function(courseId, studentId, studentName) {
  openRemoveEnrollmentModal(courseId, [{ id: studentId, name: studentName }]);
};

/**
 * Open modal to confirm removal and select date
 */
function openRemoveEnrollmentModal(courseId, studentsToRemove) {
  const content = `
    <div class="remove-enrollment-modal">
      <p>אתה עומד להסיר <strong>${studentsToRemove.length}</strong> תלמידים מהקורס.</p>
      ${studentsToRemove.length <= 5 ? 
        `<ul style="margin-bottom: 15px;">${studentsToRemove.map(s => `<li>${s.name}</li>`).join('')}</ul>` : 
        `<p class="text-muted">...ועוד ${studentsToRemove.length - 5} תלמידים</p>`
      }
      <div class="form-group">
        <label for="removeEffectiveDate">תאריך הסרה (היום האחרון בקורס):</label>
        <input type="date" id="removeEffectiveDate" class="form-control" value="${new Date().toISOString().split('T')[0]}">
        <small class="text-muted">התלמידים יוסרו משיעורים עתידיים החל מיום אחרי התאריך הנבחר.</small>
      </div>
    </div>
  `;

  showModal({
    title: 'הסרת תלמידים מהקורס',
    content: content,
    confirmText: 'הסר תלמידים',
    confirmClass: 'btn-danger',
    onConfirm: async () => {
      const dateStr = document.getElementById('removeEffectiveDate').value;
      if (!dateStr) {
        showToast('יש לבחור תאריך', 'error');
        return false; // Don't close
      }
      
      await executeRemoveEnrollments(courseId, studentsToRemove, new Date(dateStr));
      return true; // Close modal
    }
  });
}

/**
 * Execute the removal of students
 */
async function executeRemoveEnrollments(courseId, studentsList, effectiveDate) {
  const results = { success: 0, failed: 0, errors: [] };
  
  for (const student of studentsList) {
    try {
      // Remove student from course
      await removeStudentFromCourse(businessId, courseId, student.id, effectiveDate);
      
      // Sync to future instances
      await syncEnrollmentToInstances(courseId, student.id, effectiveDate, 'remove');
      
      results.success++;
    } catch (error) {
      console.error(`Error removing student ${student.name}:`, error);
      results.failed++;
      results.errors.push(`${student.name}: ${error.message}`);
    }
  }

  await loadEnrolledStudents(courseId);

  if (results.failed > 0) {
    showToast(`נכשל להסיר ${results.failed} תלמידים:\n${results.errors.join('\n')}`, 'error');
    // If all failed, maybe return false? But some might have succeeded.
    // If we return true, it closes.
    return true; 
  }
  
  return true;
}

/**
 * Sync enrollment changes to future class instances
 */
async function syncEnrollmentToInstances(courseId, studentId, effectiveDate, action) {
  try {
    const course = await getCourseById(businessId, courseId);
    const templateIds = course.templateIds || [];
    
    // For each template in the course, update future instances
    for (const templateId of templateIds) {
      const futureInstances = await getFutureInstances(businessId, templateId, effectiveDate);
      
      for (const instance of futureInstances) {
        if (action === 'add') {
          await addStudentToInstance(businessId, instance.id, studentId);
        } else if (action === 'remove') {
          await removeStudentFromInstance(businessId, instance.id, studentId);
        }
      }
    }
  } catch (error) {
    console.error('Error syncing to instances:', error);
    throw error;
  }
}

/**
 * Close enrollments modal
 */
function closeEnrollmentsModal() {
  closeModal();
  currentCourseId = null;
}

/**
 * View course details
 */
window.viewCourse = async function(courseId) {
  try {
    const course = await getEnrichedCourse(businessId, courseId);
    
    document.getElementById('courseDetailsTitle').textContent = course.name;
    
    const content = document.getElementById('courseDetailsContent');
    content.innerHTML = `
      <div class="course-details">
        <div class="detail-group">
          <h3>פרטי הקורס</h3>
          <div class="detail-item">
            <strong>תאריכים:</strong> ${formatDate(course.startDate)} - ${formatDate(course.endDate)}
          </div>
          <div class="detail-item">
            <strong>סטטוס:</strong> ${getCourseStateText(course)}
          </div>
          <div class="detail-item">
            <strong>מחיר:</strong> ₪${course.price || 0}
          </div>
          <div class="detail-item">
            <strong>תלמידים רשומים:</strong> ${course.enrollmentCount || 0}${course.maxStudents ? ` / ${course.maxStudents}` : ''}
          </div>
        </div>
        
        ${course.description ? `
          <div class="detail-group">
            <h3>תיאור</h3>
            <p>${course.description}</p>
          </div>
        ` : ''}
        
        <div class="detail-group">
          <h3>שיעורים בקורס (${course.schedule?.length || 0})</h3>
          <div class="templates-list">
            ${await renderCourseTemplates(course.schedule)}
          </div>
        </div>
      </div>
    `;
    
    const modal = document.getElementById('courseDetailsModal');
    showModal('courseDetailsModal');
    currentCourseId = courseId;
  } catch (error) {
    console.error('Error viewing course:', error);
    showToast('שגיאה בטעינת פרטי הקורס', 'error');
  }
};

/**
 * Render course templates list
 */
async function renderCourseTemplates(schedule) {
  if (!schedule || schedule.length === 0) {
    return '<p class="text-muted">אין שיעורים בקורס זה</p>';
  }
  
  return schedule.map(item => {
    return `
      <div class="template-item">
        <strong>${item.templateName || 'שיעור'}</strong>
        <span>${getDayName(item.dayOfWeek)} ${item.startTime}</span>
      </div>
    `;
  }).join('');
}

/**
 * Handle edit from details modal
 */
function handleEditCourseFromDetails() {
  const courseId = currentCourseId;
  closeCourseDetailsModal();
  window.openEditCourseModal(courseId);
}

/**
 * Close course details modal
 */
function closeCourseDetailsModal() {
  closeModal();
  currentCourseId = null;
}

/**
 * Handle cancel course status button click
 */
async function handleCancelCourseStatus() {
  if (!currentCourseId) return;
  
  if (!await showConfirm({ title: 'ביטול קורס', message: 'האם אתה בטוח שברצונך לבטל את הקורס?' })) {
    return;
  }
  
  showToast('מבטל קורס...', 'info');
  try {
    await updateCourseActiveStatus(businessId, currentCourseId, false);
    showToast('הקורס בוטל בהצלחה');
    closeCourseModal();
    await loadInitialData();
  } catch (error) {
    console.error('Error cancelling course:', error);
    showToast('שגיאה בביטול הקורס', 'error');
  }
}

/**
 * Cancel course
 */
window.cancelCourse = async function(courseId) {
  if (!await showConfirm({ title: 'ביטול קורס', message: 'האם אתה בטוח שברצונך לבטל את הקורס?' })) {
    return;
  }
  
  showToast('מבטל קורס...', 'info');
  try {
    await updateCourseActiveStatus(businessId, courseId, false);
    showToast('הקורס בוטל בהצלחה');
    await loadInitialData();
  } catch (error) {
    console.error('Error cancelling course:', error);
    showToast('שגיאה בביטול הקורס', 'error');
  }
};

/**
 * Show loading indicator
 */
function renderLoadingState() {
  document.getElementById('coursesList').innerHTML = '<div class="loading">טוען...</div>';
}

/**
 * Get filter options from UI
 */
function getFilterOptions() {
  const filterStatus = document.getElementById('filterStatus').value;
  const options = {
    limit: 10,
    sortBy: 'startDate',
    sortOrder: 'desc'
  };
  
  if (filterStatus === 'upcoming') {
    options.status = 'active';
    options.timeFrame = 'future';
  } else if (filterStatus === 'completed') {
    options.status = 'active';
    options.timeFrame = 'past';
  } else if (filterStatus === 'active') {
    options.status = 'active';
    options.timeFrame = 'current';
  } else if (filterStatus === 'cancelled') {
    options.status = 'cancelled';
  } else {
    // Default: show all active courses
    options.isActive = true;
  }
  
  return options;
}

/**
 * Reload courses based on filters
 */
async function reloadCourses() {
  try {
    renderLoadingState();
    courses = [];
    coursesLastDoc = null;
    coursesHasMore = true;
    
    const { getPaginatedCourses } = await import('../../services/course-service.js');
    const options = getFilterOptions();
    
    const coursesResult = await getPaginatedCourses(businessId, options);
    
    courses = coursesResult.courses;
    coursesLastDoc = coursesResult.lastDoc;
    coursesHasMore = coursesResult.hasMore;
    
    updateCoursesCount();
    renderCourses();
    addLoadMoreCoursesButton();
  } catch (error) {
    console.error('Error reloading courses:', error);
    showToast('שגיאה בטעינת הקורסים', 'error');
  }
}

/**
 * Handle course search
 */
const handleCourseSearch = debounce(async (e) => {
  const query = e.target.value.trim();
  
  if (query.length < 2) {
    isSearching = false;
    searchResults = [];
    renderCourses();
    updateCoursesCount();
    // Show load more button if not searching
    addLoadMoreCoursesButton();
    return;
  }
  
  try {
    isSearching = true;
    // Hide load more button while searching
    const loadMoreBtn = document.getElementById('loadMoreCoursesBtn');
    if (loadMoreBtn) loadMoreBtn.parentElement.style.display = 'none';

    // Clear status filter to ensure results are visible
    const filterStatus = document.getElementById('filterStatus');
    if (filterStatus && filterStatus.value) {
      filterStatus.value = '';
    }

    document.getElementById('coursesList').innerHTML = '<div class="loading">מחפש...</div>';
    
    searchResults = await searchCourses(businessId, query);
    renderCourses();
    updateCoursesCount();
  } catch (error) {
    console.error('Error searching courses:', error);
    isSearching = false;
    renderCourses();
  }
}, 500);

/**
 * Open Import Wizard
 */
function openImportWizard() {
  const config = {
    title: 'יבוא קורסים',
    requiredFields: [
      { key: 'name', label: 'שם הקורס' },
      { key: 'startDate', label: 'תאריך התחלה' },
      { key: 'endDate', label: 'תאריך סיום' }
    ],
    optionalFields: [
      { key: 'price', label: 'מחיר' },
      { key: 'maxStudents', label: 'מקסימום תלמידים' },
      { key: 'description', label: 'תיאור' },
      { key: 'templateId', label: 'תבניות' }
    ],
    relationalFields: {
        templateId: {
            label: 'תבנית',
            service: 'class-template-service',
            method: 'getAllClassTemplates',
            nameField: 'name',
            separator: ','
        }
    },
    validate: validateCourseImport,
    importData: importCourses
  };

  new UniversalImportWizard(businessId, config, () => {
    loadInitialData();
  });
}


