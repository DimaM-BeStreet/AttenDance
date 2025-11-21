/**
 * Classes Management Page
 * Mobile-first interface for class templates and instances
 */

import './classes-styles.js';
import { createNavbar } from '../../components/navbar.js';
import { showModal, closeModal } from '../../components/modal.js';
import { 
    getAllTeachers
} from '../../services/teacher-service.js';
import { getAllClassTemplates } from '../../services/class-template-service.js';
import { getAllLocations } from '../../services/location-service.js';
import {
    createClassInstance,
    updateClassInstance,
    getClassInstances,
    getTodayClassInstances,
    getWeekClassInstances,
    cancelClassInstance,
    getClassInstanceById
} from '../../services/class-instance-service.js';
import { auth, db } from '../../config/firebase-config.js';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

// State
let currentStudioId = null;
let currentUser = null;
let currentView = 'calendar';
let currentWeekStart = null;
let teachers = [];
let locations = [];
let classInstances = [];
let classTemplates = [];
let currentEditingId = null;
let currentEditingType = null; // 'instance' or 'template'

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
                alert('אין לך הרשאות לצפות בדף זה');
                window.location.href = '/';
                return;
            }

            currentUser = userData;
            currentStudioId = userData.businessId;
            
            // Initialize navbar
            createNavbar();

            // Load teachers for dropdowns
            teachers = await getAllTeachers(currentStudioId);
            populateTeacherDropdowns();

            // Load locations
            locations = await getAllLocations(currentStudioId, { isActive: true });

            // Initialize current week to today
            currentWeekStart = getWeekStart(new Date());

            // Load data and render
            await loadAllData();
            renderCurrentView();

            // Setup event listeners
            setupEventListeners();

        } catch (error) {
            console.error('Error initializing page:', error);
            alert('שגיאה בטעינת הדף');
        }
    });
});

/**
 * Load all data
 */
