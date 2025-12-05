/**
 * Student Management Page
 * Mobile-first CRUD interface for student management
 */

import './students-styles.js';
import { createNavbar } from '../../components/navbar.js';
import { showModal, closeModal, showToast } from '../../components/modal.js';
import { createTable } from '../../components/table.js';
import { 
    getAllStudents, 
    createStudent, 
    updateStudent, 
    permanentlyDeleteStudent,
    uploadStudentPhoto,
    deleteStudentPhoto,
    searchStudents,
    getStudentById,
    getStudentAttendanceStats,
    getStudentEnrollments
} from '../../services/student-service.js';
import { 
    getTempStudentsByBusiness,
    deleteTempStudent,
    getTempStudentById,
    updateTempStudent
} from '../../services/temp-students-service.js';
import { getClassInstances, addStudentToInstance } from '../../services/class-instance-service.js';
import { getAllCourses } from '../../services/course-service.js';
import { enrollStudentInCourse } from '../../services/enrollment-service.js';
import { getAllBranches } from '../../services/branch-service.js';
import { getAllTeachers } from '../../services/teacher-service.js';
import { auth, db } from '../../config/firebase-config.js';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

// State
let currentBusinessId = null;
let currentUser = null;
let studentsData = [];
let tempStudentsData = [];
let currentTab = 'permanent'; // 'permanent' or 'temp'
let currentFilter = 'all';
let currentEditingId = null;
let photoFile = null;
let currentPhotoUrl = null;
let studentsTable = null;
let selectedStudents = new Set(); // Track selected student IDs
let branches = [];
let teachers = [];
let courses = [];
let classInstances = [];
let templates = [];
// Pagination state
let studentsLastDoc = null;
let studentsHasMore = true;
let isLoadingMore = false;

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = '/login.html';
            return;
        }

        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            const userData = userDoc.data();
            
            if (!userData || !['superAdmin', 'admin', 'branchManager'].includes(userData.role)) {
                showToast('אין לך הרשאות לצפות בדף זה', 'error');
                window.location.href = '/';
                return;
            }

            currentUser = userData;
            currentBusinessId = userData.businessId;
            
            // Initialize navbar
            createNavbar();

            // Load students
            await loadStudents();

            // Setup event listeners
            setupEventListeners();

            // Check for URL actions
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('action') === 'add') {
                openAddModal();
            }

        } catch (error) {
            console.error('Error initializing page:', error);
            showToast('שגיאה בטעינת הדף', 'error');
        }
    });
});

/**
 * Load all students with pagination
 */
async function loadStudents(resetPagination = true) {
    try {
        if (resetPagination) {
            studentsData = [];
            studentsLastDoc = null;
            studentsHasMore = true;
        }
        
        // Load first page of students (10 items)
        const { getPaginatedStudents } = await import('../../services/student-service.js');
        const result = await getPaginatedStudents(currentBusinessId, {
            limit: 10,
            sortBy: 'firstName',
            sortOrder: 'asc'
        });
        
        studentsData = result.students;
        studentsLastDoc = result.lastDoc;
        studentsHasMore = result.hasMore;
        
        tempStudentsData = await getTempStudentsByBusiness(currentBusinessId);
        
        renderTable();
        addLoadMoreButton();
    } catch (error) {
        console.error('Error loading students:', error);
        document.getElementById('studentsTableContainer').innerHTML = 
            '<div class="error-state">שגיאה בטעינת תלמידים</div>';
    }
}

/**
 * Load more students
 */
async function loadMoreStudents() {
    if (!studentsHasMore || isLoadingMore || !studentsLastDoc) return;
    
    try {
        isLoadingMore = true;
        const loadMoreBtn = document.getElementById('loadMoreStudentsBtn');
        if (loadMoreBtn) {
            loadMoreBtn.disabled = true;
            loadMoreBtn.textContent = 'טוען...';
        }
        
        const { getPaginatedStudents } = await import('../../services/student-service.js');
        const result = await getPaginatedStudents(currentBusinessId, {
            limit: 10,
            startAfterDoc: studentsLastDoc,
            sortBy: 'firstName',
            sortOrder: 'asc'
        });
        
        studentsData = [...studentsData, ...result.students];
        studentsLastDoc = result.lastDoc;
        studentsHasMore = result.hasMore;
        
        renderTable();
        addLoadMoreButton();
    } catch (error) {
        console.error('Error loading more students:', error);
        showToast('שגיאה בטעינת תלמידים נוספים', 'error');
    } finally {
        isLoadingMore = false;
        const loadMoreBtn = document.getElementById('loadMoreStudentsBtn');
        if (loadMoreBtn) {
            loadMoreBtn.disabled = false;
            loadMoreBtn.textContent = 'טען עוד תלמידים';
        }
    }
}

/**
 * Add Load More button if needed
 */
function addLoadMoreButton() {
    const container = document.getElementById('studentsTableContainer');
    if (!container) return;
    
    // Remove existing button container (not just the button)
    const existingBtnContainer = container.querySelector('.load-more-container');
    if (existingBtnContainer) {
        existingBtnContainer.remove();
    }
    
    // Add button if there are more students
    if (studentsHasMore && currentTab === 'permanent') {
        const btnContainer = document.createElement('div');
        btnContainer.className = 'load-more-container';
        btnContainer.style.cssText = 'text-align: center; padding: 20px;';
        btnContainer.innerHTML = `
            <button id="loadMoreStudentsBtn" class="btn-secondary" style="padding: 8px 16px; font-size: 13px; opacity: 0.7;">
                טען עוד
            </button>
        `;
        container.appendChild(btnContainer);
        
        const btn = document.getElementById('loadMoreStudentsBtn');
        btn.addEventListener('click', loadMoreStudents);
        
        // Setup infinite scroll observation
        setTimeout(() => observeLoadMoreButton(), 50);
    }
}

