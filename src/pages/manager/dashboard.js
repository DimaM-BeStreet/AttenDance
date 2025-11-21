/**
 * Manager Dashboard
 * Mobile-first dashboard with stats, quick actions, and recent activity
 */

import './dashboard-styles.js';
import { createNavbar } from '../../components/navbar.js';
import { showModal, closeModal } from '../../components/modal.js';
import { getAllStudents } from '../../services/student-service.js';
import { getAllTeachers } from '../../services/teacher-service.js';
import { getClassInstances, getTodayClassInstances } from '../../services/class-instance-service.js';
import { getRecentAttendance, calculateClassAttendanceStats } from '../../services/attendance-service.js';
import { getTempStudentsByStudio, convertTempStudentToStudent, deleteTempStudent } from '../../services/temp-students-service.js';
import { auth, db } from '../../config/firebase-config.js';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = '/login.html';
            return;
        }

        try {
            // Verify role (superAdmin, admin, or teacher can access dashboard)
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            const userData = userDoc.data();
            
            if (!userData || !['superAdmin', 'admin', 'teacher'].includes(userData.role)) {
                alert('אין לך הרשאות לצפות בדף זה');
                window.location.href = '/';
                return;
            }

            const studioId = userData.businessId;
            
            // Initialize navbar
            createNavbar();

            // Load studio info
            await loadStudioInfo(studioId);

            // Load dashboard data
            await Promise.all([
                loadStats(studioId),
                loadTodaysClasses(studioId),
                loadRecentAttendance(studioId),
                loadUpcomingBirthdays(studioId),
                loadTempStudents(studioId)
            ]);

            // Setup event listeners
            setupEventListeners(studioId);

        } catch (error) {
            console.error('Error initializing dashboard:', error);
            alert('שגיאה בטעינת לוח הבקרה');
        }
    });
});

/**
 * Load studio information
 */
async function loadStudioInfo(studioId) {
    try {
        const studioDoc = await getDoc(doc(db, 'studios', studioId));
        if (studioDoc.exists()) {
            const studio = studioDoc.data();
            document.getElementById('studioName').textContent = studio.name;
            document.title = `לוח בקרה - ${studio.name}`;
        }
    } catch (error) {
        console.error('Error loading studio info:', error);
    }
}

/**
 * Load dashboard statistics
 */
async function loadStats(studioId) {
    try {
        // Load students count
        const students = await getAllStudents(studioId);
        const activeStudents = students.filter(s => s.active);
        document.getElementById('studentsCount').textContent = activeStudents.length;

        // Load teachers count
        const teachers = await getAllTeachers(studioId);
        const activeTeachers = teachers.filter(t => t.active);
        document.getElementById('teachersCount').textContent = activeTeachers.length;

        // Load today's classes count
        const todayClasses = await getTodayClassInstances(studioId);
        document.getElementById('classesTodayCount').textContent = todayClasses.length;

        // Load attendance rate for current month (placeholder for now)
        // TODO: Implement monthly attendance calculation
        document.getElementById('attendanceRate').textContent = '85%';

    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

/**
 * Load today's classes
 */
async function loadTodaysClasses(studioId) {
    const container = document.getElementById('todaysClassesContainer');
    
    try {
        const classes = await getTodayClassInstances(studioId);

        if (classes.length === 0) {
            container.innerHTML = '<div class="empty-state">אין שיעורים היום</div>';
            return;
        }

        // Sort by start time (assuming HH:mm format)
        classes.sort((a, b) => a.startTime.localeCompare(b.startTime));

        // Render classes
        container.innerHTML = classes.map(cls => `
            <div class="class-item ${cls.status === 'cancelled' ? 'class-cancelled' : ''}">
                <div class="class-time">
                    ${cls.startTime} - ${calculateEndTime(cls.startTime, cls.duration)}
                </div>
                <div class="class-info">
                    <div class="class-name">${cls.name || ''}</div>
                    <div class="class-teacher">${cls.teacherName || 'לא משויך'}</div>
                </div>
                <div class="class-actions">
                    ${cls.status === 'scheduled' ? `
                        <button class="btn btn-sm btn-primary" data-class-id="${cls.id}" data-action="attendance">
                            נוכחות
                        </button>
                    ` : `
                        <span class="badge badge-danger">בוטל</span>
                    `}
                </div>
            </div>
        `).join('');

        // Add event listeners for attendance buttons
        container.querySelectorAll('[data-action="attendance"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const classId = btn.dataset.classId;
                window.location.href = `/manager/attendance.html?classId=${classId}`;
            });
        });

    } catch (error) {
        console.error('Error loading today\'s classes:', error);
        container.innerHTML = '<div class="error-state">שגיאה בטעינת שיעורים</div>';
    }
}

