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
import { auth, db } from '../../config/firebase-config.js';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = '/login.html';
            return;
        }

        try {
            // Verify manager role
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            const userData = userDoc.data();
            
            if (!userData || userData.role !== 'manager') {
                alert('אין לך הרשאות לצפות בדף זה');
                window.location.href = '/';
                return;
            }

            const studioId = userData.studioId;
            
            // Initialize navbar
            const navbarContainer = document.getElementById('navbar');
            const navbar = createNavbar(userData.role, userData);
            navbarContainer.appendChild(navbar);

            // Load studio info
            await loadStudioInfo(studioId);

            // Load dashboard data
            await Promise.all([
                loadStats(studioId),
                loadTodaysClasses(studioId),
                loadRecentAttendance(studioId),
                loadUpcomingBirthdays(studioId)
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
        const activeStudents = students.filter(s => s.status === 'active');
        document.getElementById('studentsCount').textContent = activeStudents.length;

        // Load teachers count
        const teachers = await getAllTeachers(studioId);
        const activeTeachers = teachers.filter(t => t.isActive);
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

        // Sort by start time
        classes.sort((a, b) => a.startTime.toDate() - b.startTime.toDate());

        // Render classes
        container.innerHTML = classes.map(cls => `
            <div class="class-item ${cls.status === 'cancelled' ? 'class-cancelled' : ''}">
                <div class="class-time">
                    ${formatTime(cls.startTime.toDate())} - ${formatTime(cls.endTime.toDate())}
                </div>
                <div class="class-info">
                    <div class="class-name">${cls.name || cls.templateName}</div>
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

        container.innerHTML = recentAttendance.map(record => `
            <div class="attendance-item">
                <div class="attendance-student">
                    ${record.studentName}
                </div>
                <div class="attendance-class">
                    ${record.className}
                </div>
                <div class="attendance-status">
                    <span class="badge badge-${getStatusBadgeClass(record.status)}">
                        ${getStatusLabel(record.status)}
                    </span>
                </div>
                <div class="attendance-date">
                    ${formatDate(record.classDate.toDate())}
                </div>
            </div>
        `).join('');

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
