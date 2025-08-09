// js/modules/voice/voiceCommandEngine.js - Voice Command Recognition & Intent Processing

import { debug } from '../debug.js';
import { getBiometricVoicePatterns } from './biometricVoiceCommands.js';

/**
 * Voice Command Engine - Processes voice commands and extracts intent + parameters
 */
export class VoiceCommandEngine {
  constructor() {
    this.initializeIntents();
    this.initializeParameterExtractors();
  }

  /**
   * Initialize command intent patterns
   */
  initializeIntents() {
    this.intentPatterns = {
      // Financial Queries
      BALANCE_QUERY: {
        patterns: [
          /\b(?:what'?s|show|display|tell me)\s+(?:my\s+)?(?:total\s+)?(?:cash\s+)?balance/gi,
          /\bhow much money do i have/gi,
          /\b(?:what'?s|show)\s+(?:my\s+)?(?:total\s+)?cash/gi,
          /\bbalance/gi,
        ],
        intent: 'query.balance',
        confidence: 0.9,
      },

      NET_WORTH_QUERY: {
        patterns: [
          /\b(?:what'?s|show|display)\s+(?:my\s+)?net\s*worth/gi,
          /\bhow much am i worth/gi,
          /\b(?:total\s+)?wealth/gi,
          /\bnet worth/gi,
        ],
        intent: 'query.networth',
        confidence: 0.95,
      },

      DEBT_QUERY: {
        patterns: [
          /\b(?:what'?s|show|how much)\s+(?:my\s+)?(?:total\s+)?debt/gi,
          /\bhow much do i owe/gi,
          /\bwhat do i owe/gi,
          /\bshow.*debt/gi,
          /\bdebt total/gi,
        ],
        intent: 'query.debt',
        confidence: 0.9,
      },

      INVESTMENT_QUERY: {
        patterns: [
          /\b(?:show|what'?s)\s+(?:my\s+)?investments?/gi,
          /\bhow (?:are\s+)?(?:my\s+)?(?:stocks?|investments?)\s+(?:doing|performing)/gi,
          /\binvestment (?:value|performance|total)/gi,
          /\bportfolio\s+(?:value|performance)/gi,
        ],
        intent: 'query.investments',
        confidence: 0.85,
      },

      // Spending Analysis
      SPENDING_QUERY: {
        patterns: [
          /\b(?:what|how much)\s+(?:did\s+)?i\s+spend\s+on\s+([a-zA-Z\s]+)/gi,
          /\b(?:show|display)\s+(?:my\s+)?([a-zA-Z\s]+)\s+(?:spending|expenses)/gi,
          /\bhow much\s+(?:for\s+)?([a-zA-Z\s]+)\s+(?:this\s+month|last\s+month|this\s+week)/gi,
          /\b([a-zA-Z\s]+)\s+expenses?\s+(?:this\s+month|last\s+month)/gi,
        ],
        intent: 'query.spending',
        confidence: 0.8,
      },

      MERCHANT_SPENDING_QUERY: {
        patterns: [
          /\bhow much\s+(?:at\s+|from\s+)?([a-zA-Z\s&]+?)(?:\s+this\s+month|\s+last\s+month|\s*$)/gi,
          /\b([a-zA-Z\s&]+)\s+spending\s+(?:this\s+month|last\s+month)/gi,
          /\bspending\s+at\s+([a-zA-Z\s&]+)/gi,
        ],
        intent: 'query.merchant_spending',
        confidence: 0.75,
      },

      // Navigation Commands
      TAB_NAVIGATION: {
        patterns: [
          /\b(?:go to|open|show|navigate to)\s+(dashboard|accounts|transactions|investments|debt|recurring|settings)/gi,
          /\b(?:switch to|view)\s+(dashboard|accounts|transactions|investments|debt|recurring|settings)/gi,
          /\b(dashboard|accounts|transactions|investments|debt|recurring|settings)\s+(?:tab|page|section)/gi,
        ],
        intent: 'navigation.tab',
        confidence: 0.95,
      },

      ACTION_COMMANDS: {
        patterns: [
          /\b(?:add|create)\s+(?:new\s+)?(?:transaction|account|investment|debt)/gi,
          /\bnew\s+(?:transaction|account|investment|debt)/gi,
          /\b(?:pay|add)\s+(?:a\s+)?bill/gi,
        ],
        intent: 'action.create',
        confidence: 0.85,
      },

      // Settings & Mode Commands
      PRIVACY_COMMANDS: {
        patterns: [
          /\b(?:enable|turn on|activate)\s+privacy\s+mode/gi,
          /\b(?:disable|turn off|deactivate)\s+privacy\s+mode/gi,
          /\btoggle\s+privacy/gi,
          /\bpanic\s+(?:mode|button)/gi,
        ],
        intent: 'settings.privacy',
        confidence: 0.9,
      },

      // Biometric and Security Commands
      BIOMETRIC_COMMANDS: {
        patterns: [
          // General privacy security status
          /\bprivacy\s+security\s+status/gi,
          /\bauthentication\s+status/gi,
          /\bwhat(?:'s| is)\s+protecting\s+(?:my\s+)?privacy/gi,

          // Biometric specific
          /\bbiometric\s+status/gi,
          /\bis\s+biometric\s+(?:enabled|on|active)/gi,
          /\b(?:enable|turn\s+on|activate|set\s+up)\s+biometric(?:\s+authentication)?/gi,
          /\b(?:disable|turn\s+off|deactivate|remove)\s+biometric(?:\s+authentication)?/gi,

          // Master password
          /\bmaster\s+password\s+status/gi,
          /\bis\s+master\s+password\s+set/gi,
          /\b(?:set|create|add)\s+master\s+password/gi,
          /\b(?:change|update)\s+master\s+password/gi,

          // Help
          /\bbiometric\s+help/gi,
          /\bwhat\s+is\s+biometric(?:\s+authentication)?/gi,
          /\bprivacy\s+security\s+help/gi,
        ],
        intent: 'settings.biometric',
        confidence: 0.9,
      },

      // KPI & Health Queries
      HEALTH_SCORE_QUERY: {
        patterns: [
          /\b(?:how'?s|what'?s)\s+(?:my\s+)?(?:financial\s+)?health/gi,
          /\b(?:show|what'?s)\s+(?:my\s+)?(?:health\s+)?score/gi,
          /\bam i doing well\s+financially/gi,
          /\bfinancial\s+health/gi,
        ],
        intent: 'query.health',
        confidence: 0.85,
      },

      SAVINGS_RATE_QUERY: {
        patterns: [
          /\b(?:what'?s|show)\s+(?:my\s+)?savings\s+rate/gi,
          /\bam i saving enough/gi,
          /\bhow much am i saving/gi,
          /\bsavings\s+percentage/gi,
        ],
        intent: 'query.savings_rate',
        confidence: 0.9,
      },

      // General Help
      HELP_QUERY: {
        patterns: [/\bhelp/gi, /\bwhat can (?:you|i) do/gi, /\bcommands/gi, /\bhow do i/gi],
        intent: 'general.help',
        confidence: 0.7,
      },

      // Trend Analysis Commands
      SPENDING_TREND_QUERY: {
        patterns: [
          /\bhow'?s?\s+my\s+spending\s+trending/gi,
          /\bspending\s+trend(?:s|ing)?/gi,
          /\bam\s+i\s+spending\s+more\s+(?:or\s+less)?/gi,
          /\bcompare\s+(?:my\s+)?spending\s+(?:this\s+month\s+to\s+last|to\s+last\s+month)/gi,
          /\bspending\s+comparison/gi,
        ],
        intent: 'query.trends',
        confidence: 0.85,
      },

      EXPENSE_INCREASE_QUERY: {
        patterns: [
          /\bwhat'?s?\s+my\s+biggest\s+expense\s+increase/gi,
          /\bwhere\s+am\s+i\s+spending\s+more/gi,
          /\bwhat\s+(?:expenses?\s+)?increased/gi,
          /\bshow\s+(?:me\s+)?expense\s+increases/gi,
        ],
        intent: 'query.expense_increase',
        confidence: 0.85,
      },

      // Time-based Spending Queries
      TIME_SPENDING_QUERY: {
        patterns: [
          /\b(?:what\s+did\s+i\s+spend|how\s+much\s+(?:did\s+i\s+|have\s+i\s+)?spent?)\s+(?:yesterday|today|this\s+week|last\s+weekend)/gi,
          /\b(?:show\s+)?(?:yesterday'?s?|today'?s?|this\s+week'?s?|last\s+weekend'?s?)\s+(?:spending|expenses?)/gi,
          /\bhow\s+much\s+have\s+i\s+spent\s+(?:so\s+far\s+)?today/gi,
          /\bspending\s+(?:yesterday|today|this\s+week|last\s+weekend)/gi,
        ],
        intent: 'query.time_spending',
        confidence: 0.85,
      },

      // Work Time Cost Queries
      WORK_TIME_QUERY: {
        patterns: [
          /\bhow\s+(?:many\s+)?(?:hours?|much\s+time)\s+(?:of\s+work\s+)?(?:was|is|did)\s+(?:my\s+)?(?:last\s+)?(?:purchase|transaction|expense)/gi,
          /\b(?:convert|show)\s+(?:my\s+)?(?:spending|expenses?)\s+(?:to|in)\s+(?:work\s+)?(?:hours?|time)/gi,
          /\bhow\s+(?:many\s+)?hours?\s+(?:did\s+i\s+)?work(?:ed)?\s+(?:for|on)\s+([a-zA-Z\s]+)/gi,
          /\btime\s+cost\s+(?:of|for)\s+(?:my\s+)?(?:last\s+)?(?:purchase|transaction|([a-zA-Z\s]+))/gi,
          /\bwork\s+(?:hours?|time)\s+(?:for|spent\s+on)\s+([a-zA-Z\s]+)/gi,
          /\bhow\s+(?:much|long)\s+(?:do|did)\s+i\s+(?:have\s+to\s+)?work\s+(?:for|to\s+pay\s+for)/gi,
        ],
        intent: 'query.work_time_cost',
        confidence: 0.9,
      },

      // Bill Management Queries
      BILLS_DUE_QUERY: {
        patterns: [
          /\b(?:what|which)\s+bills?\s+(?:are\s+)?due\s+(?:this\s+week|soon|today|tomorrow)/gi,
          /\b(?:show\s+)?(?:upcoming|due)\s+bills?/gi,
          /\bwhat\s+(?:do\s+i\s+)?(?:need\s+to\s+|have\s+to\s+)?pay\s+(?:this\s+week|soon)/gi,
          /\bbills?\s+due\s+(?:this\s+week|soon)/gi,
        ],
        intent: 'query.bills_due',
        confidence: 0.9,
      },

      OVERDUE_BILLS_QUERY: {
        patterns: [
          /\b(?:show\s+)?overdue\s+bills?/gi,
          /\bwhat\s+bills?\s+(?:are\s+)?(?:overdue|late|past\s+due)/gi,
          /\b(?:any\s+)?late\s+bills?/gi,
          /\bmissed\s+(?:bill\s+)?payments?/gi,
        ],
        intent: 'query.overdue_bills',
        confidence: 0.9,
      },

      CHEAPEST_BILL_QUERY: {
        patterns: [
          /\bwhat'?s?\s+my\s+(?:cheapest|lowest|smallest)\s+(?:recurring\s+)?bill/gi,
          /\b(?:show\s+)?cheapest\s+(?:recurring\s+)?bill/gi,
          /\bsmallest\s+(?:monthly\s+)?(?:bill|payment|subscription)/gi,
        ],
        intent: 'query.cheapest_bill',
        confidence: 0.85,
      },

      // Debt Analysis Queries
      DEBT_PAYOFF_QUERY: {
        patterns: [
          /\bwhen\s+will\s+i\s+pay\s+off\s+(?:my\s+)?(.+?)(?:\s+debt)?$/gi,
          /\bhow\s+long\s+(?:until|to\s+pay\s+off)\s+(?:my\s+)?(.+)/gi,
          /\bpay\s*off\s+date\s+(?:for\s+)?(?:my\s+)?(.+)/gi,
          /\b(.+)\s+pay\s*off\s+(?:date|timeline)/gi,
        ],
        intent: 'query.debt_payoff',
        confidence: 0.85,
      },

      HIGHEST_INTEREST_QUERY: {
        patterns: [
          /\bwhat'?s?\s+my\s+highest\s+interest\s+(?:rate\s+)?(?:debt|loan|credit)/gi,
          /\b(?:show\s+)?highest\s+(?:interest|apr)\s+debt/gi,
          /\bwhich\s+(?:debt|loan|credit)\s+has\s+(?:the\s+)?highest\s+(?:interest|rate)/gi,
        ],
        intent: 'query.highest_interest',
        confidence: 0.9,
      },

      MONTHLY_INTEREST_QUERY: {
        patterns: [
          /\bhow\s+much\s+interest\s+(?:am\s+i\s+paying|do\s+i\s+pay)\s+(?:monthly|per\s+month)/gi,
          /\b(?:show\s+)?(?:monthly|total)\s+interest\s+(?:payments?|charges?)/gi,
          /\binterest\s+(?:i'?m\s+)?paying\s+(?:monthly|each\s+month)/gi,
        ],
        intent: 'query.monthly_interest',
        confidence: 0.9,
      },

      CREDIT_UTILIZATION_QUERY: {
        patterns: [
          /\b(?:show\s+)?(?:my\s+)?credit\s+utilization/gi,
          /\bwhat'?s?\s+my\s+credit\s+(?:card\s+)?utilization/gi,
          /\bhow\s+much\s+(?:of\s+)?(?:my\s+)?credit\s+(?:am\s+i\s+using|is\s+used)/gi,
          /\bcredit\s+usage/gi,
        ],
        intent: 'query.credit_utilization',
        confidence: 0.9,
      },

      DEBT_STRATEGY_QUERY: {
        patterns: [
          /\bwhat\s+(?:should\s+i|to)\s+pay\s+off\s+first/gi,
          /\b(?:show\s+)?(?:best\s+)?(?:debt\s+)?pay\s*off\s+(?:strategy|order)/gi,
          /\bwhich\s+debt\s+(?:should\s+i\s+)?(?:pay|focus\s+on)\s+first/gi,
          /\bdebt\s+(?:payment\s+)?priorit(?:y|ies)/gi,
        ],
        intent: 'query.debt_strategy',
        confidence: 0.85,
      },

      // Savings Goal Queries
      GOAL_PROGRESS_QUERY: {
        patterns: [
          /\bam\s+i\s+on\s+track\s+(?:for\s+(?:my\s+)?)?savings\s+goals?/gi,
          /\b(?:show\s+)?(?:my\s+)?goals?\s+progress/gi,
          /\bhow\s+(?:am\s+i\s+doing|are)\s+(?:my\s+)?(?:savings\s+)?goals?/gi,
          /\bsavings\s+goals?\s+(?:status|progress)/gi,
        ],
        intent: 'query.goal_progress',
        confidence: 0.85,
      },

      GOAL_REMAINING_QUERY: {
        patterns: [
          /\bhow\s+much\s+(?:more\s+)?(?:do\s+i\s+)?need\s+(?:to\s+save\s+)?for\s+(?:my\s+)?(.+)/gi,
          /\b(?:what'?s?\s+)?(?:remaining|left)\s+(?:to\s+save\s+)?for\s+(?:my\s+)?(.+)/gi,
          /\b(.+)\s+goal\s+(?:remaining|balance|needed)/gi,
        ],
        intent: 'query.goal_remaining',
        confidence: 0.85,
      },

      // Investment Performance Queries
      PORTFOLIO_RETURN_QUERY: {
        patterns: [
          /\bwhat'?s?\s+my\s+portfolio\s+return\s+(?:this\s+year|ytd)/gi,
          /\b(?:show\s+)?(?:my\s+)?(?:investment|portfolio)\s+(?:returns?|performance)\s+(?:this\s+year|ytd)/gi,
          /\bhow\s+(?:are\s+)?my\s+investments?\s+(?:doing|performing)\s+this\s+year/gi,
          /\byear\s+to\s+date\s+(?:returns?|performance)/gi,
        ],
        intent: 'query.portfolio_return',
        confidence: 0.85,
      },

      INVESTMENT_WINNERS_LOSERS_QUERY: {
        patterns: [
          /\b(?:show\s+)?(?:stocks?|investments?)\s+in\s+(?:the\s+)?(?:red|green)/gi,
          /\bwhat'?s?\s+my\s+(?:best|worst)\s+performing\s+(?:stock|investment)/gi,
          /\b(?:show\s+)?(?:winning|losing|best|worst)\s+(?:stocks?|investments?)/gi,
          /\bwhich\s+(?:stocks?|investments?)\s+are\s+(?:up|down)/gi,
        ],
        intent: 'query.investment_performance',
        confidence: 0.85,
      },

      // Quick Actions
      CATEGORIZE_TRANSACTION: {
        patterns: [
          /\bcategorize\s+(?:the\s+)?last\s+transaction\s+as\s+([a-zA-Z\s]+)/gi,
          /\b(?:set|change)\s+(?:the\s+)?last\s+transaction\s+(?:category\s+)?to\s+([a-zA-Z\s]+)/gi,
          /\bmark\s+(?:the\s+)?last\s+(?:transaction\s+)?as\s+([a-zA-Z\s]+)/gi,
        ],
        intent: 'action.categorize',
        confidence: 0.85,
      },

      MARK_BILL_PAID: {
        patterns: [
          /\bmark\s+(.+?)\s+(?:as\s+)?paid/gi,
          /\b(.+?)\s+(?:is\s+|has\s+been\s+)?paid/gi,
          /\bpaid\s+(.+?)$/gi,
          /\brecord\s+payment\s+(?:for\s+)?(.+)/gi,
        ],
        intent: 'action.mark_paid',
        confidence: 0.85,
      },

      // View Filters
      FILTER_TRANSACTIONS: {
        patterns: [
          /\bshow\s+(?:only\s+)?income\s+(?:transactions)?/gi,
          /\bshow\s+(?:only\s+)?cash\s+transactions/gi,
          /\bhide\s+transfers/gi,
          /\bshow\s+(?:only\s+)?this\s+month(?:'s)?\s+(?:transactions)?/gi,
          /\bfilter\s+(?:by\s+)?([a-zA-Z\s]+)/gi,
        ],
        intent: 'action.filter',
        confidence: 0.8,
      },

      // Search & Discovery
      FIND_TRANSACTIONS: {
        patterns: [
          /\bfind\s+(?:all\s+)?(.+?)\s+transactions?/gi,
          /\b(?:show|search)\s+(?:for\s+)?transactions?\s+(?:from|at)\s+(.+)/gi,
          /\b(?:all\s+)?transactions?\s+(?:from|at)\s+(.+)/gi,
        ],
        intent: 'query.find_transactions',
        confidence: 0.8,
      },

      RECURRING_CHARGES_QUERY: {
        patterns: [
          /\b(?:find|show)\s+recurring\s+(?:charges?|transactions?)/gi,
          /\bwhat\s+subscriptions?\s+do\s+i\s+have/gi,
          /\b(?:show\s+)?(?:my\s+)?subscriptions?/gi,
          /\brecurring\s+(?:payments?|charges?)/gi,
        ],
        intent: 'query.recurring_charges',
        confidence: 0.85,
      },

      TOP_SPENDING_QUERY: {
        patterns: [
          /\bwhat'?s?\s+my\s+(?:most\s+frequent|biggest)\s+(?:transaction|expense)/gi,
          /\bwhere\s+do\s+i\s+spend\s+(?:the\s+)?most/gi,
          /\b(?:show\s+)?(?:my\s+)?top\s+(?:spending|expenses?|merchants?)/gi,
          /\bmost\s+(?:frequent|common)\s+(?:transaction|purchase|merchant)/gi,
        ],
        intent: 'query.top_spending',
        confidence: 0.85,
      },

      // New Natural Language Query Patterns
      GOAL_TIMELINE_QUERY: {
        patterns: [
          /\bwhen\s+will\s+i\s+(?:reach|achieve|hit)\s+(?:my\s+)?(.+?)\s+goal/gi,
          /\bhow\s+long\s+(?:until|before)\s+i\s+(?:reach|save)\s+(?:for\s+)?(.+)/gi,
          /\bwhen\s+(?:can|will)\s+i\s+(?:afford|have\s+enough\s+for)\s+(.+)/gi,
          /\b(.+)\s+goal\s+(?:timeline|date|when)/gi,
        ],
        intent: 'query.goal_timeline',
        confidence: 0.85,
      },

      EMERGENCY_FUND_QUERY: {
        patterns: [
          /\bhow\s+many\s+months?\s+(?:of\s+)?(?:expenses?\s+)?(?:do\s+i\s+)?have\s+(?:saved|in\s+savings)/gi,
          /\b(?:what'?s?\s+)?my\s+emergency\s+fund\s+(?:status|months|coverage)/gi,
          /\bhow\s+long\s+(?:can|will)\s+my\s+savings\s+last/gi,
          /\bmonths?\s+of\s+(?:expenses?\s+)?(?:coverage|runway)/gi,
        ],
        intent: 'query.emergency_fund',
        confidence: 0.85,
      },

      HIGHEST_CATEGORY_QUERY: {
        patterns: [
          /\bwhat'?s?\s+my\s+(?:highest|biggest|largest)\s+(?:expense|spending)\s+category/gi,
          /\b(?:which|what)\s+category\s+(?:do\s+i\s+)?spend\s+(?:the\s+)?most\s+(?:on|in)/gi,
          /\b(?:show\s+)?(?:my\s+)?top\s+(?:expense|spending)\s+categor(?:y|ies)/gi,
          /\bhighest\s+category\s+(?:expense|spending)/gi,
        ],
        intent: 'query.highest_category',
        confidence: 0.85,
      },

      COMPARATIVE_SPENDING_QUERY: {
        patterns: [
          /\bcompare\s+(?:my\s+)?spending\s+(?:this\s+month\s+)?(?:vs\.?|versus|to)\s+(.+)/gi,
          /\bhow\s+does\s+(?:my\s+)?spending\s+compare\s+to\s+(.+)/gi,
          /\bspending\s+comparison\s+(?:with|to)\s+(.+)/gi,
          /\b(?:am\s+i|is\s+my)\s+spending\s+(?:more|less|higher|lower)\s+than\s+(.+)/gi,
        ],
        intent: 'query.comparative_spending',
        confidence: 0.8,
      },

      BALANCE_FORECAST_QUERY: {
        patterns: [
          /\bwhat\s+will\s+my\s+balance\s+be\s+(.+)/gi,
          /\b(?:project|forecast|predict)\s+(?:my\s+)?balance\s+(?:for\s+)?(.+)/gi,
          /\bwill\s+i\s+have\s+enough\s+(?:money\s+)?(?:for|by)\s+(.+)/gi,
          /\bwhen\s+will\s+i\s+run\s+out\s+of\s+money/gi,
          /\bbalance\s+(?:projection|forecast|prediction)\s+(?:for\s+)?(.+)/gi,
        ],
        intent: 'query.balance_forecast',
        confidence: 0.85,
      },

      SPENDING_FORECAST_QUERY: {
        patterns: [
          /\b(?:what|how\s+much)\s+will\s+i\s+spend\s+(?:on\s+)?(.+?)\s+(?:this\s+month|this\s+year|next\s+month)/gi,
          /\bat\s+this\s+rate\s+(?:what|how\s+much)\s+will\s+i\s+spend/gi,
          /\b(?:project|forecast|predict)\s+(?:my\s+)?(?:spending|expenses)\s+(?:for\s+)?(.+)/gi,
          /\bspending\s+(?:projection|forecast|trend)\s+(?:for\s+)?(.+)/gi,
        ],
        intent: 'query.spending_forecast',
        confidence: 0.8,
      },

      DEBT_FREEDOM_QUERY: {
        patterns: [
          /\bwhen\s+will\s+i\s+be\s+(?:debt\s+)?free/gi,
          /\bwhen\s+(?:can|will)\s+i\s+pay\s+off\s+all\s+(?:my\s+)?(?:debt|loans|credit\s+cards?)/gi,
          /\bhow\s+long\s+(?:until|before)\s+(?:i'?m\s+)?debt\s+free/gi,
          /\bdebt\s+(?:freedom|free)\s+(?:date|timeline|when)/gi,
        ],
        intent: 'query.debt_freedom',
        confidence: 0.9,
      },

      ANOMALY_DETECTION_QUERY: {
        patterns: [
          /\b(?:show|find)\s+unusual\s+(?:transactions?|spending|expenses?)/gi,
          /\b(?:any|what)\s+(?:suspicious|strange|abnormal)\s+(?:activity|transactions?)/gi,
          /\b(?:detect|find)\s+(?:anomalies|outliers)\s+in\s+(?:my\s+)?(?:spending|transactions?)/gi,
          /\bunusual\s+(?:spending|activity|transactions?)/gi,
        ],
        intent: 'query.anomaly_detection',
        confidence: 0.8,
      },
    };

    // Time period patterns
    this.timePeriodPatterns = {
      'this month': /\bthis\s+month/gi,
      'last month': /\blast\s+month/gi,
      'this week': /\bthis\s+week/gi,
      'last week': /\blast\s+week/gi,
      'this year': /\bthis\s+year/gi,
      'last year': /\blast\s+year/gi,
      today: /\btoday/gi,
      yesterday: /\byesterday/gi,
      'last weekend': /\blast\s+weekend/gi,
      tomorrow: /\btomorrow/gi,
      'next week': /\bnext\s+week/gi,
      'next month': /\bnext\s+month/gi,
      'next year': /\bnext\s+year/gi,
      'year to date': /\b(?:year\s+to\s+date|ytd)/gi,
      'month to date': /\b(?:month\s+to\s+date|mtd)/gi,
      'quarter to date': /\b(?:quarter\s+to\s+date|qtd)/gi,
      'last 30 days': /\blast\s+30\s+days/gi,
      'last 90 days': /\blast\s+90\s+days/gi,
      'this quarter': /\bthis\s+quarter/gi,
      'last quarter': /\blast\s+quarter/gi,
    };

    // Category mappings for spending queries
    this.categoryMappings = {
      groceries: 'Groceries',
      grocery: 'Groceries',
      food: 'Groceries',
      dining: 'Dining',
      restaurant: 'Dining',
      restaurants: 'Dining',
      gas: 'Transportation',
      fuel: 'Transportation',
      transportation: 'Transportation',
      bills: 'Bills',
      utilities: 'Utilities',
      entertainment: 'Entertainment',
      shopping: 'Shopping',
      healthcare: 'Healthcare',
      medical: 'Healthcare',
      housing: 'Housing',
      rent: 'Housing',
      insurance: 'Insurance',
      debt: 'Debt',
      travel: 'Travel',
      subscriptions: 'Subscriptions',
    };
  }

  /**
   * Initialize parameter extraction patterns
   */
  initializeParameterExtractors() {
    this.parameterExtractors = {
      // Extract original text for biometric commands
      originalText: text => {
        return text;
      },

      // Extract category from spending queries
      category: (text, intent) => {
        if (intent.startsWith('query.spending')) {
          const lowerText = text.toLowerCase();
          for (const [keyword, category] of Object.entries(this.categoryMappings)) {
            if (lowerText.includes(keyword)) {
              return category;
            }
          }
        }
        return null;
      },

      // Extract time period
      timePeriod: text => {
        for (const [period, pattern] of Object.entries(this.timePeriodPatterns)) {
          if (pattern.test(text)) {
            return period;
          }
        }
        return 'current'; // default
      },

      // Extract tab name for navigation
      targetTab: (text, intent) => {
        if (intent === 'navigation.tab') {
          const tabMatch = text.match(
            /\b(dashboard|accounts|transactions|investments|debt|recurring|settings)\b/gi
          );
          return tabMatch ? tabMatch[0].toLowerCase() : null;
        }
        return null;
      },

      // Extract merchant name
      merchant: (text, intent) => {
        if (intent === 'query.merchant_spending') {
          // Extract merchant from patterns like "how much at Walmart"
          const merchantMatch = text.match(
            /\b(?:at|from)\s+([a-zA-Z\s&]+?)(?:\s+this|\s+last|\s*$)/gi
          );
          if (merchantMatch && merchantMatch[0]) {
            return merchantMatch[0].replace(/\b(?:at|from)\s+/gi, '').trim();
          }
        }
        return null;
      },

      // Extract action type
      actionType: (text, intent) => {
        if (intent === 'action.create') {
          const typeMatch = text.match(/\b(transaction|account|investment|debt|bill)\b/gi);
          return typeMatch ? typeMatch[0].toLowerCase() : null;
        }
        return null;
      },

      // Extract privacy action
      privacyAction: (text, intent) => {
        if (intent === 'settings.privacy') {
          if (/\b(?:enable|turn on|activate)\b/gi.test(text)) {
            return 'enable';
          }
          if (/\b(?:disable|turn off|deactivate)\b/gi.test(text)) {
            return 'disable';
          }
          if (/\btoggle\b/gi.test(text)) {
            return 'toggle';
          }
          if (/\bpanic\b/gi.test(text)) {
            return 'panic';
          }
        }
        return null;
      },

      // Extract debt name for payoff queries
      debtName: (text, intent) => {
        if (intent === 'query.debt_payoff') {
          // Extract debt name from patterns like "when will I pay off my credit card"
          const patterns = [
            /pay\s+off\s+(?:my\s+)?(.+?)(?:\s+debt)?$/i,
            /(?:until|to\s+pay\s+off)\s+(?:my\s+)?(.+)$/i,
            /date\s+(?:for\s+)?(?:my\s+)?(.+)$/i,
            /^(.+?)\s+pay\s*off/i,
          ];

          for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
              return match[1].trim();
            }
          }
        }
        return null;
      },

      // Extract goal name for goal queries
      goalName: (text, intent) => {
        if (intent === 'query.goal_remaining') {
          // Extract goal name from patterns
          const patterns = [
            /need\s+(?:to\s+save\s+)?for\s+(?:my\s+)?(.+)$/i,
            /(?:remaining|left)\s+(?:to\s+save\s+)?for\s+(?:my\s+)?(.+)$/i,
            /^(.+?)\s+goal\s+(?:remaining|balance|needed)/i,
          ];

          for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
              return match[1].trim();
            }
          }
        }
        return null;
      },

      // Extract category or time period for work time queries
      workTimeCategory: (text, intent) => {
        if (intent === 'query.work_time_cost') {
          // Check for "last purchase/transaction"
          if (/\b(?:last|recent)\s+(?:purchase|transaction|expense)/i.test(text)) {
            return 'last_transaction';
          }

          // Extract category from patterns like "worked for groceries"
          const patterns = [
            /work(?:ed)?\s+(?:for|on)\s+([a-zA-Z\s]+?)(?:\s+this|\s+last|$)/i,
            /time\s+cost\s+(?:of|for)\s+([a-zA-Z\s]+?)(?:\s+this|\s+last|$)/i,
            /hours?\s+(?:for|on|spent\s+on)\s+([a-zA-Z\s]+?)(?:\s+this|\s+last|$)/i,
          ];

          for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
              return match[1].trim();
            }
          }
        }
        return null;
      },

      // Extract bill name for bill actions
      billName: (text, intent) => {
        if (intent === 'action.mark_paid') {
          // Extract bill name from patterns
          const patterns = [
            /mark\s+(.+?)\s+(?:as\s+)?paid/i,
            /^(.+?)\s+(?:is\s+|has\s+been\s+)?paid/i,
            /^paid\s+(.+?)$/i,
            /payment\s+(?:for\s+)?(.+)$/i,
          ];

          for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
              return match[1].trim();
            }
          }
        }
        return null;
      },

      // Extract filter type
      filterType: (text, intent) => {
        if (intent === 'action.filter') {
          if (/\bincome\b/i.test(text)) {
            return 'income';
          }
          if (/\bcash\b/i.test(text)) {
            return 'cash';
          }
          if (/\btransfers?\b/i.test(text)) {
            return 'transfers';
          }
          if (/\bthis\s+month\b/i.test(text)) {
            return 'thisMonth';
          }
        }
        return null;
      },

      // Extract search merchant for find transactions
      searchMerchant: (text, intent) => {
        if (intent === 'query.find_transactions') {
          const patterns = [
            /find\s+(?:all\s+)?(.+?)\s+transactions?/i,
            /transactions?\s+(?:from|at)\s+(.+)$/i,
          ];

          for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
              return match[1].trim();
            }
          }
        }
        return null;
      },

      // Extract comparison period for trend queries
      comparisonPeriod: (text, intent) => {
        if (intent === 'query.trends' || intent === 'query.expense_increase') {
          if (/\blast\s+month\b/i.test(text)) {
            return 'lastMonth';
          }
          if (/\blast\s+year\b/i.test(text)) {
            return 'lastYear';
          }
          if (/\bthis\s+month\b/i.test(text)) {
            return 'thisMonth';
          }
        }
        return 'lastMonth'; // default comparison
      },

      // Extract extra payment years for debt freedom query
      debtFreeYears: (text, intent) => {
        if (intent === 'query.debt_strategy') {
          const match = text.match(/debt[- ]free\s+in\s+(\d+)\s+years?/i);
          if (match && match[1]) {
            return parseInt(match[1]);
          }
        }
        return null;
      },
    };
  }

  /**
   * Process voice command and extract intent + parameters
   */
  processCommand(voiceText) {
    debug.log('Processing voice command:', voiceText);

    const result = {
      originalText: voiceText,
      intent: null,
      confidence: 0,
      parameters: {},
      isCommand: false,
    };

    try {
      // Find matching intent
      const intentMatch = this.findBestIntentMatch(voiceText);

      if (intentMatch) {
        result.intent = intentMatch.intent;
        result.confidence = intentMatch.confidence;
        result.isCommand = true;

        // Extract parameters based on intent
        result.parameters = this.extractParameters(voiceText, intentMatch.intent);

        debug.log('Command processed:', result);
        return result;
      }

      // No command detected
      debug.log('No command intent detected');
      return result;
    } catch (error) {
      debug.error('Error processing voice command:', error);
      return result;
    }
  }

  /**
   * Find the best matching intent for the voice text
   */
  findBestIntentMatch(text) {
    let bestMatch = null;
    let highestConfidence = 0;

    for (const [intentKey, intentData] of Object.entries(this.intentPatterns)) {
      for (const pattern of intentData.patterns) {
        pattern.lastIndex = 0; // Reset regex
        if (pattern.test(text)) {
          const confidence = this.calculatePatternConfidence(text, pattern, intentData.confidence);

          if (confidence > highestConfidence) {
            highestConfidence = confidence;
            bestMatch = {
              intent: intentData.intent,
              confidence,
              matchedPattern: pattern.source,
            };
          }
        }
      }
    }

    return bestMatch;
  }

  /**
   * Calculate confidence score for pattern match
   */
  calculatePatternConfidence(text, pattern, baseConfidence) {
    // Start with base confidence
    let confidence = baseConfidence;

    // Boost confidence for exact matches
    const textLength = text.trim().length;
    const matchLength = text.match(pattern)?.[0]?.length || 0;
    const matchRatio = matchLength / textLength;

    if (matchRatio > 0.8) {
      confidence *= 1.1; // Boost for high match ratio
    }

    // Reduce confidence for very long text with small matches
    if (textLength > 50 && matchRatio < 0.3) {
      confidence *= 0.8;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Extract parameters from text based on intent
   */
  extractParameters(text, intent) {
    const parameters = {};

    for (const [paramName, extractor] of Object.entries(this.parameterExtractors)) {
      try {
        const value = extractor(text, intent);
        if (value !== null) {
          parameters[paramName] = value;
        }
      } catch (error) {
        debug.warn(`Error extracting parameter ${paramName}:`, error);
      }
    }

    return parameters;
  }

  /**
   * Validate if text contains a recognizable command
   */
  isCommand(text) {
    const result = this.processCommand(text);
    return result.isCommand && result.confidence > 0.5;
  }

  /**
   * Get supported command examples
   */
  getCommandExamples() {
    return {
      'Financial Queries': [
        "What's my balance?",
        'Show my net worth',
        'How much debt do I have?',
        'What are my investments worth?',
      ],
      'Spending Analysis': [
        'What did I spend on groceries this month?',
        'How much for dining last month?',
        'Show entertainment expenses',
      ],
      Navigation: ['Go to dashboard', 'Show transactions', 'Open accounts tab'],
      Actions: ['Add new transaction', 'Create account', 'Pay bill'],
      'Privacy & Security': [
        'Enable privacy mode',
        'Privacy security status',
        'Enable biometric authentication',
        'Master password status',
      ],
      Settings: ['Toggle privacy', 'Panic mode'],
    };
  }

  /**
   * Get intent category for grouping
   */
  getIntentCategory(intent) {
    if (intent.startsWith('query.')) {
      return 'query';
    }
    if (intent.startsWith('navigation.')) {
      return 'navigation';
    }
    if (intent.startsWith('action.')) {
      return 'action';
    }
    if (intent.startsWith('settings.')) {
      return 'settings';
    }
    if (intent.startsWith('general.')) {
      return 'general';
    }
    return 'unknown';
  }
}
