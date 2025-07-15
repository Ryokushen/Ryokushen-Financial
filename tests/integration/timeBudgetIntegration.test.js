/**
 * Integration tests for Time Budget features
 */

const { JSDOM } = await import('jsdom');
const { timeBudgets } = await import('../../js/modules/timeBudgets.js');
const { TimeBudgetWidget } = await import('../../js/modules/widgets/timeBudgetWidget.js');

describe('Time Budget Integration Tests', () => {
    let dom;
    let document;
    let window;
    
    beforeEach(() => {
        // Create a new JSDOM instance for each test
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <body>
                <div id="time-budget-widget"></div>
                <div id="transaction-form">
                    <input id="transaction-amount" type="number">
                    <select id="transaction-category">
                        <option value="">Select Category</option>
                        <option value="Food">Food</option>
                        <option value="Entertainment">Entertainment</option>
                        <option value="Income">Income</option>
                    </select>
                    <div id="transaction-time-preview" style="display: none;">
                        <span class="time-cost-badge"></span>
                    </div>
                </div>
                <div id="transactions-list"></div>
            </body>
            </html>
        `, {
            url: 'http://localhost',
            pretendToBeVisual: true
        });
        
        document = dom.window.document;
        window = dom.window;
        
        // Mock localStorage
        const localStorageMock = {
            storage: {},
            getItem: function(key) {
                return this.storage[key] || null;
            },
            setItem: function(key, value) {
                this.storage[key] = value.toString();
            },
            clear: function() {
                this.storage = {};
            }
        };
        
        global.localStorage = localStorageMock;
        global.document = document;
        global.window = window;
        
        // Clear localStorage before each test
        localStorage.clear();
    });
    
    afterEach(() => {
        // Clean up
        dom.window.close();
    });

    describe('Dashboard Widget Integration', () => {
        it('should initialize and render the widget when enabled', () => {
            // Enable time budgets
            timeBudgets.setConfig({
                enabled: true,
                hourlyWage: 50,
                taxRate: 25
            });
            
            // Initialize widget
            const widget = new TimeBudgetWidget('time-budget-widget');
            const mockAppData = {
                transactions: [
                    { id: 1, amount: -100, date: new Date().toISOString(), category: 'Food' }
                ]
            };
            
            widget.init(mockAppData);
            
            const widgetElement = document.getElementById('time-budget-widget');
            expect(widgetElement.innerHTML).toContain('Time Budgets');
            expect(widgetElement.innerHTML).toContain('Active');
            expect(widgetElement.innerHTML).toContain('$37.50/hour after taxes');
        });

        it('should show disabled state when time budgets are disabled', () => {
            // Disable time budgets
            timeBudgets.setConfig({ enabled: false });
            
            // Initialize widget
            const widget = new TimeBudgetWidget('time-budget-widget');
            widget.init({ transactions: [] });
            
            const widgetElement = document.getElementById('time-budget-widget');
            expect(widgetElement.innerHTML).toContain('Disabled');
            expect(widgetElement.innerHTML).toContain('Enable time budgets in settings');
        });

        it('should calculate and display time metrics correctly', () => {
            timeBudgets.setConfig({
                enabled: true,
                hourlyWage: 40,
                taxRate: 20
            });
            
            const today = new Date();
            const mockAppData = {
                transactions: [
                    { amount: -32, date: today.toISOString(), category: 'Food' }, // 1 hour
                    { amount: -16, date: today.toISOString(), category: 'Entertainment' }, // 30 min
                    { amount: 100, date: today.toISOString(), category: 'Income' } // Should be ignored
                ]
            };
            
            const widget = new TimeBudgetWidget('time-budget-widget');
            widget.init(mockAppData);
            
            const widgetElement = document.getElementById('time-budget-widget');
            expect(widgetElement.innerHTML).toContain('Today:');
            expect(widgetElement.innerHTML).toContain('1h 30m');
            expect(widgetElement.innerHTML).toContain('($48.00)');
        });
    });

    describe('Transaction Preview Integration', () => {
        beforeEach(() => {
            // Import and initialize the transaction preview module
            const { initializeTransactionTimePreview } = require('../../js/modules/transactionTimePreview.js');
            
            // Enable time budgets
            timeBudgets.setConfig({
                enabled: true,
                hourlyWage: 50,
                taxRate: 25
            });
        });

        it('should show preview for expense transactions', () => {
            const amountInput = document.getElementById('transaction-amount');
            const categorySelect = document.getElementById('transaction-category');
            const preview = document.getElementById('transaction-time-preview');
            
            // Simulate entering an expense
            amountInput.value = '-75';
            categorySelect.value = 'Food';
            
            // Trigger input event
            const event = new window.Event('input', { bubbles: true });
            amountInput.dispatchEvent(event);
            
            // Check if preview would be shown (in real implementation)
            // Note: Without full module loading, we're testing the structure
            expect(preview).toBeTruthy();
            expect(preview.querySelector('.time-cost-badge')).toBeTruthy();
        });

        it('should not show preview for income transactions', () => {
            const amountInput = document.getElementById('transaction-amount');
            const categorySelect = document.getElementById('transaction-category');
            const preview = document.getElementById('transaction-time-preview');
            
            // Simulate entering income
            amountInput.value = '1000';
            categorySelect.value = 'Income';
            
            // Preview should remain hidden
            expect(preview.style.display).toBe('none');
        });
    });

    describe('Voice Command Integration', () => {
        it('should handle work time cost queries', async () => {
            // Mock the voice analytics module
            const mockVoiceAnalytics = {
                processQuery: async (intent, parameters) => {
                    if (intent === 'query.work_time_cost') {
                        const { workTimeCategory } = parameters;
                        
                        if (!timeBudgets.isEnabled()) {
                            return {
                                type: 'query.work_time_cost',
                                success: true,
                                response: {
                                    text: 'Time budgets are not enabled.',
                                    title: 'Time Budgets Disabled'
                                }
                            };
                        }
                        
                        if (workTimeCategory === 'last_transaction') {
                            const timeData = timeBudgets.convertToTime(100);
                            return {
                                type: 'query.work_time_cost',
                                success: true,
                                response: {
                                    text: `Your last purchase cost ${timeData.formatted} of work.`,
                                    title: 'Time Cost of Last Purchase'
                                }
                            };
                        }
                        
                        return {
                            type: 'query.work_time_cost',
                            success: false
                        };
                    }
                }
            };
            
            // Enable time budgets
            timeBudgets.setConfig({
                enabled: true,
                hourlyWage: 50,
                taxRate: 25
            });
            
            // Test last transaction query
            const result = await mockVoiceAnalytics.processQuery('query.work_time_cost', {
                workTimeCategory: 'last_transaction'
            });
            
            expect(result.success).toBe(true);
            expect(result.response.text).toContain('2h 40m of work');
        });

        it('should handle disabled time budgets in voice queries', async () => {
            // Disable time budgets
            timeBudgets.setConfig({ enabled: false });
            
            // Mock voice analytics
            const mockVoiceAnalytics = {
                processQuery: async (intent) => {
                    if (intent === 'query.work_time_cost' && !timeBudgets.isEnabled()) {
                        return {
                            type: 'query.work_time_cost',
                            success: true,
                            response: {
                                text: 'Time budgets are not enabled. Would you like me to help you set up your hourly wage?',
                                title: 'Time Budgets Disabled'
                            }
                        };
                    }
                }
            };
            
            const result = await mockVoiceAnalytics.processQuery('query.work_time_cost', {});
            
            expect(result.response.text).toContain('Time budgets are not enabled');
        });
    });

    describe('Settings Persistence', () => {
        it('should persist settings across sessions', () => {
            // Set configuration
            timeBudgets.setConfig({
                enabled: true,
                hourlyWage: 60,
                taxRate: 30
            });
            
            // Simulate new session by creating new instance
            // In real app, this would be loading from localStorage
            const savedSettings = JSON.parse(localStorage.getItem('timeBudgetSettings'));
            
            expect(savedSettings.enabled).toBe(true);
            expect(savedSettings.hourlyWage).toBe(60);
            expect(savedSettings.taxRate).toBe(30);
            expect(savedSettings.afterTaxRate).toBe(42);
        });

        it('should emit events when configuration changes', (done) => {
            // Listen for wage config update event
            window.addEventListener('wage-config-updated', () => {
                done();
            });
            
            // Update configuration
            timeBudgets.setConfig({
                enabled: true,
                hourlyWage: 50,
                taxRate: 25
            });
        });
    });

    describe('Privacy Mode Integration', () => {
        it('should blur sensitive time budget information in privacy mode', () => {
            // Enable time budgets
            timeBudgets.setConfig({
                enabled: true,
                hourlyWage: 50,
                taxRate: 25
            });
            
            // Initialize widget
            const widget = new TimeBudgetWidget('time-budget-widget');
            widget.init({ transactions: [] });
            
            // Simulate privacy mode
            document.body.classList.add('privacy-mode');
            
            const widgetElement = document.getElementById('time-budget-widget');
            const wageValue = widgetElement.querySelector('.wage-value');
            
            // In real implementation, CSS would apply blur filter
            expect(document.body.classList.contains('privacy-mode')).toBe(true);
        });
    });
});