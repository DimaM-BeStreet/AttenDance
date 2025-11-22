/**
 * Teacher Management Page
 * Mobile-first CRUD interface for teacher management
 */

import './teachers-styles.js';
import { createNavbar } from '../../components/navbar.js';
import { showModal, closeModal } from '../../components/modal.js';
import { createTable } from '../../components/table.js';
import { 
    getAllTeachers, 
    createTeacher, 
    updateTeacher, 
    deleteTeacher,
    uploadTeacherPhoto,
    deleteTeacherPhoto,
    searchTeachers,
    getTeacherById,
    getTeacherStats,
    getTeacherUpcomingClasses,
    generateTeacherLink,
    regenerateTeacherLink,
    validateTeacherLink
} from '../../services/teacher-service.js';
import { auth, db } from '../../config/firebase-config.js';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

// State
let currentBusinessId = null;
let currentUser = null;
let teachersData = [];
let currentFilter = 'all';
let currentEditingId = null;
let photoFile = null;
let currentPhotoUrl = null;
let teachersTable = null;

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

            // Load teachers
            await loadTeachers();

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
 * Load all teachers
 */
async function loadTeachers() {
    try {
        teachersData = await getAllTeachers(currentBusinessId);
        updateFilterCounts();
        renderTable();
        
        document.getElementById('teachersCount').textContent = 
            `${teachersData.length} מורים`;
    } catch (error) {
        console.error('Error loading teachers:', error);
        document.getElementById('teachersTableContainer').innerHTML = 
            '<div class="error-state">שגיאה בטעינת מורים</div>';
    }
}

/**
 * Update filter counts
 */
function updateFilterCounts() {
    const counts = {
        all: teachersData.length,
        active: teachersData.filter(t => t.active).length,
        inactive: teachersData.filter(t => !t.active).length
    };

    document.getElementById('countAll').textContent = counts.all;
    document.getElementById('countActive').textContent = counts.active;
    document.getElementById('countInactive').textContent = counts.inactive;
}

/**
 * Render teachers table
 */
