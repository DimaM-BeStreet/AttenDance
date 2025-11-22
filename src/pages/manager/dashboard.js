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
import { calculateClassAttendanceStats } from '../../services/attendance-service.js';
import { getTempStudentsByBusiness, convertTempStudentToStudent, deleteTempStudent } from '../../services/temp-students-service.js';
import { getAllCourses } from '../../services/course-service.js';
import { auth, db } from '../../config/firebase-config.js';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';

// Global state
let currentBusinessId = null;

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

            const businessId = userData.businessId;
            currentBusinessId = businessId;
            
            // Initialize navbar
            createNavbar();

            // Load business info
            await loadBusinessInfo(businessId);

            // Load dashboard data
            await Promise.all([
                loadStats(businessId),
                loadTodaysClasses(businessId),
                loadUpcomingBirthdays(businessId),
                loadTempStudents(businessId)
            ]);

            // Setup event listeners
            setupEventListeners(businessId);

        } catch (error) {
            console.error('Error initializing dashboard:', error);
            alert('שגיאה בטעינת לוח הבקרה');
        }
    });
});

/**
 * Load business information
 */
async function loadBusinessInfo(businessId) {
    try {
        const businessDoc = await getDoc(doc(db, 'businesses', businessId));
        if (businessDoc.exists()) {
            const business = businessDoc.data();
            document.getElementById('businessName').textContent = business.name;
            document.title = `לוח בקרה - ${business.name}`;
        }
    } catch (error) {
        console.error('Error loading business info:', error);
    }
}

/**
 * Load dashboard statistics
 */
