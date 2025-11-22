/**
 * Student Management Page
 * Mobile-first CRUD interface for student management
 */

import './students-styles.js';
import { createNavbar } from '../../components/navbar.js';
import { showModal, closeModal } from '../../components/modal.js';
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
    deleteTempStudent
} from '../../services/temp-students-service.js';
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
            
            if (!userData || !['superAdmin', 'admin'].includes(userData.role)) {
                alert('אין לך הרשאות לצפות בדף זה');
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
            alert('שגיאה בטעינת הדף');
        }
    });
});

/**
 * Load all students
 */
async function loadStudents() {
    try {
        studentsData = await getAllStudents(currentBusinessId);
        tempStudentsData = await getTempStudentsByBusiness(currentBusinessId);
        
        updateTabCounts();
        updateFilterCounts();
        renderTable();
        
        const totalCount = studentsData.length + tempStudentsData.length;
        document.getElementById('studentsCount').textContent = 
            `${totalCount} תלמידים`;
    } catch (error) {
        console.error('Error loading students:', error);
        document.getElementById('studentsTableContainer').innerHTML = 
            '<div class="error-state">שגיאה בטעינת תלמידים</div>';
    }
}

/**
 * Update tab counts
 */
function updateTabCounts() {
    document.getElementById('countPermanent').textContent = studentsData.length;
    document.getElementById('countTemp').textContent = tempStudentsData.length;
}

/**
 * Update filter counts
 */
function updateFilterCounts() {
    const counts = {
        all: studentsData.length,
        active: studentsData.filter(s => s.isActive === true).length,
        inactive: studentsData.filter(s => s.isActive === false).length
    };

    document.getElementById('countAll').textContent = counts.all;
    document.getElementById('countActive').textContent = counts.active;
    document.getElementById('countInactive').textContent = counts.inactive;
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

    if (dataToDisplay.length === 0) {
        const message = currentTab === 'temp' ? 'אין תלמידים זמניים' : 'אין תלמידים להצגה';
        container.innerHTML = `<div class="empty-state">${message}</div>`;
        return;
    }

    // Create table if not exists
    if (!studentsTable) {
        const columns = [
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
                    const label = row.active ? 'פעיל' : 'לא פעיל';
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
            pagination: true,
            itemsPerPage: 20,
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
            if (currentTab === 'temp') {
                statusFilters.style.display = 'none';
            } else {
                statusFilters.style.display = 'flex';
                // Reset filter to "all"
                document.querySelectorAll('.chip[data-filter]').forEach(c => 
                    c.classList.remove('chip-active'));
                document.querySelector('.chip[data-filter="all"]').classList.add('chip-active');
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
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => performSearch(e.target.value), 300);
    });

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
}

/**
 * Perform search
 */
async function performSearch(query) {
    if (!query.trim()) {
        studentsData = await getAllStudents(currentBusinessId);
    } else {
        studentsData = await searchStudents(currentBusinessId, query);
    }
    updateFilterCounts();
    renderTable();
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
    
    showModal('studentModal', document.getElementById('studentModal'));
}

/**
 * Edit student
 */
async function editStudent(studentId) {
    try {
        const student = await getStudentById(currentBusinessId, studentId);
        if (!student) {
            alert('תלמיד לא נמצא');
            return;
        }

        currentEditingId = studentId;
        photoFile = null;
        currentPhotoUrl = student.photoURL;

        document.getElementById('modalTitle').textContent = 'עריכת תלמיד';
        
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
        
        // Show delete button in edit mode
        document.getElementById('deleteStudentBtn').style.display = 'block';

        showModal('studentModal', document.getElementById('studentModal'));

    } catch (error) {
        console.error('Error loading student:', error);
        alert('שגיאה בטעינת פרטי התלמיד');
    }
}

/**
 * View student details
 */
async function viewStudent(studentId) {
    try {
        const student = await getStudentById(currentBusinessId, studentId);
        if (!student) {
            alert('תלמיד לא נמצא');
            return;
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
                <span class="detail-value">${student.dateOfBirth ? formatDate(student.dateOfBirth.toDate()) : 'לא צוין'}</span>
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

        showModal('detailsModal', document.getElementById('detailsModal'));

    } catch (error) {
        console.error('Error loading student details:', error);
        alert('שגיאה בטעינת פרטי התלמיד');
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
        alert('נא לבחור קובץ תמונה');
        return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert('גודל הקובץ חייב להיות פחות מ-5MB');
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

        alert(currentEditingId ? 'התלמיד עודכן בהצלחה' : 'התלמיד נוסף בהצלחה');

    } catch (error) {
        console.error('Error saving student:', error);
        alert('שגיאה בשמירת התלמיד: ' + error.message);
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
    deleteBtn.disabled = true;

    try {
        await permanentlyDeleteStudent(currentBusinessId, currentEditingId);
        await loadStudents();
        closeModal('deleteModal');
        alert('התלמיד נמחק לצמיתות');
    } catch (error) {
        console.error('Error deleting student:', error);
        alert('שגיאה במחיקת התלמיד');
    } finally {
        deleteBtn.disabled = false;
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
