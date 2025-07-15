/**
 * Unit tests for Time Budgets module
 */

const { timeBudgets } = await import('../../js/modules/timeBudgets.js');

describe('TimeBudgets Module', () => {
    // Save original localStorage
    const originalLocalStorage = global.localStorage;
    
    beforeEach(() => {
        // Mock localStorage
        const localStorageMock = {
            storage: {},
            getItem: function(key) {
                return this.storage[key] || null;
            },
            setItem: function(key, value) {
                this.storage[key] = value.toString();
            },
            removeItem: function(key) {
                delete this.storage[key];
            },
            clear: function() {
                this.storage = {};
            }
        };
        
        global.localStorage = localStorageMock;
        
        // Clear any existing settings
        localStorage.clear();
    });
    
    afterEach(() => {
        // Restore original localStorage
        global.localStorage = originalLocalStorage;
    });

    describe('Configuration Management', () => {
        it('should start with time budgets disabled', () => {
            expect(timeBudgets.isEnabled()).toBe(false);
        });

        it('should save and retrieve configuration', () => {
            const config = {
                enabled: true,
                hourlyWage: 50,
                taxRate: 25
            };
            
            timeBudgets.setConfig(config);
            
            expect(timeBudgets.isEnabled()).toBe(true);
            expect(timeBudgets.getConfig().hourlyWage).toBe(50);
            expect(timeBudgets.getConfig().taxRate).toBe(25);
            expect(timeBudgets.getConfig().afterTaxRate).toBe(37.5);
        });

        it('should calculate after-tax rate correctly', () => {
            timeBudgets.setConfig({
                enabled: true,
                hourlyWage: 100,
                taxRate: 30
            });
            
            expect(timeBudgets.getConfig().afterTaxRate).toBe(70);
        });

        it('should persist configuration to localStorage', () => {
            const config = {
                enabled: true,
                hourlyWage: 60,
                taxRate: 20
            };
            
            timeBudgets.setConfig(config);
            
            const saved = JSON.parse(localStorage.getItem('timeBudgetSettings'));
            expect(saved.enabled).toBe(true);
            expect(saved.hourlyWage).toBe(60);
            expect(saved.taxRate).toBe(20);
        });

        it('should load configuration from localStorage on init', () => {
            // Set config in localStorage
            localStorage.setItem('timeBudgetSettings', JSON.stringify({
                enabled: true,
                hourlyWage: 80,
                taxRate: 15,
                afterTaxRate: 68
            }));
            
            // Re-initialize by calling loadConfig
            timeBudgets.loadConfig();
            
            expect(timeBudgets.isEnabled()).toBe(true);
            expect(timeBudgets.getConfig().hourlyWage).toBe(80);
        });
    });

    describe('Time Conversion', () => {
        beforeEach(() => {
            // Set up a standard configuration
            timeBudgets.setConfig({
                enabled: true,
                hourlyWage: 50,
                taxRate: 25
            });
        });

        it('should convert dollar amounts to time correctly', () => {
            // After-tax rate is $37.50/hour
            const result = timeBudgets.convertToTime(75);
            
            expect(result.hours).toBe(2);
            expect(result.minutes).toBe(0);
            expect(result.totalMinutes).toBe(120);
            expect(result.formatted).toBe('2h');
        });

        it('should handle fractional hours', () => {
            const result = timeBudgets.convertToTime(56.25); // 1.5 hours
            
            expect(result.hours).toBe(1);
            expect(result.minutes).toBe(30);
            expect(result.totalMinutes).toBe(90);
            expect(result.formatted).toBe('1h 30m');
        });

        it('should handle amounts less than an hour', () => {
            const result = timeBudgets.convertToTime(18.75); // 30 minutes
            
            expect(result.hours).toBe(0);
            expect(result.minutes).toBe(30);
            expect(result.totalMinutes).toBe(30);
            expect(result.formatted).toBe('30m');
        });

        it('should round minutes appropriately', () => {
            const result = timeBudgets.convertToTime(20); // ~32 minutes
            
            expect(result.minutes).toBe(32);
            expect(result.formatted).toBe('32m');
        });

        it('should return null when disabled', () => {
            timeBudgets.setConfig({ enabled: false });
            
            expect(timeBudgets.convertToTime(100)).toBeNull();
        });

        it('should return null for zero wage', () => {
            timeBudgets.setConfig({
                enabled: true,
                hourlyWage: 0,
                taxRate: 25
            });
            
            expect(timeBudgets.convertToTime(100)).toBeNull();
        });

        it('should handle very small amounts', () => {
            const result = timeBudgets.convertToTime(1); // ~1.6 minutes
            
            expect(result.minutes).toBe(2);
            expect(result.formatted).toBe('2m');
        });

        it('should handle very large amounts', () => {
            const result = timeBudgets.convertToTime(3750); // 100 hours
            
            expect(result.hours).toBe(100);
            expect(result.minutes).toBe(0);
            expect(result.totalMinutes).toBe(6000);
            expect(result.formatted).toBe('100h');
        });
    });

    describe('Edge Cases', () => {
        it('should handle 100% tax rate', () => {
            timeBudgets.setConfig({
                enabled: true,
                hourlyWage: 50,
                taxRate: 100
            });
            
            expect(timeBudgets.getConfig().afterTaxRate).toBe(0);
            expect(timeBudgets.convertToTime(100)).toBeNull();
        });

        it('should handle negative amounts', () => {
            timeBudgets.setConfig({
                enabled: true,
                hourlyWage: 50,
                taxRate: 25
            });
            
            const result = timeBudgets.convertToTime(-75);
            expect(result.hours).toBe(2);
            expect(result.minutes).toBe(0);
        });

        it('should handle invalid configuration gracefully', () => {
            timeBudgets.setConfig({
                enabled: true,
                hourlyWage: 'invalid',
                taxRate: 'invalid'
            });
            
            expect(timeBudgets.getConfig().hourlyWage).toBe(0);
            expect(timeBudgets.getConfig().taxRate).toBe(0);
        });

        it('should handle missing configuration properties', () => {
            timeBudgets.setConfig({
                enabled: true
            });
            
            expect(timeBudgets.getConfig().hourlyWage).toBe(0);
            expect(timeBudgets.getConfig().taxRate).toBe(0);
            expect(timeBudgets.getConfig().afterTaxRate).toBe(0);
        });
    });

    describe('Format Display', () => {
        beforeEach(() => {
            timeBudgets.setConfig({
                enabled: true,
                hourlyWage: 50,
                taxRate: 25
            });
        });

        it('should format exact hours without minutes', () => {
            const result = timeBudgets.convertToTime(150); // Exactly 4 hours
            expect(result.formatted).toBe('4h');
        });

        it('should format exact minutes without hours', () => {
            const result = timeBudgets.convertToTime(12.5); // 20 minutes
            expect(result.formatted).toBe('20m');
        });

        it('should format mixed hours and minutes', () => {
            const result = timeBudgets.convertToTime(100); // 2 hours 40 minutes
            expect(result.formatted).toBe('2h 40m');
        });

        it('should handle single minute correctly', () => {
            const result = timeBudgets.convertToTime(0.625); // 1 minute
            expect(result.formatted).toBe('1m');
        });
    });
});

