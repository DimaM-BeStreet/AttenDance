/**
 * Teacher Attendance Page
 * Simplified attendance interface accessed via unique teacher link
 */

import '../../styles/main.css';
import '../../styles/rtl.css';
import '../../styles/mobile.css';
import '../../styles/teacher-attendance.css';
import { auth } from '../../config/firebase-config.js';
import { getUserBusinessId } from '../../services/auth-service.js';
import { getClassInstances } from '../../services/class-instance-service.js';
import { getInstanceEnrolledStudents } from '../../services/class-instance-service.js';
import { getClassInstanceAttendance, bulkMarkAttendance } from '../../services/attendance-service.js';

// State
let currentTeacherId = null;
let currentStudioId = null;
let selectedClassId = null;
let enrolledStudents = [];
let attendanceRecords = {}; // {studentId: {status, notes}}
let currentModalStudentId = null;
let searchTimeout = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Get teacher ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const teacherId = urlParams.get('teacher');
        
        if (!teacherId) {
            showError('קישור לא תקין. נא ליצור קישור חדש מהמערכת.');
            return;
        }

        currentTeacherId = teacherId;
        
        // Get studio ID from auth or URL
        currentStudioId = await getUserBusinessId();
        
        if (!currentStudioId) {
            showError('לא נמצא סטודיו. נא ליצור קישור חדש.');
            return;
        }

        await loadClasses();

    } catch (error) {
        console.error('Initialization error:', error);
        showError('שגיאה בטעינת הנתונים. נסה לרענן את הדף.');
    }
});

/**
 * Load teacher's classes
 */
async function loadClasses() {
    try {
        document.getElementById('loadingState').style.display = 'flex';
        document.getElementById('errorState').style.display = 'none';
        document.getElementById('classSelection').style.display = 'none';

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get all scheduled classes
        const allClasses = await getClassInstances(currentStudioId, {
            startDate: today,
            teacherId: currentTeacherId
        });

        // Filter scheduled classes for next 7 days
        const weekLater = new Date(today);
        weekLater.setDate(weekLater.getDate() + 7);

        const upcomingClasses = allClasses.filter(cls => {
            if (cls.status !== 'scheduled') return false;
            const classDate = cls.date.toDate();
            return classDate >= today && classDate <= weekLater;
        });

        if (upcomingClasses.length === 0) {
            showError('אין שיעורים קרובים. בדוק עם המנהל.');
            return;
        }

        // Sort by date and time
        upcomingClasses.sort((a, b) => a.date.toDate() - b.date.toDate());

        renderClassesList(upcomingClasses);

        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('classSelection').style.display = 'block';

    } catch (error) {
        console.error('Error loading classes:', error);
        showError('שגיאה בטעינת השיעורים');
    }
}

/**
 * Render classes list
 */
