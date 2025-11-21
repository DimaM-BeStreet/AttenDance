/**
 * Attendance Marking Page
 * Mobile-first interface for marking student attendance
 */

import './attendance-styles.js';
import { createNavbar } from '../../components/navbar.js';
import { showModal, closeModal } from '../../components/modal.js';
import { showAlert, showConfirm } from '../../components/dialog.js';
import { 
    getTodayClassInstances,
    getWeekClassInstances,
    getClassInstanceById,
    getInstanceEnrolledStudents
} from '../../services/class-instance-service.js';
import {
    markAttendance,
    bulkMarkAttendance,
    getClassInstanceAttendance
} from '../../services/attendance-service.js';
import { getStudentById } from '../../services/student-service.js';
import { getTempStudentsByClass, createTempStudent } from '../../services/temp-students-service.js';
import { auth, db } from '../../config/firebase-config.js';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

// State
let currentStudioId = null;
let currentUser = null;
let currentUserId = null;
let selectedClassId = null;
let selectedClassInstance = null;
let classInstances = [];
let enrolledStudents = [];
let tempStudents = [];
let attendanceRecords = {};
let currentFilter = 'all';
let currentEditingStudentId = null;

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
            
            if (!userData || !['superAdmin', 'admin', 'teacher'].includes(userData.role)) {
                await showAlert('אין לך הרשאות לצפות בדף זה');
                window.location.href = '/';
                return;
            }

            currentUser = userData;
            currentUserId = user.uid;
            currentStudioId = userData.businessId;
            
            // Initialize navbar
            createNavbar();

            // Load classes
            await loadClasses();

            // Setup event listeners
            setupEventListeners();

            // Check for URL parameter
            const urlParams = new URLSearchParams(window.location.search);
            const classId = urlParams.get('classId');
            if (classId) {
                document.getElementById('classSelect').value = classId;
                await selectClass(classId);
            }

        } catch (error) {
            console.error('Error initializing attendance page:', error);
            await showAlert('שגיאה בטעינת הדף');
        }
    });
});

/**
 * Load today's and upcoming classes
 */
async function loadClasses() {
    try {
        const today = await getTodayClassInstances(currentStudioId);
        const week = await getWeekClassInstances(currentStudioId);
        
        // Combine and deduplicate
        const allClasses = [...today, ...week];
        const uniqueClasses = Array.from(
            new Map(allClasses.map(c => [c.id, c])).values()
        );

        // Filter only scheduled classes
        classInstances = uniqueClasses
            .filter(c => c.status === 'scheduled')
            .sort((a, b) => a.date.toDate() - b.date.toDate());

        populateClassSelect();

    } catch (error) {
        console.error('Error loading classes:', error);
        document.getElementById('classSelect').innerHTML = 
            '<option value="">שגיאה בטעינת שיעורים</option>';
    }
}

/**
 * Populate class select dropdown
 */
function populateClassSelect() {
    const select = document.getElementById('classSelect');
    
    if (classInstances.length === 0) {
        select.innerHTML = '<option value="">אין שיעורים מתוכננים</option>';
        return;
    }

    const options = classInstances.map(cls => {
        const date = cls.date.toDate();
        const dateStr = formatDate(date);
        const timeStr = cls.startTime;
        const isToday = date.toDateString() === new Date().toDateString();
        
        return `<option value="${cls.id}">${isToday ? '🔴 ' : ''}${cls.name || ''} - ${dateStr} ${timeStr}</option>`;
    }).join('');

    select.innerHTML = '<option value="">בחר שיעור...</option>' + options;
}

/**
 * Select class and load students
 */
async function selectClass(classId) {
    if (!classId) {
        document.getElementById('attendanceContent').style.display = 'none';
        document.getElementById('emptyState').style.display = 'block';
        return;
    }

    selectedClassId = classId;
    
    try {
        // Show loading
        document.getElementById('studentsList').innerHTML = 
            '<div class="loading-state">טוען תלמידים...</div>';
        document.getElementById('attendanceContent').style.display = 'block';
        document.getElementById('emptyState').style.display = 'none';

        // Load class details
        const classInstance = await getClassInstanceById(currentStudioId, classId);
        selectedClassInstance = classInstance;
        document.getElementById('classInfo').textContent = 
            `${classInstance.name || ''} - ${formatDate(classInstance.date.toDate())} ${classInstance.startTime}`;

        // Load enrolled students, temp students, and existing attendance
        const [students, temps, existingAttendance] = await Promise.all([
            getInstanceEnrolledStudents(currentStudioId, classId),
            getTempStudentsByClass(classId),
            getClassInstanceAttendance(currentStudioId, classId)
        ]);

        enrolledStudents = students;
        tempStudents = temps;
        
        // Map existing attendance
        attendanceRecords = {};
        existingAttendance.forEach(record => {
            attendanceRecords[record.studentId] = {
                status: record.status,
                notes: record.notes || '',
                isTemp: record.isTemp || false
            };
        });

        updateStats();
        renderStudentsList();

    } catch (error) {
        console.error('Error selecting class:', error);
        await showAlert('שגיאה בטעינת פרטי השיעור');
    }
}

