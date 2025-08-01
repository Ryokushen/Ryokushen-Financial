// js/modules/transactionTemplates.js
import { eventManager } from './eventManager.js';
import { transactionManager } from './transactionManager.js';
import { modalManager } from './modalManager.js';
import { showError, showSuccess, announceToScreenReader } from './ui.js';
import { formatCurrency, escapeHtml } from './utils.js';
import { populateCategoryDropdown, getCategoryIcon } from './categories.js';
import { debug } from './debug.js';
import { loadingState } from './loadingState.js';

class TransactionTemplatesUI {
  constructor() {
    this.templates = [];
    this.suggestedTemplates = [];
    this.filteredTemplates = [];
    this.editingTemplateId = null;
    this.selectedTemplateId = null;
  }

  async init() {
    this.setupEventListeners();
    this.registerModals();
    await this.loadTemplates();
    debug.log('Transaction Templates UI initialized');
  }

  setupEventListeners() {
    // Templates button
    const templatesBtn = document.getElementById('templates-btn');
    if (templatesBtn) {
      eventManager.addEventListener(templatesBtn, 'click', () => {
        this.openTemplatesModal();
      });
    }

    // Create template button
    const createBtn = document.getElementById('create-template-btn');
    if (createBtn) {
      eventManager.addEventListener(createBtn, 'click', () => {
        this.openTemplateForm();
      });
    }

    // Save template button
    const saveBtn = document.getElementById('save-template-btn');
    if (saveBtn) {
      eventManager.addEventListener(saveBtn, 'click', () => {
        this.saveTemplate();
      });
    }

    // Cancel templates button
    const cancelTemplatesBtn = document.getElementById('cancel-templates-btn');
    if (cancelTemplatesBtn) {
      eventManager.addEventListener(cancelTemplatesBtn, 'click', () => {
        modalManager.close('templates-modal');
      });
    }

    // Template search
    const searchInput = document.getElementById('template-search');
    if (searchInput) {
      eventManager.addEventListener(searchInput, 'input', e => {
        this.filterTemplates(e.target.value);
      });
    }

    // Form validation
    const templateForm = document.getElementById('template-form');
    if (templateForm) {
      eventManager.addEventListener(templateForm, 'submit', e => {
        e.preventDefault();
        this.saveTemplate();
      });
    }

    // Modal close handlers are managed by modalManager when modals are registered
  }

  registerModals() {
    modalManager.register('templates-modal');
    modalManager.register('template-form-modal');
  }

  async loadTemplates() {
    try {
      loadingState.showOperationLock('Loading templates...');

      // Load all templates
      this.templates = await transactionManager.getTransactionTemplates();

      // Load suggested templates
      this.suggestedTemplates = await transactionManager.getSuggestedTemplates(5);

      this.renderTemplates();

      loadingState.hideOperationLock();
    } catch (error) {
      loadingState.hideOperationLock();
      debug.error('Failed to load templates:', error);
      showError('Failed to load templates');
    }
  }

  openTemplatesModal() {
    modalManager.open('templates-modal');
    this.loadTemplates(); // Refresh data when opening
  }

  openTemplateForm(templateId = null) {
    const formTitle = document.getElementById('template-form-title');
    const templateIdInput = document.getElementById('template-id');
    const form = document.getElementById('template-form');

    // Reset form
    form.reset();

    // Populate dropdowns
    const categorySelect = document.getElementById('template-category');
    if (categorySelect) {
      populateCategoryDropdown('template-category');
    }

    const accountSelect = document.getElementById('template-account');
    if (accountSelect) {
      this.populateAccountDropdown(accountSelect);
    }

    if (templateId) {
      // Edit mode
      formTitle.textContent = 'Edit Template';
      templateIdInput.value = templateId;
      this.editingTemplateId = templateId;

      // Load template data
      const template = this.templates.find(t => t.id === templateId);
      if (template) {
        document.getElementById('template-name').value = template.name || '';
        document.getElementById('template-description').value = template.description || '';
        document.getElementById('template-category').value = template.category || '';
        document.getElementById('template-amount').value = template.amount || '';
        document.getElementById('template-account').value = template.account_id || '';
        // Extract notes from tags array (first tag used as notes)
        document.getElementById('template-notes').value =
          template.tags && template.tags.length > 0 ? template.tags[0] : '';
      }
    } else {
      // Create mode
      formTitle.textContent = 'Create Template';
      templateIdInput.value = '';
      this.editingTemplateId = null;
    }

    // Re-register modal to ensure event listeners are attached
    modalManager.register('template-form-modal');
    modalManager.open('template-form-modal');
  }

