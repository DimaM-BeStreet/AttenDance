/**
 * Templates Management Page
 * Dedicated page for managing class templates and enrollments
 */

import './classes-styles.js';
import { createNavbar } from '../../components/navbar.js';
import { showModal, closeModal, showConfirm, showToast } from '../../components/modal.js';
import { 
    getAllTeachers
} from '../../services/teacher-service.js';
import { 
    getAllStudents
} from '../../services/student-service.js';
import { 
    createClassTemplate,
    updateClassTemplate,
    deleteClassTemplate,
    getAllClassTemplates
} from '../../services/class-template-service.js';
import { 
    createCourse
} from '../../services/course-service.js';
import {
    getAllLocations
} from '../../services/location-service.js';
import { getAllBranches } from '../../services/branch-service.js';
import { auth, db } from '../../config/firebase-config.js';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { UniversalImportWizard } from '../../components/UniversalImportWizard.js';
import { validateTemplateImport, importTemplates } from '../../services/import-service.js';

// State
let currentBusinessId = null;
let currentUser = null;
let teachers = [];
let locations = [];
let branches = [];
let classTemplates = [];
let currentEditingTemplateId = null;
let selectedDay = 0; // day number 0-6 (Sunday-Saturday)
// Pagination state
let templatesLastDoc = null;
let templatesHasMore = true;
let isLoadingMoreTemplates = false;

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
                showToast('אין לך הרשאות לצפות בדף זה', 'error');
                window.location.href = '/';
                return;
            }

            currentUser = userData;
            currentBusinessId = userData.businessId;
            
            // Initialize navbar
            createNavbar();

            // Load branches
            branches = await getAllBranches(currentBusinessId, { isActive: true });
            populateBranchDropdown();

            // Load teachers
            teachers = await getAllTeachers(currentBusinessId);
            populateTeacherDropdown();

            // Load locations
            locations = await getAllLocations(currentBusinessId, { isActive: true });
            populateLocationDropdown();

            // Load and render templates
            await loadTemplates();
            renderTemplates();

            // Setup event listeners
            setupEventListeners();

        } catch (error) {
            console.error('Error initializing page:', error);
            showToast('שגיאה בטעינת הדף', 'error');
        }
    });
});

/**
 * Load templates with pagination
 */
async function loadTemplates() {
    try {
        // Load first page of templates (30 items)
        const { getPaginatedClassTemplates } = await import('../../services/class-template-service.js');
        const result = await getPaginatedClassTemplates(currentBusinessId, {
            limit: 30,
            sortBy: 'name',
            sortOrder: 'asc'
        });
        
        classTemplates = result.templates;
        templatesLastDoc = result.lastDoc;
        templatesHasMore = result.hasMore;
        
        // Add teacher names and location names
        classTemplates.forEach(template => {
            const teacher = teachers.find(t => t.id === template.teacherId);
            template.teacherName = teacher ? `${teacher.firstName} ${teacher.lastName}` : 'ללא מורה';
            const location = locations.find(l => l.id === template.locationId);
            if (location) {
                const branch = branches.find(b => b.id === location.branchId);
                const branchShort = branch && branch.shortName ? branch.shortName : '';
                template.locationName = branchShort ? `${location.name} (${branchShort})` : location.name;
            } else {
                template.locationName = 'ללא מיקום';
            }
        });
        
        updateCount();
    } catch (error) {
        console.error('Error loading templates:', error);
    }
}

/**
 * Update templates count
 */
function updateCount() {
    const activeCount = classTemplates.filter(t => t.isActive).length;
    document.getElementById('templatesCount').textContent = 
        `${activeCount} תבניות פעילות`;
}

/**
 * Populate branch dropdown
 */
function populateBranchDropdown() {
    const select = document.getElementById('templateBranch');
    
    select.innerHTML = '<option value="">ללא סניף</option>' + 
        branches.map(branch => 
            `<option value="${branch.id}">${branch.name}</option>`
        ).join('');
    
    // Populate filter dropdown and show/hide based on branch count
    const filterContainer = document.getElementById('branchFilterContainer');
    const branchFilter = document.getElementById('branchFilter');
    
    if (branches.length > 1) {
        branchFilter.innerHTML = '<option value="">כל הסניפים</option>' + 
            branches.map(branch => `<option value="${branch.id}">${branch.name}</option>`).join('');
        filterContainer.style.display = 'block';
    } else {
        filterContainer.style.display = 'none';
    }
}

