/**
 * Templates Management Page
 * Dedicated page for managing class templates and enrollments
 */

import './classes-styles.js';
import { createNavbar } from '../../components/navbar.js';
import { showModal, closeModal } from '../../components/modal.js';
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
    getAllLocations
} from '../../services/location-service.js';
import { auth, db } from '../../config/firebase-config.js';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

// State
let currentStudioId = null;
let currentUser = null;
let teachers = [];
let locations = [];
let classTemplates = [];
let currentEditingTemplateId = null;

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
                alert('אין לך הרשאות לצפות בדף זה');
                window.location.href = '/';
                return;
            }

            currentUser = userData;
            currentStudioId = userData.businessId;
            
            // Initialize navbar
            createNavbar();

            // Load teachers
            teachers = await getAllTeachers(currentStudioId);
            populateTeacherDropdown();

            // Load locations
            locations = await getAllLocations(currentStudioId, { isActive: true });
            populateLocationDropdown();

            // Load and render templates
            await loadTemplates();
            renderTemplates();

            // Setup event listeners
            setupEventListeners();

        } catch (error) {
            console.error('Error initializing page:', error);
            alert('שגיאה בטעינת הדף');
        }
    });
});

/**
 * Load templates
 */
async function loadTemplates() {
    try {
        classTemplates = await getAllClassTemplates(currentStudioId);
        
        // Add teacher names and location names
        classTemplates.forEach(template => {
            const teacher = teachers.find(t => t.id === template.teacherId);
            template.teacherName = teacher ? `${teacher.firstName} ${teacher.lastName}` : 'ללא מורה';
            
            const location = locations.find(l => l.id === template.locationId);
            template.locationName = location ? location.name : 'ללא מיקום';
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
    const activeCount = classTemplates.filter(t => t.active).length;
    document.getElementById('templatesCount').textContent = 
        `${activeCount} תבניות פעילות`;
}

/**
 * Populate teacher dropdown
 */
function populateTeacherDropdown() {
    const select = document.getElementById('templateTeacher');
    const activeTeachers = teachers.filter(t => t.active);
    
    select.innerHTML = '<option value="">בחר מורה...</option>' + 
        activeTeachers.map(teacher => 
            `<option value="${teacher.id}">${teacher.firstName} ${teacher.lastName}</option>`
        ).join('');
}

/**
 * Populate location dropdown
 */
function populateLocationDropdown() {
    const select = document.getElementById('templateLocation');
    const activeLocations = locations.filter(l => l.isActive);
    
    select.innerHTML = '<option value="">בחר מיקום...</option>' + 
        activeLocations.map(location => 
            `<option value="${location.id}">${location.name} (מקסימום: ${location.maxStudents})</option>`
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

    const activeTemplates = classTemplates.filter(t => t.active);
    
    if (activeTemplates.length === 0) {
        container.innerHTML = '<div class="empty-state">אין תבניות פעילות</div>';
        return;
    }
    
    container.innerHTML = activeTemplates.map(template => {
        const dayName = getDayName(template.dayOfWeek);
        const enrolledCount = template.defaultStudentIds ? template.defaultStudentIds.length : 0;
        
        return `
            <div class="template-card" onclick="viewTemplateDetails('${template.id}')">
                <div class="template-header">
                    <div class="template-name">${template.name}</div>
                    <div class="template-day">${dayName}</div>
                </div>
                <div class="template-details">
                    <div class="template-time">
                        🕐 ${template.startTime} (${template.duration} דקות)
                    </div>
                    <div class="template-teacher">
                        👤 ${template.teacherName || 'ללא מורה'}
                    </div>
                    ${template.locationName ? `
                        <div class="template-location">📍 ${template.locationName}</div>
                    ` : ''}
                    <div class="template-students">
                        👥 ${enrolledCount} תלמידים
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
    // Add template button
    document.getElementById('addTemplateBtn').addEventListener('click', () => {
        openTemplateModal();
    });

    // Template form submission
    document.getElementById('templateForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveTemplate();
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
        document.getElementById('templateTeacher').value = template.teacherId || '';
        document.getElementById('templateDayOfWeek').value = template.dayOfWeek;
        document.getElementById('templateStartTime').value = template.startTime;
        document.getElementById('templateDuration').value = template.duration;
        document.getElementById('templateLocation').value = template.locationId || '';
        document.getElementById('templateIsActive').checked = template.active !== false;
    } else {
        document.getElementById('templateForm').reset();
        document.getElementById('templateIsActive').checked = true;
    }

    showModal('templateModal', document.getElementById('templateModal'));
}

/**
 * Save template (create or update)
 */
async function saveTemplate() {
    const btn = document.getElementById('saveTemplateBtn');
    const spinner = btn.querySelector('.btn-spinner');
    
    try {
        btn.disabled = true;
        spinner.style.display = 'inline-block';

        const templateData = {
            name: document.getElementById('templateName').value,
            teacherId: document.getElementById('templateTeacher').value,
            dayOfWeek: parseInt(document.getElementById('templateDayOfWeek').value),
            startTime: document.getElementById('templateStartTime').value,
            duration: parseInt(document.getElementById('templateDuration').value),
            locationId: document.getElementById('templateLocation').value,
            active: document.getElementById('templateIsActive').checked
        };

        if (currentEditingTemplateId) {
            await updateClassTemplate(currentStudioId, currentEditingTemplateId, templateData);
        } else {
            await createClassTemplate(currentStudioId, templateData);
        }

        closeModal();
        await loadTemplates();
        renderTemplates();
        
        alert(currentEditingTemplateId ? 'התבנית עודכנה בהצלחה' : 'התבנית נוצרה בהצלחה');
    } catch (error) {
        console.error('Error saving template:', error);
        alert('שגיאה בשמירת התבנית');
    } finally {
        btn.disabled = false;
        spinner.style.display = 'none';
    }
}

/**
 * View template details
 */
window.viewTemplateDetails = async function(templateId) {
    try {
        const template = classTemplates.find(t => t.id === templateId);
        if (!template) {
            alert('תבנית לא נמצאה');
            return;
        }

        const teacher = teachers.find(t => t.id === template.teacherId);
        const enrolledCount = template.defaultStudentIds ? template.defaultStudentIds.length : 0;

        const detailsHtml = `
            <div class="detail-item">
                <span class="detail-label">שם:</span>
                <span class="detail-value">${template.name}</span>
            </div>
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
                <span class="detail-value">${template.location || 'לא צוין'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">מקסימום תלמידים:</span>
                <span class="detail-value">${template.maxStudents || 'ללא הגבלה'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">סטטוס:</span>
                <span class="detail-value">${template.active ? '✅ פעיל' : '❌ לא פעיל'}</span>
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
            if (!confirm('האם אתה בטוח שברצונך למחוק את התבנית?')) {
                return;
            }
            
            try {
                await deleteClassTemplate(currentStudioId, template.id);
                closeModal();
                await loadTemplates();
                renderTemplates();
                alert('התבנית נמחקה בהצלחה');
            } catch (error) {
                console.error('Error deleting template:', error);
                alert('שגיאה במחיקת התבנית');
            }
        };

        showModal('templateDetailsModal', document.getElementById('templateDetailsModal'));
    } catch (error) {
        console.error('Error viewing template details:', error);
        alert('שגיאה בטעינת פרטי התבנית');
    }
};



/**
 * Utility: Get day name
 */
function getDayName(dayIndex) {
    const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    return days[dayIndex];
}