async function loadAllData() {
    try {
        [classInstances, classTemplates] = await Promise.all([
            getClassInstances(currentStudioId),
            getAllClassTemplates(currentStudioId)
        ]);
        
        // Enrich instances with teacher names
        await enrichInstancesWithTeacherNames();
        
        updateCounts();
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

/**
 * Enrich class instances with teacher names and location names
 */
async function enrichInstancesWithTeacherNames() {
    for (const instance of classInstances) {
        if (instance.teacherId) {
            const teacher = teachers.find(t => t.id === instance.teacherId);
            if (teacher) {
                instance.teacherName = `${teacher.firstName} ${teacher.lastName}`;
            }
        }
        if (instance.locationId) {
            const location = locations.find(l => l.id === instance.locationId);
            if (location) {
                instance.locationName = location.name;
            }
        }
    }
}

/**
 * Get location name by ID
 */
function getLocationName(locationId) {
    if (!locationId) return '';
    const location = locations.find(l => l.id === locationId);
    return location ? location.name : '';
}

/**
 * Update counts
 */
function updateCounts() {
    document.getElementById('classesCount').textContent = 
        `${classInstances.length} שיעורים`;
    
    document.getElementById('countAll').textContent = classInstances.length;
    document.getElementById('countScheduled').textContent = 
        classInstances.filter(c => c.status === 'scheduled').length;
    document.getElementById('countCompleted').textContent = 
        classInstances.filter(c => c.status === 'completed').length;
    document.getElementById('countCancelled').textContent = 
        classInstances.filter(c => c.status === 'cancelled').length;
}

/**
 * Populate teacher dropdowns
 */
function populateTeacherDropdowns() {
    const activeTeachers = teachers.filter(t => t.active);
    const options = activeTeachers.map(t => 
        `<option value="${t.id}">${t.firstName} ${t.lastName}</option>`
    ).join('');

    document.getElementById('instanceTeacher').innerHTML = 
        '<option value="">בחר מורה...</option>' + options;
}

/**
 * Render current view
 */
function renderCurrentView() {
    switch (currentView) {
        case 'calendar':
            renderCalendarView();
            break;
        case 'list':
            renderListView();
            break;
    }
}

/**
 * Render calendar view
 */
function renderCalendarView() {
    const grid = document.getElementById('calendarGrid');
    
    // Update week display
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    document.getElementById('weekDates').textContent = 
        `${formatDate(currentWeekStart)} - ${formatDate(weekEnd)}`;

    // Get classes for the week
    const weekClasses = classInstances.filter(cls => {
        const classDate = cls.date.toDate();
        return classDate >= currentWeekStart && classDate <= weekEnd;
    });

    // Create grid for 7 days
    const days = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(currentWeekStart);
        date.setDate(date.getDate() + i);
        days.push(date);
    }

    grid.innerHTML = days.map(date => {
        const dayClasses = weekClasses.filter(cls => {
            const classDate = cls.date.toDate();
            return classDate.toDateString() === date.toDateString();
        }).sort((a, b) => a.startTime.localeCompare(b.startTime));

        const isToday = date.toDateString() === new Date().toDateString();
        const dayName = date.toLocaleDateString('he-IL', { weekday: 'long' });
        const dayDate = date.getDate();

        return `
            <div class="calendar-day ${isToday ? 'calendar-day-today' : ''}">
                <div class="day-header">
                    <div class="day-name">${dayName}</div>
                    <div class="day-date">${dayDate}</div>
                </div>
                <div class="day-classes">
                    ${dayClasses.length > 0 ? dayClasses.map(cls => `
                        <div class="class-card class-${cls.status}" data-class-id="${cls.id}">
                            <div class="class-time">
                                ${cls.startTime}
                            </div>
                            <div class="class-name">${cls.name || ''}</div>
                            <div class="class-teacher">${cls.teacherName || ''}</div>
                        </div>
                    `).join('') : '<div class="no-classes">אין שיעורים</div>'}
                </div>
            </div>
        `;
    }).join('');

    // Add click handlers
    grid.querySelectorAll('.class-card').forEach(card => {
        card.addEventListener('click', () => {
            viewClassDetails(card.dataset.classId);
        });
    });
}

/**
 * Render list view
 */
function renderListView() {
    const container = document.getElementById('classesListContainer');
    
    if (classInstances.length === 0) {
        container.innerHTML = '<div class="empty-state">אין שיעורים</div>';
        return;
    }

    // Sort by date descending
    const sortedClasses = [...classInstances].sort((a, b) => 
        b.date.toDate() - a.date.toDate()
    );

    container.innerHTML = sortedClasses.map(cls => `
        <div class="class-list-item" data-class-id="${cls.id}">
            <div class="class-list-date">
                <div class="date-day">${formatDate(cls.date.toDate())}</div>
                <div class="date-time">${cls.startTime}</div>
            </div>
            <div class="class-list-info">
                <div class="class-list-name">${cls.name || ''}</div>
                <div class="class-list-teacher">${cls.teacherName || 'ללא מורה'}</div>
                ${cls.locationName ? `<div class="class-list-location">📍 ${cls.locationName}</div>` : ''}
            </div>
            <div class="class-list-status">
                <span class="badge badge-${getStatusBadgeClass(cls.status)}">
                    ${getStatusLabel(cls.status)}
                </span>
            </div>
        </div>
    `).join('');

    // Add click handlers
    container.querySelectorAll('.class-list-item').forEach(item => {
        item.addEventListener('click', () => {
            viewClassDetails(item.dataset.classId);
        });
    });
}

/**
 * View class details
 */
async function viewClassDetails(classId) {
    try {
        const classInstance = await getClassInstanceById(currentStudioId, classId);
        if (!classInstance) {
            alert('שיעור לא נמצא');
            return;
        }

        currentEditingId = classId;
        currentEditingType = 'instance';

        document.getElementById('detailsClassName').textContent = classInstance.name || '';
        
        const content = document.getElementById('classDetailsContent');
        content.innerHTML = `
            <div class="detail-item">
                <span class="detail-label">תאריך:</span>
                <span class="detail-value">${formatDate(classInstance.date.toDate())}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">שעה:</span>
                <span class="detail-value">${classInstance.startTime} - ${calculateEndTime(classInstance.startTime, classInstance.duration)}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">מורה:</span>
                <span class="detail-value">${classInstance.teacherName || 'ללא מורה'}</span>
            </div>
            ${classInstance.locationId ? `
                <div class="detail-item">
                    <span class="detail-label">מיקום:</span>
                    <span class="detail-value">${getLocationName(classInstance.locationId)}</span>
                </div>
            ` : ''}
            <div class="detail-item">
                <span class="detail-label">סטטוס:</span>
                <span class="badge badge-${getStatusBadgeClass(classInstance.status)}">
                    ${getStatusLabel(classInstance.status)}
                </span>
            </div>
            ${classInstance.notes ? `
                <div class="detail-item detail-item-full">
                    <span class="detail-label">הערות:</span>
                    <span class="detail-value">${classInstance.notes}</span>
                </div>
            ` : ''}
        `;

        // Show cancel button only for scheduled classes
        document.getElementById('cancelClassBtn').style.display = 
            classInstance.status === 'scheduled' ? 'block' : 'none';

        // Show view template button if class has a template
        document.getElementById('viewTemplateBtn').style.display = 
            classInstance.templateId ? 'block' : 'none';

        showModal('classDetailsModal', document.getElementById('classDetailsModal'));

    } catch (error) {
        console.error('Error loading class details:', error);
        alert('שגיאה בטעינת פרטי השיעור');
    }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // View toggle
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.toggle-btn').forEach(b => 
                b.classList.remove('toggle-active'));
            e.target.classList.add('toggle-active');
            
            currentView = e.target.dataset.view;
            
            // Show/hide views
            document.getElementById('calendarView').style.display = 
                currentView === 'calendar' ? 'block' : 'none';
            document.getElementById('listView').style.display = 
                currentView === 'list' ? 'block' : 'none';
            
            renderCurrentView();
        });
    });

    // Add class button
    document.getElementById('addClassBtn').addEventListener('click', () => {
        openAddInstanceModal();
    });

    // Week navigation
    document.getElementById('prevWeekBtn').addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        renderCalendarView();
    });

    document.getElementById('nextWeekBtn').addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        renderCalendarView();
    });

    document.getElementById('todayBtn').addEventListener('click', () => {
        currentWeekStart = getWeekStart(new Date());
        renderCalendarView();
    });

    // Forms
    document.getElementById('classInstanceForm').addEventListener('submit', handleInstanceSubmit);

    // Details modal actions
    document.getElementById('markAttendanceBtn').addEventListener('click', () => {
        window.location.href = `/manager/attendance.html?classId=${currentEditingId}`;
    });

    document.getElementById('editClassBtn').addEventListener('click', () => {
        closeModal('classDetailsModal');
        editClassInstance(currentEditingId);
    });

    document.getElementById('viewTemplateBtn').addEventListener('click', () => {
        const classInstance = classInstances.find(c => c.id === currentEditingId);
        if (classInstance && classInstance.templateId) {
            window.location.href = `/manager/templates.html?templateId=${classInstance.templateId}`;
        }
    });

    document.getElementById('cancelClassBtn').addEventListener('click', handleCancelClass);
}