/**
 * Setup infinite scroll for students table
 */
let infiniteScrollObserver = null;

function setupInfiniteScroll() {
    const container = document.getElementById('studentsTableContainer');
    if (!container) return;
    
    // Disconnect existing observer if any
    if (infiniteScrollObserver) {
        infiniteScrollObserver.disconnect();
    }
    
    // Create intersection observer for infinite scroll
    const observerCallback = (entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && studentsHasMore && !isLoadingMore && currentTab === 'permanent') {
                loadMoreStudents();
            }
        });
    };
    
    infiniteScrollObserver = new IntersectionObserver(observerCallback, {
        root: null,
        rootMargin: '100px',
        threshold: 0.1
    });
    
    // Start observing
    observeLoadMoreButton();
}

/**
 * Observe the load more button for infinite scroll
 */
function observeLoadMoreButton() {
    if (!infiniteScrollObserver) return;
    
    const container = document.getElementById('studentsTableContainer');
    if (!container) return;
    
    const btnContainer = container.querySelector('.load-more-container');
    if (btnContainer) {
        infiniteScrollObserver.observe(btnContainer);
    }
}



/**
 * Render students table
 */
function renderTable() {
    const container = document.getElementById('studentsTableContainer');
    
    // Get data based on current tab
    let dataToDisplay = currentTab === 'permanent' ? studentsData : tempStudentsData;
    
    // Filter students (only for permanent students)
    if (currentTab === 'permanent') {
        if (currentFilter === 'active') {
            dataToDisplay = studentsData.filter(s => s.isActive);
        } else if (currentFilter === 'inactive') {
            dataToDisplay = studentsData.filter(s => !s.isActive);
        }
    }

    // Create table if not exists
    if (!studentsTable) {
        const columns = [
            { 
                field: 'select', 
                label: '', 
                sortable: false,
                render: (value, row) => {
                    const isSelected = selectedStudents.has(row.id);
                    return `<input type="checkbox" class="table-photo-checkbox" data-student-id="${row.id}" ${isSelected ? 'checked' : ''}>`;
                }
            },
            { 
                field: 'photo', 
                label: '', 
                sortable: false,
                render: (value) => {
                    if (value) {
                        return `<img src="${value}" alt="תמונה" class="table-photo">`;
                    }
                    return '<div class="table-photo-placeholder">👤</div>';
                }
            },
            { 
                field: 'fullName', 
                label: 'שם מלא', 
                sortable: true,
                render: (value, row) => {
                    const label = row.active ? 'פעיל' : '<span class="strikethrough">פעיל</span>';
                    const badgeClass = row.active ? 'badge-success' : 'badge-secondary';
                    return `
                        <div>${value}</div>
                        <span class="badge ${badgeClass}">${label}</span>
                    `;
                }
            },
            { 
                field: 'phone', 
                label: 'טלפון', 
                sortable: false,
                render: (value) => `<span dir="ltr">${value}</span>`
            },
            { 
                field: 'active', 
                label: 'סטטוס', 
                sortable: true,
                render: (value) => {
                    const label = value ? 'פעיל' : 'לא פעיל';
                    const badgeClass = value ? 'badge-success' : 'badge-secondary';
                    return `<span class="badge ${badgeClass}">${label}</span>`;
                }
            },
        ];

        const actions = [
            {
                label: '✏️',
                title: 'עריכה',
                onClick: (row) => editStudent(row.id)
            }
        ];

        studentsTable = createTable('studentsTableContainer', {
            columns,
            actions: { buttons: actions },
            searchable: false, // We have custom search
            pagination: false,
            emptyMessage: 'אין תלמידים',
            onRowClick: (row) => viewStudent(row.id)
        });
    }

    // Transform data for table
    const tableData = dataToDisplay.map(student => {
        if (currentTab === 'temp') {
            // Temp student format
            return {
                id: student.id,
                photo: null,
                fullName: student.name,
                phone: student.phone,
                active: student.active
            };
        } else {
            // Permanent student format
            return {
                id: student.id,
                photo: student.photoURL,
                fullName: `${student.firstName} ${student.lastName}`,
                phone: student.phone,
                active: student.isActive
            };
        }
    });

    studentsTable.setData(tableData);
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab[data-tab]').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.tab[data-tab]').forEach(t => 
                t.classList.remove('tab-active'));
            e.currentTarget.classList.add('tab-active');
            currentTab = e.currentTarget.dataset.tab;
            currentFilter = 'all';
            
            // Show/hide status filters (only for permanent students)
            const statusFilters = document.getElementById('statusFilters');
            if (statusFilters) {
                if (currentTab === 'temp') {
                    statusFilters.style.display = 'none';
                } else {
                    statusFilters.style.display = 'flex';
                    // Reset filter to "all"
                    document.querySelectorAll('.chip[data-filter]').forEach(c => 
                        c.classList.remove('chip-active'));
                    document.querySelector('.chip[data-filter="all"]').classList.add('chip-active');
                }
            }
            
            renderTable();
        });
    });
    
    // Add student button
    document.getElementById('addStudentBtn').addEventListener('click', openAddModal);
    
    // Import students button
    document.getElementById('importStudentsBtn').addEventListener('click', openImportWizard);

    // Search input
    const searchInput = document.getElementById('searchInput');
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        const searchValue = e.target.value;
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            performSearch(searchValue);
        }, 300);
    });

    // Setup infinite scroll
    setupInfiniteScroll();
    
    // Filter chips
    document.querySelectorAll('.chip[data-filter]').forEach(chip => {
        chip.addEventListener('click', (e) => {
            document.querySelectorAll('.chip[data-filter]').forEach(c => 
                c.classList.remove('chip-active'));
            e.target.classList.add('chip-active');
            currentFilter = e.target.dataset.filter;
            renderTable();
        });
    });

    // Student form
    document.getElementById('studentForm').addEventListener('submit', handleFormSubmit);

    // Photo upload
    document.getElementById('uploadPhotoBtn').addEventListener('click', () => {
        document.getElementById('photoInput').click();
    });

    document.getElementById('photoInput').addEventListener('change', handlePhotoSelect);

    document.getElementById('removePhotoBtn').addEventListener('click', () => {
        photoFile = null;
        currentPhotoUrl = null;
        updatePhotoPreview(null);
    });

    // Delete button in edit modal
    document.getElementById('deleteStudentBtn').addEventListener('click', () => {
        if (currentEditingId) {
            closeModal('studentModal');
            const student = studentsData.find(s => s.id === currentEditingId) || 
                           tempStudentsData.find(s => s.id === currentEditingId);
            if (student) {
                confirmDelete(currentEditingId, student.fullName);
            }
        }
    });

    // Delete confirmation
    document.getElementById('confirmDeleteBtn').addEventListener('click', handleDelete);

    // Details modal actions
    document.getElementById('editFromDetailsBtn').addEventListener('click', () => {
        closeModal('detailsModal');
        editStudent(currentEditingId);
    });

    document.getElementById('viewEnrollmentsBtn').addEventListener('click', () => {
        window.location.href = `/manager/enrollments.html?studentId=${currentEditingId}`;
    });

    document.getElementById('viewAttendanceBtn').addEventListener('click', () => {
        window.location.href = `/manager/attendance.html?studentId=${currentEditingId}`;
    });
    
    // Bulk action buttons
    document.getElementById('bulkEnrollClassBtn').addEventListener('click', openBulkEnrollClassModal);
    document.getElementById('bulkEnrollCourseBtn').addEventListener('click', openBulkEnrollCourseModal);
    document.getElementById('backBtn').addEventListener('click', clearSelection);
    document.getElementById('proceedWithCoursesBtn').addEventListener('click', handleBulkEnrollToCourses);
    
    // Delegate checkbox click events
    document.getElementById('studentsTableContainer').addEventListener('change', (e) => {
        if (e.target.classList.contains('table-photo-checkbox')) {
            const studentId = e.target.dataset.studentId;
            if (e.target.checked) {
                selectedStudents.add(studentId);
            } else {
                selectedStudents.delete(studentId);
            }
            updateBulkActionsToolbar();
        }
    });
    
    // Handle clicks on photo/placeholder to toggle checkbox
    document.getElementById('studentsTableContainer').addEventListener('click', (e) => {
        if (e.target.classList.contains('table-photo') || e.target.classList.contains('table-photo-placeholder')) {
            e.stopPropagation(); // Prevent row click from opening modal
            
            // Find the checkbox in the same row
            const row = e.target.closest('tr');
            if (row) {
                const checkbox = row.querySelector('.table-photo-checkbox');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    // Trigger change event manually
                    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        }
    });

    // Date auto-formatting
    const dateInput = document.getElementById('dateOfBirth');
    if (dateInput) {
        dateInput.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > 8) v = v.slice(0, 8);
            if (v.length > 4) {
                e.target.value = `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4)}`;
            } else if (v.length > 2) {
                e.target.value = `${v.slice(0, 2)}/${v.slice(2)}`;
            } else {
                e.target.value = v;
            }
        });
    }
}

