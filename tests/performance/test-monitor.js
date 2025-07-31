#!/usr/bin/env node

/**
 * Real-time P0 Test Monitor
 * Monitors test execution and provides live feedback
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

class P0TestMonitor {
    constructor() {
        this.results = {
            startTime: Date.now(),
            tests: {},
            currentTest: null,
            overallStatus: 'STARTING',
            errors: [],
            warnings: []
        };
        this.browser = null;
        this.page = null;
    }

    async startMonitoring() {
        console.log('🔍 Starting P0 Test Monitoring...\n');
        
        try {
            // Launch browser for monitoring
            this.browser = await puppeteer.launch({
                headless: false, // Visible for manual interaction
                devtools: true,  // Open devtools
                args: ['--start-maximized']
            });

            this.page = await this.browser.newPage();
            await this.page.setViewport({ width: 1920, height: 1080 });

            // Set up console monitoring
            this.page.on('console', msg => {
                const text = msg.text();
                if (text.includes('Test') || text.includes('Performance') || text.includes('Error')) {
                    console.log(`📝 Console: ${text}`);
                }
            });

            // Set up error monitoring
            this.page.on('pageerror', err => {
                console.log(`❌ Page Error: ${err.message}`);
                this.results.errors.push(err.message);
            });

            // Navigate to test page
            console.log('🌐 Loading P0 Critical Path Tests...');
            await this.page.goto('http://localhost:8080/tests/performance/critical-path-tests.html', {
                waitUntil: 'networkidle0'
            });

            console.log('✅ Test page loaded successfully\n');
            
            // Start monitoring loop
            await this.monitorTestExecution();

        } catch (error) {
            console.error('❌ Monitoring failed:', error.message);
        }
    }

    async monitorTestExecution() {
        console.log('📊 Monitoring Dashboard Active');
        console.log('=' .repeat(60));
        
        let lastStatus = '';
        let monitoringActive = true;
        
        while (monitoringActive) {
            try {
                // Get current test status
                const status = await this.page.evaluate(() => {
                    const getTestStatus = (testId) => {
                        const element = document.getElementById(testId);
                        return element ? element.textContent.trim() : 'UNKNOWN';
                    };

                    const getMetric = (metricId) => {
                        const element = document.getElementById(metricId);
                        return element ? element.textContent.trim() : '0';
                    };

                    return {
                        test1: getTestStatus('test1-status'),
                        test2: getTestStatus('test2-status'),
                        test3: getTestStatus('test3-status'),
                        test4: getTestStatus('test4-status'),
                        test5: getTestStatus('test5-status'),
                        testsP: getMetric('tests-passed'),
                        testsF: getMetric('tests-failed'),
                        avgPerf: getMetric('avg-performance'),
                        memory: getMetric('memory-usage'),
                        progress: this.getProgressPercent()
                    };
                });

                // Check if status changed
                const currentStatus = JSON.stringify(status);
                if (currentStatus !== lastStatus) {
                    this.displayStatus(status);
                    lastStatus = currentStatus;
                }

                // Check for completion
                const allCompleted = Object.values(status).slice(0, 5).every(
                    test => test === 'PASS' || test === 'FAIL'
                );

                if (allCompleted) {
                    await this.generateFinalReport(status);
                    monitoringActive = false;
                }

                // Wait before next check
                await new Promise(resolve => setTimeout(resolve, 2000));

            } catch (error) {
                console.error('⚠️  Monitoring error:', error.message);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    getProgressPercent() {
        try {
            return document.getElementById('overall-progress')?.style.width || '0%';
        } catch {
            return '0%';
        }
    }

    displayStatus(status) {
        console.clear();
        console.log('🔍 P0 Critical Path Tests - Live Monitoring');
        console.log('=' .repeat(60));
        console.log();

        // Overall metrics
        console.log('📈 Overall Metrics:');
        console.log(`   Progress: ${status.progress || '0%'}`);
        console.log(`   Tests Passed: ${status.testsP}`);
        console.log(`   Tests Failed: ${status.testsF}`);
        console.log(`   Avg Performance: ${status.avgPerf}`);
        console.log(`   Memory Usage: ${status.memory}`);
        console.log();

        // Individual test status
        console.log('🧪 Test Status:');
        const tests = [
            { name: 'Data Index Performance', status: status.test1, id: 'test1' },
            { name: 'Transaction Rendering', status: status.test2, id: 'test2' },
            { name: 'Form Utilities', status: status.test3, id: 'test3' },
            { name: 'Chart Performance', status: status.test4, id: 'test4' },
            { name: 'Core Workflows', status: status.test5, id: 'test5' }
        ];

        tests.forEach((test, index) => {
            const icon = this.getStatusIcon(test.status);
            const statusColor = this.getStatusColor(test.status);
            console.log(`   ${index + 1}. ${test.name}: ${icon} ${statusColor}${test.status}\x1b[0m`);
        });

        console.log();
        
        // Current activity
        const runningTest = tests.find(t => t.status === 'RUNNING');
        if (runningTest) {
            console.log(`🏃 Currently Running: ${runningTest.name}`);
        } else {
            console.log('⏳ Waiting for test execution...');
        }

        console.log();
        console.log('💡 Manual Controls Available in Browser Window');
        console.log('   - Click test buttons to start individual tests');
        console.log('   - Monitor real-time metrics in the dashboard');
        console.log('   - View detailed results in test sections');
        console.log();
    }

    getStatusIcon(status) {
        switch (status) {
            case 'PASS': return '✅';
            case 'FAIL': return '❌';
            case 'RUNNING': return '🏃';
            case 'PENDING': return '⏳';
            default: return '❓';
        }
    }

    getStatusColor(status) {
        switch (status) {
            case 'PASS': return '\x1b[32m';     // Green
            case 'FAIL': return '\x1b[31m';     // Red
            case 'RUNNING': return '\x1b[33m';  // Yellow
            case 'PENDING': return '\x1b[36m';  // Cyan
            default: return '\x1b[37m';         // White
        }
    }

    async generateFinalReport(status) {
        console.log('\n🏁 P0 Tests Completed - Generating Final Report...\n');

        const passCount = Object.values(status).slice(0, 5).filter(s => s === 'PASS').length;
        const failCount = Object.values(status).slice(0, 5).filter(s => s === 'FAIL').length;
        const successRate = (passCount / 5) * 100;

        // Generate report
        const report = {
            timestamp: new Date().toISOString(),
            duration: Date.now() - this.results.startTime,
            successRate,
            passCount,
            failCount,
            metrics: {
                avgPerformance: status.avgPerf,
                memoryUsage: status.memory
            },
            testResults: {
                dataIndex: status.test1,
                transactions: status.test2,
                formUtils: status.test3,
                charts: status.test4,
                workflows: status.test5
            },
            overallStatus: successRate === 100 ? 'PASS' : 'FAIL',
            recommendation: this.getRecommendation(successRate, status)
        };

        // Display final results
        this.displayFinalReport(report);

        // Save report
        fs.writeFileSync('p0-test-results.json', JSON.stringify(report, null, 2));
        console.log('💾 Detailed results saved to: p0-test-results.json\n');

        return report;
    }

    displayFinalReport(report) {
        console.log('🎯 P0 CRITICAL PATH TESTS - FINAL REPORT');
        console.log('=' .repeat(60));
        console.log();

        // Overall result
        const statusIcon = report.overallStatus === 'PASS' ? '✅' : '❌';
        const statusColor = report.overallStatus === 'PASS' ? '\x1b[32m' : '\x1b[31m';
        console.log(`${statusIcon} Overall Status: ${statusColor}${report.overallStatus}\x1b[0m`);
        console.log(`📊 Success Rate: ${report.successRate}%`);
        console.log(`⏱️  Total Duration: ${(report.duration / 1000).toFixed(1)}s`);
        console.log();

        // Test breakdown
        console.log('📋 Test Results:');
        Object.entries(report.testResults).forEach(([test, status]) => {
            const icon = this.getStatusIcon(status);
            const color = this.getStatusColor(status);
            console.log(`   ${icon} ${test}: ${color}${status}\x1b[0m`);
        });
        console.log();

        // Performance metrics
        console.log('⚡ Performance Metrics:');
        console.log(`   Average Performance: ${report.metrics.avgPerformance}`);
        console.log(`   Memory Usage: ${report.metrics.memoryUsage}`);
        console.log();

        // Recommendation
        console.log('🎯 Recommendation:');
        console.log(`   ${report.recommendation}`);
        console.log();

        // Deployment readiness
        if (report.overallStatus === 'PASS') {
            console.log('🚀 DEPLOYMENT READY: All P0 tests passed');
        } else {
            console.log('🚫 DEPLOYMENT BLOCKED: P0 test failures detected');
        }
        console.log();
    }

    getRecommendation(successRate, status) {
        if (successRate === 100) {
            return 'All P0 tests passed. Performance optimizations are working correctly. Ready for production deployment.';
        } else if (successRate >= 80) {
            return 'Most tests passed but some issues detected. Review failed tests and address performance bottlenecks before deployment.';
        } else {
            return 'Critical failures detected. Do not deploy. Investigate and fix all failing tests before proceeding.';
        }
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}

// Start monitoring if running directly
if (require.main === module) {
    const monitor = new P0TestMonitor();
    
    process.on('SIGINT', async () => {
        console.log('\n🛑 Monitoring stopped by user');
        await monitor.cleanup();
        process.exit(0);
    });

    monitor.startMonitoring().catch(error => {
        console.error('❌ Monitoring failed:', error);
        process.exit(1);
    });
}

module.exports = P0TestMonitor;