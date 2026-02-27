// ===== KYNTRA'S LEO REPORT GENERATOR - MODERN ARCHITECTURE =====

// ===== APP STATE =====
const AppState = {
  currentReport: 'arrest',
  formData: {},
  generatedReports: [],
  settings: {
    autoSave: true,
    animations: true,
    darkMode: true
  },
  autoSaveTimer: null,
  lastSaveTime: null,
  isDirty: false
};

// ===== UTILITY FUNCTIONS =====
const Utils = {
  // Debounce function for performance
  debounce: (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // Format date for display
  formatDate: (date) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  // Validate case number format
  validateCaseNumber: (number) => {
    const pattern = /^CID-\d+-SO$/;
    return pattern.test(number);
  },

  // Generate unique ID
  generateId: () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  },

  // Copy text to clipboard
  copyToClipboard: async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    }
  },

  // Download file
  downloadFile: (content, filename, type = 'text/plain') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

// ===== AUTO-SAVE SYSTEM =====
const AutoSave = {
  // Initialize auto-save
  init: () => {
    // Check for unsaved data on load
    AutoSave.checkForRecovery();
    
    // Set up auto-save timer
    if (AppState.settings.autoSave) {
      AutoSave.startAutoSave();
    }
    
    // Add beforeunload listener for warning
    window.addEventListener('beforeunload', AutoSave.handleBeforeUnload);
  },

  // Start auto-save timer
  startAutoSave: () => {
    AutoSave.stopAutoSave(); // Clear any existing timer
    AppState.autoSaveTimer = setInterval(() => {
      if (AppState.isDirty) {
        AutoSave.saveData();
      }
    }, 30000); // Save every 30 seconds
  },

  // Stop auto-save timer
  stopAutoSave: () => {
    if (AppState.autoSaveTimer) {
      clearInterval(AppState.autoSaveTimer);
      AppState.autoSaveTimer = null;
    }
  },

  // Mark form as dirty (modified)
  markDirty: () => {
    AppState.isDirty = true;
    AutoSave.updateSaveIndicator();
  },

  // Save current data
  saveData: () => {
    try {
      const saveData = {
        formData: AppState.formData,
        currentReport: AppState.currentReport,
        timestamp: new Date().toISOString(),
        version: '1.0'
      };
      
      localStorage.setItem('kyntraAutoSave', JSON.stringify(saveData));
      AppState.lastSaveTime = new Date();
      AppState.isDirty = false;
      
      AutoSave.updateSaveIndicator();
      StatusManager.info('Auto-saved', 2000);
    } catch (error) {
      console.error('Auto-save failed:', error);
      StatusManager.error('Auto-save failed');
    }
  },

  // Check for recovery data
  checkForRecovery: () => {
    const savedData = localStorage.getItem('kyntraAutoSave');
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        const saveTime = new Date(data.timestamp);
        const timeDiff = Date.now() - saveTime.getTime();
        
        // If save is less than 24 hours old, offer recovery
        if (timeDiff < 24 * 60 * 60 * 1000) {
          AutoSave.offerRecovery(data);
        } else {
          // Clear old saves
          localStorage.removeItem('kyntraAutoSave');
        }
      } catch (error) {
        console.error('Failed to parse recovery data:', error);
        localStorage.removeItem('kyntraAutoSave');
      }
    }
  },

  // Offer recovery to user
  offerRecovery: (data) => {
    const saveTime = new Date(data.timestamp).toLocaleString();
    const shouldRecover = confirm(
      `Found unsaved work from ${saveTime}.\n\nWould you like to recover your data?`
    );
    
    if (shouldRecover) {
      AppState.formData = data.formData || {};
      AppState.currentReport = data.currentReport || 'arrest';
      
      // Load the recovered data
      FormManager.loadFormData(AppState.currentReport);
      Navigation.switchReport(AppState.currentReport);
      
      StatusManager.success('Data recovered successfully');
    } else {
      localStorage.removeItem('kyntraAutoSave');
    }
  },

  // Update save indicator
  updateSaveIndicator: () => {
    let indicator = document.getElementById('saveIndicator');
    if (!indicator) {
      indicator = AutoSave.createSaveIndicator();
    }
    
    if (AppState.isDirty) {
      indicator.textContent = '● Unsaved changes';
      indicator.style.color = '#f59e0b';
    } else if (AppState.lastSaveTime) {
      const timeAgo = AutoSave.getTimeAgo(AppState.lastSaveTime);
      indicator.textContent = `● Saved ${timeAgo}`;
      indicator.style.color = '#10b981';
    } else {
      indicator.textContent = '● Ready';
      indicator.style.color = '#64748b';
    }
  },

  // Create save indicator element
  createSaveIndicator: () => {
    const indicator = document.createElement('div');
    indicator.id = 'saveIndicator';
    indicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 8px 12px;
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      z-index: 1000;
      backdrop-filter: blur(10px);
    `;
    document.body.appendChild(indicator);
    return indicator;
  },

  // Get time ago string
  getTimeAgo: (date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  },

  // Handle before unload
  handleBeforeUnload: (e) => {
    if (AppState.isDirty) {
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      return e.returnValue;
    }
  }
};

// ===== STATUS MESSAGES =====
const StatusManager = {
  show: (message, type = 'info', duration = 5000) => {
    const container = document.getElementById('statusContainer');
    const messageEl = document.createElement('div');
    messageEl.className = `status-message ${type}`;
    messageEl.textContent = message;
    
    container.appendChild(messageEl);
    
    // Auto remove after duration
    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => messageEl.remove(), 300);
      }
    }, duration);
  },

  success: (message) => StatusManager.show(message, 'success'),
  error: (message) => StatusManager.show(message, 'error'),
  warning: (message) => StatusManager.show(message, 'warning'),
  info: (message) => StatusManager.show(message, 'info')
};

// ===== SMART VALIDATION SYSTEM =====
const SmartValidation = {
  // Validation rules
  rules: {
    required: (value) => value && value.trim().length > 0,
    email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    phone: (value) => /^[\d\s\-\(\)]+$/.test(value) && value.replace(/\D/g, '').length >= 10,
    caseNumber: (value) => /^CID-\d+-SO$/.test(value),
    date: (value) => !isNaN(Date.parse(value)),
    time: (value) => /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value),
    numeric: (value) => !isNaN(value) && value.trim() !== '',
    minLength: (value, min) => value && value.length >= min,
    maxLength: (value, max) => !value || value.length <= max,
    pattern: (value, pattern) => new RegExp(pattern).test(value)
  },

  // Error messages
  messages: {
    required: 'This field is required',
    email: 'Please enter a valid email address',
    phone: 'Please enter a valid phone number',
    caseNumber: 'Must be in format: CID-ReportNumber-SO',
    date: 'Please enter a valid date',
    time: 'Please enter a valid time (HH:MM)',
    numeric: 'Please enter a valid number',
    minLength: 'Must be at least {min} characters',
    maxLength: 'Must be no more than {max} characters',
    pattern: 'Please match the required format'
  },

  // Initialize validation
  init: () => {
    // Add real-time validation listeners
    document.addEventListener('input', SmartValidation.handleInput);
    document.addEventListener('blur', SmartValidation.handleBlur);
    document.addEventListener('change', SmartValidation.handleChange);
  },

  // Handle input events (real-time validation)
  handleInput: (e) => {
    const field = e.target;
    if (field.tagName === 'INPUT' || field.tagName === 'TEXTAREA' || field.tagName === 'SELECT') {
      SmartValidation.validateField(field, 'realtime');
    }
  },

  // Handle blur events (full validation)
  handleBlur: (e) => {
    const field = e.target;
    if (field.tagName === 'INPUT' || field.tagName === 'TEXTAREA' || field.tagName === 'SELECT') {
      SmartValidation.validateField(field, 'blur');
    }
  },

  // Handle change events (for selects)
  handleChange: (e) => {
    const field = e.target;
    if (field.tagName === 'SELECT') {
      SmartValidation.validateField(field, 'change');
    }
  },

  // Validate individual field
  validateField: (field, trigger) => {
    const validation = SmartValidation.getFieldValidation(field);
    const result = SmartValidation.runValidation(field.value, validation);
    
    SmartValidation.updateFieldUI(field, result, trigger);
    return result.isValid;
  },

  // Get validation rules for field
  getFieldValidation: (field) => {
    const validation = {
      rules: [],
      message: null,
      essential: field.hasAttribute('data-essential')
    };

    // Check for required
    if (field.hasAttribute('required') || validation.essential) {
      validation.rules.push({ type: 'required' });
    }

    // Check for pattern
    if (field.hasAttribute('pattern')) {
      validation.rules.push({ 
        type: 'pattern', 
        value: field.getAttribute('pattern') 
      });
    }

    // Check for data-validation attributes
    const dataValidation = field.getAttribute('data-validation');
    if (dataValidation) {
      const rules = dataValidation.split('|');
      rules.forEach(rule => {
        const [type, ...params] = rule.split(':');
        validation.rules.push({ 
          type, 
          value: params.join(':') || null 
        });
      });
    }

    // Check for min/max length
    if (field.hasAttribute('minlength')) {
      validation.rules.push({ 
        type: 'minLength', 
        value: field.getAttribute('minlength') 
      });
    }
    
    if (field.hasAttribute('maxlength')) {
      validation.rules.push({ 
        type: 'maxLength', 
        value: field.getAttribute('maxlength') 
      });
    }

    // Custom error message
    if (field.hasAttribute('data-error')) {
      validation.message = field.getAttribute('data-error');
    }

    return validation;
  },

  // Run validation rules
  runValidation: (value, validation) => {
    const result = {
      isValid: true,
      errors: [],
      warnings: []
    };

    for (const rule of validation.rules) {
      const ruleResult = SmartValidation.applyRule(value, rule);
      
      if (!ruleResult.isValid) {
        result.isValid = false;
        result.errors.push(ruleResult.message);
      }
    }

    return result;
  },

  // Apply individual validation rule
  applyRule: (value, rule) => {
    const ruleFunction = SmartValidation.rules[rule.type];
    if (!ruleFunction) {
      return { isValid: true, message: '' };
    }

    const isValid = ruleFunction(value, rule.value);
    const message = rule.message || SmartValidation.messages[rule.type] || 'Invalid input';
    
    // Replace placeholders in message
    const finalMessage = message.replace(/{(\w+)}/g, (match, key) => {
      return rule.value || match;
    });

    return { isValid, message: finalMessage };
  },

  // Update field UI based on validation
  updateFieldUI: (field, result, trigger) => {
    // Remove existing validation classes
    field.classList.remove('valid', 'invalid', 'warning');
    
    // Remove existing feedback
    const existingFeedback = field.parentNode.querySelector('.validation-feedback');
    if (existingFeedback) {
      existingFeedback.remove();
    }

    // Add appropriate class and feedback
    if (result.errors.length > 0) {
      field.classList.add('invalid');
      if (trigger !== 'realtime' || field.hasAttribute('data-validate-realtime')) {
        SmartValidation.showFeedback(field, result.errors[0], 'error');
      }
    } else if (field.value && field.value.trim()) {
      field.classList.add('valid');
      if (trigger === 'blur' && field.hasAttribute('data-show-success')) {
        SmartValidation.showFeedback(field, 'Looks good!', 'success');
      }
    }

    // Update form progress
    SmartValidation.updateFormProgress(field.closest('.report-section'));
  },

  // Show validation feedback
  showFeedback: (field, message, type) => {
    const feedback = document.createElement('div');
    feedback.className = `validation-feedback ${type}`;
    feedback.textContent = message;
    
    // Style the feedback
    Object.assign(feedback.style, {
      fontSize: '12px',
      marginTop: '4px',
      color: type === 'error' ? 'var(--error-color)' : 
             type === 'success' ? 'var(--success-color)' : 
             'var(--warning-color)',
      fontWeight: '500'
    });

    // Insert after field
    field.parentNode.insertBefore(feedback, field.nextSibling);
    
    // Auto-remove success messages
    if (type === 'success') {
      setTimeout(() => feedback.remove(), 3000);
    }
  },

  // Update form progress indicator
  updateFormProgress: (section) => {
    if (!section) return;

    const progressIndicator = section.querySelector('.form-progress');
    if (!progressIndicator) return;

    const fields = section.querySelectorAll('input, textarea, select');
    const validFields = section.querySelectorAll('.valid');
    const invalidFields = section.querySelectorAll('.invalid');
    
    const total = fields.length;
    const completed = validFields.length;
    const hasErrors = invalidFields.length > 0;

    const percentage = Math.round((completed / total) * 100);
    
    progressIndicator.style.width = `${percentage}%`;
    progressIndicator.style.background = hasErrors ? 'var(--error-color)' : 'var(--success-color)';
  },

  // Validate entire form
  validateForm: (reportType) => {
    const section = document.getElementById(reportType);
    if (!section) return false;

    const fields = section.querySelectorAll('input, textarea, select');
    let isValid = true;
    let firstInvalidField = null;

    fields.forEach(field => {
      const fieldValid = SmartValidation.validateField(field, 'form');
      if (!fieldValid && !firstInvalidField) {
        firstInvalidField = field;
      }
      isValid = isValid && fieldValid;
    });

    // Focus first invalid field
    if (firstInvalidField) {
      firstInvalidField.focus();
      firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    return isValid;
  }
};

// ===== FORM MANAGEMENT =====
const FormManager = {
  // Initialize form listeners
  init: () => {
    // Initialize smart validation
    SmartValidation.init();
    
    // Add form progress indicators to each section
    FormManager.addProgressIndicators();
    
    // Navigation buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const reportType = e.target.dataset.report;
        if (reportType) {
          Navigation.switchReport(reportType);
        }
      });
    });

    // Auto-save form data
    const autoSave = Utils.debounce(() => {
      FormManager.saveFormData();
    }, 1000);

    // Add input listeners for auto-save
    document.addEventListener('input', autoSave);
    document.addEventListener('change', autoSave);
  },

  // Add progress indicators to forms
  addProgressIndicators: () => {
    document.querySelectorAll('.report-section').forEach(section => {
      // Check if progress indicator already exists
      if (section.querySelector('.form-progress-container')) return;
      
      const progressContainer = document.createElement('div');
      progressContainer.className = 'form-progress-container';
      progressContainer.style.cssText = `
        margin-bottom: 20px;
        padding: 10px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.1);
      `;
      
      const progressLabel = document.createElement('div');
      progressLabel.className = 'progress-label';
      progressLabel.textContent = 'Form Completion';
      progressLabel.style.cssText = `
        font-size: 12px;
        color: var(--gray-400);
        margin-bottom: 8px;
        font-weight: 500;
      `;
      
      const progressBar = document.createElement('div');
      progressBar.style.cssText = `
        width: 100%;
        height: 4px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 2px;
        overflow: hidden;
      `;
      
      const progressFill = document.createElement('div');
      progressFill.className = 'form-progress';
      progressFill.style.cssText = `
        height: 100%;
        width: 0%;
        background: var(--success-color);
        transition: width 0.3s ease, background 0.3s ease;
        border-radius: 2px;
      `;
      
      progressBar.appendChild(progressFill);
      progressContainer.appendChild(progressLabel);
      progressContainer.appendChild(progressBar);
      
      // Insert at the beginning of the section
      const firstChild = section.querySelector('.section-header');
      if (firstChild) {
        firstChild.after(progressContainer);
      } else {
        section.insertBefore(progressContainer, section.firstChild);
      }
    });
  },

  // Get form data for current report
  getFormData: (reportType) => {
    console.log('Getting form data for:', reportType);
    const section = document.getElementById(reportType);
    if (!section) {
      console.log('Section not found:', reportType);
      return {};
    }

    const formData = {};
    const inputs = section.querySelectorAll('input, textarea, select');
    console.log('Found inputs:', inputs.length);
    
    inputs.forEach(input => {
      console.log('Processing input:', input.id, input.type, input.value);
      if (input.type === 'checkbox') {
        formData[input.id] = input.checked;
      } else if (input.type === 'radio') {
        if (input.checked) {
          formData[input.name] = input.value;
        }
      } else {
        formData[input.id] = input.value;
      }
    });

    // Handle dynamic fields (officers, suspects)
    formData.officers = FormManager.getDynamicFields('arrestingOfficers', 'officer-input');
    formData.suspects = FormManager.getDynamicFields('suspects', 'suspect-item');

    console.log('Final form data:', formData);
    return formData;
  },

  // Get dynamic field data
  getDynamicFields: (containerId, inputClass) => {
    const container = document.getElementById(containerId);
    if (!container) return [];

    if (inputClass === 'suspect-item') {
      // Handle suspect items with multiple fields
      const suspectItems = container.querySelectorAll('.suspect-item');
      return Array.from(suspectItems).map(item => {
        const name = item.querySelector('.suspect-name')?.value || '';
        const id = item.querySelector('.suspect-id')?.value || '';
        const charges = item.querySelector('.suspect-charges')?.value || '';
        return { name, id, charges };
      }).filter(suspect => suspect.name.trim() || suspect.id.trim());
    } else {
      // Handle officer items with single input
      const items = container.querySelectorAll(`.${inputClass}`);
      return Array.from(items).map(item => item.value).filter(value => value.trim());
    }
  },

  // Save form data to localStorage
  saveFormData: () => {
    const formData = FormManager.getFormData(AppState.currentReport);
    AppState.formData[AppState.currentReport] = formData;
    localStorage.setItem('kyntraFormData', JSON.stringify(AppState.formData));
    
    // Mark as dirty for auto-save
    AutoSave.markDirty();
  },

  // Load form data from localStorage
  loadFormData: (reportType = AppState.currentReport) => {
    const saved = localStorage.getItem('kyntraFormData');
    if (saved) {
      AppState.formData = JSON.parse(saved);
      FormManager.populateForm(reportType);
    }
  },

  // Populate form with saved data
  populateForm: (reportType) => {
    const formData = AppState.formData[reportType] || {};
    const section = document.getElementById(reportType);
    
    if (!section) return;

    // Populate regular fields
    Object.keys(formData).forEach(key => {
      const element = section.querySelector(`#${key}`);
      if (element) {
        if (element.type === 'checkbox') {
          element.checked = formData[key];
        } else {
          element.value = formData[key];
        }
      }
    });
  },

  // Clear form
  clearForm: (reportType) => {
    const section = document.getElementById(reportType);
    if (!section) return;

    // Clear all inputs
    const inputs = section.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
      if (input.type === 'checkbox') {
        input.checked = false;
      } else {
        input.value = '';
      }
    });

    // Clear dynamic fields except first one
    const dynamicContainers = section.querySelectorAll('.dynamic-fields');
    dynamicContainers.forEach(container => {
      const items = container.querySelectorAll('.field-item');
      items.forEach((item, index) => {
        if (index > 0) item.remove();
      });
    });

    StatusManager.success('Form cleared successfully');
  },

  // Validate form
  validateForm: (reportType) => {
    console.log('Validating form for:', reportType);
    const section = document.getElementById(reportType);
    console.log('Section found:', !!section);
    if (!section) return false;

    // Only validate essential fields - allow partial form submission
    const essentialFields = section.querySelectorAll('[data-essential="true"]');
    console.log('Essential fields found:', essentialFields.length);
    let isValid = true;
    let emptyFields = [];

    // Check essential fields if any exist
    if (essentialFields.length > 0) {
      essentialFields.forEach(field => {
        console.log('Checking field:', field.id, 'value:', field.value);
        if (!field.value.trim()) {
          field.classList.add('error');
          isValid = false;
          emptyFields.push(field.previousElementSibling?.textContent || 'Required field');
        } else {
          field.classList.remove('error');
        }
      });

      if (!isValid) {
        console.log('Essential fields validation failed:', emptyFields);
        StatusManager.error(`Please fill in essential fields: ${emptyFields.join(', ')}`);
        return false;
      }
    }

    // Special validation for case numbers (only if filled)
    const caseNumberFields = section.querySelectorAll('[pattern="CID-\\d+-SO"]');
    caseNumberFields.forEach(field => {
      if (field.value && !Utils.validateCaseNumber(field.value)) {
        field.classList.add('error');
        isValid = false;
        StatusManager.error('Case number must be in format: CID-ReportNumber-SO');
      }
    });

    console.log('Validation result:', isValid);
    return isValid;
  }
};

