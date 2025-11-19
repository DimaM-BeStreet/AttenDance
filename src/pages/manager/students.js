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
    deleteStudent,
    uploadStudentPhoto,
    deleteStudentPhoto,
    searchStudents,
    getStudentById,
    getStudentAttendanceStats,
    getStudentEnrollments
} from '../../services/student-service.js';
import { auth, db } from '../../config/firebase-config.js';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

// State
let currentStudioId = null;
let currentUser = null;
let studentsData = [];
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
            
            if (!userData || userData.role !== 'manager') {
                alert('אין לך הרשאות לצפות בדף זה');
                window.location.href = '/';
                return;
            }

            currentUser = userData;
            currentStudioId = userData.studioId;
            
            // Initialize navbar
            const navbarContainer = document.getElementById('navbar');
            const navbar = createNavbar(userData.role, userData);
            navbarContainer.appendChild(navbar);

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
        studentsData = await getAllStudents(currentStudioId);
        updateFilterCounts();
        renderTable();
        
        document.getElementById('studentsCount').textContent = 
            `${studentsData.length} תלמידים`;
    } catch (error) {
        console.error('Error loading students:', error);
        document.getElementById('studentsTableContainer').innerHTML = 
            '<div class="error-state">שגיאה בטעינת תלמידים</div>';
    }
}

/**
 * Update filter counts
 */
function updateFilterCounts() {
    const counts = {
        all: studentsData.length,
        active: studentsData.filter(s => s.status === 'active').length,
        inactive: studentsData.filter(s => s.status === 'inactive').length,
        incomplete: studentsData.filter(s => s.isComplete === false).length
    };

    document.getElementById('countAll').textContent = counts.all;
    document.getElementById('countActive').textContent = counts.active;
    document.getElementById('countInactive').textContent = counts.inactive;
    document.getElementById('countIncomplete').textContent = counts.incomplete;
}

/**
 * Render students table
 */
function renderTable() {
    const container = document.getElementById('studentsTableContainer');
    
    // Filter students
    let filteredStudents = studentsData;
    if (currentFilter === 'active') {
        filteredStudents = studentsData.filter(s => s.status === 'active');
    } else if (currentFilter === 'inactive') {
        filteredStudents = studentsData.filter(s => s.status === 'inactive');
    } else if (currentFilter === 'incomplete') {
        filteredStudents = studentsData.filter(s => s.isComplete === false);
    }

    if (filteredStudents.length === 0) {
        container.innerHTML = '<div class="empty-state">אין תלמידים להצגה</div>';
        return;
    }

    // Create table if not exists
    if (!studentsTable) {
        const columns = [
            { 
                key: 'photo', 
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
                key: 'fullName', 
                label: 'שם מלא', 
                sortable: true 
            },
            { 
                key: 'phone', 
                label: 'טלפון', 
                sortable: false,
                render: (value) => `<span dir="ltr">${value}</span>`
            },
            { 
                key: 'status', 
                label: 'סטטוס', 
                sortable: true,
                render: (value) => {
                    const label = value === 'active' ? 'פעיל' : 'לא פעיל';
                    const badgeClass = value === 'active' ? 'badge-success' : 'badge-secondary';
                    return `<span class="badge ${badgeClass}">${label}</span>`;
                }
            },
            { 
                key: 'isComplete', 
                label: 'פרטים', 
                sortable: true,
                render: (value) => {
                    return value 
                        ? '<span class="badge badge-success">שלם</span>' 
                        : '<span class="badge badge-warning">חסר</span>';
                }
            }
        ];

        const actions = [
            {
                label: '👁️',
                title: 'צפייה',
                onClick: (row) => viewStudent(row.id)
            },
            {
                label: '✏️',
                title: 'עריכה',
                onClick: (row) => editStudent(row.id)
            },
            {
                label: '🗑️',
                title: 'מחיקה',
                onClick: (row) => confirmDelete(row.id, row.fullName),
                className: 'btn-danger'
            }
        ];

        studentsTable = createTable({
            columns,
            actions,
            searchable: false, // We have custom search
            pagination: true,
            pageSize: 20,
            emptyMessage: 'אין תלמידים'
        });

        container.innerHTML = '';
        container.appendChild(studentsTable.element);
    }

    // Transform data for table
    const tableData = filteredStudents.map(student => ({
        id: student.id,
        photo: student.photoURL,
        fullName: `${student.firstName} ${student.lastName}`,
        phone: student.phone,
        status: student.status,
        isComplete: student.isComplete
    }));

    studentsTable.setData(tableData);
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Add student button
    document.getElementById('addStudentBtn').addEventListener('click', openAddModal);

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
        studentsData = await getAllStudents(currentStudioId);
    } else {
        studentsData = await searchStudents(currentStudioId, query);
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
    
    showModal('studentModal', document.getElementById('studentModal'));
}

/**
 * Edit student
 */
async function editStudent(studentId) {
    try {
        const student = await getStudentById(currentStudioId, studentId);
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
        document.getElementById('dateOfBirth').value = student.dateOfBirth 
            ? student.dateOfBirth.toDate().toISOString().split('T')[0] 
            : '';
        document.getElementById('parentName').value = student.parentName || '';
        document.getElementById('parentPhone').value = student.parentPhone || '';
        document.getElementById('parentEmail').value = student.parentEmail || '';
        document.getElementById('notes').value = student.notes || '';
        document.getElementById('status').checked = student.status === 'active';

        updatePhotoPreview(student.photoURL);

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
        const student = await getStudentById(currentStudioId, studentId);
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
                <span class="badge ${student.status === 'active' ? 'badge-success' : 'badge-secondary'}">
                    ${student.status === 'active' ? 'פעיל' : 'לא פעיל'}
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
            getStudentAttendanceStats(currentStudioId, studentId),
            getStudentEnrollments(currentStudioId, studentId)
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
            status: document.getElementById('status').checked ? 'active' : 'inactive'
        };

        let studentId;

        if (currentEditingId) {
            // Update existing student
            await updateStudent(currentStudioId, currentEditingId, formData);
            studentId = currentEditingId;
        } else {
            // Create new student
            studentId = await createStudent(currentStudioId, formData);
        }

        // Upload photo if selected
        if (photoFile) {
            await uploadStudentPhoto(currentStudioId, studentId, photoFile);
        } else if (currentPhotoUrl === null && currentEditingId) {
            // Photo was removed
            await deleteStudentPhoto(currentStudioId, currentEditingId);
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
        await deleteStudent(currentStudioId, currentEditingId);
        await loadStudents();
        closeModal('deleteModal');
        alert('התלמיד הועבר לארכיון');
    } catch (error) {
        console.error('Error deleting student:', error);
        alert('שגיאה במחיקת התלמיד');
    } finally {
        deleteBtn.disabled = false;
    }
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
