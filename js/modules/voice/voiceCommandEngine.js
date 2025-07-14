// js/modules/voice/voiceCommandEngine.js - Voice Command Recognition & Intent Processing

import { debug } from '../debug.js';

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
                    /\bbalance/gi
                ],
                intent: 'query.balance',
                confidence: 0.9
            },

            NET_WORTH_QUERY: {
                patterns: [
                    /\b(?:what'?s|show|display)\s+(?:my\s+)?net\s*worth/gi,
                    /\bhow much am i worth/gi,
                    /\b(?:total\s+)?wealth/gi,
                    /\bnet worth/gi
                ],
                intent: 'query.networth',
                confidence: 0.95
            },

            DEBT_QUERY: {
                patterns: [
                    /\b(?:what'?s|show|how much)\s+(?:my\s+)?(?:total\s+)?debt/gi,
                    /\bhow much do i owe/gi,
                    /\bwhat do i owe/gi,
                    /\bshow.*debt/gi,
                    /\bdebt total/gi
                ],
                intent: 'query.debt',
                confidence: 0.9
            },

            INVESTMENT_QUERY: {
                patterns: [
                    /\b(?:show|what'?s)\s+(?:my\s+)?investments?/gi,
                    /\bhow (?:are\s+)?(?:my\s+)?(?:stocks?|investments?)\s+(?:doing|performing)/gi,
                    /\binvestment (?:value|performance|total)/gi,
                    /\bportfolio\s+(?:value|performance)/gi
                ],
                intent: 'query.investments',
                confidence: 0.85
            },

            // Spending Analysis
            SPENDING_QUERY: {
                patterns: [
                    /\b(?:what|how much)\s+(?:did\s+)?i\s+spend\s+on\s+([a-zA-Z\s]+)/gi,
                    /\b(?:show|display)\s+(?:my\s+)?([a-zA-Z\s]+)\s+(?:spending|expenses)/gi,
                    /\bhow much\s+(?:for\s+)?([a-zA-Z\s]+)\s+(?:this\s+month|last\s+month|this\s+week)/gi,
                    /\b([a-zA-Z\s]+)\s+expenses?\s+(?:this\s+month|last\s+month)/gi
                ],
                intent: 'query.spending',
                confidence: 0.8
            },

            MERCHANT_SPENDING_QUERY: {
                patterns: [
                    /\bhow much\s+(?:at\s+|from\s+)?([a-zA-Z\s&]+?)(?:\s+this\s+month|\s+last\s+month|\s*$)/gi,
                    /\b([a-zA-Z\s&]+)\s+spending\s+(?:this\s+month|last\s+month)/gi,
                    /\bspending\s+at\s+([a-zA-Z\s&]+)/gi
                ],
                intent: 'query.merchant_spending',
                confidence: 0.75
            },

            // Navigation Commands  
            TAB_NAVIGATION: {
                patterns: [
                    /\b(?:go to|open|show|navigate to)\s+(dashboard|accounts|transactions|investments|debt|recurring)/gi,
                    /\b(?:switch to|view)\s+(dashboard|accounts|transactions|investments|debt|recurring)/gi,
                    /\b(dashboard|accounts|transactions|investments|debt|recurring)\s+(?:tab|page|section)/gi
                ],
                intent: 'navigation.tab',
                confidence: 0.95
            },

            ACTION_COMMANDS: {
                patterns: [
                    /\b(?:add|create)\s+(?:new\s+)?(?:transaction|account|investment|debt)/gi,
                    /\bnew\s+(?:transaction|account|investment|debt)/gi,
                    /\b(?:pay|add)\s+(?:a\s+)?bill/gi
                ],
                intent: 'action.create',
                confidence: 0.85
            },

            // Settings & Mode Commands
            PRIVACY_COMMANDS: {
                patterns: [
                    /\b(?:enable|turn on|activate)\s+privacy\s+mode/gi,
                    /\b(?:disable|turn off|deactivate)\s+privacy\s+mode/gi,
                    /\btoggle\s+privacy/gi,
                    /\bpanic\s+(?:mode|button)/gi
                ],
                intent: 'settings.privacy',
                confidence: 0.9
            },

            // KPI & Health Queries
            HEALTH_SCORE_QUERY: {
                patterns: [
                    /\b(?:how'?s|what'?s)\s+(?:my\s+)?(?:financial\s+)?health/gi,
                    /\b(?:show|what'?s)\s+(?:my\s+)?(?:health\s+)?score/gi,
                    /\bam i doing well\s+financially/gi,
                    /\bfinancial\s+health/gi
                ],
                intent: 'query.health',
                confidence: 0.85
            },

            SAVINGS_RATE_QUERY: {
                patterns: [
                    /\b(?:what'?s|show)\s+(?:my\s+)?savings\s+rate/gi,
                    /\bam i saving enough/gi,
                    /\bhow much am i saving/gi,
                    /\bsavings\s+percentage/gi
                ],
                intent: 'query.savings_rate',
                confidence: 0.9
            },

            // General Help
            HELP_QUERY: {
                patterns: [
                    /\bhelp/gi,
                    /\bwhat can (?:you|i) do/gi,
                    /\bcommands/gi,
                    /\bhow do i/gi
                ],
                intent: 'general.help',
                confidence: 0.7
            }
        };

        // Time period patterns
        this.timePeriodPatterns = {
            'this month': /\bthis\s+month/gi,
            'last month': /\blast\s+month/gi,
            'this week': /\bthis\s+week/gi,
            'last week': /\blast\s+week/gi,
            'this year': /\bthis\s+year/gi,
            'last year': /\blast\s+year/gi,
            'today': /\btoday/gi,
            'yesterday': /\byesterday/gi
        };

        // Category mappings for spending queries
        this.categoryMappings = {
            'groceries': 'Groceries',
            'grocery': 'Groceries', 
            'food': 'Groceries',
            'dining': 'Dining',
            'restaurant': 'Dining',
            'restaurants': 'Dining',
            'gas': 'Transportation',
            'fuel': 'Transportation',
            'transportation': 'Transportation',
            'bills': 'Bills',
            'utilities': 'Utilities',
            'entertainment': 'Entertainment',
            'shopping': 'Shopping',
            'healthcare': 'Healthcare',
            'medical': 'Healthcare',
            'housing': 'Housing',
            'rent': 'Housing',
            'insurance': 'Insurance',
            'debt': 'Debt',
            'travel': 'Travel',
            'subscriptions': 'Subscriptions'
        };
    }

    /**
     * Initialize parameter extraction patterns
     */
    initializeParameterExtractors() {
        this.parameterExtractors = {
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
            timePeriod: (text) => {
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
                    const tabMatch = text.match(/\b(dashboard|accounts|transactions|investments|debt|recurring)\b/gi);
                    return tabMatch ? tabMatch[0].toLowerCase() : null;
                }
                return null;
            },

            // Extract merchant name
            merchant: (text, intent) => {
                if (intent === 'query.merchant_spending') {
                    // Extract merchant from patterns like "how much at Walmart"
                    const merchantMatch = text.match(/\b(?:at|from)\s+([a-zA-Z\s&]+?)(?:\s+this|\s+last|\s*$)/gi);
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
                    if (/\b(?:enable|turn on|activate)\b/gi.test(text)) return 'enable';
                    if (/\b(?:disable|turn off|deactivate)\b/gi.test(text)) return 'disable';
                    if (/\btoggle\b/gi.test(text)) return 'toggle';
                    if (/\bpanic\b/gi.test(text)) return 'panic';
                }
                return null;
            }
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
            isCommand: false
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
                            confidence: confidence,
                            matchedPattern: pattern.source
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
                "Show my net worth",
                "How much debt do I have?",
                "What are my investments worth?"
            ],
            'Spending Analysis': [
                "What did I spend on groceries this month?",
                "How much for dining last month?",
                "Show entertainment expenses"
            ],
            'Navigation': [
                "Go to dashboard",
                "Show transactions",
                "Open accounts tab"
            ],
            'Actions': [
                "Add new transaction",
                "Create account",
                "Pay bill"
            ],
            'Settings': [
                "Enable privacy mode",
                "Toggle privacy",
                "Panic mode"
            ]
        };
    }

    /**
     * Get intent category for grouping
     */
    getIntentCategory(intent) {
        if (intent.startsWith('query.')) return 'query';
        if (intent.startsWith('navigation.')) return 'navigation';
        if (intent.startsWith('action.')) return 'action';
        if (intent.startsWith('settings.')) return 'settings';
        if (intent.startsWith('general.')) return 'general';
        return 'unknown';
    }
}