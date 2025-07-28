// js/modules/transactionImport.js - Transaction Import UI Module

import { eventManager } from './eventManager.js';
import { transactionManager } from './transactionManager.js';
import { showError, showSuccess } from './ui.js';
import { modalManager } from './modalManager.js';
import { categories } from './categories.js';
import { debug } from './debug.js';

/**
 * Transaction Import Module
 * Handles importing transactions from CSV, QFX, and QIF files
 */
class TransactionImport {
  constructor() {
    this.modal = null;
    this.fileInput = null;
    this.fileData = null;
    this.parsedTransactions = [];
    this.columnMapping = {};
    this.currentStep = 'upload';
    this.importOptions = {
      skipDuplicates: true,
      autoCategorize: true,
    };
  }

  /**
   * Initialize the module
   */
  init() {
    debug.log('TransactionImport: Initializing');

    // Get DOM elements
    this.modal = document.getElementById('import-transactions-modal');
    this.fileInput = document.getElementById('import-file-input');

    if (!this.modal || !this.fileInput) {
      debug.error('TransactionImport: Required elements not found');
      return;
    }

    // Register modal with modalManager
    modalManager.register('import-transactions-modal', {
      resetFormOnOpen: false,
      closeOnEscape: true,
      closeOnClickOutside: false,
    });

    // Setup event listeners
    this.setupEventListeners();

    debug.log('TransactionImport: Initialized');
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Import button
    const importBtn = document.getElementById('import-transactions-btn');
    if (importBtn) {
      eventManager.addEventListener(importBtn, 'click', () => this.openModal());
    }

    // File upload area
    const uploadArea = document.getElementById('file-upload-area');
    if (uploadArea) {
      eventManager.addEventListener(uploadArea, 'click', () => this.fileInput.click());
      eventManager.addEventListener(uploadArea, 'dragover', e => this.handleDragOver(e));
      eventManager.addEventListener(uploadArea, 'dragleave', e => this.handleDragLeave(e));
      eventManager.addEventListener(uploadArea, 'drop', e => this.handleDrop(e));
    }

    // File input
    eventManager.addEventListener(this.fileInput, 'change', e => this.handleFileSelect(e));

    // Modal buttons
    const cancelBtn = document.getElementById('import-cancel-btn');
    const backBtn = document.getElementById('import-back-btn');
    const nextBtn = document.getElementById('import-next-btn');
    const startBtn = document.getElementById('import-start-btn');
    const doneBtn = document.getElementById('import-done-btn');

    if (cancelBtn) {
      eventManager.addEventListener(cancelBtn, 'click', () => this.closeModal());
    }

    // Close button (X)
    const closeBtn = this.modal.querySelector('.modal-close');
    if (closeBtn) {
      eventManager.addEventListener(closeBtn, 'click', () => this.closeModal());
    }

    if (backBtn) {
      eventManager.addEventListener(backBtn, 'click', () => this.previousStep());
    }

    if (nextBtn) {
      eventManager.addEventListener(nextBtn, 'click', () => this.nextStep());
    }

    if (startBtn) {
      eventManager.addEventListener(startBtn, 'click', () => this.startImport());
    }

    if (doneBtn) {
      eventManager.addEventListener(doneBtn, 'click', () => this.closeModal());
    }

    // Import options
    const skipDuplicates = document.getElementById('skip-duplicates');
    const autoCategorize = document.getElementById('auto-categorize');

    if (skipDuplicates) {
      eventManager.addEventListener(skipDuplicates, 'change', e => {
        this.importOptions.skipDuplicates = e.target.checked;
      });
    }

    if (autoCategorize) {
      eventManager.addEventListener(autoCategorize, 'change', e => {
        this.importOptions.autoCategorize = e.target.checked;
      });
    }
  }

  /**
   * Open the import modal
   */
  openModal() {
    this.resetModal();
    modalManager.open('import-transactions-modal');
  }

  /**
   * Close the import modal
   */
  closeModal() {
    modalManager.close('import-transactions-modal');
    this.resetModal();
  }

