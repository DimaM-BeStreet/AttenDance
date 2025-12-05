/**
 * Classes Management Page
 * Mobile-first interface for class templates and instances
 */

import './classes-styles.js';
import { createNavbar } from '../../components/navbar.js';
import { showModal, closeModal, showConfirm, showToast } from '../../components/modal.js';
import { 
    getAllTeachers
} from '../../services/teacher-service.js';
import { getAllClassTemplates } from '../../services/class-template-service.js';
import { getAllLocations } from '../../services/location-service.js';
import { getAllBranches } from '../../services/branch-service.js';
import {
    createClassInstance,
    updateClassInstance,
    getClassInstances,
    getTodayClassInstances,
    getWeekClassInstances,
    cancelClassInstance,
    getClassInstanceById
} from '../../services/class-instance-service.js';
import { getAllEnrichedCourses } from '../../services/course-service.js';
import { getCourseStudentIds } from '../../services/enrollment-service.js';
import { auth, db } from '../../config/firebase-config.js';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

// Helper functions for date formatting
function formatDateToDDMMYYYY(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function parseDDMMYYYYToDate(dateString) {
    const [day, month, year] = dateString.split('/');
    return new Date(year, month - 1, day);
}

// State
let currentBusinessId = null;
let currentUser = null;
let currentView = 'calendar';
let currentWeekStart = null;
let teachers = [];
let locations = [];
let branches = [];
let courses = [];
let classInstances = [];
let classTemplates = [];
let currentEditingId = null;
let currentEditingType = null; // 'instance' or 'template'
// Pagination state
let instancesLastDoc = null;
let instancesHasMore = true;
let isLoadingMoreInstances = false;

// Search and Filter State
let searchQuery = '';
let statusFilter = 'all';

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
            
            if (!userData || !['superAdmin', 'admin', 'teacher', 'branchManager'].includes(userData.role)) {
                showToast('אין לך הרשאות לצפות בדף זה', 'error');
                window.location.href = '/';
                return;
            }

            currentUser = userData;
            currentBusinessId = userData.businessId;
            
            // Initialize navbar
            createNavbar();

            // Load teachers for dropdowns
            teachers = await getAllTeachers(currentBusinessId);
            populateTeacherDropdowns();
            populateTeacherFilter();

            // Load branches
            branches = await getAllBranches(currentBusinessId, { isActive: true });
            populateBranchFilter();

            // Load locations
            locations = await getAllLocations(currentBusinessId, { isActive: true });
            
            // Filter locations for Branch Manager
            if (userData.role === 'branchManager') {
                const allowedIds = userData.allowedBranchIds || [];
                locations = locations.filter(l => allowedIds.includes(l.branchId));
            }

            // Load courses
            courses = await getAllEnrichedCourses(currentBusinessId);

            // Initialize current week to today
            currentWeekStart = getWeekStart(new Date());

            // Load data and render
            await loadAllData();
            
            // Check URL params for actions and filters
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('action') === 'add') {
                openAddInstanceModal();
            }
            
            // Handle teacher filter from URL
            const teacherIdParam = urlParams.get('teacherId');
            if (teacherIdParam) {
                const teacherFilter = document.getElementById('teacherFilter');
                const teacherInput = document.getElementById('teacherFilterInput');
                if (teacherFilter && teacherInput) {
                    teacherFilter.value = teacherIdParam;
                    const teacher = teachers.find(t => t.id === teacherIdParam);
                    if (teacher) {
                        teacherInput.value = `${teacher.firstName} ${teacher.lastName}`;
                    }
                }
            }

            // Handle teacher role restriction
            if (userData.role === 'teacher') {
                const teacherFilter = document.getElementById('teacherFilter');
                const teacherInput = document.getElementById('teacherFilterInput');
                if (teacherFilter && teacherInput) {
                    teacherFilter.value = user.uid;
                    const teacher = teachers.find(t => t.id === user.uid);
                    if (teacher) {
                        teacherInput.value = `${teacher.firstName} ${teacher.lastName}`;
                    }
                    teacherInput.disabled = true;
                }
            }

            renderCurrentView();

            // Setup event listeners
            setupEventListeners();

        } catch (error) {
            console.error('Error initializing page:', error);
            showToast('שגיאה בטעינת הדף', 'error');
        }
    });
});

/**
 * Load all data with pagination
 */
