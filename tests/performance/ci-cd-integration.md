# CI/CD Integration Guide for Performance Testing

## Overview

This guide provides instructions for integrating the performance optimization tests into your CI/CD pipeline. It includes configurations for GitHub Actions, automated test execution, performance monitoring, and deployment gates.

## CI/CD Architecture

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Code Push     │───▶│   Trigger    │───▶│  Performance    │
│   Pull Request  │    │   Pipeline   │    │   Test Suite    │
└─────────────────┘    └──────────────┘    └─────────────────┘
                                                     │
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Deploy to     │◀───│  Gates Pass  │◀───│  Analyze &      │
│   Production    │    │  or Block    │    │  Report Results │
└─────────────────┘    └──────────────┘    └─────────────────┘
```

## GitHub Actions Workflow

### 1. Complete Workflow Configuration

Create `.github/workflows/performance-tests.yml`:

```yaml
name: Performance Optimization Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]
  schedule:
    # Run daily at 2 AM UTC
    - cron: '0 2 * * *'
  workflow_dispatch:
    inputs:
      test_suite:
        description: 'Test suite to run'
        required: true
        default: 'all'
        type: choice
        options:
        - all
        - critical-path
        - performance-validation
        - edge-cases
      data_size:
        description: 'Test data size'
        required: true
        default: 'medium'
        type: choice
        options:
        - small
        - medium
        - large
        - extreme

env:
  NODE_VERSION: '18'
  PERFORMANCE_THRESHOLD: '200'
  MEMORY_THRESHOLD: '100'

