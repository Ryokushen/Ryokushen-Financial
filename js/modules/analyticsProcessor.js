// js/modules/analyticsProcessor.js - Web Worker Manager for Analytics

import { debug } from './debug.js';

/**
 * Analytics Processor - Manages Web Worker for heavy calculations
 */
class AnalyticsProcessor {
  constructor() {
    this.worker = null;
    this.pendingRequests = new Map();
    this.requestId = 0;
    this.workerReady = false;
    this.initWorker();
  }

  /**
   * Initialize the Web Worker
   */
  initWorker() {
    try {
      // Create worker
      this.worker = new Worker('/js/workers/analyticsWorker.js');

      // Set up message handler
      this.worker.addEventListener('message', event => {
        const { type, id, data, error } = event.data;

        if (type === 'result' || type === 'error') {
          const request = this.pendingRequests.get(id);
          if (request) {
            if (type === 'result') {
              request.resolve(data);
            } else {
              request.reject(new Error(error));
            }
            this.pendingRequests.delete(id);
          }
        }
      });

      // Set up error handler
      this.worker.addEventListener('error', error => {
        debug.error('Analytics worker error:', error);
        // Reject all pending requests
        for (const request of this.pendingRequests.values()) {
          request.reject(new Error('Worker crashed'));
        }
        this.pendingRequests.clear();

        // Attempt to restart worker
        setTimeout(() => this.initWorker(), 1000);
      });

      this.workerReady = true;
      debug.log('Analytics worker initialized');
    } catch (error) {
      debug.error('Failed to initialize analytics worker:', error);
      this.workerReady = false;
    }
  }

  /**
   * Send a request to the worker
   * @private
   */
  async sendRequest(type, data) {
    if (!this.workerReady) {
      // Fallback to main thread
      return this.fallbackCalculation(type, data);
    }

    const id = ++this.requestId;

    return new Promise((resolve, reject) => {
      // Store the promise handlers
      this.pendingRequests.set(id, { resolve, reject });

      // Set timeout
      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Worker timeout'));
        }
      }, 30000); // 30 second timeout