/**
 * Update bulk actions toolbar visibility
 */
function updateBulkActionsToolbar() {
    const toolbar = document.getElementById('bulkActionsToolbar');
    const count = selectedStudents.size;
    const pageMain = document.querySelector('.page-main');
    
    if (count > 0) {
        toolbar.style.display = 'flex';
        document.getElementById('selectedCount').textContent = count;
        pageMain.classList.add('selection-mode');
    } else {
        toolbar.style.display = 'none';
        pageMain.classList.remove('selection-mode');
    }
}

/**
 * Clear selection
 */
function clearSelection() {
    selectedStudents.clear();
    updateBulkActionsToolbar();
    renderTable(); // Re-render to update checkboxes
}

/**
 * Open bulk enroll to class modal
 */
async function openBulkEnrollClassModal() {
    document.getElementById('bulkClassStudentCount').textContent = selectedStudents.size;
    
    // Load data if not already loaded
    if (classInstances.length === 0) {
        await loadBulkEnrollmentData();
    }
    
    // Populate filters
    populateBulkClassFilters();
    
    // Render class instances
    renderBulkClassInstances();
    
    showModal('bulkEnrollClassModal', document.getElementById('bulkEnrollClassModal'));
}

/**
 * Open bulk enroll to course modal
 */
async function openBulkEnrollCourseModal() {
    document.getElementById('bulkCourseStudentCount').textContent = selectedStudents.size;
    
    // Reset course selection
    selectedCourses.clear();
    updateCourseSelectionUI();
    
    // Load data if not already loaded
    if (courses.length === 0) {
        await loadBulkEnrollmentData();
    }
    
    // Populate filters
    populateBulkCourseFilters();
    
    // Render courses
    renderBulkCourses();
    
    showModal('bulkEnrollCourseModal', document.getElementById('bulkEnrollCourseModal'));
}