jobs:
  setup:
    runs-on: ubuntu-latest
    outputs:
      test-matrix: ${{ steps.matrix.outputs.matrix }}
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Test Matrix
        id: matrix
        run: |
          if [ "${{ github.event.inputs.test_suite }}" = "all" ] || [ -z "${{ github.event.inputs.test_suite }}" ]; then
            echo "matrix=[\"critical-path\", \"performance-validation\", \"edge-cases\"]" >> $GITHUB_OUTPUT
          else
            echo "matrix=[\"${{ github.event.inputs.test_suite }}\"]" >> $GITHUB_OUTPUT
          fi

  performance-tests:
    needs: setup
    runs-on: ubuntu-latest
    strategy:
      matrix:
        test-suite: ${{ fromJson(needs.setup.outputs.test-matrix) }}
        browser: ['chrome', 'firefox']
      fail-fast: false
    
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install Dependencies
        run: |
          npm ci
          npm install -g http-server

      - name: Setup Browser
        uses: browser-actions/setup-chrome@v1
        if: matrix.browser == 'chrome'
      
      - name: Setup Firefox
        uses: browser-actions/setup-firefox@v1
        if: matrix.browser == 'firefox'

      - name: Start Test Server
        run: |
          http-server . -p 8080 &
          sleep 5
          curl -f http://localhost:8080 || exit 1

      - name: Run Performance Tests
        id: tests
        run: |
          node tests/performance/ci-runner.js \
            --suite=${{ matrix.test-suite }} \
            --browser=${{ matrix.browser }} \
            --data-size=${{ github.event.inputs.data_size || 'medium' }} \
            --output=json > test-results-${{ matrix.test-suite }}-${{ matrix.browser }}.json

      - name: Analyze Results
        id: analysis
        run: |
          node tests/performance/result-analyzer.js \
            test-results-${{ matrix.test-suite }}-${{ matrix.browser }}.json \
            --threshold-performance=${{ env.PERFORMANCE_THRESHOLD }} \
            --threshold-memory=${{ env.MEMORY_THRESHOLD }}

      - name: Upload Test Results
        uses: actions/upload-artifact@v4
        with:
          name: test-results-${{ matrix.test-suite }}-${{ matrix.browser }}
          path: |
            test-results-*.json
            screenshots/
            performance-traces/
          retention-days: 30

      - name: Comment PR with Results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('test-results-${{ matrix.test-suite }}-${{ matrix.browser }}.json'));
            
            const comment = `
            ## Performance Test Results - ${{ matrix.test-suite }} (${{ matrix.browser }})
            
            - **Success Rate**: ${results.summary.successRate}%
            - **Performance Grade**: ${results.summary.performanceGrade}
            - **Critical Issues**: ${results.summary.criticalIssues}
            - **Memory Usage**: ${results.summary.memoryUsage.current}MB
            
            ${results.summary.criticalIssues > 0 ? '⚠️ **Performance degradation detected!**' : '✅ **Performance targets met**'}
            
            [View Detailed Report](https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }})
            `;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });

  performance-gate:
    needs: performance-tests
    runs-on: ubuntu-latest
    if: always()
    
    steps:
      - name: Download All Results
        uses: actions/download-artifact@v4
        with:
          pattern: test-results-*
          merge-multiple: true

      - name: Aggregate Results
        id: aggregate
        run: |
          node -e "
          const fs = require('fs');
          const files = fs.readdirSync('.').filter(f => f.startsWith('test-results-'));
          let totalTests = 0, passedTests = 0, criticalIssues = 0;
          
          files.forEach(file => {
            const results = JSON.parse(fs.readFileSync(file));
            totalTests += results.summary.totalTests || 0;
            passedTests += results.summary.passedTests || 0;
            criticalIssues += results.summary.criticalIssues || 0;
          });
          
          const successRate = totalTests > 0 ? (passedTests / totalTests * 100) : 0;
          console.log('SUCCESS_RATE=' + successRate);
          console.log('CRITICAL_ISSUES=' + criticalIssues);
          console.log('TOTAL_TESTS=' + totalTests);
          " >> $GITHUB_OUTPUT

      - name: Performance Gate Check
        run: |
          if [ "${{ steps.aggregate.outputs.CRITICAL_ISSUES }}" -gt "0" ]; then
            echo "❌ Performance gate FAILED: ${{ steps.aggregate.outputs.CRITICAL_ISSUES }} critical issues detected"
            exit 1
          elif [ "$(echo "${{ steps.aggregate.outputs.SUCCESS_RATE }} < 95" | bc)" -eq 1 ]; then
            echo "❌ Performance gate FAILED: Success rate ${{ steps.aggregate.outputs.SUCCESS_RATE }}% below 95%"
            exit 1
          else
            echo "✅ Performance gate PASSED: ${{ steps.aggregate.outputs.SUCCESS_RATE }}% success rate"
          fi

      - name: Generate Combined Report
        run: |
          node tests/performance/report-generator.js \
            --input="test-results-*.json" \
            --format=html \
            --output=performance-report.html

      - name: Upload Combined Report
        uses: actions/upload-artifact@v4
        with:
          name: performance-report
          path: performance-report.html

  deploy-gate:
    needs: performance-gate
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    
    steps:
      - name: Deployment Approval
        run: |
          echo "✅ Performance tests passed - Ready for deployment"
          echo "Performance gate requirements met for production deployment"

  performance-monitoring:
    needs: performance-gate
    runs-on: ubuntu-latest
    if: always()
    
    steps:
      - name: Send Performance Metrics
        run: |
          # Send metrics to monitoring system (e.g., DataDog, New Relic)
          curl -X POST "${{ secrets.MONITORING_WEBHOOK }}" \
            -H "Content-Type: application/json" \
            -d '{
              "source": "ci-performance-tests",
              "environment": "${{ github.ref_name }}",
              "success_rate": "${{ needs.performance-gate.outputs.SUCCESS_RATE }}",
              "critical_issues": "${{ needs.performance-gate.outputs.CRITICAL_ISSUES }}",
              "timestamp": "'$(date -Iseconds)'"
            }'

  notify:
    needs: [performance-tests, performance-gate]
    runs-on: ubuntu-latest
    if: failure()
    
    steps:
      - name: Notify Team
        uses: 8398a7/action-slack@v3
        with:
          status: failure
          text: |
            Performance tests failed on ${{ github.ref_name }}
            Critical Issues: ${{ needs.performance-gate.outputs.CRITICAL_ISSUES }}
            View results: https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

### 2. CI Test Runner Script

Create `tests/performance/ci-runner.js`:

```javascript
#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { program } = require('commander');

program
  .option('--suite <suite>', 'Test suite to run', 'critical-path')
  .option('--browser <browser>', 'Browser to use', 'chrome')
  .option('--data-size <size>', 'Test data size', 'medium')
  .option('--headless', 'Run in headless mode', true)
  .option('--output <format>', 'Output format', 'json')
  .option('--timeout <ms>', 'Test timeout', '300000')
  .parse();

const options = program.opts();

const TEST_SUITES = {
  'critical-path': '/tests/performance/critical-path-tests.html',
  'performance-validation': '/tests/performance/p1-performance-validation.html',
  'edge-cases': '/tests/performance/edge-cases-compatibility.html'
};

async function runPerformanceTests() {
  const browser = await puppeteer.launch({
    headless: options.headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1920,1080'
    ]
  });

  let results = {};
  
  try {
    const page = await browser.newPage();
    
    // Set viewport and enable performance monitoring
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Enable console logging
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.error('PAGE ERROR:', err.message));
    
    // Navigate to test suite
    const testUrl = `http://localhost:8080${TEST_SUITES[options.suite]}?autorun=true&dataSize=${options.dataSize}`;
    console.log(`Running tests: ${testUrl}`);
    
    await page.goto(testUrl, { waitUntil: 'networkidle0' });
    
    // Wait for tests to complete
    await page.waitForFunction(
      () => window.testComplete || window.testResults,
      { timeout: parseInt(options.timeout) }
    );
    
    // Extract test results
    results = await page.evaluate(() => {
      if (window.testResults) {
        return window.testResults;
      }
      
      // Fallback: extract results from DOM
      const summary = document.querySelector('#performance-summary');
      return {
        summary: {
          successRate: 0,
          totalTests: 0,
          passedTests: 0,
          criticalIssues: 0
        },
        error: 'Test results not found in expected format'
      };
    });
    
    // Take screenshot for debugging
    await page.screenshot({ 
      path: `screenshots/test-${options.suite}-${options.browser}.png`,
      fullPage: true 
    });
    
    // Collect performance metrics
    const performanceMetrics = await page.metrics();
    results.performance = performanceMetrics;
    
  } catch (error) {
    console.error('Test execution failed:', error);
    results = {
      error: error.message,
      summary: {
        successRate: 0,
        totalTests: 0,
        passedTests: 0,
        criticalIssues: 1
      }
    };
  } finally {
    await browser.close();
  }
  
  // Add metadata
  results.metadata = {
    suite: options.suite,
    browser: options.browser,
    dataSize: options.dataSize,
    timestamp: new Date().toISOString(),
    environment: 'ci'
  };
  
  // Output results
  if (options.output === 'json') {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log('Test execution completed');
    console.log(`Success Rate: ${results.summary.successRate}%`);
    console.log(`Critical Issues: ${results.summary.criticalIssues}`);
  }
  
  // Exit with appropriate code
  process.exit(results.summary.criticalIssues > 0 ? 1 : 0);
}

// Create directories
['screenshots', 'performance-traces'].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

runPerformanceTests().catch(error => {
  console.error('CI Runner failed:', error);
  process.exit(1);
});
```

### 3. Result Analyzer Script

Create `tests/performance/result-analyzer.js`:

```javascript
#!/usr/bin/env node

const fs = require('fs');
const { program } = require('commander');

program
  .argument('<results-file>', 'Test results JSON file')
  .option('--threshold-performance <ms>', 'Performance threshold in ms', '200')
  .option('--threshold-memory <mb>', 'Memory threshold in MB', '100')
  .option('--output <format>', 'Output format', 'text')
  .parse();

const options = program.opts();
const resultsFile = program.args[0];

function analyzeResults() {
  if (!fs.existsSync(resultsFile)) {
    console.error(`Results file not found: ${resultsFile}`);
    process.exit(1);
  }
  
  const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
  
  const analysis = {
    passed: true,
    issues: [],
    metrics: {},
    recommendations: []
  };
  
  // Analyze success rate
  if (results.summary?.successRate < 95) {
    analysis.passed = false;
    analysis.issues.push({
      type: 'success_rate',
      severity: 'critical',
      message: `Success rate ${results.summary.successRate}% below 95%`
    });
  }
  
  // Analyze performance metrics
  if (results.summary?.averageMetrics) {
    Object.entries(results.summary.averageMetrics).forEach(([metric, value]) => {
      if (value > parseInt(options.thresholdPerformance)) {
        analysis.passed = false;
        analysis.issues.push({
          type: 'performance',
          severity: 'warning',
          message: `${metric} (${value}ms) exceeds threshold (${options.thresholdPerformance}ms)`
        });
      }
    });
  }
  
  // Analyze memory usage
  if (results.summary?.memoryUsage?.current > parseInt(options.thresholdMemory)) {
    analysis.passed = false;
    analysis.issues.push({
      type: 'memory',
      severity: 'warning',
      message: `Memory usage (${results.summary.memoryUsage.current}MB) exceeds threshold (${options.thresholdMemory}MB)`
    });
  }
  
  // Generate recommendations
  if (analysis.issues.length > 0) {
    analysis.recommendations.push('Review failing tests and optimize performance bottlenecks');
    analysis.recommendations.push('Consider increasing resource allocation or optimizing algorithms');
  } else {
    analysis.recommendations.push('Performance targets met - ready for deployment');
  }
  
  // Output analysis
  if (options.output === 'json') {
    console.log(JSON.stringify(analysis, null, 2));
  } else {
    console.log(`\n=== Performance Analysis ===`);
    console.log(`Status: ${analysis.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Issues Found: ${analysis.issues.length}`);
    
    if (analysis.issues.length > 0) {
      console.log('\nIssues:');
      analysis.issues.forEach(issue => {
        console.log(`  ${issue.severity.toUpperCase()}: ${issue.message}`);
      });
    }
    
    console.log('\nRecommendations:');
    analysis.recommendations.forEach(rec => {
      console.log(`  - ${rec}`);
    });
  }
  
  // Exit with appropriate code
  process.exit(analysis.passed ? 0 : 1);
}

