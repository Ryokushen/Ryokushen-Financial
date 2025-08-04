// js/workers/analyticsWorker.js - Web Worker for Heavy Analytics Calculations

/**
 * Analytics calculations that run in a separate thread
 * to avoid blocking the main UI thread
 */

// Message handler
self.addEventListener('message', async event => {
  const { type, data, id } = event.data;

  try {
    let result;

    switch (type) {
      case 'analyzeTransactions':
        result = analyzeTransactions(data);
        break;

      case 'calculateTrends':
        result = calculateTrends(data);
        break;

      case 'calculateStatistics':
        result = calculateStatistics(data);
        break;

      case 'predictSpending':
        result = predictSpending(data);
        break;

      case 'analyzeCategories':
        result = analyzeCategories(data);
        break;

      case 'calculateCashFlow':
        result = calculateCashFlow(data);
        break;

      default:
        throw new Error(`Unknown operation: ${type}`);
    }

    // Send result back
    self.postMessage({
      type: 'result',
      id,
      data: result,
    });
  } catch (error) {
    // Send error back
    self.postMessage({
      type: 'error',
      id,
      error: error.message,
    });
  }
});

/**
 * Analyze transactions for patterns and insights
 */
function analyzeTransactions({ transactions, options = {} }) {
  const startTime = performance.now();

  // Group by various dimensions
  const byCategory = groupBy(transactions, 'category');
  const byMonth = groupByMonth(transactions);
  const byDayOfWeek = groupByDayOfWeek(transactions);
  const byMerchant = groupByMerchant(transactions);

  // Calculate statistics for each group
  const categoryStats = {};
  for (const [category, txns] of Object.entries(byCategory)) {
    categoryStats[category] = {
      total: sumAmounts(txns),
      count: txns.length,
      average: averageAmount(txns),
      ...calculateStatistics(txns.map(t => Math.abs(t.amount))),
    };
  }

  // Monthly trends
  const monthlyTrends = [];
  for (const [month, txns] of Object.entries(byMonth)) {
    const income = txns.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    const expenses = txns.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);

    monthlyTrends.push({
      month,
      income,
      expenses,
      net: income - expenses,
      transactionCount: txns.length,
    });
  }

  // Spending patterns by day of week
  const dayOfWeekPatterns = {};
  for (const [day, txns] of Object.entries(byDayOfWeek)) {
    dayOfWeekPatterns[day] = {
      averageSpending: averageAmount(txns.filter(t => t.amount < 0)),
      transactionCount: txns.length,
      totalSpending: Math.abs(sumAmounts(txns.filter(t => t.amount < 0))),
    };
  }

  // Top merchants
  const merchantStats = [];
  for (const [merchant, txns] of Object.entries(byMerchant)) {
    if (txns.length >= 3) {
      // Only include frequent merchants
      merchantStats.push({
        merchant,
        total: Math.abs(sumAmounts(txns)),
        count: txns.length,
        average: averageAmount(txns),
        lastTransaction: txns[txns.length - 1].date,
      });
    }
  }
  merchantStats.sort((a, b) => b.total - a.total);

  // Report progress
  const elapsed = performance.now() - startTime;

  return {
    summary: {
      totalTransactions: transactions.length,
      dateRange: {
        start: transactions[transactions.length - 1]?.date,
        end: transactions[0]?.date,
      },
      totalIncome: sumAmounts(transactions.filter(t => t.amount > 0)),
      totalExpenses: Math.abs(sumAmounts(transactions.filter(t => t.amount < 0))),
      processingTime: elapsed,
    },
    categoryStats,
    monthlyTrends,
    dayOfWeekPatterns,
    topMerchants: merchantStats.slice(0, 20),
  };
}

/**
 * Calculate spending trends over time
 */
