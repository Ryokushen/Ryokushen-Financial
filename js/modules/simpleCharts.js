// Simple Charts Module for Analytics Tab
import { debug } from './debug.js';
import { formatCurrency } from './utils.js';

class SimpleCharts {
  constructor() {
    this.chartInstance = null;
    this.container = null;
    this.canvas = null;
    this.initialized = false;
  }

  /**
   * Initialize the chart module
   */
  init() {
    // SimpleCharts initialization
    debug.log('SimpleCharts: Initializing...');

    // Find container and canvas
    const container = document.getElementById('main-chart-container');
    const canvas = document.getElementById('performanceChart');

    // Check if already initialized with same elements
    if (this.initialized && this.container === container && this.canvas === canvas) {
      return true;
    }

    this.container = container;
    this.canvas = canvas;

    if (!this.container) {
      console.error('SimpleCharts: Container #main-chart-container not found!');
      debug.error('SimpleCharts: Missing container element');
      return false;
    }

    if (!this.canvas) {
      console.error('SimpleCharts: Canvas #performanceChart not found!');
      debug.error('SimpleCharts: Missing canvas element');
      return false;
    }

    // Check visibility and dimensions
    const chartsSection = this.container.closest('.charts-section');
    const chartsView = this.container.closest('#charts-view');
    const performanceTab = this.container.closest('#performance');

    // Check for Chart.js
    if (!window.Chart) {
      console.error('SimpleCharts: Chart.js is not loaded!');
      debug.error('SimpleCharts: Chart.js is not loaded');
      this.showError('Chart.js is not loaded. Charts cannot be displayed.');
      return false;
    }

    debug.log('SimpleCharts: Initialization successful');
    this.initialized = true;
    return true;
  }

  /**
   * Show error message in chart container
   */
  showError(message) {
    if (this.container) {
      this.container.innerHTML = `
        <div class="chart-error" style="
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #ef4444;
          font-size: 16px;
          text-align: center;
          padding: 20px;
        ">
          <div>
            <div style="font-size: 48px; margin-bottom: 20px;">📊❌</div>
            <div>${message}</div>
          </div>
        </div>
      `;
    }
  }

  /**
   * Show loading state
   */
  showLoading() {
    if (this.container) {
      const loadingDiv = this.container.querySelector('.chart-loading');
      if (loadingDiv) {
        loadingDiv.style.display = 'flex';
      }
      if (this.canvas) {
        this.canvas.style.display = 'none';
      }
    }
  }

  /**
   * Hide loading state
   */
  hideLoading() {
    if (this.container) {
      const loadingDiv = this.container.querySelector('.chart-loading');
      if (loadingDiv) {
        loadingDiv.style.display = 'none';
      }
      if (this.canvas) {
        this.canvas.style.display = 'block';
        // Force a reflow to ensure the canvas is visible
        this.canvas.offsetHeight;
      }
    }
  }