      // Send message to worker
      try {
        this.worker.postMessage({ type, data, id });
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(error);
      }
    });
  }

  /**
   * Analyze transactions using Web Worker
   */
  async analyzeTransactions(transactions, options = {}) {
    // Only use worker for large datasets
    if (transactions.length < 500) {
      return this.fallbackCalculation('analyzeTransactions', { transactions, options });
    }

    try {
      return await this.sendRequest('analyzeTransactions', { transactions, options });
    } catch (error) {
      debug.warn('Worker failed, using fallback:', error);
      return this.fallbackCalculation('analyzeTransactions', { transactions, options });
    }
  }

  /**
   * Calculate trends using Web Worker
   */
  async calculateTrends(transactions, groupBy = 'month', options = {}) {
    try {
      return await this.sendRequest('calculateTrends', { transactions, groupBy, options });
    } catch (error) {
      debug.warn('Worker failed, using fallback:', error);
      return this.fallbackCalculation('calculateTrends', { transactions, groupBy, options });
    }
  }

  /**
   * Calculate statistics using Web Worker
   */
  async calculateStatistics(values) {
    // For small arrays, calculate in main thread
    if (values.length < 1000) {
      return this.calculateStatisticsSync(values);
    }

    try {
      return await this.sendRequest('calculateStatistics', values);
    } catch (error) {
      return this.calculateStatisticsSync(values);
    }
  }

  /**
   * Predict future spending
   */
  async predictSpending(transactions, daysAhead = 30) {
    try {
      return await this.sendRequest('predictSpending', { transactions, daysAhead });
    } catch (error) {
      debug.warn('Worker failed, using fallback:', error);
      return this.fallbackCalculation('predictSpending', { transactions, daysAhead });
    }
  }

  /**
   * Analyze categories
   */
  async analyzeCategories(transactions, options = {}) {
    try {
      return await this.sendRequest('analyzeCategories', { transactions, options });
    } catch (error) {
      debug.warn('Worker failed, using fallback:', error);
      return this.fallbackCalculation('analyzeCategories', { transactions, options });
    }
  }

  /**
   * Calculate cash flow
   */
  async calculateCashFlow(transactions, interval = 'daily') {
    try {
      return await this.sendRequest('calculateCashFlow', { transactions, interval });
    } catch (error) {
      debug.warn('Worker failed, using fallback:', error);
      return this.fallbackCalculation('calculateCashFlow', { transactions, interval });
    }
  }

  /**
   * Fallback calculations for when worker is not available
   * @private
   */
  fallbackCalculation(type, data) {
    debug.log(`Running ${type} in main thread (fallback)`);

    switch (type) {
      case 'analyzeTransactions':
        return this.analyzeTransactionsSync(data.transactions, data.options);
      case 'calculateTrends':
        return this.calculateTrendsSync(data.transactions, data.groupBy, data.options);
      case 'predictSpending':
        return this.predictSpendingSync(data.transactions, data.daysAhead);
      case 'analyzeCategories':
        return this.analyzeCategoriesSync(data.transactions, data.options);
      case 'calculateCashFlow':
        return this.calculateCashFlowSync(data.transactions, data.interval);
      default:
        throw new Error(`Unknown calculation type: ${type}`);
    }
  }

  /**
   * Synchronous statistics calculation
   * @private
   */
  calculateStatisticsSync(values) {
    if (!values || values.length === 0) {
      return { mean: 0, stdDev: 0, min: 0, max: 0, median: 0, count: 0 };
    }

    const n = values.length;
    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((sum, val) => sum + val, 0) / n;

    const variance =
      values.reduce((sum, val) => {
        const diff = val - mean;
        return sum + diff * diff;
      }, 0) / n;

    const stdDev = Math.sqrt(variance);
    const median =
      n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];

    return {
      mean,
      stdDev,
      min: sorted[0],
      max: sorted[n - 1],
      median,
      count: n,
    };
  }

  /**
   * Synchronous transaction analysis (simplified)
   * @private
   */
  analyzeTransactionsSync(transactions, options = {}) {
    const categoryTotals = {};
    let totalIncome = 0;
    let totalExpenses = 0;

    for (const t of transactions) {
      const category = t.category || 'Uncategorized';
      if (!categoryTotals[category]) {
        categoryTotals[category] = { total: 0, count: 0 };
      }

      categoryTotals[category].total += Math.abs(t.amount);
      categoryTotals[category].count++;

      if (t.amount > 0) {
        totalIncome += t.amount;
      } else {
        totalExpenses += Math.abs(t.amount);
      }
    }

    return {
      summary: {
        totalTransactions: transactions.length,
        totalIncome,
        totalExpenses,
      },
      categoryStats: categoryTotals,
    };
  }

  /**
   * Synchronous trends calculation
   * @private
   */
  calculateTrendsSync(transactions, groupBy = 'month', options = {}) {
    const groups = {};

    for (const t of transactions) {
      const key = groupBy === 'month' ? t.date.substring(0, 7) : t.category || 'Uncategorized';

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(t);
    }

    const trends = Object.entries(groups).map(([label, txns]) => ({
      label,
      value: txns.reduce((sum, t) => sum + Math.abs(t.amount), 0),
      count: txns.length,
      average:
        txns.length > 0 ? txns.reduce((sum, t) => sum + Math.abs(t.amount), 0) / txns.length : 0,
    }));

    return trends.sort((a, b) => b.value - a.value);
  }

  /**
   * Simplified spending prediction
   * @private
   */
  predictSpendingSync(transactions, daysAhead = 30) {
    const expenses = transactions.filter(t => t.amount < 0);
    const totalExpenses = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const dayCount = 30; // Simplified - assume last 30 days
    const dailyAverage = totalExpenses / dayCount;

    return {
      projectionDays: daysAhead,
      totalProjectedSpending: dailyAverage * daysAhead,
      confidence: 50, // Simplified confidence
    };
  }

  /**
   * Simplified category analysis
   * @private
   */
  analyzeCategoriesSync(transactions, options = {}) {
    const categories = {};

    for (const t of transactions) {
      const category = t.category || 'Uncategorized';
      if (!categories[category]) {
        categories[category] = {
          total: 0,
          income: 0,
          expenses: 0,
          transactionCount: 0,
        };
      }

      const cat = categories[category];
      cat.total += t.amount;
      cat.transactionCount++;

      if (t.amount > 0) {
        cat.income += t.amount;
      } else {
        cat.expenses += Math.abs(t.amount);
      }
    }

    return categories;
  }

  /**
   * Simplified cash flow calculation
   * @private
   */
  calculateCashFlowSync(transactions, interval = 'daily') {
    const flows = {};

    for (const t of transactions) {
      const key = interval === 'daily' ? t.date : t.date.substring(0, 7);

      if (!flows[key]) {
        flows[key] = {
          date: key,
          inflow: 0,
          outflow: 0,
          net: 0,
        };
      }

      if (t.amount > 0) {
        flows[key].inflow += t.amount;
      } else {
        flows[key].outflow += Math.abs(t.amount);
      }

      flows[key].net = flows[key].inflow - flows[key].outflow;
    }

    return Object.values(flows).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Terminate the worker
   */
  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.workerReady = false;
    }

    // Reject any pending requests
    for (const request of this.pendingRequests.values()) {
      request.reject(new Error('Worker terminated'));
    }
    this.pendingRequests.clear();
  }
}

// Create singleton instance
export const analyticsProcessor = new AnalyticsProcessor();
