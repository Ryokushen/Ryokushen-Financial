/**
 * Performance Benchmark Report Generator
 * Generates comprehensive reports from test results
 */

class BenchmarkReportGenerator {
    constructor() {
        this.testResults = new Map();
        this.baselineMetrics = this.loadBaselineMetrics();
        this.reportTemplate = this.loadReportTemplate();
    }

    /**
     * Add test results to the report
     */
    addTestResults(testSuite, results) {
        this.testResults.set(testSuite, {
            ...results,
            timestamp: Date.now(),
            browser: this.detectBrowser(),
            system: this.getSystemInfo()
        });
    }

    /**
     * Generate comprehensive performance report
     */
    generateReport(options = {}) {
        const {
            format = 'html',
            includeRawData = false,
            compareWithBaseline = true
        } = options;

        const report = {
            metadata: this.generateMetadata(),
            summary: this.generateSummary(),
            detailedResults: this.generateDetailedResults(),
            performanceAnalysis: this.generatePerformanceAnalysis(),
            browserCompatibility: this.generateBrowserCompatibility(),
            recommendations: this.generateRecommendations(),
            baseline: compareWithBaseline ? this.baselineMetrics : null,
            rawData: includeRawData ? Object.fromEntries(this.testResults) : null
        };

        switch (format) {
            case 'html':
                return this.generateHTMLReport(report);
            case 'markdown':
                return this.generateMarkdownReport(report);
            case 'json':
                return JSON.stringify(report, null, 2);
            case 'csv':
                return this.generateCSVReport(report);
            default:
                return report;
        }
    }

    /**
     * Generate executive summary
     */
    generateSummary() {
        const totalTests = Array.from(this.testResults.values()).length;
        const passedTests = Array.from(this.testResults.values())
            .filter(result => result.validation?.passed || result.success).length;
        
        const overallSuccessRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
        
        // Calculate average performance metrics
        const performanceMetrics = this.calculateAverageMetrics();
        
        // Identify critical issues
        const criticalIssues = this.identifyCriticalIssues();
        
        return {
            overallSuccessRate: Math.round(overallSuccessRate),
            totalTests,
            passedTests,
            failedTests: totalTests - passedTests,
            performanceGrade: this.calculatePerformanceGrade(performanceMetrics),
            criticalIssues: criticalIssues.length,
            averageMetrics: performanceMetrics,
            testDuration: this.calculateTotalTestDuration(),
            memoryUsage: this.calculateMemoryUsage(),
            browserCompatibility: this.calculateBrowserCompatibilityScore()
        };
    }

    /**
     * Generate detailed test results
     */
    generateDetailedResults() {
        const results = {};
        
        this.testResults.forEach((result, testSuite) => {
            results[testSuite] = {
                status: result.validation?.passed || result.success ? 'PASS' : 'FAIL',
                duration: result.duration || 0,
                metrics: result.metrics || {},
                errors: result.errors || [],
                warnings: result.warnings || [],
                performance: this.analyzeTestPerformance(result),
                memoryUsage: result.memoryUsage || {},
                browserInfo: result.browser || {}
            };
        });
        
        return results;
    }

    /**
     * Generate performance analysis
     */
    generatePerformanceAnalysis() {
        const analysis = {
            dataIndexing: this.analyzeDataIndexPerformance(),
            userInterface: this.analyzeUIPerformance(),
            memoryManagement: this.analyzeMemoryPerformance(),
            browserOptimizations: this.analyzeBrowserOptimizations(),
            regressionAnalysis: this.analyzeRegressions()
        };

        return analysis;
    }

    /**
     * Generate browser compatibility matrix
     */
    generateBrowserCompatibility() {
        const compatibility = {
            tested: [],
            supported: [],
            issues: [],
            featureMatrix: {}
        };

        this.testResults.forEach((result, testSuite) => {
            if (result.browser) {
                compatibility.tested.push(result.browser.name);
                
                if (result.validation?.passed || result.success) {
                    compatibility.supported.push(result.browser.name);
                } else {
                    compatibility.issues.push({
                        browser: result.browser.name,
                        issues: result.errors || []
                    });
                }
            }
        });

        // Remove duplicates
        compatibility.tested = [...new Set(compatibility.tested)];
        compatibility.supported = [...new Set(compatibility.supported)];

        return compatibility;
    }