async function loadStats(businessId) {
    try {
        // Load students count
        const students = await getAllStudents(businessId);
        const activeStudents = students.filter(s => s.isActive);
        document.getElementById('studentsCount').textContent = activeStudents.length;

        // Load teachers count
        const teachers = await getAllTeachers(businessId);
        const activeTeachers = teachers.filter(t => t.active);
        document.getElementById('teachersCount').textContent = activeTeachers.length;

        // Load today's classes count
        const todayClasses = await getTodayClassInstances(businessId);
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
async function loadTodaysClasses(businessId) {
    const container = document.getElementById('todaysClassesContainer');
    
    try {
        const classes = await getTodayClassInstances(businessId);

        if (classes.length === 0) {
            container.innerHTML = '<div class="empty-state">אין שיעורים היום</div>';
            return;
        }

        // Enrich with teacher names
        const teachers = await getAllTeachers(businessId);
        const teacherMap = new Map(teachers.map(t => [t.id, t]));
        
        classes.forEach(cls => {
            if (cls.teacherId) {
                const teacher = teacherMap.get(cls.teacherId);
                if (teacher) {
                    cls.teacherName = `${teacher.firstName} ${teacher.lastName}`;
                }
            }
        });

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
 * Load upcoming birthdays
 */
async function loadUpcomingBirthdays(businessId) {
    const container = document.getElementById('birthdaysContainer');
    
    try {
        const students = await getAllStudents(businessId);
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
async function loadTempStudents(businessId) {
    const container = document.getElementById('tempStudentsContainer');
    const section = document.getElementById('tempStudentsSection');
    const countBadge = document.getElementById('tempStudentsCount');

    try {
        const tempStudents = await getTempStudentsByBusiness(businessId);
        
        if (tempStudents.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        countBadge.textContent = tempStudents.length;

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
                        await loadTempStudents(businessId);
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
async function openConvertModal(tempStudentId, name, phone) {
    document.getElementById('tempStudentId').value = tempStudentId;
    document.getElementById('convertName').value = name;
    document.getElementById('convertPhone').value = phone;
    document.getElementById('convertEmail').value = '';
    document.getElementById('convertBirthDate').value = '';
    
    // Load courses for selection
    await loadCoursesForConversion();
    
    const modal = document.getElementById('convertTempStudentModal');
    modal.style.display = 'flex';
    // Trigger reflow to ensure the display change is applied before adding the class
    modal.offsetHeight;
    modal.classList.add('show');
}

/**
 * Load courses for conversion modal
 */
async function loadCoursesForConversion() {
    const container = document.getElementById('convertCoursesContainer');
    
    try {
        if (!currentBusinessId) {
            container.innerHTML = '<p class="empty-state">לא נמצא מזהה עסק</p>';
            return;
        }
        
        const courses = await getAllCourses(currentBusinessId, { activeOnly: true });
        
        if (courses.length === 0) {
            container.innerHTML = '<p class="empty-state">אין קורסים זמינים</p>';
            return;
        }
        
        container.innerHTML = courses.map(course => `
            <div class="course-selection-item" data-course-id="${course.id}">
                <div class="course-info">
                    <div class="course-name">${course.name}</div>
                    <div class="course-details">
                        <span class="course-price">${course.price ? course.price + ' ₪' : 'ללא עלות'}</span>
                        ${course.duration ? `<span class="course-duration">• ${course.duration} חודשים</span>` : ''}
                    </div>
                </div>
                <label class="course-checkbox">
                    <input type="checkbox" name="selectedCourses" value="${course.id}">
                    <span class="checkmark"></span>
                </label>
            </div>
        `).join('');
        
        // Add click handlers to course items to toggle checkbox
        container.querySelectorAll('.course-selection-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // Don't toggle if clicking directly on the checkbox (it handles itself)
                if (e.target.type === 'checkbox') return;
                
                const checkbox = item.querySelector('input[type="checkbox"]');
                checkbox.checked = !checkbox.checked;
            });
        });
        
    } catch (error) {
        console.error('Error loading courses:', error);
        container.innerHTML = '<p class="empty-state">שגיאה בטעינת קורסים</p>';
    }
}

/**
 * Close convert temp student modal
 */
function closeConvertModal() {
    const modal = document.getElementById('convertTempStudentModal');
    modal.classList.remove('show');
    
    // Wait for animation to complete before hiding
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
}

/**
 * Setup event listeners
 */
function setupEventListeners(businessId) {
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
        
        // Get selected courses
        const selectedCourses = Array.from(
            document.querySelectorAll('input[name="selectedCourses"]:checked')
        ).map(checkbox => checkbox.value);

        try {
            // Split name into first and last
            const nameParts = name.trim().split(' ');
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(' ') || '';

            const additionalData = {
                firstName,
                lastName,
                phone,
                isActive: true
            };
            
            // Only add email and birthDate if they have values
            if (email && email.trim()) {
                additionalData.email = email.trim();
            }
            if (birthDate && birthDate.trim()) {
                // Validate and convert dd/mm/yyyy format
                const datePattern = /^(\d{2})\/(\d{2})\/(\d{4})$/;
                const match = birthDate.trim().match(datePattern);
                
                if (match) {
                    const [, day, month, year] = match;
                    // Convert to ISO format (yyyy-mm-dd) for Firestore
                    additionalData.birthDate = `${year}-${month}-${day}`;
                } else {
                    alert('תאריך לידה חייב להיות בפורמט dd/mm/yyyy');
                    return;
                }
            }

            // Convert temp student to permanent student
            const studentId = await convertTempStudentToStudent(tempStudentId, additionalData);
            
            // Enroll in selected courses
            if (selectedCourses.length > 0) {
                const { enrollStudentInCourse } = await import('../../services/enrollment-service.js');
                for (const courseId of selectedCourses) {
                    await enrollStudentInCourse(currentBusinessId, courseId, studentId);
                }
            }
            
            closeConvertModal();
            alert('התלמיד הומר בהצלחה לתלמיד קבוע!' + 
                  (selectedCourses.length > 0 ? ` נרשם ל-${selectedCourses.length} קורסים.` : ''));
            
            // Reload temp students list
            await loadTempStudents(currentBusinessId);
            
            // Reload stats to update student count
            await loadStats(currentBusinessId);

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