// ===== REPORT TEMPLATES SYSTEM =====
const ReportTemplates = {
  // Pre-defined templates
  templates: {
    arrest: {
      'DUI Arrest': {
        description: 'Driving Under the Influence arrest template',
        data: {
          incidentSummary: 'Subject was observed operating a motor vehicle in an erratic manner. Field sobriety tests were administered and subject showed signs of impairment. Subject was placed under arrest for DUI.',
          evidence: 'Breathalyzer results, dash cam footage, field sobriety test notes',
          witnesses: 'Officer testimony, dash cam recording'
        }
      },
      'Domestic Violence': {
        description: 'Domestic violence incident arrest',
        data: {
          incidentSummary: 'Responded to disturbance call. Upon arrival, observed signs of physical altercation. Victim reported assault by subject. Subject was taken into custody without incident.',
          evidence: 'Photographs of injuries, victim statement, 911 call recording',
          witnesses: 'Victim, neighbors, responding officers'
        }
      },
      'Drug Possession': {
        description: 'Drug possession arrest template',
        data: {
          incidentSummary: 'During routine traffic stop, observed contraband in plain view. Subject was placed under arrest for possession of controlled substance.',
          evidence: 'Controlled substances, paraphernalia, field test results',
          witnesses: 'Officer testimony, K9 unit if applicable'
        }
      },
      'Assault': {
        description: 'Simple/Aggravated assault arrest',
        data: {
          incidentSummary: 'Subject allegedly assaulted victim during dispute. Victim sustained injuries and subject was identified and arrested at scene.',
          evidence: 'Photographs of injuries, weapon if used, medical reports',
          witnesses: 'Victim, bystanders, medical personnel'
        }
      }
    },
    citation: {
      'Speeding': {
        description: 'Standard speeding violation',
        data: {
          violations: 'Exceeding posted speed limit',
          officerNotes: 'Subject was clocked at [SPEED] MPH in [POSTED] MPH zone using [METHOD]. Weather conditions were clear, traffic was light.'
        }
      },
      'Parking Violation': {
        description: 'Parking in unauthorized area',
        data: {
          violations: 'Parking in handicap space without permit',
          officerNotes: 'Vehicle was observed parked in designated handicap space without displaying valid permit. Vehicle was photographed and citation was issued.'
        }
      },
      'Equipment Violation': {
        description: 'Vehicle equipment issues',
        data: {
          violations: 'Defective equipment - broken taillight',
          officerNotes: 'Vehicle was observed with inoperative rear lighting. Driver was advised of violation and citation issued.'
        }
      }
    },
    'case-opening': {
      'Burglary Investigation': {
        description: 'Residential/Commercial burglary case',
        data: {
          caseName: 'Burglary Investigation - [LOCATION]',
          caseType: 'criminal',
          initialEvidence: 'Point of entry, tool marks, stolen items list, fingerprints, surveillance footage',
          initialLeads: 'Unknown suspect(s), possible witnesses in area, recent similar incidents'
        }
      },
      'Fraud Investigation': {
        description: 'Financial fraud case',
        data: {
          caseName: 'Financial Fraud - [VICTIM/SUBJECT]',
          caseType: 'criminal',
          initialEvidence: 'Financial records, emails, contracts, witness statements',
          initialLeads: 'Bank records, digital forensics, known associates, financial trail'
        }
      }
    }
  },

  // Initialize templates
  init: () => {
    ReportTemplates.loadCustomTemplates();
    ReportTemplates.addTemplateUI();
  },

  // Load custom templates from localStorage
  loadCustomTemplates: () => {
    const customTemplates = localStorage.getItem('kyntraCustomTemplates');
    if (customTemplates) {
      try {
        const custom = JSON.parse(customTemplates);
        // Merge with default templates
        Object.keys(custom).forEach(reportType => {
          if (!ReportTemplates.templates[reportType]) {
            ReportTemplates.templates[reportType] = {};
          }
          Object.assign(ReportTemplates.templates[reportType], custom[reportType]);
        });
      } catch (error) {
        console.error('Failed to load custom templates:', error);
      }
    }
  },

  // Save custom templates to localStorage
  saveCustomTemplates: () => {
    const customTemplates = {};
    
    // Only save custom templates (not defaults)
    Object.keys(ReportTemplates.templates).forEach(reportType => {
      const templates = ReportTemplates.templates[reportType];
      const custom = {};
      
      Object.keys(templates).forEach(templateName => {
        if (templates[templateName].custom) {
          custom[templateName] = templates[templateName];
        }
      });
      
      if (Object.keys(custom).length > 0) {
        customTemplates[reportType] = custom;
      }
    });
    
    localStorage.setItem('kyntraCustomTemplates', JSON.stringify(customTemplates));
  },

  // Add template UI to forms
  addTemplateUI: () => {
    document.querySelectorAll('.report-section').forEach(section => {
      const reportType = section.id;
      const templates = ReportTemplates.templates[reportType];
      
      if (!templates || Object.keys(templates).length === 0) return;
      
      // Create template selector
      const templateContainer = document.createElement('div');
      templateContainer.className = 'template-container';
      templateContainer.style.cssText = `
        margin-bottom: 20px;
        padding: 15px;
        background: rgba(59, 130, 246, 0.1);
        border: 1px solid rgba(59, 130, 246, 0.3);
        border-radius: 8px;
      `;
      
      const templateLabel = document.createElement('div');
      templateLabel.textContent = '📋 Quick Templates';
      templateLabel.style.cssText = `
        font-weight: 600;
        margin-bottom: 10px;
        color: var(--primary-light);
      `;
      
      const templateSelect = document.createElement('select');
      templateSelect.id = `${reportType}-template-select`;
      templateSelect.style.cssText = `
        width: 100%;
        padding: 8px;
        background: rgba(30, 41, 59, 0.8);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        color: white;
        margin-bottom: 10px;
      `;
      
      // Add default option
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'Select a template...';
      templateSelect.appendChild(defaultOption);
      
      // Add template options
      Object.keys(templates).forEach(templateName => {
        const option = document.createElement('option');
        option.value = templateName;
        option.textContent = `${templateName} - ${templates[templateName].description}`;
        templateSelect.appendChild(option);
      });
      
      const templateButtons = document.createElement('div');
      templateButtons.style.cssText = `
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      `;
      
      const applyButton = document.createElement('button');
      applyButton.textContent = 'Apply Template';
      applyButton.className = 'action-btn secondary';
      applyButton.style.cssText = `
        padding: 6px 12px;
        font-size: 12px;
        background: var(--primary-color);
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      `;
      
      const saveButton = document.createElement('button');
      saveButton.textContent = 'Save as Template';
      saveButton.className = 'action-btn secondary';
      saveButton.style.cssText = `
        padding: 6px 12px;
        font-size: 12px;
        background: var(--success-color);
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      `;
      
      // Add event listeners
      applyButton.addEventListener('click', () => {
        const selectedTemplate = templateSelect.value;
        if (selectedTemplate) {
          ReportTemplates.applyTemplate(reportType, selectedTemplate);
        }
      });
      
      saveButton.addEventListener('click', () => {
        ReportTemplates.saveAsTemplate(reportType);
      });
      
      templateButtons.appendChild(applyButton);
      templateButtons.appendChild(saveButton);
      
      templateContainer.appendChild(templateLabel);
      templateContainer.appendChild(templateSelect);
      templateContainer.appendChild(templateButtons);
      
      // Insert after progress indicator
      const progressContainer = section.querySelector('.form-progress-container');
      if (progressContainer) {
        progressContainer.after(templateContainer);
      } else {
        const firstChild = section.querySelector('.section-header');
        if (firstChild) {
          firstChild.after(templateContainer);
        } else {
          section.insertBefore(templateContainer, section.firstChild);
        }
      }
    });
  },

  // Apply template to form
  applyTemplate: (reportType, templateName) => {
    const template = ReportTemplates.templates[reportType][templateName];
    if (!template) return;
    
    // Get current form data
    const currentData = FormManager.getFormData(reportType);
    
    // Merge template data with current data
    const mergedData = { ...currentData, ...template.data };
    
    // Clear form first
    FormManager.clearForm(reportType);
    
    // Populate with merged data
    Object.keys(mergedData).forEach(key => {
      const element = document.getElementById(key);
      if (element) {
        element.value = mergedData[key];
        // Trigger change event for validation
        element.dispatchEvent(new Event('change'));
      }
    });
    
    // Mark as dirty for auto-save
    AutoSave.markDirty();
    
    StatusManager.success(`Template "${templateName}" applied successfully`);
  },

  // Save current form as template
  saveAsTemplate: (reportType) => {
    const templateName = prompt('Enter a name for this template:');
    if (!templateName) return;
    
    const formData = FormManager.getFormData(reportType);
    
    // Filter out empty fields
    const templateData = {};
    Object.keys(formData).forEach(key => {
      if (formData[key] && formData[key].trim()) {
        templateData[key] = formData[key];
      }
    });
    
    if (Object.keys(templateData).length === 0) {
      StatusManager.warning('No data to save in template');
      return;
    }
    
    // Create template
    const template = {
      description: 'Custom template',
      data: templateData,
      custom: true
    };
    
    // Save to templates
    if (!ReportTemplates.templates[reportType]) {
      ReportTemplates.templates[reportType] = {};
    }
    
    ReportTemplates.templates[reportType][templateName] = template;
    
    // Save to localStorage
    ReportTemplates.saveCustomTemplates();
    
    // Refresh template UI
    ReportTemplates.refreshTemplateUI(reportType);
    
    StatusManager.success(`Template "${templateName}" saved successfully`);
  },

  // Refresh template UI for a report type
  refreshTemplateUI: (reportType) => {
    const select = document.getElementById(`${reportType}-template-select`);
    if (!select) return;
    
    // Clear existing options except default
    while (select.children.length > 1) {
      select.removeChild(select.lastChild);
    }
    
    // Add updated template options
    const templates = ReportTemplates.templates[reportType];
    Object.keys(templates).forEach(templateName => {
      const option = document.createElement('option');
      option.value = templateName;
      option.textContent = `${templateName} - ${templates[templateName].description}`;
      if (templates[templateName].custom) {
        option.textContent += ' (Custom)';
      }
      select.appendChild(option);
    });
  },

  // Delete custom template
  deleteTemplate: (reportType, templateName) => {
    if (!confirm(`Are you sure you want to delete the template "${templateName}"?`)) {
      return;
    }
    
    delete ReportTemplates.templates[reportType][templateName];
    ReportTemplates.saveCustomTemplates();
    ReportTemplates.refreshTemplateUI(reportType);
    
    StatusManager.success(`Template "${templateName}" deleted`);
  }
};