  /**
   * Destroy existing chart
   */
  destroy() {
    if (this.chartInstance) {
      debug.log('SimpleCharts: Destroying existing chart');
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
  }

  /**
   * Reset initialization state
   */
  reset() {
    this.destroy();
    this.initialized = false;
    this.container = null;
    this.canvas = null;
  }

  /**
   * Render a simple test chart
   */
  renderTestChart() {
    debug.log('SimpleCharts: Rendering test chart...');

    if (!this.init()) {
      console.error('SimpleCharts: Init failed, cannot render test chart');
      return;
    }

    // First, ensure canvas is visible BEFORE creating chart
    const loadingDiv = this.container.querySelector('.chart-loading');
    if (loadingDiv) {
      loadingDiv.style.display = 'none';
    }

    // Show canvas and ensure it has dimensions
    this.canvas.style.display = 'block';

    // Set container minimum height if it doesn't have one
    if (!this.container.style.height && !this.container.style.minHeight) {
      this.container.style.minHeight = '400px';
    }

    // Force layout recalculation
    this.container.offsetHeight;

    // Wait for next frame to ensure dimensions are calculated
    requestAnimationFrame(() => {
      try {
        // Validate canvas has dimensions
        if (this.canvas.clientWidth === 0 || this.canvas.clientHeight === 0) {
          debug.error('Canvas has 0 dimensions, attempting to fix...');

          // Force container to be visible
          this.container.style.display = 'block';
          this.container.style.visibility = 'visible';
          this.container.style.width = '100%';
          this.container.style.minHeight = '400px';

          // Force canvas dimensions
          this.canvas.style.width = '100%';
          this.canvas.style.height = '400px';

          // Try again after forcing dimensions
          setTimeout(() => {
            if (this.canvas.clientWidth === 0 || this.canvas.clientHeight === 0) {
              debug.error('Canvas still has 0 dimensions. Chart may not display.');
            }
          }, 100);
        }

        // Destroy any existing chart
        this.destroy();

        // Get context
        const ctx = this.canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Cannot get canvas context');
        }

        // Create simple test data
        const testData = {
          labels: ['January', 'February', 'March', 'April', 'May', 'June'],
          datasets: [
            {
              label: 'Test Data',
              data: [1000, 1200, 1100, 1400, 1300, 1500],
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              tension: 0.3,
              fill: true,
            },
          ],
        };

        // Create chart
        this.chartInstance = new Chart(ctx, {
          type: 'line',
          data: testData,
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: true,
                labels: {
                  color: '#94a3b8',
                },
              },
              title: {
                display: true,
                text: 'Test Chart - If you see this, Chart.js is working!',
                color: '#ffffff',
                font: {
                  size: 16,
                },
              },
            },
            scales: {
              x: {
                grid: {
                  color: 'rgba(255, 255, 255, 0.1)',
                },
                ticks: {
                  color: '#94a3b8',
                },
              },
              y: {
                grid: {
                  color: 'rgba(255, 255, 255, 0.1)',
                },
                ticks: {
                  color: '#94a3b8',
                  callback(value) {
                    return formatCurrency(value);
                  },
                },
              },
            },
          },
        });

        // Force chart resize to ensure proper dimensions
        if (this.chartInstance && this.canvas.clientWidth > 0) {
          this.chartInstance.resize();
        }

        debug.log('SimpleCharts: Test chart rendered successfully');
      } catch (error) {
        console.error('SimpleCharts: Failed to render test chart', error);
        debug.error('SimpleCharts: Failed to render test chart', error);
        this.showError(`Failed to render chart: ${error.message}`);
      }
    });
  }

  /**
   * Render actual data chart
   */
  renderDataChart(type, data) {
    debug.log(`SimpleCharts: Rendering ${type} chart...`);

    if (!this.init()) {
      return;
    }

    if (!data) {
      debug.error('SimpleCharts: No data provided');
      this.showError('No data available for chart');
      return;
    }

    // Ensure canvas is visible before creating chart
    const loadingDiv = this.container.querySelector('.chart-loading');
    if (loadingDiv) {
      loadingDiv.style.display = 'none';
    }
    this.canvas.style.display = 'block';

    // Ensure container has height
    if (!this.container.style.height && !this.container.style.minHeight) {
      this.container.style.minHeight = '400px';
    }

    // Force layout recalculation
    this.container.offsetHeight;

    // Wait for next frame
    requestAnimationFrame(() => {
      try {
        // Destroy any existing chart
        this.destroy();

        // Get context
        const ctx = this.canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Cannot get canvas context');
        }

        let chartConfig;

        switch (type) {
          case 'topExpenses':
            chartConfig = this.getTopExpensesConfig(data);
            break;
          case 'trends':
            chartConfig = this.getTrendsConfig(data);
            break;
          case 'categories':
            chartConfig = this.getCategoriesConfig(data);
            break;
          default:
            chartConfig = this.getTrendsConfig(data);
        }

        // Create chart
        this.chartInstance = new Chart(ctx, chartConfig);

        // Force resize if needed
        if (this.chartInstance && this.canvas.clientWidth > 0) {
          this.chartInstance.resize();
        }

        debug.log(`SimpleCharts: ${type} chart rendered successfully`);
      } catch (error) {
        console.error(`SimpleCharts: Failed to render ${type} chart`, error);
        debug.error(`SimpleCharts: Failed to render ${type} chart`, error);
        this.showError(`Failed to render chart: ${error.message}`);
      }
    });
  }

  /**
   * Get configuration for top expenses chart
   */
  getTopExpensesConfig(data) {
    return {
      type: 'bar',
      data,
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          title: {
            display: true,
            text: 'Top Expenses',
            color: '#ffffff',
            font: {
              size: 16,
            },
          },
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)',
            },
            ticks: {
              color: '#94a3b8',
              callback(value) {
                return formatCurrency(value);
              },
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
      },
    };
  }

  /**
   * Get configuration for trends chart
   */
  getTrendsConfig(data) {
    return {
      type: 'line',
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: {
              color: '#94a3b8',
            },
          },
          title: {
            display: true,
            text: 'Spending Trends',
            color: '#ffffff',
            font: {
              size: 16,
            },
          },
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)',
            },
            ticks: {
              color: '#94a3b8',
            },
          },
          y: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)',
            },
            ticks: {
              color: '#94a3b8',
              callback(value) {
                return formatCurrency(value);
              },
            },
          },
        },
      },
    };
  }

  /**
   * Get configuration for categories chart
   */
  getCategoriesConfig(data) {
    return {
      type: 'doughnut',
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'right',
            labels: {
              color: '#94a3b8',
              padding: 15,
              font: {
                size: 12,
              },
              generateLabels(chart) {
                const data = chart.data;
                if (data.labels.length && data.datasets.length) {
                  return data.labels.map((label, i) => {
                    const meta = chart.getDatasetMeta(0);
                    const style = meta.controller.getStyle(i);
                    const value = data.datasets[0].data[i];

                    // Truncate long labels
                    const maxLength = 15;
                    const truncatedLabel =
                      label.length > maxLength ? `${label.substring(0, maxLength)}...` : label;

                    return {
                      text: truncatedLabel,
                      fillStyle: style.backgroundColor,
                      strokeStyle: style.borderColor,
                      lineWidth: style.borderWidth,
                      hidden: isNaN(value) || meta.data[i].hidden,
                      index: i,
                      // Store full label for tooltip
                      fullLabel: label,
                    };
                  });
                }
                return [];
              },
              // Add box width to give more space for text
              boxWidth: 15,
              boxHeight: 15,
            },
          },
          title: {
            display: true,
            text: 'Expenses by Category',
            color: '#ffffff',
            font: {
              size: 16,
            },
          },
          tooltip: {
            callbacks: {
              label(context) {
                const label = context.label || '';
                const value = context.parsed || 0;
                const formattedValue = formatCurrency(value);
                const percentage = (
                  (value / context.dataset.data.reduce((a, b) => a + b, 0)) *
                  100
                ).toFixed(1);
                return `${label}: ${formattedValue} (${percentage}%)`;
              },
            },
          },
        },
        // Add layout padding to prevent cutoff
        layout: {
          padding: {
            right: 20,
          },
        },
      },
    };
  }
}

// Export singleton instance
export const simpleCharts = new SimpleCharts();