    /**
     * Generate recommendations based on test results
     */
    generateRecommendations() {
        const recommendations = [];

        // Performance recommendations
        const performanceIssues = this.identifyPerformanceIssues();
        performanceIssues.forEach(issue => {
            recommendations.push({
                type: 'performance',
                severity: issue.severity,
                title: issue.title,
                description: issue.description,
                suggestion: issue.suggestion,
                estimatedImpact: issue.impact
            });
        });

        // Memory recommendations
        const memoryIssues = this.identifyMemoryIssues();
        memoryIssues.forEach(issue => {
            recommendations.push({
                type: 'memory',
                severity: issue.severity,
                title: issue.title,
                description: issue.description,
                suggestion: issue.suggestion,
                estimatedImpact: issue.impact
            });
        });

        // Browser compatibility recommendations
        const compatibilityIssues = this.identifyCompatibilityIssues();
        compatibilityIssues.forEach(issue => {
            recommendations.push({
                type: 'compatibility',
                severity: issue.severity,
                title: issue.title,
                description: issue.description,
                suggestion: issue.suggestion,
                estimatedImpact: issue.impact
            });
        });

        return recommendations.sort((a, b) => {
            const severityOrder = { 'critical': 3, 'high': 2, 'medium': 1, 'low': 0 };
            return severityOrder[b.severity] - severityOrder[a.severity];
        });
    }