/**
 * Load data needed for bulk enrollment with pagination
 */
async function loadBulkEnrollmentData() {
    try {
        const { getPaginatedCourses } = await import('../../services/course-service.js');
        const { getPaginatedClassInstances } = await import('../../services/class-instance-service.js');
        
        const [branchesData, teachersData, coursesResult, instancesResult, templatesData] = await Promise.all([
            getAllBranches(currentBusinessId),
            getAllTeachers(currentBusinessId),
            getPaginatedCourses(currentBusinessId, { limit: 50, isActive: true }),
            getPaginatedClassInstances(currentBusinessId, { limit: 20 }),
            import('../../services/class-template-service.js').then(m => m.getAllClassTemplates(currentBusinessId))
        ]);
        
        branches = branchesData;
        teachers = teachersData;
        courses = coursesResult.courses;
        templates = templatesData;
        
        // Filter data for Branch Manager
        if (currentUser && currentUser.role === 'branchManager') {
            const allowedIds = currentUser.allowedBranchIds || [];
            
            // Filter branches
            branches = branches.filter(b => allowedIds.includes(b.id));
            
            // Filter courses (must have at least one schedule item in allowed branches)
            courses = courses.filter(c => {
                if (!c.schedule || c.schedule.length === 0) return false;
                return c.schedule.some(s => allowedIds.includes(s.branchId));
            });
            
            // Filter class instances
            instancesResult.instances = instancesResult.instances.filter(i => allowedIds.includes(i.branchId));
        }

        // Enrich instances with template names and ensure branchId
        classInstances = instancesResult.instances.map(instance => {
            const template = templatesData.find(t => t.id === instance.templateId);
            return {
                ...instance,
                templateName: template?.name || 'שיעור',
                branchId: instance.branchId || template?.branchId
            };
        });
    } catch (error) {
        console.error('Error loading enrollment data:', error);
        showToast('שגיאה בטעינת נתונים', 'error');
    }
}

/**
 * Populate bulk class filters
 */
function populateBulkClassFilters() {
    const branchFilter = document.getElementById('bulkClassBranchFilter');
    const dateFilter = document.getElementById('bulkClassDateFilter');
    
    branchFilter.innerHTML = '<option value="">כל הסניפים</option>' +
        branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
    
    // Add event listeners
    branchFilter.addEventListener('change', renderBulkClassInstances);
    dateFilter.addEventListener('change', renderBulkClassInstances);
    document.getElementById('bulkClassSearch').addEventListener('input', renderBulkClassInstances);
}

/**
 * Render bulk class instances list
 */
function renderBulkClassInstances() {
    const container = document.getElementById('bulkClassInstancesList');
    const branchFilter = document.getElementById('bulkClassBranchFilter').value;
    const dateFilter = document.getElementById('bulkClassDateFilter').value;
    const search = document.getElementById('bulkClassSearch').value.toLowerCase();
    
    let filtered = classInstances.filter(instance => {
        if (branchFilter && instance.branchId !== branchFilter) return false;
        if (dateFilter) {
            const instanceDate = new Date(instance.date.seconds * 1000);
            const selectedDate = new Date(dateFilter);
            const instanceDateStr = instanceDate.toLocaleDateString('en-CA'); // YYYY-MM-DD
            const selectedDateStr = selectedDate.toLocaleDateString('en-CA');
            if (instanceDateStr !== selectedDateStr) return false;
        }
        if (search) {
            const teacher = teachers.find(t => t.id === instance.teacherId);
            const teacherName = teacher ? `${teacher.firstName} ${teacher.lastName}`.toLowerCase() : '';
            const templateName = instance.templateName?.toLowerCase() || '';
            if (!templateName.includes(search) && !teacherName.includes(search)) return false;
        }
        return true;
    });
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="search-no-results">לא נמצאו שיעורים</div>';
        return;
    }
    
    // Sort by date and time chronologically (earliest first)
    filtered.sort((a, b) => {
        const dateA = a.date.seconds * 1000;
        const dateB = b.date.seconds * 1000;
        if (dateA !== dateB) return dateA - dateB;
        
        // If same date, sort by time
        const timeA = a.startTime || '';
        const timeB = b.startTime || '';
        return timeA.localeCompare(timeB);
    });
    
    // Group by date
    const groupedByDate = {};
    filtered.forEach(instance => {
        const date = new Date(instance.date.seconds * 1000);
        const dateKey = date.toLocaleDateString('he-IL');
        const dayName = date.toLocaleDateString('he-IL', { weekday: 'long' }).replace('יום ', '');
        const dateLabel = `${dayName} ${dateKey}`;
        
        if (!groupedByDate[dateLabel]) {
            groupedByDate[dateLabel] = [];
        }
        groupedByDate[dateLabel].push(instance);
    });
    
    // Render grouped instances
    let html = '';
    Object.keys(groupedByDate).forEach(dateLabel => {
        html += `<div class="bulk-select-date-header">${dateLabel}</div>`;
        groupedByDate[dateLabel].forEach(instance => {
            const teacher = teachers.find(t => t.id === instance.teacherId);
            html += `
                <div class="bulk-select-item" data-instance-id="${instance.id}">
                    <div class="bulk-select-item-name">${instance.startTime || ''} ${instance.templateName || 'שיעור'}</div>
                    <div class="bulk-select-item-details">
                        ${teacher ? teacher.firstName + ' ' + teacher.lastName : ''}
                    </div>
                </div>
            `;
        });
    });
    
    container.innerHTML = html;
    
    // Add click handlers
    container.querySelectorAll('.bulk-select-item').forEach(item => {
        item.addEventListener('click', () => handleBulkEnrollToClass(item.dataset.instanceId));
    });
}