function calculateTrends({ transactions, groupBy = 'month', options = {} }) {
  const groups = groupBy === 'month' ? groupByMonth(transactions) : groupByCategory(transactions);
  const trends = [];

  for (const [key, txns] of Object.entries(groups)) {
    const amounts = txns.map(t => Math.abs(t.amount));
    const stats = calculateStatistics(amounts);

    trends.push({
      label: key,
      value: sumAmounts(txns),
      count: txns.length,
      average: stats.mean,
      stdDev: stats.stdDev,
      min: stats.min,
      max: stats.max,
    });
  }

  // Sort appropriately
  if (groupBy === 'month') {
    trends.sort((a, b) => a.label.localeCompare(b.label));
  } else {
    trends.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  }

  return trends;
}

/**
 * Calculate detailed statistics for a set of values
 */
function calculateStatistics(values) {
  if (!values || values.length === 0) {
    return { mean: 0, stdDev: 0, min: 0, max: 0, median: 0, count: 0 };
  }

  const n = values.length;
  const sorted = [...values].sort((a, b) => a - b);

  // Calculate mean
  const mean = values.reduce((sum, val) => sum + val, 0) / n;

  // Calculate variance and standard deviation
  const variance =
    values.reduce((sum, val) => {
      const diff = val - mean;
      return sum + diff * diff;
    }, 0) / n;

  const stdDev = Math.sqrt(variance);

  // Calculate median
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];

  // Calculate percentiles
  const p25 = sorted[Math.floor(n * 0.25)];
  const p75 = sorted[Math.floor(n * 0.75)];

  return {
    mean,
    stdDev,
    min: sorted[0],
    max: sorted[n - 1],
    median,
    count: n,
    percentiles: { p25, p75 },
    iqr: p75 - p25,
  };
}

/**
 * Predict future spending based on historical patterns
 */
function predictSpending({ transactions, daysAhead = 30 }) {
  // Group by category and calculate average daily spending
  const categoryPatterns = {};
  const oldestDate = new Date(transactions[transactions.length - 1].date);
  const newestDate = new Date(transactions[0].date);
  const daySpan = (newestDate - oldestDate) / (1000 * 60 * 60 * 24);

  const byCategory = groupBy(
    transactions.filter(t => t.amount < 0),
    'category'
  );

  for (const [category, txns] of Object.entries(byCategory)) {
    const total = Math.abs(sumAmounts(txns));
    const dailyAverage = total / daySpan;

    categoryPatterns[category] = {
      historicalTotal: total,
      dailyAverage,
      projectedSpending: dailyAverage * daysAhead,
      transactionFrequency: txns.length / daySpan,
    };
  }

  // Calculate total projections
  const totalDailySpending = Object.values(categoryPatterns).reduce(
    (sum, pattern) => sum + pattern.dailyAverage,
    0
  );

  return {
    projectionDays: daysAhead,
    totalProjectedSpending: totalDailySpending * daysAhead,
    categoryProjections: categoryPatterns,
    confidence: calculateConfidence(transactions, daySpan),
  };
}

/**
 * Analyze spending by categories with detailed breakdowns
 */
function analyzeCategories({ transactions, options = {} }) {
  const categories = {};

  for (const transaction of transactions) {
    const category = transaction.category || 'Uncategorized';

    if (!categories[category]) {
      categories[category] = {
        transactions: [],
        total: 0,
        income: 0,
        expenses: 0,
        merchants: new Set(),
        dateRange: { start: transaction.date, end: transaction.date },
      };
    }

    const cat = categories[category];
    cat.transactions.push(transaction);
    cat.total += transaction.amount;

    if (transaction.amount > 0) {
      cat.income += transaction.amount;
    } else {
      cat.expenses += Math.abs(transaction.amount);
    }

    // Extract merchant
    const merchant = extractMerchant(transaction.description);
    if (merchant) {
      cat.merchants.add(merchant);
    }

    // Update date range
    if (transaction.date < cat.dateRange.start) {
      cat.dateRange.start = transaction.date;
    }
    if (transaction.date > cat.dateRange.end) {
      cat.dateRange.end = transaction.date;
    }
  }

  // Calculate statistics for each category
  const results = {};
  for (const [category, data] of Object.entries(categories)) {
    const amounts = data.transactions.map(t => Math.abs(t.amount));
    const stats = calculateStatistics(amounts);

    results[category] = {
      total: data.total,
      income: data.income,
      expenses: data.expenses,
      netFlow: data.income - data.expenses,
      transactionCount: data.transactions.length,
      uniqueMerchants: data.merchants.size,
      statistics: stats,
      dateRange: data.dateRange,
      percentOfTotal: 0, // Will calculate after
    };
  }

  // Calculate percentages
  const totalExpenses = Object.values(results).reduce((sum, cat) => sum + cat.expenses, 0);

  for (const category of Object.values(results)) {
    category.percentOfTotal = totalExpenses > 0 ? (category.expenses / totalExpenses) * 100 : 0;
  }

  return results;
}

