/**
 * Advanced Search Module
 * Provides comprehensive transaction search functionality with filters, full-text search,
 * complex queries, and saved searches.
 */

import { showError, showSuccess } from './ui.js';
import transactionManager from './transactionManager.js';
import { categories } from './categories.js';
import { formatCurrency } from './utils.js';

class AdvancedSearch {
    constructor() {
        this.modal = null;
        this.currentPage = 1;
        this.resultsPerPage = 20;
        this.currentResults = [];
        this.savedSearches = [];
        this.init();
    }

    init() {
        this.cacheElements();
        this.attachEventListeners();
        this.loadSavedSearches();
    }

    cacheElements() {
        // Modal elements
        this.modal = document.getElementById('advanced-search-modal');
        this.searchButton = document.getElementById('advanced-search-btn');
        this.closeButton = document.getElementById('close-advanced-search-btn');
        this.modalClose = this.modal?.querySelector('.modal-close');
        
        // Search form elements
        this.searchText = document.getElementById('search-text');
        this.fuzzyCheckbox = document.getElementById('search-fuzzy');
        this.dateFrom = document.getElementById('search-date-from');
        this.dateTo = document.getElementById('search-date-to');
        this.amountMin = document.getElementById('search-amount-min');
        this.amountMax = document.getElementById('search-amount-max');
        this.categorySelect = document.getElementById('search-category');
        this.accountSelect = document.getElementById('search-account');
        this.queryTextarea = document.getElementById('search-query');
        
        // Action buttons
        this.clearButton = document.getElementById('clear-search-btn');
        this.executeButton = document.getElementById('execute-search-btn');
        this.saveSearchButton = document.getElementById('save-current-search-btn');
        this.exportButton = document.getElementById('export-results-btn');
        
        // Results elements
        this.resultsSection = document.getElementById('search-results-section');
        this.resultsCount = document.getElementById('search-results-count');
        this.resultsContainer = document.getElementById('search-results-container');
        this.paginationContainer = document.getElementById('search-pagination');
        
        // Saved searches
        this.savedSearchesList = document.getElementById('saved-searches-list');
    }

