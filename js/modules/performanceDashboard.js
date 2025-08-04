// js/modules/performanceDashboard.js - Performance Analytics Dashboard

import { transactionManager } from './transactionManager.js';
import { formatCurrency, escapeHtml, formatDate } from './utils.js';
import { debug } from './debug.js';
import { eventManager } from './eventManager.js';
import { isPrivacyMode } from './privacy.js';
import { showError, showSuccess } from './ui.js';
import { simpleCharts } from './simpleCharts.js';
import { addMoney, sumMoney } from './financialMath.js';
import { modalManager } from './modalManager.js';

class PerformanceDashboard {
  constructor() {
    this.chartInstance = null;
    this.currentView = 'trends';
    this.currentDashboardView = 'metrics'; // Track metrics vs charts view
    this.dateRange = 30; // Default to last 30 days
    this.customStartDate = null;
    this.customEndDate = null;
    this.isCustomRange = false;
    this.data = {
      trends: null,
      categories: null,
      merchants: null,
      anomalies: null,
      predictions: null,
      insights: null,
      budgetPerformance: null,
      dataQuality: null,
      systemMetrics: null,
    };
    this.isLoading = false;
    this.refreshInterval = null;
    this.chartsInitialized = false;
  }

  /**
   * Initialize the performance dashboard
   */
  async init() {
    try {
      // Performance Dashboard initialization
      debug.log('Initializing Performance Dashboard');
      debug.log('Chart.js available at init:', !!window.Chart);
      // Chart.js is available

      // Check if already initialized
      if (this.refreshInterval) {
        debug.log('Performance Dashboard already initialized, skipping');
        return;
      }

      // Wait for DOM to be ready
      await new Promise(resolve => {
        if (document.readyState === 'complete') {
          resolve();
        } else {
          window.addEventListener('load', resolve, { once: true });
        }
      });

      // Additional delay to ensure tab content is rendered
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check Chart.js availability after load
      debug.log('Chart.js available after load:', !!window.Chart);

      // Check if performance tab is in the DOM
      const perfTab = document.getElementById('performance');
      const chartContainer = document.getElementById('main-chart-container');
      const canvas = document.getElementById('performanceChart');

      // DOM elements verified

      if (!perfTab) {
        console.error('Performance tab not found in DOM!');
        return;
      }

      // Verify required DOM elements exist
      const requiredElements = [
        'metrics-view',
        'charts-view',
        'performanceChart',
        'main-chart-container',
      ];

      const missingElements = requiredElements.filter(id => !document.getElementById(id));
      if (missingElements.length > 0) {
        throw new Error(`Missing required DOM elements: ${missingElements.join(', ')}`);
      }

      // Set up event listeners
      this.setupEventListeners();

      // Load initial data
      await this.loadDashboardData();

      // Set up auto-refresh (every 5 minutes)
      this.refreshInterval = setInterval(
        () => {
          this.refreshDashboard();
        },
        5 * 60 * 1000
      );

      debug.log('Performance Dashboard initialization complete');
    } catch (error) {
      debug.error('Failed to initialize Performance Dashboard:', error);
      throw error; // Re-throw to be caught by caller
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }

    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Setting up event listeners

    // View toggle buttons (Metrics/Charts)
    const viewToggleBtns = document.querySelectorAll('.view-toggle-btn');
    // View toggle buttons found
    if (viewToggleBtns.length > 0) {
      viewToggleBtns.forEach(btn => {
        // Adding click listener
        btn.addEventListener('click', e => {
          // View toggle button clicked
          const view = e.target.dataset.view;
          this.switchDashboardView(view);
        });
      });
    } else {
      console.warn('No view toggle buttons found!');
    }

    // Date range selector
    const dateRangeBtns = document.querySelectorAll('.date-range-btn');
    if (dateRangeBtns.length > 0) {
      dateRangeBtns.forEach(btn => {
        btn.addEventListener('click', e => {
          const range = e.target.dataset.range;
          this.handleDateRangeChange(range);
        });
      });
    }

    // Refresh button
    const refreshBtn = document.getElementById('refresh-dashboard');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshDashboard());
    }

    // Chart tabs
    const chartTabs = document.querySelectorAll('.chart-tab');
    if (chartTabs.length > 0) {
      chartTabs.forEach(tab => {
        tab.addEventListener('click', e => {
          const chartType = e.target.dataset.chart;
          this.switchChart(chartType);
        });
      });
    }

    // Test button
    const testBtn = document.getElementById('test-chart');
    if (testBtn) {
      testBtn.addEventListener('click', () => {
        debug.log('Test button clicked - rendering test chart');
        simpleCharts.renderTestChart();
      });
    }

    // Export button
    const exportBtn = document.getElementById('export-chart');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportChart());
    }

    // Setup date range modal
    this.setupDateRangeModal();
  }

  /**
   * Setup date range modal and its event handlers
   */
  setupDateRangeModal() {
    // Register modal with modalManager
    modalManager.register('date-range-modal', {
      onOpen: () => {
        // Pre-populate dates based on current range
        const endDate = new Date();
        const startDate = new Date();

        if (this.isCustomRange && this.customStartDate && this.customEndDate) {
          // Use existing custom dates
          document.getElementById('date-range-start').value = this.customStartDate;
          document.getElementById('date-range-end').value = this.customEndDate;
        } else {
          // Calculate based on current dateRange
          startDate.setDate(startDate.getDate() - this.dateRange);
          document.getElementById('date-range-start').value = startDate.toISOString().split('T')[0];
          document.getElementById('date-range-end').value = endDate.toISOString().split('T')[0];
        }

        this.updateDateRangeHint();
      },
    });

    // Handle form submission
    const dateRangeForm = document.getElementById('date-range-form');
    if (dateRangeForm) {
      dateRangeForm.addEventListener('submit', async e => {
        e.preventDefault();
        await this.applyCustomDateRange();
      });
    }

    // Handle cancel button
    const cancelBtn = document.getElementById('cancel-date-range-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        modalManager.close('date-range-modal');
      });
    }

    // Handle date changes to update hint
    const startInput = document.getElementById('date-range-start');
    const endInput = document.getElementById('date-range-end');
    if (startInput && endInput) {
      startInput.addEventListener('change', () => this.updateDateRangeHint());
      endInput.addEventListener('change', () => this.updateDateRangeHint());
    }
  }

  /**
   * Update the hint text showing the date range duration
   */
  updateDateRangeHint() {
    const startInput = document.getElementById('date-range-start');
    const endInput = document.getElementById('date-range-end');
    const hintElement = document.getElementById('date-range-hint');

    if (!startInput.value || !endInput.value || !hintElement) {
      return;
    }

    const startDate = new Date(startInput.value);
    const endDate = new Date(endInput.value);
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (endDate < startDate) {
      hintElement.textContent = 'End date must be after start date';
      hintElement.style.color = '#ef4444';
    } else if (diffDays > 730) {
      // More than 2 years
      hintElement.textContent = 'Date range cannot exceed 2 years';
      hintElement.style.color = '#ef4444';
    } else {
      hintElement.textContent = `${diffDays} day${diffDays !== 1 ? 's' : ''} selected`;
      hintElement.style.color = '#94a3b8';
    }
  }

  /**
   * Apply the custom date range
   */
  async applyCustomDateRange() {
    const startInput = document.getElementById('date-range-start');
    const endInput = document.getElementById('date-range-end');

    if (!startInput.value || !endInput.value) {
      showError('Please select both start and end dates');
      return;
    }

    const startDate = new Date(startInput.value);
    const endDate = new Date(endInput.value);

    // Validate dates
    if (endDate < startDate) {
      showError('End date must be after start date');
      return;
    }

    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 730) {
      // More than 2 years
      showError('Date range cannot exceed 2 years');
      return;
    }

    // Store custom dates
    this.customStartDate = startInput.value;
    this.customEndDate = endInput.value;
    this.dateRange = diffDays;
    this.isCustomRange = true;

    // Update button text to show custom range
    document.querySelectorAll('.date-range-btn').forEach(btn => {
      if (btn.dataset.range === 'custom') {
        btn.classList.add('active');
        const rangeText = `${formatDate(startDate)} - ${formatDate(endDate)}`;
        btn.textContent = rangeText.length > 20 ? `Custom (${diffDays}d)` : rangeText;
      } else {
        btn.classList.remove('active');
      }
    });

    // Close modal and reload data
    modalManager.close('date-range-modal');
    await this.loadDashboardData();
  }

  /**
   * Get the current date range based on settings
   */
  getDateRange() {
    if (this.isCustomRange && this.customStartDate && this.customEndDate) {
      return {
        startDate: this.customStartDate,
        endDate: this.customEndDate,
      };
    } else {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - this.dateRange);
      return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      };
    }
  }

  /**
   * Switch between metrics and charts views
   */
  switchDashboardView(view) {
    // Switching dashboard view to: ${view}

    if (this.currentDashboardView === view) {
      // Already in this view
      return;
    }

    debug.log(`Switching dashboard view to: ${view}`);

    // Update active button
    document.querySelectorAll('.view-toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });

    // Show/hide views
    const metricsView = document.getElementById('metrics-view');
    const chartsView = document.getElementById('charts-view');

    if (view === 'metrics') {
      if (metricsView) {
        metricsView.style.display = 'block';
        metricsView.classList.add('active');
      }
      if (chartsView) {
        chartsView.style.display = 'none';
        chartsView.classList.remove('active');
      }
    } else if (view === 'charts') {
      if (metricsView) {
        metricsView.style.display = 'none';
        metricsView.classList.remove('active');
      }
      if (chartsView) {
        chartsView.style.display = 'block';
        chartsView.classList.add('active');
      }

      // Parent container dimensions verified

      // Wait for view to be fully visible
      setTimeout(() => {
        // Charts view is now visible

        // Initialize charts if not already done
        if (!this.chartsInitialized) {
          // Initializing charts

          // Check if we have data first
          if (!this.data || !this.data.trends) {
            debug.log('No data available yet, loading data first...');
            this.loadDashboardData()
              .then(() => {
                // Data loaded, rendering charts
                this.renderChartsInView();
              })
              .catch(error => {
                debug.error('Failed to load data:', error);
              });
          } else {
            // Data is available, render charts
            this.renderChartsInView();
          }
        } else {
          // Charts already initialized
        }
      }, 100); // Wait 100ms for layout
    }

    this.currentDashboardView = view;
  }

  /**
   * Render charts in the charts view with proper error handling
   */
  renderChartsInView() {
    // Rendering charts in view

    try {
      // Check if we have data to render
      if (this.data && this.data.trends) {
        // Use the proper renderChart method which respects the current view
        this.renderChart();
        this.chartsInitialized = true;
        // Chart rendered successfully
      } else {
        debug.log('No trends data available, loading data first...');
        // Load data if not available
        this.loadDashboardData().then(() => {
          if (this.data && this.data.trends) {
            this.renderChart();
            this.chartsInitialized = true;
          }
        });
      }
    } catch (error) {
      console.error('Error rendering chart:', error);
      console.error('Error details:', error.stack);
      this.chartsInitialized = false;
    }
  }

  /**
   * Handle date range change
   */
  async handleDateRangeChange(range) {
    // Update active button
    document.querySelectorAll('.date-range-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.range === range);
    });

    // Update date range
    if (range === 'custom') {
      // Show date picker modal
      modalManager.open('date-range-modal');
      return;
    }

    // Reset custom range flag when selecting preset range
    this.isCustomRange = false;
    this.dateRange = parseInt(range);

    // Reset custom button text
    const customBtn = document.querySelector('.date-range-btn[data-range="custom"]');
    if (customBtn) {
      customBtn.textContent = 'Custom Range';
    }

    await this.loadDashboardData();
  }

  /**
   * Load all dashboard data
   */
  async loadDashboardData() {
    if (this.isLoading) {
      return;
    }

    this.isLoading = true;
    this.showLoadingState();

    try {
      // Get the actual date range
      const { startDate, endDate } = this.getDateRange();

      // Batch all data requests for efficiency
      const [trends, anomalies, predictions, insights, merchants, dataQuality, systemMetrics] =
        await Promise.all([
          transactionManager.getSpendingTrends({
            startDate,
            endDate,
            groupBy: 'month',
          }),
          transactionManager.detectAnomalies({
            startDate,
            endDate,
            sensitivity: 'medium',
          }),
          transactionManager.predictMonthlySpending({
            months: 3,
            includeSeasonality: true,
          }),
          transactionManager.getTransactionInsights(),
          transactionManager.getMerchantAnalysis({
            startDate,
            endDate,
            limit: 10,
          }),
          transactionManager.getDataQualityReport(),
          Promise.resolve(transactionManager.getPerformanceMetrics()),
        ]);

      // Get category data separately
      const categoryTrends = await transactionManager.getSpendingTrends({
        startDate,
        endDate,
        groupBy: 'category',
      });

      // Store data
      this.data = {
        trends,
        categories: this.transformCategoryData(categoryTrends.data || []),
        merchants,
        anomalies: anomalies.anomalies || [],
        predictions,
        insights,
        budgetPerformance: null, // TODO: Get from user budgets
        dataQuality,
        systemMetrics,
      };

      // Render all components
      this.renderMetricCards();

      // Only render chart if we're in charts view and Chart.js is available
      if (this.currentDashboardView === 'charts' && window.Chart) {
        this.renderChart();
        this.chartsInitialized = true;
      }

      this.renderAnomalyAlerts();
      this.renderPredictions();
      this.renderRecommendations();
      this.renderBudgetPerformance();
      this.renderDataQuality();
      this.renderSystemPerformance();
    } catch (error) {
      debug.error('Failed to load dashboard data:', error);
      showError('Failed to load analytics data');
    } finally {
      this.isLoading = false;
      this.hideLoadingState();
    }
  }

  /**
   * Refresh dashboard data
   */
  async refreshDashboard() {
    const refreshBtn = document.getElementById('refresh-dashboard');
    if (refreshBtn) {
      refreshBtn.querySelector('.refresh-icon').style.animation = 'spin 1s linear infinite';
    }

    await this.loadDashboardData();

    if (refreshBtn) {
      refreshBtn.querySelector('.refresh-icon').style.animation = '';
    }
  }

  /**
   * Render metric cards
   */
  renderMetricCards() {
    const container = document.getElementById('metric-cards-grid');
    if (!container || !this.data.trends) {
      return;
    }

    const { summary } = this.data.trends;
    const { anomalies, predictions, systemMetrics } = this.data;

    const cards = [
      {
        label: 'Total Spending',
        value: formatCurrency(summary.totalSpending || 0),
        trend: summary.trend,
        trendValue: this.calculateTrendPercentage(summary),
        color: 'primary',
      },
      {
        label: 'Monthly Average',
        value: formatCurrency(summary.averageMonthlySpending || 0),
        trend: 'neutral',
        trendValue: null,
        color: 'secondary',
      },
      {
        label: 'Anomalies Detected',
        value: anomalies.length,
        trend: anomalies.length > 5 ? 'negative' : 'positive',
        trendValue: `${anomalies.filter(a => a.severity === 'high').length} high`,
        color: 'warning',
      },
      {
        label: 'Next Month Forecast',
        value: formatCurrency(predictions.predictions[0]?.total || 0),
        trend:
          predictions.predictions[0]?.total > summary.averageMonthlySpending
            ? 'negative'
            : 'positive',
        trendValue: `±${formatCurrency(predictions.predictions[0]?.confidenceInterval?.upper - predictions.predictions[0]?.confidenceInterval?.lower || 0)}`,
        color: 'purple',
      },
      {
        label: 'Cache Hit Rate',
        value: `${systemMetrics.cache.hitRate}%`,
        trend: systemMetrics.cache.hitRate > 70 ? 'positive' : 'negative',
        trendValue: `${systemMetrics.cache.hits} hits`,
        color: 'teal',
      },
      {
        label: 'Data Quality',
        value: `${this.data.dataQuality?.summary?.qualityScore || 0}%`,
        trend: (this.data.dataQuality?.summary?.qualityScore || 0) > 90 ? 'positive' : 'negative',
        trendValue: this.data.dataQuality?.summary?.scoreRating || 'N/A',
        color: 'success',
      },
    ];

    container.innerHTML = cards
      .map(
        card => `
            <div class="metric-card">
                <div class="metric-label">${escapeHtml(card.label)}</div>
                <div class="metric-value ${isPrivacyMode() ? 'privacy-blur' : ''}">${card.value}</div>
                ${
                  card.trendValue
                    ? `
                    <div class="metric-trend trend-${card.trend}">
                        <span>${card.trend === 'positive' ? '↑' : card.trend === 'negative' ? '↓' : '→'}</span>
                        <span>${card.trendValue}</span>
                    </div>
                `
                    : ''
                }
                <canvas class="metric-sparkline" id="sparkline-${card.label.toLowerCase().replace(/\s+/g, '-')}"></canvas>
            </div>
        `
      )
      .join('');

    // TODO: Add mini sparkline charts
  }

  /**
   * Transform category data into expected format
   */
  transformCategoryData(categoryData) {
    const categories = {};
    categoryData.forEach(cat => {
      categories[cat.label] = {
        total: cat.value,
        count: cat.count,
        average: cat.average,
      };
    });
    return categories;
  }

  /**
   * Calculate trend percentage
   */
  calculateTrendPercentage(summary) {
    // Handle new data structure
    if (!summary || !summary.trendAnalysis) {
      return '0%';
    }

    const { percentageChange } = summary.trendAnalysis || {};
    if (percentageChange === undefined) {
      return '0%';
    }

    return `${percentageChange > 0 ? '+' : ''}${percentageChange.toFixed(1)}%`;
  }

  /**
   * Render main chart
   */
  async renderChart() {
    debug.log('Rendering performance chart using simpleCharts module');

    // Check if we have data to display
    if (!this.data || !this.data.trends) {
      debug.error('No trends data available for chart');
      return;
    }

    // Get chart data based on current view
    const chartData = await this.getChartData();

    // Check if chart data is valid
    if (!chartData || !chartData.data) {
      debug.error('Invalid chart data');
      return;
    }

    // Use simpleCharts module to render
    try {
      simpleCharts.renderDataChart(this.currentView, chartData.data);
      debug.log(`Chart rendered successfully for view: ${this.currentView}`);
    } catch (error) {
      debug.error('Failed to render chart:', error);
    }
  }

  /**
   * Get chart data based on current view
   */
  async getChartData() {
    try {
      switch (this.currentView) {
        case 'trends':
          return this.getTrendsChartData();
        case 'categories':
          return this.getCategoriesChartData();
        case 'merchants':
          return this.getMerchantsChartData();
        case 'topExpenses':
          return await this.getTopExpensesChartData();
        case 'forecast':
          return this.getForecastChartData();
        default:
          return this.getTrendsChartData();
      }
    } catch (error) {
      console.error('Error getting chart data:', error);
      // Return empty chart data to prevent rendering errors
      return {
        labels: [],
        datasets: [
          {
            label: 'Error loading data',
            data: [],
            borderColor: 'rgba(239, 68, 68, 0.8)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
          },
        ],
      };
    }
  }

  /**
   * Get trends chart data
   */
  getTrendsChartData() {
    // Handle the actual data structure from transactionManager
    const trendsData = this.data.trends?.data || [];

    return {
      type: 'line',
      showLegend: true,
      data: {
        labels: trendsData.map(m => m.label),
        datasets: [
          {
            label: 'Total Spending',
            data: trendsData.map(m => m.value),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.3,
            fill: true,
          },
        ],
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
          },
          ticks: {
            color: '#94a3b8',
          },
        },
        y: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
          },
          ticks: {
            color: '#94a3b8',
            callback: value => formatCurrency(value),
          },
        },
      },
    };
  }

  /**
   * Get categories chart data
   */
  getCategoriesChartData() {
    const categories = this.data.categories;
    const topCategories = Object.entries(categories)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 8);

    return {
      type: 'doughnut',
      showLegend: true,
      data: {
        labels: topCategories.map(([name]) => name),
        datasets: [
          {
            data: topCategories.map(([, data]) => data.total || 0),
            backgroundColor: [
              '#3b82f6',
              '#10b981',
              '#f59e0b',
              '#ef4444',
              '#8b5cf6',
              '#ec4899',
              '#14b8a6',
              '#6366f1',
            ],
            borderWidth: 0,
          },
        ],
      },
      scales: {},
    };
  }

  /**
   * Get merchants chart data
   */
  getMerchantsChartData() {
    const { merchants } = this.data.merchants;

    return {
      type: 'bar',
      showLegend: false,
      data: {
        labels: merchants.map(m => m.name),
        datasets: [
          {
            label: 'Total Spent',
            data: merchants.map(m => m.total),
            backgroundColor: '#3b82f6',
            borderRadius: 8,
          },
        ],
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            color: '#94a3b8',
            maxRotation: 45,
            minRotation: 45,
          },
        },
        y: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
          },
          ticks: {
            color: '#94a3b8',
            callback: value => formatCurrency(value),
          },
        },
      },
    };
  }

  /**
   * Get top expenses chart data
   */
  async getTopExpensesChartData() {
    try {
      // Get date range
      const { startDate, endDate } = this.getDateRange();

      // Get transactions for the period
      const searchResult = await transactionManager.searchTransactions({
        startDate: startDate,
        endDate: endDate,
        // Remove type filter to get all transactions, then filter manually
      });

      // Extract transactions array from search result
      const transactions = searchResult.transactions || [];

      // Group expenses by category
      const expensesByCategory = {};
      let totalExpenses = 0;

      transactions.forEach(transaction => {
        if (transaction.amount < 0 || transaction.category === 'Debt') {
          // Include regular expenses (negative) and all debt payments
          const category = transaction.category || 'Uncategorized';
          const amount = Math.abs(transaction.amount);
          expensesByCategory[category] = addMoney(expensesByCategory[category] || 0, amount);
          totalExpenses = addMoney(totalExpenses, amount);
        }
      });

      // Sort and get top 8 categories
      const sortedCategories = Object.entries(expensesByCategory)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

      // Prepare chart data
      const labels = sortedCategories.map(([category]) => category);
      const data = sortedCategories.map(([, amount]) => amount);
      const percentages = data.map(amount => ((amount / totalExpenses) * 100).toFixed(1));

      // Use consistent colors with categories chart
      const colors = [
        '#3b82f6', // blue
        '#06b6d4', // cyan
        '#10b981', // emerald
        '#f59e0b', // amber
        '#ef4444', // red
        '#8b5cf6', // violet
        '#ec4899', // pink
        '#6366f1', // indigo
      ];

      return {
        type: 'bar',
        showLegend: false,
        data: {
          labels: isPrivacyMode() ? labels.map(() => '••••••') : labels,
          datasets: [
            {
              label: 'Amount Spent',
              data: isPrivacyMode() ? data.map(() => Math.random() * 1000) : data,
              backgroundColor: colors,
              borderColor: colors.map(color => `${color}33`),
              borderWidth: 1,
            },
          ],
        },
        indexAxis: 'y', // Horizontal bar chart
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.05)',
            },
            ticks: {
              color: '#94a3b8',
              callback: value => formatCurrency(value),
            },
          },
          y: {
            grid: {
              display: false,
            },
            ticks: {
              color: '#94a3b8',
            },
          },
        },
      };
    } catch (error) {
      debug.error('Failed to get top expenses data:', error);
      // Return empty chart data on error
      return {
        type: 'bar',
        showLegend: false,
        data: {
          labels: [],
          datasets: [
            {
              label: 'Top Expenses',
              data: [],
              backgroundColor: [],
            },
          ],
        },
      };
    }
  }

  /**
   * Get forecast chart data
   */
  getForecastChartData() {
    // TODO: Implement cash flow forecast chart
    // For now, return trends chart as fallback
    return this.getTrendsChartData();
  }

  /**
   * Switch chart view
   */
  switchChart(chartType) {
    // Update active tab
    document.querySelectorAll('.chart-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.chart === chartType);
    });

    this.currentView = chartType;
    this.renderChart();
  }

  /**
   * Export current chart
   */
  exportChart() {
    if (!this.chartInstance) {
      return;
    }

    const canvas = document.getElementById('performanceChart');
    const url = canvas.toDataURL('image/png');

    const a = document.createElement('a');
    a.href = url;
    a.download = `ryokushen-${this.currentView}-${new Date().toISOString().split('T')[0]}.png`;
    a.click();

    showSuccess('Chart exported successfully');
  }

  /**
   * Show loading state for dashboard
   */
  showLoadingState() {
    // Add skeleton loaders
    const metricGrid = document.getElementById('metric-cards-grid');
    if (metricGrid) {
      metricGrid.innerHTML = Array(6)
        .fill('')
        .map(
          () => `
                <div class="metric-card">
                    <div class="skeleton skeleton-text"></div>
                    <div class="skeleton skeleton-value"></div>
                </div>
            `
        )
        .join('');
    }

    // Show chart loading
    const chartContainer = document.getElementById('main-chart-container');
    if (chartContainer) {
      const chartLoading = chartContainer.querySelector('.chart-loading');
      if (chartLoading) {
        chartLoading.style.display = 'flex';
      }
      const canvas = document.getElementById('performanceChart');
      if (canvas) {
        canvas.style.display = 'none';
      }
    }
  }

  /**
   * Hide loading state for dashboard
   */
  hideLoadingState() {
    // Loading states are removed when actual content is rendered
    // This is just a placeholder for any cleanup needed
  }

  /**
   * Render anomaly alerts
   */
  renderAnomalyAlerts() {
    const container = document.getElementById('anomaly-alerts');
    if (!container || !this.data.anomalies) {
      return;
    }

    const topAnomalies = this.data.anomalies
      .sort((a, b) => {
        const severityOrder = { high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      })
      .slice(0, 5);

    if (topAnomalies.length === 0) {
      container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">✅</div>
                    <div class="empty-message">No anomalies detected</div>
                </div>
            `;
      return;
    }

    container.innerHTML = topAnomalies
      .map(
        anomaly => `
            <div class="anomaly-alert severity-${anomaly.severity}">
                <div class="alert-header">
                    <div class="alert-title">${escapeHtml(anomaly.transaction.description)}</div>
                    <div class="alert-severity severity-${anomaly.severity}">${anomaly.severity}</div>
                </div>
                <div class="alert-message">${escapeHtml(anomaly.reason)}</div>
                <div class="alert-details">
                    ${formatDate(anomaly.transaction.date)} • ${formatCurrency(Math.abs(anomaly.transaction.amount))}
                </div>
            </div>
        `
      )
      .join('');
  }

  /**
   * Render predictions panel
   */
  renderPredictions() {
    const container = document.getElementById('predictions-panel');
    if (!container || !this.data.predictions) {
      return;
    }

    const predictions = this.data.predictions?.predictions || [];
    const nextMonth = predictions[0];

    if (!nextMonth) {
      container.innerHTML = '<div class="empty-state">No predictions available</div>';
      return;
    }

    container.innerHTML = `
            <div class="prediction-card">
                <div class="prediction-label">Next Month Spending</div>
                <div class="prediction-value ${isPrivacyMode() ? 'privacy-blur' : ''}">
                    ${formatCurrency(nextMonth.expenses?.predicted || 0)}
                </div>
                <div class="prediction-confidence">
                    <span>Confidence</span>
                    <div class="confidence-bar">
                        <div class="confidence-fill" style="width: ${this.data.predictions?.summary?.confidence || 95}%"></div>
                    </div>
                    <span>${this.data.predictions?.summary?.confidence || 95}%</span>
                </div>
            </div>
            <div class="prediction-card">
                <div class="prediction-label">Confidence Range</div>
                <div class="prediction-value ${isPrivacyMode() ? 'privacy-blur' : ''}">
                    ${formatCurrency(nextMonth.expenses?.confidenceInterval?.lower || 0)} - ${formatCurrency(nextMonth.expenses?.confidenceInterval?.upper || 0)}
                </div>
            </div>
        `;

    // Add category predictions if available
    if (nextMonth.categories && Array.isArray(nextMonth.categories)) {
      const topCategories = nextMonth.categories
        .sort((a, b) => (b.predicted || 0) - (a.predicted || 0))
        .slice(0, 3);

      container.innerHTML += topCategories
        .map(
          cat => `
                <div class="prediction-card">
                    <div class="prediction-label">${escapeHtml(cat.category)}</div>
                    <div class="prediction-value ${isPrivacyMode() ? 'privacy-blur' : ''}">
                        ${formatCurrency(cat.predicted || 0)}
                    </div>
                    <div class="prediction-trend">
                        <span>Trend: ${cat.trend || 'stable'}</span>
                    </div>
                </div>
            `
        )
        .join('');
    }
  }

  /**
   * Render recommendations panel
   */
  async renderRecommendations() {
    const container = document.getElementById('recommendations-panel');
    if (!container) {
      return;
    }

    try {
      const recommendations = await transactionManager.getSmartRuleRecommendations();
      // Handle both array and object responses
      const recArray = Array.isArray(recommendations)
        ? recommendations
        : recommendations?.recommendations || [];
      const topRecs = recArray.slice(0, 3);

      if (topRecs.length === 0) {
        container.innerHTML = '<div class="empty-state">No recommendations available</div>';
        return;
      }

      container.innerHTML = topRecs
        .map(rec => {
          // Add defensive coding for missing properties
          const type = rec.type ? rec.type.replace(/_/g, ' ') : 'Unknown';
          const ruleName = rec.rule?.name || rec.name || 'Unnamed Rule';
          const matchCount = rec.pattern?.matchCount || rec.matchCount || 0;
          const confidence = rec.confidence ? (rec.confidence * 100).toFixed(0) : 0;

          return `
                    <div class="recommendation-card" data-recommendation='${JSON.stringify(rec)}'>
                        <div class="recommendation-type">${type}</div>
                        <div class="recommendation-title">${escapeHtml(ruleName)}</div>
                        <div class="recommendation-description">
                            ${matchCount} matching transactions • ${confidence}% confidence
                        </div>
                    </div>
                `;
        })
        .join('');

      // Add click handlers
      container.querySelectorAll('.recommendation-card').forEach(card => {
        card.addEventListener('click', () => {
          const rec = JSON.parse(card.dataset.recommendation);
          this.createRuleFromRecommendation(rec);
        });
      });
    } catch (error) {
      debug.error('Failed to load recommendations:', error);
      container.innerHTML = '<div class="empty-state">Failed to load recommendations</div>';
    }
  }

  /**
   * Create rule from recommendation
   */
  createRuleFromRecommendation(recommendation) {
    // TODO: Open rule creation modal with pre-filled data
    debug.log('Creating rule from recommendation:', recommendation);
    showSuccess('Rule creation coming soon!');
  }

  /**
   * Render budget performance
   */
  renderBudgetPerformance() {
    const container = document.getElementById('budget-performance');
    if (!container) {
      return;
    }

    // TODO: Get actual budget data from user settings
    const mockBudgets = {
      Food: 800,
      Entertainment: 200,
      Shopping: 300,
      Transportation: 150,
    };

    // For now, show empty state
    container.innerHTML = `
            <div class="empty-state">
                <div class="empty-message">Set up budgets to track performance</div>
            </div>
        `;
  }

  /**
   * Render data quality metrics
   */
  renderDataQuality() {
    const container = document.getElementById('data-quality');
    if (!container || !this.data.dataQuality) {
      return;
    }

    const { summary, metrics } = this.data.dataQuality;
    const score = summary?.qualityScore || 0;
    const rating = summary?.scoreRating || 'N/A';

    container.innerHTML = `
            <div class="quality-score">
                <div class="quality-gauge">
                    <svg class="quality-circle" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="10"/>
                        <circle cx="50" cy="50" r="45" fill="none" stroke="#22c55e" stroke-width="10"
                                stroke-dasharray="${score * 2.83} 283"
                                stroke-linecap="round"/>
                    </svg>
                    <div class="quality-value">${score}%</div>
                </div>
                <div class="quality-details">
                    <div class="quality-label">Data Quality Score</div>
                    <div class="quality-grade">${rating}</div>
                    <div class="quality-issues">
                        ${
                          metrics?.missingCategories > 0
                            ? `
                            <div class="quality-issue">
                                <span class="issue-label">Missing categories</span>
                                <span class="issue-count">${metrics.missingCategories}</span>
                            </div>
                        `
                            : ''
                        }
                        ${
                          metrics?.missingDescriptions > 0
                            ? `
                            <div class="quality-issue">
                                <span class="issue-label">Missing descriptions</span>
                                <span class="issue-count">${metrics.missingDescriptions}</span>
                            </div>
                        `
                            : ''
                        }
                        ${
                          metrics?.potentialDuplicates > 0
                            ? `
                            <div class="quality-issue">
                                <span class="issue-label">Potential duplicates</span>
                                <span class="issue-count">${metrics.potentialDuplicates}</span>
                            </div>
                        `
                            : ''
                        }
                    </div>
                </div>
            </div>
        `;
  }

  /**
   * Render system performance metrics
   */
  renderSystemPerformance() {
    const container = document.getElementById('system-performance');
    if (!container || !this.data.systemMetrics) {
      return;
    }

    const { cache = {}, operations = {}, memory = {} } = this.data.systemMetrics || {};

    const metrics = [
      { label: 'Cache Hit Rate', value: `${cache.hitRate || 0}%` },
      { label: 'Total Operations', value: (operations.total || 0).toLocaleString() },
      { label: 'Error Rate', value: `${operations.errorRate || 0}%` },
      { label: 'Memory Usage', value: memory.totalMemory || 'N/A' },
      { label: 'Cache Size', value: `${cache.size || 0} items` },
      { label: 'Response Time', value: operations.avgResponseTime || 'N/A' },
    ];

    container.innerHTML = metrics
      .map(
        metric => `
            <div class="perf-metric">
                <div class="perf-label">${metric.label}</div>
                <div class="perf-value">${metric.value}</div>
            </div>
        `
      )
      .join('');
  }

  /**
   * Show loading state
   */
  showLoadingState() {
    // Add skeleton loaders
    const metricGrid = document.getElementById('metric-cards-grid');
    if (metricGrid) {
      metricGrid.innerHTML = Array(6)
        .fill('')
        .map(
          () => `
                <div class="metric-card">
                    <div class="skeleton skeleton-text"></div>
                    <div class="skeleton skeleton-value"></div>
                </div>
            `
        )
        .join('');
    }

    // Show chart loading
    const chartContainer = document.getElementById('main-chart-container');
    if (chartContainer) {
      const chartLoading = chartContainer.querySelector('.chart-loading');
      if (chartLoading) {
        chartLoading.style.display = 'flex';
      }
      const canvas = document.getElementById('performanceChart');
      if (canvas) {
        canvas.style.display = 'none';
      }
    }
  }

  /**
   * Hide loading state
   */
  hideLoadingState() {
    // Loading states are replaced by actual content
  }
}

// Export singleton instance
export const performanceDashboard = new PerformanceDashboard();

// Expose to window for debugging
if (typeof window !== 'undefined') {
  window.performanceDashboard = performanceDashboard;
}
