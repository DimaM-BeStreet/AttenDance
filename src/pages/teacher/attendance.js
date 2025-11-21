/**
 * Teacher Attendance Page
 * Simplified attendance interface accessed via unique teacher link
 */

import '../../styles/main.css';
import '../../styles/rtl.css';
import '../../styles/mobile.css';
import '../../styles/teacher-attendance.css';
import { auth } from '../../config/firebase-config.js';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { getUserBusinessId } from '../../services/auth-service.js';
import { getClassInstances } from '../../services/class-instance-service.js';
import { getInstanceEnrolledStudents } from '../../services/class-instance-service.js';
import { getClassInstanceAttendance } from '../../services/attendance-service.js';
import { markAttendance } from '../../services/teacher-service.js';

// State
let currentTeacherId = null;
let currentStudioId = null;
let currentLinkToken = null;
let selectedClassId = null;
let enrolledStudents = [];
let attendanceRecords = {}; // {studentId: {status, notes}}
let currentModalStudentId = null;
let searchTimeout = null;
let hasUnsavedChanges = false;

/**
 * Update save button state
 */
function updateSaveButtonState() {
    const saveBtn = document.getElementById('saveBtn');
    if (hasUnsavedChanges) {
        saveBtn.classList.add('has-changes');
    } else {
        saveBtn.classList.remove('has-changes');
    }
}

/**
 * Check teacher authentication
 */