async function loadAllData() {
    try {
        // Load first page of instances (30 items)
        const { getPaginatedClassInstances } = await import('../../services/class-instance-service.js');
        const instancesResult = await getPaginatedClassInstances(currentBusinessId, {
            limit: 30,
            sortOrder: 'asc'
        });
        
        classInstances = instancesResult.instances;
        instancesLastDoc = instancesResult.lastDoc;
        instancesHasMore = instancesResult.hasMore;
        
        classTemplates = await getAllClassTemplates(currentBusinessId);
        
        // Enrich instances with teacher names
        await enrichInstancesWithTeacherNames();
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

/**
 * Load more instances
 */
async function loadMoreInstances() {
    if (!instancesHasMore || isLoadingMoreInstances || !instancesLastDoc) return;
    
    try {
        isLoadingMoreInstances = true;
        const loadMoreBtn = document.getElementById('loadMoreInstancesBtn');
        if (loadMoreBtn) {
            loadMoreBtn.disabled = true;
            loadMoreBtn.textContent = 'טוען...';
        }
        
        const { getPaginatedClassInstances } = await import('../../services/class-instance-service.js');
        const result = await getPaginatedClassInstances(currentBusinessId, {
            limit: 30,
            startAfterDoc: instancesLastDoc,
            sortOrder: 'asc'
        });
        
        classInstances = [...classInstances, ...result.instances];
        instancesLastDoc = result.lastDoc;
        instancesHasMore = result.hasMore;
        
        await enrichInstancesWithTeacherNames();
        renderCurrentView();
    } catch (error) {
        console.error('Error loading more instances:', error);
        showToast('שגיאה בטעינת שיעורים נוספים', 'error');
    } finally {
        isLoadingMoreInstances = false;
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
 * Populate teacher dropdowns (Search & Select)
 */
function populateTeacherDropdowns() {
    const searchInput = document.getElementById('instanceTeacherInput');
    const hiddenInput = document.getElementById('instanceTeacher');
    const resultsDiv = document.getElementById('instanceTeacherResults');
    
    if (!searchInput || !hiddenInput || !resultsDiv) return;

    const activeTeachers = teachers.filter(t => t.isActive);
    
    const renderList = (filterText = '') => {
        const filtered = activeTeachers.filter(t => {
            const fullName = `${t.firstName} ${t.lastName}`.toLowerCase();
            return fullName.includes(filterText.toLowerCase());
        });
        
        let html = '';
        if (filtered.length === 0) {
            html = '<div style="padding: 8px; color: #666; text-align: center;">לא נמצאו מורים</div>';
        } else {
            html = filtered.map(t => `
                <div class="search-result-item" data-id="${t.id}" style="padding: 10px; cursor: pointer; border-bottom: 1px solid #eee;">
                    ${t.firstName} ${t.lastName}
                </div>
            `).join('');
        }
        
        resultsDiv.innerHTML = html;
        
        // Add click listeners
        resultsDiv.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const teacherId = item.dataset.id;
                const teacher = teachers.find(t => t.id === teacherId);
                if (teacher) {
                    searchInput.value = `${teacher.firstName} ${teacher.lastName}`;
                    hiddenInput.value = teacher.id;
                }
                resultsDiv.style.display = 'none';
            });
            // Hover effect
            item.onmouseover = () => item.style.backgroundColor = '#f0f7ff';
            item.onmouseout = () => item.style.backgroundColor = 'white';
        });
        
        resultsDiv.style.display = 'block';
    };
    
    // Event listeners
    searchInput.addEventListener('focus', () => renderList(searchInput.value));
    
    searchInput.addEventListener('input', (e) => {
        renderList(e.target.value);
        if (e.target.value === '') {
            hiddenInput.value = '';
        }
    });
    
    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !resultsDiv.contains(e.target)) {
            resultsDiv.style.display = 'none';
        }
    });
}

/**
 * Populate teacher filter (Search & Select)
 */