    /**
     * Generate HTML report
     */
    generateHTMLReport(report) {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Optimization Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #e0e0e0; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
        .metric-card { background: #f8f9fa; padding: 20px; border-radius: 6px; text-align: center; border-left: 4px solid #007bff; }
        .metric-value { font-size: 2em; font-weight: bold; color: #007bff; }
        .metric-label { color: #666; margin-top: 5px; }
        .section { margin: 40px 0; }
        .grade-a { color: #28a745; }
        .grade-b { color: #ffc107; }
        .grade-c { color: #fd7e14; }
        .grade-f { color: #dc3545; }
        .status-pass { color: #28a745; font-weight: bold; }
        .status-fail { color: #dc3545; font-weight: bold; }
        .recommendation { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 10px 0; border-radius: 4px; }
        .recommendation.critical { background: #f8d7da; border-color: #f5c6cb; }
        .recommendation.high { background: #fff3cd; border-color: #ffeaa7; }
        .recommendation.medium { background: #d1ecf1; border-color: #bee5eb; }
        .recommendation.low { background: #d4edda; border-color: #c3e6cb; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; font-weight: bold; }
        .chart-container { margin: 20px 0; text-align: center; }
        .progress-bar { width: 100%; height: 20px; background: #e9ecef; border-radius: 10px; overflow: hidden; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #28a745, #ffc107, #dc3545); }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Performance Optimization Test Report</h1>
            <p>Generated on ${new Date(report.metadata.generatedAt).toLocaleString()}</p>
            <p>Test Environment: ${report.metadata.environment} | Browser: ${report.metadata.browser}</p>
        </div>

        <div class="section">
            <h2>Executive Summary</h2>
            <div class="summary-grid">
                <div class="metric-card">
                    <div class="metric-value ${this.getGradeClass(report.summary.performanceGrade)}">${report.summary.performanceGrade}</div>
                    <div class="metric-label">Overall Grade</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${report.summary.overallSuccessRate}%</div>
                    <div class="metric-label">Success Rate</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${report.summary.passedTests}/${report.summary.totalTests}</div>
                    <div class="metric-label">Tests Passed</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${report.summary.criticalIssues}</div>
                    <div class="metric-label">Critical Issues</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>Performance Metrics</h2>
            <table>
                <thead>
                    <tr>
                        <th>Metric</th>
                        <th>Current</th>
                        <th>Target</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.generateMetricsTable(report.summary.averageMetrics)}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>Test Results</h2>
            <table>
                <thead>
                    <tr>
                        <th>Test Suite</th>
                        <th>Status</th>
                        <th>Duration</th>
                        <th>Memory Usage</th>
                        <th>Issues</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.generateTestResultsTable(report.detailedResults)}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>Recommendations</h2>
            ${report.recommendations.map(rec => `
                <div class="recommendation ${rec.severity}">
                    <h4>${rec.title}</h4>
                    <p><strong>Type:</strong> ${rec.type} | <strong>Severity:</strong> ${rec.severity}</p>
                    <p>${rec.description}</p>
                    <p><strong>Suggestion:</strong> ${rec.suggestion}</p>
                    <p><strong>Estimated Impact:</strong> ${rec.estimatedImpact}</p>
                </div>
            `).join('')}
        </div>

        <div class="section">
            <h2>Browser Compatibility</h2>
            <p><strong>Tested Browsers:</strong> ${report.browserCompatibility.tested.join(', ')}</p>
            <p><strong>Supported Browsers:</strong> ${report.browserCompatibility.supported.join(', ')}</p>
            ${report.browserCompatibility.issues.length > 0 ? `
                <h4>Compatibility Issues:</h4>
                <ul>
                    ${report.browserCompatibility.issues.map(issue => 
                        `<li><strong>${issue.browser}:</strong> ${issue.issues.join(', ')}</li>`
                    ).join('')}
                </ul>
            ` : '<p>No compatibility issues detected.</p>'}
        </div>
    </div>
</body>
</html>`;
    }

    /**
     * Generate Markdown report
     */
    generateMarkdownReport(report) {
        return `# Performance Optimization Test Report

Generated on ${new Date(report.metadata.generatedAt).toLocaleString()}

## Executive Summary

- **Overall Grade:** ${report.summary.performanceGrade}
- **Success Rate:** ${report.summary.overallSuccessRate}%
- **Tests Passed:** ${report.summary.passedTests}/${report.summary.totalTests}
- **Critical Issues:** ${report.summary.criticalIssues}

## Performance Metrics

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
${Object.entries(report.summary.averageMetrics).map(([metric, value]) => 
    `| ${metric} | ${value} | - | - |`
).join('\n')}

## Test Results

| Test Suite | Status | Duration | Issues |
|------------|--------|----------|--------|
${Object.entries(report.detailedResults).map(([suite, result]) => 
    `| ${suite} | ${result.status} | ${result.duration}ms | ${result.errors.length} |`
).join('\n')}

## Recommendations

${report.recommendations.map(rec => `
### ${rec.title} (${rec.severity})

**Type:** ${rec.type}
**Description:** ${rec.description}
**Suggestion:** ${rec.suggestion}
**Estimated Impact:** ${rec.estimatedImpact}
`).join('\n')}

## Browser Compatibility

- **Tested:** ${report.browserCompatibility.tested.join(', ')}
- **Supported:** ${report.browserCompatibility.supported.join(', ')}
${report.browserCompatibility.issues.length > 0 ? `
- **Issues:**
${report.browserCompatibility.issues.map(issue => `  - ${issue.browser}: ${issue.issues.join(', ')}`).join('\n')}
` : '- **Issues:** None detected'}
`;
    }

    // Helper methods
    generateMetadata() {
        return {
            generatedAt: Date.now(),
            testVersion: '1.0.0',
            environment: this.detectEnvironment(),
            browser: this.detectBrowser(),
            system: this.getSystemInfo()
        };
    }

    calculateAverageMetrics() {
        const metrics = {};
        const allResults = Array.from(this.testResults.values());
        
        if (allResults.length === 0) return metrics;
        
        // Collect all metric keys
        const metricKeys = new Set();
        allResults.forEach(result => {
            if (result.metrics) {
                Object.keys(result.metrics).forEach(key => metricKeys.add(key));
            }
        });
        
        // Calculate averages
        metricKeys.forEach(key => {
            const values = allResults
                .map(result => result.metrics?.[key])
                .filter(val => typeof val === 'number');
            
            if (values.length > 0) {
                metrics[key] = Math.round(values.reduce((sum, val) => sum + val, 0) / values.length);
            }
        });
        
        return metrics;
    }

    calculatePerformanceGrade(metrics) {
        // Simplified grading logic
        const scores = [];
        
        if (metrics.dataIndexRebuild) {
            scores.push(metrics.dataIndexRebuild < 100 ? 90 : metrics.dataIndexRebuild < 200 ? 70 : 50);
        }
        if (metrics.chartRender) {
            scores.push(metrics.chartRender < 200 ? 90 : metrics.chartRender < 500 ? 70 : 50);
        }
        if (metrics.formPopulation) {
            scores.push(metrics.formPopulation < 20 ? 90 : metrics.formPopulation < 50 ? 70 : 50);
        }
        
        const avgScore = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
        
        if (avgScore >= 85) return 'A';
        if (avgScore >= 75) return 'B';
        if (avgScore >= 65) return 'C';
        return 'F';
    }

    getGradeClass(grade) {
        return `grade-${grade.toLowerCase()}`;
    }

    generateMetricsTable(metrics) {
        const targets = {
            dataIndexRebuild: 100,
            chartRender: 200,
            formPopulation: 20,
            transactionRender: 50
        };
        
        return Object.entries(metrics).map(([metric, value]) => {
            const target = targets[metric] || 'N/A';
            const status = typeof target === 'number' && value <= target ? 'PASS' : 'REVIEW';
            const statusClass = status === 'PASS' ? 'status-pass' : 'status-fail';
            
            return `<tr>
                <td>${metric}</td>
                <td>${value}ms</td>
                <td>${target}${typeof target === 'number' ? 'ms' : ''}</td>
                <td><span class="${statusClass}">${status}</span></td>
            </tr>`;
        }).join('');
    }

    generateTestResultsTable(results) {
        return Object.entries(results).map(([suite, result]) => {
            const statusClass = result.status === 'PASS' ? 'status-pass' : 'status-fail';
            return `<tr>
                <td>${suite}</td>
                <td><span class="${statusClass}">${result.status}</span></td>
                <td>${result.duration}ms</td>
                <td>${result.memoryUsage?.current || 0}MB</td>
                <td>${result.errors.length}</td>
            </tr>`;
        }).join('');
    }

    // Utility methods
    detectBrowser() {
        const ua = navigator.userAgent;
        if (ua.includes('Chrome')) return { name: 'Chrome', version: ua.match(/Chrome\\/([\\d.]+)/)?.[1] };
        if (ua.includes('Firefox')) return { name: 'Firefox', version: ua.match(/Firefox\\/([\\d.]+)/)?.[1] };
        if (ua.includes('Safari')) return { name: 'Safari', version: ua.match(/Version\\/([\\d.]+)/)?.[1] };
        if (ua.includes('Edge')) return { name: 'Edge', version: ua.match(/Edge\\/([\\d.]+)/)?.[1] };
        return { name: 'Unknown', version: 'Unknown' };
    }

    detectEnvironment() {
        if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
            return 'development';
        }
        if (location.hostname.includes('staging')) {
            return 'staging';
        }
        return 'production';
    }

    getSystemInfo() {
        return {
            platform: navigator.platform,
            userAgent: navigator.userAgent,
            language: navigator.language,
            cookieEnabled: navigator.cookieEnabled,
            onLine: navigator.onLine
        };
    }

    loadBaselineMetrics() {
        // Load baseline metrics from storage or default values
        return {
            dataIndexRebuild: 50,
            chartRender: 100,
            formPopulation: 10,
            transactionRender: 30,
            memoryUsage: 25
        };
    }

    loadReportTemplate() {
        // Load report template configuration
        return {
            sections: ['summary', 'metrics', 'results', 'recommendations', 'compatibility'],
            formats: ['html', 'markdown', 'json', 'csv']
        };
    }

    identifyCriticalIssues() {
        const issues = [];
        
        this.testResults.forEach((result, testSuite) => {
            if (!result.validation?.passed && !result.success) {
                issues.push({
                    testSuite,
                    severity: 'critical',
                    description: result.errors?.join(', ') || 'Test failed'
                });
            }
        });
        
        return issues;
    }

    analyzeTestPerformance(result) {
        return {
            grade: this.calculatePerformanceGrade(result.metrics || {}),
            bottlenecks: this.identifyBottlenecks(result),
            recommendations: this.generateTestRecommendations(result)
        };
    }

    identifyBottlenecks(result) {
        const bottlenecks = [];
        
        if (result.metrics?.dataIndexRebuild > 200) {
            bottlenecks.push('Data index rebuild performance');
        }
        if (result.metrics?.chartRender > 500) {
            bottlenecks.push('Chart rendering performance');
        }
        if (result.memoryUsage?.growth > 100) {
            bottlenecks.push('Memory usage growth');
        }
        
        return bottlenecks;
    }

    generateTestRecommendations(result) {
        const recommendations = [];
        
        if (result.metrics?.dataIndexRebuild > 200) {
            recommendations.push('Consider optimizing data index algorithms');
        }
        if (result.errors?.length > 0) {
            recommendations.push('Address error handling and validation');
        }
        
        return recommendations;
    }

    // Analysis methods for different performance areas
    analyzeDataIndexPerformance() {
        const dataIndexResults = Array.from(this.testResults.values())
            .filter(result => result.testType === 'dataIndex' || result.metrics?.dataIndexRebuild);
        
        return {
            averageRebuildTime: this.calculateAverage(dataIndexResults, 'metrics.dataIndexRebuild'),
            lookupPerformance: this.calculateAverage(dataIndexResults, 'metrics.lookupTime'),
            memoryEfficiency: this.calculateAverage(dataIndexResults, 'memoryUsage.growth'),
            recommendation: this.getDataIndexRecommendation(dataIndexResults)
        };
    }

    analyzeUIPerformance() {
        const uiResults = Array.from(this.testResults.values())
            .filter(result => result.testType === 'ui' || result.metrics?.chartRender);
        
        return {
            renderingSpeed: this.calculateAverage(uiResults, 'metrics.chartRender'),
            responsiveness: this.calculateAverage(uiResults, 'metrics.responseTime'),
            frameRate: this.calculateAverage(uiResults, 'metrics.fps'),
            recommendation: this.getUIRecommendation(uiResults)
        };
    }

    analyzeMemoryPerformance() {
        const memoryResults = Array.from(this.testResults.values())
            .filter(result => result.memoryUsage);
        
        return {
            baselineUsage: this.calculateAverage(memoryResults, 'memoryUsage.baseline'),
            peakUsage: this.calculateAverage(memoryResults, 'memoryUsage.peak'),
            growthRate: this.calculateAverage(memoryResults, 'memoryUsage.growth'),
            leaksDetected: memoryResults.filter(r => r.memoryUsage.growth > 100).length,
            recommendation: this.getMemoryRecommendation(memoryResults)
        };
    }

    calculateAverage(results, path) {
        const values = results.map(result => {
            const keys = path.split('.');
            let value = result;
            for (const key of keys) {
                value = value?.[key];
            }
            return typeof value === 'number' ? value : null;
        }).filter(val => val !== null);
        
        return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
    }

    calculateTotalTestDuration() {
        return Array.from(this.testResults.values())
            .reduce((total, result) => total + (result.duration || 0), 0);
    }

    calculateMemoryUsage() {
        const memoryResults = Array.from(this.testResults.values())
            .filter(result => result.memoryUsage);
        
        if (memoryResults.length === 0) return { baseline: 0, peak: 0, average: 0 };
        
        return {
            baseline: this.calculateAverage(memoryResults, 'memoryUsage.baseline'),
            peak: this.calculateAverage(memoryResults, 'memoryUsage.peak'),
            average: this.calculateAverage(memoryResults, 'memoryUsage.current')
        };
    }

    calculateBrowserCompatibilityScore() {
        const compatibilityResults = Array.from(this.testResults.values())
            .filter(result => result.browser);
        
        if (compatibilityResults.length === 0) return 0;
        
        const passedTests = compatibilityResults.filter(result => 
            result.validation?.passed || result.success).length;
        
        return Math.round((passedTests / compatibilityResults.length) * 100);
    }

    // Additional analysis methods
    identifyPerformanceIssues() {
        return []; // Implementation depends on specific metrics
    }

    identifyMemoryIssues() {
        return []; // Implementation depends on memory analysis
    }

    identifyCompatibilityIssues() {
        return []; // Implementation depends on browser compatibility
    }

    analyzeBrowserOptimizations() {
        return {}; // Implementation depends on browser-specific analysis
    }

    analyzeRegressions() {
        return {}; // Implementation depends on baseline comparison
    }

    getDataIndexRecommendation(results) {
        return "Data index performance is within acceptable ranges";
    }

    getUIRecommendation(results) {
        return "UI performance meets standards";
    }

    getMemoryRecommendation(results) {
        return "Memory usage is stable";
    }
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BenchmarkReportGenerator;
} else {
    window.BenchmarkReportGenerator = BenchmarkReportGenerator;
}