/**
 * Load recent attendance records
 */
async function loadRecentAttendance(studioId) {
    const container = document.getElementById('recentAttendanceContainer');
    
    try {
        const attendance = await getRecentAttendance(studioId, 5);

        if (attendance.length === 0) {
            container.innerHTML = '<div class="empty-state">אין נוכחות אחרונה</div>';
            return;
        }

        const recentAttendance = attendance;

        container.innerHTML = recentAttendance.map(record => {
            // Handle date - could be 'date', 'classDate', or Firestore Timestamp
            let dateStr = 'תאריך לא זמין';
            try {
                if (record.date) {
                    dateStr = formatDate(record.date.toDate ? record.date.toDate() : new Date(record.date));
                } else if (record.classDate) {
                    dateStr = formatDate(record.classDate.toDate ? record.classDate.toDate() : new Date(record.classDate));
                } else if (record.createdAt) {
                    dateStr = formatDate(record.createdAt.toDate ? record.createdAt.toDate() : new Date(record.createdAt));
                }
            } catch (e) {
                console.warn('Error formatting date for attendance record:', e);
            }

            return `
                <div class="attendance-item">
                    <div class="attendance-student">
                        ${record.studentName || 'תלמיד לא ידוע'}
                    </div>
                    <div class="attendance-class">
                        ${record.className || ''}
                    </div>
                    <div class="attendance-status">
                        <span class="badge badge-${getStatusBadgeClass(record.status)}">
                            ${getStatusLabel(record.status)}
                        </span>
                    </div>
                    <div class="attendance-date">
                        ${dateStr}
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading recent attendance:', error);
        container.innerHTML = '<div class="error-state">שגיאה בטעינת נוכחות</div>';
    }
}

/**
 * Load upcoming birthdays
 */
async function loadUpcomingBirthdays(studioId) {
    const container = document.getElementById('birthdaysContainer');
    
    try {
        const students = await getAllStudents(studioId);
        const today = new Date();
        const nextMonth = new Date();
        nextMonth.setDate(today.getDate() + 30);

        // Filter students with birthdays in next 30 days
        const upcomingBirthdays = students
            .filter(student => student.dateOfBirth)
            .map(student => {
                const birthday = student.dateOfBirth.toDate();
                const thisYearBirthday = new Date(
                    today.getFullYear(),
                    birthday.getMonth(),
                    birthday.getDate()
                );
                
                // If birthday already passed this year, check next year
                if (thisYearBirthday < today) {
                    thisYearBirthday.setFullYear(today.getFullYear() + 1);
                }

                return {
                    ...student,
                    nextBirthday: thisYearBirthday,
                    daysUntil: Math.ceil((thisYearBirthday - today) / (1000 * 60 * 60 * 24))
                };
            })
            .filter(student => student.daysUntil <= 30 && student.daysUntil >= 0)
            .sort((a, b) => a.daysUntil - b.daysUntil);

        if (upcomingBirthdays.length === 0) {
            container.innerHTML = '<div class="empty-state">אין ימי הולדת קרובים</div>';
            return;
        }

        container.innerHTML = upcomingBirthdays.map(student => `
            <div class="birthday-item">
                <div class="birthday-icon">🎂</div>
                <div class="birthday-info">
                    <div class="birthday-name">${student.firstName} ${student.lastName}</div>
                    <div class="birthday-date">
                        ${student.daysUntil === 0 ? 'היום!' : `בעוד ${student.daysUntil} ימים`}
                    </div>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error loading birthdays:', error);
        container.innerHTML = '<div class="error-state">שגיאה בטעינת ימי הולדת</div>';
    }
}

/**
 * Load temp students
 */
async function loadTempStudents(studioId) {
    const container = document.getElementById('tempStudentsContainer');
    const section = document.getElementById('tempStudentsSection');
    const countBadge = document.getElementById('tempStudentsCount');

    try {
        console.log('Loading temp students for studio:', studioId);
        const tempStudents = await getTempStudentsByStudio(studioId);
        console.log('Temp students loaded:', tempStudents.length);
        
        if (tempStudents.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        countBadge.textContent = tempStudents.length;

        // Load courses for the convert modal
        const coursesSnapshot = await getDocs(query(collection(db, `studios/${studioId}/courses`), where('active', '==', true)));
        const courses = coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const courseSelect = document.getElementById('convertCourseId');
        courseSelect.innerHTML = '<option value="">בחר קורס (אופציונלי)</option>' + 
            courses.map(course => `<option value="${course.id}">${course.name}</option>`).join('');

        container.innerHTML = tempStudents.map(student => {
            const createdDate = student.createdAt?.toDate ? student.createdAt.toDate() : new Date(student.createdAt);
            const daysAgo = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
            
            return `
                <div class="temp-student-item" data-id="${student.id}">
                    <div class="temp-student-info">
                        <div class="temp-student-name">${student.name}</div>
                        <div class="temp-student-details">
                            <span class="detail-item">📞 ${student.phone}</span>
                            ${student.notes ? `<span class="detail-item">📝 ${student.notes}</span>` : ''}
                            <span class="detail-item">📅 נוסף לפני ${daysAgo} ימים</span>
                        </div>
                    </div>
                    <div class="temp-student-actions">
                        <button class="btn btn-primary btn-sm convert-temp-student-btn" data-id="${student.id}" data-name="${student.name}" data-phone="${student.phone}">
                            המר לתלמיד קבוע
                        </button>
                        <button class="btn btn-secondary btn-sm delete-temp-student-btn" data-id="${student.id}">
                            מחק
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Add event listeners to convert buttons
        document.querySelectorAll('.convert-temp-student-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const name = btn.dataset.name;
                const phone = btn.dataset.phone;
                openConvertModal(id, name, phone);
            });
        });

        // Add event listeners to delete buttons
        document.querySelectorAll('.delete-temp-student-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (confirm('האם אתה בטוח שברצונך למחוק תלמיד זמני זה?')) {
                    try {
                        await deleteTempStudent(btn.dataset.id);
                        await loadTempStudents(studioId);
                    } catch (error) {
                        console.error('Error deleting temp student:', error);
                        alert('שגיאה במחיקת התלמיד הזמני');
                    }
                }
            });
        });

    } catch (error) {
        console.error('Error loading temp students:', error);
        console.error('Error details:', error.message);
        // Show error message if it's a Firestore index issue
        if (error.message && error.message.includes('index')) {
            console.error('⚠️ Firestore index required. Check console for link to create index.');
            container.innerHTML = '<div class="error-state">נדרש אינדקס בבסיס הנתונים. בדוק את הקונסול.</div>';
            section.style.display = 'block';
        } else {
            section.style.display = 'none';
        }
    }
}

/**
 * Open convert temp student modal
 */
function openConvertModal(tempStudentId, name, phone) {
    document.getElementById('tempStudentId').value = tempStudentId;
    document.getElementById('convertName').value = name;
    document.getElementById('convertPhone').value = phone;
    document.getElementById('convertEmail').value = '';
    document.getElementById('convertBirthDate').value = '';
    document.getElementById('convertCourseId').value = '';
    document.getElementById('convertTempStudentModal').style.display = 'flex';
}

/**
 * Close convert temp student modal
 */
function closeConvertModal() {
    document.getElementById('convertTempStudentModal').style.display = 'none';
}

/**
 * Setup event listeners
 */
function setupEventListeners(studioId) {
    // Quick add button
    document.getElementById('quickAddBtn').addEventListener('click', () => {
        const modalContent = document.getElementById('quickAddModal');
        showModal('quickAddModal', modalContent);
    });

    // Quick add options
    document.querySelectorAll('.quick-add-option').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            closeModal('quickAddModal');
            
            switch (action) {
                case 'student':
                    window.location.href = '/manager/students.html?action=add';
                    break;
                case 'teacher':
                    window.location.href = '/manager/teachers.html?action=add';
                    break;
                case 'class':
                    window.location.href = '/manager/classes.html?action=add';
                    break;
                case 'course':
                    window.location.href = '/manager/courses.html?action=add';
                    break;
            }
        });
    });

    // Quick action cards
    document.getElementById('addStudentBtn').addEventListener('click', () => {
        window.location.href = '/manager/students.html?action=add';
    });

    document.getElementById('addTeacherBtn').addEventListener('click', () => {
        window.location.href = '/manager/teachers.html?action=add';
    });

    document.getElementById('addClassBtn').addEventListener('click', () => {
        window.location.href = '/manager/classes.html?action=add';
    });

    document.getElementById('viewReportsBtn').addEventListener('click', () => {
        window.location.href = '/manager/reports.html';
    });

    // View all buttons
    document.getElementById('viewAllClassesBtn').addEventListener('click', () => {
        window.location.href = '/manager/classes.html';
    });

    document.getElementById('viewAllAttendanceBtn').addEventListener('click', () => {
        window.location.href = '/manager/attendance.html';
    });

    // Stat cards - navigate to relevant pages
    document.querySelector('[data-stat="students"]').addEventListener('click', () => {
        window.location.href = '/manager/students.html';
    });

    document.querySelector('[data-stat="teachers"]').addEventListener('click', () => {
        window.location.href = '/manager/teachers.html';
    });

    document.querySelector('[data-stat="classes"]').addEventListener('click', () => {
        window.location.href = '/manager/classes.html';
    });

    document.querySelector('[data-stat="attendance"]').addEventListener('click', () => {
        window.location.href = '/manager/attendance.html';
    });

    // Convert temp student modal events
    document.getElementById('closeConvertModal')?.addEventListener('click', closeConvertModal);
    document.getElementById('cancelConvertBtn')?.addEventListener('click', closeConvertModal);

    document.getElementById('convertTempStudentForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const tempStudentId = document.getElementById('tempStudentId').value;
        const name = document.getElementById('convertName').value;
        const phone = document.getElementById('convertPhone').value;
        const email = document.getElementById('convertEmail').value;
        const birthDate = document.getElementById('convertBirthDate').value;
        const courseId = document.getElementById('convertCourseId').value;

        try {
            // Split name into first and last
            const nameParts = name.trim().split(' ');
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(' ') || '';

            const additionalData = {
                firstName,
                lastName,
                phone,
                email: email || undefined,
                birthDate: birthDate || undefined
            };

            await convertTempStudentToStudent(tempStudentId, additionalData, courseId || undefined);
            
            closeConvertModal();
            alert('התלמיד הומר בהצלחה לתלמיד קבוע!');
            
            // Reload temp students list
            await loadTempStudents(studioId);
            
            // Reload stats to update student count
            await loadStats(studioId);

        } catch (error) {
            console.error('Error converting temp student:', error);
            alert('שגיאה בהמרת התלמיד: ' + error.message);
        }
    });
}

/**
 * Helper functions
 */
function formatTime(date) {
    return date.toLocaleTimeString('he-IL', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

function calculateEndTime(startTime, duration) {
    if (!startTime || !duration) return '';
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + duration;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
}

function formatDate(date) {
    return date.toLocaleDateString('he-IL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function getStatusLabel(status) {
    const labels = {
        present: 'נוכח',
        absent: 'נעדר',
        late: 'איחור',
        excused: 'מוצדק'
    };
    return labels[status] || status;
}

function getStatusBadgeClass(status) {
    const classes = {
        present: 'success',
        absent: 'danger',
        late: 'warning',
        excused: 'info'
    };
    return classes[status] || 'secondary';
}