/**
 * Handle bulk enroll to class
 */
async function handleBulkEnrollToClass(instanceId) {
    showToast('רושם תלמידים...', 'info');
    
    try {
        const promises = Array.from(selectedStudents).map(studentId =>
            addStudentToInstance(currentBusinessId, instanceId, studentId)
        );
        
        await Promise.all(promises);
        
        closeModal(); // Close the bulk enroll modal
        
        showToast(`${selectedStudents.size} תלמידים נרשמו בהצלחה!`);
        
        clearSelection();
    } catch (error) {
        console.error('Error enrolling students:', error);
        showToast('שגיאה ברישום תלמידים', 'error');
    }
}

/**
 * Populate bulk course filters
 */
function populateBulkCourseFilters() {
    const branchFilter = document.getElementById('bulkCourseBranchFilter');
    
    branchFilter.innerHTML = '<option value="">כל הסניפים</option>' +
        branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
    
    // Add event listeners
    branchFilter.addEventListener('change', renderBulkCourses);
    document.getElementById('bulkCourseSearch').addEventListener('input', renderBulkCourses);
}

/**
 * Render bulk courses list
 */
// Track selected courses
const selectedCourses = new Set();

function renderBulkCourses() {
    const container = document.getElementById('bulkCoursesList');
    const branchFilter = document.getElementById('bulkCourseBranchFilter').value;
    const search = document.getElementById('bulkCourseSearch').value.toLowerCase();
    
    let filtered = courses.filter(course => {
        if (course.status !== 'active') return false;
        if (search && !course.name?.toLowerCase().includes(search)) return false;
        
        // Filter by branch: check if any template in the course belongs to the selected branch
        if (branchFilter) {
            const courseTemplateIds = course.templateIds || [];
            const hasTemplateInBranch = courseTemplateIds.some(templateId => {
                const template = templates.find(t => t.id === templateId);
                return template && template.branchId === branchFilter;
            });
            if (!hasTemplateInBranch) return false;
        }
        
        return true;
    });
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="search-no-results">לא נמצאו קורסים</div>';
        return;
    }
    
    container.innerHTML = filtered.map(course => {
        const startDate = course.startDate ? new Date(course.startDate.seconds * 1000).toLocaleDateString('he-IL') : '';
        const endDate = course.endDate ? new Date(course.endDate.seconds * 1000).toLocaleDateString('he-IL') : '';
        const isSelected = selectedCourses.has(course.id);
        
        return `
            <div class="bulk-select-item ${isSelected ? 'selected' : ''}" data-course-id="${course.id}">
                <div class="bulk-select-checkbox">
                    <input type="checkbox" ${isSelected ? 'checked' : ''} />
                </div>
                <div class="bulk-select-item-content">
                    <div class="bulk-select-item-name">${course.name}</div>
                    <div class="bulk-select-item-details">
                        ${startDate} - ${endDate}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Add click handlers for toggling selection
    container.querySelectorAll('.bulk-select-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const courseId = item.dataset.courseId;
            const checkbox = item.querySelector('input[type="checkbox"]');
            
            if (selectedCourses.has(courseId)) {
                selectedCourses.delete(courseId);
                item.classList.remove('selected');
                checkbox.checked = false;
            } else {
                selectedCourses.add(courseId);
                item.classList.add('selected');
                checkbox.checked = true;
            }
            
            updateCourseSelectionUI();
        });
    });
}

function updateCourseSelectionUI() {
    const count = selectedCourses.size;
    const infoElement = document.getElementById('courseSelectionInfo');
    const countElement = document.getElementById('selectedCoursesCount');
    const proceedBtn = document.getElementById('proceedWithCoursesBtn');
    
    if (count > 0) {
        infoElement.style.display = 'block';
        countElement.textContent = count;
        proceedBtn.style.display = 'inline-block';
    } else {
        infoElement.style.display = 'none';
        proceedBtn.style.display = 'none';
    }
}

/**
 * Handle bulk enroll to multiple courses
 */
async function handleBulkEnrollToCourses() {
    const overallResults = {
        successfulEnrollments: 0,
        alreadyEnrolled: 0,
        failed: []
    };
    
    // Process each course
    for (const courseId of selectedCourses) {
        const course = courses.find(c => c.id === courseId);
        const courseName = course ? course.name : 'קורס לא ידוע';
        
        // Process each student for this course
        for (const studentId of selectedStudents) {
            try {
                await enrollStudentInCourse(currentBusinessId, courseId, studentId, new Date());
                overallResults.successfulEnrollments++;
            } catch (error) {
                if (error.message === 'התלמיד כבר רשום לקורס זה') {
                    overallResults.alreadyEnrolled++;
                } else {
                    const student = studentsData.find(s => s.id === studentId);
                    const studentName = student ? `${student.firstName} ${student.lastName}` : 'לא ידוע';
                    overallResults.failed.push({ 
                        studentName, 
                        courseName,
                        error: error.message 
                    });
                }
            }
        }
    }
    
    // Build result HTML
    let content = '<div class="enrollment-results">';
    
    if (overallResults.successfulEnrollments > 0) {
        content += `
            <div class="result-section success">
                <div class="result-icon">✓</div>
                <div class="result-text">
                    <strong>${overallResults.successfulEnrollments}</strong> רישומים בוצעו בהצלחה
                </div>
            </div>
        `;
    }
    
    if (overallResults.alreadyEnrolled > 0) {
        content += `
            <div class="result-section info">
                <div class="result-icon">ℹ</div>
                <div class="result-text">
                    <strong>${overallResults.alreadyEnrolled}</strong> רישומים כבר היו קיימים
                </div>
            </div>
        `;
    }
    
    if (overallResults.failed.length > 0) {
        const failedItems = overallResults.failed.map(f => 
            `<li>${f.studentName} - ${f.courseName}</li>`
        ).join('');
        
        content += `
            <div class="result-section error">
                <div class="result-icon">✗</div>
                <div class="result-text">
                    <strong>${overallResults.failed.length}</strong> רישומים נכשלו:
                    <ul class="failed-list">${failedItems}</ul>
                </div>
            </div>
        `;
    }
    
    content += '</div>';
    
    // Close the enrollment modal and wait for it to fully close
    await new Promise((resolve) => {
        const checkModalClosed = setInterval(() => {
            if (!document.getElementById('modal-overlay')) {
                clearInterval(checkModalClosed);
                resolve();
            }
        }, 50);
        closeModal();
    });
    
    // Show results modal and wait for user to close it
    await new Promise((resolve) => {
        showModal({
            title: 'תוצאות רישום',
            content,
            size: 'medium',
            showCancel: false,
            confirmText: 'סגור',
            onConfirm: () => {
                resolve();
            },
            onClose: () => {
                resolve();
            }
        });
    });
    
    // Clear selection after user closes the results modal
    if (overallResults.successfulEnrollments > 0 || overallResults.alreadyEnrolled > 0) {
        clearSelection();
    }
}

/**
 * Perform search
 */
async function performSearch(query) {
    try {
        const trimmedQuery = query?.trim() || '';
        
        if (!trimmedQuery) {
            // Reset to paginated loading
            await loadStudents(true);
        } else {
            // For search, still load all matching results (searches are typically small result sets)
            studentsData = await searchStudents(currentBusinessId, trimmedQuery);
            studentsHasMore = false; // No pagination for search results
            studentsLastDoc = null;
        }
        // Ensure studentsData is always an array
        if (!Array.isArray(studentsData)) {
            studentsData = [];
        }
        renderTable();
        addLoadMoreButton();
    } catch (error) {
        console.error('Error performing search:', error);
        await loadStudents(true);
    }
}

/**
 * Open add student modal
 */
function openAddModal() {
    currentEditingId = null;
    photoFile = null;
    currentPhotoUrl = null;
    
    document.getElementById('modalTitle').textContent = 'תלמיד חדש';
    document.getElementById('studentForm').reset();
    updatePhotoPreview(null);
    
    // Hide delete button in add mode
    document.getElementById('deleteStudentBtn').style.display = 'none';
    
    // Enable all fields (in case they were disabled by temp student edit)
    document.getElementById('email').disabled = false;
    document.getElementById('dateOfBirth').disabled = false;
    document.getElementById('parentName').disabled = false;
    document.getElementById('parentPhone').disabled = false;
    document.getElementById('parentEmail').disabled = false;
    document.getElementById('uploadPhotoBtn').style.display = 'block';
    document.getElementById('removePhotoBtn').style.display = 'none'; // Hidden by default until photo selected
    
    showModal('studentModal', document.getElementById('studentModal'));
}

/**
 * Edit student
 */
async function editStudent(studentId) {
    try {
        let student;
        
        if (currentTab === 'temp') {
            student = await getTempStudentById(studentId);
            if (!student) {
                showToast('תלמיד זמני לא נמצא', 'error');
                return;
            }
            
            // Map temp student fields to form
            const names = (student.name || '').split(' ');
            student.firstName = names[0] || '';
            student.lastName = names.slice(1).join(' ') || '';
            student.isActive = student.active;
            // Temp students might not have these, but we set defaults
            student.email = '';
            student.dateOfBirth = '';
            student.parentName = '';
            student.parentPhone = '';
            student.parentEmail = '';
            student.photoURL = null;
        } else {
            student = await getStudentById(currentBusinessId, studentId);
            if (!student) {
                showToast('תלמיד לא נמצא', 'error');
                return;
            }
        }

        currentEditingId = studentId;
        photoFile = null;
        currentPhotoUrl = student.photoURL;

        document.getElementById('modalTitle').textContent = currentTab === 'temp' ? 'עריכת תלמיד זמני' : 'עריכת תלמיד';
        
        // Populate form
        document.getElementById('firstName').value = student.firstName || '';
        document.getElementById('lastName').value = student.lastName || '';
        document.getElementById('email').value = student.email || '';
        document.getElementById('phone').value = student.phone || '';
        document.getElementById('dateOfBirth').value = student.dateOfBirth || '';
        document.getElementById('parentName').value = student.parentName || '';
        document.getElementById('parentPhone').value = student.parentPhone || '';
        document.getElementById('parentEmail').value = student.parentEmail || '';
        document.getElementById('notes').value = student.notes || '';
        document.getElementById('status').checked = student.isActive || false;

        updatePhotoPreview(student.photoURL);
        
        // Show delete button in edit mode (only for admins)
        if (currentUser && ['superAdmin', 'admin'].includes(currentUser.role)) {
            document.getElementById('deleteStudentBtn').style.display = 'block';
        } else {
            document.getElementById('deleteStudentBtn').style.display = 'none';
        }
        
        // For temp students, disable fields that aren't supported or hide them?
        // For now, we'll leave them enabled but they might not be saved if we don't update the logic in handleFormSubmit
        // Actually, let's disable unsupported fields for temp students to avoid confusion
        const isTemp = currentTab === 'temp';
        document.getElementById('email').disabled = isTemp;
        document.getElementById('dateOfBirth').disabled = isTemp;
        document.getElementById('parentName').disabled = isTemp;
        document.getElementById('parentPhone').disabled = isTemp;
        document.getElementById('parentEmail').disabled = isTemp;
        document.getElementById('uploadPhotoBtn').style.display = isTemp ? 'none' : 'block';
        document.getElementById('removePhotoBtn').style.display = isTemp ? 'none' : 'block';

        showModal('studentModal', document.getElementById('studentModal'));

    } catch (error) {
        console.error('Error loading student:', error);
        showToast('שגיאה בטעינת פרטי התלמיד', 'error');
    }
}

/**
 * View student details
 */
async function viewStudent(studentId) {
    try {
        let student;
        
        if (currentTab === 'temp') {
            student = await getTempStudentById(studentId);
            if (!student) {
                showToast('תלמיד זמני לא נמצא', 'error');
                return;
            }
            // Map for display
            const names = (student.name || '').split(' ');
            student.firstName = names[0] || '';
            student.lastName = names.slice(1).join(' ') || '';
            student.isActive = student.active;
        } else {
            student = await getStudentById(currentBusinessId, studentId);
            if (!student) {
                showToast('תלמיד לא נמצא', 'error');
                return;
            }
        }

        currentEditingId = studentId;

        // Update modal
        document.getElementById('detailsStudentName').textContent = 
            `${student.firstName} ${student.lastName}`;

        // Photo
        const photoContainer = document.getElementById('detailsPhoto');
        if (student.photoURL) {
            photoContainer.innerHTML = `<img src="${student.photoURL}" alt="תמונה" class="details-photo-img">`;
        } else {
            photoContainer.innerHTML = '<div class="details-photo-placeholder">👤</div>';
        }

        // Info
        const infoContainer = document.getElementById('detailsInfo');
        
        if (currentTab === 'temp') {
            infoContainer.innerHTML = `
                <div class="detail-item">
                    <span class="detail-label">טלפון:</span>
                    <span class="detail-value" dir="ltr">${student.phone || 'לא צוין'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">סטטוס:</span>
                    <span class="badge ${student.isActive ? 'badge-success' : 'badge-secondary'}">
                        ${student.isActive ? 'פעיל' : 'לא פעיל'}
                    </span>
                </div>
                <div class="detail-item detail-item-full">
                    <span class="detail-label">סוג:</span>
                    <span class="badge badge-warning">תלמיד זמני</span>
                </div>
                ${student.notes ? `
                    <div class="detail-item detail-item-full">
                        <span class="detail-label">הערות:</span>
                        <span class="detail-value">${student.notes}</span>
                    </div>
                ` : ''}
            `;
            
            // Hide stats for temp students for now as they might not have same stats structure
            document.getElementById('detailsStats').innerHTML = '';
            
        } else {
            infoContainer.innerHTML = `
                <div class="detail-item">
                    <span class="detail-label">טלפון:</span>
                    <span class="detail-value" dir="ltr">${student.phone || 'לא צוין'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">אימייל:</span>
                    <span class="detail-value" dir="ltr">${student.email || 'לא צוין'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">תאריך לידה:</span>
                    <span class="detail-value">${
                        student.dateOfBirth 
                            ? (student.dateOfBirth.toDate ? formatDate(student.dateOfBirth.toDate()) : formatDate(new Date(student.dateOfBirth)))
                            : 'לא צוין'
                    }</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">הורה:</span>
                    <span class="detail-value">${student.parentName || 'לא צוין'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">טלפון הורה:</span>
                    <span class="detail-value" dir="ltr">${student.parentPhone || 'לא צוין'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">סטטוס:</span>
                    <span class="badge ${student.isActive ? 'badge-success' : 'badge-secondary'}">
                        ${student.isActive ? 'פעיל' : 'לא פעיל'}
                    </span>
                </div>
                ${student.notes ? `
                    <div class="detail-item detail-item-full">
                        <span class="detail-label">הערות:</span>
                        <span class="detail-value">${student.notes}</span>
                    </div>
                ` : ''}
            `;

            // Load stats
            loadStudentStats(studentId);
        }

        showModal('detailsModal', document.getElementById('detailsModal'));

    } catch (error) {
        console.error('Error loading student details:', error);
        showToast('שגיאה בטעינת פרטי התלמיד', 'error');
    }
}

/**
 * Load student statistics
 */
async function loadStudentStats(studentId) {
    const statsContainer = document.getElementById('detailsStats');
    statsContainer.innerHTML = '<div class="loading-state">טוען סטטיסטיקות...</div>';

    try {
        const [stats, enrollments] = await Promise.all([
            getStudentAttendanceStats(currentBusinessId, studentId),
            getStudentEnrollments(currentBusinessId, studentId)
        ]);

        const attendanceRate = stats.totalClasses > 0
            ? Math.round((stats.present / stats.totalClasses) * 100)
            : 0;

        statsContainer.innerHTML = `
            <div class="stats-grid-small">
                <div class="stat-card-small">
                    <div class="stat-label">רישומים פעילים</div>
                    <div class="stat-value">${enrollments.filter(e => e.status === 'active').length}</div>
                </div>
                <div class="stat-card-small">
                    <div class="stat-label">נוכחות</div>
                    <div class="stat-value">${attendanceRate}%</div>
                </div>
                <div class="stat-card-small">
                    <div class="stat-label">סה"כ שיעורים</div>
                    <div class="stat-value">${stats.totalClasses}</div>
                </div>
                <div class="stat-card-small">
                    <div class="stat-label">איחורים</div>
                    <div class="stat-value">${stats.late}</div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading stats:', error);
        statsContainer.innerHTML = '<div class="error-state">שגיאה בטעינת סטטיסטיקות</div>';
    }
}

/**
 * Handle photo selection
 */
function handlePhotoSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast('נא לבחור קובץ תמונה', 'error');
        return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
        showToast('גודל הקובץ חייב להיות פחות מ-5MB', 'error');
        return;
    }

    photoFile = file;
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
        updatePhotoPreview(e.target.result);
    };
    reader.readAsDataURL(file);
}

/**
 * Update photo preview
 */
function updatePhotoPreview(url) {
    const preview = document.getElementById('photoPreview');
    const removeBtn = document.getElementById('removePhotoBtn');

    if (url) {
        preview.innerHTML = `<img src="${url}" alt="תמונה">`;
        removeBtn.style.display = 'block';
    } else {
        preview.innerHTML = '<div class="photo-placeholder">📷</div>';
        removeBtn.style.display = 'none';
    }
}

/**
 * Handle form submit
 */
async function handleFormSubmit(event) {
    event.preventDefault();

    const saveBtn = document.getElementById('saveBtn');
    const spinner = saveBtn.querySelector('.btn-spinner');
    
    // Disable button and show spinner
    saveBtn.disabled = true;
    spinner.style.display = 'inline-block';

    try {
        // Handle Temp Student Update
        if (currentTab === 'temp' && currentEditingId) {
            const firstName = document.getElementById('firstName').value.trim();
            const lastName = document.getElementById('lastName').value.trim();
            const phone = document.getElementById('phone').value.trim();
            const notes = document.getElementById('notes').value.trim();
            const isActive = document.getElementById('status').checked;
            
            if (!firstName) {
                throw new Error('נא להזין שם פרטי');
            }
            
            const updates = {
                name: `${firstName} ${lastName}`.trim(),
                phone: phone,
                notes: notes,
                active: isActive
            };
            
            await updateTempStudent(currentEditingId, updates);
            
            // Reload students
            await loadStudents(false); // Don't reset pagination
            
            closeModal('studentModal');
            showToast('התלמיד הזמני עודכן בהצלחה');
            return;
        }

        // Handle Permanent Student
        const formData = {
            firstName: document.getElementById('firstName').value.trim(),
            lastName: document.getElementById('lastName').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            dateOfBirth: document.getElementById('dateOfBirth').value,
            parentName: document.getElementById('parentName').value.trim(),
            parentPhone: document.getElementById('parentPhone').value.trim(),
            parentEmail: document.getElementById('parentEmail').value.trim(),
            notes: document.getElementById('notes').value.trim(),
            isActive: document.getElementById('status').checked
        };

        let studentId;

        if (currentEditingId) {
            // Update existing student
            await updateStudent(currentBusinessId, currentEditingId, formData);
            studentId = currentEditingId;
        } else {
            // Create new student
            studentId = await createStudent(currentBusinessId, formData);
        }

        // Upload photo if selected
        if (photoFile) {
            await uploadStudentPhoto(currentBusinessId, studentId, photoFile);
        } else if (currentPhotoUrl === null && currentEditingId) {
            // Photo was removed
            await deleteStudentPhoto(currentBusinessId, currentEditingId);
        }

        // Reload students
        await loadStudents();

        // Close modal
        closeModal('studentModal');

        showToast(currentEditingId ? 'התלמיד עודכן בהצלחה' : 'התלמיד נוסף בהצלחה');

    } catch (error) {
        console.error('Error saving student:', error);
        showToast('שגיאה בשמירת התלמיד: ' + error.message, 'error');
    } finally {
        saveBtn.disabled = false;
        spinner.style.display = 'none';
    }
}

/**
 * Confirm delete
 */
function confirmDelete(studentId, studentName) {
    currentEditingId = studentId;
    document.getElementById('deleteStudentName').textContent = studentName;
    showModal('deleteModal', document.getElementById('deleteModal'));
}

/**
 * Handle delete
 */
async function handleDelete() {
    const deleteBtn = document.getElementById('confirmDeleteBtn');
    const originalText = deleteBtn.textContent;
    deleteBtn.disabled = true;
    deleteBtn.textContent = 'מוחק...';

    try {
        if (currentTab === 'temp') {
            await deleteTempStudent(currentEditingId);
        } else {
            await permanentlyDeleteStudent(currentBusinessId, currentEditingId);
        }
        await loadStudents();
        closeModal('deleteModal');
        showToast('התלמיד נמחק לצמיתות');
    } catch (error) {
        console.error('Error deleting student:', error);
        showToast('שגיאה במחיקת התלמיד', 'error');
    } finally {
        deleteBtn.disabled = false;
        deleteBtn.textContent = originalText;
    }
}

/**
 * Open import wizard
 */
function openImportWizard() {
    import('../../components/ImportWizard.js').then(({ ImportWizard }) => {
        new ImportWizard(currentBusinessId, () => {
            // Reload students after import
            loadStudents();
        });
    });
}

/**
 * Helper functions
 */
function formatDate(date) {
    return date.toLocaleDateString('he-IL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}