analyzeResults();
```

## Local CI Testing

### 1. Test the CI Pipeline Locally

```bash
# Install act (GitHub Actions local runner)
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Run the workflow locally
act -W .github/workflows/performance-tests.yml \
    --input test_suite=critical-path \
    --input data_size=small
```

### 2. Manual CI Testing

```bash
# Start local server
npm start &

# Run tests manually
node tests/performance/ci-runner.js \
  --suite=critical-path \
  --browser=chrome \
  --data-size=medium \
  --output=json

# Analyze results
node tests/performance/result-analyzer.js \
  test-results.json \
  --threshold-performance=200 \
  --threshold-memory=100
```

## Monitoring & Alerting

### 1. Performance Metrics Dashboard

```yaml
# Add to monitoring configuration
performance_metrics:
  - name: test_success_rate
    query: avg(ci_performance_success_rate)
    threshold: 95
    
  - name: test_duration
    query: avg(ci_performance_duration)
    threshold: 300000  # 5 minutes
    
  - name: memory_usage
    query: max(ci_performance_memory_usage)
    threshold: 100  # MB
```

### 2. Alert Configuration

```yaml
alerts:
  - name: performance_degradation
    condition: performance_metrics.test_success_rate < 95
    severity: critical
    channels: [slack, email]
    
  - name: memory_leak_detected
    condition: performance_metrics.memory_usage > 150
    severity: warning
    channels: [slack]
```

## Deployment Gates

### 1. Production Deployment Gate

```yaml
production_gate:
  requirements:
    - performance_tests: PASS
    - success_rate: ">= 95%"
    - critical_issues: "= 0"
    - memory_usage: "< 100MB"
  
  failure_action: block_deployment
  notification: required
```

### 2. Staging Deployment Gate

```yaml
staging_gate:
  requirements:
    - performance_tests: PASS
    - success_rate: ">= 90%"
    - critical_issues: "<= 1"
  
  failure_action: allow_with_warning
  notification: optional
```

## Performance Regression Detection

### 1. Baseline Management

```bash
# Store performance baselines
git tag performance-baseline-v1.0.0
echo "dataIndexRebuild: 50ms" > performance-baselines.yml
echo "chartRender: 100ms" >> performance-baselines.yml
echo "memoryUsage: 25MB" >> performance-baselines.yml
```

### 2. Regression Detection

```javascript
// In CI pipeline
const currentMetrics = results.summary.averageMetrics;
const baselineMetrics = loadBaseline();

Object.entries(currentMetrics).forEach(([metric, value]) => {
  const baseline = baselineMetrics[metric];
  const regression = ((value - baseline) / baseline) * 100;
  
  if (regression > 20) {
    console.warn(`Performance regression detected: ${metric} increased by ${regression}%`);
  }
});
```

## Best Practices

### 1. Test Data Management

- Use deterministic test data for consistent results
- Clean up test data between runs
- Version test datasets with the application

### 2. Resource Management

- Monitor CI resource usage
- Set appropriate timeouts
- Clean up browser processes

### 3. Result Storage

- Archive test results for trend analysis
- Store artifacts for debugging
- Maintain performance history

### 4. Notifications

- Configure appropriate alert thresholds
- Use different notification channels for different severities
- Include actionable information in alerts

## Troubleshooting

### Common CI Issues

1. **Tests Timing Out**
   ```bash
   # Increase timeout in workflow
   timeout: 600000  # 10 minutes
   ```

2. **Browser Launch Failures**
   ```bash
   # Add additional Chrome flags
   --disable-extensions
   --disable-plugins
   --no-first-run
   ```

3. **Memory Issues**
   ```bash
   # Monitor and limit memory usage
   ulimit -v 2097152  # 2GB virtual memory limit
   ```

This CI/CD integration ensures continuous performance monitoring and prevents performance regressions from reaching production.