function renderTable() {
    const container = document.getElementById('teachersTableContainer');
    
    // Filter teachers
    let filteredTeachers = teachersData;
    if (currentFilter === 'active') {
        filteredTeachers = teachersData.filter(t => t.active);
    } else if (currentFilter === 'inactive') {
        filteredTeachers = teachersData.filter(t => !t.active);
    }

    if (filteredTeachers.length === 0) {
        container.innerHTML = '<div class="empty-state">אין מורים להצגה</div>';
        return;
    }

    // Create table if not exists
    if (!teachersTable) {
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
                        <div class="teacher-name-container">
                            <span class="teacher-name">${value}</span>
                            <span class="badge ${badgeClass}">${label}</span>
                        </div>
                    `;
                }
            },
            { 
                field: 'specialization', 
                label: 'התמחות', 
                sortable: false
            }
        ];
        
        // Note: Status badge is now integrated into the fullName column

        const actions = [
            {
                label: '👁️',
                title: 'צפייה',
                onClick: (row) => viewTeacher(row.id)
            },
            {
                label: '🔗',
                title: 'קישור',
                onClick: (row) => showTeacherLink(row.id)
            },
            {
                label: '✏️',
                title: 'עריכה',
                onClick: (row) => editTeacher(row.id)
            },
            {
                label: '🗑️',
                title: 'מחיקה',
                onClick: (row) => confirmDelete(row.id, row.fullName),
                className: 'btn-danger'
            }
        ];

        teachersTable = createTable('teachersTableContainer', {
            columns,
            actions: { buttons: actions },
            searchable: false,
            pagination: true,
            itemsPerPage: 20,
            emptyMessage: 'אין מורים'
        });
    }

    // Transform data for table
    const tableData = filteredTeachers.map(teacher => ({
        id: teacher.id,
        photo: teacher.photoURL,
        fullName: `${teacher.firstName} ${teacher.lastName}`,
        email: teacher.email,
        phone: teacher.phone,
        specialization: teacher.specialization || '-',
        active: teacher.active
    }));

    teachersTable.setData(tableData);
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Add teacher button
    document.getElementById('addTeacherBtn').addEventListener('click', openAddModal);

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

    // Teacher form
    document.getElementById('teacherForm').addEventListener('submit', handleFormSubmit);

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
        editTeacher(currentEditingId);
    });

    document.getElementById('viewClassesBtn').addEventListener('click', () => {
        window.location.href = `/manager/classes.html?teacherId=${currentEditingId}`;
    });

    document.getElementById('copyLinkBtn').addEventListener('click', () => {
        closeModal('detailsModal');
        showTeacherLink(currentEditingId);
    });

    // Link modal actions
    document.getElementById('copyLinkDirectBtn').addEventListener('click', copyLink);
    document.getElementById('regenerateLinkBtn').addEventListener('click', handleRegenerateLink);
    document.getElementById('shareLinkBtn').addEventListener('click', shareLink);
}

/**
 * Perform search
 */
async function performSearch(query) {
    if (!query.trim()) {
        teachersData = await getAllTeachers(currentBusinessId);
    } else {
        teachersData = await searchTeachers(currentBusinessId, query);
    }
    updateFilterCounts();
    renderTable();
}

/**
 * Open add teacher modal
 */
function openAddModal() {
    currentEditingId = null;
    photoFile = null;
    currentPhotoUrl = null;
    
    document.getElementById('modalTitle').textContent = 'מורה חדש';
    document.getElementById('teacherForm').reset();
    updatePhotoPreview(null);
    
    showModal('teacherModal', document.getElementById('teacherModal'));
}

/**
 * Edit teacher
 */
async function editTeacher(teacherId) {
    try {
        const teacher = await getTeacherById(currentBusinessId, teacherId);
        if (!teacher) {
            alert('מורה לא נמצא');
            return;
        }

        currentEditingId = teacherId;
        photoFile = null;
        currentPhotoUrl = teacher.photoURL;

        document.getElementById('modalTitle').textContent = 'עריכת מורה';
        
        // Populate form
        document.getElementById('firstName').value = teacher.firstName || '';
        document.getElementById('lastName').value = teacher.lastName || '';
        document.getElementById('email').value = teacher.email || '';
        document.getElementById('phone').value = teacher.phone || '';
        document.getElementById('specialization').value = teacher.specialization || '';
        document.getElementById('notes').value = teacher.notes || '';
        document.getElementById('isActive').checked = teacher.isActive;

        updatePhotoPreview(teacher.photoURL);

        showModal('teacherModal', document.getElementById('teacherModal'));

    } catch (error) {
        console.error('Error loading teacher:', error);
        alert('שגיאה בטעינת פרטי המורה');
    }
}

/**
 * View teacher details
 */
async function viewTeacher(teacherId) {
    try {
        const teacher = await getTeacherById(currentBusinessId, teacherId);
        if (!teacher) {
            alert('מורה לא נמצא');
            return;
        }

        currentEditingId = teacherId;

        // Update modal
        document.getElementById('detailsTeacherName').textContent = 
            `${teacher.firstName} ${teacher.lastName}`;

        // Photo
        const photoContainer = document.getElementById('detailsPhoto');
        if (teacher.photoURL) {
            photoContainer.innerHTML = `<img src="${teacher.photoURL}" alt="תמונה" class="details-photo-img">`;
        } else {
            photoContainer.innerHTML = '<div class="details-photo-placeholder">👤</div>';
        }

        // Info
        const infoContainer = document.getElementById('detailsInfo');
        infoContainer.innerHTML = `
            <div class="detail-item">
                <span class="detail-label">אימייל:</span>
                <span class="detail-value" dir="ltr">${teacher.email || 'לא צוין'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">טלפון:</span>
                <span class="detail-value" dir="ltr">${teacher.phone || 'לא צוין'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">התמחות:</span>
                <span class="detail-value">${teacher.specialization || 'לא צוין'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">סטטוס:</span>
                <span class="badge ${teacher.active ? 'badge-success' : 'badge-secondary'}">
                    ${teacher.active ? 'פעיל' : 'לא פעיל'}
                </span>
            </div>
            ${teacher.notes ? `
                <div class="detail-item detail-item-full">
                    <span class="detail-label">הערות:</span>
                    <span class="detail-value">${teacher.notes}</span>
                </div>
            ` : ''}
        `;

        // Load stats
        loadTeacherStats(teacherId);

        showModal('detailsModal', document.getElementById('detailsModal'));

    } catch (error) {
        console.error('Error loading teacher details:', error);
        alert('שגיאה בטעינת פרטי המורה');
    }
}

/**
 * Load teacher statistics
 */
async function loadTeacherStats(teacherId) {
    const statsContainer = document.getElementById('detailsStats');
    statsContainer.innerHTML = '<div class="loading-state">טוען סטטיסטיקות...</div>';

    try {
        const [stats, upcomingClasses] = await Promise.all([
            getTeacherStats(currentBusinessId, teacherId),
            getTeacherUpcomingClasses(currentBusinessId, teacherId)
        ]);

        statsContainer.innerHTML = `
            <div class="stats-grid-small">
                <div class="stat-card-small">
                    <div class="stat-label">שיעורים קרובים</div>
                    <div class="stat-value">${upcomingClasses.length}</div>
                </div>
                <div class="stat-card-small">
                    <div class="stat-label">סה"כ שיעורים</div>
                    <div class="stat-value">${stats.totalClasses}</div>
                </div>
                <div class="stat-card-small">
                    <div class="stat-label">תלמידים ייחודיים</div>
                    <div class="stat-value">${stats.uniqueStudents}</div>
                </div>
                <div class="stat-card-small">
                    <div class="stat-label">ממוצע נוכחות</div>
                    <div class="stat-value">${stats.avgAttendance}%</div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading stats:', error);
        statsContainer.innerHTML = '<div class="error-state">שגיאה בטעינת סטטיסטיקות</div>';
    }
}

/**
 * Show teacher unique link
 */
async function showTeacherLink(teacherId) {
    try {
        const teacher = await getTeacherById(currentBusinessId, teacherId);
        if (!teacher) {
            alert('מורה לא נמצא');
            return;
        }

        currentEditingId = teacherId;

        // Generate link if doesn't exist
        let uniqueLink = teacher.uniqueLink;
        if (!uniqueLink) {
            const linkData = await generateTeacherLink(currentBusinessId, teacherId);
            uniqueLink = linkData.linkToken;
        }

        const fullLink = `${window.location.origin}/teacher?link=${uniqueLink}`;
        document.getElementById('uniqueLink').value = fullLink;

        showModal('linkModal', document.getElementById('linkModal'));

    } catch (error) {
        console.error('Error showing teacher link:', error);
        alert('שגיאה בטעינת הקישור');
    }
}

/**
 * Copy link to clipboard
 */
async function copyLink() {
    const linkInput = document.getElementById('uniqueLink');
    
    try {
        await navigator.clipboard.writeText(linkInput.value);
        
        // Visual feedback
        const btn = document.getElementById('copyLinkDirectBtn');
        const originalText = btn.textContent;
        btn.textContent = '✓ הועתק!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    } catch (error) {
        // Fallback for older browsers
        linkInput.select();
        document.execCommand('copy');
        alert('הקישור הועתק ללוח');
    }
}

/**
 * Regenerate teacher link
 */
async function handleRegenerateLink() {
    if (!confirm('האם אתה בטוח? הקישור הישן לא יעבוד יותר.')) {
        return;
    }

    const btn = document.getElementById('regenerateLinkBtn');
    const spinner = btn.querySelector('.btn-spinner');
    const btnText = btn.querySelector('.btn-text');
    
    try {
        // Show spinner
        btn.disabled = true;
        spinner.style.display = 'inline-block';
        btnText.textContent = 'יוצר קישור...';
        
        const linkData = await regenerateTeacherLink(currentBusinessId, currentEditingId);
        const fullLink = `${window.location.origin}/teacher?link=${linkData.linkToken}`;
        document.getElementById('uniqueLink').value = fullLink;
        alert('קישור חדש נוצר בהצלחה');
    } catch (error) {
        console.error('Error regenerating link:', error);
        alert('שגיאה ביצירת קישור חדש');
    } finally {
        // Hide spinner
        btn.disabled = false;
        spinner.style.display = 'none';
        btnText.textContent = '🔄 צור קישור חדש';
    }
}

/**
 * Share link via Web Share API
 */
async function shareLink() {
    const link = document.getElementById('uniqueLink').value;
    const teacher = await getTeacherById(currentBusinessId, currentEditingId);
    const teacherName = `${teacher.firstName} ${teacher.lastName}`;

    if (navigator.share) {
        try {
            await navigator.share({
                title: `קישור למורה ${teacherName}`,
                text: `קישור לסימון נוכחות עבור ${teacherName}`,
                url: link
            });
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error sharing:', error);
            }
        }
    } else {
        // Fallback - copy to clipboard
        await copyLink();
    }
}

/**
 * Handle photo selection
 */
function handlePhotoSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('נא לבחור קובץ תמונה');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        alert('גודל הקובץ חייב להיות פחות מ-5MB');
        return;
    }

    photoFile = file;
    
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
    
    saveBtn.disabled = true;
    spinner.style.display = 'inline-block';

    try {
        const formData = {
            firstName: document.getElementById('firstName').value.trim(),
            lastName: document.getElementById('lastName').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            specialization: document.getElementById('specialization').value.trim(),
            notes: document.getElementById('notes').value.trim(),
            active: document.getElementById('isActive').checked
        };

        let teacherId;

        if (currentEditingId) {
            await updateTeacher(currentBusinessId, currentEditingId, formData);
            teacherId = currentEditingId;
        } else {
            teacherId = await createTeacher(currentBusinessId, formData);
        }

        // Upload photo if selected
        if (photoFile) {
            await uploadTeacherPhoto(currentBusinessId, teacherId, photoFile);
        } else if (currentPhotoUrl === null && currentEditingId) {
            await deleteTeacherPhoto(currentBusinessId, currentEditingId);
        }

        await loadTeachers();
        closeModal('teacherModal');
        alert(currentEditingId ? 'המורה עודכן בהצלחה' : 'המורה נוסף בהצלחה');

    } catch (error) {
        console.error('Error saving teacher:', error);
        alert('שגיאה בשמירת המורה: ' + error.message);
    } finally {
        saveBtn.disabled = false;
        spinner.style.display = 'none';
    }
}

/**
 * Confirm delete
 */
function confirmDelete(teacherId, teacherName) {
    currentEditingId = teacherId;
    document.getElementById('deleteTeacherName').textContent = teacherName;
    showModal('deleteModal', document.getElementById('deleteModal'));
}

/**
 * Handle delete
 */
async function handleDelete() {
    const deleteBtn = document.getElementById('confirmDeleteBtn');
    deleteBtn.disabled = true;

    try {
        await deleteTeacher(currentBusinessId, currentEditingId);
        await loadTeachers();
        closeModal('deleteModal');
        alert('המורה הועבר לארכיון');
    } catch (error) {
        console.error('Error deleting teacher:', error);
        alert('שגיאה במחיקת המורה');
    } finally {
        deleteBtn.disabled = false;
    }
}
