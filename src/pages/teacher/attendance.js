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
import { markAttendance, getTeacherById } from '../../services/teacher-service.js';
import { getBusinessById } from '../../services/business-service.js';
import { showModal, closeModal, showToast, showConfirm } from '../../components/modal.js';

// State
let currentTeacherId = null;
let currentbusinessId = null;
let currentLinkToken = null;
let selectedClassId = null;
let enrolledStudents = [];
let attendanceRecords = {}; // {studentId: {status, notes}}
let currentModalStudentId = null;
let searchTimeout = null;

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

        // Close dropdowns when clicking outside
        document.addEventListener('click', () => {
            closeAllDropdowns();
        });

        // Check authentication
        const teacherAuth = checkTeacherAuth();
        if (!teacherAuth) {
            return; // Will redirect
        }

        // Set teacher and business from authenticated data
        currentTeacherId = teacherAuth.teacherId;
        currentbusinessId = teacherAuth.businessId;
        currentLinkToken = teacherAuth.linkToken;

        // Load teacher and business details for header
        loadHeaderDetails();

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
 * Load teacher and business details for header
 */
async function loadHeaderDetails() {
    try {
        const [teacher, business] = await Promise.all([
            getTeacherById(currentbusinessId, currentTeacherId),
            getBusinessById(currentbusinessId)
        ]);

        if (teacher) {
            document.querySelector('.teacher-header-title').textContent = `היי ${teacher.firstName}!`;
        }

        if (business) {
            document.querySelector('.teacher-header-subtitle').textContent = business.name;
        }
        
        // Update logout button text
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.textContent = 'התנתק';
        }

    } catch (error) {
        console.error('Error loading header details:', error);
    }
}

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
        const allClasses = await getClassInstances(currentbusinessId, {
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
        enrolledStudents = await getInstanceEnrolledStudents(currentbusinessId, classId);

        // Load existing attendance
        const existingAttendance = await getClassInstanceAttendance(currentbusinessId, classId);

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
 * Mark student attendance (Auto-save)
 */
async function markStudentAttendance(event, studentId, status) {
    // Prevent double clicks if already loading
    let btn = null;
    if (event && event.target) {
        btn = event.target.closest('button');
        if (btn && btn.classList.contains('btn-loading')) return;
    }

    // Add loading state to the button
    if (btn) {
        btn.classList.add('btn-loading');
    }

    try {
        if (!attendanceRecords[studentId]) {
            attendanceRecords[studentId] = { status: '', notes: '' };
        }

        let newStatus = status;
        // Toggle off if same status
        if (attendanceRecords[studentId].status === status) {
            newStatus = ''; // Unmark
        }

        const notes = attendanceRecords[studentId].notes || '';
        
        // Call server
        if (newStatus === '') {
             await markAttendance(currentLinkToken, selectedClassId, studentId, currentbusinessId, 'none', notes);
        } else {
             await markAttendance(currentLinkToken, selectedClassId, studentId, currentbusinessId, newStatus, notes);
        }

        // Update local state on success
        attendanceRecords[studentId].status = newStatus;
        
        updateStats();
        
        // Update UI for this student only
        updateStudentButtons(studentId, newStatus);

    } catch (error) {
        console.error('Error marking attendance:', error);
        showToast('שגיאה בשמירת הנוכחות', 'error');
    } finally {
        if (btn) {
            btn.classList.remove('btn-loading');
        }
    }
}

/**
 * Update buttons for a specific student without full re-render
 */
function updateStudentButtons(studentId, status) {
    const buttons = document.querySelectorAll(`button[onclick*="'${studentId}'"]`);
    buttons.forEach(btn => {
        // Reset active classes
        btn.classList.remove('active-present', 'active-absent', 'active-late', 'active-excused', 'active-other', 'active');
        
        // Check if this button corresponds to the new status
        if (btn.classList.contains('status-btn-small')) {
            if (btn.getAttribute('aria-label') === 'נוכח' && status === 'present') {
                btn.classList.add('active-present');
            } else if (btn.getAttribute('aria-label') === 'נעדר' && status === 'absent') {
                btn.classList.add('active-absent');
            } else if (btn.classList.contains('status-dropdown-toggle')) {
                if (status === 'late' || status === 'excused') {
                    btn.classList.add('active-other');
                }
            }
        } else if (btn.classList.contains('status-dropdown-item')) {
             // Dropdown items
             if (status === 'late' && btn.textContent.includes('איחור')) {
                 btn.classList.add('active-late');
             } else if (status === 'excused' && btn.textContent.includes('מאושר')) {
                 btn.classList.add('active-excused');
             }
        }
    });
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
        const hasOtherStatus = record.status === 'late' || record.status === 'excused';

        return `
            <div class="student-attendance-item">
                ${hasPhoto ? `
                    <img 
                        src="${student.photoUrl}" 
                        alt="${student.firstName}" 
                        class="student-photo"
                        onclick="window.openStudentDetails('${student.id}')"
                        style="cursor: pointer;"
                        onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                    >
                    <div class="student-avatar" style="background-color: ${avatarColor}; display: none; cursor: pointer;" onclick="window.openStudentDetails('${student.id}')">
                        ${initial}
                    </div>
                ` : `
                    <div class="student-avatar" style="background-color: ${avatarColor}; cursor: pointer;" onclick="window.openStudentDetails('${student.id}')">
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
                        onclick="window.markStudentAttendance(event, '${student.id}', 'present')"
                        aria-label="נוכח"
                    ><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></button>
                    <button 
                        class="status-btn-small ${record.status === 'absent' ? 'active-absent' : ''}"
                        onclick="window.markStudentAttendance(event, '${student.id}', 'absent')"
                        aria-label="נעדר"
                    ><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                    <div class="status-dropdown">
                        <button 
                            class="status-btn-small status-dropdown-toggle ${hasOtherStatus ? 'active-other' : ''}"
                            onclick="window.toggleStatusDropdown(event, '${student.id}')"
                            aria-label="אפשרויות נוספות"
                        ><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg></button>
                        <div class="status-dropdown-menu" id="dropdown-${student.id}">
                            <button 
                                class="status-dropdown-item ${record.status === 'late' ? 'active-late' : ''}"
                                onclick="window.markStudentAttendance(event, '${student.id}', 'late'); window.closeAllDropdowns();"
                            >
                                <span>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                </span>
                                <span>איחור</span>
                            </button>
                            <button 
                                class="status-dropdown-item ${record.status === 'excused' ? 'active-excused' : ''}"
                                onclick="window.markStudentAttendance(event, '${student.id}', 'excused'); window.closeAllDropdowns();"
                            >
                                <span>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                </span>
                                <span>מאושר</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Toggle status dropdown menu
 */
function toggleStatusDropdown(event, studentId) {
    event.stopPropagation();
    const dropdown = document.getElementById(`dropdown-${studentId}`);
    const allDropdowns = document.querySelectorAll('.status-dropdown-menu');
    
    // Close all other dropdowns
    allDropdowns.forEach(d => {
        if (d !== dropdown) {
            d.classList.remove('show');
        }
    });
    
    // Toggle current dropdown
    dropdown.classList.toggle('show');
}

/**
 * Close all dropdowns
 */
function closeAllDropdowns() {
    const allDropdowns = document.querySelectorAll('.status-dropdown-menu');
    allDropdowns.forEach(d => d.classList.remove('show'));
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

    showModal('studentModal');
}

/**
 * Show success animation
 */
function showSuccessAnimation(message = 'הנוכחות נשמרה!') {
    // Create overlay if not exists
    let overlay = document.getElementById('successOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'successOverlay';
        overlay.className = 'success-overlay';
        overlay.innerHTML = `
            <div class="success-content">
                <svg class="success-checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                    <circle class="success-checkmark__circle" cx="26" cy="26" r="25" fill="none"/>
                    <path class="success-checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                </svg>
                <div class="success-message"></div>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    // Update message
    overlay.querySelector('.success-message').textContent = message;

    // Show
    requestAnimationFrame(() => {
        overlay.classList.add('show');
    });

    // Hide after 2 seconds
    setTimeout(() => {
        overlay.classList.remove('show');
    }, 2000);
}

/**
 * Save attendance
 */
async function saveAttendance() {
    const saveBtn = document.getElementById('saveBtn');
    const originalContent = saveBtn.innerHTML;
    const studentsList = document.getElementById('studentsList');

    try {
        saveBtn.disabled = true;
        // Disable attendance buttons visually and functionally
        studentsList.classList.add('attendance-buttons-disabled');
        
        saveBtn.innerHTML = `
            <div class="btn-loading-content">
                <span>שומר</span>
                <div class="btn-dots">
                    <div class="btn-dot"></div>
                    <div class="btn-dot"></div>
                    <div class="btn-dot"></div>
                </div>
            </div>
        `;

        // Convert to array format
        const attendanceData = Object.entries(attendanceRecords)
            .filter(([_, data]) => data.status) // Only save marked students
            .map(([studentId, data]) => ({
                studentId,
                status: data.status,
                notes: data.notes || ''
            }));

        if (attendanceData.length === 0) {
            showToast('לא סומנו תלמידים', 'error');
            return;
        }

        // Mark attendance for each student using Cloud Function
        for (const data of attendanceData) {
            await markAttendance(
                currentLinkToken,
                selectedClassId,
                data.studentId,
                currentbusinessId,
                data.status,
                data.notes
            );
        }
        
        // Clear unsaved changes flag
        // hasUnsavedChanges = false;
        // updateSaveButtonState();
        
        // Clear local backup
        localStorage.removeItem(`attendance_backup_${selectedClassId}`);
        
        // Reload attendance to show saved data
        const existingAttendance = await getClassInstanceAttendance(currentbusinessId, selectedClassId);
        
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
        
        showSuccessAnimation();

    } catch (error) {
        console.error('Error saving attendance:', error);
        showToast('שגיאה בשמירת הנוכחות: ' + (error.message || error), 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalContent;
        // Re-enable attendance buttons
        studentsList.classList.remove('attendance-buttons-disabled');
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

document.getElementById('saveBtn')?.remove(); // Remove save button if exists or hide it
// Actually better to just remove the listener and hide the element in CSS or here
const saveBtn = document.getElementById('saveBtn');
if (saveBtn) saveBtn.style.display = 'none';

// Bulk Actions
document.getElementById('markAllPresentBtn')?.addEventListener('click', async () => {
    if (await showConfirm({ title: 'סימון נוכחות', message: 'האם לסמן את כל התלמידים כנוכחים?' })) {
        const btn = document.getElementById('markAllPresentBtn');
        const originalContent = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = 'מסמן...';

        try {
            const promises = enrolledStudents.map(student => {
                const currentNotes = attendanceRecords[student.id]?.notes || '';
                // Update local
                attendanceRecords[student.id] = { status: 'present', notes: currentNotes };
                // Call server
                return markAttendance(currentLinkToken, selectedClassId, student.id, currentbusinessId, 'present', currentNotes);
            });
            
            await Promise.all(promises);
            updateStats();
            renderStudentsList(); // Full re-render needed here
            showToast('כל התלמידים סומנו כנוכחים');
        } catch (error) {
            console.error(error);
            showToast('שגיאה בסימון', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }
    }
});

document.getElementById('clearAllBtn')?.addEventListener('click', async () => {
    if (await showConfirm({ title: 'ניקוי סימונים', message: 'האם לנקות את כל הסימונים?' })) {
        const btn = document.getElementById('clearAllBtn');
        const originalContent = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = 'מנקה...';

        try {
            const promises = enrolledStudents.map(student => {
                if (attendanceRecords[student.id]?.status) {
                    const currentNotes = attendanceRecords[student.id]?.notes || '';
                    attendanceRecords[student.id] = { status: '', notes: currentNotes };
                    return markAttendance(currentLinkToken, selectedClassId, student.id, currentbusinessId, 'none', currentNotes);
                }
                return Promise.resolve();
            });
            
            await Promise.all(promises);
            attendanceRecords = {}; // Reset local state completely? Or keep notes? 
            // If we want to keep notes but clear status, we should iterate.
            // The code above iterates.
            // But attendanceRecords = {} clears everything including notes.
            // Let's re-initialize attendanceRecords based on enrolledStudents but empty status
            enrolledStudents.forEach(s => {
                // If we want to keep notes, we should have saved them in the loop above.
                // But 'none' status usually means delete record?
                // If 'none' deletes the record, notes are lost too.
                // So attendanceRecords = {} is correct if 'none' deletes.
            });
            attendanceRecords = {};

            updateStats();
            renderStudentsList();
            showToast('כל הסימונים נוקו');
        } catch (error) {
            console.error(error);
            showToast('שגיאה בניקוי', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }
    }
});

// Modal handlers
document.getElementById('modalClose')?.addEventListener('click', () => {
    closeModal();
});

document.querySelectorAll('.status-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        const status = btn.dataset.status;
        if (currentModalStudentId) {
            // Visual feedback
            btn.style.transform = 'scale(0.95)';
            setTimeout(() => { btn.style.transform = ''; }, 100);
            
            // Add loading state
            btn.classList.add('btn-loading');
            
            try {
                // Update notes from textarea first
                const notes = document.getElementById('modalNotes').value;
                if (!attendanceRecords[currentModalStudentId]) {
                    attendanceRecords[currentModalStudentId] = { status: '', notes: '' };
                }
                attendanceRecords[currentModalStudentId].notes = notes;

                let newStatus = status;
                if (attendanceRecords[currentModalStudentId].status === status) {
                    newStatus = '';
                }

                if (newStatus === '') {
                    await markAttendance(currentLinkToken, selectedClassId, currentModalStudentId, currentbusinessId, 'none', notes);
                } else {
                    await markAttendance(currentLinkToken, selectedClassId, currentModalStudentId, currentbusinessId, newStatus, notes);
                }

                attendanceRecords[currentModalStudentId].status = newStatus;
                updateStats();
                
                // Update modal buttons
                document.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active'));
                if (newStatus === status) { // If we didn't toggle off
                    btn.classList.add('active');
                }
                
                // Update list buttons
                updateStudentButtons(currentModalStudentId, newStatus);

            } catch (error) {
                console.error(error);
                showToast('שגיאה', 'error');
            } finally {
                btn.classList.remove('btn-loading');
            }
        }
    });
});

document.getElementById('modalNotes')?.addEventListener('change', () => {
    // Just update local state, save happens on button click
    if (currentModalStudentId && attendanceRecords[currentModalStudentId]) {
        attendanceRecords[currentModalStudentId].notes = 
            document.getElementById('modalNotes').value;
    }
});

document.getElementById('saveStudentModalBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('saveStudentModalBtn');
    const notes = document.getElementById('modalNotes').value;
    
    if (currentModalStudentId) {
        btn.disabled = true;
        const originalText = btn.textContent;
        btn.textContent = 'שומר...';
        
        try {
            if (!attendanceRecords[currentModalStudentId]) {
                attendanceRecords[currentModalStudentId] = { status: '', notes: '' };
            }
            
            const status = attendanceRecords[currentModalStudentId].status || '';
            
            // Save to server
            if (status === '') {
                 await markAttendance(currentLinkToken, selectedClassId, currentModalStudentId, currentbusinessId, 'none', notes);
            } else {
                 await markAttendance(currentLinkToken, selectedClassId, currentModalStudentId, currentbusinessId, status, notes);
            }
            
            attendanceRecords[currentModalStudentId].notes = notes;
            
            // Re-render list to show/hide notes badge
            renderStudentsList();
            
            closeModal();
        } catch (error) {
            console.error(error);
            showToast('שגיאה בשמירה', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }
});

// Auto-save on page unload (safety net)
// window.addEventListener('beforeunload', (e) => {
//     if (hasUnsavedChanges && Object.keys(attendanceRecords).length > 0) {
//         // Try to save before leaving
//         const attendanceData = Object.entries(attendanceRecords)
//             .filter(([_, data]) => data.status)
//             .map(([studentId, data]) => ({
//                 studentId,
//                 status: data.status,
//                 notes: data.notes || ''
//             }));
        
//         if (attendanceData.length > 0) {
//             // Show warning
//             e.preventDefault();
//             e.returnValue = '';
//         }
//     }
// });

// Temp Student Modal handlers
document.getElementById('addTempStudentBtn')?.addEventListener('click', () => {
    showModal('addTempStudentModal');
    document.getElementById('tempStudentForm').reset();
});

document.getElementById('tempModalClose')?.addEventListener('click', () => {
    closeModal();
});

document.getElementById('tempCancelBtn')?.addEventListener('click', () => {
    closeModal();
});

document.getElementById('tempStudentForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('tempStudentName').value.trim();
    const phone = document.getElementById('tempStudentPhone').value.trim();
    const notes = document.getElementById('tempStudentNotes').value.trim();
    
    if (!name || !phone) {
        showToast('נא למלא שם וטלפון', 'error');
        return;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalContent = submitBtn.innerHTML;

    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
            <div class="btn-loading-content">
                <span>מוסיף</span>
                <div class="btn-dots">
                    <div class="btn-dot"></div>
                    <div class="btn-dot"></div>
                    <div class="btn-dot"></div>
                </div>
            </div>
        `;
        
        // Check for duplicate phone number
        const { checkDuplicatePhoneForTempStudent } = await import('../../services/temp-students-service.js');
        const duplicateCheck = await checkDuplicatePhoneForTempStudent(currentbusinessId, phone);
        
        if (duplicateCheck.exists) {
            const studentType = duplicateCheck.isTemp ? 'תלמיד זמני' : 'תלמיד קבוע';
            showToast(`מספר טלפון זה כבר קיים במערכת:\n${studentType}: ${duplicateCheck.studentName}`, 'error');
            return;
        }
        
        // Import and call create temp student function
        const { createTempStudent } = await import('../../services/teacher-service.js');
        
        const result = await createTempStudent(currentLinkToken, {
            name,
            phone,
            notes,
            classId: selectedClassId,
            businessId: currentbusinessId
        });
        
        // Close modal
        closeModal();
        
        // Reload enrolled students to include new temp student
        enrolledStudents = await getInstanceEnrolledStudents(currentbusinessId, selectedClassId);
        
        // Mark as present automatically
        if (result && result.studentId) {
            attendanceRecords[result.studentId] = { status: 'present', notes: notes };
            // Auto-save the attendance for the new student
            await markAttendance(currentLinkToken, selectedClassId, result.studentId, currentbusinessId, 'present', notes);
        }

        // Re-render the students list
        renderStudentsList();
        
        // Show success animation
        showSuccessAnimation('תלמיד זמני נוסף בהצלחה!');
        
    } catch (error) {
        console.error('Error adding temp student:', error);
        showToast('שגיאה בהוספת תלמיד זמני: ' + error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalContent;
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
window.toggleStatusDropdown = toggleStatusDropdown;
window.closeAllDropdowns = closeAllDropdowns;
