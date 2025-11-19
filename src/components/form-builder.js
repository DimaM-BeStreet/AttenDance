import { validateForm, validateIsraeliPhone, validateIsraeliID, validateEmail } from '@utils/validation-utils';

/**
 * Form Builder Component
 * Dynamic form generation and validation
 */

/**
 * Create a dynamic form
 */
export function createForm(containerId, options = {}) {
  const {
    fields = [],
    submitText = 'שמור',
    cancelText = 'ביטול',
    showCancel = true,
    onSubmit = null,
    onCancel = null,
    initialData = {},
    layout = 'vertical' // vertical or horizontal
  } = options;

  const container = document.getElementById(containerId);
  if (!container) {
    console.error('Form container not found');
    return null;
  }

  // Create form element
  const form = document.createElement('form');
  form.className = `dynamic-form form-${layout}`;
  form.id = `${containerId}-form`;
  form.noValidate = true;

  // Create fields
  fields.forEach(field => {
    const fieldGroup = createFormField(field, initialData[field.name]);
    form.appendChild(fieldGroup);
  });

  // Create form actions
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'form-actions';

  if (showCancel) {
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = cancelText;
    cancelBtn.addEventListener('click', () => {
      if (onCancel) onCancel();
    });
    actionsDiv.appendChild(cancelBtn);
  }

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'btn btn-primary';
  submitBtn.textContent = submitText;
  actionsDiv.appendChild(submitBtn);

  form.appendChild(actionsDiv);

  container.innerHTML = '';
  container.appendChild(form);

  // Setup form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Validate form
    const validationRules = {};
    fields.forEach(field => {
      if (field.required || field.validation) {
        validationRules[field.name] = {
          required: field.required,
          ...field.validation
        };
      }
    });

    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    const validation = validateForm(data, validationRules);
    
    if (!validation.isValid) {
      showFieldErrors(validation.errors);
      return;
    }

    // Clear any existing errors
    clearFieldErrors();

    // Process form data
    const processedData = processFormData(form, fields);

    // Call onSubmit
    if (onSubmit) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'שומר...';
      
      try {
        await onSubmit(processedData);
      } catch (error) {
        console.error('Form submission error:', error);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = submitText;
      }
    }
  });

  return {
    getValues: () => processFormData(form, fields),
    setValues: (data) => setFormValues(form, fields, data),
    reset: () => form.reset(),
    validate: () => {
      const validationRules = {};
      fields.forEach(field => {
        if (field.required || field.validation) {
          validationRules[field.name] = {
            required: field.required,
            ...field.validation
          };
        }
      });
      const data = processFormData(form, fields);
      return validateForm(data, validationRules);
    }
  };
}

/**
 * Create a single form field
 */