/**
 * Update statistics
 */
function updateStats() {
    const total = enrolledStudents.length + tempStudents.length;
    const present = Object.values(attendanceRecords).filter(r => r.status === 'present').length;
    const absent = Object.values(attendanceRecords).filter(r => r.status === 'absent').length;
    const late = Object.values(attendanceRecords).filter(r => r.status === 'late').length;

    document.getElementById('totalStudents').textContent = total;
    document.getElementById('presentCount').textContent = present;
    document.getElementById('absentCount').textContent = absent;
    document.getElementById('lateCount').textContent = late;
}

/**
 * Render students list
 */
function renderStudentsList() {
    const container = document.getElementById('studentsList');
    
    // Combine enrolled students and temp students
    const allStudents = [
        ...enrolledStudents.map(s => ({ ...s, isTemp: false })),
        ...tempStudents.map(t => ({ 
            id: t.id, 
            firstName: t.name.split(' ')[0] || t.name,
            lastName: t.name.split(' ').slice(1).join(' ') || '',
            phone: t.phone,
            photoURL: null,
            isTemp: true 
        }))
    ];
    
    if (allStudents.length === 0) {
        container.innerHTML = '<div class="empty-state">אין תלמידים רשומים לשיעור זה</div>';
        return;
    }

    // Apply search filter
    const searchTerm = document.getElementById('searchStudent').value.toLowerCase();
    let filteredStudents = allStudents;

    if (searchTerm) {
        filteredStudents = allStudents.filter(student => {
            const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
            return fullName.includes(searchTerm) || (student.phone && student.phone.includes(searchTerm));
        });
    }

    // Apply status filter
    if (currentFilter !== 'all') {
        filteredStudents = filteredStudents.filter(student => {
            const record = attendanceRecords[student.id];
            if (currentFilter === 'unmarked') {
                return !record;
            }
            return record && record.status === currentFilter;
        });
    }

    if (filteredStudents.length === 0) {
        container.innerHTML = '<div class="empty-state">אין תלמידים להצגה</div>';
        return;
    }

    container.innerHTML = filteredStudents.map(student => {
        const record = attendanceRecords[student.id];
        const status = record?.status || 'unmarked';
        
        return `
            <div class="student-attendance-item" data-student-id="${student.id}">
                <div class="student-photo-container">
                    ${student.photoURL 
                        ? `<img src="${student.photoURL}" alt="${student.firstName}" class="student-photo">`
                        : '<div class="student-photo-placeholder">👤</div>'
                    }
                </div>
                <div class="student-info">
                    <div class="student-name">
                        ${student.firstName} ${student.lastName}
                        ${student.isTemp ? '<span class="temp-badge">זמני</span>' : ''}
                    </div>
                    ${student.isTemp && student.phone ? `<div class="student-phone">${student.phone}</div>` : ''}
                    ${record?.notes ? `<div class="student-notes-preview">💬 ${record.notes}</div>` : ''}
                </div>
                <div class="status-buttons-group">
                    <button class="status-btn-small ${status === 'present' ? 'active-present' : ''}" 
                            data-student-id="${student.id}" data-status="present" title="נוכח">
                        ✅
                    </button>
                    <button class="status-btn-small ${status === 'absent' ? 'active-absent' : ''}" 
                            data-student-id="${student.id}" data-status="absent" title="נעדר">
                        ❌
                    </button>
                    <button class="status-btn-small ${status === 'late' ? 'active-late' : ''}" 
                            data-student-id="${student.id}" data-status="late" title="איחור">
                        ⏰
                    </button>
                    <button class="status-btn-small ${status === 'excused' ? 'active-excused' : ''}" 
                            data-student-id="${student.id}" data-status="excused" title="מוצדק">
                        📝
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Add click handlers for status buttons
    container.querySelectorAll('.status-btn-small').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const studentId = btn.dataset.studentId;
            const status = btn.dataset.status;
            markStudentAttendance(studentId, status);
        });
    });

    // Add click handlers for student items (open details)
    container.querySelectorAll('.student-attendance-item').forEach(item => {
        item.addEventListener('click', () => {
            openStudentDetails(item.dataset.studentId);
        });
    });
}

/**
 * Mark student attendance
 */
async function markStudentAttendance(studentId, status) {
    if (!attendanceRecords[studentId]) {
        attendanceRecords[studentId] = { status, notes: '' };
    } else {
        // Toggle off if clicking same status
        if (attendanceRecords[studentId].status === status) {
            delete attendanceRecords[studentId];
        } else {
            attendanceRecords[studentId].status = status;
        }
    }

    updateStats();
    renderStudentsList();
    
    // Auto-save attendance
    await autoSaveAttendance(studentId, status);
}

/**
 * Open student details modal
 */
async function openStudentDetails(studentId) {
    try {
        const student = await getStudentById(currentStudioId, studentId);
        if (!student) return;

        currentEditingStudentId = studentId;

        document.getElementById('studentModalName').textContent = 
            `${student.firstName} ${student.lastName}`;

        // Photo
        const photoContainer = document.getElementById('studentModalPhoto');
        if (student.photoURL) {
            photoContainer.innerHTML = `<img src="${student.photoURL}" alt="תמונה" class="student-modal-photo-img">`;
        } else {
            photoContainer.innerHTML = '<div class="student-modal-photo-placeholder">👤</div>';
        }

        // Info
        const infoContainer = document.getElementById('studentModalInfo');
        infoContainer.innerHTML = `
            <div class="detail-item">
                <span class="detail-label">טלפון:</span>
                <span class="detail-value" dir="ltr">${student.phone || 'לא צוין'}</span>
            </div>
            ${student.parentName ? `
                <div class="detail-item">
                    <span class="detail-label">הורה:</span>
                    <span class="detail-value">${student.parentName}</span>
                </div>
            ` : ''}
        `;

        // Set current status
        const record = attendanceRecords[studentId];
        document.querySelectorAll('.status-btn').forEach(btn => {
            btn.classList.remove('active');
            if (record && btn.dataset.status === record.status) {
                btn.classList.add('active');
            }
        });

        // Set notes
        document.getElementById('studentNotes').value = record?.notes || '';

        showModal('studentDetailsModal', document.getElementById('studentDetailsModal'));

    } catch (error) {
        console.error('Error loading student details:', error);
    }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Class selection
    document.getElementById('classSelect').addEventListener('change', (e) => {
        selectClass(e.target.value);
    });

    // Refresh classes
    document.getElementById('refreshClassesBtn').addEventListener('click', loadClasses);

    // Search
    let searchTimeout;
    document.getElementById('searchStudent').addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(renderStudentsList, 300);
    });

    // Filter chips
    document.querySelectorAll('.chip[data-filter]').forEach(chip => {
        chip.addEventListener('click', (e) => {
            document.querySelectorAll('.chip[data-filter]').forEach(c => 
                c.classList.remove('chip-active'));
            e.target.classList.add('chip-active');
            currentFilter = e.target.dataset.filter;
            renderStudentsList();
        });
    });

    // Bulk actions
    document.getElementById('markAllPresentBtn').addEventListener('click', async () => {
        if (!await showConfirm('האם לסמן את כל התלמידים כנוכחים?')) return;
        
        const allStudents = [...enrolledStudents, ...tempStudents];
        for (const student of allStudents) {
            attendanceRecords[student.id] = { status: 'present', notes: '' };
            await autoSaveAttendance(student.id, 'present');
        }
        updateStats();
        renderStudentsList();
    });

    document.getElementById('markAllAbsentBtn').addEventListener('click', async () => {
        if (!await showConfirm('האם לסמן את כל התלמידים כנעדרים?')) return;
        
        const allStudents = [...enrolledStudents, ...tempStudents];
        for (const student of allStudents) {
            attendanceRecords[student.id] = { status: 'absent', notes: '' };
            await autoSaveAttendance(student.id, 'absent');
        }
        updateStats();
        renderStudentsList();
    });

    // Add temp student button
    document.getElementById('addTempStudentBtn').addEventListener('click', openTempStudentModal);
    document.getElementById('closeTempStudentModal').addEventListener('click', closeTempStudentModal);
    document.getElementById('cancelTempStudentBtn').addEventListener('click', closeTempStudentModal);
    document.getElementById('tempStudentForm').addEventListener('submit', handleAddTempStudent);

    // Status buttons in modal
    document.querySelectorAll('.status-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const status = btn.dataset.status;
            const notes = document.getElementById('studentNotes').value.trim();
            
            attendanceRecords[currentEditingStudentId] = { status, notes };
            updateStats();
            renderStudentsList();
        });
    });

    // Notes input
    document.getElementById('studentNotes').addEventListener('input', (e) => {
        if (attendanceRecords[currentEditingStudentId]) {
            attendanceRecords[currentEditingStudentId].notes = e.target.value.trim();
        }
    });
}

/**
 * Save attendance
 */
/**
 * Show auto-save indicator
 */
function showAutoSaveIndicator() {
    const indicator = document.getElementById('autoSaveIndicator');
    if (!indicator) return;
    
    indicator.style.display = 'flex';
    
    // Hide after 3 seconds
    setTimeout(() => {
        indicator.style.display = 'none';
    }, 3000);
}

/**
 * Auto-save individual attendance record
 */
async function autoSaveAttendance(studentId, status) {
    if (!selectedClassId || !selectedClassInstance) return;
    
    try {
        const classDate = selectedClassInstance?.date?.toDate ? selectedClassInstance.date.toDate() : selectedClassInstance?.date || new Date();
        
        // Check if record exists (was toggled off)
        if (!attendanceRecords[studentId]) {
            // Student was unmarked - we could delete the record or just skip
            return;
        }
        
        const attendanceData = {
            studentId,
            status: attendanceRecords[studentId].status,
            notes: attendanceRecords[studentId].notes || '',
            date: classDate,
            markedBy: currentUser.uid
        };
        
        // Save individual record
        await markAttendance(currentStudioId, {
            ...attendanceData,
            classInstanceId: selectedClassId
        });
        
        // Show save indicator
        showAutoSaveIndicator();
        
    } catch (error) {
        console.error('Error auto-saving attendance:', error);
        // Silently fail - don't interrupt user flow with alerts
    }
}

// Manual save function (deprecated - now using auto-save)
// Kept for reference or potential bulk save feature in future
/*
async function saveAttendance() {
    if (!selectedClassId) {
        await showAlert('נא לבחור שיעור');
        return;
    }

    if (Object.keys(attendanceRecords).length === 0) {
        await showAlert('נא לסמן נוכחות לפחות לתלמיד אחד');
        return;
    }

    try {
        const classDate = selectedClassInstance?.date?.toDate ? selectedClassInstance.date.toDate() : selectedClassInstance?.date || new Date();
        
        const attendanceData = Object.entries(attendanceRecords).map(([studentId, record]) => ({
            studentId,
            status: record.status,
            notes: record.notes,
            date: classDate,
            markedBy: currentUser.uid
        }));

        await bulkMarkAttendance(currentStudioId, selectedClassId, attendanceData);
        await showAlert('הנוכחות נשמרה בהצלחה!');
    } catch (error) {
        console.error('Error saving attendance:', error);
        await showAlert('שגיאה בשמירת הנוכחות: ' + error.message);
    }
}
*/

/**
 * Open temp student modal
 */
async function openTempStudentModal() {
    if (!selectedClassId) {
        await showAlert('אנא בחר שיעור קודם');
        return;
    }
    document.getElementById('tempStudentForm').reset();
    const modal = document.getElementById('addTempStudentModal');
    modal.style.display = 'flex';
    // Trigger animation
    setTimeout(() => modal.classList.add('show'), 10);
}

/**
 * Close temp student modal
 */
function closeTempStudentModal() {
    const modal = document.getElementById('addTempStudentModal');
    modal.classList.remove('show');
    // Wait for animation to complete before hiding
    setTimeout(() => modal.style.display = 'none', 300);
}

/**
 * Handle add temp student
 */
async function handleAddTempStudent(e) {
    e.preventDefault();
    
    const name = document.getElementById('tempStudentName').value.trim();
    const phone = document.getElementById('tempStudentPhone').value.trim();
    const notes = document.getElementById('tempStudentNotes').value.trim();
    
    try {
        const tempStudentId = await createTempStudent({
            name,
            phone,
            notes,
            classId: selectedClassId,
            studioId: currentStudioId
        }, currentUserId);
        
        // Reload temp students for this class
        tempStudents = await getTempStudentsByClass(selectedClassId);
        
        // Mark as present by default
        attendanceRecords[tempStudentId] = { status: 'present', notes: '', isTemp: true };
        
        updateStats();
        renderStudentsList();
        closeTempStudentModal();
        
        await showAlert('תלמיד זמני נוסף בהצלחה');
    } catch (error) {
        console.error('Error adding temp student:', error);
        await showAlert('שגיאה בהוספת תלמיד זמני');
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

function formatTime(date) {
    return date.toLocaleTimeString('he-IL', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}