/**
 * Open add instance modal
 */
function openAddInstanceModal() {
    currentEditingId = null;
    currentEditingType = 'instance';
    
    document.getElementById('instanceModalTitle').textContent = 'שיעור חדש';
    document.getElementById('classInstanceForm').reset();
    
    // Set default date to today
    document.getElementById('instanceDate').valueAsDate = new Date();
    
    showModal('classInstanceModal', document.getElementById('classInstanceModal'));
}
/**
 * Edit class instance
 */
async function editClassInstance(instanceId) {
    try {
        const instance = await getClassInstanceById(currentStudioId, instanceId);
        if (!instance) {
            alert('שיעור לא נמצא');
            return;
        }

        currentEditingId = instanceId;
        currentEditingType = 'instance';

        document.getElementById('instanceModalTitle').textContent = 'עריכת שיעור';
        
        document.getElementById('instanceName').value = instance.name || '';
        document.getElementById('instanceTeacher').value = instance.teacherId || '';
        document.getElementById('instanceDate').valueAsDate = instance.date.toDate();
        document.getElementById('instanceStartTime').value = instance.startTime;
        document.getElementById('instanceDuration').value = instance.duration || 60;
        document.getElementById('instanceLocation').value = instance.location || '';
        document.getElementById('instanceNotes').value = instance.notes || '';

        showModal('classInstanceModal', document.getElementById('classInstanceModal'));

    } catch (error) {
        console.error('Error loading instance:', error);
        alert('שגיאה בטעינת השיעור');
    }
}