/**
 * Populate teacher dropdown (Search & Select)
 */
function populateTeacherDropdown() {
    const searchInput = document.getElementById('teacherSearchInput');
    const hiddenInput = document.getElementById('templateTeacher');
    const resultsDiv = document.getElementById('teacherSearchResults');
    const activeTeachers = teachers.filter(t => t.isActive);
    
    // Helper to render list
    const renderList = (filterText = '') => {
        const filtered = activeTeachers.filter(t => {
            const fullName = `${t.firstName} ${t.lastName}`.toLowerCase();
            return fullName.includes(filterText.toLowerCase());
        });
        
        if (filtered.length === 0) {
            resultsDiv.innerHTML = '<div style="padding: 8px; color: #666; text-align: center;">לא נמצאו מורים</div>';
        } else {
            resultsDiv.innerHTML = filtered.map(t => `
                <div class="search-result-item" data-id="${t.id}" style="padding: 10px; cursor: pointer; border-bottom: 1px solid #eee;">
                    ${t.firstName} ${t.lastName}
                </div>
            `).join('');
            
            // Add click listeners
            resultsDiv.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('click', () => {
                    const teacher = teachers.find(t => t.id === item.dataset.id);
                    if (teacher) {
                        searchInput.value = `${teacher.firstName} ${teacher.lastName}`;
                        hiddenInput.value = teacher.id;
                        resultsDiv.style.display = 'none';
                    }
                });
                // Hover effect
                item.onmouseover = () => item.style.backgroundColor = '#f0f7ff';
                item.onmouseout = () => item.style.backgroundColor = 'white';
            });
        }
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
 * Populate location dropdown
 * @param {string|null} branchId - Optional branch ID to filter locations
 */
function populateLocationDropdown(branchId = null) {
    const select = document.getElementById('templateLocation');
    let activeLocations = locations.filter(l => l.isActive);
    
    // Filter by branch if specified
    if (branchId) {
        activeLocations = activeLocations.filter(l => l.branchId === branchId);
    }
    
    select.innerHTML = '<option value="">בחר מיקום...</option>' + 
        activeLocations.map(location => 
            `<option value="${location.id}">${location.name}</option>`
        ).join('');
}

/**
 * Render templates
 */
