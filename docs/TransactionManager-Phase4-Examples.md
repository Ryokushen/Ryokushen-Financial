# TransactionManager Phase 4 - Usage Examples & Best Practices

## Table of Contents

1. [Common Use Cases](#common-use-cases)
2. [Integration Examples](#integration-examples)
3. [Performance Best Practices](#performance-best-practices)
4. [Real-World Scenarios](#real-world-scenarios)
5. [Troubleshooting Guide](#troubleshooting-guide)

## Common Use Cases

### 1. Monthly Financial Review Dashboard

Create a comprehensive monthly review with trends, anomalies, and insights:

```javascript
async function generateMonthlyReview() {
    try {
        // Get spending trends for the past 6 months
        const trends = await transactionManager.getSpendingTrends({
            months: 6,
            groupBy: 'both',
            includeAverages: true
        });
        
        // Detect any anomalies in the past month
        const anomalies = await transactionManager.detectAnomalies({
            sensitivity: 'medium',
            lookbackDays: 30
        });
        
        // Get alerts for overspending
        const alerts = await transactionManager.getSpendingAlerts({
            includedAlertTypes: ['overspending', 'category_spike'],
            lookbackDays: 30
        });
        
        // Get transaction insights
        const insights = await transactionManager.getTransactionInsights();
        
        // Generate forecast for next month
        const forecast = await transactionManager.predictMonthlySpending({
            months: 1,
            includeSeasonality: true
        });
        
        return {
            currentMonth: {
                spent: trends.summary.totalSpent,
                vsLastMonth: trends.summary.trend,
                topCategories: insights.spendingPatterns.topCategories
            },
            alerts: alerts.map(a => ({
                type: a.type,
                message: a.message,
                action: a.details
            })),
            anomalies: anomalies.filter(a => a.severity === 'high'),
            nextMonth: {
                predicted: forecast.predictions[0].total,
                confidence: forecast.predictions[0].confidenceInterval
            },
            recommendations: insights.savingsOpportunities
        };
    } catch (error) {
        console.error('Failed to generate monthly review:', error);
        throw error;
    }
}
```

### 2. Real-Time Spending Monitor

Set up a real-time monitoring system for spending alerts:

```javascript
class SpendingMonitor {
    constructor(transactionManager) {
        this.tm = transactionManager;
        this.lastCheck = new Date();
    }
    
    async checkForAlerts() {
        const alerts = await this.tm.getSpendingAlerts({
            lookbackDays: 1,
            includedAlertTypes: ['velocity', 'unusual_merchant']
        });
        
        // Filter for new alerts since last check
        const newAlerts = alerts.filter(alert => {
            return new Date(alert.timestamp) > this.lastCheck;
        });
        
        if (newAlerts.length > 0) {
            this.notifyUser(newAlerts);
        }
        
        this.lastCheck = new Date();
        return newAlerts;
    }
    
    notifyUser(alerts) {
        alerts.forEach(alert => {
            if (alert.severity === 'high') {
                // Send push notification
                console.error(`⚠️ HIGH ALERT: ${alert.message}`);
            } else {
                // Log to dashboard
                console.warn(`📊 Alert: ${alert.message}`);
            }
        });
    }
    
    // Run every hour
    startMonitoring() {
        setInterval(() => this.checkForAlerts(), 3600000);
    }
}

// Usage
const monitor = new SpendingMonitor(transactionManager);
monitor.startMonitoring();
```

### 3. Budget Tracking with Predictions

Implement intelligent budget tracking that predicts overspending:

```javascript
async function trackBudgetWithPredictions(budgets) {
    // Get current performance
    const performance = await transactionManager.getBudgetPerformance(budgets);
    
    // Get spending prediction for rest of month
    const daysLeft = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate();
    const forecast = await transactionManager.getCashFlowForecast(daysLeft);
    
    // Analyze each category
    const analysis = {};
    
    for (const [category, budget] of Object.entries(budgets)) {
        const catPerf = performance.categories[category];
        
        // Predict if will go over budget
        const projectedSpending = catPerf.projectedTotal;
        const willExceed = projectedSpending > budget;
        
        analysis[category] = {
            current: catPerf.spent,
            budget: budget,
            projected: projectedSpending,
            status: willExceed ? 'danger' : catPerf.percentage > 80 ? 'warning' : 'good',
            recommendation: catPerf.recommendation,
            adjustedDailyLimit: willExceed ? 
                (budget - catPerf.spent) / daysLeft : 
                null
        };
    }
    
    return {
        analysis,
        overall: performance.overall,
        cashFlowImpact: forecast.summary
    };
}

// Usage
const budgetAnalysis = await trackBudgetWithPredictions({
    'Food': 800,
    'Entertainment': 200,
    'Transportation': 150,
    'Shopping': 300
});

// Display warnings
Object.entries(budgetAnalysis.analysis).forEach(([category, data]) => {
    if (data.status === 'danger') {
        console.error(`🚨 ${category}: Projected to exceed budget by $${(data.projected - data.budget).toFixed(2)}`);
        console.log(`   Recommendation: ${data.recommendation}`);
    }
});
```

### 4. Merchant Analysis for Loyalty Programs

Identify merchants for potential savings through loyalty programs:

```javascript
async function analyzeLoyaltyOpportunities() {
    // Get merchant analysis
    const merchants = await transactionManager.getMerchantAnalysis({
        months: 6,
        minTransactions: 4,
        limit: 50
    });
    
    // Get insights for loyalty patterns
    const insights = await transactionManager.getTransactionInsights();
    
    // Identify loyalty opportunities
    const opportunities = merchants.merchants
        .filter(m => m.frequency === 'weekly' || m.frequency === 'biweekly')
        .map(merchant => {
            const monthlySpend = merchant.total / 6;
            const potentialSavings = monthlySpend * 0.05; // Assume 5% rewards
            
            return {
                merchant: merchant.name,
                monthlySpend,
                yearlySpend: monthlySpend * 12,
                frequency: merchant.frequency,
                potentialSavings: potentialSavings * 12,
                recommendation: `Consider ${merchant.name} loyalty program for ~$${(potentialSavings * 12).toFixed(2)}/year savings`
            };
        })
        .sort((a, b) => b.potentialSavings - a.potentialSavings);
    
    return {
        opportunities: opportunities.slice(0, 5), // Top 5
        totalPotentialSavings: opportunities.reduce((sum, o) => sum + o.potentialSavings, 0),
        loyalMerchants: insights.merchantInsights.loyalMerchants
    };
}

// Usage
const loyalty = await analyzeLoyaltyOpportunities();
console.log(`💳 Total potential savings: $${loyalty.totalPotentialSavings.toFixed(2)}/year`);
loyalty.opportunities.forEach(opp => {
    console.log(`- ${opp.recommendation}`);
});
```

## Integration Examples

### 1. Integrating with Dashboard UI

```javascript
// dashboard.js
import { transactionManager } from './transactionManager.js';

class AnalyticsDashboard {
    constructor() {
        this.charts = {};
        this.refreshInterval = 300000; // 5 minutes
    }
    
    async initialize() {
        // Load initial data
        await this.refreshAllWidgets();
        
        // Set up auto-refresh
        setInterval(() => this.refreshAllWidgets(), this.refreshInterval);
        
        // Set up real-time alerts
        this.setupAlertListener();
    }
    
    async refreshAllWidgets() {
        try {
            // Update spending trends chart
            const trends = await transactionManager.getSpendingTrends({
                months: 6,
                groupBy: 'month'
            });
            this.updateTrendsChart(trends);
            
            // Update category breakdown
            const categoryData = await transactionManager.getSpendingTrends({
                months: 1,
                groupBy: 'category'
            });
            this.updateCategoryPieChart(categoryData);
            
            // Update anomalies widget
            const anomalies = await transactionManager.detectAnomalies({
                lookbackDays: 7,
                sensitivity: 'medium'
            });
            this.updateAnomaliesWidget(anomalies);
            
            // Update performance metrics
            const metrics = transactionManager.getPerformanceMetrics();
            this.updatePerformanceWidget(metrics);
            
        } catch (error) {
            console.error('Dashboard refresh failed:', error);
            this.showError('Failed to update dashboard');
        }
    }
    
    setupAlertListener() {
        // Check for alerts every minute
        setInterval(async () => {
            const alerts = await transactionManager.getSpendingAlerts({
                lookbackDays: 1,
                includedAlertTypes: ['velocity', 'overspending']
            });
            
            alerts.forEach(alert => {
                if (alert.severity === 'high') {
                    this.showNotification(alert);
                }
            });
        }, 60000);
    }
    
    updateTrendsChart(data) {
        // Update Chart.js instance
        if (this.charts.trends) {
            this.charts.trends.data.labels = data.monthlyData.map(m => m.month);
            this.charts.trends.data.datasets[0].data = data.monthlyData.map(m => m.total);
            this.charts.trends.update();
        }
    }
    
    showNotification(alert) {
        // Show browser notification
        if (Notification.permission === 'granted') {
            new Notification('Spending Alert', {
                body: alert.message,
                icon: '/icons/alert.png',
                tag: alert.type
            });
        }
    }
}
```

### 2. Integrating with Smart Rules

```javascript
// smartRulesIntegration.js
async function setupSmartRulesFromRecommendations() {
    // Get recommendations
    const recommendations = await transactionManager.getSmartRuleRecommendations();
    
    // Evaluate existing rules
    const effectiveness = await transactionManager.evaluateRuleEffectiveness();
    
    // Disable ineffective rules
    for (const rule of effectiveness.rules) {
        if (rule.effectiveness === 'unused' && rule.matches === 0) {
            await database.updateSmartRule(rule.id, { enabled: false });
            console.log(`Disabled ineffective rule: ${rule.name}`);
        }
    }
    
    // Create high-confidence rules automatically
    for (const rec of recommendations) {
        if (rec.confidence >= 0.90) {
            const existingRule = await findSimilarRule(rec.rule);
            
            if (!existingRule) {
                await database.createSmartRule({
                    ...rec.rule,
                    enabled: true,
                    autoCreated: true,
                    confidence: rec.confidence
                });
                console.log(`Created rule: ${rec.rule.name}`);
            }
        }
    }
    
    return {
        created: recommendations.filter(r => r.confidence >= 0.90).length,
        disabled: effectiveness.rules.filter(r => r.effectiveness === 'unused').length
    };
}
```

### 3. Integrating with Voice Assistant

```javascript
// voiceAssistant.js
class FinancialVoiceAssistant {
    constructor(transactionManager) {
        this.tm = transactionManager;
    }
    
    async processCommand(command) {
        const intent = this.parseIntent(command);
        
        switch (intent.type) {
            case 'spending_summary':
                return await this.getSpendingSummary(intent.params);
                
            case 'anomaly_check':
                return await this.checkAnomalies();
                
            case 'budget_status':
                return await this.getBudgetStatus(intent.params);
                
            case 'prediction':
                return await this.getPrediction(intent.params);
                
            default:
                return "I didn't understand that command.";
        }
    }
    
    async getSpendingSummary(params) {
        const trends = await this.tm.getSpendingTrends({
            months: 1,
            categories: params.category ? [params.category] : undefined
        });
        
        const total = trends.summary.totalSpent;
        const category = params.category || 'all categories';
        
        return `You've spent $${total.toFixed(2)} on ${category} this month.`;
    }
    
    async checkAnomalies() {
        const anomalies = await this.tm.detectAnomalies({
            lookbackDays: 7,
            sensitivity: 'high'
        });
        
        if (anomalies.length === 0) {
            return "No unusual transactions detected this week.";
        }
        
        const highSeverity = anomalies.filter(a => a.severity === 'high');
        return `I found ${anomalies.length} unusual transactions, ${highSeverity.length} of high concern.`;
    }
    
    async getBudgetStatus(params) {
        const performance = await this.tm.getBudgetPerformance(params.budgets);
        const overBudget = Object.values(performance.categories)
            .filter(c => c.status === 'over')
            .map(c => c.category);
        
        if (overBudget.length === 0) {
            return "All spending categories are within budget.";
        }
        
        return `You're over budget in: ${overBudget.join(', ')}`;
    }
}
```

## Performance Best Practices

### 1. Optimize Cache Usage

```javascript
// Cache warming strategy
async function warmAnalyticsCache() {
    console.log('Warming analytics cache...');
    
    // Pre-load commonly used analytics during off-peak hours
    const warmupTasks = [
        transactionManager.getSpendingTrends({ months: 6, groupBy: 'both' }),
        transactionManager.getTransactionInsights(),
        transactionManager.getMerchantAnalysis({ months: 3 })
    ];
    
    await Promise.all(warmupTasks);
    console.log('Cache warmed successfully');
}

// Schedule cache warming
function scheduleOptimization() {
    // Run at 3 AM daily
    const now = new Date();
    const night = new Date(now);
    night.setHours(3, 0, 0, 0);
    
    if (night <= now) {
        night.setDate(night.getDate() + 1);
    }
    
    const msToNight = night.getTime() - now.getTime();
    
    setTimeout(async () => {
        await warmAnalyticsCache();
        await transactionManager.optimizePerformance();
        
        // Schedule next run
        setInterval(async () => {
            await warmAnalyticsCache();
            await transactionManager.optimizePerformance();
        }, 24 * 60 * 60 * 1000);
    }, msToNight);
}
```

### 2. Batch Analytics Requests

```javascript
// Efficient dashboard loading
async function loadDashboardEfficiently() {
    // Batch all analytics requests
    const [trends, insights, anomalies, forecast, quality] = await Promise.all([
        transactionManager.getSpendingTrends({ months: 6 }),
        transactionManager.getTransactionInsights(),
        transactionManager.detectAnomalies({ lookbackDays: 30 }),
        transactionManager.getCashFlowForecast(30),
        transactionManager.getDataQualityReport()
    ]);
    
    return {
        trends,
        insights,
        anomalies: anomalies.filter(a => a.severity === 'high'),
        forecast: forecast.summary,
        dataQuality: quality.quality.score
    };
}
```

### 3. Progressive Loading for Large Datasets

```javascript
// Progressive merchant analysis
async function progressiveMerchantAnalysis(callback) {
    // Start with recent data
    let merchants = await transactionManager.getMerchantAnalysis({
        months: 1,
        limit: 10
    });
    callback(merchants); // Quick initial load
    
    // Load more historical data
    merchants = await transactionManager.getMerchantAnalysis({
        months: 3,
        limit: 20
    });
    callback(merchants); // Update with more data
    
    // Full analysis
    merchants = await transactionManager.getMerchantAnalysis({
        months: 6,
        limit: 50
    });
    callback(merchants); // Final complete data
}
```

### 4. Error Handling and Fallbacks

```javascript
class ResilientAnalytics {
    constructor(transactionManager) {
        this.tm = transactionManager;
        this.fallbackCache = new Map();
    }
    
    async getSpendingTrendsWithFallback(options) {
        try {
            const result = await this.tm.getSpendingTrends(options);
            // Cache successful result
            this.fallbackCache.set('spending_trends', {
                data: result,
                timestamp: Date.now()
            });
            return result;
        } catch (error) {
            console.error('Failed to get spending trends:', error);
            
            // Check fallback cache
            const cached = this.fallbackCache.get('spending_trends');
            if (cached && Date.now() - cached.timestamp < 3600000) {
                console.log('Using cached data');
                return cached.data;
            }
            
            // Return degraded response
            return {
                monthlyData: [],
                summary: {
                    error: 'Unable to load current data',
                    cached: false
                }
            };
        }
    }
}
```

## Real-World Scenarios

### 1. End-of-Month Financial Report

```javascript
async function generateMonthEndReport() {
    const report = {
        generated: new Date().toISOString(),
        month: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    };
    
    // Spending overview
    const spending = await transactionManager.getSpendingTrends({
        months: 1,
        groupBy: 'category'
    });
    report.totalSpent = spending.summary.totalSpent;
    report.categories = spending.categoryData;
    
    // Compare to previous month
    const comparison = await transactionManager.getSpendingTrends({
        months: 2,
        groupBy: 'month'
    });
    report.vsLastMonth = {
        amount: comparison.monthlyData[0].total - comparison.monthlyData[1].total,
        percentage: ((comparison.monthlyData[0].total / comparison.monthlyData[1].total) - 1) * 100
    };
    
    // Anomalies and alerts
    const anomalies = await transactionManager.detectAnomalies({
        lookbackDays: 30
    });
    report.unusualTransactions = anomalies.length;
    report.topAnomalies = anomalies.slice(0, 3);
    
    // Budget performance
    const budgets = { /* user's budgets */ };
    const performance = await transactionManager.getBudgetPerformance(budgets);
    report.budgetAdherence = performance.overall;
    
    // Next month forecast
    const forecast = await transactionManager.predictMonthlySpending({
        months: 1
    });
    report.nextMonthPrediction = forecast.predictions[0];
    
    // Insights and recommendations
    const insights = await transactionManager.getTransactionInsights();
    report.insights = insights.savingsOpportunities;
    
    // Data quality
    const quality = await transactionManager.getDataQualityReport();
    report.dataQuality = quality.quality;
    
    return report;
}
```

### 2. Tax Preparation Helper

```javascript
async function prepareTaxData(year) {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    
    // Get all transactions for the year
    const transactions = await transactionManager.searchTransactions({
        dateRange: { start: startDate, end: endDate }
    });
    
    // Categorize for tax purposes
    const taxCategories = {
        income: [],
        businessExpenses: [],
        medicalExpenses: [],
        charitableDonations: [],
        homeOffice: [],
        other: []
    };
    
    // Map spending categories to tax categories
    const categoryMapping = {
        'Income': 'income',
        'Business': 'businessExpenses',
        'Medical': 'medicalExpenses',
        'Charity': 'charitableDonations',
        'Home Office': 'homeOffice'
    };
    
    transactions.results.forEach(transaction => {
        const taxCategory = categoryMapping[transaction.category] || 'other';
        taxCategories[taxCategory].push(transaction);
    });
    
    // Calculate totals
    const summary = {};
    for (const [category, trans] of Object.entries(taxCategories)) {
        summary[category] = {
            count: trans.length,
            total: trans.reduce((sum, t) => sum + Math.abs(t.amount), 0),
            transactions: trans
        };
    }
    
    // Get merchant analysis for business expenses
    if (summary.businessExpenses.count > 0) {
        const merchants = await transactionManager.getMerchantAnalysis({
            months: 12
        });
        summary.businessExpenses.topMerchants = merchants.merchants
            .filter(m => {
                return summary.businessExpenses.transactions
                    .some(t => t.description.includes(m.name));
            })
            .slice(0, 10);
    }
    
    // Detect potential missing receipts
    const anomalies = await transactionManager.detectAnomalies({
        lookbackDays: 365,
        sensitivity: 'low'
    });
    summary.largeTransactions = anomalies
        .filter(a => Math.abs(a.transaction.amount) > 500)
        .map(a => a.transaction);
    
    return {
        year,
        summary,
        exportUrl: `/api/export/tax-data/${year}`
    };
}
```

### 3. Financial Goal Tracking

```javascript
class GoalTracker {
    constructor(transactionManager) {
        this.tm = transactionManager;
    }
    
    async trackSavingsGoal(targetAmount, targetDate, currentSaved = 0) {
        // Calculate months until target
        const monthsRemaining = Math.ceil(
            (new Date(targetDate) - new Date()) / (30 * 24 * 60 * 60 * 1000)
        );
        
        // Get spending trends to calculate average savings
        const trends = await this.tm.getSpendingTrends({ months: 6 });
        const insights = await this.tm.getTransactionInsights();
        
        // Calculate average monthly savings
        const avgIncome = trends.monthlyData.reduce((sum, m) => {
            return sum + (m.income || 0);
        }, 0) / trends.monthlyData.length;
        
        const avgExpenses = trends.summary.monthlyAverage;
        const avgMonthlySavings = avgIncome - avgExpenses;
        
        // Predict if goal is achievable
        const projectedSavings = currentSaved + (avgMonthlySavings * monthsRemaining);
        const onTrack = projectedSavings >= targetAmount;
        
        // Get recommendations to increase savings
        const recommendations = [];
        
        if (!onTrack) {
            const additionalNeeded = (targetAmount - projectedSavings) / monthsRemaining;
            
            // Find categories to cut
            insights.savingsOpportunities.forEach(opp => {
                if (opp.potential >= additionalNeeded * 0.2) {
                    recommendations.push({
                        action: `Reduce ${opp.category} spending`,
                        impact: opp.potential,
                        suggestion: opp.suggestion
                    });
                }
            });
            
            // Suggest Smart Rules
            const ruleRecs = await this.tm.getSmartRuleRecommendations();
            ruleRecs
                .filter(r => r.type === 'alert' && r.confidence > 0.8)
                .forEach(r => {
                    recommendations.push({
                        action: 'Create spending alert',
                        impact: 'Prevent overspending',
                        suggestion: `Set up rule: ${r.rule.name}`
                    });
                });
        }
        
        return {
            goal: {
                target: targetAmount,
                current: currentSaved,
                remaining: targetAmount - currentSaved,
                deadline: targetDate,
                monthsLeft: monthsRemaining
            },
            projection: {
                onTrack,
                projectedTotal: projectedSavings,
                monthlyRequired: (targetAmount - currentSaved) / monthsRemaining,
                currentMonthlySavings: avgMonthlySavings,
                gap: onTrack ? 0 : additionalNeeded
            },
            recommendations: recommendations.slice(0, 5)
        };
    }
}
```

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. Slow Performance

```javascript
// Diagnose performance issues
async function diagnosePerformance() {
    const metrics = transactionManager.getPerformanceMetrics();
    
    console.log('Performance Diagnostics:');
    console.log(`Cache hit rate: ${metrics.cache.hitRate}%`);
    console.log(`Memory usage: ${metrics.memory.totalMemory}`);
    console.log(`Error rate: ${metrics.operations.errorRate}%`);
    
    if (metrics.cache.hitRate < 50) {
        console.warn('Low cache hit rate detected');
        await transactionManager.optimizePerformance();
    }
    
    if (parseFloat(metrics.memory.totalMemory) > 50) {
        console.warn('High memory usage detected');
        // Clear old cache entries
        await transactionManager.optimizePerformance();
    }
    
    return metrics;
}
```

#### 2. Inaccurate Predictions

```javascript
// Validate prediction accuracy
async function validatePredictions() {
    // Get last month's prediction
    const lastMonthPrediction = await transactionManager.predictMonthlySpending({
        months: 1,
        baseDate: new Date(new Date().setMonth(new Date().getMonth() - 1))
    });
    
    // Get actual spending
    const actualSpending = await transactionManager.getSpendingTrends({
        months: 1
    });
    
    const accuracy = 1 - Math.abs(
        (lastMonthPrediction.predictions[0].total - actualSpending.summary.totalSpent) / 
        actualSpending.summary.totalSpent
    );
    
    console.log(`Prediction accuracy: ${(accuracy * 100).toFixed(1)}%`);
    
    if (accuracy < 0.8) {
        console.warn('Low prediction accuracy. Consider:');
        console.log('- Checking for missing transactions');
        console.log('- Reviewing data quality');
        console.log('- Adjusting seasonality settings');
    }
    
    return accuracy;
}
```

#### 3. Missing Anomalies

```javascript
// Tune anomaly detection sensitivity
async function tuneAnomalyDetection() {
    const sensitivities = ['low', 'medium', 'high'];
    const results = {};
    
    for (const sensitivity of sensitivities) {
        const anomalies = await transactionManager.detectAnomalies({
            sensitivity,
            lookbackDays: 30
        });
        
        results[sensitivity] = {
            count: anomalies.length,
            highSeverity: anomalies.filter(a => a.severity === 'high').length,
            examples: anomalies.slice(0, 3)
        };
    }
    
    console.log('Anomaly Detection Tuning:');
    console.log(JSON.stringify(results, null, 2));
    
    // Recommend sensitivity based on results
    if (results.high.count > 50) {
        console.log('Recommendation: Use "medium" sensitivity to reduce false positives');
    } else if (results.low.count < 5) {
        console.log('Recommendation: Use "medium" or "high" sensitivity to catch more anomalies');
    }
    
    return results;
}
```

### Performance Monitoring Script

```javascript
// Complete performance monitoring solution
class PerformanceMonitor {
    constructor(transactionManager) {
        this.tm = transactionManager;
        this.history = [];
    }
    
    async runDiagnostics() {
        const report = {
            timestamp: new Date().toISOString(),
            metrics: this.tm.getPerformanceMetrics(),
            tests: {}
        };
        
        // Test response times
        const startTime = Date.now();
        await this.tm.getSpendingTrends({ months: 1 });
        report.tests.trendResponseTime = Date.now() - startTime;
        
        // Test cache effectiveness
        const cache1 = Date.now();
        await this.tm.getSpendingTrends({ months: 1 }); // Should hit cache
        report.tests.cacheResponseTime = Date.now() - cache1;
        
        // Test data quality
        const quality = await this.tm.getDataQualityReport();
        report.tests.dataQuality = quality.quality.score;
        
        // Store history
        this.history.push(report);
        if (this.history.length > 100) {
            this.history.shift();
        }
        
        // Analyze trends
        if (this.history.length > 10) {
            const recent = this.history.slice(-10);
            const avgResponseTime = recent.reduce((sum, r) => 
                sum + r.tests.trendResponseTime, 0) / recent.length;
            
            report.trends = {
                avgResponseTime,
                cacheHitTrend: this.calculateTrend('metrics.cache.hitRate'),
                qualityTrend: this.calculateTrend('tests.dataQuality')
            };
        }
        
        return report;
    }
    
    calculateTrend(path) {
        const values = this.history.slice(-10).map(h => 
            path.split('.').reduce((obj, key) => obj[key], h)
        );
        
        const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
        const recent = values.slice(-3).reduce((sum, v) => sum + v, 0) / 3;
        
        return {
            direction: recent > avg ? 'improving' : recent < avg ? 'degrading' : 'stable',
            change: ((recent - avg) / avg * 100).toFixed(1) + '%'
        };
    }
}
```

---

*Last Updated: 2025-01-27*
*Version: 1.0.0*