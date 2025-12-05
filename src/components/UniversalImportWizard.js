import '../styles/import-wizard.css';
import { parseImportFile, getSampleData } from '../services/import-service.js';
import { showToast } from './modal.js';

/**
 * Universal Import Wizard Component
 * Generic multi-step wizard for importing data from Excel/CSV
 */
export class UniversalImportWizard {
  /**
   * @param {string} businessId - Business ID
   * @param {Object} config - Configuration object
   * @param {string} config.title - Wizard title
   * @param {Array} config.requiredFields - Array of { key, label }
   * @param {Array} config.optionalFields - Array of { key, label }
   * @param {Function} config.validate - Function(rows, columnMapping, businessId) -> Promise<{valid, invalid, duplicates}>
   * @param {Function} config.importData - Function(items, businessId) -> Promise<{success, failed}>
   * @param {Function} onComplete - Callback when done
   */
  constructor(businessId, config, onComplete) {
    this.businessId = businessId;
    this.config = config;
    this.onComplete = onComplete;
    
    this.currentStep = 1;
    this.parsedData = null;
    this.columnMapping = {};
    this.valueMappings = {}; // { field: { 'fileValue': 'systemId' } }
    this.systemOptions = {}; // { field: [options] }
    this.validationResults = null;
    this.importResults = null;
    this.isImporting = false;
    this.autoMatchedFields = [];

    this.render();
    this.attachEventListeners();
  }

  get steps() {
    const steps = [
      { number: 1, label: 'העלאת קובץ' },
      { number: 2, label: 'מיפוי עמודות' }
    ];

    // Add Value Mapping step if relational fields exist
    if (this.config.relationalFields) {
      steps.push({ number: 3, label: 'מיפוי ערכים' });
    }

    steps.push({ number: steps.length + 1, label: 'אימות נתונים' });
    steps.push({ number: steps.length + 1, label: 'יבוא' });

    return steps;
  }