function populateTeacherFilter() {
    const filterContainer = document.getElementById('teacherFilterContainer');
    const searchInput = document.getElementById('teacherFilterInput');
    const hiddenInput = document.getElementById('teacherFilter');
    const resultsDiv = document.getElementById('teacherFilterResults');
    
    if (!filterContainer || !searchInput || !hiddenInput || !resultsDiv) return;

    // Fix: Use isActive instead of active
    const activeTeachers = teachers.filter(t => t.isActive);
    
    if (activeTeachers.length > 0) {
        filterContainer.style.display = 'block';
        
        // Helper to render list
        const renderList = (filterText = '') => {
            const filtered = activeTeachers.filter(t => {
                const fullName = `${t.firstName} ${t.lastName}`.toLowerCase();
                return fullName.includes(filterText.toLowerCase());
            });
            
            let html = '<div class="search-result-item" data-id="" style="padding: 10px; cursor: pointer; border-bottom: 1px solid #eee; color: #666;">כל המורים</div>';
            
            if (filtered.length === 0) {
                html += '<div style="padding: 8px; color: #666; text-align: center;">לא נמצאו מורים</div>';
            } else {
                html += filtered.map(t => `
                    <div class="search-result-item" data-id="${t.id}" style="padding: 10px; cursor: pointer; border-bottom: 1px solid #eee;">
                        ${t.firstName} ${t.lastName}
                    </div>
                `).join('');
            }
            
            resultsDiv.innerHTML = html;
            
            // Add click listeners
            resultsDiv.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('click', () => {
                    const teacherId = item.dataset.id;
                    if (teacherId) {
                        const teacher = teachers.find(t => t.id === teacherId);
                        searchInput.value = `${teacher.firstName} ${teacher.lastName}`;
                        hiddenInput.value = teacher.id;
                    } else {
                        searchInput.value = '';
                        hiddenInput.value = '';
                    }
                    resultsDiv.style.display = 'none';
                    renderCurrentView(); // Trigger filter update
                });
                // Hover effect
                item.onmouseover = () => item.style.backgroundColor = '#f0f7ff';
                item.onmouseout = () => item.style.backgroundColor = 'white';
            });
            
            resultsDiv.style.display = 'block';
        };
        
        // Event listeners
        searchInput.addEventListener('focus', () => renderList(searchInput.value));
        
        searchInput.addEventListener('input', (e) => {
            renderList(e.target.value);
            if (e.target.value === '') {
                hiddenInput.value = '';
                renderCurrentView();
            }
        });
        
        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !resultsDiv.contains(e.target)) {
                resultsDiv.style.display = 'none';
            }
        });
        
    } else {
        filterContainer.style.display = 'none';
    }
}

/**
 * Populate branch filter
 */
function populateBranchFilter() {
    const filterContainer = document.getElementById('branchFilterContainer'); // Note: In HTML we changed structure, but ID remains
    // Actually, in HTML I kept the ID branchFilterContainer for the inner div, so this is fine.
    const branchFilter = document.getElementById('branchFilter');
    
    let displayBranches = branches;

    // Filter for Branch Manager
    if (currentUser && currentUser.role === 'branchManager') {
        const allowedIds = currentUser.allowedBranchIds || [];
        displayBranches = branches.filter(b => allowedIds.includes(b.id));
    }

    if (displayBranches.length > 0) {
        branchFilter.innerHTML = '<option value="">כל הסניפים</option>' + 
            displayBranches.map(branch => `<option value="${branch.id}">${branch.name}</option>`).join('');
        filterContainer.style.display = 'block';
    } else {
        filterContainer.style.display = 'none';
    }
}

/**
 * Get filtered class instances based on filters
 */
function getFilteredInstances() {
    const branchFilter = document.getElementById('branchFilter');
    const selectedBranch = branchFilter ? branchFilter.value : '';
    
    const teacherFilter = document.getElementById('teacherFilter');
    const selectedTeacher = teacherFilter ? teacherFilter.value : '';
    
    let filtered = classInstances;

    // 1. Branch Manager Restriction
    if (currentUser && currentUser.role === 'branchManager') {
        const allowedIds = currentUser.allowedBranchIds || [];
        filtered = filtered.filter(instance => {
            if (!instance.locationId) return false;
            const location = locations.find(l => l.id === instance.locationId);
            return location && allowedIds.includes(location.branchId);
        });
    }
    
    // 2. Teacher Restriction (if logged in as teacher)
    if (currentUser && currentUser.role === 'teacher') {
        filtered = filtered.filter(instance => instance.teacherId === currentUser.uid);
    }

    // 3. UI Branch Filter
    if (selectedBranch) {
        filtered = filtered.filter(instance => {
            if (!instance.locationId) return false;
            const location = locations.find(l => l.id === instance.locationId);
            return location && location.branchId === selectedBranch;
        });
    }
    
    // 4. UI Teacher Filter
    if (selectedTeacher) {
        filtered = filtered.filter(instance => instance.teacherId === selectedTeacher);
    }

    // 5. Status Filter (List View only)
    if (currentView === 'list' && statusFilter !== 'all') {
        filtered = filtered.filter(instance => instance.status === statusFilter);
    }

    // 6. Search Query (List View only)
    if (currentView === 'list' && searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(instance => 
            (instance.name && instance.name.toLowerCase().includes(query)) ||
            (instance.teacherName && instance.teacherName.toLowerCase().includes(query)) ||
            (instance.locationName && instance.locationName.toLowerCase().includes(query))
        );
    }
    
    return filtered;
}