/**
 * Calculate cash flow patterns
 */
function calculateCashFlow({ transactions, interval = 'daily' }) {
  const flows = {};

  for (const transaction of transactions) {
    const key = getIntervalKey(transaction.date, interval);

    if (!flows[key]) {
      flows[key] = {
        date: key,
        inflow: 0,
        outflow: 0,
        net: 0,
        transactions: 0,
      };
    }

    const flow = flows[key];
    flow.transactions++;

    if (transaction.amount > 0) {
      flow.inflow += transaction.amount;
    } else {
      flow.outflow += Math.abs(transaction.amount);
    }

    flow.net = flow.inflow - flow.outflow;
  }

  // Convert to array and sort by date
  const flowArray = Object.values(flows).sort((a, b) => a.date.localeCompare(b.date));

  // Calculate running balance
  let runningBalance = 0;
  for (const flow of flowArray) {
    runningBalance += flow.net;
    flow.runningBalance = runningBalance;
  }

  return flowArray;
}

// Helper functions

function groupBy(transactions, field) {
  const groups = {};
  for (const transaction of transactions) {
    const key = transaction[field] || 'Unknown';
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(transaction);
  }
  return groups;
}

function groupByMonth(transactions) {
  const groups = {};
  for (const transaction of transactions) {
    const date = new Date(transaction.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(transaction);
  }
  return groups;
}

function groupByDayOfWeek(transactions) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const groups = {};

  for (const transaction of transactions) {
    const date = new Date(transaction.date);
    const key = days[date.getDay()];
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(transaction);
  }
  return groups;
}

function groupByMerchant(transactions) {
  const groups = {};
  for (const transaction of transactions) {
    const merchant = extractMerchant(transaction.description);
    if (!groups[merchant]) {
      groups[merchant] = [];
    }
    groups[merchant].push(transaction);
  }
  return groups;
}

function extractMerchant(description) {
  // Simple merchant extraction
  const cleaned = description
    .toLowerCase()
    .replace(/\s+#\d+/, '') // Remove store numbers
    .replace(/\s+\d{2}\/\d{2}/, '') // Remove dates
    .replace(/\s+[a-z]{2}\s*$/, '') // Remove state codes
    .trim();

  return cleaned.split(/\s+/).slice(0, 3).join(' ');
}

function sumAmounts(transactions) {
  return transactions.reduce((sum, t) => sum + t.amount, 0);
}

function averageAmount(transactions) {
  return transactions.length > 0 ? sumAmounts(transactions) / transactions.length : 0;
}

function getIntervalKey(date, interval) {
  const d = new Date(date);

  switch (interval) {
    case 'daily':
      return date;
    case 'weekly':
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      return weekStart.toISOString().split('T')[0];
    case 'monthly':
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    default:
      return date;
  }
}

function calculateConfidence(transactions, daySpan) {
  // Simple confidence calculation based on data completeness
  const expectedTransactions = daySpan * 2; // Assume 2 transactions per day average
  const actualTransactions = transactions.length;
  const dataCompleteness = Math.min(actualTransactions / expectedTransactions, 1);

  // More data = higher confidence
  const dataPoints = Math.min(transactions.length / 100, 1);

  return (dataCompleteness * 0.6 + dataPoints * 0.4) * 100;
}