  render() {
    const overlay = document.createElement('div');
    overlay.className = 'import-wizard-overlay';
    overlay.innerHTML = `
      <div class="import-wizard">
        <div class="import-wizard-header">
          <h2 class="import-wizard-title">${this.config.title || 'יבוא נתונים'}</h2>
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
    return `
      <div class="import-steps">
        ${this.steps.map((step, index) => `
          <div class="import-step ${step.number === this.currentStep ? 'active' : ''} ${step.number < this.currentStep ? 'completed' : ''}">
            <div class="import-step-number">${step.number}</div>
            <div class="import-step-label">${step.label}</div>
          </div>
          ${index < this.steps.length - 1 ? '<div class="import-step-divider"></div>' : ''}
        `).join('')}
      </div>
    `;
  }
  
  renderStepContent() {
    const content = document.getElementById('importWizardContent');
    if (!content) return;
    
    // Determine current step type based on dynamic steps
    const stepType = this.getStepType(this.currentStep);

    switch (stepType) {
      case 'upload':
        content.innerHTML = this.renderStep1();
        break;
      case 'columnMapping':
        content.innerHTML = this.renderStep2();
        this.attachStep2Listeners();
        break;
      case 'valueMapping':
        content.innerHTML = this.renderStepValueMapping();
        this.attachStepValueMappingListeners();
        break;
      case 'validation':
        content.innerHTML = this.renderStep3();
        break;
      case 'import':
        content.innerHTML = this.renderStep4();
        if (!this.isImporting && !this.importResults) {
          this.startImport();
        }
        break;
    }
    
    this.updateButtons();
    this.updateStepsIndicator();
  }

  getStepType(stepNumber) {
    const hasValueMapping = !!this.config.relationalFields;
    
    if (stepNumber === 1) return 'upload';
    if (stepNumber === 2) return 'columnMapping';
    
    if (hasValueMapping) {
      if (stepNumber === 3) return 'valueMapping';
      if (stepNumber === 4) return 'validation';
      if (stepNumber === 5) return 'import';
    } else {
      if (stepNumber === 3) return 'validation';
      if (stepNumber === 4) return 'import';
    }
    return null;
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
    
    // Helper to format cell for preview
    const formatCell = (cell, colIndex) => {
      if (typeof cell === 'number') {
        const header = (sample.headers[colIndex] || '').toLowerCase();
        const isDateOrTimeHeader = /time|date|שעה|תאריך|התחלה|סיום|start|end/i.test(header);
        
        if (isDateOrTimeHeader) {
          // Time fraction (0 <= n < 1)
          if (cell >= 0 && cell < 1) {
            const totalMinutes = Math.round(cell * 24 * 60);
            const hours = Math.floor(totalMinutes / 60) % 24;
            const minutes = totalMinutes % 60;
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
          } 
          // Excel Date (> 10000, roughly year 1927+)
          else if (cell > 10000) {
            const date = new Date(Math.round((cell - 25569) * 86400 * 1000));
            if (!isNaN(date.getTime())) {
              return date.toLocaleDateString('he-IL');
            }
          }
        }
      }
      return cell !== undefined && cell !== null ? cell : '';
    };
    
    return `
      <div class="import-mapping-section">
        <div class="import-mapping-header">שדות חובה</div>
        <div class="import-mapping-description">יש למפות את השדות הבאים מהקובץ שלך:</div>
        <div class="import-mapping-grid">
          ${this.config.requiredFields.map(f => this.renderFieldMapping(f, true)).join('')}
        </div>
      </div>
      
      ${this.config.optionalFields && this.config.optionalFields.length > 0 ? `
        <div class="import-mapping-section">
          <div class="import-mapping-header">שדות אופציונליים</div>
          <div class="import-mapping-grid">
            ${this.config.optionalFields.map(f => this.renderFieldMapping(f, false)).join('')}
          </div>
        </div>
      ` : ''}

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
                ${row.map((cell, i) => `<td>${formatCell(cell, i)}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${sample.totalRows > 5 ? `<p style="margin-top: 8px; font-size: 13px; color: var(--text-secondary);">מציג 5 שורות מתוך ${sample.totalRows}</p>` : ''}
      </div>
    `;
  }
  
  renderFieldMapping(fieldConfig, required) {
    const { key: field, label, description } = fieldConfig;
    const value = this.columnMapping[field];
    const headers = this.parsedData.headers;
    const wasAutoMatched = this.autoMatchedFields && this.autoMatchedFields.includes(field);
    
    return `
      <div class="import-field-label-container">
        <label class="import-field-label ${required ? 'required' : ''}">
          ${label}
          ${wasAutoMatched ? '<span class="import-auto-match-badge">✓ זוהה אוטומטית</span>' : ''}
        </label>
        ${description ? `<div class="import-field-description" style="font-size: 12px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">${description}</div>` : ''}
      </div>
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
        ${duplicates && duplicates.length > 0 ? `
        <div class="import-validation-stat warning">
          <div class="import-validation-number">${duplicates.length}</div>
          <div class="import-validation-label">כפולים</div>
        </div>` : ''}
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
      
      ${valid.length > 0 ? `
        <div class="import-mapping-section">
          <div class="import-mapping-header">רשומות חדשות (${valid.length})</div>
          <div class="import-mapping-description">רשומות אלו ייווצרו במערכת:</div>
          <div class="import-validation-list" style="max-height: 200px;">
            ${valid.slice(0, 10).map(item => this.renderValidationItem(item, 'valid')).join('')}
            ${valid.length > 10 ? `<div style="padding: 16px; text-align: center; color: var(--text-secondary);">ועוד ${valid.length - 10} רשומות...</div>` : ''}
          </div>
        </div>
      ` : ''}
    `;
  }
  
  renderValidationItem(item, type) {
    // Try to find a meaningful name/identifier
    const name = item.extracted?.name || item.extracted?.firstName || 'ללא שם';
    
    return `
      <div class="import-validation-item">
        <div class="import-validation-item-header">
          <span class="import-validation-item-row">שורה ${item.rowIndex}</span>
        </div>
        <div class="import-validation-item-data">${name}</div>
        
        ${type === 'error' ? `
          <div class="import-validation-item-errors">
            ${item.errors.map(err => `<div class="import-validation-error">❌ ${err}</div>`).join('')}
          </div>
        ` : ''}
        
        ${item.warnings && item.warnings.length > 0 ? `
          <div class="import-validation-item-errors">
            ${item.warnings.map(warn => `<div class="import-validation-warning">⚠️ ${warn}</div>`).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }
  
  renderStep4() {
    if (this.importResults) {
      const { success, failed } = this.importResults;
      const total = success.length + failed.length;
      
      return `
        <div class="import-progress-container">
          <div class="import-progress-icon success">✓</div>
          <div class="import-progress-title">היבוא הושלם!</div>
          
          <div class="import-results-summary">
            <div class="import-result-stat">
              <div class="import-result-number">${success.length}</div>
              <div class="import-result-label">נוצרו</div>
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
        <div class="import-progress-title">מיבא נתונים...</div>
        <div class="import-progress-subtitle">אנא המתן, זה עשוי לקחת מספר רגעים</div>
        <div class="import-progress-bar">
          <div class="import-progress-fill" id="importProgressFill" style="width: 0%"></div>
        </div>
        <div class="import-progress-stats" id="importProgressStats">0 / 0</div>
      </div>
    `;
  }
  
  attachEventListeners() {
    this.overlay.querySelector('.import-wizard-close').addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });
    
    document.getElementById('importNextBtn').addEventListener('click', () => this.handleNext());
    document.getElementById('importPrevBtn').addEventListener('click', () => this.handlePrev());
    
    if (this.currentStep === 1) this.attachStep1Listeners();
  }
  
  attachStep1Listeners() {
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');
    const changeFileBtn = document.getElementById('changeFileBtn');
    
    if (fileInput) {
      fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files[0]));
    }
    
    if (uploadArea) {
      uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
      });
      uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
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
    document.querySelectorAll('.import-field-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const field = e.target.dataset.field;
        const value = e.target.value;
        this.columnMapping[field] = value === '' ? undefined : parseInt(value);
      });
    });
  }
  
  renderStepValueMapping() {
    const mappedFields = Object.keys(this.config.relationalFields || {}).filter(field => 
      this.columnMapping[field] !== undefined
    );

    if (mappedFields.length === 0) {
      return '<div class="import-empty-state">לא נבחרו שדות למיפוי ערכים. לחץ על "המשך".</div>';
    }

    // Build hierarchy
    const childrenMap = {}; // parent -> [children]
    const roots = [];

    mappedFields.forEach(field => {
      const config = this.config.relationalFields[field];
      if (config.dependsOn && mappedFields.includes(config.dependsOn)) {
        if (!childrenMap[config.dependsOn]) childrenMap[config.dependsOn] = [];
        childrenMap[config.dependsOn].push(field);
      } else {
        roots.push(field);
      }
    });

    let html = `
      <div class="import-mapping-description">
        זיהינו שדות מערכת בקובץ שלך. אנא התאם את הערכים מהקובץ לאפשרויות הקיימות במערכת.
      </div>
    `;

    roots.forEach(rootField => {
      const rootConfig = this.config.relationalFields[rootField];
      const rootColIndex = this.columnMapping[rootField];
      const rootValues = this.getUniqueValues(rootColIndex, rootConfig.separator);
      const childFields = childrenMap[rootField] || [];
      
      // Initialize mapping if needed
      if (!this.valueMappings[rootField]) this.valueMappings[rootField] = {};

      html += `
        <div class="import-mapping-section">
          <div class="import-mapping-header">מיפוי ${rootConfig.label}</div>
          <table class="import-value-mapping-table">
            <thead>
              <tr>
                <th>ערך בקובץ (${this.parsedData.headers[rootColIndex]})</th>
                <th>התאמה במערכת</th>
              </tr>
            </thead>
            <tbody>
      `;

      rootValues.forEach(rootValue => {
        // Render Root Row
        html += this.renderMappingRow(rootField, rootValue, rootConfig);

        // Render Children
        if (childFields.length > 0) {
           childFields.forEach(childField => {
             const childConfig = this.config.relationalFields[childField];
             const childColIndex = this.columnMapping[childField];
             
             // Initialize mapping
             if (!this.valueMappings[childField]) this.valueMappings[childField] = {};

             // Find values of childField associated with this rootValue
             const childValues = new Set();
             this.parsedData.rows.forEach(row => {
                // Loose comparison for root value match
                if (String(row[rootColIndex]).trim() === rootValue) {
                   const val = row[childColIndex];
                   if (val && String(val).trim() !== '') {
                      childValues.add(String(val).trim());
                   }
                }
             });

             // Render child rows
             childValues.forEach(childValue => {
                // Pass the parent value (rootValue) explicitly to handle filtering
                html += this.renderMappingRow(childField, childValue, childConfig, true, rootField, rootValue);
             });
           });
        }
      });

      html += `</tbody></table></div>`;
    });

    return html;
  }

  renderMappingRow(field, value, config, isChild = false, parentField = null, parentValue = null) {
      const options = this.systemOptions[field] || [];
      let filteredOptions = options;
      let parentHint = '';
      let canAutoMatch = true;

      // Handle dependency filtering
      if (isChild && parentField && parentValue) {
          const parentSystemId = this.valueMappings[parentField]?.[parentValue];
          
          if (parentSystemId && parentSystemId !== '__skip__') {
               filteredOptions = options.filter(o => o.original[config.filterField] === parentSystemId);
          } else {
               parentHint = ' (יש למפות את שדה האב תחילה)';
               canAutoMatch = false;
          }
      }

      const currentValue = this.valueMappings[field][value] || '';
      const autoMatch = (!currentValue && canAutoMatch) ? this.findBestMatch(value, filteredOptions, config) : null;
      const selectedValue = currentValue || (autoMatch ? autoMatch.id : '');
      
      if (autoMatch && !currentValue) {
        this.valueMappings[field][value] = autoMatch.id;
      }

      let selectedName = '';
      if (selectedValue === '__skip__') {
        selectedName = '[דלג על שורה זו]';
      } else if (selectedValue) {
        const selectedOption = options.find(o => o.id === selectedValue);
        if (selectedOption) selectedName = selectedOption.name;
      }

      const indentStyle = isChild ? 'padding-right: 40px; border-right: 3px solid var(--primary-color);' : '';
      const rowStyle = isChild ? 'background-color: #f9f9f9;' : '';
      const safeValue = value.replace(/"/g, '&quot;');
      const rowClass = isChild ? 'mapping-row-child' : 'mapping-row-parent';

      return `
        <tr class="${rowClass}">
          <td class="mapping-label-cell">
            <div class="mapping-label-content">
                ${isChild ? '<span class="mapping-child-indicator"></span>' : ''}
                <span class="mapping-value-text">${value}</span>
            </div>
          </td>
          <td>
            <div class="search-select-container" data-field="${field}" data-file-value="${safeValue}">
              <input type="text" class="search-select-input" 
                     placeholder="בחר ${config.label}..." 
                     value="${selectedName}" 
                     readonly>
              <div class="search-select-dropdown" style="display: none;">
                <div class="search-select-option skip" data-value="__skip__">[דלג על שורה זו]</div>
                ${filteredOptions.map(opt => {
                  return `<div class="search-select-option ${selectedValue === opt.id ? 'selected' : ''}" data-value="${opt.id}">${opt.name}</div>`;
                }).join('')}
              </div>
            </div>
            ${autoMatch && !currentValue ? '<span class="import-auto-match-badge" style="margin-right: 8px;">✓ זוהה</span>' : ''}
            ${parentHint ? `<span style="font-size: 0.8em; color: #f57c00; margin-right: 5px;">${parentHint}</span>` : ''}
          </td>
        </tr>
      `;
  }

  getUniqueValues(colIndex, separator = null) {
    if (!this.parsedData || !this.parsedData.rows) return [];
    const values = new Set();
    this.parsedData.rows.forEach(row => {
      const val = row[colIndex];
      if (val && typeof val === 'string' && val.trim() !== '') {
        if (separator) {
          val.split(separator).forEach(part => {
            if (part.trim() !== '') values.add(part.trim());
          });
        } else {
          values.add(val.trim());
        }
      }
    });
    return Array.from(values).sort();
  }

  findBestMatch(fileValue, options, config) {
    if (!fileValue || !options) return null;
    const normalizedFileValue = fileValue.toLowerCase().trim();
    
    // 1. Exact match
    const exact = options.find(opt => {
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
    // Close all dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-select-container')) {
        document.querySelectorAll('.search-select-dropdown').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.search-select-input').forEach(el => el.setAttribute('readonly', true));
      }
    });

    document.querySelectorAll('.search-select-container').forEach(container => {
      const input = container.querySelector('.search-select-input');
      const dropdown = container.querySelector('.search-select-dropdown');
      const field = container.dataset.field;
      const fileValue = container.dataset.fileValue;

      // Toggle dropdown on input click
      input.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close others
        document.querySelectorAll('.search-select-dropdown').forEach(el => {
          if (el !== dropdown) el.style.display = 'none';
        });
        
        const isVisible = dropdown.style.display === 'block';
        dropdown.style.display = isVisible ? 'none' : 'block';
        
        if (!isVisible) {
          input.removeAttribute('readonly');
          input.focus();
          input.select();
          // Reset filter
          dropdown.querySelectorAll('.search-select-option').forEach(opt => opt.style.display = 'block');
        }
      });

      // Filter options on typing
      input.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        dropdown.querySelectorAll('.search-select-option').forEach(opt => {
          const text = opt.textContent.toLowerCase();
          opt.style.display = text.includes(term) ? 'block' : 'none';
        });
      });

      // Select option
      dropdown.querySelectorAll('.search-select-option').forEach(option => {
        option.addEventListener('click', (e) => {
          e.stopPropagation();
          const value = option.dataset.value;
          const text = option.textContent;
          
          // Update mapping
          if (!this.valueMappings[field]) {
            this.valueMappings[field] = {};
          }
          this.valueMappings[field][fileValue] = value;
          
          // Update ALL inputs for this field/value (sync duplicates)
          // We use a more robust selector or iteration to avoid issues with quotes in fileValue
          document.querySelectorAll(`.search-select-container[data-field="${field}"]`).forEach(container => {
             if (container.dataset.fileValue === fileValue) {
                 const inp = container.querySelector('.search-select-input');
                 inp.value = text;
                 inp.setAttribute('readonly', true);
                 
                 // Update dropdown selection state
                 container.querySelectorAll('.search-select-option').forEach(opt => {
                     if (opt.dataset.value === value) {
                         opt.classList.add('selected');
                     } else {
                         opt.classList.remove('selected');
                     }
                 });
             }
          });
          
          // Close dropdown
          dropdown.style.display = 'none';
          
          // Check if this field is a dependency for others and re-render if so
          const isDependency = Object.values(this.config.relationalFields || {}).some(c => c.dependsOn === field);
          if (isDependency) {
             this.renderStepContent();
          }
        });
      });
    });
  }

  async loadSystemOptions() {
    if (!this.config.relationalFields) return;

    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'import-loading-overlay';
    loadingOverlay.innerHTML = '<div class="import-spinner"></div><div style="margin-top: 10px; color: white;">טוען נתונים...</div>';
    document.body.appendChild(loadingOverlay);

    try {
      const promises = [];
      const fieldsToLoad = Object.keys(this.config.relationalFields).filter(field => 
        this.columnMapping[field] !== undefined
      );

      for (const field of fieldsToLoad) {
        // Skip if already loaded
        if (this.systemOptions[field]) continue;

        const config = this.config.relationalFields[field];
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
                
                this.systemOptions[field] = items.map(item => {
                    const name = item[config.nameField] + (config.nameField2 ? ' ' + item[config.nameField2] : '');
                    return {
                        id: item.id,
                        name: name,
                        original: item
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

  applyValueMappings() {
    // Clone rows to avoid mutating original parsedData
    return this.parsedData.rows.map(row => {
      const newRow = [...row];
      
      if (this.config.relationalFields) {
        Object.keys(this.config.relationalFields).forEach(field => {
          const colIndex = this.columnMapping[field];
          if (colIndex !== undefined) {
            const config = this.config.relationalFields[field];
            const originalValue = row[colIndex];
            
            if (config.separator && typeof originalValue === 'string') {
               const parts = originalValue.split(config.separator);
               const mappedParts = [];
               parts.forEach(part => {
                   const lookupValue = part.trim();
                   if (lookupValue && this.valueMappings[field] && this.valueMappings[field][lookupValue]) {
                       const mappedValue = this.valueMappings[field][lookupValue];
                       if (mappedValue !== '__skip__') {
                           mappedParts.push(mappedValue);
                       }
                   }
               });
               if (mappedParts.length > 0) {
                   newRow[colIndex] = mappedParts;
               }
            } else {
                // We must trim the value to match the keys in valueMappings (which come from getUniqueValues where they are trimmed)
                const lookupValue = (typeof originalValue === 'string') ? originalValue.trim() : originalValue;
                
                if (lookupValue && this.valueMappings[field] && this.valueMappings[field][lookupValue]) {
                  const mappedValue = this.valueMappings[field][lookupValue];
                  if (mappedValue !== '__skip__') {
                     newRow[colIndex] = mappedValue;
                  }
                }
            }
          }
        });
      }
      return newRow;
    });
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
  
  autoMatchFields() {
    if (!this.parsedData || !this.parsedData.headers) return;
    
    const headers = this.parsedData.headers;
    const allFields = [...this.config.requiredFields, ...(this.config.optionalFields || [])];
    
    allFields.forEach(field => {
      const patterns = [field.label, field.key, ...(field.aliases || [])];
      
      let bestMatch = -1;
      let bestScore = 0;
      
      headers.forEach((header, index) => {
        if (!header) return;
        const headerLower = header.toLowerCase().trim();
        
        patterns.forEach(pattern => {
          const patternLower = pattern.toLowerCase();
          let score = 0;
          
          if (headerLower === patternLower) score = 100;
          else if (headerLower.includes(patternLower)) score = 80;
          else if (patternLower.includes(headerLower) && headerLower.length > 2) score = 60;
          
          if (score > bestScore) {
            bestScore = score;
            bestMatch = index;
          }
        });
      });
      
      if (bestScore >= 50 && this.columnMapping[field.key] === undefined) {
        this.columnMapping[field.key] = bestMatch;
        this.autoMatchedFields.push(field.key);
      }
    });
  }
  
  async handleNext() {
    const stepType = this.getStepType(this.currentStep);
    
    if (stepType === 'import' && this.importResults) {
      this.onComplete();
      this.close();
      return;
    }
    
    if (stepType === 'upload') {
      if (!this.parsedData) {
        showToast('אנא בחר קובץ להעלאה', 'error');
        return;
      }
      this.currentStep++;
      this.autoMatchFields();
      this.renderStepContent();
    } else if (stepType === 'columnMapping') {
      // Validate required fields
      const missing = this.config.requiredFields.filter(f => this.columnMapping[f.key] === undefined);
      if (missing.length > 0) {
        showToast(`נא למפות את השדות החובה: ${missing.map(f => f.label).join(', ')}`, 'error');
        return;
      }
      
      this.currentStep++;
      
      // If next step is value mapping, load options
      if (this.getStepType(this.currentStep) === 'valueMapping') {
        await this.loadSystemOptions();
      } else {
        // If skipping value mapping (no relational fields), go straight to validation
        this.validateAndRender();
      }
      this.renderStepContent();
    } else if (stepType === 'valueMapping') {
      this.currentStep++;
      this.validateAndRender();
    } else if (stepType === 'validation') {
      const { valid } = this.validationResults;
      if (valid.length === 0) {
        showToast('אין רשומות תקינות לייבוא', 'error');
        return;
      }
      this.currentStep++;
      this.renderStepContent();
    }
  }
  
  handlePrev() {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.renderStepContent();
    }
  }
  
  async validateAndRender() {
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'import-loading-overlay';
    loadingOverlay.innerHTML = '<div class="import-spinner"></div><div style="margin-top: 10px; color: white;">מאמת נתונים...</div>';
    document.body.appendChild(loadingOverlay);
    
    try {
      // Apply value mappings to create a temporary processed dataset for validation
      const processedRows = this.applyValueMappings();

      this.validationResults = await this.config.validate(
        processedRows,
        this.columnMapping,
        this.businessId
      );
      this.renderStepContent();
    } catch (error) {
      console.error('Validation error:', error);
      showToast('שגיאה באימות נתונים: ' + error.message, 'error');
      this.currentStep--;
      this.renderStepContent();
    } finally {
      loadingOverlay.remove();
    }
  }
  
  async startImport() {
    if (this.isImporting) return;
    this.isImporting = true;
    
    const { valid } = this.validationResults;
    const progressFill = document.getElementById('importProgressFill');
    const progressStats = document.getElementById('importProgressStats');
    
    const updateProgress = (current, total) => {
      const percent = (current / total) * 100;
      if (progressFill) progressFill.style.width = `${percent}%`;
      if (progressStats) progressStats.textContent = `${current} / ${total}`;
    };
    
    try {
      // Import in batches
      const batchSize = 10;
      const results = { success: [], failed: [] };
      
      for (let i = 0; i < valid.length; i += batchSize) {
        const batch = valid.slice(i, i + batchSize);
        const batchResults = await this.config.importData(batch, this.businessId);
        
        results.success.push(...batchResults.success);
        results.failed.push(...batchResults.failed);
        
        updateProgress(Math.min(i + batchSize, valid.length), valid.length);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      this.importResults = results;
    } catch (error) {
      console.error('Import error:', error);
      this.importResults = { success: [], failed: [{ error: error.message }] };
    }
    
    this.isImporting = false;
    this.renderStepContent();
  }
  
  updateButtons() {
    const prevBtn = document.getElementById('importPrevBtn');
    const nextBtn = document.getElementById('importNextBtn');
    if (!prevBtn || !nextBtn) return;
    
    const stepType = this.getStepType(this.currentStep);
    
    prevBtn.style.display = stepType === 'upload' || stepType === 'import' ? 'none' : 'block';
    
    if (stepType === 'import') {
      if (this.importResults) {
        nextBtn.textContent = 'סיום';
        nextBtn.style.display = 'block';
      } else {
        nextBtn.style.display = 'none';
      }
    } else {
      nextBtn.textContent = stepType === 'validation' ? 'יבא נתונים' : 'המשך';
      nextBtn.style.display = 'block';
    }
  }
  
  updateStepsIndicator() {
    if (!this.overlay) return;
    const stepsContainer = this.overlay.querySelector('.import-wizard-body');
    if (stepsContainer) {
      const currentSteps = stepsContainer.querySelector('.import-steps');
      if (currentSteps) currentSteps.outerHTML = this.renderSteps();
    }
  }
  
  close() {
    this.overlay.remove();
  }
}