function renderClassesList(classes) {
    const list = document.getElementById('classesList');
    
    if (!classes || classes.length === 0) {
        list.innerHTML = '<p class="empty-message">אין שיעורים זמינים</p>';
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    list.innerHTML = classes.map(cls => {
        const classDate = cls.date.toDate();
        const isToday = classDate.toDateString() === today.toDateString();
        
        return `
            <button class="class-list-item ${isToday ? 'class-list-item-today' : ''}" 
                    data-class-id="${cls.id}">
                <div class="class-list-item-main">
                    <div class="class-list-item-title">
                        ${isToday ? '🔴 ' : ''}${cls.templateName || 'שיעור'}
                    </div>
                    <div class="class-list-item-meta">
                        ${formatDate(classDate)} • ${cls.startTime || ''} - ${cls.endTime || ''}
                    </div>
                </div>
                <div class="class-list-item-arrow">←</div>
            </button>
        `;
    }).join('');

    // Add click handlers
    list.querySelectorAll('.class-list-item').forEach(item => {
        item.addEventListener('click', () => {
            const classId = item.dataset.classId;
            selectClass(classId, classes);
        });
    });
}

/**
 * Select class and load attendance
 */
async function selectClass(classId, classes) {
    try {
        selectedClassId = classId;
        const selectedClass = classes.find(c => c.id === classId);

        if (!selectedClass) return;

        // Show loading
        document.getElementById('classSelection').style.display = 'none';
        document.getElementById('loadingState').style.display = 'flex';

        // Load enrolled students
        enrolledStudents = await getInstanceEnrolledStudents(currentStudioId, classId);

        // Load existing attendance
        const existingAttendance = await getClassInstanceAttendance(currentStudioId, classId);

        // Initialize attendance records
        attendanceRecords = {};
        existingAttendance.forEach(record => {
            attendanceRecords[record.studentId] = {
                status: record.status,
                notes: record.notes || ''
            };
        });

        // Update UI
        const classDate = selectedClass.date.toDate();
        document.getElementById('classInfoTitle').textContent = selectedClass.templateName || 'שיעור';
        document.getElementById('classInfoMeta').textContent = 
            `${formatDate(classDate)} • ${selectedClass.startTime || ''} - ${selectedClass.endTime || ''}`;

        updateStats();
        renderStudentsList();

        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('attendanceSection').style.display = 'block';

    } catch (error) {
        console.error('Error selecting class:', error);
        showError('שגיאה בטעינת השיעור');
    }
}

/**
 * Mark student attendance
 */
function markStudentAttendance(studentId, status) {
    if (!attendanceRecords[studentId]) {
        attendanceRecords[studentId] = { status: '', notes: '' };
    }

    // Toggle off if same status
    if (attendanceRecords[studentId].status === status) {
        attendanceRecords[studentId].status = '';
    } else {
        attendanceRecords[studentId].status = status;
    }

    updateStats();
    renderStudentsList();
}

/**
 * Update statistics
 */
function updateStats() {
    const total = enrolledStudents.length;
    let present = 0, absent = 0, unmarked = 0;

    enrolledStudents.forEach(student => {
        const record = attendanceRecords[student.id];
        if (!record || !record.status) {
            unmarked++;
        } else if (record.status === 'present' || record.status === 'late') {
            present++;
        } else if (record.status === 'absent') {
            absent++;
        }
    });

    document.getElementById('totalCount').textContent = total;
    document.getElementById('presentCount').textContent = present;
    document.getElementById('absentCount').textContent = absent;
    document.getElementById('unmarkedCount').textContent = unmarked;
}

/**
 * Render students list
 */
function renderStudentsList() {
    const list = document.getElementById('studentsList');
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    const filteredStudents = enrolledStudents.filter(student => {
        const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
        return fullName.includes(searchTerm);
    });

    if (filteredStudents.length === 0) {
        list.innerHTML = '<p class="empty-message">לא נמצאו תלמידים</p>';
        return;
    }

    list.innerHTML = filteredStudents.map(student => {
        const record = attendanceRecords[student.id] || { status: '', notes: '' };
        const photoUrl = student.photoUrl || 'https://via.placeholder.com/48?text=👤';

        return `
            <div class="student-attendance-item">
                <img 
                    src="${photoUrl}" 
                    alt="${student.firstName}" 
                    class="student-photo"
                >
                <div class="student-info">
                    <div class="student-name">${student.firstName} ${student.lastName}</div>
                    ${record.notes ? `<div class="student-notes-badge">📝</div>` : ''}
                </div>
                <div class="student-quick-status">
                    <button 
                        class="status-btn-small ${record.status === 'present' ? 'active-present' : ''}"
                        onclick="window.markStudentAttendance('${student.id}', 'present')"
                        aria-label="נוכח"
                    >✅</button>
                    <button 
                        class="status-btn-small ${record.status === 'absent' ? 'active-absent' : ''}"
                        onclick="window.markStudentAttendance('${student.id}', 'absent')"
                        aria-label="נעדר"
                    >❌</button>
                    <button 
                        class="status-btn-small ${record.status === 'late' ? 'active-late' : ''}"
                        onclick="window.markStudentAttendance('${student.id}', 'late')"
                        aria-label="איחור"
                    >⏰</button>
                    <button 
                        class="status-btn-small ${record.status === 'excused' ? 'active-excused' : ''}"
                        onclick="window.markStudentAttendance('${student.id}', 'excused')"
                        aria-label="מאושר"
                    >📝</button>
                </div>
                <button 
                    class="btn-icon-sm"
                    onclick="window.openStudentDetails('${student.id}')"
                    aria-label="פרטים"
                >
                    ⋮
                </button>
            </div>
        `;
    }).join('');
}

/**
 * Open student details modal
 */
function openStudentDetails(studentId) {
    const student = enrolledStudents.find(s => s.id === studentId);
    if (!student) return;

    currentModalStudentId = studentId;
    const record = attendanceRecords[studentId] || { status: '', notes: '' };
    const photoUrl = student.photoUrl || 'https://via.placeholder.com/120?text=👤';

    document.getElementById('modalStudentName').textContent = `${student.firstName} ${student.lastName}`;
    document.getElementById('modalStudentPhoto').src = photoUrl;
    document.getElementById('modalNotes').value = record.notes;

    // Update status buttons
    document.querySelectorAll('.status-btn').forEach(btn => {
        const status = btn.dataset.status;
        if (status === record.status) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    document.getElementById('studentModal').classList.add('show');
}

/**
 * Save attendance
 */
async function saveAttendance() {
    const saveBtn = document.getElementById('saveBtn');
    const spinner = saveBtn.querySelector('.btn-spinner');

    try {
        saveBtn.disabled = true;
        spinner.style.display = 'inline-block';

        // Convert to array format
        const attendanceData = Object.entries(attendanceRecords)
            .filter(([_, data]) => data.status) // Only save marked students
            .map(([studentId, data]) => ({
                studentId,
                status: data.status,
                notes: data.notes || ''
            }));

        if (attendanceData.length === 0) {
            alert('לא סומנו תלמידים');
            return;
        }

        await bulkMarkAttendance(currentStudioId, selectedClassId, attendanceData);

        alert('הנוכחות נשמרה בהצלחה! ✅');

    } catch (error) {
        console.error('Error saving attendance:', error);
        alert('שגיאה בשמירת הנוכחות');
    } finally {
        saveBtn.disabled = false;
        spinner.style.display = 'none';
    }
}

/**
 * Format date for display
 */
function formatDate(date) {
    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const dayName = dayNames[date.getDay()];
    
    return `יום ${dayName} ${day}/${month}`;
}

/**
 * Show error state
 */
function showError(message) {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('classSelection').style.display = 'none';
    document.getElementById('attendanceSection').style.display = 'none';
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorState').style.display = 'flex';
}

// Event Listeners
document.getElementById('backBtn')?.addEventListener('click', () => {
    document.getElementById('attendanceSection').style.display = 'none';
    document.getElementById('classSelection').style.display = 'block';
    selectedClassId = null;
});

document.getElementById('searchInput')?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        renderStudentsList();
    }, 300);
});

