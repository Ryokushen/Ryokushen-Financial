/**
 * Performance Monitoring Utilities for Testing
 * Provides comprehensive performance measurement and benchmarking
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.benchmarks = new Map();
    this.memoryBaseline = null;
    this.observers = [];
    this.isRunning = false;
  }

  /**
   * Start monitoring session
   */
  start() {
    this.isRunning = true;
    this.memoryBaseline = this.getMemoryUsage();
    this.setupObservers();
    console.log('🔍 Performance monitoring started');
  }

  /**
   * Stop monitoring session
   */
  stop() {
    this.isRunning = false;
    this.clearObservers();
    console.log('⏹️ Performance monitoring stopped');
  }

  /**
   * Measure execution time of a function
   */
  async measureAsync(name, asyncFn) {
    const startTime = performance.now();
    const startMemory = this.getMemoryUsage();

    try {
      const result = await asyncFn();
      const endTime = performance.now();
      const endMemory = this.getMemoryUsage();

      this.recordMetric(name, {
        duration: endTime - startTime,
        memoryDelta: endMemory - startMemory,
        success: true,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      const endTime = performance.now();
      this.recordMetric(name, {
        duration: endTime - startTime,
        memoryDelta: 0,
        success: false,
        error: error.message,
        timestamp: Date.now(),
      });
      throw error;
    }
  }

  /**
   * Measure synchronous function execution
   */
  measure(name, syncFn) {
    const startTime = performance.now();
    const startMemory = this.getMemoryUsage();

    try {
      const result = syncFn();
      const endTime = performance.now();
      const endMemory = this.getMemoryUsage();

      this.recordMetric(name, {
        duration: endTime - startTime,
        memoryDelta: endMemory - startMemory,
        success: true,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      const endTime = performance.now();
      this.recordMetric(name, {
        duration: endTime - startTime,
        memoryDelta: 0,
        success: false,
        error: error.message,
        timestamp: Date.now(),
      });
      throw error;
    }
  }

  /**
   * Benchmark data index operations
   */
  benchmarkDataIndex(dataIndex, testData) {
    const results = {
      indexBuild: null,
      lookupPerformance: {},
      memoryUsage: {},
    };

    // Test index building performance
    results.indexBuild = this.measure('dataIndex.rebuildIndexes', () => {
      dataIndex.rebuildIndexes(testData);
    });

    // Test various lookup operations
    if (testData.transactions.length > 0) {
      const sampleTransaction = testData.transactions[0];

      // Test account lookup
      results.lookupPerformance.accountLookup = this.measure('dataIndex.getAccountById', () => {
        for (let i = 0; i < 100; i++) {
          dataIndex.getAccountById(1, 'cash');
        }
      });

      // Test category lookup
      results.lookupPerformance.categoryLookup = this.measure(
        'dataIndex.getTransactionsByCategory',
        () => {
          for (let i = 0; i < 100; i++) {
            dataIndex.getTransactionsByCategory(sampleTransaction.category);
          }
        }
      );

      // Test date lookup
      results.lookupPerformance.dateLookup = this.measure('dataIndex.getTransactionsByDate', () => {
        for (let i = 0; i < 100; i++) {
          dataIndex.getTransactionsByDate(sampleTransaction.date);
        }
      });
    }

    // Memory usage stats
    results.memoryUsage = {
      current: this.getMemoryUsage(),
      baseline: this.memoryBaseline,
      delta: this.getMemoryUsage() - this.memoryBaseline,
      indexStats: dataIndex.getStats(),
    };

    return results;
  }

  /**
   * Benchmark debouncing and throttling
   */
  benchmarkPerformanceUtils() {
    const results = {
      debounce: null,
      throttle: null,
      rafThrottle: null,
    };

    // Test debouncing
    let debounceCallCount = 0;
    const debouncedFn = this.debounce(() => debounceCallCount++, 100);

    results.debounce = this.measure('debounce.effectiveness', () => {
      // Rapid fire calls
      for (let i = 0; i < 50; i++) {
        debouncedFn();
      }
      // Wait and check if only called once
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({ callCount: debounceCallCount, expected: 1 });
        }, 150);
      });
    });

    // Test throttling
    let throttleCallCount = 0;
    const throttledFn = this.throttle(() => throttleCallCount++, 100);

    results.throttle = this.measure('throttle.effectiveness', () => {
      // Rapid fire calls over 500ms
      for (let i = 0; i < 50; i++) {
        setTimeout(() => throttledFn(), i * 10);
      }
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({ callCount: throttleCallCount, expectedRange: [4, 6] });
        }, 600);
      });
    });

    return results;
  }

  /**
   * Monitor chart rendering performance
   */
  benchmarkChartRendering(chartElement, updateCount = 10) {
    const results = {
      initialRender: null,
      updates: [],
      memoryLeaks: false,
    };

    const initialMemory = this.getMemoryUsage();

    // Test initial chart render
    results.initialRender = this.measure('chart.initialRender', () => {
      // This would trigger chart creation
      if (window.Chart && chartElement) {
        return new Chart(chartElement.getContext('2d'), {
          type: 'line',
          data: { labels: ['A', 'B', 'C'], datasets: [] },
        });
      }
    });

    // Test chart updates
    if (results.initialRender.success) {
      for (let i = 0; i < updateCount; i++) {
        const updateResult = this.measure(`chart.update.${i}`, () => {
          // Simulate chart update
          if (window.Chart) {
            const chart = results.initialRender;
            chart.data.datasets.push({
              label: `Dataset ${i}`,
              data: [Math.random(), Math.random(), Math.random()],
            });
            chart.update();
          }
        });
        results.updates.push(updateResult);
      }
    }

    // Check for memory leaks
    const finalMemory = this.getMemoryUsage();
    results.memoryLeaks = finalMemory - initialMemory > 50; // MB threshold

    return results;
  }

  /**
   * Test virtual scrolling performance
   */
  benchmarkVirtualScrolling(containerElement, itemCount = 1000) {
    const results = {
      scrollPerformance: [],
      renderTime: null,
    };

    // Simulate scroll events
    results.renderTime = this.measure('virtualScroll.render', () => {
      if (containerElement) {
        // Simulate rendering items
        for (let i = 0; i < Math.min(50, itemCount); i++) {
          const item = document.createElement('div');
          item.textContent = `Item ${i}`;
          containerElement.appendChild(item);
        }
      }
    });

    // Test scroll performance
    if (containerElement) {
      for (let i = 0; i < 10; i++) {
        const scrollResult = this.measure(`scroll.event.${i}`, () => {
          containerElement.scrollTop = i * 100;
          // Trigger scroll event
          containerElement.dispatchEvent(new Event('scroll'));
        });
        results.scrollPerformance.push(scrollResult);
      }
    }

    return results;
  }

  /**
   * Record a metric
   */
  recordMetric(name, data) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name).push(data);
  }

  /**
   * Get performance summary
   */
  getSummary() {
    const summary = {
      totalTests: this.metrics.size,
      successRate: 0,
      averageTimes: {},
      memoryUsage: {
        baseline: this.memoryBaseline,
        current: this.getMemoryUsage(),
        peak: this.getPeakMemoryUsage(),
      },
      failedTests: [],
    };

    let totalSuccess = 0;
    let totalTests = 0;

    this.metrics.forEach((results, testName) => {
      const successful = results.filter(r => r.success).length;
      const total = results.length;
      totalSuccess += successful;
      totalTests += total;

      if (successful > 0) {
        const avgTime =
          results.filter(r => r.success).reduce((sum, r) => sum + r.duration, 0) / successful;
        summary.averageTimes[testName] = Math.round(avgTime * 100) / 100;
      }

      if (successful < total) {
        summary.failedTests.push({
          name: testName,
          successRate: successful / total,
          failures: results.filter(r => !r.success),
        });
      }
    });

    summary.successRate = totalTests > 0 ? totalSuccess / totalTests : 0;
    return summary;
  }

  /**
   * Generate detailed report
   */
  generateReport() {
    const summary = this.getSummary();
    const report = {
      timestamp: new Date().toISOString(),
      summary,
      benchmarks: Object.fromEntries(this.benchmarks),
      recommendations: this.getRecommendations(summary),
      rawMetrics: Object.fromEntries(this.metrics),
    };

    return report;
  }

  /**
   * Get performance recommendations
   */
  getRecommendations(summary) {
    const recommendations = [];

    // Check slow operations
    Object.entries(summary.averageTimes).forEach(([test, avgTime]) => {
      if (avgTime > 100) {
        recommendations.push({
          type: 'performance',
          severity: 'warning',
          test,
          message: `${test} averages ${avgTime}ms, consider optimization`,
        });
      }
      if (avgTime > 500) {
        recommendations.push({
          type: 'performance',
          severity: 'critical',
          test,
          message: `${test} is critically slow at ${avgTime}ms`,
        });
      }
    });

    // Check memory usage
    if (summary.memoryUsage.current - summary.memoryUsage.baseline > 100) {
      recommendations.push({
        type: 'memory',
        severity: 'warning',
        message: `High memory usage increase: ${summary.memoryUsage.current - summary.memoryUsage.baseline}MB`,
      });
    }

    // Check success rate
    if (summary.successRate < 0.95) {
      recommendations.push({
        type: 'reliability',
        severity: 'critical',
        message: `Low success rate: ${(summary.successRate * 100).toFixed(1)}%`,
      });
    }

    return recommendations;
  }

  // Utility methods
  getMemoryUsage() {
    if (window.performance && window.performance.memory) {
      return window.performance.memory.usedJSHeapSize / 1024 / 1024; // MB
    }
    return 0;
  }

  getPeakMemoryUsage() {
    if (window.performance && window.performance.memory) {
      return window.performance.memory.totalJSHeapSize / 1024 / 1024; // MB
    }
    return 0;
  }

  setupObservers() {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver(list => {
        list.getEntries().forEach(entry => {
          this.recordMetric(`observer.${entry.entryType}`, {
            name: entry.name,
            duration: entry.duration || entry.processingEnd - entry.processingStart,
            timestamp: entry.startTime,
            success: true,
          });
        });
      });

      try {
        observer.observe({ entryTypes: ['measure', 'navigation', 'paint'] });
        this.observers.push(observer);
      } catch (e) {
        console.warn('Performance observer not fully supported:', e);
      }
    }
  }

  clearObservers() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }

  // Performance utilities (simplified versions for testing)
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  throttle(func, wait) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), wait);
      }
    };
  }
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PerformanceMonitor;
} else {
  window.PerformanceMonitor = PerformanceMonitor;
}