  async saveTemplate() {
    const form = document.getElementById('template-form');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const templateData = {
      name: document.getElementById('template-name').value,
      description: document.getElementById('template-description').value,
      category: document.getElementById('template-category').value,
      amount: parseFloat(document.getElementById('template-amount').value) || null,
      account_id: parseInt(document.getElementById('template-account').value) || null,
      // Add notes to tags array if provided
      tags: document.getElementById('template-notes').value
        ? [document.getElementById('template-notes').value]
        : [],
    };

    try {
      loadingState.showOperationLock('Saving template...');

      if (this.editingTemplateId) {
        // Update existing template
        await transactionManager.updateTemplate(this.editingTemplateId, templateData);
        showSuccess('Template updated successfully');
      } else {
        // Create new template
        await transactionManager.createTemplate(templateData);
        showSuccess('Template created successfully');
      }

      modalManager.close('template-form-modal');
      await this.loadTemplates();

      loadingState.hideOperationLock();
    } catch (error) {
      loadingState.hideOperationLock();
      debug.error('Failed to save template:', error);
      showError(`Failed to save template: ${error.message}`);
    }
  }

  async deleteTemplate(templateId) {
    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      loadingState.showOperationLock('Deleting template...');

      await transactionManager.deleteTemplate(templateId);
      showSuccess('Template deleted successfully');

      await this.loadTemplates();

      loadingState.hideOperationLock();
    } catch (error) {
      loadingState.hideOperationLock();
      debug.error('Failed to delete template:', error);
      showError('Failed to delete template');
    }
  }

  async useTemplate(templateId) {
    try {
      // Search in both regular templates and suggested templates
      let template = this.templates.find(t => t.id === templateId);
      if (!template) {
        template = this.suggestedTemplates.find(t => t.id === templateId);
      }

      if (!template) {
        debug.error('Template not found with ID:', templateId);
        showError('Template not found');
        return;
      }

      // Close the templates modal
      modalManager.close('templates-modal');

      // Fill the transaction form
      this.populateTransactionForm(template);

      announceToScreenReader('Template applied to transaction form');
    } catch (error) {
      debug.error('Failed to use template:', error);
      showError('Failed to apply template');
    }
  }

  populateTransactionForm(template) {
    // Set values in the transaction form
    const descriptionInput = document.getElementById('transaction-description');
    if (descriptionInput && template.description) {
      descriptionInput.value = template.description;
    }

    const categorySelect = document.getElementById('transaction-category');
    if (categorySelect && template.category) {
      categorySelect.value = template.category;
      categorySelect.dispatchEvent(new Event('change'));
    }

    const amountInput = document.getElementById('transaction-amount');
    if (amountInput && template.amount) {
      amountInput.value = Math.abs(template.amount);
    }

    const accountSelect = document.getElementById('transaction-account');
    if (accountSelect && template.account_id) {
      accountSelect.value = template.account_id;
    }

    const notesInput = document.getElementById('transaction-notes');
    if (notesInput && template.tags && template.tags.length > 0) {
      notesInput.value = template.tags[0]; // Use first tag as notes
    }

    // Focus on the date field for quick entry
    const dateInput = document.getElementById('transaction-date');
    if (dateInput) {
      if (!dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
      }
      dateInput.focus();
    }

    // Show the transaction form section
    const formSection = document.querySelector('.transaction-form-section');
    if (formSection) {
      formSection.style.display = 'block';

      // Scroll to form for better UX
      const form = document.getElementById('transaction-form');
      if (form) {
        form.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }

  renderTemplates() {
    this.renderSuggestedTemplates();
    this.renderAllTemplates();
  }

  renderSuggestedTemplates() {
    const section = document.getElementById('suggested-templates-section');
    const container = document.getElementById('suggested-templates-list');

    if (!container || !section) {
      return;
    }

    if (this.suggestedTemplates.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';

    container.innerHTML = this.suggestedTemplates
      .map(template => {
        return this.createTemplateCard(template, true, template.frequency);
      })
      .join('');

    // Add event listeners to suggested template cards
    this.attachCardEventListeners(container);
  }

  renderAllTemplates() {
    const container = document.getElementById('templates-list');
    const emptyState = document.getElementById('empty-templates-state');

    if (!container || !emptyState) {
      return;
    }

    const templatesToRender =
      this.filteredTemplates.length > 0 || this.searchActive
        ? this.filteredTemplates
        : this.templates;

    if (templatesToRender.length === 0) {
      container.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';

    container.innerHTML = templatesToRender
      .map(template => this.createTemplateCard(template, false))
      .join('');

    // Add event listeners to template cards
    this.attachCardEventListeners(container);
  }

  createTemplateCard(template, isSuggested = false, frequency = null) {
    const icon = getCategoryIcon(template.category);
    const amount = template.amount ? formatCurrency(Math.abs(template.amount)) : 'Variable';

    // For suggested templates, create a temporary ID if none exists
    const templateId =
      template.id || `suggested-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return `
            <div class="template-card" data-template-id="${templateId}">
                <div class="template-card__header">
                    <span class="template-card__icon">${icon}</span>
                    <h4 class="template-card__name">${escapeHtml(template.name)}</h4>
                </div>
                <div class="template-card__details">
                    <div class="template-card__category">${escapeHtml(template.category)}</div>
                    <div class="template-card__amount">${amount}</div>
                    ${template.description ? `<div class="template-card__description">${escapeHtml(template.description)}</div>` : ''}
                    ${isSuggested && frequency ? `<div class="template-card__frequency">Used ${frequency} times</div>` : ''}
                </div>
                <div class="template-card__actions">
                    ${
                      isSuggested
                        ? `
                        <button class="btn btn--small btn--primary use-suggested-template" data-template='${JSON.stringify(template).replace(/'/g, '&apos;')}'>
                            Use
                        </button>
                        <button class="btn btn--small btn--ghost create-from-suggestion" data-template='${JSON.stringify({ ...template, frequency: undefined }).replace(/'/g, '&apos;')}'>
                            Save Template
                        </button>
                    `
                        : `
                        <button class="btn btn--small btn--primary use-template" data-template-id="${templateId}">
                            Use
                        </button>
                        <button class="btn btn--small btn--ghost edit-template" data-template-id="${templateId}">
                            Edit
                        </button>
                        <button class="btn btn--small btn--ghost delete-template" data-template-id="${templateId}">
                            Delete
                        </button>
                    `
                    }
                </div>
            </div>
        `;
  }

  attachCardEventListeners(container) {
    // Use template buttons
    container.querySelectorAll('.use-template').forEach(btn => {
      eventManager.addEventListener(btn, 'click', e => {
        const templateId = parseInt(e.target.dataset.templateId);
        this.useTemplate(templateId);
      });
    });

    // Use suggested template buttons
    container.querySelectorAll('.use-suggested-template').forEach(btn => {
      eventManager.addEventListener(btn, 'click', e => {
        try {
          const template = JSON.parse(e.target.dataset.template);

          // Close the templates modal
          modalManager.close('templates-modal');

          // Fill the transaction form with suggested template data
          this.populateTransactionForm(template);

          announceToScreenReader('Template applied to transaction form');
        } catch (error) {
          debug.error('Failed to use suggested template:', error);
          showError('Failed to apply template');
        }
      });
    });

    // Edit template buttons
    container.querySelectorAll('.edit-template').forEach(btn => {
      eventManager.addEventListener(btn, 'click', e => {
        const templateId = parseInt(e.target.dataset.templateId);
        this.openTemplateForm(templateId);
      });
    });

    // Delete template buttons
    container.querySelectorAll('.delete-template').forEach(btn => {
      eventManager.addEventListener(btn, 'click', e => {
        const templateId = parseInt(e.target.dataset.templateId);
        this.deleteTemplate(templateId);
      });
    });

    // Create from suggestion buttons
    container.querySelectorAll('.create-from-suggestion').forEach(btn => {
      eventManager.addEventListener(btn, 'click', async e => {
        try {
          const template = JSON.parse(e.target.dataset.template);
          delete template.id; // Remove ID so it creates a new template
          delete template.frequency; // Remove frequency as it's not a template field

          await transactionManager.createTemplate(template);
          showSuccess('Template created from suggestion');
          await this.loadTemplates();
        } catch (error) {
          debug.error('Failed to create template from suggestion:', error);
          showError('Failed to create template');
        }
      });
    });
  }

  filterTemplates(searchTerm) {
    this.searchActive = searchTerm.length > 0;

    if (!searchTerm) {
      this.filteredTemplates = [];
      this.renderAllTemplates();
      return;
    }

    const term = searchTerm.toLowerCase();
    this.filteredTemplates = this.templates.filter(
      template =>
        template.name.toLowerCase().includes(term) ||
        (template.description && template.description.toLowerCase().includes(term)) ||
        template.category.toLowerCase().includes(term)
    );

    this.renderAllTemplates();
  }

  populateAccountDropdown(selectElement) {
    // Get cash accounts from the app state
    const appState = window.appState || { appData: { cashAccounts: [] } };
    const cashAccounts = appState.appData.cashAccounts || [];

    selectElement.innerHTML = '<option value="">— Select Account —</option>';

    cashAccounts
      .filter(account => account.isActive)
      .forEach(account => {
        const option = document.createElement('option');
        option.value = account.id;
        option.textContent = account.name;
        selectElement.appendChild(option);
      });
  }

  // Method to create template from existing transaction
  async createFromTransaction(transactionId, name) {
    try {
      loadingState.showOperationLock('Creating template...');

      await transactionManager.createTemplateFromTransaction(transactionId, name);
      showSuccess('Template created successfully');

      await this.loadTemplates();

      loadingState.hideOperationLock();
    } catch (error) {
      loadingState.hideOperationLock();
      debug.error('Failed to create template from transaction:', error);
      showError('Failed to create template');
    }
  }

  cleanup() {
    eventManager.removeAllListeners();
    this.templates = [];
    this.suggestedTemplates = [];
    this.filteredTemplates = [];
  }
}

// Create singleton instance
export const transactionTemplatesUI = new TransactionTemplatesUI();
