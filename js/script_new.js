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
  }
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

// ===== FORM MANAGEMENT =====
const FormManager = {
  // Initialize form listeners
  init: () => {
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
    
    if (!FormManager.validateForm(reportType)) {
      console.log('Form validation failed');
      StatusManager.error('Please fill in all required fields');
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
    FormManager.init();
    KeyboardShortcuts.init();
    
    // Load saved data
    FormManager.loadFormData();
    
    // Set initial report type and ensure it's visible
    Navigation.switchReport('arrest');
    
    // Show welcome message
    StatusManager.info('Welcome to Kyntra\'s LEO Report Generator');
  }
};

// ===== START APP =====
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

// Add CSS animation for field removal
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
`;
document.head.appendChild(style);