document.getElementById('saveBtn')?.addEventListener('click', saveAttendance);

// Modal handlers
document.getElementById('modalClose')?.addEventListener('click', () => {
    document.getElementById('studentModal').classList.remove('show');
});

document.querySelectorAll('.status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const status = btn.dataset.status;
        if (currentModalStudentId) {
            if (!attendanceRecords[currentModalStudentId]) {
                attendanceRecords[currentModalStudentId] = { status: '', notes: '' };
            }
            
            // Toggle
            if (attendanceRecords[currentModalStudentId].status === status) {
                attendanceRecords[currentModalStudentId].status = '';
            } else {
                attendanceRecords[currentModalStudentId].status = status;
            }

            // Update notes
            attendanceRecords[currentModalStudentId].notes = 
                document.getElementById('modalNotes').value;

            updateStats();
            renderStudentsList();
            
            // Update button states
            document.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active'));
            if (attendanceRecords[currentModalStudentId].status === status) {
                btn.classList.add('active');
            }
        }
    });
});

document.getElementById('modalNotes')?.addEventListener('change', () => {
    if (currentModalStudentId && attendanceRecords[currentModalStudentId]) {
        attendanceRecords[currentModalStudentId].notes = 
            document.getElementById('modalNotes').value;
    }
});

// Expose functions to window for inline handlers
window.markStudentAttendance = markStudentAttendance;
window.openStudentDetails = openStudentDetails;
