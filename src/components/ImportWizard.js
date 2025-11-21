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

export class ImportWizard {
  constructor(businessId, onComplete, courseId = null) {
    this.businessId = businessId;
    this.onComplete = onComplete;
    this.courseId = courseId; // Optional: for direct course enrollment
    this.currentStep = 1;
    this.parsedData = null;
    this.columnMapping = {};
    this.customFields = [];
    this.validationResults = null;
    this.duplicateDecisions = {}; // {rowIndex: 'skip' | 'update'}
    this.isImporting = false; // Prevent duplicate imports
    
    this.render();
    this.attachEventListeners();
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
      { number: 4, label: 'יבוא' }
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
    
    return `
      <label class="import-field-label ${required ? 'required' : ''}">${label}</label>
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
  
  async handleFileSelect(file) {
    if (!file) return;
    
    try {
      this.parsedData = await parseImportFile(file);
      this.renderStepContent();
      this.attachStep1Listeners();
    } catch (error) {
      alert(error.message);
    }
  }
  
  async handleNext() {
    if (this.currentStep === 1) {
      if (!this.parsedData) {
        alert('אנא בחר קובץ להעלאה');
        return;
      }
      this.currentStep = 2;
      this.renderStepContent();
    } else if (this.currentStep === 2) {
      // Validate required mappings
      if (this.columnMapping.name === undefined || 
          this.columnMapping.phone === undefined || 
          this.columnMapping.birthYear === undefined) {
        alert('נא למפות את כל השדות החובה');
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
      
      // Validate data
      this.validationResults = await validateImportData(
        this.parsedData.rows,
        this.columnMapping,
        this.businessId
      );
      
      this.currentStep = 3;
      // Use requestAnimationFrame to ensure DOM is ready before updating
      await new Promise(resolve => requestAnimationFrame(resolve));
      this.renderStepContent();
    } else if (this.currentStep === 3) {
      const { valid, duplicates } = this.validationResults;
      
      if (valid.length === 0 && duplicates.length === 0) {
        alert('אין תלמידים תקינים לייבוא');
        return;
      }
      
      this.currentStep = 4;
      this.renderStepContent();
    } else if (this.currentStep === 4 && this.importResults) {
      this.onComplete();
      this.close();
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
    
    console.log('Starting import process...');
    this.isImporting = true;
    
    const { valid, duplicates } = this.validationResults;
    
    // Prepare students to import
    const studentsToImport = [...valid];
    
    // Add duplicates that user chose to update
    duplicates.forEach(dup => {
      if (this.duplicateDecisions[dup.rowIndex] === 'update') {
        studentsToImport.push(dup);
      }
    });
    
    if (studentsToImport.length === 0) {
      this.importResults = { success: [], updated: [], failed: [] };
      this.isImporting = false;
      this.renderStepContent();
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
    
    this.importResults = results;
    this.isImporting = false;
    console.log('Import completed:', results);
    this.renderStepContent();
  }
  
  updateButtons() {
    const prevBtn = document.getElementById('importPrevBtn');
    const nextBtn = document.getElementById('importNextBtn');
    
    // Safety check: if wizard is closed, don't try to update
    if (!prevBtn || !nextBtn) {
      return;
    }
    
    // Show/hide prev button
    if (this.currentStep === 1 || this.currentStep === 4) {
      prevBtn.style.display = 'none';
    } else {
      prevBtn.style.display = 'block';
    }
    
    // Update next button text and state
    if (this.currentStep === 4) {
      if (this.importResults) {
        nextBtn.textContent = 'סיום';
      } else {
        nextBtn.style.display = 'none';
      }
    } else {
      nextBtn.style.display = 'block';
      nextBtn.textContent = this.currentStep === 3 ? 'יבא תלמידים' : 'המשך';
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
  
  close() {
    this.overlay.remove();
  }
}