  /**
   * Reset modal to initial state
   */
  resetModal() {
    this.fileData = null;
    this.parsedTransactions = [];
    this.columnMapping = {};
    this.currentStep = 'upload';
    this.fileInput.value = '';

    // Reset UI
    this.showStep('upload');
    document.getElementById('file-info').style.display = 'none';
    document.getElementById('import-next-btn').disabled = true;

    // Reset file upload area
    const uploadArea = document.getElementById('file-upload-area');
    if (uploadArea) {
      uploadArea.classList.remove('drag-over');
    }
  }

  /**
   * Handle drag over event
   */
  handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  }

  /**
   * Handle drag leave event
   */
  handleDragLeave(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
  }

  /**
   * Handle file drop
   */
  handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      this.processFile(files[0]);
    }
  }

  /**
   * Handle file selection
   */
  handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
      this.processFile(file);
    }
  }

  /**
   * Process selected file
   */
  async processFile(file) {
    try {
      // Validate file type
      const validTypes = ['.csv', '.qfx', '.qif'];
      const fileExt = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

      if (!validTypes.includes(fileExt)) {
        showError('Please select a CSV, QFX, or QIF file');
        return;
      }

      // Read file
      const text = await this.readFile(file);
      this.fileData = {
        name: file.name,
        type: fileExt.substring(1).toUpperCase(),
        content: text,
      };

      // Update UI
      document.getElementById('selected-filename').textContent = file.name;
      document.getElementById('detected-format').textContent = this.fileData.type;
      document.getElementById('file-info').style.display = 'block';
      document.getElementById('import-next-btn').disabled = false;

      debug.log(`TransactionImport: File loaded - ${file.name} (${this.fileData.type})`);
    } catch (error) {
      debug.error('TransactionImport: Error processing file', error);
      showError('Error reading file');
    }
  }

  /**
   * Read file as text
   */
  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  /**
   * Show specific step
   */
  showStep(step) {
    // Hide all steps
    document.querySelectorAll('.import-step').forEach(el => {
      el.style.display = 'none';
    });

    // Show current step
    document.getElementById(`import-step-${step}`).style.display = 'block';

    // Update buttons
    const backBtn = document.getElementById('import-back-btn');
    const nextBtn = document.getElementById('import-next-btn');
    const startBtn = document.getElementById('import-start-btn');
    const doneBtn = document.getElementById('import-done-btn');

    backBtn.style.display = step === 'upload' ? 'none' : 'inline-block';
    nextBtn.style.display = ['upload', 'mapping'].includes(step) ? 'inline-block' : 'none';
    startBtn.style.display = step === 'preview' ? 'inline-block' : 'none';
    doneBtn.style.display = step === 'complete' ? 'inline-block' : 'none';

    this.currentStep = step;
  }

  /**
   * Go to next step
   */
  async nextStep() {
    switch (this.currentStep) {
      case 'upload':
        await this.parseFile();
        break;
      case 'mapping':
        await this.applyMapping();
        break;
    }
  }

  /**
   * Go to previous step
   */
  previousStep() {
    switch (this.currentStep) {
      case 'mapping':
        this.showStep('upload');
        break;
      case 'preview':
        if (this.fileData.type === 'CSV') {
          this.showStep('mapping');
        } else {
          this.showStep('upload');
        }
        break;
    }
  }

  /**
   * Parse the file based on type
   */
  async parseFile() {
    try {
      switch (this.fileData.type) {
        case 'CSV':
          await this.parseCSV();
          this.showStep('mapping');
          break;
        case 'QFX':
          await this.parseQFX();
          this.showStep('preview');
          break;
        case 'QIF':
          await this.parseQIF();
          this.showStep('preview');
          break;
      }
    } catch (error) {
      debug.error('TransactionImport: Error parsing file', error);
      showError('Error parsing file');
    }
  }

  /**
   * Parse CSV file
   */
  async parseCSV() {
    const lines = this.fileData.content.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV file must have headers and at least one data row');
    }

    // Parse headers
    const headers = this.parseCSVLine(lines[0]);

    // Parse data rows
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === headers.length) {
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index];
        });
        rows.push(row);
      }
    }

    // Store for mapping
    this.csvHeaders = headers;
    this.csvRows = rows;

    // Create column mapping UI
    this.createColumnMapping(headers);

    debug.log(`TransactionImport: Parsed ${rows.length} CSV rows`);
  }

  /**
   * Parse CSV line (simple implementation)
   */
  parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  }

  /**
   * Parse QFX file (OFX format)
   */
  async parseQFX() {
    // Simple QFX parser - extracts transaction data
    const transactions = [];
    const content = this.fileData.content;

    // Find all transactions
    const transactionRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
    let match;

    while ((match = transactionRegex.exec(content)) !== null) {
      const transData = match[1];

      const transaction = {
        date: this.extractOFXField(transData, 'DTPOSTED'),
        amount: parseFloat(this.extractOFXField(transData, 'TRNAMT')),
        description: this.extractOFXField(transData, 'NAME'),
        fitid: this.extractOFXField(transData, 'FITID'),
        type: this.extractOFXField(transData, 'TRNTYPE'),
      };

      // Format date
      if (transaction.date) {
        transaction.date = this.formatOFXDate(transaction.date);
      }

      transactions.push(transaction);
    }

    this.parsedTransactions = transactions;
    await this.createPreview();

    debug.log(`TransactionImport: Parsed ${transactions.length} QFX transactions`);
  }

  /**
   * Extract field from OFX data
   */
  extractOFXField(data, field) {
    const regex = new RegExp(`<${field}>([^<]+)`);
    const match = data.match(regex);
    return match ? match[1].trim() : null;
  }

  /**
   * Format OFX date (YYYYMMDD to YYYY-MM-DD)
   */
  formatOFXDate(dateStr) {
    if (dateStr.length >= 8) {
      return `${dateStr.substr(0, 4)}-${dateStr.substr(4, 2)}-${dateStr.substr(6, 2)}`;
    }
    return dateStr;
  }

  /**
   * Parse QIF file
   */
  async parseQIF() {
    const transactions = [];
    const lines = this.fileData.content.split('\n');

    let currentTransaction = null;

    for (const line of lines) {
      if (line.trim() === '') {
        continue;
      }

      const code = line[0];
      const value = line.substring(1).trim();

      switch (code) {
        case '!':
          // Header - ignore
          break;
        case 'D':
          // Date - start new transaction
          if (currentTransaction) {
            transactions.push(currentTransaction);
          }
          currentTransaction = {
            date: this.parseQIFDate(value),
            amount: 0,
            description: '',
          };
          break;
        case 'T':
        case 'U':
          // Amount
          if (currentTransaction) {
            currentTransaction.amount = parseFloat(value.replace(/[,$]/g, ''));
          }
          break;
        case 'P':
          // Payee/Description
          if (currentTransaction) {
            currentTransaction.description = value;
          }
          break;
        case 'M':
          // Memo - append to description
          if (currentTransaction && value) {
            currentTransaction.description += ` - ${value}`;
          }
          break;
        case 'L':
          // Category
          if (currentTransaction) {
            currentTransaction.category = value;
          }
          break;
        case '^':
          // End of transaction
          if (currentTransaction) {
            transactions.push(currentTransaction);
            currentTransaction = null;
          }
          break;
      }
    }

    // Add last transaction if exists
    if (currentTransaction) {
      transactions.push(currentTransaction);
    }

    this.parsedTransactions = transactions;
    await this.createPreview();

    debug.log(`TransactionImport: Parsed ${transactions.length} QIF transactions`);
  }

  /**
   * Parse QIF date format
   */
  parseQIFDate(dateStr) {
    // Handle various date formats (MM/DD/YY, MM/DD/YYYY, etc.)
    const parts = dateStr.split(/[\/\-\.]/);
    if (parts.length === 3) {
      let [month, day, year] = parts;

      // Handle 2-digit year
      if (year.length === 2) {
        year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
      }

      // Ensure 2-digit month and day
      month = month.padStart(2, '0');
      day = day.padStart(2, '0');

      return `${year}-${month}-${day}`;
    }
    return dateStr;
  }

  /**
   * Create column mapping UI
   */
  createColumnMapping(headers) {
    const container = document.getElementById('column-mapping-container');
    container.innerHTML = '';

    const fields = [
      { id: 'date', label: 'Date', required: true },
      { id: 'description', label: 'Description', required: true },
      { id: 'amount', label: 'Amount', required: true },
      { id: 'category', label: 'Category', required: false },
      { id: 'notes', label: 'Notes', required: false },
    ];

    fields.forEach(field => {
      const row = document.createElement('div');
      row.className = 'column-mapping-row';

      const label = document.createElement('label');
      label.textContent = field.label + (field.required ? ' *' : '');

      const select = document.createElement('select');
      select.id = `map-${field.id}`;
      select.required = field.required;

      // Add empty option
      const emptyOption = document.createElement('option');
      emptyOption.value = '';
      emptyOption.textContent = '-- Select Column --';
      select.appendChild(emptyOption);

      // Add header options
      headers.forEach(header => {
        const option = document.createElement('option');
        option.value = header;
        option.textContent = header;

        // Try to auto-select based on common names
        if (this.matchesField(header, field.id)) {
          option.selected = true;
        }

        select.appendChild(option);
      });

      row.appendChild(label);
      row.appendChild(select);
      container.appendChild(row);
    });
  }

  /**
   * Check if header matches field
   */
  matchesField(header, fieldId) {
    const headerLower = header.toLowerCase();

    switch (fieldId) {
      case 'date':
        return /date|posted|trans/i.test(header);
      case 'description':
        return /desc|payee|merchant|name/i.test(header);
      case 'amount':
        return /amount|debit|credit|value/i.test(header);
      case 'category':
        return /category|cat|type/i.test(header);
      case 'notes':
        return /notes|memo|comment/i.test(header);
      default:
        return false;
    }
  }

  /**
   * Apply column mapping
   */
  async applyMapping() {
    // Get mapping
    this.columnMapping = {
      date: document.getElementById('map-date').value,
      description: document.getElementById('map-description').value,
      amount: document.getElementById('map-amount').value,
      category: document.getElementById('map-category').value,
      notes: document.getElementById('map-notes').value,
    };

    // Validate required fields
    if (!this.columnMapping.date || !this.columnMapping.description || !this.columnMapping.amount) {
      showError('Please map all required fields');
      return;
    }

    // Convert CSV rows to transactions
    this.parsedTransactions = this.csvRows.map(row => {
      const transaction = {
        date: row[this.columnMapping.date],
        description: row[this.columnMapping.description],
        amount: parseFloat(row[this.columnMapping.amount].replace(/[,$]/g, '')),
      };

      if (this.columnMapping.category && row[this.columnMapping.category]) {
        transaction.category = row[this.columnMapping.category];
      }

      if (this.columnMapping.notes && row[this.columnMapping.notes]) {
        transaction.notes = row[this.columnMapping.notes];
      }

      return transaction;
    });

    await this.createPreview();
    this.showStep('preview');
  }

  /**
   * Create transaction preview
   */
  async createPreview() {
    const container = document.getElementById('import-preview-table');
    container.innerHTML = '';

    // Create table
    const table = document.createElement('table');

    // Header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['Date', 'Description', 'Amount', 'Category', 'Status'].forEach(text => {
      const th = document.createElement('th');
      th.textContent = text;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');

    // Check for duplicates
    const existingTransactions = await this.getExistingTransactions();
    let duplicateCount = 0;

    this.parsedTransactions.forEach((transaction, index) => {
      if (index >= 10) {
        return;
      } // Only show first 10

      const row = document.createElement('tr');

      // Check if duplicate
      const isDuplicate = this.checkDuplicate(transaction, existingTransactions);
      if (isDuplicate) {
        duplicateCount++;
        row.style.opacity = '0.5';
      }

      // Date
      const dateCell = document.createElement('td');
      dateCell.textContent = transaction.date;
      row.appendChild(dateCell);

      // Description
      const descCell = document.createElement('td');
      descCell.textContent = transaction.description;
      row.appendChild(descCell);

      // Amount
      const amountCell = document.createElement('td');
      amountCell.textContent = `$${Math.abs(transaction.amount).toFixed(2)}`;
      amountCell.style.color = transaction.amount < 0 ? '#ef4444' : '#22c55e';
      row.appendChild(amountCell);

      // Category
      const catCell = document.createElement('td');
      catCell.textContent = transaction.category || 'Uncategorized';
      row.appendChild(catCell);

      // Status
      const statusCell = document.createElement('td');
      statusCell.textContent = isDuplicate ? 'Duplicate' : 'New';
      statusCell.style.color = isDuplicate ? '#f59e0b' : '#22c55e';
      row.appendChild(statusCell);

      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    container.appendChild(table);

    // Update summary
    const newCount = this.parsedTransactions.length - duplicateCount;
    document.getElementById('total-count').textContent = this.parsedTransactions.length;
    document.getElementById('new-count').textContent = newCount;
    document.getElementById('duplicate-count').textContent = duplicateCount;
    document.getElementById('import-summary').style.display = 'block';
  }

  /**
   * Get existing transactions for duplicate check
   */
  async getExistingTransactions() {
    // Get transactions from last 90 days for duplicate checking
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    return await transactionManager.getTransactions({
      dateFrom: startDate.toISOString().split('T')[0],
    });
  }

  /**
   * Check if transaction is duplicate
   */
  checkDuplicate(transaction, existingTransactions) {
    return existingTransactions.some(existing => {
      return (
        existing.date === transaction.date &&
        Math.abs(existing.amount) === Math.abs(transaction.amount) &&
        existing.description.toLowerCase() === transaction.description.toLowerCase()
      );
    });
  }

  /**
   * Start import process
   */
  async startImport() {
    this.showStep('progress');

    try {
      // Prepare transactions for import
      const transactionsToImport = [];
      const existingTransactions = this.importOptions.skipDuplicates
        ? await this.getExistingTransactions()
        : [];

      for (const transaction of this.parsedTransactions) {
        // Skip duplicates if option is enabled
        if (
          this.importOptions.skipDuplicates &&
          this.checkDuplicate(transaction, existingTransactions)
        ) {
          continue;
        }

        // Prepare transaction data
        const transactionData = {
          date: transaction.date,
          description: transaction.description,
          amount: transaction.amount,
          category: transaction.category || 'Uncategorized',
          notes: transaction.notes || '',
          account_id: window.appState.appData.cashAccounts[0]?.id, // Default to first cash account
        };

        transactionsToImport.push(transactionData);
      }

      // Import using TransactionManager
      const result = await transactionManager.importTransactions(transactionsToImport, 'array', {
        onProgress: progress => {
          this.updateProgress(progress);
        },
      });

      // Show results
      this.showResults(result);
    } catch (error) {
      debug.error('TransactionImport: Import failed', error);
      showError('Import failed');
      this.showStep('preview');
    }
  }

  /**
   * Update progress bar
   */
  updateProgress(progress) {
    const progressBar = document.getElementById('import-progress-bar');
    const status = document.getElementById('import-status');

    progressBar.style.width = `${progress.percentage}%`;
    status.textContent = `Importing transaction ${progress.current} of ${progress.total}...`;
  }

  /**
   * Show import results
   */
  showResults(result) {
    this.showStep('complete');

    document.getElementById('success-count').textContent = result.successful;
    document.getElementById('failed-count').textContent = result.failed;

    if (result.errors.length > 0) {
      const errorList = document.getElementById('error-list');
      errorList.innerHTML = '';

      result.errors.slice(0, 10).forEach(error => {
        const li = document.createElement('li');
        li.textContent = error.error;
        errorList.appendChild(li);
      });

      document.getElementById('import-errors').style.display = 'block';
    }

    // Refresh transactions display
    window.dispatchEvent(new CustomEvent('transaction:added'));

    showSuccess(`Successfully imported ${result.successful} transactions`);
  }

  /**
   * Cleanup
   */
  cleanup() {
    // Remove event listeners if needed
    debug.log('TransactionImport: Cleanup complete');
  }
}

// Create and export singleton instance
export const transactionImport = new TransactionImport();
