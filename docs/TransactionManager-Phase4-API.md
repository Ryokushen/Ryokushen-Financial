# TransactionManager Phase 4 API Documentation

## Overview

TransactionManager Phase 4 introduces powerful analytics and insights capabilities to the Ryokushen Financial application. This phase includes spending trend analysis, anomaly detection, predictive analytics, performance optimization, and Smart Rules integration.

## Table of Contents

1. [Core Analytics Methods](#core-analytics-methods)
2. [Anomaly Detection & Predictive Analytics](#anomaly-detection--predictive-analytics)
3. [Performance & Integration](#performance--integration)
4. [Helper Methods](#helper-methods)
5. [Console Testing](#console-testing)
6. [Error Handling](#error-handling)

## Core Analytics Methods

### getSpendingTrends(options)

Analyzes spending patterns across multiple dimensions with caching support.

#### Parameters
- `options` (Object): Configuration options
  - `months` (Number): Number of months to analyze (default: 6)
  - `categories` (Array<String>): Filter by specific categories (optional)
  - `groupBy` (String): Grouping dimension - 'month', 'category', or 'both' (default: 'month')
  - `includeAverages` (Boolean): Include average calculations (default: true)
  - `excludeTransfers` (Boolean): Exclude transfer transactions (default: true)

#### Returns
Promise<Object> with structure based on `groupBy`:
- `month`: `{ monthlyData, summary }`
- `category`: `{ categoryData, summary }`
- `both`: `{ monthlyData, categoryData, summary }`

#### Example
```javascript
const trends = await transactionManager.getSpendingTrends({
    months: 12,
    categories: ['Food', 'Entertainment'],
    groupBy: 'both',
    includeAverages: true
});

// Result structure:
{
    monthlyData: [
        {
            month: '2025-01',
            total: 2500.50,
            count: 45,
            categories: {
                'Food': { amount: 800.00, count: 25 },
                'Entertainment': { amount: 300.00, count: 5 }
            }
        }
        // ... more months
    ],
    categoryData: {
        'Food': {
            total: 4800.00,
            average: 800.00,
            count: 150,
            trend: 'increasing'
        },
        'Entertainment': {
            total: 1800.00,
            average: 300.00,
            count: 30,
            trend: 'stable'
        }
    },
    summary: {
        totalSpent: 15000.00,
        monthlyAverage: 2500.00,
        highestMonth: { month: '2025-01', amount: 3200.00 },
        lowestMonth: { month: '2024-12', amount: 1800.00 },
        trend: 'decreasing'
    }
}
```

### getCategoryTrends(categoryName, months)

Provides detailed analysis for a specific spending category including outlier detection.

#### Parameters
- `categoryName` (String): The category to analyze
- `months` (Number): Number of months to analyze (default: 6)

#### Returns
Promise<Object> containing:
- `monthly`: Array of monthly spending data
- `statistics`: Statistical analysis (mean, median, stdDev, outliers)
- `merchants`: Top merchants in category
- `patterns`: Detected spending patterns
- `forecast`: Simple forecast for next month

#### Example
```javascript
const foodTrends = await transactionManager.getCategoryTrends('Food', 6);

// Result:
{
    monthly: [
        { month: '2025-01', amount: 850.00, count: 28, isOutlier: false }
        // ... more months
    ],
    statistics: {
        mean: 800.00,
        median: 825.00,
        stdDev: 125.50,
        min: 650.00,
        max: 1050.00,
        outliers: []
    },
    merchants: [
        { name: 'Whole Foods', total: 1200.00, count: 15, avgTransaction: 80.00 },
        { name: 'Starbucks', total: 450.00, count: 30, avgTransaction: 15.00 }
    ],
    patterns: {
        trend: 'stable',
        seasonality: false,
        avgTransactionSize: 32.00,
        frequencyPerMonth: 28
    },
    forecast: {
        nextMonth: 825.00,
        confidence: 0.85
    }
}
```

### getMerchantAnalysis(options)

Analyzes spending patterns by merchant with categorization insights.

#### Parameters
- `options` (Object): Configuration options
  - `months` (Number): Months to analyze (default: 6)
  - `minTransactions` (Number): Minimum transactions to include (default: 2)
  - `limit` (Number): Maximum merchants to return (default: 20)

#### Returns
Promise<Object> containing:
- `merchants`: Array of merchant analysis data
- `summary`: Overall merchant statistics

#### Example
```javascript
const merchants = await transactionManager.getMerchantAnalysis({
    months: 3,
    minTransactions: 5,
    limit: 10
});

// Result:
{
    merchants: [
        {
            name: 'Amazon',
            total: 1250.00,
            count: 15,
            avgTransaction: 83.33,
            categories: ['Shopping', 'Entertainment'],
            firstSeen: '2024-11-15',
            lastSeen: '2025-01-26',
            frequency: 'weekly'
        }
        // ... more merchants
    ],
    summary: {
        totalMerchants: 45,
        totalSpent: 8500.00,
        avgPerMerchant: 188.89,
        topCategory: 'Shopping'
    }
}
```

## Anomaly Detection & Predictive Analytics

### detectAnomalies(options)

Detects unusual transactions using multiple statistical methods.

#### Parameters
- `options` (Object): Detection configuration
  - `sensitivity` (String): 'low', 'medium', or 'high' (default: 'medium')
  - `lookbackDays` (Number): Days to analyze (default: 90)
  - `methods` (Array<String>): Detection methods - 'zscore', 'iqr', 'frequency' (default: all)

#### Returns
Promise<Array> of anomalies with:
- `transaction`: The anomalous transaction
- `reason`: Why it's flagged
- `severity`: 'low', 'medium', or 'high'
- `details`: Method-specific details

#### Example
```javascript
const anomalies = await transactionManager.detectAnomalies({
    sensitivity: 'medium',
    lookbackDays: 60,
    methods: ['zscore', 'iqr']
});

// Result:
[
    {
        transaction: { id: '123', amount: -500.00, description: 'Electronics Store' },
        reason: 'Amount is 3.2 standard deviations above average',
        severity: 'high',
        details: {
            method: 'zscore',
            zscore: 3.2,
            categoryAverage: 85.00,
            categoryStdDev: 45.00
        }
    }
]
```

### getSpendingAlerts(options)

Generates real-time spending alerts based on patterns and thresholds.

#### Parameters
- `options` (Object): Alert configuration
  - `includedAlertTypes` (Array<String>): Types to check - 'overspending', 'unusual_merchant', 'category_spike', 'velocity' (default: all)
  - `lookbackDays` (Number): Days to analyze (default: 30)
  - `thresholds` (Object): Custom thresholds per type

#### Returns
Promise<Array> of alerts with type-specific information.

#### Example
```javascript
const alerts = await transactionManager.getSpendingAlerts({
    includedAlertTypes: ['overspending', 'velocity'],
    lookbackDays: 7
});

// Result:
[
    {
        type: 'overspending',
        severity: 'high',
        message: 'Food spending is 156% of monthly average',
        details: {
            category: 'Food',
            currentSpending: 1250.00,
            monthlyAverage: 800.00,
            percentageOver: 56
        }
    },
    {
        type: 'velocity',
        severity: 'medium',
        message: 'High transaction frequency detected',
        details: {
            merchant: 'Coffee Shop',
            transactionCount: 8,
            timeWindow: '24 hours',
            totalAmount: 65.00
        }
    }
]
```

### predictMonthlySpending(options)

Predicts future spending using linear regression with seasonal adjustments.

#### Parameters
- `options` (Object): Prediction configuration
  - `months` (Number): Months to predict (default: 3)
  - `confidence` (Number): Confidence interval (default: 0.95)
  - `includeSeasonality` (Boolean): Apply seasonal adjustments (default: true)
  - `categories` (Array<String>): Specific categories to predict (optional)

#### Returns
Promise<Object> with predictions and confidence intervals.

#### Example
```javascript
const predictions = await transactionManager.predictMonthlySpending({
    months: 3,
    confidence: 0.95,
    includeSeasonality: true,
    categories: ['Food', 'Transportation']
});

// Result:
{
    predictions: [
        {
            month: '2025-02',
            total: 3200.00,
            confidenceInterval: { lower: 2950.00, upper: 3450.00 },
            categories: {
                'Food': { amount: 850.00, confidence: 0.92 },
                'Transportation': { amount: 200.00, confidence: 0.88 }
            }
        }
        // ... more months
    ],
    methodology: {
        model: 'linear_regression',
        r2Score: 0.85,
        dataPoints: 12,
        seasonalityDetected: true
    }
}
```

### getCashFlowForecast(days)

Projects cash flow for the specified number of days including bills and income.

#### Parameters
- `days` (Number): Days to forecast (default: 30)

#### Returns
Promise<Object> with daily projections and summary.

#### Example
```javascript
const forecast = await transactionManager.getCashFlowForecast(30);

// Result:
{
    projections: [
        {
            date: '2025-01-28',
            startingBalance: 5000.00,
            income: 0,
            expenses: -125.00,
            scheduledBills: [],
            endingBalance: 4875.00
        },
        {
            date: '2025-02-01',
            startingBalance: 4500.00,
            income: 3000.00,
            expenses: -150.00,
            scheduledBills: [
                { name: 'Rent', amount: -1200.00 }
            ],
            endingBalance: 6150.00
        }
        // ... more days
    ],
    summary: {
        startingBalance: 5000.00,
        projectedEndBalance: 4200.00,
        totalIncome: 6000.00,
        totalExpenses: -4800.00,
        totalBills: -2000.00,
        lowestBalance: { date: '2025-02-15', amount: 1200.00 },
        daysNegative: 0
    }
}
```

### getTransactionInsights()

Provides comprehensive insights about spending behavior and patterns.

#### Returns
Promise<Object> with multiple insight categories.

#### Example
```javascript
const insights = await transactionManager.getTransactionInsights();

// Result:
{
    spendingPatterns: {
        topCategories: [
            { name: 'Food', percentage: 35, trend: 'increasing' }
        ],
        weekdayVsWeekend: { weekday: 0.65, weekend: 0.35 },
        morningVsEvening: { morning: 0.40, evening: 0.60 }
    },
    merchantInsights: {
        newMerchants: 5,
        loyalMerchants: [
            { name: 'Grocery Store', visits: 24, loyalty: 'high' }
        ],
        merchantDiversity: 0.72
    },
    savingsOpportunities: [
        {
            category: 'Dining Out',
            currentSpending: 600.00,
            average: 400.00,
            potential: 200.00,
            suggestion: 'Consider cooking more meals at home'
        }
    ],
    timePatterns: {
        busiestDay: 'Saturday',
        quietestDay: 'Tuesday',
        peakSpendingHour: 19
    }
}
```

### getBudgetPerformance(budgets)

Tracks performance against budget targets with recommendations.

#### Parameters
- `budgets` (Object): Category budgets as key-value pairs

#### Returns
Promise<Object> with performance metrics and recommendations.

#### Example
```javascript
const performance = await transactionManager.getBudgetPerformance({
    'Food': 800,
    'Entertainment': 200,
    'Transportation': 150
});

// Result:
{
    categories: {
        'Food': {
            budget: 800.00,
            spent: 925.00,
            remaining: -125.00,
            percentage: 115.6,
            status: 'over',
            daysLeft: 5,
            projectedTotal: 1050.00,
            recommendation: 'Reduce daily spending to $25 to stay within budget'
        }
        // ... more categories
    },
    overall: {
        totalBudget: 1150.00,
        totalSpent: 1200.00,
        percentage: 104.3,
        status: 'over',
        categoriesOver: 1,
        categoriesUnder: 2
    }
}
```

## Performance & Integration

### getPerformanceMetrics()

Returns current system performance metrics without database calls.

#### Returns
Object with performance statistics:
- `cache`: Cache hit rate and statistics
- `operations`: Operation counts and timing
- `memory`: Estimated memory usage
- `transactions`: Transaction statistics

#### Example
```javascript
const metrics = transactionManager.getPerformanceMetrics();

// Result:
{
    cache: {
        hits: 1250,
        misses: 350,
        hitRate: 78.1,
        size: 45,
        memoryUsage: '2.5 MB'
    },
    operations: {
        total: 1600,
        errors: 12,
        errorRate: 0.75,
        avgResponseTime: '45ms'
    },
    memory: {
        cacheMemory: '2.5 MB',
        searchCacheMemory: '1.2 MB',
        totalMemory: '3.7 MB'
    },
    transactions: {
        total: 2845,
        thisMonth: 156,
        lastOperation: '2025-01-27T10:30:00Z'
    }
}
```

### optimizePerformance()

Performs automatic performance optimization including cache cleanup and warming.

#### Returns
Promise<Object> with optimization results.

#### Example
```javascript
const results = await transactionManager.optimizePerformance();

// Result:
{
    searchCache: {
        before: 50,
        after: 35,
        removed: 15,
        memorySaved: '0.8 MB'
    },
    analyticsCache: {
        warmed: ['spending_trends', 'category_trends'],
        status: 'optimized'
    },
    recommendations: [
        'Consider increasing cache timeout for frequently accessed data',
        'Archive transactions older than 2 years'
    ]
}
```

### getDataQualityReport()

Analyzes transaction data quality and completeness.

#### Returns
Promise<Object> with quality metrics and issues.

#### Example
```javascript
const quality = await transactionManager.getDataQualityReport();

// Result:
{
    totalTransactions: 2845,
    issues: {
        missingCategory: {
            count: 45,
            percentage: 1.6,
            transactions: [/* first 10 transactions */]
        },
        missingDescription: {
            count: 12,
            percentage: 0.4,
            transactions: [/* first 10 transactions */]
        },
        duplicates: {
            count: 3,
            groups: [
                {
                    date: '2025-01-15',
                    amount: -45.00,
                    description: 'Coffee Shop',
                    transactions: [/* duplicate IDs */]
                }
            ]
        }
    },
    quality: {
        score: 96.5,
        grade: 'A',
        completeness: 98.0,
        accuracy: 99.0
    },
    recommendations: [
        'Review and categorize 45 uncategorized transactions',
        'Check for duplicate transactions on 2025-01-15'
    ]
}
```

### getSmartRuleRecommendations()

Suggests Smart Rules based on transaction patterns.

#### Returns
Promise<Array> of rule recommendations.

#### Example
```javascript
const recommendations = await transactionManager.getSmartRuleRecommendations();

// Result:
[
    {
        type: 'auto_categorize',
        confidence: 0.95,
        pattern: {
            merchantPattern: 'WHOLEFDS',
            suggestedCategory: 'Groceries',
            matchCount: 45
        },
        rule: {
            name: 'Auto-categorize Whole Foods',
            conditions: {
                merchant: { contains: 'WHOLEFDS' }
            },
            actions: {
                setCategory: 'Groceries'
            }
        }
    },
    {
        type: 'alert',
        confidence: 0.88,
        pattern: {
            threshold: 100,
            category: 'Entertainment',
            frequency: 'high'
        },
        rule: {
            name: 'Large Entertainment Alert',
            conditions: {
                category: 'Entertainment',
                amount: { greaterThan: 100 }
            },
            actions: {
                alert: 'Large entertainment expense'
            }
        }
    }
]
```

### evaluateRuleEffectiveness()

Analyzes the effectiveness of existing Smart Rules.

#### Returns
Promise<Object> with rule performance metrics.

#### Example
```javascript
const effectiveness = await transactionManager.evaluateRuleEffectiveness();

// Result:
{
    rules: [
        {
            id: 'rule-123',
            name: 'Auto-categorize Amazon',
            matches: 156,
            lastMatched: '2025-01-27',
            effectiveness: 'high',
            avgProcessingTime: '2ms'
        },
        {
            id: 'rule-456',
            name: 'Flag Large Purchases',
            matches: 0,
            lastMatched: null,
            effectiveness: 'unused',
            recommendation: 'Consider adjusting threshold or disabling'
        }
    ],
    summary: {
        totalRules: 15,
        activeRules: 12,
        totalMatches: 892,
        avgEffectiveness: 'medium',
        unusedRules: 3
    }
}
```

## Helper Methods

### calculateStatistics(values)

Internal helper for statistical calculations.

#### Parameters
- `values` (Array<Number>): Numeric values to analyze

#### Returns
Object with statistical measures:
- `mean`: Average value
- `median`: Middle value
- `stdDev`: Standard deviation
- `min`: Minimum value
- `max`: Maximum value
- `q1`: First quartile
- `q3`: Third quartile

### getMostCommonValue(arr)

Internal helper to find the most frequent value in an array.

#### Parameters
- `arr` (Array): Array of values

#### Returns
The most frequently occurring value.

### extractMerchantName(description)

Internal helper to extract merchant name from transaction description.

#### Parameters
- `description` (String): Transaction description

#### Returns
String with cleaned merchant name.

### cleanupSearchCache()

Internal method to remove old entries from search cache.

#### Returns
Number of entries removed.

### getAllTransactions()

Internal method to get all transactions with caching.

#### Returns
Promise<Array> of all user transactions.

## Console Testing

All Phase 4 methods have console helpers for easy testing:

```javascript
// Test spending trends
testSpendingTrends({ months: 6, groupBy: 'both' });

// Test category analysis
testCategoryTrends('Food', 6);

// Test merchant analysis
testMerchantAnalysis({ minTransactions: 3 });

// Test anomaly detection
testAnomalyDetection({ sensitivity: 'high' });

// Test spending alerts
testSpendingAlerts({ includedAlertTypes: ['overspending'] });

// Test predictions
testPredictiveAnalytics({ months: 3 });

// Test cash flow
testCashFlowForecast(30);

// Test insights
testTransactionInsights();

// Test budget performance
testBudgetPerformance({ Food: 800, Entertainment: 200 });

// Test performance metrics
testPerformanceMetrics();

// Test optimization
testOptimizePerformance();

// Test data quality
testDataQuality();

// Test rule recommendations
testSmartRuleRecommendations();

// Test rule effectiveness
testRuleEffectiveness();
```

## Error Handling

All methods include comprehensive error handling:

1. **Invalid Parameters**: Methods validate input parameters and throw descriptive errors
2. **Database Errors**: Automatic retry logic with exponential backoff
3. **Cache Errors**: Graceful fallback to direct database queries
4. **Calculation Errors**: Safe handling of edge cases (empty data, division by zero)

Example error handling:
```javascript
try {
    const trends = await transactionManager.getSpendingTrends({
        months: -1 // Invalid
    });
} catch (error) {
    console.error(error.message); // "Invalid months parameter: must be positive"
}
```

## Performance Considerations

1. **Caching**: All analytics methods use intelligent caching with TTL
2. **Batch Processing**: Large datasets are processed in batches
3. **Async Operations**: All database operations are asynchronous
4. **Memory Management**: Automatic cleanup of old cache entries
5. **Query Optimization**: Efficient database queries with proper indexing

## Best Practices

1. **Use Appropriate Time Ranges**: Longer time ranges require more processing
2. **Cache Analytics Results**: Results are cached automatically, but consider TTL
3. **Monitor Performance**: Use `getPerformanceMetrics()` regularly
4. **Optimize Periodically**: Run `optimizePerformance()` during low-traffic periods
5. **Handle Errors Gracefully**: Always wrap calls in try-catch blocks
6. **Test with Console Helpers**: Use provided test functions during development

---

*Last Updated: 2025-01-27*
*Version: 1.0.0*