/**
 * Handle instance form submit
 */
async function handleInstanceSubmit(event) {
    event.preventDefault();

    const saveBtn = document.getElementById('saveInstanceBtn');
    const spinner = saveBtn.querySelector('.btn-spinner');
    
    saveBtn.disabled = true;
    spinner.style.display = 'inline-block';

    try {
        const date = new Date(document.getElementById('instanceDate').value);
        const startTimeValue = document.getElementById('instanceStartTime').value; // "HH:mm" format
        const duration = parseInt(document.getElementById('instanceDuration').value);

        const formData = {
            name: document.getElementById('instanceName').value.trim(),
            teacherId: document.getElementById('instanceTeacher').value,
            date: date, // Date object
            startTime: startTimeValue, // Keep as time string "HH:mm"
            duration: duration, // Duration in minutes
            location: document.getElementById('instanceLocation').value.trim(),
            notes: document.getElementById('instanceNotes').value.trim(),
            studentIds: [] // Initialize empty for manual instances
        };

        if (currentEditingId) {
            await updateClassInstance(currentStudioId, currentEditingId, formData);
        } else {
            await createClassInstance(currentStudioId, formData);
        }

        await loadAllData();
        renderCurrentView();
        closeModal('classInstanceModal');
        alert(currentEditingId ? 'השיעור עודכן בהצלחה' : 'השיעור נוסף בהצלחה');

    } catch (error) {
        console.error('Error saving instance:', error);
        alert('שגיאה בשמירת השיעור: ' + error.message);
    } finally {
        saveBtn.disabled = false;
        spinner.style.display = 'none';
    }
}

/**
 * Handle template form submit
 */
/**
 * Handle cancel class
 */
async function handleCancelClass() {
    if (!confirm('האם אתה בטוח שברצונך לבטל את השיעור?')) {
        return;
    }

    try {
        await cancelClassInstance(currentStudioId, currentEditingId);
        await loadAllData();
        renderCurrentView();
        closeModal('classDetailsModal');
        alert('השיעור בוטל בהצלחה');
    } catch (error) {
        console.error('Error cancelling class:', error);
        alert('שגיאה בביטול השיעור');
    }
}

/**
 * Helper functions
 */
function calculateEndTime(startTime, duration) {
    if (!startTime || !duration) return '';
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + duration;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
}

function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Start week on Sunday
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function formatDate(date) {
    return date.toLocaleDateString('he-IL', {
        day: '2-digit',
        month: '2-digit'
    });
}

function formatTime(date) {
    return date.toLocaleTimeString('he-IL', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

function formatTimeInput(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

function getDayName(dayIndex) {
    const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    return days[dayIndex];
}

function getStatusLabel(status) {
    const labels = {
        scheduled: 'מתוכנן',
        completed: 'הושלם',
        cancelled: 'בוטל'
    };
    return labels[status] || status;
}

function getStatusBadgeClass(status) {
    const classes = {
        scheduled: 'info',
        completed: 'success',
        cancelled: 'danger'
    };
    return classes[status] || 'secondary';
}