/**
 * Update classes count display
 */
function updateClassesCount() {
    const filtered = getFilteredInstances();
    const countElement = document.getElementById('classesCount');
    if (countElement) {
        countElement.textContent = `${filtered.length} שיעורים`;
    }
}

/**
 * Render current view
 */
function renderCurrentView() {
    updateClassesCount();
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

    // Get classes for the week (filtered by branch)
    const filteredInstances = getFilteredInstances();
    const weekClasses = filteredInstances.filter(cls => {
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
                            <div class="class-card-actions">
                                ${cls.whatsappLink ? `
                                    <button class="class-action-btn whatsapp-btn" onclick="event.stopPropagation(); window.open('${cls.whatsappLink}', '_blank');" title="פתח קבוצת וואטסאפ">
                                        <img src="../assets/icons/whatsapp-logo-4456.png" alt="WhatsApp">
                                    </button>
                                ` : ''}
                                <button class="class-action-btn edit-btn" onclick="event.stopPropagation(); window.editClassInstance('${cls.id}')" title="ערוך שיעור">
                                    ✏️
                                </button>
                            </div>
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
            window.location.href = `/manager/attendance.html?classId=${card.dataset.classId}`;
        });
    });
}

/**
 * Render list view
 */
function renderListView() {
    const container = document.getElementById('classesListContainer');
    
    // Get filtered instances
    const filteredInstances = getFilteredInstances();
    
    if (filteredInstances.length === 0) {
        container.innerHTML = '<div class="empty-state">אין שיעורים</div>';
        return;
    }

    // Sort by date descending
    const sortedClasses = [...filteredInstances].sort((a, b) => 
        b.date.toDate() - a.date.toDate()
    );

    container.innerHTML = sortedClasses.map(cls => `
        <div class="class-list-item" data-class-id="${cls.id}">
            <div class="class-list-actions">
                ${cls.whatsappLink ? `
                    <button class="class-action-btn whatsapp-btn" onclick="event.stopPropagation(); window.open('${cls.whatsappLink}', '_blank');" title="פתח קבוצת וואטסאפ">
                        <img src="../assets/icons/whatsapp-logo-4456.png" alt="WhatsApp">
                    </button>
                ` : ''}
                <button class="class-action-btn edit-btn" onclick="event.stopPropagation(); window.editClassInstance('${cls.id}')" title="ערוך שיעור">
                    ✏️
                </button>
            </div>
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
            window.location.href = `/manager/attendance.html?classId=${item.dataset.classId}`;
        });
    });
}

/**
 * View class details - REMOVED
 */
// async function viewClassDetails(classId) { ... }

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

    // Branch filter
    const branchFilter = document.getElementById('branchFilter');
    if (branchFilter) {
        branchFilter.addEventListener('change', renderCurrentView);
    }

    // Search Input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            renderListView();
        });
    }

    // Filter Chips
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            // Update active state
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('chip-active'));
            e.target.classList.add('chip-active');
            
            // Update filter
            statusFilter = e.target.dataset.filter;
            renderListView();
        });
    });

    // Modal filters
    const locationBranchFilter = document.getElementById('instanceLocationBranchFilter');
    if (locationBranchFilter) {
        locationBranchFilter.addEventListener('change', (e) => {
            populateLocationDropdown(e.target.value);
        });
    }
    
    const courseBranchFilter = document.getElementById('instanceCourseBranchFilter');
    if (courseBranchFilter) {
        courseBranchFilter.addEventListener('change', () => {
            const checked = Array.from(document.querySelectorAll('#coursesCheckboxList input:checked')).map(cb => cb.value);
            populateCoursesCheckboxList(checked);
        });
    }
    
    const courseSearch = document.getElementById('instanceCourseSearch');
    if (courseSearch) {
        courseSearch.addEventListener('input', () => {
            const checked = Array.from(document.querySelectorAll('#coursesCheckboxList input:checked')).map(cb => cb.value);
            populateCoursesCheckboxList(checked);
        });
    }

    // Forms
    document.getElementById('classInstanceForm').addEventListener('submit', handleInstanceSubmit);

    // Delete instance button
    const deleteInstanceBtn = document.getElementById('deleteInstanceBtn');
    if (deleteInstanceBtn) {
        deleteInstanceBtn.addEventListener('click', handleCancelClass);
    }
}

/**
 * Populate location dropdown
 */
function populateLocationDropdown(branchIdFilter = null) {
    const select = document.getElementById('instanceLocation');
    select.innerHTML = '<option value="">בחר מיקום...</option>';
    
    let filteredLocations = locations;
    if (branchIdFilter) {
        filteredLocations = locations.filter(l => l.branchId === branchIdFilter);
    }
    
    filteredLocations.forEach(location => {
        const option = document.createElement('option');
        option.value = location.id;
        option.textContent = location.name;
        select.appendChild(option);
    });
}

/**
 * Populate courses checkbox list
 */
function populateCoursesCheckboxList(selectedCourseIds = []) {
    const container = document.getElementById('coursesCheckboxList');
    const branchFilter = document.getElementById('instanceCourseBranchFilter');
    const searchInput = document.getElementById('instanceCourseSearch');
    
    const selectedBranch = branchFilter ? branchFilter.value : '';
    const searchText = searchInput ? searchInput.value.toLowerCase() : '';
    
    let filteredCourses = courses;
    
    if (selectedBranch) {
        filteredCourses = filteredCourses.filter(c => {
            // Check if course has a top-level branchId (future proofing)
            if (c.branchId === selectedBranch) return true;
            
            // Check schedule for branchId
            if (c.schedule && Array.isArray(c.schedule)) {
                return c.schedule.some(s => s.branchId === selectedBranch);
            }
            
            return false;
        });
    }
    
    if (searchText) {
        filteredCourses = filteredCourses.filter(c => c.name.toLowerCase().includes(searchText));
    }
    
    if (filteredCourses.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">לא נמצאו קורסים</p>';
        return;
    }
    
    container.innerHTML = filteredCourses.map(course => `
        <div style="display: flex; align-items: center; gap: 8px; padding: 4px 0;">
            <input 
                type="checkbox" 
                id="course-${course.id}" 
                value="${course.id}"
                ${selectedCourseIds.includes(course.id) ? 'checked' : ''}
                style="width: 18px; height: 18px; cursor: pointer;"
            >
            <label for="course-${course.id}" style="cursor: pointer; flex: 1;">
                ${course.name} (${course.enrollmentCount || 0} תלמידים)
            </label>
        </div>
    `).join('');
}

/**
 * Populate modal branch filters
 */
function populateModalBranchFilters() {
    const locationBranchSelect = document.getElementById('instanceLocationBranchFilter');
    const courseBranchSelect = document.getElementById('instanceCourseBranchFilter');
    
    let displayBranches = branches;
    if (currentUser && currentUser.role === 'branchManager') {
        const allowedIds = currentUser.allowedBranchIds || [];
        displayBranches = branches.filter(b => allowedIds.includes(b.id));
    }
    
    const options = '<option value="">כל הסניפים</option>' + 
        displayBranches.map(branch => `<option value="${branch.id}">${branch.name}</option>`).join('');
        
    if (locationBranchSelect) locationBranchSelect.innerHTML = options;
    if (courseBranchSelect) courseBranchSelect.innerHTML = options;
}

/**
 * Open add instance modal
 */
function openAddInstanceModal() {
    currentEditingId = null;
    currentEditingType = 'instance';
    
    document.getElementById('instanceModalTitle').textContent = 'שיעור חדש';
    document.getElementById('classInstanceForm').reset();
    // Reset teacher search-select
    document.getElementById('instanceTeacher').value = '';
    document.getElementById('instanceTeacherInput').value = '';
    
    // Set default date to today in dd/mm/yyyy format
    const today = new Date();
    document.getElementById('instanceDate').value = formatDateToDDMMYYYY(today);
    
    // Populate filters
    populateModalBranchFilters();
    
    // Populate location dropdown
    populateLocationDropdown();
    
    // Populate courses checkbox list
    populateCoursesCheckboxList();
    
    // Hide delete button for new instance
    const deleteBtn = document.getElementById('deleteInstanceBtn');
    if (deleteBtn) deleteBtn.style.display = 'none';

    showModal('classInstanceModal', document.getElementById('classInstanceModal'));
}
/**
 * Edit class instance
 */
async function editClassInstance(instanceId) {
    try {
        const instance = await getClassInstanceById(currentBusinessId, instanceId);
        if (!instance) {
            showToast('שיעור לא נמצא', 'error');
            return;
        }

        currentEditingId = instanceId;
        currentEditingType = 'instance';

        document.getElementById('instanceModalTitle').textContent = 'עריכת שיעור';
        
        // Populate filters
        populateModalBranchFilters();
        
        // Populate location dropdown
        populateLocationDropdown();
        
        document.getElementById('instanceName').value = instance.name || '';
        
        // Set teacher search-select values
        const teacherId = instance.teacherId || '';
        document.getElementById('instanceTeacher').value = teacherId;
        if (teacherId) {
            const teacher = teachers.find(t => t.id === teacherId);
            document.getElementById('instanceTeacherInput').value = teacher ? `${teacher.firstName} ${teacher.lastName}` : '';
        } else {
            document.getElementById('instanceTeacherInput').value = '';
        }

        document.getElementById('instanceDate').value = formatDateToDDMMYYYY(instance.date.toDate());
        document.getElementById('instanceStartTime').value = instance.startTime;
        document.getElementById('instanceDuration').value = instance.duration || 60;
        document.getElementById('instanceLocation').value = instance.locationId || '';
        document.getElementById('instanceWhatsappLink').value = instance.whatsappLink || '';
        document.getElementById('instanceNotes').value = instance.notes || '';

        // Populate courses checkbox list - for editing, we don't pre-select courses
        // The user can select courses to add more students
        populateCoursesCheckboxList();

        // Show delete button for existing instance
        const deleteBtn = document.getElementById('deleteInstanceBtn');
        if (deleteBtn) deleteBtn.style.display = 'block';

        showModal('classInstanceModal', document.getElementById('classInstanceModal'));

    } catch (error) {
        console.error('Error loading instance:', error);
        showToast('שגיאה בטעינת השיעור', 'error');
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
        const teacherId = document.getElementById('instanceTeacher').value;
        if (!teacherId) {
            showToast('נא לבחור מורה מהרשימה', 'error');
            saveBtn.disabled = false;
            spinner.style.display = 'none';
            return;
        }

        const date = parseDDMMYYYYToDate(document.getElementById('instanceDate').value);
        const startTimeValue = document.getElementById('instanceStartTime').value; // "HH:mm" format
        const duration = parseInt(document.getElementById('instanceDuration').value);

        // Get selected courses and aggregate their students
        const selectedCourses = Array.from(
            document.querySelectorAll('#coursesCheckboxList input[type="checkbox"]:checked')
        ).map(cb => cb.value);

        let studentIds = [];
        if (selectedCourses.length > 0) {
            for (const courseId of selectedCourses) {
                const courseStudentIds = await getCourseStudentIds(currentBusinessId, courseId, date);
                studentIds.push(...courseStudentIds);
            }
            // Remove duplicates
            studentIds = [...new Set(studentIds)];
        }

        const formData = {
            name: document.getElementById('instanceName').value.trim(),
            teacherId: document.getElementById('instanceTeacher').value,
            date: date, // Date object
            startTime: startTimeValue, // Keep as time string "HH:mm"
            duration: duration, // Duration in minutes
            locationId: document.getElementById('instanceLocation').value,
            notes: document.getElementById('instanceNotes').value.trim(),
            whatsappLink: document.getElementById('instanceWhatsappLink').value.trim(),
            studentIds: studentIds // Students from selected courses
        };

        if (currentEditingId) {
            await updateClassInstance(currentBusinessId, currentEditingId, formData);
        } else {
            await createClassInstance(currentBusinessId, formData);
        }

        await loadAllData();
        renderCurrentView();
        closeModal('classInstanceModal');
        showToast(currentEditingId ? 'השיעור עודכן בהצלחה' : 'השיעור נוסף בהצלחה');

    } catch (error) {
        console.error('Error saving instance:', error);
        showToast('שגיאה בשמירת השיעור: ' + error.message, 'error');
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
    if (!await showConfirm({ title: 'מחיקת שיעור', message: 'האם אתה בטוח שברצונך למחוק את השיעור?' })) {
        return;
    }

    const btn = document.getElementById('deleteInstanceBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> מוחק...';

    try {
        await cancelClassInstance(currentBusinessId, currentEditingId);
        await loadAllData();
        renderCurrentView();
        
        closeModal(); // Close modal
        showToast('השיעור נמחק בהצלחה');
    } catch (error) {
        console.error('Error cancelling class:', error);
        showToast('שגיאה במחיקת השיעור', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}

// Expose functions to window
window.editClassInstance = editClassInstance;

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
    const diff = -day; // Start week on Sunday (0 = Sunday, so subtract current day to get to Sunday)
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

