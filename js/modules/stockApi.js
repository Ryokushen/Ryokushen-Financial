// js/modules/stockApi.js - Finnhub Stock API Integration

import { debug } from './debug.js';
import { withTimeout, retryOperation } from './errorHandler.js';
import { AsyncLock } from './asyncLock.js';

/**
 * Stock API service for fetching real-time stock prices from Finnhub
 */
export class StockApiService {
    constructor(apiKey = null) {
        // Get API key from config if not provided
        this.apiKey = apiKey || (window.finnhubConfig ? window.finnhubConfig.apiKey : null);
        this.baseUrl = window.finnhubConfig ? window.finnhubConfig.baseUrl : 'https://finnhub.io/api/v1';
        this.cache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes cache
        this.rateLimitDelay = 100; // 100ms between requests to respect rate limits

        // Validate API key on initialization
        this.isConfigured = this.validateApiKey();
    }

    validateApiKey() {
        if (!this.apiKey || this.apiKey === 'YOUR_API_KEY_HERE' || this.apiKey.trim() === '') {
            debug.warn('Finnhub API key not configured. Stock price updates will be disabled.');
            return false;
        }
        return true;
    }

    /**
     * Fetch current stock price for a symbol
     * @param {string} symbol - Stock symbol (e.g., 'AAPL', 'MSFT')
     * @returns {Promise<{symbol: string, price: number, change: number} | null>}
     */
    async fetchStockPrice(symbol) {
        try {
            // First check if we're configured properly
            if (!this.isConfigured) {
                throw new Error('API key not configured');
            }

            // Check cache first
            const cached = this.getCachedPrice(symbol);
            if (cached) {
                debug.log(`Using cached price for ${symbol}`);
                return cached;
            }

            const url = `${this.baseUrl}/quote?symbol=${encodeURIComponent(symbol)}&token=${this.apiKey}`;

            debug.log(`Fetching price for ${symbol}...`);
            
            // Fetch with timeout and retry logic
            const response = await withTimeout(
                retryOperation(
                    () => fetch(url),
                    2, // max 2 retries for API calls
                    500 // 500ms base delay
                ),
                10000 // 10 second timeout
            );

            if (!response.ok) {
                if (response.status === 429) {
                    debug.warn(`Rate limit hit for ${symbol}, retrying...`);
                    await this.delay(1000);
                    return this.fetchStockPrice(symbol);
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            // Finnhub returns { c: currentPrice, d: change, dp: changePercent, h: high, l: low, o: open, pc: previousClose }
            if (!data.c || data.c === 0) {
                debug.warn(`No valid price data for symbol: ${symbol}`);
                return null;
            }

            const result = {
                symbol: symbol.toUpperCase(),
                price: parseFloat(data.c),
                change: parseFloat(data.d || 0),
                changePercent: parseFloat(data.dp || 0),
                previousClose: parseFloat(data.pc || 0),
                timestamp: Date.now()
            };

            // Cache the result
            this.cache.set(symbol.toUpperCase(), result);

            return result;

        } catch (error) {
            debug.error(`Error fetching price for ${symbol}:`, error);
            return null;
        }
    }

    /**
     * Fetch prices for multiple symbols with rate limiting
     * @param {string[]} symbols - Array of stock symbols
     * @returns {Promise<Map<string, {symbol: string, price: number, change: number}>>}
     */
    async fetchMultipleStockPrices(symbols) {
        const results = new Map();
        const uniqueSymbols = [...new Set(symbols.map(s => s.toUpperCase()))];

        debug.log(`Fetching prices for ${uniqueSymbols.length} symbols...`);

        for (let i = 0; i < uniqueSymbols.length; i++) {
            const symbol = uniqueSymbols[i];

            try {
                const priceData = await this.fetchStockPrice(symbol);
                if (priceData) {
                    results.set(symbol, priceData);
                    debug.log(`✓ ${symbol}: $${priceData.price}`);
                } else {
                    debug.log(`✗ ${symbol}: No data available`);
                }

                // Rate limiting: wait between requests (except for last one)
                if (i < uniqueSymbols.length - 1) {
                    await this.delay(this.rateLimitDelay);
                }

            } catch (error) {
                debug.error(`Failed to fetch ${symbol}:`, error);
            }
        }

        return results;
    }

    /**
     * Check if we have cached price data for a symbol
     */
    getCachedPrice(symbol) {
        const cached = this.cache.get(symbol.toUpperCase());
        if (!cached) return null;

        const isExpired = Date.now() - cached.timestamp > this.cacheExpiry;
        if (isExpired) {
            this.cache.delete(symbol.toUpperCase());
            return null;
        }

        return cached;
    }

    /**
     * Clear all cached prices
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Utility function for delays
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Validate if a symbol might be a valid stock symbol
     * @param {string} symbol 
     * @returns {boolean}
     */
    isValidSymbol(symbol) {
        if (!symbol || typeof symbol !== 'string') return false;

        // Basic validation: 1-5 characters, letters only, common patterns
        const trimmed = symbol.trim().toUpperCase();

        // Must be 1-5 characters, letters only
        if (!/^[A-Z]{1,5}$/.test(trimmed)) return false;

        // Skip obviously invalid symbols
        const invalidPatterns = ['N/A', 'NULL', 'CASH', 'USD', 'PENDING'];
        if (invalidPatterns.includes(trimmed)) return false;

        return true;
    }
}

/**
 * Holdings updater service that integrates with the existing app
 */
export class HoldingsUpdater {
    constructor(appState, stockApiService) {
        this.appState = appState;
        this.stockApi = stockApiService;
        this.updateLock = new AsyncLock();
    }

    /**
     * Update all holdings with current stock prices
     * @returns {Promise<{updated: number, failed: number, skipped: number}>}
     */
    async updateAllHoldings() {
        // Use async lock to prevent race conditions
        return this.updateLock.withLock(async () => {
            debug.log('Acquired update lock, starting holdings update...');
            
            try {

            // Collect all unique stock symbols from all holdings
            const allSymbols = this.collectStockSymbols();

            if (allSymbols.length === 0) {
                debug.log('No stock symbols found to update');
                return { updated: 0, failed: 0, skipped: 0 };
            }

            // Fetch current prices
            const priceData = await this.stockApi.fetchMultipleStockPrices(allSymbols);

            // Update holdings with new prices
            const updateResults = await this.updateHoldingsWithPrices(priceData);

            debug.log('Holdings update completed:', updateResults);
            return updateResults;

            } catch (error) {
                debug.error('Error updating holdings:', error);
                throw error;
            }
        });
    }

    /**
     * Collect all unique stock symbols from investment accounts
     * @returns {string[]}
     */
    collectStockSymbols() {
        const symbols = new Set();

        this.appState.appData.investmentAccounts.forEach(account => {
            if (account.holdings && Array.isArray(account.holdings)) {
                account.holdings.forEach(holding => {
                    if (holding.symbol && this.stockApi.isValidSymbol(holding.symbol)) {
                        symbols.add(holding.symbol.toUpperCase());
                    }
                });
            }
        });

        return Array.from(symbols);
    }

    /**
     * Update individual holdings with fetched price data
     * @param {Map} priceData - Map of symbol -> price data
     * @returns {Promise<{updated: number, failed: number, skipped: number}>}
     */
    async updateHoldingsWithPrices(priceData) {
        let updated = 0;
        let failed = 0;
        let skipped = 0;

        // Import the database module
        const { default: db } = await import('../database.js');

        // Use Promise.all to properly track all account update operations
        const accountUpdatePromises = [];

        for (const account of this.appState.appData.investmentAccounts) {
            if (!account.holdings || !Array.isArray(account.holdings)) continue;

            let accountBalanceChanged = false;
            const holdingUpdatePromises = [];

            for (const holding of account.holdings) {
                try {
                    if (!holding.symbol || !this.stockApi.isValidSymbol(holding.symbol)) {
                        skipped++;
                        continue;
                    }

                    const symbol = holding.symbol.toUpperCase();
                    const stockData = priceData.get(symbol);

                    if (!stockData) {
                        debug.log(`No price data available for ${symbol}`);
                        skipped++;
                        continue;
                    }

                    // Update the holding
                    const oldPrice = holding.currentPrice;
                    const oldValue = holding.value;

                    holding.currentPrice = stockData.price;
                    holding.value = holding.shares * stockData.price;

                    // Queue the database update using batch operations
                    const { batchUpdateHolding } = await import('./batchOperations.js');
                    holdingUpdatePromises.push(
                        batchUpdateHolding(holding.id, {
                            current_price: holding.currentPrice,
                            value: holding.value
                        }).then(() => {
                            debug.log(`Updated ${symbol}: $${oldPrice} → $${holding.currentPrice}`);
                            updated++;
                            accountBalanceChanged = true;
                        }).catch(error => {
                            debug.error(`Failed to update holding ${holding.symbol}:`, error);
                            failed++;
                        })
                    );
                } catch (error) {
                    debug.error(`Failed to update holding ${holding.symbol}:`, error);
                    failed++;
                }
            }

            // Wait for all holding updates to complete before updating account balance
            await Promise.all(holdingUpdatePromises);
            
            // Flush any remaining batch operations
            const { flushBatch } = await import('./batchOperations.js');
            await flushBatch();

            // Update account balance if any holdings changed
            if (accountBalanceChanged) {
                try {
                    const newBalance = account.holdings.reduce((sum, h) => sum + (h.value || 0), 0);
                    const oldBalance = account.balance;

                    account.balance = newBalance;
                    account.dayChange = newBalance - oldBalance;

                    accountUpdatePromises.push(
                        db.updateInvestmentAccount(account.id, {
                            balance: account.balance,
                            day_change: account.dayChange
                        }).then(() => {
                            debug.log(`Updated account ${account.name} balance: $${oldBalance} → $${newBalance}`);
                        }).catch(error => {
                            debug.error(`Failed to update account balance for ${account.name}:`, error);
                        })
                    );
                } catch (error) {
                    debug.error(`Failed to update account balance for ${account.name}:`, error);
                }
            }
        }

        // Wait for all account updates to complete
        await Promise.all(accountUpdatePromises);

        return { updated, failed, skipped };
    }

    /**
     * Update a specific holding by symbol
     * @param {string} symbol 
     * @returns {Promise<boolean>}
     */
    async updateHoldingBySymbol(symbol) {
        if (!this.stockApi.isValidSymbol(symbol)) {
            debug.log(`Invalid symbol: ${symbol}`);
            return false;
        }

        try {
            const priceData = await this.stockApi.fetchStockPrice(symbol);
            if (!priceData) return false;

            const priceMap = new Map();
            priceMap.set(symbol.toUpperCase(), priceData);

            const results = await this.updateHoldingsWithPrices(priceMap);
            return results.updated > 0;

        } catch (error) {
            debug.error(`Error updating ${symbol}:`, error);
            return false;
        }
    }
}

// Initialize the services
export const stockApiService = new StockApiService();
export const holdingsUpdater = new HoldingsUpdater(null, stockApiService); // Will be initialized with appState later

/**
 * Utility function to format the last update time
 */
export function formatLastUpdateTime(timestamp) {
    if (!timestamp) return 'Never';

    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));

    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 minute ago';
    if (minutes < 60) return `${minutes} minutes ago`;

    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return `${hours} hours ago`;

    return new Date(timestamp).toLocaleDateString();
}