function checkTeacherAuth() {
    console.log('Checking teacher auth...');
    console.log('Current user:', auth.currentUser);
    
    // Check Firebase Auth first
    if (!auth.currentUser) {
        console.error('No Firebase Auth session - redirecting to home');
        window.location.href = '/';
        return null;
    }

    console.log('Firebase Auth OK, checking storage...');
    
    // Try sessionStorage first, then localStorage
    let authData = sessionStorage.getItem('teacherAuth');
    if (!authData) {
        authData = localStorage.getItem('teacherAuth');
    }

    if (!authData) {
        // No authentication found, redirect to home
        console.error('No teacher auth data in storage - redirecting to home');
        window.location.href = '/';
        return null;
    }

    try {
        const teacherAuth = JSON.parse(authData);
        
        // Verify required fields
        if (!teacherAuth.teacherId || !teacherAuth.businessId) {
            console.error('Invalid teacher auth data - missing fields');
            window.location.href = '/';
            return null;
        }

        return teacherAuth;
    } catch (error) {
        console.error('Error parsing teacher auth:', error);
        window.location.href = '/';
        return null;
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Wait for Firebase Auth to initialize
        await new Promise((resolve) => {
            const unsubscribe = auth.onAuthStateChanged((user) => {
                unsubscribe();
                resolve();
            });
        });

        // Check authentication
        const teacherAuth = checkTeacherAuth();
        if (!teacherAuth) {
            return; // Will redirect
        }

        // Set teacher and studio from authenticated data
        currentTeacherId = teacherAuth.teacherId;
        currentStudioId = teacherAuth.businessId;
        currentLinkToken = teacherAuth.linkToken;

        // Renew session on page load (extends expiration by 90 days)
        if (auth.currentUser) {
            try {
                const { renewTeacherSession } = await import('../../services/teacher-service.js');
                await renewTeacherSession(currentLinkToken, auth.currentUser.uid);
            } catch (error) {
                console.error('Session renewal failed:', error);
                // Continue anyway - might still have valid session
            }
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

    // Separate today's classes from future classes
    const todayClasses = [];
    const futureClasses = [];
    
    classes.forEach(cls => {
        const classDate = cls.date.toDate();
        const isToday = classDate.toDateString() === today.toDateString();
        if (isToday) {
            todayClasses.push(cls);
        } else {
            futureClasses.push(cls);
        }
    });

    // Render classes with sections
    let html = '';
    
    if (todayClasses.length > 0) {
        html += '<div class="class-section-header">היום:</div>';
        html += todayClasses.map(cls => {
            const classDate = cls.date.toDate();
            return `
                <button class="class-list-item" 
                        data-class-id="${cls.id}">
                    <div class="class-list-item-main">
                        <div class="class-list-item-title">
                            ${cls.name || 'שיעור'}
                        </div>
                        <div class="class-list-item-meta">
                            ${formatDate(classDate)} • ${cls.startTime || ''} - ${calculateEndTime(cls.startTime, cls.duration)}
                        </div>
                    </div>
                    <div class="class-list-item-arrow">←</div>
                </button>
            `;
        }).join('');
    }
    
    if (futureClasses.length > 0) {
        if (todayClasses.length > 0) {
            html += '<div class="class-section-divider"></div>';
        }
        html += '<div class="class-section-header">בעתיד:</div>';
        html += futureClasses.map(cls => {
            const classDate = cls.date.toDate();
            return `
                <button class="class-list-item" 
                        data-class-id="${cls.id}">
                    <div class="class-list-item-main">
                        <div class="class-list-item-title">
                            ${cls.name || 'שיעור'}
                        </div>
                        <div class="class-list-item-meta">
                            ${formatDate(classDate)} • ${cls.startTime || ''} - ${calculateEndTime(cls.startTime, cls.duration)}
                        </div>
                    </div>
                    <div class="class-list-item-arrow">←</div>
                </button>
            `;
        }).join('');
    }
    
    list.innerHTML = html;

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
        document.getElementById('classInfoTitle').textContent = selectedClass.name || 'שיעור';
        document.getElementById('classInfoMeta').textContent = 
            `${formatDate(classDate)} • ${selectedClass.startTime || ''} - ${calculateEndTime(selectedClass.startTime, selectedClass.duration)}`;

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

    // Mark as unsaved
    hasUnsavedChanges = true;
    updateSaveButtonState();

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
 * Get avatar color based on initial
 */
function getAvatarColor(initial) {
    const colors = [
        '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
        '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
    ];
    const index = initial.charCodeAt(0) % colors.length;
    return colors[index];
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
        const initial = student.firstName.charAt(0).toUpperCase();
        const hasPhoto = student.photoUrl && !student.isTemp;
        const avatarColor = student.isTemp ? '#9333ea' : getAvatarColor(initial);

        return `
            <div class="student-attendance-item">
                ${hasPhoto ? `
                    <img 
                        src="${student.photoUrl}" 
                        alt="${student.firstName}" 
                        class="student-photo"
                        onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                    >
                    <div class="student-avatar" style="background-color: ${avatarColor}; display: none;">
                        ${initial}
                    </div>
                ` : `
                    <div class="student-avatar" style="background-color: ${avatarColor};">
                        ${initial}
                    </div>
                `}
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
    const initial = student.firstName.charAt(0).toUpperCase();
    const hasPhoto = student.photoUrl && !student.isTemp;
    const avatarColor = student.isTemp ? '#9333ea' : getAvatarColor(initial);

    document.getElementById('modalStudentName').textContent = `${student.firstName} ${student.lastName}`;
    const photoContainer = document.querySelector('.student-modal-photo');
    
    if (hasPhoto) {
        photoContainer.innerHTML = `
            <img id="modalStudentPhoto" src="${student.photoUrl}" alt="${student.firstName}"
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div class="student-modal-avatar" style="background-color: ${avatarColor}; display: none;">
                ${initial}
            </div>
        `;
    } else {
        photoContainer.innerHTML = `
            <div class="student-modal-avatar" style="background-color: ${avatarColor};">
                ${initial}
            </div>
        `;
    }
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

        // Mark attendance for each student using Cloud Function
        for (const data of attendanceData) {
            await markAttendance(
                currentLinkToken,
                selectedClassId,
                data.studentId,
                currentStudioId,
                data.status,
                data.notes
            );
        }
        
        // Clear unsaved changes flag
        hasUnsavedChanges = false;
        updateSaveButtonState();
        
        // Reload attendance to show saved data
        const existingAttendance = await getClassInstanceAttendance(currentStudioId, selectedClassId);
        
        // Update attendance records with saved data
        attendanceRecords = {};
        existingAttendance.forEach(record => {
            attendanceRecords[record.studentId] = {
                status: record.status,
                notes: record.notes || ''
            };
        });
        
        // Refresh UI
        updateStats();
        renderStudentsList();
        
        alert('הנוכחות נשמרה בהצלחה! ✅');

    } catch (error) {
        console.error('Error saving attendance:', error);
        alert('שגיאה בשמירת הנוכחות: ' + (error.message || error));
    } finally {
        saveBtn.disabled = false;
        spinner.style.display = 'none';
    }
}

/**
 * Calculate end time from start time and duration
 */
function calculateEndTime(startTime, duration) {
    if (!startTime || !duration) return '';
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + duration;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
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
            // Visual feedback
            btn.style.transform = 'scale(0.95)';
            setTimeout(() => { btn.style.transform = ''; }, 100);
            
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
            
            // Mark as unsaved
            hasUnsavedChanges = true;
            updateSaveButtonState();
        }
    });
});

document.getElementById('modalNotes')?.addEventListener('change', () => {
    if (currentModalStudentId && attendanceRecords[currentModalStudentId]) {
        attendanceRecords[currentModalStudentId].notes = 
            document.getElementById('modalNotes').value;
        hasUnsavedChanges = true;
        updateSaveButtonState();
    }
});

// Auto-save on page unload (safety net)
window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges && Object.keys(attendanceRecords).length > 0) {
        // Try to save before leaving
        const attendanceData = Object.entries(attendanceRecords)
            .filter(([_, data]) => data.status)
            .map(([studentId, data]) => ({
                studentId,
                status: data.status,
                notes: data.notes || ''
            }));
        
        if (attendanceData.length > 0) {
            // Show warning
            e.preventDefault();
            e.returnValue = '';
        }
    }
});

// Temp Student Modal handlers
document.getElementById('addTempStudentBtn')?.addEventListener('click', () => {
    document.getElementById('addTempStudentModal').classList.add('show');
    document.getElementById('tempStudentForm').reset();
});

document.getElementById('tempModalClose')?.addEventListener('click', () => {
    document.getElementById('addTempStudentModal').classList.remove('show');
});

document.getElementById('tempCancelBtn')?.addEventListener('click', () => {
    document.getElementById('addTempStudentModal').classList.remove('show');
});

document.getElementById('tempStudentForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('tempStudentName').value.trim();
    const phone = document.getElementById('tempStudentPhone').value.trim();
    const notes = document.getElementById('tempStudentNotes').value.trim();
    
    if (!name || !phone) {
        alert('נא למלא שם וטלפון');
        return;
    }
    
    try {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'מוסיף...';
        
        // Import and call create temp student function
        const { createTempStudent } = await import('../../services/teacher-service.js');
        
        const result = await createTempStudent(currentLinkToken, {
            name,
            phone,
            notes,
            classId: selectedClassId,
            studioId: currentStudioId
        });
        
        // Close modal
        document.getElementById('addTempStudentModal').classList.remove('show');
        
        // Reload enrolled students to include new temp student
        enrolledStudents = await getInstanceEnrolledStudents(currentStudioId, selectedClassId);
        
        // Re-render the students list
        renderStudentsList();
        
        // Show success message
        alert('תלמיד זמני נוסף בהצלחה!');
        
    } catch (error) {
        console.error('Error adding temp student:', error);
        alert('שגיאה בהוספת תלמיד זמני: ' + error.message);
    } finally {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.textContent = 'הוסף תלמיד';
    }
});

// Logout handler
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    try {
        // Delete teacher session from Firestore if authenticated
        if (auth.currentUser) {
            const { deleteDoc, doc } = await import('firebase/firestore');
            const { db } = await import('../../config/firebase-config.js');
            await deleteDoc(doc(db, 'teacherSessions', auth.currentUser.uid));
        }
        
        // Sign out of Firebase Auth
        await signOut(auth);
        
        // Clear authentication
        sessionStorage.removeItem('teacherAuth');
        localStorage.removeItem('teacherAuth');
        
        // Redirect to home
        window.location.href = '/';
    } catch (error) {
        console.error('Logout error:', error);
        // Still redirect even if sign out fails
        window.location.href = '/';
    }
});

// Expose functions to window for inline handlers
window.markStudentAttendance = markStudentAttendance;
window.openStudentDetails = openStudentDetails;
