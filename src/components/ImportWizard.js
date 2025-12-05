/**
 * Import Wizard Component
 * Multi-step wizard for importing students from Excel/CSV
 */

import '../styles/import-wizard.css';
import { 
  parseImportFile, 
  validateImportData, 
  importStudents,
  getSampleData 
} from '../services/import-service.js';
import { showToast } from './modal.js';

export class ImportWizard {
  constructor(businessId, onComplete, courseId = null) {
    this.businessId = businessId;
    this.onComplete = onComplete;
    this.courseId = courseId; // Optional: for direct course enrollment
    this.currentStep = 1;
    this.parsedData = null;
    this.columnMapping = {};
    this.valueMappings = {}; // { field: { 'fileValue': 'systemId' } }
    this.customFields = [];
    this.validationResults = null;
    this.duplicateDecisions = {}; // {rowIndex: 'skip' | 'update'}
    this.isImporting = false; // Prevent duplicate imports
    this.selectedCourseIds = []; // For multi-course enrollment
    this.selectedClassIds = []; // For multi-class enrollment
    this.availableCourses = null; // Loaded courses list
    this.availableClasses = null; // Loaded class instances
    this.enrollmentTab = 'courses'; // 'courses' or 'classes'
    this.courseSearchQuery = ''; // Search query for courses
    this.classSearchQuery = ''; // Search query for classes
    this.skippedDuplicates = []; // Existing students to enroll
    this.autoMatchedFields = []; // Track which fields were auto-matched
    // Server pagination state
    this.coursesLastDoc = null;
    this.classesLastDoc = null;
    this.coursesHasMore = true;
    this.classesHasMore = true;
    this.allTemplates = []; // Store templates for enriching classes
    this.enrollmentComplete = false; // Track if enrollment is finished
    
    // Relational fields configuration
    this.relationalFields = {
      courseId: { label: 'קורס', service: 'course-service', method: 'getAllCourses', searchMethod: 'searchCourses', nameField: 'name' },
      classId: { label: 'שיעור (תאריך ושעה)', service: 'class-instance-service', method: 'getClassInstances', searchMethod: 'searchClassInstances', nameField: 'displayName' }
    };
    this.systemOptions = {}; // Store loaded system options { branchId: [...] }
    this.searchCache = {}; // Cache for search results { field: { term: [results] } }
    this.enrollmentMode = null; // 'bulk' or 'mapped' (null initially to force selection)

    this.render();
    this.attachEventListeners();
  }
  
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func.apply(this, args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  async performSearch(field, term) {
    if (!term || term.length < 2) return [];
    
    // Check cache
    if (!this.searchCache[field]) this.searchCache[field] = {};
    if (this.searchCache[field][term]) return this.searchCache[field][term];
    
    const config = this.relationalFields[field];
    if (!config || !config.searchMethod) return [];
    
    try {
      const module = await import(`../services/${config.service}.js`);
      if (module[config.searchMethod]) {
        const results = await module[config.searchMethod](this.businessId, term);
        
        // Map to lightweight objects
        const mappedResults = results.map(item => {
            const name = item[config.nameField] + (config.nameField2 ? ' ' + item[config.nameField2] : '');
            return {
                id: item.id,
                name: name,
                original: item
            };
        });
        
        // Update cache
        this.searchCache[field][term] = mappedResults;
        
        // Update systemOptions (accumulate unique)
        if (!this.systemOptions[field]) this.systemOptions[field] = [];
        
        mappedResults.forEach(newItem => {
            if (!this.systemOptions[field].find(existing => existing.id === newItem.id)) {
                this.systemOptions[field].push(newItem);
            }
        });
        
        return mappedResults;
      }
    } catch (error) {
      console.error(`Error searching ${field}:`, error);
      return [];
    }
  }

  async autoPopulateMappedOptions() {
    const fields = ['courseId', 'classId'];
    const promises = [];
    
    for (const field of fields) {
        const colIndex = this.columnMapping[field];
        if (colIndex !== undefined) {
            const uniqueValues = this.getUniqueValues(colIndex);
            // Limit to first 10 unique values to avoid spamming server if there are many
            // or maybe we should do all of them? Let's do all but with concurrency limit if needed.
            // For now, just fire them.
            for (const val of uniqueValues) {
                if (val && val.trim()) {
                    promises.push(this.performSearch(field, val.trim()));
                }
            }
        }
    }
    
    if (promises.length > 0) {
        const loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'import-loading-overlay';
        loadingOverlay.innerHTML = '<div class="import-spinner"></div><div style="margin-top: 10px; color: white;">מחפש התאמות...</div>';
        document.body.appendChild(loadingOverlay);
        
        try {
            await Promise.all(promises);
        } finally {
            loadingOverlay.remove();
        }
    }
  }

  render() {
    const overlay = document.createElement('div');
    overlay.className = 'import-wizard-overlay';
    overlay.innerHTML = `
      <div class="import-wizard">
        <div class="import-wizard-header">
          <h2 class="import-wizard-title">יבוא תלמידים</h2>
          <button class="import-wizard-close" aria-label="סגור">×</button>
        </div>
        
        <div class="import-wizard-body">
          ${this.renderSteps()}
          <div id="importWizardContent"></div>
        </div>
        
        <div class="import-wizard-footer">
          <button class="import-btn import-btn-secondary" id="importPrevBtn" style="display: none;">
            חזור
          </button>
          <div style="flex: 1;"></div>
          <button class="import-btn import-btn-primary" id="importNextBtn">
            המשך
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    this.overlay = overlay;
    
    this.renderStepContent();
  }
  
  renderSteps() {
    const steps = [
      { number: 1, label: 'העלאת קובץ' },
      { number: 2, label: 'מיפוי עמודות' },
      { number: 3, label: 'אימות נתונים' },
      { number: 4, label: 'יבוא' },
      { number: 5, label: 'רישום לקורסים' }
    ];
    
    return `
      <div class="import-steps">
        ${steps.map((step, index) => `
          <div class="import-step ${step.number === this.currentStep ? 'active' : ''} ${step.number < this.currentStep ? 'completed' : ''}">
            <div class="import-step-number">${step.number}</div>
            <div class="import-step-label">${step.label}</div>
          </div>
          ${index < steps.length - 1 ? '<div class="import-step-divider"></div>' : ''}
        `).join('')}
      </div>
    `;
  }
  
  renderStepContent() {
    const content = document.getElementById('importWizardContent');
    
    // Safety check: if wizard is closed, don't try to render
    if (!content) {
      return;
    }
    
    switch (this.currentStep) {
      case 1:
        content.innerHTML = this.renderStep1();
        break;
      case 2:
        content.innerHTML = this.renderStep2();
        this.attachStep2Listeners();
        break;
      case 3:
        content.innerHTML = this.renderStep3();
        this.attachStep3Listeners();
        break;
      case 4:
        content.innerHTML = this.renderStep4();
        // Only start import if not already importing and no results yet
        if (!this.isImporting && !this.importResults) {
          this.startImport();
        }
        break;
      case 5:
        content.innerHTML = this.renderStep5();
        this.attachStep5Listeners();
        break;
    }
    
    this.updateButtons();
    this.updateStepsIndicator();
  }
  
  renderStep1() {
    if (this.parsedData) {
      return `
        <div class="import-file-info">
          <div class="import-file-icon">📄</div>
          <div class="import-file-details">
            <div class="import-file-name">${this.parsedData.fileName}</div>
            <div class="import-file-stats">${this.parsedData.totalRows} שורות • ${this.parsedData.headers.length} עמודות</div>
          </div>
          <button class="import-btn import-btn-secondary" id="changeFileBtn">
            החלף קובץ
          </button>
        </div>
      `;
    }
    
    return `
      <div class="import-upload-area" id="uploadArea">
        <div class="import-upload-icon">📁</div>
        <div class="import-upload-title">גרור קובץ לכאן או לחץ לבחירה</div>
        <div class="import-upload-subtitle">קבצים נתמכים: Excel (.xlsx, .xls), CSV</div>
        <label class="import-upload-button">
          בחר קובץ
          <input type="file" class="import-file-input" id="fileInput" accept=".xlsx,.xls,.csv">
        </label>
      </div>
    `;
  }
  
  renderStep2() {
    if (!this.parsedData) return '';
    
    const sample = getSampleData(this.parsedData);
    
    return `
      <div class="import-mapping-section">
        <div class="import-mapping-header">שדות חובה</div>
        <div class="import-mapping-description">יש למפות את השדות הבאים מהקובץ שלך:</div>
        <div class="import-mapping-grid">
          ${this.renderFieldMapping('name', 'שם מלא', true)}
          ${this.renderFieldMapping('phone', 'טלפון', true)}
          ${this.renderFieldMapping('birthYear', 'שנת לידה', true)}
        </div>
      </div>
      
      <div class="import-mapping-section">
        <div class="import-mapping-header">שדות אופציונליים</div>
        <div class="import-mapping-grid">
          ${this.renderFieldMapping('parentName', 'שם הורה', false)}
          ${this.renderFieldMapping('parentPhone', 'טלפון הורה', false)}
          ${this.renderFieldMapping('parentEmail', 'אימייל הורה', false)}
          ${this.renderFieldMapping('address', 'כתובת', false)}
          ${this.renderFieldMapping('medicalNotes', 'הערות רפואיות', false)}
          ${this.renderFieldMapping('photoURL', 'כתובת תמונה', false)}
        </div>
      </div>

      <div class="import-mapping-section">
        <div class="import-mapping-header">שדות מותאמים אישית</div>
        <div class="import-mapping-description">הוסף שדות נוספים שרלוונטיים לעסק שלך:</div>
        <div id="customFieldsContainer"></div>
        <button class="import-add-custom-field" id="addCustomFieldBtn">
          + הוסף שדה מותאם אישית
        </button>
      </div>
      
      <div class="import-mapping-section">
        <div class="import-mapping-header">תצוגה מקדימה</div>
        <table class="import-preview-table">
          <thead>
            <tr>
              ${sample.headers.map(h => `<th>${h || '(ללא כותרת)'}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${sample.rows.map(row => `
              <tr>
                ${row.map(cell => `<td>${cell || ''}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${sample.totalRows > 5 ? `<p style="margin-top: 8px; font-size: 13px; color: var(--text-secondary);">מציג 5 שורות מתוך ${sample.totalRows}</p>` : ''}
      </div>
    `;
  }
  
  renderFieldMapping(field, label, required) {
    const value = this.columnMapping[field];
    const headers = this.parsedData.headers;
    const wasAutoMatched = this.autoMatchedFields && this.autoMatchedFields.includes(field);
    
    return `
      <label class="import-field-label ${required ? 'required' : ''}">
        ${label}
        ${wasAutoMatched ? '<span class="import-auto-match-badge">✓ זוהה אוטומטית</span>' : ''}
      </label>
      <select class="import-field-select" data-field="${field}">
        <option value="">-- לא למפות --</option>
        ${headers.map((header, index) => `
          <option value="${index}" ${value === index ? 'selected' : ''}>
            ${header || `עמודה ${index + 1}`}
          </option>
        `).join('')}
      </select>
    `;
  }

  renderStepValueMapping() {
    const mappedRelationalFields = Object.keys(this.relationalFields).filter(field => 
      this.columnMapping[field] !== undefined
    );

    if (mappedRelationalFields.length === 0) {
      return '<div class="import-empty-state">לא נבחרו שדות למיפוי ערכים. לחץ על "המשך".</div>';
    }

    let html = `
      <div class="import-mapping-description">
        זיהינו שדות מערכת בקובץ שלך. אנא התאם את הערכים מהקובץ לאפשרויות הקיימות במערכת.
      </div>
    `;

    mappedRelationalFields.forEach(field => {
      const config = this.relationalFields[field];
      const colIndex = this.columnMapping[field];
      const uniqueValues = this.getUniqueValues(colIndex);
      const options = this.systemOptions[field] || [];
      
      // Initialize mapping for this field if not exists
      if (!this.valueMappings[field]) {
        this.valueMappings[field] = {};
      }

      html += `
        <div class="import-mapping-section">
          <div class="import-mapping-header">מיפוי ${config.label}</div>
          <table class="import-value-mapping-table">
            <thead>
              <tr>
                <th>ערך בקובץ (${this.parsedData.headers[colIndex]})</th>
                <th>התאמה במערכת</th>
              </tr>
            </thead>
            <tbody>
              ${uniqueValues.map(value => {
                const currentValue = this.valueMappings[field][value] || '';
                // Try to auto-match if not set
                const autoMatch = !currentValue ? this.findBestMatch(value, options, config) : null;
                const selectedValue = currentValue || (autoMatch ? autoMatch.id : '');
                
                // Update mapping if auto-matched
                if (autoMatch && !currentValue) {
                  this.valueMappings[field][value] = autoMatch.id;
                }

                return `
                  <tr>
                    <td>${value}</td>
                    <td>
                      <select class="import-value-select" data-field="${field}" data-file-value="${value}">
                        <option value="">-- בחר ${config.label} --</option>
                        <option value="__skip__" ${selectedValue === '__skip__' ? 'selected' : ''}>[דלג על שורה זו]</option>
                        <option value="__create__" ${selectedValue === '__create__' ? 'selected' : ''}>[צור חדש - לא נתמך כרגע]</option>
                        ${options.map(opt => {
                          const optName = opt[config.nameField] + (config.nameField2 ? ' ' + opt[config.nameField2] : '');
                          return `<option value="${opt.id}" ${selectedValue === opt.id ? 'selected' : ''}>${optName}</option>`;
                        }).join('')}
                      </select>
                      ${autoMatch && !currentValue ? '<span class="import-auto-match-badge" style="margin-right: 8px;">✓ זוהה</span>' : ''}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    });

    return html;
  }

  getUniqueValues(colIndex) {
    if (!this.parsedData || !this.parsedData.rows) return [];
    const values = new Set();
    this.parsedData.rows.forEach(row => {
      const val = row[colIndex];
      if (val && typeof val === 'string' && val.trim() !== '') {
        values.add(val.trim());
      }
    });
    return Array.from(values).sort();
  }

  findBestMatch(fileValue, options, config) {
    if (!fileValue || !options) return null;
    const normalizedFileValue = fileValue.toLowerCase().trim();
    
    // 1. Exact match
    const exact = options.find(opt => {
      // Options are now pre-mapped to {id, name}
      const optName = opt.name.toLowerCase();
      return optName === normalizedFileValue;
    });
    if (exact) return exact;

    // 2. Partial match (high confidence)
    const partial = options.find(opt => {
      const optName = opt.name.toLowerCase();
      return optName.includes(normalizedFileValue) || normalizedFileValue.includes(optName);
    });
    
    // Only return partial if similarity is high enough (simple check for now)
    if (partial) return partial;

    return null;
  }

  attachStepValueMappingListeners() {
    document.querySelectorAll('.import-value-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const field = e.target.dataset.field;
        const fileValue = e.target.dataset.fileValue;
        const systemId = e.target.value;
        
        if (!this.valueMappings[field]) {
          this.valueMappings[field] = {};
        }
        this.valueMappings[field][fileValue] = systemId;
      });
    });
  }

  renderStep3() {
    if (!this.validationResults) return '<div>מאמת נתונים...</div>';
    
    const { valid, invalid, duplicates, totalRows } = this.validationResults;
    
    return `
      <div class="import-validation-summary">
        <div class="import-validation-stat success">
          <div class="import-validation-number">${valid.length}</div>
          <div class="import-validation-label">תקינים</div>
        </div>
        <div class="import-validation-stat warning">
          <div class="import-validation-number">${duplicates.length}</div>
          <div class="import-validation-label">כפולים</div>
        </div>
        <div class="import-validation-stat error">
          <div class="import-validation-number">${invalid.length}</div>
          <div class="import-validation-label">שגיאות</div>
        </div>
        <div class="import-validation-stat">
          <div class="import-validation-number">${totalRows}</div>
          <div class="import-validation-label">סה"כ</div>
        </div>
      </div>
      
      ${invalid.length > 0 ? `
        <div class="import-mapping-section">
          <div class="import-mapping-header">שורות עם שגיאות (${invalid.length})</div>
          <div class="import-mapping-description">שורות אלו לא ייובאו עקב שגיאות:</div>
          <div class="import-validation-list">
            ${invalid.map(item => this.renderValidationItem(item, 'error')).join('')}
          </div>
        </div>
      ` : ''}
      
      ${duplicates.length > 0 ? `
        <div class="import-mapping-section">
          <div class="import-mapping-header">תלמידים כפולים (${duplicates.length})</div>
          <div class="import-mapping-description">תלמידים אלו כבר קיימים במערכת. בחר מה לעשות עם כל אחד:</div>
          <div class="import-validation-list">
            ${duplicates.map(item => this.renderValidationItem(item, 'duplicate')).join('')}
          </div>
        </div>
      ` : ''}
      
      ${valid.length > 0 ? `
        <div class="import-mapping-section">
          <div class="import-mapping-header">תלמידים חדשים (${valid.length})</div>
          <div class="import-mapping-description">תלמידים אלו ייווצרו במערכת:</div>
          <div class="import-validation-list" style="max-height: 200px;">
            ${valid.slice(0, 10).map(item => this.renderValidationItem(item, 'valid')).join('')}
            ${valid.length > 10 ? `<div style="padding: 16px; text-align: center; color: var(--text-secondary);">ועוד ${valid.length - 10} תלמידים...</div>` : ''}
          </div>
        </div>
      ` : ''}
    `;
  }
  
  renderValidationItem(item, type) {
    const name = item.extracted?.firstName ? `${item.extracted.firstName} ${item.extracted.lastName || ''}` : 'ללא שם';
    const phone = item.extracted?.phone || 'ללא טלפון';
    
    return `
      <div class="import-validation-item">
        <div class="import-validation-item-header">
          <span class="import-validation-item-row">שורה ${item.rowIndex}</span>
        </div>
        <div class="import-validation-item-data">${name} • ${phone}</div>
        
        ${type === 'error' ? `
          <div class="import-validation-item-errors">
            ${item.errors.map(err => `<div class="import-validation-error">❌ ${err}</div>`).join('')}
          </div>
        ` : ''}
        
        ${type === 'duplicate' ? `
          <div class="import-validation-item-errors">
            ${item.warnings.map(warn => `<div class="import-validation-warning">⚠️ ${warn}</div>`).join('')}
            <div class="import-duplicate-actions">
              <button class="import-duplicate-btn skip ${this.duplicateDecisions[item.rowIndex] === 'skip' ? 'selected' : ''}" 
                      data-row="${item.rowIndex}" data-action="skip">
                דלג
              </button>
              <button class="import-duplicate-btn update ${this.duplicateDecisions[item.rowIndex] === 'update' ? 'selected' : ''}" 
                      data-row="${item.rowIndex}" data-action="update">
                עדכן קיים
              </button>
            </div>
          </div>
        ` : ''}
        
        ${item.warnings && item.warnings.length > 0 && type === 'valid' ? `
          <div class="import-validation-item-errors">
            ${item.warnings.map(warn => `<div class="import-validation-warning">⚠️ ${warn}</div>`).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }
  
  renderStep6() {
    const { successful, alreadyEnrolled, failed } = this.enrollmentResults;
    const total = successful + alreadyEnrolled + failed;
    
    return `
      <div class="import-results-container">
        <div class="import-results-header">
          <div class="import-results-icon">✔</div>
          <div class="import-results-title">תוצאות רישום</div>
        </div>
        
        <div class="import-results-stats">
          <div class="import-result-stat success">
            <div class="import-result-number">${successful}</div>
            <div class="import-result-label">נרשמו בהצלחה</div>
          </div>
          
          ${alreadyEnrolled > 0 ? `
            <div class="import-result-stat info">
              <div class="import-result-number">${alreadyEnrolled}</div>
              <div class="import-result-label">כבר רשומים</div>
            </div>
          ` : ''}
          
          ${failed > 0 ? `
            <div class="import-result-stat error">
              <div class="import-result-number">${failed}</div>
              <div class="import-result-label">שגיאות</div>
            </div>
          ` : ''}
        </div>
        
        <div class="import-results-summary">
          סיימת לרשום ${total} תלמידים ל-${this.selectedCourseIds.length + this.selectedClassIds.length} קורסים/שיעורים
        </div>
      </div>
    `;
  }
  
  renderStep5() {
    if (this.enrollmentResults) {
      const total = this.enrollmentResults.successfulEnrollments + this.enrollmentResults.alreadyEnrolled + this.enrollmentResults.failed.length;
      
      return `
        <div class="import-progress-container">
          <div class="import-progress-icon success">✓</div>
          <div class="import-progress-title">הרישום הושלם!</div>
          <div class="import-progress-subtitle">סיכום תוצאות</div>
          
          <div class="import-results-summary">
            <div class="import-result-stat success">
              <div class="import-result-number">${this.enrollmentResults.successfulEnrollments}</div>
              <div class="import-result-label">נרשמו בהצלחה</div>
            </div>
            ${this.enrollmentResults.alreadyEnrolled > 0 ? `
              <div class="import-result-stat info">
                <div class="import-result-number">${this.enrollmentResults.alreadyEnrolled}</div>
                <div class="import-result-label">כבר רשומים</div>
              </div>
            ` : ''}
            ${this.enrollmentResults.failed.length > 0 ? `
              <div class="import-result-stat error">
                <div class="import-result-number">${this.enrollmentResults.failed.length}</div>
                <div class="import-result-label">נכשלו</div>
              </div>
            ` : ''}
          </div>
          
          ${this.enrollmentResults.details && this.enrollmentResults.details.length > 0 ? `
            <div class="import-results-details">
              <div class="import-results-details-title">פירוט לפי ${this.enrollmentResults.details[0].type === 'course' ? 'קורס' : 'שיעור'}:</div>
              ${this.enrollmentResults.details.map(detail => `
                <div class="import-result-detail-item">
                  <div class="import-result-detail-header">
                    <span class="import-result-detail-name">${detail.name}</span>
                    <span class="import-result-detail-count">${detail.successful + detail.alreadyEnrolled}/${detail.totalStudents} תלמידים</span>
                  </div>
                  <div class="import-result-detail-stats">
                    ${detail.successful > 0 ? `<span class="detail-stat success">✓ ${detail.successful} נרשמו</span>` : ''}
                    ${detail.alreadyEnrolled > 0 ? `<span class="detail-stat info">⊙ ${detail.alreadyEnrolled} כבר רשומים</span>` : ''}
                    ${detail.failed.length > 0 ? `<span class="detail-stat error">✗ ${detail.failed.length} נכשלו</span>` : ''}
                  </div>
                  ${detail.failed.length > 0 ? `
                    <div class="import-result-detail-errors">
                      ${detail.failed.slice(0, 3).map(f => `
                        <div class="import-error-item">
                          <span class="import-error-student">${f.studentName}:</span>
                          <span class="import-error-message">${f.error}</span>
                        </div>
                      `).join('')}
                      ${detail.failed.length > 3 ? `<div class="import-error-more">ועוד ${detail.failed.length - 3} שגיאות...</div>` : ''}
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }
    
    if (!this.availableCourses || !this.availableClasses) {
      return `
        <div class="import-progress-container">
          <div class="import-progress-icon loading">⏳</div>
          <div class="import-progress-title">טוען...</div>
        </div>
      `;
    }
    
    return `
      <div class="import-enrollment-container">
        <div class="import-enrollment-header">
          <div class="import-enrollment-title">אפשרויות רישום</div>
          <div class="import-enrollment-subtitle">כיצד תרצה לרשום את התלמידים?</div>
        </div>

        <div class="import-mode-tabs">
          <div class="import-mode-tab ${this.enrollmentMode === 'bulk' ? 'active' : ''}" data-mode="bulk">
            <div class="import-mode-icon">👥</div>
            <div>
              <div class="import-mode-title">רישום מרוכז</div>
              <div class="import-mode-subtitle">רשום את כולם לאותם קורסים/שיעורים</div>
            </div>
          </div>
          <div class="import-mode-tab ${this.enrollmentMode === 'mapped' ? 'active' : ''}" data-mode="mapped">
            <div class="import-mode-icon">📊</div>
            <div>
              <div class="import-mode-title">רישום לפי קובץ</div>
              <div class="import-mode-subtitle">השתמש בעמודות מהקובץ לרישום</div>
            </div>
          </div>
        </div>

        ${this.enrollmentMode === 'bulk' ? this.renderBulkEnrollmentUI() : 
          this.enrollmentMode === 'mapped' ? this.renderMappedEnrollmentUI() : 
          '<div class="import-empty-state" style="padding: 40px; background: var(--bg-secondary); border-radius: 8px;">בחר אפשרות למעלה כדי להמשיך</div>'}
      </div>
    `;
  }

  renderBulkEnrollmentUI() {
    // Include both newly imported and existing students (skipped duplicates)
    const newStudents = this.importResults ? 
      [...this.importResults.success, ...this.importResults.updated] : [];
    const existingStudents = (this.skippedDuplicates || []).map(dup => dup.duplicate).filter(s => s);
    const allStudents = [...newStudents, ...existingStudents];
    
    const totalSelected = this.selectedCourseIds.length + this.selectedClassIds.length;
    
    return `
        <div class="import-enrollment-header">
          <div class="import-enrollment-title">
            רישום ${allStudents.length} תלמידים
            ${existingStudents.length > 0 ? `<span class="import-existing-note">(כולל ${existingStudents.length} קיימים)</span>` : ''}
          </div>
          ${totalSelected > 0 ? `
            <div class="import-selection-info">
              <span class="import-selection-count">${totalSelected}</span> נבחרו
            </div>
          ` : ''}
        </div>
        
        <!-- Tabs -->
        <div class="import-enrollment-tabs">
          <button class="import-tab ${this.enrollmentTab === 'courses' ? 'active' : ''}" data-tab="courses">
            קורסים (${this.availableCourses.length}${this.coursesHasMore ? '+' : ''})
          </button>
          <button class="import-tab ${this.enrollmentTab === 'classes' ? 'active' : ''}" data-tab="classes">
            שיעורים (${this.availableClasses.length}${this.classesHasMore ? '+' : ''})
          </button>
        </div>
        
        <!-- Search for Courses -->
        <div class="import-enrollment-search" style="display: ${this.enrollmentTab === 'courses' ? 'block' : 'none'}">
          <input type="text" 
                 id="courseSearchInput" 
                 class="import-search-input" 
                 placeholder="חפש קורס..." 
                 value="${this.courseSearchQuery || ''}">
        </div>
        
        <!-- Search for Classes -->
        <div class="import-enrollment-search" style="display: ${this.enrollmentTab === 'classes' ? 'block' : 'none'}">
          <input type="text" 
                 id="classSearchInput" 
                 class="import-search-input" 
                 placeholder="חפש שיעור..." 
                 value="${this.classSearchQuery || ''}">
        </div>
        
        <!-- Courses List -->
        <div class="import-enrollment-list" id="coursesTab" style="display: ${this.enrollmentTab === 'courses' ? 'block' : 'none'}">
          ${this.renderFilteredCourses()}
        </div>
        
        <!-- Classes List -->
        <div class="import-enrollment-list" id="classesTab" style="display: ${this.enrollmentTab === 'classes' ? 'block' : 'none'}">
          ${this.renderFilteredClasses()}
        </div>
        
        <div class="import-enrollment-footer">
          <button class="import-btn import-btn-secondary" id="skipEnrollmentBtn">
            דלג על רישום
          </button>
        </div>
    `;
  }

  renderMappedEnrollmentUI() {
    const headers = this.parsedData.headers;
    
    let html = `
      <div class="import-mapping-description">
        בחר את העמודות מהקובץ המכילות את שמות הקורסים או השיעורים, והתאם אותם לאפשרויות במערכת.
      </div>
    `;

    ['courseId', 'classId'].forEach(field => {
      const config = this.relationalFields[field];
      const colIndex = this.columnMapping[field];
      
      html += `
        <div class="import-mapping-section">
          <div class="import-mapping-header">מיפוי ${config.label}</div>
          <div style="margin-bottom: 15px;">
            <label class="import-field-label">בחר עמודה מהקובץ:</label>
            <select class="import-field-select enrollment-column-select" data-field="${field}">
              <option value="">-- לא למפות --</option>
              ${headers.map((header, index) => `
                <option value="${index}" ${colIndex === index ? 'selected' : ''}>
                  ${header || `עמודה ${index + 1}`}
                </option>
              `).join('')}
            </select>
          </div>
      `;

      if (colIndex !== undefined) {
        const uniqueValues = this.getUniqueValues(colIndex);
        const options = this.systemOptions[field] || [];
        
        // Initialize mapping for this field if not exists
        if (!this.valueMappings[field]) {
          this.valueMappings[field] = {};
        }

        html += `
          <table class="import-value-mapping-table">
            <thead>
              <tr>
                <th>ערך בקובץ (${headers[colIndex]})</th>
                <th>התאמה במערכת</th>
              </tr>
            </thead>
            <tbody>
              ${uniqueValues.map(value => {
                const currentValue = this.valueMappings[field][value] || '';
                // Try to auto-match if not set
                const autoMatch = !currentValue ? this.findBestMatch(value, options, config) : null;
                const selectedValue = currentValue || (autoMatch ? autoMatch.id : '');
                
                // Update mapping if auto-matched
                if (autoMatch && !currentValue) {
                  this.valueMappings[field][value] = autoMatch.id;
                }

                // Find name for selected value
                let selectedName = '';
                if (selectedValue && selectedValue !== '__skip__') {
                    const opt = options.find(o => o.id === selectedValue);
                    if (opt) selectedName = opt.name;
                } else if (selectedValue === '__skip__') {
                    selectedName = '[דלג על שורה זו]';
                }

                return `
                  <tr>
                    <td>${value}</td>
                    <td>
                      <div class="import-input-wrapper">
                        <input type="text" 
                               class="import-value-input" 
                               data-field="${field}" 
                               data-file-value="${value}" 
                               placeholder="חפש (מתחיל ב...)"
                               value="${selectedName}"
                               autocomplete="off">
                        ${autoMatch && !currentValue ? '<span class="import-auto-match-badge" style="margin-right: 8px;">✓ זוהה</span>' : ''}
                        <div class="import-suggestions-list"></div>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `;
      }
      
      html += `</div>`;
    });

    return html;
  }

  renderFilteredCourses() {
    if (this.availableCourses.length === 0) {
      return '<div class="import-empty-state">אין קורסים פעילים</div>';
    }
    
    const query = (this.courseSearchQuery || '').toLowerCase();
    const filtered = this.availableCourses.filter(course => 
      !query || course.name.toLowerCase().includes(query)
    );
    
    if (filtered.length === 0) {
      return '<div class="import-empty-state">לא נמצאו קורסים התואמים לחיפוש</div>';
    }
    
    let html = filtered.map(course => this.renderEnrollmentItem('course', course)).join('');
    
    // Show Load More if there are more courses on server and no active search filter
    if (this.coursesHasMore && !query) {
      html += `
        <button class="import-load-more-btn" id="loadMoreCourses">
          טען 5 קורסים נוספים
        </button>
      `;
    }
    
    return html;
  }
  
  renderFilteredClasses() {
    if (this.availableClasses.length === 0) {
      return '<div class="import-empty-state">אין שיעורים מתוכננים</div>';
    }
    
    const query = (this.classSearchQuery || '').toLowerCase();
    const filtered = this.availableClasses.filter(classInstance => 
      !query || classInstance.templateName.toLowerCase().includes(query)
    );
    
    if (filtered.length === 0) {
      return '<div class="import-empty-state">לא נמצאו שיעורים התואמים לחיפוש</div>';
    }
    
    let html = filtered.map(classInstance => this.renderEnrollmentItem('class', classInstance)).join('');
    
    // Show Load More if there are more classes on server and no active search filter
    if (this.classesHasMore && !query) {
      html += `
        <button class="import-load-more-btn" id="loadMoreClasses">
          טען 5 שיעורים נוספים
        </button>
      `;
    }
    
    return html;
  }
  
  renderEnrollmentItem(type, item) {
    const isSelected = type === 'course' ? 
      this.selectedCourseIds.includes(item.id) : 
      this.selectedClassIds.includes(item.id);
    
    const id = `${type}-${item.id}`;
    const name = type === 'course' ? item.name : item.templateName;
    const details = type === 'course' ? 
      `${this.formatCourseDate(item.startDate)} - ${this.formatCourseDate(item.endDate)}` :
      this.formatCourseDate(item.date);
    
    return `
      <div class="import-enrollment-item ${isSelected ? 'selected' : ''}" data-type="${type}" data-id="${item.id}">
        <div class="import-enrollment-checkbox-wrapper">
          <input type="checkbox" 
                 id="${id}" 
                 class="import-enrollment-checkbox"
                 ${isSelected ? 'checked' : ''}>
        </div>
        <div class="import-enrollment-content">
          <div class="import-enrollment-name">${name}</div>
          <div class="import-enrollment-details">${details}</div>
        </div>
      </div>
    `;
  }
  
  renderStep4() {
    if (this.importResults) {
      const { success, updated, failed } = this.importResults;
      const total = success.length + updated.length + failed.length;
      
      return `
        <div class="import-progress-container">
          <div class="import-progress-icon success">✓</div>
          <div class="import-progress-title">היבוא הושלם בהצלחה!</div>
          <div class="import-progress-subtitle">התלמידים נוספו למערכת</div>
          
          <div class="import-results-summary">
            <div class="import-result-stat">
              <div class="import-result-number">${success.length}</div>
              <div class="import-result-label">נוצרו</div>
            </div>
            <div class="import-result-stat">
              <div class="import-result-number">${updated.length}</div>
              <div class="import-result-label">עודכנו</div>
            </div>
            ${failed.length > 0 ? `
              <div class="import-result-stat">
                <div class="import-result-number">${failed.length}</div>
                <div class="import-result-label">נכשלו</div>
              </div>
            ` : ''}
            <div class="import-result-stat">
              <div class="import-result-number">${total}</div>
              <div class="import-result-label">סה"כ</div>
            </div>
          </div>
        </div>
      `;
    }
    
    return `
      <div class="import-progress-container">
        <div class="import-progress-icon loading">⏳</div>
        <div class="import-progress-title">מיבא תלמידים...</div>
        <div class="import-progress-subtitle">אנא המתן, זה עשוי לקחת מספר רגעים</div>
        <div class="import-progress-bar">
          <div class="import-progress-fill" id="importProgressFill" style="width: 0%"></div>
        </div>
        <div class="import-progress-stats" id="importProgressStats">0 / 0</div>
      </div>
    `;
  }
  
  attachEventListeners() {
    // Close button
    this.overlay.querySelector('.import-wizard-close').addEventListener('click', () => {
      this.close();
    });
    
    // Click outside to close
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });
    
    // Next/Prev buttons
    document.getElementById('importNextBtn').addEventListener('click', () => {
      this.handleNext();
    });
    
    document.getElementById('importPrevBtn').addEventListener('click', () => {
      this.handlePrev();
    });
    
    // Step 1: File upload
    if (this.currentStep === 1) {
      this.attachStep1Listeners();
    }
  }
  
  attachStep1Listeners() {
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');
    const changeFileBtn = document.getElementById('changeFileBtn');
    
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        this.handleFileSelect(e.target.files[0]);
      });
    }
    
    if (uploadArea) {
      // Drag and drop
      uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
      });
      
      uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
      });
      
      uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        this.handleFileSelect(e.dataTransfer.files[0]);
      });
    }
    
    if (changeFileBtn) {
      changeFileBtn.addEventListener('click', () => {
        this.parsedData = null;
        this.renderStepContent();
        this.attachStep1Listeners();
      });
    }
  }
  
  attachStep2Listeners() {
    // Field mapping selects
    document.querySelectorAll('.import-field-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const field = e.target.dataset.field;
        const value = e.target.value;
        this.columnMapping[field] = value === '' ? undefined : parseInt(value);
      });
    });
    
    // Add custom field button
    document.getElementById('addCustomFieldBtn').addEventListener('click', () => {
      this.addCustomField();
    });
    
    // Initialize existing custom fields
    this.renderCustomFields();
  }
  
  attachStep3Listeners() {
    // Duplicate decision buttons
    document.querySelectorAll('.import-duplicate-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const row = parseInt(e.target.dataset.row);
        const action = e.target.dataset.action;
        this.duplicateDecisions[row] = action;
        
        // Update UI
        const container = e.target.closest('.import-duplicate-actions');
        container.querySelectorAll('.import-duplicate-btn').forEach(b => {
          b.classList.remove('selected');
        });
        e.target.classList.add('selected');
      });
    });
  }
  
  addCustomField() {
    this.customFields.push({ name: '', column: undefined });
    this.renderCustomFields();
  }
  
  renderCustomFields() {
    const container = document.getElementById('customFieldsContainer');
    if (!container) return;
    
    const headers = this.parsedData.headers;
    
    container.innerHTML = this.customFields.map((field, index) => `
      <div class="import-custom-field" style="margin-bottom: 12px;">
        <input type="text" 
               class="import-custom-field-name" 
               placeholder="שם השדה (למשל: רמה, קבוצה)"
               value="${field.name}"
               data-index="${index}">
        <select class="import-field-select" data-index="${index}" style="flex: 1;">
          <option value="">-- בחר עמודה --</option>
          ${headers.map((header, colIndex) => `
            <option value="${colIndex}" ${field.column === colIndex ? 'selected' : ''}>
              ${header || `עמודה ${colIndex + 1}`}
            </option>
          `).join('')}
        </select>
        <button class="import-custom-field-remove" data-index="${index}">הסר</button>
      </div>
    `).join('');
    
    // Attach listeners
    container.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', (e) => {
        const index = parseInt(e.target.dataset.index);
        this.customFields[index].name = e.target.value;
      });
    });
    
    container.querySelectorAll('select').forEach(select => {
      select.addEventListener('change', (e) => {
        const index = parseInt(e.target.dataset.index);
        const value = e.target.value;
        this.customFields[index].column = value === '' ? undefined : parseInt(value);
      });
    });
    
    container.querySelectorAll('.import-custom-field-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        this.customFields.splice(index, 1);
        this.renderCustomFields();
      });
    });
  }
  
  autoMatchFields() {
    if (!this.parsedData || !this.parsedData.headers) return;
    
    // Define matching patterns for each field
    const fieldPatterns = {
      name: ['שם', 'name', 'שם מלא', 'full name', 'fullname', 'student name', 'שם תלמיד'],
      phone: ['טלפון', 'phone', 'טל', 'tel', 'מספר', 'number', 'נייד', 'mobile'],
      birthYear: ['שנת לידה', 'שנה', 'birth year', 'year', 'לידה', 'birth', 'תאריך לידה', 'birthdate'],
      parentName: ['שם הורה', 'parent name', 'הורה', 'parent', 'אב', 'אם', 'father', 'mother'],
      parentPhone: ['טלפון הורה', 'parent phone', 'טל הורה', 'הורה טלפון'],
      parentEmail: ['אימייל הורה', 'parent email', 'email הורה', 'מייל הורה', 'parent mail'],
      address: ['כתובת', 'address', 'מען', 'רחוב', 'street'],
      medicalNotes: ['הערות רפואיות', 'medical', 'רפואי', 'medical notes', 'בריאות', 'health'],
      photoURL: ['תמונה', 'photo', 'url', 'image', 'צילום', 'picture']
    };
    
    const headers = this.parsedData.headers;
    
    // Try to auto-match each field
    Object.keys(fieldPatterns).forEach(field => {
      const patterns = fieldPatterns[field];
      
      // Find best matching header
      let bestMatch = -1;
      let bestScore = 0;
      
      headers.forEach((header, index) => {
        if (!header) return;
        const headerLower = header.toLowerCase().trim();
        
        // Check for exact or partial matches
        patterns.forEach(pattern => {
          const patternLower = pattern.toLowerCase();
          let score = 0;
          
          // Exact match
          if (headerLower === patternLower) {
            score = 100;
          }
          // Contains pattern
          else if (headerLower.includes(patternLower)) {
            score = 80;
          }
          // Pattern contains header
          else if (patternLower.includes(headerLower) && headerLower.length > 2) {
            score = 60;
          }
          // Similar (check if >70% characters match)
          else {
            const similarity = this.calculateSimilarity(headerLower, patternLower);
            if (similarity > 0.7) {
              score = 50;
            }
          }
          
          if (score > bestScore) {
            bestScore = score;
            bestMatch = index;
          }
        });
      });
      
      // Auto-select if confidence is high enough
      if (bestScore >= 50 && this.columnMapping[field] === undefined) {
        this.columnMapping[field] = bestMatch;
        this.autoMatchedFields.push(field);
      }
    });
  }
  
  calculateSimilarity(str1, str2) {
    // Simple similarity calculation based on common characters
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (longer.includes(shorter[i])) {
        matches++;
      }
    }
    
    return matches / longer.length;
  }
  
  async handleFileSelect(file) {
    if (!file) return;
    
    try {
      this.parsedData = await parseImportFile(file);
      this.renderStepContent();
      this.attachStep1Listeners();
    } catch (error) {
      showToast(error.message, 'error');
    }
  }
  
  async handleNext() {
    // If at step 5 and enrollment is complete, close the wizard
    if (this.currentStep === 5 && this.enrollmentComplete) {
      this.onComplete();
      this.close();
      return;
    }
    
    if (this.currentStep === 1) {
      if (!this.parsedData) {
        showToast('אנא בחר קובץ להעלאה', 'error');
        return;
      }
      this.currentStep = 2;
      // Auto-match fields on first entry to step 2
      this.autoMatchFields();
      this.renderStepContent();
    } else if (this.currentStep === 2) {
      // Validate required mappings
      if (this.columnMapping.name === undefined || 
          this.columnMapping.phone === undefined || 
          this.columnMapping.birthYear === undefined) {
        showToast('נא למפות את כל השדות החובה', 'error');
        return;
      }
      
      // Add custom fields to mapping
      if (this.customFields.length > 0) {
        this.columnMapping.customFields = {};
        this.customFields.forEach(field => {
          if (field.name && field.column !== undefined) {
            this.columnMapping.customFields[field.name] = field.column;
          }
        });
      }

      // Proceed to validation (Step 3)
      this.currentStep = 3;
      this.validateAndRender();
    } else if (this.currentStep === 3) {
      const { valid, duplicates } = this.validationResults;
      
      if (valid.length === 0 && duplicates.length === 0) {
        showToast('אין תלמידים תקינים לייבוא', 'error');
        return;
      }
      
      this.currentStep = 4;
      this.renderStepContent();
    } else if (this.currentStep === 4 && this.importResults) {
      // Move to enrollment step (Step 5)
      this.currentStep = 5;
      this.loadCoursesAndClasses();
      // If already in mapped mode, load options
      if (this.enrollmentMode === 'mapped') {
          this.autoPopulateMappedOptions();
      }
      this.renderStepContent();
    } else if (this.currentStep === 5) {
      if (this.enrollmentMode === 'bulk') {
        const totalSelected = this.selectedCourseIds.length + this.selectedClassIds.length;
        if (totalSelected > 0) {
          this.showEnrollmentLoading();
          await new Promise(resolve => setTimeout(resolve, 100));
          await this.enrollStudents();
        } else {
          this.onComplete();
          this.close();
        }
      } else {
        // Mapped enrollment
        this.showEnrollmentLoading();
        await new Promise(resolve => setTimeout(resolve, 100));
        await this.enrollStudents();
      }
    }
  }

  async validateAndRender() {
    // Apply value mappings to create a temporary processed dataset for validation
    const processedRows = this.applyValueMappings();

    // Validate data
    this.validationResults = await validateImportData(
      processedRows, // Use processed rows with IDs
      this.columnMapping,
      this.businessId
    );
    
    // Use requestAnimationFrame to ensure DOM is ready before updating
    await new Promise(resolve => requestAnimationFrame(resolve));
    this.renderStepContent();
  }

  applyValueMappings() {
    // Clone rows to avoid mutating original parsedData
    return this.parsedData.rows.map(row => {
      const newRow = [...row];
      
      Object.keys(this.relationalFields).forEach(field => {
        const colIndex = this.columnMapping[field];
        if (colIndex !== undefined) {
          const originalValue = row[colIndex];
          if (originalValue && this.valueMappings[field] && this.valueMappings[field][originalValue]) {
            const mappedValue = this.valueMappings[field][originalValue];
            // If mapped to __skip__, we might want to handle it. 
            // For now, let's just replace with the ID. 
            // If it's __skip__, maybe we should filter this row out? 
            // Or mark it invalid?
            // Let's replace the value in the row with the ID.
            // Note: validateImportData expects the row to contain the values at the mapped indices.
            // So we replace the string value with the ID.
            if (mappedValue !== '__skip__' && mappedValue !== '__create__') {
               newRow[colIndex] = mappedValue;
            }
          }
        }
      });
      return newRow;
    });
  }

  async loadSystemOptions(forceFields = null) {
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'import-loading-overlay';
    loadingOverlay.innerHTML = '<div class="import-spinner"></div><div style="margin-top: 10px; color: white;">טוען נתונים...</div>';
    document.body.appendChild(loadingOverlay);

    try {
      const promises = [];
      // If forceFields is provided, use it. Otherwise check columnMapping (legacy behavior for other fields if any)
      const fieldsToLoad = forceFields || Object.keys(this.relationalFields).filter(field => 
        this.columnMapping[field] !== undefined
      );

      for (const field of fieldsToLoad) {
        // Skip if already loaded
        if (this.systemOptions[field]) continue;

        const config = this.relationalFields[field];
        if (!config) continue;

        // Dynamic import of service
        const servicePromise = import(`../services/${config.service}.js`)
          .then(module => {
            if (module[config.method]) {
              return module[config.method](this.businessId).then(data => {
                // Handle different return formats (array vs object with array)
                let items = Array.isArray(data) ? data : (data.courses || data.teachers || data.instances || []);
                // Filter active only if possible
                if (items.length > 0 && items[0].isActive !== undefined) {
                  items = items.filter(i => i.isActive);
                }
                
                // OPTIMIZATION: Map to lightweight objects to save memory
                // We pre-calculate the display name to avoid doing it repeatedly
                this.systemOptions[field] = items.map(item => {
                    const name = item[config.nameField] + (config.nameField2 ? ' ' + item[config.nameField2] : '');
                    return {
                        id: item.id,
                        name: name,
                        original: item // Keep original if needed, or remove to be super lean
                    };
                });
              });
            }
          });
        promises.push(servicePromise);
      }

      await Promise.all(promises);
    } catch (error) {
      console.error('Error loading system options:', error);
      showToast('שגיאה בטעינת נתוני מערכת', 'error');
    } finally {
      loadingOverlay.remove();
    }
  }
  
  handlePrev() {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.renderStepContent();
    }
  }
  
  async startImport() {
    // Prevent multiple imports
    if (this.isImporting) {
      console.warn('Import already in progress, skipping');
      return;
    }
    
    this.isImporting = true;
    
    const { valid, duplicates } = this.validationResults;
    
    // Prepare students to import
    const studentsToImport = [...valid];
    
    // Track all duplicates that won't be imported (for enrollment)
    // This includes: explicitly skipped, or no decision made (undefined)
    const skippedDuplicates = [];
    
    // Add duplicates that user chose to update
    duplicates.forEach(dup => {
      if (this.duplicateDecisions[dup.rowIndex] === 'update') {
        studentsToImport.push(dup);
      } else {
        // Keep all non-updated duplicates for enrollment step
        // This includes both explicit 'skip' and undefined (no decision)
        skippedDuplicates.push(dup);
      }
    });
    
    // Store skipped duplicates for enrollment
    this.skippedDuplicates = skippedDuplicates;
    
    if (studentsToImport.length === 0) {
      this.importResults = { success: [], updated: [], failed: [] };
      this.isImporting = false;
      this.renderStepContent();
      // Make sure to update buttons even when no students to import
      this.updateButtons();
      return;
    }
    
    // Import with progress
    const progressFill = document.getElementById('importProgressFill');
    const progressStats = document.getElementById('importProgressStats');
    
    const updateProgress = (current, total) => {
      const percent = (current / total) * 100;
      if (progressFill) progressFill.style.width = `${percent}%`;
      if (progressStats) progressStats.textContent = `${current} / ${total}`;
    };
    
    // Import in batches for better UX
    const batchSize = 10;
    const results = { success: [], updated: [], failed: [] };
    
    try {
      for (let i = 0; i < studentsToImport.length; i += batchSize) {
        const batch = studentsToImport.slice(i, i + batchSize);
        
        const batchResults = await importStudents(batch, this.businessId, {
          updateDuplicates: true
        });
        
        results.success.push(...batchResults.success);
        results.updated.push(...batchResults.updated);
        results.failed.push(...batchResults.failed);
        
        updateProgress(Math.min(i + batchSize, studentsToImport.length), studentsToImport.length);
        
        // Small delay for UI update
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('Error during import:', error);
      // Still set results with what we have so far
    }
    
    this.importResults = results;
    this.isImporting = false;
    this.renderStepContent();
    // Explicitly update buttons after render to ensure they show up
    // Use setTimeout to ensure DOM is fully updated
    setTimeout(() => {
      this.updateButtons();
    }, 100);
  }
  
  updateButtons() {
    const prevBtn = document.getElementById('importPrevBtn');
    const nextBtn = document.getElementById('importNextBtn');
    
    // Safety check: if wizard is closed, don't try to update
    if (!prevBtn || !nextBtn) {
      return;
    }
    
    // Show/hide prev button
    if (this.currentStep === 1 || this.currentStep === 5) {
      prevBtn.style.display = 'none';
    } else {
      prevBtn.style.display = 'block';
    }
    
    // Update next button text and state
    if (this.currentStep === 5) {
      if (this.enrollmentComplete) {
        // Enrollment is complete - button text changes to finish
        nextBtn.textContent = 'סיום';
        nextBtn.disabled = false;
        nextBtn.style.display = 'block';
        nextBtn.style.opacity = '1';
        // Remove click listener and add close listener or just handle in handleNext
        // Actually handleNext checks enrollmentComplete so we are good
      } else if (this.importResults) {
        nextBtn.style.display = 'block';
        nextBtn.textContent = 'המשך לרישום';
        nextBtn.disabled = false;
      } else {
        nextBtn.style.display = 'none';
      }
    } else {
      nextBtn.style.display = 'block';
      nextBtn.textContent = this.currentStep === 4 ? 'יבא תלמידים' : 'המשך';
      nextBtn.disabled = false;
    }
  }
  
  updateStepsIndicator() {
    if (!this.overlay) {
      return;
    }
    
    const stepsContainer = this.overlay.querySelector('.import-wizard-body');
    if (!stepsContainer) {
      return;
    }
    
    const currentSteps = stepsContainer.querySelector('.import-steps');
    if (currentSteps) {
      currentSteps.outerHTML = this.renderSteps();
    }
  }
  
  async loadCoursesAndClasses() {
    try {
      // Initialize pagination state
      if (!this.coursesLastDoc) this.coursesLastDoc = null;
      if (!this.classesLastDoc) this.classesLastDoc = null;
      if (!this.coursesHasMore) this.coursesHasMore = true;
      if (!this.classesHasMore) this.classesHasMore = true;
      
      const [
        { getPaginatedCourses },
        { getPaginatedClassInstances },
        { getAllClassTemplates }
      ] = await Promise.all([
        import('../services/course-service.js'),
        import('../services/class-instance-service.js'),
        import('../services/class-template-service.js')
      ]);
      
      // Load first page of courses and classes (5 items each)
      const [coursesResult, classesResult, templates] = await Promise.all([
        getPaginatedCourses(this.businessId, { isActive: true, limit: 5 }),
        getPaginatedClassInstances(this.businessId, { limit: 5 }),
        getAllClassTemplates(this.businessId)
      ]);
      
      // Store pagination state
      this.coursesLastDoc = coursesResult.lastDoc;
      this.coursesHasMore = coursesResult.hasMore;
      this.classesLastDoc = classesResult.lastDoc;
      this.classesHasMore = classesResult.hasMore;
      
      // Enrich class instances with template names
      this.availableClasses = classesResult.instances
        .filter(c => c.status === 'scheduled' || c.status === 'active')
        .map(instance => ({
          ...instance,
          templateName: templates.find(t => t.id === instance.templateId)?.name || 'שיעור'
        }));
      
      this.availableCourses = coursesResult.courses;
      this.allTemplates = templates; // Store templates for enriching new classes
      this.renderStepContent();
    } catch (error) {
      console.error('Error loading courses and classes:', error);
      this.availableCourses = [];
      this.availableClasses = [];
      this.renderStepContent();
    }
  }
  
  async loadMoreCourses() {
    if (!this.coursesHasMore || !this.coursesLastDoc) return;
    
    try {
      const { getPaginatedCourses } = await import('../services/course-service.js');
      const result = await getPaginatedCourses(this.businessId, { 
        isActive: true, 
        limit: 5,
        startAfterDoc: this.coursesLastDoc
      });
      
      this.availableCourses = [...this.availableCourses, ...result.courses];
      this.coursesLastDoc = result.lastDoc;
      this.coursesHasMore = result.hasMore;
      this.updateEnrollmentList();
    } catch (error) {
      console.error('Error loading more courses:', error);
    }
  }
  
  async loadMoreClasses() {
    if (!this.classesHasMore || !this.classesLastDoc) return;
    
    try {
      const { getPaginatedClassInstances } = await import('../services/class-instance-service.js');
      const result = await getPaginatedClassInstances(this.businessId, { 
        limit: 5,
        startAfterDoc: this.classesLastDoc
      });
      
      const newClasses = result.instances
        .filter(c => c.status === 'scheduled' || c.status === 'active')
        .map(instance => ({
          ...instance,
          templateName: this.allTemplates.find(t => t.id === instance.templateId)?.name || 'שיעור'
        }));
      
      this.availableClasses = [...this.availableClasses, ...newClasses];
      this.classesLastDoc = result.lastDoc;
      this.classesHasMore = result.hasMore;
      this.updateEnrollmentList();
    } catch (error) {
      console.error('Error loading more classes:', error);
    }
  }
  
  attachStep5Listeners() {
    // Mode tabs
    document.querySelectorAll('.import-mode-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const mode = e.currentTarget.dataset.mode;
        if (this.enrollmentMode !== mode) {
          this.enrollmentMode = mode;
          // If switching to mapped, ensure options are loaded
          if (this.enrollmentMode === 'mapped') {
              this.autoPopulateMappedOptions().then(() => {
                  this.renderStepContent();
              });
          } else {
              this.renderStepContent();
          }
        }
      });
    });

    // Column selection for mapped enrollment
    document.querySelectorAll('.enrollment-column-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const field = e.target.dataset.field;
        const value = e.target.value;
        this.columnMapping[field] = value === '' ? undefined : parseInt(value);
        this.renderStepContent();
      });
    });

    // Mapped inputs (custom dropdown handling)
    document.querySelectorAll('.import-value-input').forEach(input => {
      const wrapper = input.closest('.import-input-wrapper');
      const suggestionsList = wrapper.querySelector('.import-suggestions-list');

      const renderSuggestions = (options) => {
        suggestionsList.innerHTML = '';
        
        // Add "Skip" option
        const skipItem = document.createElement('div');
        skipItem.className = 'import-suggestion-item skip';
        skipItem.textContent = '[דלג על שורה זו]';
        skipItem.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Prevent blur
            selectOption('[דלג על שורה זו]');
        });
        suggestionsList.appendChild(skipItem);

        options.forEach(opt => {
            const item = document.createElement('div');
            item.className = 'import-suggestion-item';
            item.textContent = opt.name;
            item.addEventListener('mousedown', (e) => {
                e.preventDefault(); // Prevent blur
                selectOption(opt.name);
            });
            suggestionsList.appendChild(item);
        });

        suggestionsList.style.display = 'block';
      };

      const selectOption = (name) => {
        input.value = name;
        suggestionsList.style.display = 'none';
        // Trigger change event manually
        input.dispatchEvent(new Event('change'));
      };

      input.addEventListener('change', (e) => {
        const field = e.target.dataset.field;
        const fileValue = e.target.dataset.fileValue;
        const inputValue = e.target.value;
        
        let systemId = '';
        
        if (inputValue === '[דלג על שורה זו]') {
            systemId = '__skip__';
        } else {
            // Find option with this name
            const options = this.systemOptions[field] || [];
            const matchedOption = options.find(opt => opt.name === inputValue);
            
            if (matchedOption) {
                systemId = matchedOption.id;
            }
        }
        
        if (!this.valueMappings[field]) {
          this.valueMappings[field] = {};
        }
        this.valueMappings[field][fileValue] = systemId;
      });

      // Add input listener for search
      input.addEventListener('input', this.debounce(async (e) => {
          const field = e.target.dataset.field;
          const term = e.target.value;
          
          if (term.length >= 2) {
              const results = await this.performSearch(field, term);
              renderSuggestions(results);
          } else {
              // Show local options (or just Skip) if search term is short
              const optionsList = this.systemOptions[field] || [];
              const options = term ? 
                   optionsList.filter(o => o.name.toLowerCase().includes(term.toLowerCase())) : 
                   optionsList.slice(0, 50);
              renderSuggestions(options);
          }
      }, 300));

      // Focus event to show results if available
      input.addEventListener('focus', () => {
          const field = input.dataset.field;
          const term = input.value;
          
          const optionsList = this.systemOptions[field] || [];
          
          // Filter locally if term exists, otherwise show first 50
          const options = term ? 
               optionsList.filter(o => o.name.toLowerCase().includes(term.toLowerCase())) : 
               optionsList.slice(0, 50);
          renderSuggestions(options);
      });

      // Blur event to hide
      input.addEventListener('blur', () => {
          suggestionsList.style.display = 'none';
      });
    });

    // Tab switching
    const tabs = document.querySelectorAll('.import-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.enrollmentTab = tab.dataset.tab;
        this.renderStepContent();
      });
    });
    
    // Search inputs
    const courseSearchInput = document.getElementById('courseSearchInput');
    const classSearchInput = document.getElementById('classSearchInput');
    
    if (courseSearchInput) {
      courseSearchInput.addEventListener('input', (e) => {
        this.courseSearchQuery = e.target.value;
        this.updateEnrollmentList();
      });
    }
    
    if (classSearchInput) {
      classSearchInput.addEventListener('input', (e) => {
        this.classSearchQuery = e.target.value;
        this.updateEnrollmentList();
      });
    }
    
    // Load More buttons - fetch from server
    const loadMoreCoursesBtn = document.getElementById('loadMoreCourses');
    const loadMoreClassesBtn = document.getElementById('loadMoreClasses');
    
    if (loadMoreCoursesBtn) {
      loadMoreCoursesBtn.addEventListener('click', async () => {
        loadMoreCoursesBtn.disabled = true;
        loadMoreCoursesBtn.textContent = 'טוען...';
        await this.loadMoreCourses();
        loadMoreCoursesBtn.disabled = false;
      });
    }
    
    if (loadMoreClassesBtn) {
      loadMoreClassesBtn.addEventListener('click', async () => {
        loadMoreClassesBtn.disabled = true;
        loadMoreClassesBtn.textContent = 'טוען...';
        await this.loadMoreClasses();
        loadMoreClassesBtn.disabled = false;
      });
    }
    
    // Make entire item clickable for selection toggle
    this.attachEnrollmentItemListeners();
    
    // Skip button
    const skipBtn = document.getElementById('skipEnrollmentBtn');
    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        this.onComplete();
        this.close();
      });
    }
  }
  
  attachEnrollmentItemListeners() {
    const items = document.querySelectorAll('.import-enrollment-item');
    items.forEach(item => {
      item.addEventListener('click', (e) => {
        const checkbox = item.querySelector('.import-enrollment-checkbox');
        const type = item.dataset.type;
        const id = item.dataset.id;
        
        // Toggle checkbox
        if (e.target.type !== 'checkbox') {
          checkbox.checked = !checkbox.checked;
        }
        
        // Update selection arrays
        if (type === 'course') {
          if (checkbox.checked) {
            if (!this.selectedCourseIds.includes(id)) {
              this.selectedCourseIds.push(id);
            }
          } else {
            this.selectedCourseIds = this.selectedCourseIds.filter(cid => cid !== id);
          }
        } else if (type === 'class') {
          if (checkbox.checked) {
            if (!this.selectedClassIds.includes(id)) {
              this.selectedClassIds.push(id);
            }
          } else {
            this.selectedClassIds = this.selectedClassIds.filter(cid => cid !== id);
          }
        }
        
        // Update visual state
        if (checkbox.checked) {
          item.classList.add('selected');
        } else {
          item.classList.remove('selected');
        }
        
        this.updateButtons();
        this.updateSelectionCount();
      });
    });
  }
  
  updateEnrollmentList() {
    // Update only the list content without re-rendering the entire step
    const listContainer = document.querySelector('.import-enrollment-list');
    if (!listContainer) return;
    
    // Render the appropriate list based on current tab
    if (this.enrollmentTab === 'courses') {
      listContainer.innerHTML = this.renderFilteredCourses();
    } else {
      listContainer.innerHTML = this.renderFilteredClasses();
    }
    
    // Re-attach item listeners
    this.attachEnrollmentItemListeners();
    
    // Re-attach Load More listeners
    const loadMoreCoursesBtn = document.getElementById('loadMoreCourses');
    const loadMoreClassesBtn = document.getElementById('loadMoreClasses');
    
    if (loadMoreCoursesBtn) {
      loadMoreCoursesBtn.addEventListener('click', () => {
        this.coursesDisplayLimit += 5;
        this.updateEnrollmentList();
      });
    }
    
    if (loadMoreClassesBtn) {
      loadMoreClassesBtn.addEventListener('click', () => {
        this.classesDisplayLimit += 5;
        this.updateEnrollmentList();
      });
    }
  }
  
  updateSelectionCount() {
    const countElement = document.querySelector('.import-selection-count');
    const infoElement = document.querySelector('.import-selection-info');
    const totalSelected = this.selectedCourseIds.length + this.selectedClassIds.length;
    
    if (countElement && infoElement) {
      countElement.textContent = totalSelected;
      infoElement.style.display = totalSelected > 0 ? 'block' : 'none';
    }
  }
  
  showEnrollmentLoading() {
    const content = document.getElementById('importWizardContent');
    if (!content) {
      console.error('Cannot show loading - content element not found');
      return;
    }
    
    const totalStudents = [...this.importResults.success, ...this.importResults.updated, ...this.skippedDuplicates].length;
    const totalTargets = this.selectedCourseIds.length + this.selectedClassIds.length;
    
    console.log('Showing enrollment loading screen...');
    
    content.innerHTML = `
      <div class="import-progress-container">
        <div class="import-progress-icon loading">
          <div class="import-spinner"></div>
        </div>
        <div class="import-progress-title">רושם תלמידים...</div>
        <div class="import-progress-subtitle">מעבד ${totalStudents} תלמידים ל-${totalTargets} ${totalTargets === 1 ? 'קורס/שיעור' : 'קורסים/שיעורים'}</div>
        <div class="import-progress-bar">
          <div class="import-progress-fill" id="enrollmentProgressFill" style="width: 0%"></div>
        </div>
        <div class="import-loading-message" id="enrollmentProgressText">מתחיל...</div>
      </div>
    `;
    
    // Disable next/prev buttons during enrollment
    const nextBtn = document.getElementById('importNextBtn');
    const prevBtn = document.getElementById('importPrevBtn');
    if (nextBtn) {
      nextBtn.disabled = true;
      nextBtn.style.opacity = '0.5';
    }
    if (prevBtn) {
      prevBtn.disabled = true;
      prevBtn.style.display = 'none';
    }
  }
  
  updateEnrollmentProgress(processed, total, currentTarget) {
    const progressFill = document.getElementById('enrollmentProgressFill');
    const progressText = document.getElementById('enrollmentProgressText');
    
    if (progressFill && progressText) {
      const percentage = Math.round((processed / total) * 100);
      progressFill.style.width = `${percentage}%`;
      progressText.textContent = `${processed} מתוך ${total} רישומים | מעבד: ${currentTarget}`;
    }
  }
  
  async enrollStudents() {
    const { enrollStudentInCourse } = await import('../services/enrollment-service.js');
    const { addStudentToInstance } = await import('../services/class-instance-service.js');
    
    // Include both newly imported students and existing students (skipped duplicates)
    const newStudents = [...this.importResults.success, ...this.importResults.updated];
    const existingStudents = (this.skippedDuplicates || []).map(dup => {
        // Ensure we preserve the wrapper properties like rowIndex if needed, 
        // but for enrollment we need the student ID which is in dup.duplicate.id
        // We also need rowIndex which is on dup.rowIndex
        // So let's attach rowIndex to the student object if it's missing
        const student = { ...dup.duplicate };
        if (student.rowIndex === undefined) student.rowIndex = dup.rowIndex;
        return student;
    }).filter(s => s);
    
    const allStudents = [...newStudents, ...existingStudents];
    
    const overallResults = {
      successfulEnrollments: 0,
      alreadyEnrolled: 0,
      failed: [],
      details: [] // Per-course/class breakdown
    };

    if (this.enrollmentMode === 'bulk') {
        console.log('Enrolling students (Bulk):', allStudents.length);
        console.log('Selected courses:', this.selectedCourseIds);
        console.log('Selected classes:', this.selectedClassIds);
        
        const totalEnrollments = allStudents.length * (this.selectedCourseIds.length + this.selectedClassIds.length);
        let processedEnrollments = 0;
        
        // Enroll in courses
        for (const courseId of this.selectedCourseIds) {
          const course = this.availableCourses.find(c => c.id === courseId);
          const courseName = course ? course.name : 'קורס';
          const courseResults = {
            type: 'course',
            name: courseName,
            successful: 0,
            alreadyEnrolled: 0,
            failed: [],
            totalStudents: allStudents.length
          };
          
          
          for (const student of allStudents) {
            try {
              await enrollStudentInCourse(this.businessId, courseId, student.id, new Date());
              overallResults.successfulEnrollments++;
              courseResults.successful++;
            } catch (error) {
              console.error(`Failed to enroll ${student.firstName} in ${courseName}:`, error);
              if (error.message === 'התלמיד כבר רשום לקורס זה') {
                overallResults.alreadyEnrolled++;
                courseResults.alreadyEnrolled++;
              } else {
                overallResults.failed.push({ 
                  studentName: `${student.firstName} ${student.lastName}`,
                  targetName: courseName,
                  error: error.message 
                });
                courseResults.failed.push({
                  studentName: `${student.firstName} ${student.lastName}`,
                  error: error.message
                });
              }
            }
            
            // Update progress
            processedEnrollments++;
            this.updateEnrollmentProgress(Math.min(processedEnrollments, totalEnrollments), totalEnrollments, courseName);
          }
          
          overallResults.details.push(courseResults);
        }
          
          // Enroll in class instances
          for (const classId of this.selectedClassIds) {
            const classInstance = this.availableClasses.find(c => c.id === classId);
            const className = classInstance ? classInstance.templateName : 'שיעור';
            const classResults = {
              type: 'class',
              name: className,
              successful: 0,
              alreadyEnrolled: 0,
              failed: [],
              totalStudents: allStudents.length
            };
            
            for (const student of allStudents) {
              try {
                await addStudentToInstance(this.businessId, classId, student.id);
                // Check if already enrolled logic...
                const classInstance = this.availableClasses.find(c => c.id === classId);
                const wasAlreadyEnrolled = classInstance && classInstance.studentIds && classInstance.studentIds.includes(student.id);
                
                if (wasAlreadyEnrolled) {
                  overallResults.alreadyEnrolled++;
                  classResults.alreadyEnrolled++;
                } else {
                  overallResults.successfulEnrollments++;
                  classResults.successful++;
                }
              } catch (error) {
                console.error(`Failed to add ${student.firstName} to ${className}:`, error);
                overallResults.failed.push({ 
                  studentName: `${student.firstName} ${student.lastName}`,
                  targetName: className,
                  error: error.message || 'שגיאה לא ידועה'
                });
                classResults.failed.push({
                  studentName: `${student.firstName} ${student.lastName}`,
                  error: error.message || 'שגיאה לא ידועה'
                });
              }
              
              // Update progress
              processedEnrollments++;
              this.updateEnrollmentProgress(processedEnrollments, totalEnrollments, className);
            }
            
            overallResults.details.push(classResults);
          }
        } else {
            // Mapped enrollment
            console.log('Enrolling students (Mapped):', allStudents.length);
            
            const courseResultsMap = {}; // courseId -> result object
            const classResultsMap = {}; // classId -> result object
            
            // Helper to get or create result object
            const getCourseResult = (id, name) => {
                if (!courseResultsMap[id]) {
                    courseResultsMap[id] = {
                        type: 'course',
                        name: name,
                        successful: 0,
                        alreadyEnrolled: 0,
                        failed: [],
                        totalStudents: 0
                    };
                }
                return courseResultsMap[id];
            };
            
            const getClassResult = (id, name) => {
                if (!classResultsMap[id]) {
                    classResultsMap[id] = {
                        type: 'class',
                        name: name,
                        successful: 0,
                        alreadyEnrolled: 0,
                        failed: [],
                        totalStudents: 0
                    };
                }
                return classResultsMap[id];
            };

            let processedCount = 0;
            // Estimate total operations (assuming 1 course + 1 class per student max for progress bar)
            const totalOperations = allStudents.length * 2; 

            for (const student of allStudents) {
                let rowIndex = student.rowIndex;
                if (rowIndex === undefined) {
                    processedCount += 2; // Skip progress
                    continue;
                }
                
                // rowIndex is 1-based from validation (header is 1, first data is 2)
                // parsedData.rows is 0-indexed array of data rows
                // So row index 2 corresponds to parsedData.rows[0]
                const row = this.parsedData.rows[rowIndex - 2];
                if (!row) {
                    processedCount += 2;
                    continue;
                }
                
                // Handle Course Enrollment
                if (this.columnMapping.courseId !== undefined) {
                    const rawVal = row[this.columnMapping.courseId];
                    if (rawVal && this.valueMappings.courseId && this.valueMappings.courseId[rawVal]) {
                        const courseId = this.valueMappings.courseId[rawVal];
                        if (courseId && courseId !== '__skip__' && courseId !== '__create__') {
                            // Find course name
                            const courseOpt = this.systemOptions.courseId?.find(c => c.id === courseId);
                            const courseName = courseOpt ? courseOpt.name : 'Unknown Course';
                            const result = getCourseResult(courseId, courseName);
                            result.totalStudents++;
                            
                            try {
                                await enrollStudentInCourse(this.businessId, courseId, student.id, new Date());
                                overallResults.successfulEnrollments++;
                                result.successful++;
                            } catch (error) {
                                 if (error.message === 'התלמיד כבר רשום לקורס זה') {
                                    overallResults.alreadyEnrolled++;
                                    result.alreadyEnrolled++;
                                } else {
                                    overallResults.failed.push({ 
                                        studentName: `${student.firstName} ${student.lastName}`,
                                        targetName: courseName,
                                        error: error.message 
                                    });
                                    result.failed.push({
                                        studentName: `${student.firstName} ${student.lastName}`,
                                        error: error.message
                                    });
                                }
                            }
                        }
                    }
                }
                
                // Handle Class Enrollment
                if (this.columnMapping.classId !== undefined) {
                    const rawVal = row[this.columnMapping.classId];
                    if (rawVal && this.valueMappings.classId && this.valueMappings.classId[rawVal]) {
                        const classId = this.valueMappings.classId[rawVal];
                        if (classId && classId !== '__skip__' && classId !== '__create__') {
                            // Find class name
                            const classOpt = this.systemOptions.classId?.find(c => c.id === classId);
                            const className = classOpt ? classOpt.name : 'Unknown Class';
                            const result = getClassResult(classId, className);
                            result.totalStudents++;
                            
                            try {
                                await addStudentToInstance(this.businessId, classId, student.id);
                                overallResults.successfulEnrollments++;
                                result.successful++;
                            } catch (error) {
                                 overallResults.failed.push({ 
                                    studentName: `${student.firstName} ${student.lastName}`,
                                    targetName: className,
                                    error: error.message 
                                });
                                result.failed.push({
                                    studentName: `${student.firstName} ${student.lastName}`,
                                    error: error.message
                                });
                            }
                        }
                    }
                }
                
                processedCount += 2; // Approximate progress
                this.updateEnrollmentProgress(Math.min(processedCount, totalOperations), totalOperations, `תלמיד ${rowIndex}`);
            }
            
            overallResults.details = [...Object.values(courseResultsMap), ...Object.values(classResultsMap)];
        }
    
    console.log('Enrollment completed:', overallResults);
    this.enrollmentResults = overallResults;
    this.enrollmentComplete = true;
    this.renderStepContent();
  }
  
  formatCourseDate(date) {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  
  close() {
    this.overlay.remove();
  }
}