function renderTemplates() {
    const container = document.getElementById('templatesContainer');
    
    if (classTemplates.length === 0) {
        container.innerHTML = '<div class="empty-state">אין תבניות שיעורים</div>';
        return;
    }

    let activeTemplates = classTemplates.filter(t => t.isActive);
    
    // Filter by branch (if selected)
    const branchFilter = document.getElementById('branchFilter');
    const selectedBranch = branchFilter ? branchFilter.value : '';
    if (selectedBranch) {
        activeTemplates = activeTemplates.filter(t => t.branchId === selectedBranch);
    }
    
    // Filter by selected day
    activeTemplates = activeTemplates.filter(t => t.dayOfWeek === parseInt(selectedDay));
    
    if (activeTemplates.length === 0) {
        const dayName = getDayName(parseInt(selectedDay));
        container.innerHTML = `<div class="empty-state">אין תבניות פעילות ביום ${dayName}</div>`;
        return;
    }
    
    // Sort by day of week, then start time, then location
    const sortedTemplates = activeTemplates.sort((a, b) => {
        // First by day of week
        if (a.dayOfWeek !== b.dayOfWeek) {
            return a.dayOfWeek - b.dayOfWeek;
        }
        // Then by start time
        if (a.startTime !== b.startTime) {
            return a.startTime.localeCompare(b.startTime);
        }
        // Finally by location name
        const locationA = a.locationName || '';
        const locationB = b.locationName || '';
        return locationA.localeCompare(locationB, 'he');
    });
    
    container.innerHTML = sortedTemplates.map(template => {
        return `
            <div class="template-card" onclick="viewTemplateDetails('${template.id}')">
                <div class="template-header">
                    <div class="template-name">${template.name}</div>
                    ${template.locationName ? `
                        <div class="template-location">📍 ${template.locationName}</div>
                    ` : ''}
                </div>
                <div class="template-details">
                    ${template.whatsappLink ? `
                        <button class="template-whatsapp-btn" onclick="event.stopPropagation(); window.open('${template.whatsappLink}', '_blank');" title="פתח קבוצת וואטסאפ">
                            <img src="../assets/icons/whatsapp-logo-4456.png" alt="WhatsApp">
                        </button>
                    ` : ''}
                    <div class="template-time">
                        🕐 ${template.startTime} (${template.duration} דקות)
                    </div>
                    <div class="template-teacher">
                        👤 ${template.teacherName || 'ללא מורה'}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Day filter chips
    document.querySelectorAll('.filter-chips .chip').forEach(chip => {
        chip.addEventListener('click', () => {
            // Update active state
            document.querySelectorAll('.filter-chips .chip').forEach(c => c.classList.remove('chip-active'));
            chip.classList.add('chip-active');
            
            // Update selected day
            selectedDay = chip.dataset.day;
            
            // Re-render templates
            renderTemplates();
        });
    });

    // Add template button
    document.getElementById('addTemplateBtn').addEventListener('click', () => {
        openTemplateModal();
    });

    // Import button
    const importBtn = document.getElementById('importTemplatesBtn');
    if (importBtn) {
        importBtn.addEventListener('click', openImportWizard);
    }

    // Template form submission
    document.getElementById('templateForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveTemplate();
    });
    
    // Branch dropdown change - filter locations by selected branch
    document.getElementById('templateBranch').addEventListener('change', (e) => {
        const selectedBranchId = e.target.value || null;
        populateLocationDropdown(selectedBranchId);
    });
    
    // Branch filter
    const branchFilter = document.getElementById('branchFilter');
    if (branchFilter) {
        branchFilter.addEventListener('change', renderTemplates);
    }
}

/**
 * Open Import Wizard
 */
function openImportWizard() {
  const config = {
    title: 'יבוא תבניות שיעור',
    requiredFields: [
      { key: 'name', label: 'שם התבנית' },
      { key: 'duration', label: 'משך (דקות)' },
      { key: 'dayOfWeek', label: 'יום בשבוע (0-6)' },
      { key: 'startTime', label: 'שעת התחלה (HH:mm)' },
      { key: 'teacherId', label: 'מורה' },
      { key: 'branchId', label: 'סניף' },
      { key: 'locationId', label: 'מיקום' }
    ],
    optionalFields: [
      { key: 'description', label: 'תיאור' },
      { key: 'price', label: 'מחיר קורס עם שיעור זה בלבד', description: 'יצירת תבנית תיצור מסלול/קורס באופן אוטומטי, שבו השיעור היחידי הוא השיעור הזה והמחיר שלו הוא הערך בשדה שייבחר פה' }
    ],
    relationalFields: {
        teacherId: {
            label: 'מורה',
            service: 'teacher-service',
            method: 'getAllTeachers',
            nameField: 'firstName',
            nameField2: 'lastName'
        },
        branchId: {
            label: 'סניף',
            service: 'branch-service',
            method: 'getAllBranches',
            nameField: 'name'
        },
        locationId: {
            label: 'מיקום',
            service: 'location-service',
            method: 'getAllLocations',
            nameField: 'name',
            dependsOn: 'branchId',
            filterField: 'branchId'
        }
    },
    validate: validateTemplateImport,
    importData: importTemplates
  };

  new UniversalImportWizard(currentBusinessId, config, () => {
    loadTemplates().then(renderTemplates);
  });
}

/**
 * Open template modal (add or edit)
 */
function openTemplateModal(template = null) {
    currentEditingTemplateId = template ? template.id : null;
    
    document.getElementById('templateModalTitle').textContent = 
        template ? 'עריכת תבנית' : 'תבנית חדשה';

    if (template) {
        document.getElementById('templateName').value = template.name;
        document.getElementById('templateBranch').value = template.branchId || '';
        
        // Set teacher search inputs
        const teacher = teachers.find(t => t.id === template.teacherId);
        document.getElementById('templateTeacher').value = template.teacherId || '';
        document.getElementById('teacherSearchInput').value = teacher ? `${teacher.firstName} ${teacher.lastName}` : '';
        
        document.getElementById('templateDayOfWeek').value = template.dayOfWeek;
        document.getElementById('templateStartTime').value = template.startTime;
        document.getElementById('templateDuration').value = template.duration;
        document.getElementById('templateWhatsappLink').value = template.whatsappLink || '';
        document.getElementById('templateIsActive').checked = template.isActive !== false;
        
        // Populate locations filtered by branch, then set value
        populateLocationDropdown(template.branchId || null);
        document.getElementById('templateLocation').value = template.locationId || '';
    } else {
        document.getElementById('templateForm').reset();
        document.getElementById('templateBranch').value = '';
        document.getElementById('templateTeacher').value = ''; // Clear hidden input
        document.getElementById('teacherSearchInput').value = ''; // Clear search input
        document.getElementById('templateIsActive').checked = true;
        
        // Populate all locations for new template
        populateLocationDropdown(null);
    }

    showModal('templateModal', document.getElementById('templateModal'));
}

/**
 * Save template (create or update)
 */
async function saveTemplate() {
    const btn = document.getElementById('saveTemplateBtn');
    const originalText = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> שומר...';

        const branchValue = document.getElementById('templateBranch').value;
        
        const templateData = {
            name: document.getElementById('templateName').value,
            branchId: branchValue || null,
            teacherId: document.getElementById('templateTeacher').value,
            dayOfWeek: parseInt(document.getElementById('templateDayOfWeek').value),
            startTime: document.getElementById('templateStartTime').value,
            duration: parseInt(document.getElementById('templateDuration').value),
            locationId: document.getElementById('templateLocation').value,
            whatsappLink: document.getElementById('templateWhatsappLink').value.trim(),
            isActive: document.getElementById('templateIsActive').checked
        };

        if (!templateData.teacherId) {
            showToast('נא לבחור מורה (שדה חובה)', 'error');
            return;
        }

        if (!templateData.branchId) {
            showToast('נא לבחור סניף (שדה חובה)', 'error');
            return;
        }

        if (!templateData.locationId) {
            showToast('נא לבחור מיקום (שדה חובה)', 'error');
            return;
        }

        // Check for duplicates before creating
        if (!currentEditingTemplateId) {
            const allTemplates = await getAllClassTemplates(currentBusinessId);
            const duplicate = allTemplates.find(t => 
                t.locationId === templateData.locationId &&
                t.branchId === templateData.branchId &&
                t.dayOfWeek === templateData.dayOfWeek &&
                t.startTime === templateData.startTime &&
                t.isActive
            );

            if (duplicate) {
                showToast('קיימת כבר תבנית פעילה עם אותו מיקום, סניף, יום ושעה.', 'error');
                return;
            }
        }

        if (currentEditingTemplateId) {
            await updateClassTemplate(currentBusinessId, currentEditingTemplateId, templateData);
            
            // Update auto-created course
            try {
                const { getAllCourses, updateCourse } = await import('../../services/course-service.js');
                const allCourses = await getAllCourses(currentBusinessId);
                const autoCourse = allCourses.find(c => 
                    Array.isArray(c.templateIds) && 
                    c.templateIds.length === 1 && 
                    c.templateIds[0] === currentEditingTemplateId && 
                    c.autoCreated
                );
                
                if (autoCourse) {
                    await updateCourse(currentBusinessId, autoCourse.id, {
                        name: `רק ${templateData.name} (*אוטומטי)`,
                        description: `קורס אוטומטי עבור תבנית ${templateData.name}`
                    });
                    console.log('Updated auto-created course:', autoCourse.id);
                }
            } catch (err) {
                console.error('Error updating auto-created course:', err);
            }
        } else {
            const newTemplate = await createClassTemplate(currentBusinessId, templateData);
            // Prevent duplicate auto-created course for same template
            try {
                const { getAllCourses } = await import('../../services/course-service.js');
                const allCourses = await getAllCourses(currentBusinessId);
                const exists = allCourses.some(c => Array.isArray(c.templateIds) && c.templateIds.length === 1 && c.templateIds[0] === newTemplate.id && c.autoCreated);
                if (!exists) {
                    const today = new Date();
                    const nextYear = new Date();
                    nextYear.setFullYear(today.getFullYear() + 1);
                    const courseData = {
                        name: `רק ${templateData.name} (*אוטומטי)`,
                        description: `קורס אוטומטי עבור תבנית ${templateData.name}`,
                        templateIds: [newTemplate.id],
                        startDate: today,
                        endDate: nextYear,
                        price: 0,
                        maxStudents: null,
                        isActive: true,
                        autoCreated: true
                    };
                    await createCourse(currentBusinessId, courseData);
                    console.log('Automatically created course for template:', newTemplate.id);
                } else {
                    console.log('Auto-created course for this template already exists.');
                }
            } catch (courseError) {
                console.error('Error creating automatic course:', courseError);
            }
        }

        closeModal();
        await loadTemplates();
        renderTemplates();
        
        showToast(currentEditingTemplateId ? 'התבנית עודכנה בהצלחה' : 'התבנית נוצרה בהצלחה');

    } catch (error) {
        console.error('Error saving template:', error);
        showToast('שגיאה בשמירת התבנית', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

/**
 * View template details
 */
window.viewTemplateDetails = async function(templateId) {
    try {
        const template = classTemplates.find(t => t.id === templateId);
        if (!template) {
            showToast('תבנית לא נמצאה', 'error');
            return;
        }

        const teacher = teachers.find(t => t.id === template.teacherId);
        const location = locations.find(l => l.id === template.locationId);
        const enrolledCount = template.defaultStudentIds ? template.defaultStudentIds.length : 0;

        const branch = branches.find(b => b.id === template.branchId);
        
        const detailsHtml = `
            <div class="detail-item">
                <span class="detail-label">שם:</span>
                <span class="detail-value">${template.name}</span>
            </div>
            ${branch ? `
            <div class="detail-item">
                <span class="detail-label">סניף:</span>
                <span class="detail-value">${branch.name}</span>
            </div>
            ` : ''}
            <div class="detail-item">
                <span class="detail-label">מורה:</span>
                <span class="detail-value">${teacher ? teacher.firstName + ' ' + teacher.lastName : 'לא צוין'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">יום:</span>
                <span class="detail-value">${getDayName(template.dayOfWeek)}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">שעה:</span>
                <span class="detail-value">${template.startTime}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">משך:</span>
                <span class="detail-value">${template.duration} דקות</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">מיקום:</span>
                <span class="detail-value">${location ? location.name : 'לא צוין'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">סטטוס:</span>
                <span class="detail-value">${template.isActive ? '✅ פעיל' : '❌ לא פעיל'}</span>
            </div>
            <div class="detail-note" style="margin-top: 16px; padding: 12px; background: var(--bg-secondary); border-radius: 8px;">
                <strong>💡 הערה:</strong> רישום תלמידים מתבצע כעת דרך <a href="/manager/courses.html" style="color: var(--primary);">דף הקורסים</a>
            </div>
        `;

        document.getElementById('templateDetailsContent').innerHTML = detailsHtml;
        document.getElementById('templateDetailsName').textContent = template.name;

        // Setup buttons
        document.getElementById('editTemplateFromDetailsBtn').onclick = () => {
            closeModal();
            setTimeout(() => openTemplateModal(template), 300);
        };

        document.getElementById('deleteTemplateFromDetailsBtn').onclick = async () => {
            if (!await showConfirm({ title: 'מחיקת תבנית', message: 'האם אתה בטוח שברצונך למחוק את התבנית?' })) {
                return;
            }
            
            const btn = document.getElementById('deleteTemplateFromDetailsBtn');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> מוחק...';

            try {
                await deleteClassTemplate(currentBusinessId, template.id);
                closeModal();
                await loadTemplates();
                renderTemplates();
                showToast('התבנית נמחקה בהצלחה');
            } catch (error) {
                console.error('Error deleting template:', error);
                showToast('שגיאה במחיקת התבנית', 'error');
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                }
            }
        };

        showModal('templateDetailsModal', document.getElementById('templateDetailsModal'));
    } catch (error) {
        console.error('Error viewing template details:', error);
        showToast('שגיאה בטעינת פרטי התבנית', 'error');
    }
};



/**
 * Utility: Get day name
 */
function getDayName(dayIndex) {
    const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    return days[dayIndex];
}
