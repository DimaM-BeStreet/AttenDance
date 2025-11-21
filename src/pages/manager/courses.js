import './courses-styles.js';
import { createNavbar } from '../../components/navbar.js';
import { auth } from '../../config/firebase-config.js';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  getAllEnrichedCourses,
  getCourseById,
  createCourse,
  updateCourse,
  updateCourseStatus,
  addTemplatesToCourse,
  removeTemplatesFromCourse,
  getEnrichedCourse
} from '../../services/course-service.js';
import {
  enrollStudentInCourse,
  removeStudentFromCourse,
  getActiveCourseEnrollments,
  getCourseStudentIds
} from '../../services/enrollment-service.js';
import { getAllTeachers } from '../../services/teacher-service.js';
import { getAllStudents } from '../../services/student-service.js';
import { getAllClassTemplates } from '../../services/class-template-service.js';
import { getFutureInstances, addStudentToInstance, removeStudentFromInstance } from '../../services/class-instance-service.js';

let businessId = null;
let currentCourseId = null;
let courses = [];
let teachers = [];
let students = [];
let templates = [];

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
        alert('שגיאה בטעינת נתוני המשתמש');
        return;
      }

      // Check user role
      if (!['superAdmin', 'admin'].includes(userDoc.role)) {
        alert('אין לך הרשאות לצפות בדף זה');
        window.location.href = '/';
        return;
      }

      businessId = userDoc.businessId;
      await loadInitialData();
    } catch (error) {
      console.error('Error initializing:', error);
      alert('שגיאה בטעינת הנתונים');
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
 * Load initial data
 */
async function loadInitialData() {
  try {
    showLoading();
    
    // Load all data in parallel
    [courses, teachers, students, templates] = await Promise.all([
      getAllEnrichedCourses(businessId, { isActive: true }),
      getAllTeachers(businessId),
      getAllStudents(businessId, { active: true }),
      getAllClassTemplates(businessId)
    ]);
    
    updateCoursesCount();
    renderCourses();
    hideLoading();
  } catch (error) {
    console.error('Error loading data:', error);
    alert('שגיאה בטעינת הנתונים');
    hideLoading();
  }
}

/**
 * Update courses count display
 */
function updateCoursesCount() {
  const activeCount = courses.filter(c => c.status === 'active').length;
  const totalCount = courses.length;
  document.getElementById('coursesCount').textContent = 
    `${activeCount} קורסים פעילים מתוך ${totalCount}`;
}

/**
 * Initialize event listeners
 */
function initEventListeners() {
  // Add course buttons
  document.getElementById('addCourseBtn').addEventListener('click', openAddCourseModal);
  document.getElementById('addCourseEmptyBtn')?.addEventListener('click', openAddCourseModal);
  
  // Course form
  document.getElementById('courseForm').addEventListener('submit', handleCourseSubmit);
  document.getElementById('cancelCourseBtn').addEventListener('click', closeCourseModal);
  document.getElementById('closeCourseModal').addEventListener('click', closeCourseModal);
  
  // Enrollments modal
  document.getElementById('closeEnrollmentsModal').addEventListener('click', closeEnrollmentsModal);
  document.getElementById('closeEnrollmentsBtn').addEventListener('click', closeEnrollmentsModal);
  document.getElementById('addEnrollmentBtn').addEventListener('click', handleAddEnrollment);
  
  // Course details modal
  document.getElementById('closeCourseDetailsModal').addEventListener('click', closeCourseDetailsModal);
  document.getElementById('closeCourseDetailsBtn').addEventListener('click', closeCourseDetailsModal);
  document.getElementById('editCourseDetailsBtn').addEventListener('click', handleEditCourseFromDetails);
  
  // Filters
  document.getElementById('filterStatus').addEventListener('change', () => {
    renderCourses();
    updateCoursesCount();
  });
  document.getElementById('searchCourse').addEventListener('input', renderCourses);
}

/**
 * Render courses list
 */
function renderCourses() {
  const filterStatus = document.getElementById('filterStatus').value;
  const searchQuery = document.getElementById('searchCourse').value.toLowerCase();
  
  let filtered = courses.filter(course => {
    if (filterStatus && course.status !== filterStatus) return false;
    if (searchQuery && !course.name.toLowerCase().includes(searchQuery)) return false;
    return true;
  });
  
  const container = document.getElementById('coursesList');
  const emptyState = document.getElementById('emptyState');
  
  if (filtered.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'flex';
    return;
  }
  
  emptyState.style.display = 'none';
  
  container.innerHTML = filtered.map(course => `
    <div class="course-card" data-course-id="${course.id}">
      <div class="course-header">
        <h3>${course.name}</h3>
        <span class="course-status status-${course.status}">${getStatusText(course.status)}</span>
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
          <span class="info-value">${getTemplatesSummary(course.templateIds)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">מחיר:</span>
          <span class="info-value">₪${course.price || 0}</span>
        </div>
      </div>
      
      <div class="course-actions">
        <button class="btn btn-sm btn-secondary" onclick="viewCourse('${course.id}')">צפה</button>
        <button class="btn btn-sm btn-primary" onclick="openManageEnrollmentsModal('${course.id}')">נהל רישום</button>
        <button class="btn btn-sm btn-secondary" onclick="openEditCourseModal('${course.id}')">ערוך</button>
        ${course.status === 'active' ? `
          <button class="btn btn-sm btn-danger" onclick="cancelCourse('${course.id}')">בטל קורס</button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

/**
 * Get templates summary for course display
 */
function getTemplatesSummary(templateIds) {
  if (!templateIds || templateIds.length === 0) return 'אין שיעורים';
  
  const courseTemplates = templates.filter(t => templateIds.includes(t.id));
  if (courseTemplates.length === 0) return `${templateIds.length} שיעורים`;
  
  // Day names by numeric index (0=Sunday, 6=Saturday)
  const dayNames = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
  
  const sorted = courseTemplates.sort((a, b) => {
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
 * Get status text in Hebrew
 */
function getStatusText(status) {
  const statusMap = {
    'active': 'פעיל',
    'upcoming': 'עתידי',
    'completed': 'הסתיים',
    'cancelled': 'בוטל'
  };
  return statusMap[status] || status;
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
  
  // Set default dates (today + 3 months)
  const today = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 3);
  
  document.getElementById('courseStartDate').valueAsDate = today;
  document.getElementById('courseEndDate').valueAsDate = endDate;
  
  renderTemplatesSelection([]);
  const modal = document.getElementById('courseModal');
  modal.style.display = 'flex';
  setTimeout(() => modal.classList.add('show'), 10);
}

/**
 * Open edit course modal
 */
window.openEditCourseModal = async function(courseId) {
  try {
    currentCourseId = courseId;
    const course = await getCourseById(businessId, courseId);
    
    document.getElementById('courseModalTitle').textContent = 'ערוך קורס';
    document.getElementById('courseName').value = course.name;
    
    // Format dates for input
    const startDate = course.startDate.toDate ? course.startDate.toDate() : new Date(course.startDate);
    const endDate = course.endDate.toDate ? course.endDate.toDate() : new Date(course.endDate);
    document.getElementById('courseStartDate').valueAsDate = startDate;
    document.getElementById('courseEndDate').valueAsDate = endDate;
    
    document.getElementById('coursePrice').value = course.price || 0;
    document.getElementById('courseMaxStudents').value = course.maxStudents || '';
    document.getElementById('courseDescription').value = course.description || '';
    
    renderTemplatesSelection(course.templateIds || []);
    document.getElementById('courseModal').classList.add('active');
  } catch (error) {
    console.error('Error loading course:', error);
    alert('שגיאה בטעינת פרטי הקורס');
  }
};

/**
 * Render templates selection checkboxes
 */
function renderTemplatesSelection(selectedIds = []) {
  const container = document.getElementById('templatesSelection');
  
  container.innerHTML = templates.map(template => `
    <label class="template-checkbox">
      <input type="checkbox" name="template" value="${template.id}" 
        ${selectedIds.includes(template.id) ? 'checked' : ''}>
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
  const modal = document.getElementById('courseModal');
  modal.classList.remove('show');
  setTimeout(() => modal.style.display = 'none', 300);
  currentCourseId = null;
}

/**
 * Handle course form submit
 */
async function handleCourseSubmit(e) {
  e.preventDefault();
  
  try {
    const selectedTemplates = Array.from(document.querySelectorAll('input[name="template"]:checked'))
      .map(cb => cb.value);
    
    if (selectedTemplates.length === 0) {
      alert('יש לבחור לפחות תבנית שיעור אחת');
      return;
    }
    
    const courseData = {
      name: document.getElementById('courseName').value.trim(),
      startDate: new Date(document.getElementById('courseStartDate').value),
      endDate: new Date(document.getElementById('courseEndDate').value),
      price: parseFloat(document.getElementById('coursePrice').value) || 0,
      maxStudents: parseInt(document.getElementById('courseMaxStudents').value) || null,
      description: document.getElementById('courseDescription').value.trim(),
      templateIds: selectedTemplates
    };
    
    if (currentCourseId) {
      // Update existing course
      await updateCourse(businessId, currentCourseId, courseData);
      alert('הקורס עודכן בהצלחה!');
    } else {
      // Create new course
      await createCourse(businessId, courseData);
      alert('הקורס נוצר בהצלחה!');
    }
    
    closeCourseModal();
    await loadInitialData();
  } catch (error) {
    console.error('Error saving course:', error);
    alert('שגיאה בשמירת הקורס: ' + error.message);
  }
}

/**
 * Open manage enrollments modal
 */
window.openManageEnrollmentsModal = async function(courseId) {
  try {
    currentCourseId = courseId;
    const course = await getCourseById(businessId, courseId);
    
    document.getElementById('enrollmentCourseName').textContent = course.name;
    
    // Populate students dropdown
    const enrollStudent = document.getElementById('enrollStudent');
    enrollStudent.innerHTML = '<option value="">בחר תלמיד...</option>' + 
      students.map(s => `<option value="${s.id}">${s.firstName} ${s.lastName}</option>`).join('');
    
    // Set default effective from date to today
    document.getElementById('enrollEffectiveFrom').valueAsDate = new Date();
    
    // Load enrolled students
    await loadEnrolledStudents(courseId);
    
    const modal = document.getElementById('enrollmentsModal');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('show'), 10);
  } catch (error) {
    console.error('Error opening enrollments modal:', error);
    alert('שגיאה בטעינת פרטי הקורס');
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
    
    container.innerHTML = enrollments.map(enrollment => {
      const student = studentsMap[enrollment.studentId];
      if (!student) return '';
      
      return `
        <div class="enrolled-student-item">
          <div class="student-info">
            <strong>${student.firstName} ${student.lastName}</strong>
            <small>${formatDate(enrollment.effectiveFrom)}</small>
          </div>
          <button class="btn btn-sm btn-danger" onclick="handleRemoveEnrollment('${courseId}', '${student.id}', '${student.firstName} ${student.lastName}')">
            הסר
          </button>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Error loading enrolled students:', error);
    alert('שגיאה בטעינת רשימת התלמידים');
  }
}

/**
 * Handle add enrollment
 */
async function handleAddEnrollment() {
  const studentId = document.getElementById('enrollStudent').value;
  const effectiveFrom = new Date(document.getElementById('enrollEffectiveFrom').value);
  
  if (!studentId) {
    alert('יש לבחור תלמיד');
    return;
  }
  
  try {
    // Enroll student in course
    await enrollStudentInCourse(businessId, currentCourseId, studentId, effectiveFrom);
    
    // Sync to future instances
    await syncEnrollmentToInstances(currentCourseId, studentId, effectiveFrom, 'add');
    
    alert('התלמיד נוסף לקורס בהצלחה!');
    
    // Reset form and reload
    document.getElementById('enrollStudent').value = '';
    await loadEnrolledStudents(currentCourseId);
  } catch (error) {
    console.error('Error adding enrollment:', error);
    alert('שגיאה בהוספת התלמיד: ' + error.message);
  }
}

/**
 * Handle remove enrollment
 */
window.handleRemoveEnrollment = async function(courseId, studentId, studentName) {
  const effectiveTo = prompt(`הסר את ${studentName} מהקורס החל מתאריך (YYYY-MM-DD):`, 
    new Date().toISOString().split('T')[0]);
  
  if (!effectiveTo) return;
  
  try {
    const effectiveToDate = new Date(effectiveTo);
    
    // Remove student from course
    await removeStudentFromCourse(businessId, courseId, studentId, effectiveToDate);
    
    // Sync to future instances
    await syncEnrollmentToInstances(courseId, studentId, effectiveToDate, 'remove');
    
    alert('התלמיד הוסר מהקורס בהצלחה!');
    await loadEnrolledStudents(courseId);
  } catch (error) {
    console.error('Error removing enrollment:', error);
    alert('שגיאה בהסרת התלמיד: ' + error.message);
  }
};

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
  const modal = document.getElementById('enrollmentsModal');
  modal.classList.remove('show');
  setTimeout(() => modal.style.display = 'none', 300);
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
            <strong>סטטוס:</strong> ${getStatusText(course.status)}
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
          <h3>שיעורים בקורס (${course.templateIds?.length || 0})</h3>
          <div class="templates-list">
            ${await renderCourseTemplates(course.templateIds)}
          </div>
        </div>
      </div>
    `;
    
    const modal = document.getElementById('courseDetailsModal');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('show'), 10);
    currentCourseId = courseId;
  } catch (error) {
    console.error('Error viewing course:', error);
    alert('שגיאה בטעינת פרטי הקורס');
  }
};

/**
 * Render course templates list
 */
async function renderCourseTemplates(templateIds) {
  if (!templateIds || templateIds.length === 0) {
    return '<p class="text-muted">אין שיעורים בקורס זה</p>';
  }
  
  const templatesMap = {};
  templates.forEach(t => templatesMap[t.id] = t);
  
  return templateIds.map(id => {
    const template = templatesMap[id];
    if (!template) return '';
    
    return `
      <div class="template-item">
        <strong>${template.name}</strong>
        <span>${getDayName(template.dayOfWeek)} ${template.startTime}</span>
      </div>
    `;
  }).join('');
}

/**
 * Handle edit from details modal
 */
function handleEditCourseFromDetails() {
  closeCourseDetailsModal();
  window.openEditCourseModal(currentCourseId);
}

/**
 * Close course details modal
 */
function closeCourseDetailsModal() {
  const modal = document.getElementById('courseDetailsModal');
  modal.classList.remove('show');
  setTimeout(() => modal.style.display = 'none', 300);
  currentCourseId = null;
}

/**
 * Cancel course
 */
window.cancelCourse = async function(courseId) {
  if (!confirm('האם אתה בטוח שברצונך לבטל את הקורס?')) {
    return;
  }
  
  try {
    await updateCourseStatus(businessId, courseId, 'cancelled');
    alert('הקורס בוטל בהצלחה');
    await loadInitialData();
  } catch (error) {
    console.error('Error cancelling course:', error);
    alert('שגיאה בביטול הקורס');
  }
};

/**
 * Show loading indicator
 */
function showLoading() {
  document.getElementById('coursesList').innerHTML = '<div class="loading">טוען...</div>';
}

/**
 * Hide loading indicator
 */
function hideLoading() {
  // Loading is hidden when content is rendered
}