describe('TimeBudgets Integration', () => {
    it('should handle real-world transaction amounts', () => {
        timeBudgets.setConfig({
            enabled: true,
            hourlyWage: 25,
            taxRate: 22
        });
        
        // After-tax: $19.50/hour
        const testCases = [
            { amount: 19.50, expected: '1h' },
            { amount: 39.00, expected: '2h' },
            { amount: 9.75, expected: '30m' },
            { amount: 4.88, expected: '15m' },
            { amount: 100.00, expected: '5h 8m' }
        ];
        
        testCases.forEach(({ amount, expected }) => {
            const result = timeBudgets.convertToTime(amount);
            expect(result.formatted).toBe(expected);
        });
    });

    it('should handle different wage scenarios', () => {
        const scenarios = [
            { hourly: 15, tax: 15, amount: 50, expectedHours: 3, expectedMinutes: 55 },
            { hourly: 50, tax: 30, amount: 100, expectedHours: 2, expectedMinutes: 51 },
            { hourly: 100, tax: 40, amount: 300, expectedHours: 5, expectedMinutes: 0 }
        ];
        
        scenarios.forEach(({ hourly, tax, amount, expectedHours, expectedMinutes }) => {
            timeBudgets.setConfig({
                enabled: true,
                hourlyWage: hourly,
                taxRate: tax
            });
            
            const result = timeBudgets.convertToTime(amount);
            expect(result.hours).toBe(expectedHours);
            expect(result.minutes).toBe(expectedMinutes);
        });
    });
});