    attachEventListeners() {
        // Modal controls
        this.searchButton?.addEventListener('click', () => this.openModal());
        this.closeButton?.addEventListener('click', () => this.closeModal());
        this.modalClose?.addEventListener('click', () => this.closeModal());
        
        // Search actions
        this.clearButton?.addEventListener('click', () => this.clearSearch());
        this.executeButton?.addEventListener('click', () => this.executeSearch());
        this.saveSearchButton?.addEventListener('click', () => this.saveCurrentSearch());
        this.exportButton?.addEventListener('click', () => this.exportResults());
        
        // Close modal on outside click
        this.modal?.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        });
        
        // Enter key in search text
        this.searchText?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.executeSearch();
            }
        });
    }

    openModal() {
        if (this.modal) {
            this.modal.style.display = 'flex';
            this.populateFilters();
            this.searchText?.focus();
        }
    }

    closeModal() {
        if (this.modal) {
            this.modal.style.display = 'none';
        }
    }

    async populateFilters() {
        // Populate categories
        if (this.categorySelect) {
            this.categorySelect.innerHTML = '<option value="">— All Categories —</option>';
            Object.entries(categories).forEach(([key, category]) => {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = `${category.icon} ${category.name}`;
                this.categorySelect.appendChild(option);
            });
        }
        
        // Populate accounts
        if (this.accountSelect) {
            try {
                const supabase = window.supabaseClient;
                const user = await supabase.auth.getUser();
                
                if (user.data.user) {
                    const { data: accounts } = await supabase
                        .from('accounts')
                        .select('id, name, type')
                        .eq('user_id', user.data.user.id)
                        .order('name');
                    
                    this.accountSelect.innerHTML = '<option value="">— All Accounts —</option>';
                    accounts?.forEach(account => {
                        const option = document.createElement('option');
                        option.value = account.id;
                        option.textContent = `${account.name} (${account.type})`;
                        this.accountSelect.appendChild(option);
                    });
                }
            } catch (error) {
                console.error('Error loading accounts:', error);
            }
        }
    }

    clearSearch() {
        // Clear all form fields
        if (this.searchText) this.searchText.value = '';
        if (this.fuzzyCheckbox) this.fuzzyCheckbox.checked = true;
        if (this.dateFrom) this.dateFrom.value = '';
        if (this.dateTo) this.dateTo.value = '';
        if (this.amountMin) this.amountMin.value = '';
        if (this.amountMax) this.amountMax.value = '';
        if (this.categorySelect) this.categorySelect.value = '';
        if (this.accountSelect) this.accountSelect.value = '';
        if (this.queryTextarea) this.queryTextarea.value = '';
        
        // Clear results
        this.currentResults = [];
        this.hideResults();
    }

    async executeSearch() {
        try {
            // Show loading state
            this.executeButton.disabled = true;
            this.executeButton.textContent = 'Searching...';
            
            let results = [];
            
            // Check if using query builder
            if (this.queryTextarea.value.trim()) {
                // Use complex query search
                results = await transactionManager.searchWithQuery(this.queryTextarea.value.trim());
            } else if (this.searchText.value.trim()) {
                // Use text search
                results = await transactionManager.searchByDescription(
                    this.searchText.value.trim(),
                    { fuzzy: this.fuzzyCheckbox.checked }
                );
            } else {
                // Use filter search
                const filters = this.buildFilters();
                if (Object.keys(filters).length > 0) {
                    results = await transactionManager.searchTransactions(filters);
                } else {
                    showError('Please enter search criteria');
                    return;
                }
            }
            
            this.currentResults = results;
            this.currentPage = 1;
            this.displayResults();
            
        } catch (error) {
            console.error('Search error:', error);
            showError('Search failed: ' + error.message);
        } finally {
            this.executeButton.disabled = false;
            this.executeButton.textContent = 'Search';
        }
    }

    buildFilters() {
        const filters = {};
        
        if (this.dateFrom.value) filters.dateFrom = this.dateFrom.value;
        if (this.dateTo.value) filters.dateTo = this.dateTo.value;
        if (this.amountMin.value) filters.amountMin = parseFloat(this.amountMin.value);
        if (this.amountMax.value) filters.amountMax = parseFloat(this.amountMax.value);
        if (this.categorySelect.value) filters.category = this.categorySelect.value;
        if (this.accountSelect.value) filters.accountId = this.accountSelect.value;
        
        return filters;
    }

    displayResults() {
        if (!this.currentResults.length) {
            this.resultsContainer.innerHTML = '<p class="empty-state">No transactions found</p>';
            this.resultsCount.textContent = '0 results';
            this.resultsSection.style.display = 'block';
            return;
        }
        
        // Calculate pagination
        const totalPages = Math.ceil(this.currentResults.length / this.resultsPerPage);
        const startIndex = (this.currentPage - 1) * this.resultsPerPage;
        const endIndex = startIndex + this.resultsPerPage;
        const pageResults = this.currentResults.slice(startIndex, endIndex);
        
        // Update results count
        this.resultsCount.textContent = `${this.currentResults.length} results`;
        
        // Render results
        this.resultsContainer.innerHTML = pageResults.map(transaction => `
            <div class="search-result-item">
                <div class="search-result-date">${new Date(transaction.date).toLocaleDateString()}</div>
                <div>
                    <div class="search-result-description">${this.escapeHtml(transaction.description)}</div>
                    <div class="search-result-category">${this.getCategoryDisplay(transaction.category)}</div>
                </div>
                <div class="search-result-amount ${transaction.amount >= 0 ? 'positive' : 'negative'}">
                    ${formatCurrency(transaction.amount)}
                </div>
            </div>
        `).join('');
        
        // Render pagination
        this.renderPagination(totalPages);
        
        // Show results section
        this.resultsSection.style.display = 'block';
    }

    renderPagination(totalPages) {
        if (totalPages <= 1) {
            this.paginationContainer.innerHTML = '';
            return;
        }
        
        this.paginationContainer.innerHTML = `
            <button class="pagination-btn" ${this.currentPage === 1 ? 'disabled' : ''} data-page="${this.currentPage - 1}">Previous</button>
            <span class="pagination-info">Page ${this.currentPage} of ${totalPages}</span>
            <button class="pagination-btn" ${this.currentPage === totalPages ? 'disabled' : ''} data-page="${this.currentPage + 1}">Next</button>
        `;
        
        // Add pagination event listeners
        this.paginationContainer.querySelectorAll('.pagination-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = parseInt(e.target.dataset.page);
                if (page && page !== this.currentPage) {
                    this.currentPage = page;
                    this.displayResults();
                }
            });
        });
    }

    hideResults() {
        this.resultsSection.style.display = 'none';
    }

    getCategoryDisplay(categoryKey) {
        const category = categories[categoryKey];
        return category ? `${category.icon} ${category.name}` : categoryKey || 'Uncategorized';
    }

    async saveCurrentSearch() {
        const searchName = prompt('Enter a name for this search:');
        if (!searchName) return;
        
        try {
            const searchCriteria = {
                text: this.searchText?.value || '',
                fuzzy: this.fuzzyCheckbox?.checked || false,
                filters: this.buildFilters(),
                query: this.queryTextarea?.value || ''
            };
            
            const savedSearch = await transactionManager.saveSearch(searchName, searchCriteria);
            this.savedSearches.push(savedSearch);
            this.renderSavedSearches();
            showSuccess('Search saved successfully');
        } catch (error) {
            console.error('Error saving search:', error);
            showError('Failed to save search');
        }
    }

    async loadSavedSearches() {
        try {
            this.savedSearches = await transactionManager.getSavedSearches();
            this.renderSavedSearches();
        } catch (error) {
            console.error('Error loading saved searches:', error);
        }
    }

    renderSavedSearches() {
        if (!this.savedSearchesList) return;
        
        if (this.savedSearches.length === 0) {
            this.savedSearchesList.innerHTML = '<div class="empty-state"><p>No saved searches yet</p></div>';
            return;
        }
        
        this.savedSearchesList.innerHTML = this.savedSearches.map(search => `
            <div class="saved-search-item" data-search-id="${search.id}">
                <div class="saved-search-name">${this.escapeHtml(search.name)}</div>
                <div class="saved-search-summary">${this.getSearchSummary(search.criteria)}</div>
                <div class="saved-search-actions">
                    <button class="btn btn--ghost btn--sm load-search" data-search-id="${search.id}">Load</button>
                    <button class="btn btn--ghost btn--sm delete-search" data-search-id="${search.id}">Delete</button>
                </div>
            </div>
        `).join('');
        
        // Add event listeners
        this.savedSearchesList.querySelectorAll('.load-search').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const searchId = e.target.dataset.searchId;
                this.loadSavedSearch(searchId);
            });
        });
        
        this.savedSearchesList.querySelectorAll('.delete-search').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const searchId = e.target.dataset.searchId;
                this.deleteSavedSearch(searchId);
            });
        });
    }

    getSearchSummary(criteria) {
        const parts = [];
        if (criteria.text) parts.push(`Text: "${criteria.text}"`);
        if (criteria.query) parts.push('Custom query');
        if (criteria.filters?.dateFrom || criteria.filters?.dateTo) parts.push('Date range');
        if (criteria.filters?.category) parts.push('Category filter');
        if (criteria.filters?.amountMin || criteria.filters?.amountMax) parts.push('Amount range');
        return parts.join(', ') || 'No criteria';
    }

    async loadSavedSearch(searchId) {
        const search = this.savedSearches.find(s => s.id === searchId);
        if (!search) return;
        
        // Populate form with saved criteria
        if (this.searchText) this.searchText.value = search.criteria.text || '';
        if (this.fuzzyCheckbox) this.fuzzyCheckbox.checked = search.criteria.fuzzy || false;
        if (this.queryTextarea) this.queryTextarea.value = search.criteria.query || '';
        
        const filters = search.criteria.filters || {};
        if (this.dateFrom) this.dateFrom.value = filters.dateFrom || '';
        if (this.dateTo) this.dateTo.value = filters.dateTo || '';
        if (this.amountMin) this.amountMin.value = filters.amountMin || '';
        if (this.amountMax) this.amountMax.value = filters.amountMax || '';
        if (this.categorySelect) this.categorySelect.value = filters.category || '';
        if (this.accountSelect) this.accountSelect.value = filters.accountId || '';
        
        // Execute the search
        this.executeSearch();
    }

    async deleteSavedSearch(searchId) {
        if (!confirm('Delete this saved search?')) return;
        
        try {
            await transactionManager.deleteSavedSearch(searchId);
            this.savedSearches = this.savedSearches.filter(s => s.id !== searchId);
            this.renderSavedSearches();
            showSuccess('Search deleted');
        } catch (error) {
            console.error('Error deleting search:', error);
            showError('Failed to delete search');
        }
    }

    exportResults() {
        if (!this.currentResults.length) {
            showError('No results to export');
            return;
        }
        
        // Convert results to CSV
        const headers = ['Date', 'Description', 'Category', 'Amount', 'Account', 'Notes'];
        const rows = this.currentResults.map(t => [
            new Date(t.date).toLocaleDateString(),
            t.description,
            this.getCategoryDisplay(t.category),
            t.amount.toFixed(2),
            t.account_name || '',
            t.notes || ''
        ]);
        
        const csv = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
        
        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `search-results-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        
        showSuccess('Results exported');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize and export
const advancedSearch = new AdvancedSearch();
export default advancedSearch;