// ===== NAVIGATION =====
const Navigation = {
  // Switch between report types
  switchReport: (reportType) => {
    console.log('Switching to report:', reportType);
    
    // Update active state for navigation buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    const activeBtn = document.querySelector(`[data-report="${reportType}"]`);
    if (activeBtn) {
      activeBtn.classList.add('active');
    }

    // Hide all sections
    document.querySelectorAll('.report-section').forEach(section => {
      section.classList.remove('active');
      section.style.display = 'none';
    });

    // Show selected section
    const targetSection = document.getElementById(reportType);
    if (targetSection) {
      targetSection.style.display = 'block';
      // Force a reflow before adding active class
      targetSection.offsetHeight;
      targetSection.classList.add('active');
    }

    // Update app state
    AppState.currentReport = reportType;
    
    // Load saved form data for this report
    FormManager.loadFormData(reportType);
    
    // Show status message
    StatusManager.info(`Switched to ${reportType.replace('-', ' ')} report`);
  }
};

// ===== REPORT HISTORY & ANALYTICS =====
const ReportAnalytics = {
  // Initialize analytics
  init: () => {
    ReportAnalytics.loadReportHistory();
    ReportAnalytics.addAnalyticsUI();
    ReportAnalytics.updateStatistics();
  },

  // Load report history from localStorage
  loadReportHistory: () => {
    const saved = localStorage.getItem('kyntraReportHistory');
    if (saved) {
      try {
        AppState.generatedReports = JSON.parse(saved);
      } catch (error) {
        console.error('Failed to load report history:', error);
        AppState.generatedReports = [];
      }
    }
  },

  // Save report history to localStorage
  saveReportHistory: () => {
    try {
      localStorage.setItem('kyntraReportHistory', JSON.stringify(AppState.generatedReports));
    } catch (error) {
      console.error('Failed to save report history:', error);
    }
  },

  // Add analytics UI to the page
  addAnalyticsUI: () => {
    // Create analytics button in navigation
    const navMenu = document.querySelector('.nav-menu');
    if (navMenu) {
      const analyticsBtn = document.createElement('button');
      analyticsBtn.className = 'nav-btn analytics-btn';
      analyticsBtn.innerHTML = '📊 Analytics';
      analyticsBtn.onclick = () => ReportAnalytics.showDashboard();
      navMenu.appendChild(analyticsBtn);
    }
  },

  // Show analytics dashboard
  showDashboard: () => {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'analytics-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(5px);
    `;

    // Create dashboard container
    const dashboard = document.createElement('div');
    dashboard.className = 'analytics-dashboard';
    dashboard.style.cssText = `
      background: var(--secondary-color);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 24px;
      max-width: 90vw;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    `;

    // Dashboard header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    `;
    
    const title = document.createElement('h2');
    title.textContent = '📊 Report Analytics & History';
    title.style.cssText = `
      margin: 0;
      color: var(--gray-100);
      font-size: 24px;
      font-weight: 600;
    `;
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: var(--gray-400);
      font-size: 24px;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      transition: all 0.2s;
    `;
    closeBtn.onmouseover = () => closeBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    closeBtn.onmouseout = () => closeBtn.style.background = 'none';
    closeBtn.onclick = () => document.body.removeChild(overlay);

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Dashboard content
    const content = document.createElement('div');
    content.innerHTML = ReportAnalytics.generateDashboardContent();

    dashboard.appendChild(header);
    dashboard.appendChild(content);
    overlay.appendChild(dashboard);
    
    // Add click outside to close
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
      }
    };

    document.body.appendChild(overlay);
  },

  // Generate dashboard content
  generateDashboardContent: () => {
    const reports = AppState.generatedReports;
    const stats = ReportAnalytics.calculateStatistics(reports);
    
    return `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
        ${ReportAnalytics.createStatCard('Total Reports', stats.total, '#3b82f6')}
        ${ReportAnalytics.createStatCard('This Week', stats.thisWeek, '#10b981')}
        ${ReportAnalytics.createStatCard('This Month', stats.thisMonth, '#f59e0b')}
        ${ReportAnalytics.createStatCard('Most Used', stats.mostUsedType, '#ef4444')}
      </div>
      
      <div style="margin-bottom: 24px;">
        <h3 style="color: var(--gray-100); margin-bottom: 16px;">📈 Report Types Distribution</h3>
        <div style="background: rgba(255, 255, 255, 0.05); padding: 16px; border-radius: 8px;">
          ${ReportAnalytics.createTypeDistribution(stats.typeDistribution)}
        </div>
      </div>
      
      <div style="margin-bottom: 24px;">
        <h3 style="color: var(--gray-100); margin-bottom: 16px;">📅 Recent Activity</h3>
        <div style="background: rgba(255, 255, 255, 0.05); padding: 16px; border-radius: 8px;">
          ${ReportAnalytics.createRecentActivity(reports.slice(0, 10))}
        </div>
      </div>
      
      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        <button onclick="ReportAnalytics.exportHistory('csv')" style="padding: 8px 16px; background: var(--primary-color); color: white; border: none; border-radius: 6px; cursor: pointer;">📊 Export CSV</button>
        <button onclick="ReportAnalytics.exportHistory('json')" style="padding: 8px 16px; background: var(--success-color); color: white; border: none; border-radius: 6px; cursor: pointer;">📄 Export JSON</button>
        <button onclick="ReportAnalytics.clearHistory()" style="padding: 8px 16px; background: var(--error-color); color: white; border: none; border-radius: 6px; cursor: pointer;">🗑️ Clear History</button>
      </div>
    `;
  },

  // Create stat card
  createStatCard: (title, value, color) => {
    return `
      <div style="background: rgba(255, 255, 255, 0.05); padding: 16px; border-radius: 8px; border-left: 4px solid ${color};">
        <div style="color: var(--gray-400); font-size: 12px; margin-bottom: 4px;">${title}</div>
        <div style="color: var(--gray-100); font-size: 24px; font-weight: 600;">${value}</div>
      </div>
    `;
  },

  // Create type distribution chart
  createTypeDistribution: (distribution) => {
    const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);
    if (total === 0) return '<div style="color: var(--gray-400);">No reports generated yet</div>';
    
    let html = '<div style="display: flex; flex-direction: column; gap: 8px;">';
    Object.entries(distribution).forEach(([type, count]) => {
      const percentage = ((count / total) * 100).toFixed(1);
      const barWidth = `${percentage}%`;
      const typeLabel = type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
      
      html += `
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="min-width: 120px; color: var(--gray-300); font-size: 14px;">${typeLabel}</div>
          <div style="flex: 1; background: rgba(255, 255, 255, 0.1); border-radius: 4px; height: 20px; overflow: hidden;">
            <div style="width: ${barWidth}; height: 100%; background: var(--primary-color); transition: width 0.3s ease;"></div>
          </div>
          <div style="min-width: 50px; text-align: right; color: var(--gray-400); font-size: 12px;">${count} (${percentage}%)</div>
        </div>
      `;
    });
    html += '</div>';
    return html;
  },

  // Create recent activity list
  createRecentActivity: (reports) => {
    if (reports.length === 0) {
      return '<div style="color: var(--gray-400);">No recent activity</div>';
    }
    
    let html = '<div style="display: flex; flex-direction: column; gap: 8px;">';
    reports.forEach(report => {
      const date = new Date(report.timestamp).toLocaleString();
      const typeLabel = report.type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
      
      html += `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: rgba(255, 255, 255, 0.02); border-radius: 4px;">
          <div>
            <div style="color: var(--gray-100); font-weight: 500;">${typeLabel}</div>
            <div style="color: var(--gray-400); font-size: 12px;">${date}</div>
          </div>
          <button onclick="ReportAnalytics.viewReport('${report.timestamp}')" style="padding: 4px 8px; background: var(--primary-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">View</button>
        </div>
      `;
    });
    html += '</div>';
    return html;
  },

  // Calculate statistics
  calculateStatistics: (reports) => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const stats = {
      total: reports.length,
      thisWeek: reports.filter(r => new Date(r.timestamp) >= oneWeekAgo).length,
      thisMonth: reports.filter(r => new Date(r.timestamp) >= oneMonthAgo).length,
      typeDistribution: {},
      mostUsedType: 'None'
    };
    
    // Calculate type distribution
    reports.forEach(report => {
      stats.typeDistribution[report.type] = (stats.typeDistribution[report.type] || 0) + 1;
    });
    
    // Find most used type
    let maxCount = 0;
    Object.entries(stats.typeDistribution).forEach(([type, count]) => {
      if (count > maxCount) {
        maxCount = count;
        stats.mostUsedType = type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
      }
    });
    
    return stats;
  },

  // Update statistics
  updateStatistics: () => {
    // This could be called periodically to update real-time stats
    ReportAnalytics.saveReportHistory();
  },

  // View specific report
  viewReport: (timestamp) => {
    const report = AppState.generatedReports.find(r => r.timestamp === timestamp);
    if (report) {
      // Close any open dashboard
      const overlay = document.querySelector('.analytics-overlay');
      if (overlay) {
        document.body.removeChild(overlay);
      }
      
      // Switch to the report type and populate the form
      Navigation.switchReport(report.type);
      FormManager.populateForm(report.type);
      
      // Show the report content
      document.getElementById('reportOutput').textContent = report.content;
      document.querySelector('.output-container').scrollIntoView({ 
        behavior: 'smooth',
        block: 'nearest'
      });
      
      StatusManager.success('Report loaded from history');
    }
  },

  // Export history
  exportHistory: (format) => {
    const reports = AppState.generatedReports;
    
    if (reports.length === 0) {
      StatusManager.warning('No reports to export');
      return;
    }
    
    let content, filename, mimeType;
    
    if (format === 'csv') {
      content = ReportAnalytics.generateCSV(reports);
      filename = `report_history_${Date.now()}.csv`;
      mimeType = 'text/csv';
    } else if (format === 'json') {
      content = JSON.stringify(reports, null, 2);
      filename = `report_history_${Date.now()}.json`;
      mimeType = 'application/json';
    }
    
    Utils.downloadFile(content, filename, mimeType);
    StatusManager.success(`Report history exported as ${format.toUpperCase()}`);
  },

  // Generate CSV content
  generateCSV: (reports) => {
    const headers = ['Timestamp', 'Type', 'Content Preview'];
    const rows = reports.map(report => [
      report.timestamp,
      report.type,
      report.content.substring(0, 100).replace(/\n/g, ' ') + '...'
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    return csvContent;
  },

  // Clear history
  clearHistory: () => {
    if (!confirm('Are you sure you want to clear all report history? This action cannot be undone.')) {
      return;
    }
    
    AppState.generatedReports = [];
    ReportAnalytics.saveReportHistory();
    
    // Refresh dashboard if open
    const dashboard = document.querySelector('.analytics-dashboard');
    if (dashboard) {
      const content = dashboard.querySelector('div:nth-child(2)');
      if (content) {
        content.innerHTML = ReportAnalytics.generateDashboardContent();
      }
    }
    
    StatusManager.success('Report history cleared');
  }
};

// ===== DYNAMIC FIELD MANAGEMENT =====
const DynamicFields = {
  // Add officer field
  addOfficer: () => {
    const container = document.getElementById('arrestingOfficers');
    const fieldItem = document.createElement('div');
    fieldItem.className = 'field-item';
    fieldItem.innerHTML = `
      <input type="text" placeholder="Officer Name / Badge" class="officer-input">
      <button class="remove-btn" onclick="DynamicFields.removeField(this)">×</button>
    `;
    container.appendChild(fieldItem);
    
    // Focus on new field
    fieldItem.querySelector('input').focus();
  },

  // Add suspect field
  addSuspect: () => {
    const container = document.getElementById('suspects');
    const fieldItem = document.createElement('div');
    fieldItem.className = 'field-item suspect-item';
    fieldItem.innerHTML = `
      <div class="suspect-fields">
        <input type="text" placeholder="Suspect Name" class="suspect-name">
        <input type="text" placeholder="ID Number" class="suspect-id">
        <textarea placeholder="Charges" class="suspect-charges" rows="2"></textarea>
      </div>
      <button class="remove-btn" onclick="DynamicFields.removeField(this)">×</button>
    `;
    container.appendChild(fieldItem);
    
    // Focus on first field
    fieldItem.querySelector('.suspect-name').focus();
  },

  // Remove field
  removeField: (button) => {
    const fieldItem = button.closest('.field-item');
    if (fieldItem) {
      fieldItem.style.animation = 'fadeOut 0.3s ease';
      setTimeout(() => fieldItem.remove(), 300);
    }
  }
};

// ===== REPORT GENERATION =====
const ReportGenerator = {
  // Generate report
  generate: (reportType) => {
    console.log('Generating report for:', reportType);
    
    if (!SmartValidation.validateForm(reportType)) {
      console.log('Form validation failed');
      StatusManager.error('Please correct the validation errors before generating the report');
      return;
    }

    console.log('Form validation passed');
    const formData = FormManager.getFormData(reportType);
    console.log('Form data collected:', formData);
    
    const report = ReportGenerator.buildReport(reportType, formData);
    console.log('Report built:', report);
    
    // Display report
    const output = document.getElementById('reportOutput');
    console.log('Output element:', output);
    output.textContent = report;
    console.log('Report set to output element');
    
    // Save to history
    AppState.generatedReports.push({
      type: reportType,
      content: report,
      timestamp: new Date().toISOString(),
      formData: formData
    });

    // Save to analytics
    ReportAnalytics.saveReportHistory();
    ReportAnalytics.updateStatistics();

    // Show success message
    StatusManager.success('Report generated successfully');
    
    // Scroll to output
    document.querySelector('.output-container').scrollIntoView({ 
      behavior: 'smooth',
      block: 'nearest'
    });
  },

  // Build report content
  buildReport: (reportType, formData) => {
    console.log('Building report for type:', reportType, 'with data:', formData);
    
    const headers = {
      'arrest': 'ARREST REPORT',
      'citation': 'CITATION REPORT',
      'case-opening': 'CASE OPENING FILE',
      'investigative-update': 'INVESTIGATIVE UPDATE',
      'interview': 'INTERVIEW REPORT',
      'ci-report': 'CONFIDENTIAL INFORMANT REPORT',
      'warrant': 'WARRANT SUPPORT SUMMARY',
      'case-closure': 'CASE CLOSURE SUMMARY'
    };

    let report = `${headers[reportType]}\n`;
    report += '='.repeat(50) + '\n\n';

    console.log('Report header created:', report);

    // Add form fields
    Object.keys(formData).forEach(key => {
      if (key !== 'officers' && key !== 'suspects' && formData[key]) {
        const label = ReportGenerator.formatLabel(key);
        report += `${label}:\n${formData[key]}\n\n`;
        console.log('Added field:', key, 'with value:', formData[key]);
      }
    });

    // Add dynamic fields
    if (formData.officers && formData.officers.length > 0) {
      report += 'ARRESTING OFFICERS:\n';
      formData.officers.forEach((officer, index) => {
        report += `${index + 1}. ${officer}\n`;
      });
      report += '\n';
    }

    if (formData.suspects && formData.suspects.length > 0) {
      report += 'SUSPECTS:\n';
      formData.suspects.forEach((suspect, index) => {
        report += `${index + 1}. ${suspect.name || 'Unknown'}`;
        if (suspect.id) report += ` (ID: ${suspect.id})`;
        if (suspect.charges) report += `\n   Charges: ${suspect.charges}`;
        report += '\n';
      });
      report += '\n';
    }

    console.log('Final report content:', report);
    return report;
  },

  // Format field label
  formatLabel: (key) => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }
};

// ===== OUTPUT MANAGEMENT =====
const OutputManager = {
  // Copy report to clipboard
  copy: async () => {
    const output = document.getElementById('reportOutput').textContent;
    
    if (!output || output === 'Your generated report will appear here...') {
      StatusManager.warning('No report to copy');
      return;
    }

    try {
      await Utils.copyToClipboard(output);
      StatusManager.success('Report copied to clipboard');
    } catch (err) {
      StatusManager.error('Failed to copy report');
    }
  },

  // Download report
  download: () => {
    const output = document.getElementById('reportOutput').textContent;
    
    if (!output || output === 'Your generated report will appear here...') {
      StatusManager.warning('No report to download');
      return;
    }

    const filename = `report_${AppState.currentReport}_${Date.now()}.txt`;
    Utils.downloadFile(output, filename);
    StatusManager.success('Report downloaded successfully');
  },

  // Print report
  print: () => {
    const output = document.getElementById('reportOutput').textContent;
    
    if (!output || output === 'Your generated report will appear here...') {
      StatusManager.warning('No report to print');
      return;
    }

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Report</title>
          <style>
            body { font-family: monospace; white-space: pre-wrap; padding: 20px; }
          </style>
        </head>
        <body><pre>${output}</pre></body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
    StatusManager.success('Print dialog opened');
  },

  // Clear output
  clear: () => {
    document.getElementById('reportOutput').textContent = 'Your generated report will appear here...';
    StatusManager.info('Output cleared');
  }
};

// ===== GLOBAL FUNCTIONS =====
// These functions are called from HTML onclick handlers
function clearForm(reportType) {
  FormManager.clearForm(reportType);
}

function generateReport(reportType) {
  ReportGenerator.generate(reportType);
}

// Test function for debugging
function testReportGeneration() {
  console.log('Testing report generation...');
  
  // Fill in minimal essential fields for arrest report
  document.getElementById('arrestDateTime').value = '2024-01-15T14:30';
  document.getElementById('arrestLocation').value = 'Test Location';
  
  generateReport('arrest');
}

function addOfficer() {
  DynamicFields.addOfficer();
}

function addSuspect() {
  DynamicFields.addSuspect();
}

function removeField(button) {
  DynamicFields.removeField(button);
}

function copyReport() {
  OutputManager.copy();
}

function downloadReport() {
  OutputManager.download();
}

function printReport() {
  OutputManager.print();
}

function clearOutput() {
  OutputManager.clear();
}

// ===== KEYBOARD SHORTCUTS =====
const KeyboardShortcuts = {
  init: () => {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + G: Generate report
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        generateReport(AppState.currentReport);
      }
      
      // Ctrl/Cmd + C: Copy report (when not in input)
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && 
          !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        e.preventDefault();
        OutputManager.copy();
      }
      
      // Ctrl/Cmd + S: Save form
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        FormManager.saveFormData();
        StatusManager.success('Form saved');
      }
      
      // Ctrl/Cmd + P: Print report
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        OutputManager.print();
      }
      
      // Escape: Clear errors
      if (e.key === 'Escape') {
        document.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
      }
    });
  }
};

// ===== INITIALIZATION =====
const App = {
  init: () => {
    // Initialize components
    AutoSave.init();
    FormManager.init();
    ReportTemplates.init();
    ReportAnalytics.init();
    KeyboardShortcuts.init();
    
    // Load saved data
    FormManager.loadFormData();
    
    // Set initial report type and ensure it's visible
    Navigation.switchReport('arrest');
    
    // Show welcome message
    StatusManager.info('Welcome to Kyntra\'s LEO Report Generator - Enhanced with Auto-Save, Smart Validation, Templates, and Analytics!');
  }
};

// ===== START APP =====
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

// Add CSS animation for field removal and validation
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeOut {
    from { opacity: 1; transform: translateX(0); }
    to { opacity: 0; transform: translateX(-20px); }
  }
  
  @keyframes slideOutRight {
    from { opacity: 1; transform: translateX(0); }
    to { opacity: 0; transform: translateX(100%); }
  }
  
  .error {
    border-color: var(--error-color) !important;
    box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2) !important;
  }
  
  .valid {
    border-color: var(--success-color) !important;
    box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2) !important;
  }
  
  .invalid {
    border-color: var(--error-color) !important;
    box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2) !important;
  }
  
  .warning {
    border-color: var(--warning-color) !important;
    box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2) !important;
  }
  
  .validation-feedback {
    font-size: 12px;
    margin-top: 4px;
    font-weight: 500;
  }
  
  .validation-feedback.error {
    color: var(--error-color);
  }
  
  .validation-feedback.success {
    color: var(--success-color);
  }
  
  .validation-feedback.warning {
    color: var(--warning-color);
  }
  
  .form-progress-container {
    margin-bottom: 20px;
    padding: 10px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .template-container {
    margin-bottom: 20px;
    padding: 15px;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 8px;
  }
  
  .status-message {
    padding: 12px 16px;
    margin: 8px 0;
    border-radius: 6px;
    font-weight: 500;
    animation: slideInRight 0.3s ease;
  }
  
  .status-message.success {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: var(--success-color);
  }
  
  .status-message.error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: var(--error-color);
  }
  
  .status-message.warning {
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.3);
    color: var(--warning-color);
  }
  
  .status-message.info {
    background: rgba(6, 182, 212, 0.1);
    border: 1px solid rgba(6, 182, 212, 0.3);
    color: var(--accent-color);
  }
  
  @keyframes slideInRight {
    from { opacity: 0; transform: translateX(20px); }
    to { opacity: 1; transform: translateX(0); }
  }
`;
document.head.appendChild(style);
