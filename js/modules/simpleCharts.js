// Simple Charts Module for Analytics Tab
import { debug } from './debug.js';
import { formatCurrency } from './utils.js';

class SimpleCharts {
  constructor() {
    this.chartInstance = null;
    this.container = null;
    this.canvas = null;
  }

  /**
   * Initialize the chart module
   */
  init() {
    console.log('=== SimpleCharts: INIT CALLED ===');
    debug.log('SimpleCharts: Initializing...');
    
    // Find container and canvas
    this.container = document.getElementById('main-chart-container');
    this.canvas = document.getElementById('performanceChart');
    
    console.log('Container element:', this.container);
    console.log('Canvas element:', this.canvas);
    
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
    
    // Check visibility
    console.log('Canvas display style:', this.canvas.style.display);
    console.log('Canvas computed style:', window.getComputedStyle(this.canvas).display);
    console.log('Container display style:', this.container.style.display);
    
    // Check for Chart.js
    if (!window.Chart) {
      console.error('SimpleCharts: Chart.js is not loaded!');
      debug.error('SimpleCharts: Chart.js is not loaded');
      this.showError('Chart.js is not loaded. Charts cannot be displayed.');
      return false;
    }
    
    console.log('SimpleCharts: Initialization successful');
    debug.log('SimpleCharts: Initialization successful');
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
    debug.log('SimpleCharts: Showing loading state');
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
    console.log('SimpleCharts: Hiding loading state');
    debug.log('SimpleCharts: Hiding loading state');
    if (this.container) {
      const loadingDiv = this.container.querySelector('.chart-loading');
      if (loadingDiv) {
        console.log('Found loading div, hiding it');
        loadingDiv.style.display = 'none';
      } else {
        console.log('No loading div found');
      }
      if (this.canvas) {
        console.log('Showing canvas by setting display to block');
        this.canvas.style.display = 'block';
        // Force a reflow to ensure the canvas is visible
        this.canvas.offsetHeight;
        console.log('Canvas display after show:', this.canvas.style.display);
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
   * Render a simple test chart
   */
  renderTestChart() {
    console.log('=== SimpleCharts: RENDER TEST CHART CALLED ===');
    debug.log('SimpleCharts: Rendering test chart...');
    
    if (!this.init()) {
      console.error('SimpleCharts: Init failed, cannot render test chart');
      return;
    }
    
    this.showLoading();
    
    try {
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
        datasets: [{
          label: 'Test Data',
          data: [1000, 1200, 1100, 1400, 1300, 1500],
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.3,
          fill: true
        }]
      };
      
      // Create chart
      console.log('Creating new Chart instance...');
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
                color: '#94a3b8'
              }
            },
            title: {
              display: true,
              text: 'Test Chart - If you see this, Chart.js is working!',
              color: '#ffffff',
              font: {
                size: 16
              }
            }
          },
          scales: {
            x: {
              grid: {
                color: 'rgba(255, 255, 255, 0.1)'
              },
              ticks: {
                color: '#94a3b8'
              }
            },
            y: {
              grid: {
                color: 'rgba(255, 255, 255, 0.1)'
              },
              ticks: {
                color: '#94a3b8',
                callback: function(value) {
                  return formatCurrency(value);
                }
              }
            }
          }
        }
      });
      
      // Verify chart was created
      console.log('Chart instance created:', !!this.chartInstance);
      console.log('Chart ID:', this.chartInstance?.id);
      console.log('Chart canvas:', this.chartInstance?.canvas);
      console.log('Canvas width:', this.canvas.width);
      console.log('Canvas height:', this.canvas.height);
      console.log('Canvas client width:', this.canvas.clientWidth);
      console.log('Canvas client height:', this.canvas.clientHeight);
      
      this.hideLoading();
      debug.log('SimpleCharts: Test chart rendered successfully');
      
    } catch (error) {
      debug.error('SimpleCharts: Failed to render test chart', error);
      this.showError(`Failed to render chart: ${error.message}`);
    }
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
    
    this.showLoading();
    
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
      
      this.hideLoading();
      debug.log(`SimpleCharts: ${type} chart rendered successfully`);
      
    } catch (error) {
      debug.error(`SimpleCharts: Failed to render ${type} chart`, error);
      this.showError(`Failed to render chart: ${error.message}`);
    }
  }

  /**
   * Get configuration for top expenses chart
   */
  getTopExpensesConfig(data) {
    return {
      type: 'bar',
      data: data,
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: 'Top Expenses',
            color: '#ffffff',
            font: {
              size: 16
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#94a3b8',
              callback: function(value) {
                return formatCurrency(value);
              }
            }
          },
          y: {
            grid: {
              display: false
            },
            ticks: {
              color: '#94a3b8'
            }
          }
        }
      }
    };
  }

  /**
   * Get configuration for trends chart
   */
  getTrendsConfig(data) {
    return {
      type: 'line',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: {
              color: '#94a3b8'
            }
          },
          title: {
            display: true,
            text: 'Spending Trends',
            color: '#ffffff',
            font: {
              size: 16
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#94a3b8'
            }
          },
          y: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#94a3b8',
              callback: function(value) {
                return formatCurrency(value);
              }
            }
          }
        }
      }
    };
  }

  /**
   * Get configuration for categories chart
   */
  getCategoriesConfig(data) {
    return {
      type: 'doughnut',
      data: data,
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
                size: 12
              }
            }
          },
          title: {
            display: true,
            text: 'Expenses by Category',
            color: '#ffffff',
            font: {
              size: 16
            }
          }
        }
      }
    };
  }
}

// Export singleton instance
export const simpleCharts = new SimpleCharts();