function createFormField(field, initialValue = '') {
  const fieldGroup = document.createElement('div');
  fieldGroup.className = 'form-group';
  fieldGroup.dataset.fieldName = field.name;

  // Create label
  if (field.label) {
    const label = document.createElement('label');
    label.htmlFor = field.name;
    label.textContent = field.label;
    if (field.required) {
      label.innerHTML += ' <span class="required">*</span>';
    }
    fieldGroup.appendChild(label);
  }

  // Create input element based on type
  let inputElement;

  switch (field.type) {
    case 'text':
    case 'email':
    case 'tel':
    case 'number':
    case 'date':
    case 'time':
    case 'password':
      inputElement = document.createElement('input');
      inputElement.type = field.type;
      inputElement.name = field.name;
      inputElement.id = field.name;
      inputElement.className = 'form-control';
      inputElement.placeholder = field.placeholder || '';
      if (field.min !== undefined) inputElement.min = field.min;
      if (field.max !== undefined) inputElement.max = field.max;
      if (field.step !== undefined) inputElement.step = field.step;
      if (initialValue) inputElement.value = initialValue;
      break;

    case 'textarea':
      inputElement = document.createElement('textarea');
      inputElement.name = field.name;
      inputElement.id = field.name;
      inputElement.className = 'form-control';
      inputElement.placeholder = field.placeholder || '';
      inputElement.rows = field.rows || 4;
      if (initialValue) inputElement.value = initialValue;
      break;

    case 'select':
      inputElement = document.createElement('select');
      inputElement.name = field.name;
      inputElement.id = field.name;
      inputElement.className = 'form-control';
      
      if (field.placeholder) {
        const placeholderOption = document.createElement('option');
        placeholderOption.value = '';
        placeholderOption.textContent = field.placeholder;
        inputElement.appendChild(placeholderOption);
      }

      if (field.options) {
        field.options.forEach(opt => {
          const option = document.createElement('option');
          option.value = opt.value;
          option.textContent = opt.label;
          if (initialValue === opt.value) option.selected = true;
          inputElement.appendChild(option);
        });
      }
      break;

    case 'checkbox':
      inputElement = document.createElement('div');
      inputElement.className = 'checkbox-wrapper';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = field.name;
      checkbox.id = field.name;
      checkbox.className = 'form-checkbox';
      if (initialValue) checkbox.checked = true;

      const checkboxLabel = document.createElement('label');
      checkboxLabel.htmlFor = field.name;
      checkboxLabel.textContent = field.checkboxLabel || '';

      inputElement.appendChild(checkbox);
      inputElement.appendChild(checkboxLabel);
      break;

    case 'radio':
      inputElement = document.createElement('div');
      inputElement.className = 'radio-group';
      
      if (field.options) {
        field.options.forEach(opt => {
          const radioWrapper = document.createElement('div');
          radioWrapper.className = 'radio-wrapper';

          const radio = document.createElement('input');
          radio.type = 'radio';
          radio.name = field.name;
          radio.id = `${field.name}-${opt.value}`;
          radio.value = opt.value;
          radio.className = 'form-radio';
          if (initialValue === opt.value) radio.checked = true;

          const radioLabel = document.createElement('label');
          radioLabel.htmlFor = `${field.name}-${opt.value}`;
          radioLabel.textContent = opt.label;

          radioWrapper.appendChild(radio);
          radioWrapper.appendChild(radioLabel);
          inputElement.appendChild(radioWrapper);
        });
      }
      break;

    case 'file':
      inputElement = document.createElement('input');
      inputElement.type = 'file';
      inputElement.name = field.name;
      inputElement.id = field.name;
      inputElement.className = 'form-control';
      if (field.accept) inputElement.accept = field.accept;
      
      // Add file preview for images
      if (field.accept && field.accept.includes('image')) {
        const preview = document.createElement('div');
        preview.className = 'file-preview';
        preview.id = `${field.name}-preview`;
        fieldGroup.appendChild(preview);

        inputElement.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              preview.innerHTML = `<img src="${event.target.result}" alt="Preview">`;
            };
            reader.readAsDataURL(file);
          }
        });
      }
      break;

    case 'hidden':
      inputElement = document.createElement('input');
      inputElement.type = 'hidden';
      inputElement.name = field.name;
      inputElement.id = field.name;
      if (initialValue) inputElement.value = initialValue;
      break;

    default:
      inputElement = document.createElement('input');
      inputElement.type = 'text';
      inputElement.name = field.name;
      inputElement.id = field.name;
      inputElement.className = 'form-control';
  }

  if (field.required && inputElement.tagName === 'INPUT') {
    inputElement.required = true;
  }

  if (field.disabled) {
    inputElement.disabled = true;
  }

  fieldGroup.appendChild(inputElement);

  // Add help text
  if (field.helpText) {
    const helpText = document.createElement('small');
    helpText.className = 'help-text';
    helpText.textContent = field.helpText;
    fieldGroup.appendChild(helpText);
  }

  // Add error container
  const errorDiv = document.createElement('div');
  errorDiv.className = 'field-error';
  errorDiv.id = `${field.name}-error`;
  fieldGroup.appendChild(errorDiv);

  return fieldGroup;
}

/**
 * Process form data (handle files, checkboxes, etc.)
 */
function processFormData(form, fields) {
  const formData = new FormData(form);
  const data = {};

  fields.forEach(field => {
    if (field.type === 'checkbox') {
      const checkbox = form.querySelector(`[name="${field.name}"]`);
      data[field.name] = checkbox ? checkbox.checked : false;
    } else if (field.type === 'file') {
      const fileInput = form.querySelector(`[name="${field.name}"]`);
      data[field.name] = fileInput && fileInput.files.length > 0 ? fileInput.files[0] : null;
    } else if (field.type === 'number') {
      const value = formData.get(field.name);
      data[field.name] = value ? Number(value) : null;
    } else {
      data[field.name] = formData.get(field.name) || '';
    }
  });

  return data;
}

/**
 * Set form values
 */
function setFormValues(form, fields, data) {
  fields.forEach(field => {
    const value = data[field.name];
    if (value === undefined) return;

    if (field.type === 'checkbox') {
      const checkbox = form.querySelector(`[name="${field.name}"]`);
      if (checkbox) checkbox.checked = !!value;
    } else if (field.type === 'radio') {
      const radio = form.querySelector(`[name="${field.name}"][value="${value}"]`);
      if (radio) radio.checked = true;
    } else if (field.type !== 'file') {
      const input = form.querySelector(`[name="${field.name}"]`);
      if (input) input.value = value;
    }
  });
}

/**
 * Show field errors
 */
function showFieldErrors(errors) {
  Object.entries(errors).forEach(([fieldName, errorMessage]) => {
    const errorDiv = document.getElementById(`${fieldName}-error`);
    const fieldGroup = document.querySelector(`[data-field-name="${fieldName}"]`);
    
    if (errorDiv) {
      errorDiv.textContent = errorMessage;
      errorDiv.style.display = 'block';
    }
    
    if (fieldGroup) {
      fieldGroup.classList.add('has-error');
    }
  });
}

/**
 * Clear field errors
 */
function clearFieldErrors() {
  document.querySelectorAll('.field-error').forEach(div => {
    div.textContent = '';
    div.style.display = 'none';
  });
  
  document.querySelectorAll('.form-group.has-error').forEach(group => {
    group.classList.remove('has-error');
  });
}
