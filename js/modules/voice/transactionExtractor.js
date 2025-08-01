// js/modules/voice/transactionExtractor.js - Smart Transaction Pattern Matching

import { NLPParser } from './nlpParser.js';
import { debug } from '../debug.js';

/**
 * Transaction Extractor - Handles common transaction patterns and phrases
 */
export class TransactionExtractor {
    constructor() {
        this.nlpParser = new NLPParser();
        this.initializeCommonPatterns();
    }

    /**
     * Initialize common transaction patterns
     */
    initializeCommonPatterns() {
        // Common transaction phrase patterns
        this.transactionPatterns = [
            {
                // "Spent X at Y DATE" - more flexible date capture
                pattern: /\b(?:spent|paid)\s+([^a-zA-Z]*(?:\d+|(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)\s*)+[^a-zA-Z]*)\s+(?:at|to|in|on)\s+([^,]+?)(?:\s+(?:on\s+)?((?:yesterday|today|tomorrow|last\s+\w+|next\s+\w+|\d+\s+(?:days?|weeks?|months?)\s+ago|(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d+(?:st|nd|rd|th)?).*))?$/gi,
                extract: (match, text) => ({
                    amount: match[1],
                    merchant: match[2].trim(),
                    date: match[3] ? match[3].trim() : null,
                    type: 'expense'
                })
            },
            {
                // "Spent X on Y DATE" - for phrases like "spent 50 on groceries yesterday"
                pattern: /\b(?:spent|paid|bought)\s+([^a-zA-Z]*(?:\d+|(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)\s*)+[^a-zA-Z]*)\s+(?:on|for)\s+([^,]+?)\s+(yesterday|today|tomorrow|last\s+\w+|next\s+\w+|\d+\s+(?:days?|weeks?|months?)\s+ago)$/gi,
                extract: (match, text) => ({
                    amount: match[1],
                    context: match[2].trim(),
                    date: match[3].trim(),
                    type: 'expense'
                })
            },
            {
                // "Spent X at Y for Z" (keeping for backward compatibility)
                pattern: /\b(?:spent|paid)\s+([^a-zA-Z]*(?:\d+|(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)\s*)+[^a-zA-Z]*)\s+(?:at|to|in)\s+([^f]+?)\s+for\s+(.+)/gi,
                extract: (match, text) => ({
                    amount: match[1],
                    merchant: match[2].trim(),
                    context: match[3].trim(),
                    type: 'expense'
                })
            },
            {
                // "Bought X for Y at Z on DATE"
                pattern: /\b(?:bought|purchased)\s+(.+?)\s+for\s+([^a-zA-Z]*(?:\d+|(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)\s*)+[^a-zA-Z]*)\s+(?:at|from|in)\s+([^o]+?)(?:\s+on\s+(.+?))?$/gi,
                extract: (match, text) => ({
                    amount: match[2],
                    merchant: match[3].trim(),
                    context: match[1].trim(),
                    date: match[4] ? match[4].trim() : null,
                    type: 'expense'
                })
            },
            {
                // "Coffee at Starbucks for four dollars"
                pattern: /\b([a-zA-Z\s]+?)\s+(?:at|from|in)\s+([a-zA-Z\s&]+?)\s+for\s+([^a-zA-Z]*(?:\d+|(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)\s*)+[^a-zA-Z]*)/gi,
                extract: (match, text) => ({
                    amount: match[3],
                    merchant: match[2].trim(),
                    context: match[1].trim(),
                    type: 'expense'
                })
            },
            {
                // "Got paid X" or "Received X"
                pattern: /\b(?:got\s+paid|received|earned)\s+([^a-zA-Z]*(?:\d+|(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)\s*)+[^a-zA-Z]*)/gi,
                extract: (match, text) => ({
                    amount: match[1],
                    merchant: null,
                    context: 'income',
                    type: 'income'
                })
            },
            {
                // "Paid credit card X" or "Credit card payment X"
                pattern: /\b(?:paid\s+)?credit\s+card\s+(?:payment\s+)?([^a-zA-Z]*(?:\d+|(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)\s*)+[^a-zA-Z]*)/gi,
                extract: (match, text) => ({
                    amount: match[1],
                    merchant: null,
                    context: 'credit card payment',
                    type: 'debt_payment'
                })
            },
            {
                // "Gas for X" or "Filled up for X"
                pattern: /\b(?:gas|fuel|filled\s+up)\s+(?:for\s+)?([^a-zA-Z]*(?:\d+|(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)\s*)+[^a-zA-Z]*)/gi,
                extract: (match, text) => ({
                    amount: match[1],
                    merchant: null,
                    context: 'gas',
                    type: 'expense',
                    category: 'Transportation'
                })
            },
            {
                // General pattern with date at end: "X at/for Y [Z days ago/yesterday/etc]"
                pattern: /\b(?:spent|paid|bought)\s+([^a-zA-Z]*(?:\d+|(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)\s*)+[^a-zA-Z]*)\s+(?:at|for|on)\s+(.+?)\s+((?:\d+|a|an?)\s+(?:days?|weeks?|months?|years?)\s+ago|yesterday|today|tomorrow|last\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month|year))$/gi,
                extract: (match, text) => ({
                    amount: match[1],
                    context: match[2].trim(),
                    date: match[3].trim(),
                    type: 'expense'
                })
            }
        ];

        // Quick category assignments for common contexts
        this.contextCategoryMap = {
            'gas': 'Transportation',
            'fuel': 'Transportation',
            'coffee': 'Dining',
            'lunch': 'Dining',
            'dinner': 'Dining',
            'breakfast': 'Dining',
            'groceries': 'Groceries',
            'grocery': 'Groceries',
            'credit card payment': 'Debt',
            'income': 'Income',
            'salary': 'Income',
            'paycheck': 'Income'
        };
    }

    /**
     * Extract transaction data using pattern matching + NLP
     */
    extractTransaction(text) {
        debug.log('Extracting transaction from:', text);
        
        // First try pattern matching for structured phrases
        const patternResult = this.tryPatternMatching(text);
        
        // Then use NLP parser for comprehensive extraction
        const nlpResult = this.nlpParser.parseTransaction(text);
        
        // Combine results, prioritizing pattern matching for structured data
        const combinedResult = this.combineResults(patternResult, nlpResult);
        
        debug.log('Combined extraction result:', combinedResult);
        return combinedResult;
    }

    /**
     * Try to match common transaction patterns
     */
    tryPatternMatching(text) {
        for (const patternDef of this.transactionPatterns) {
            patternDef.pattern.lastIndex = 0; // Reset regex
            const match = patternDef.pattern.exec(text);
            
            if (match) {
                debug.log('Pattern matched:', patternDef.pattern, match);
                const extracted = patternDef.extract(match, text);
                
                return {
                    matched: true,
                    pattern: patternDef.pattern.source,
                    rawAmount: extracted.amount,
                    amount: this.parseAmount(extracted.amount),
                    merchant: extracted.merchant,
                    context: extracted.context,
                    type: extracted.type,
                    category: extracted.category || this.getCategoryFromContext(extracted.context),
                    date: extracted.date || null,
                    confidence: 85 // High confidence for pattern matches
                };
            }
        }
        
        return { matched: false };
    }

    /**
     * Parse amount from text using NLP parser
     */
    parseAmount(amountText) {
        if (!amountText) return null;
        
        // Use the NLP parser's amount extraction
        return this.nlpParser.extractAmount(amountText.toString());
    }

    /**
     * Get category from context
     */
    getCategoryFromContext(context) {
        if (!context) return null;
        
        const lowerContext = context.toLowerCase();
        
        for (const [keyword, category] of Object.entries(this.contextCategoryMap)) {
            if (lowerContext.includes(keyword)) {
                return category;
            }
        }
        
        return null;
    }

    /**
     * Combine pattern matching and NLP results
     */
    combineResults(patternResult, nlpResult) {
        // If pattern matching found a good match, use it as base
        if (patternResult.matched && patternResult.amount !== null) {
            // If pattern has a date string, parse it to ISO format
            let finalDate = nlpResult.date; // Default to NLP date
            if (patternResult.date) {
                // Use NLP parser to convert date string to ISO format
                const parsedDate = this.nlpParser.extractDate(patternResult.date);
                if (parsedDate) {
                    finalDate = parsedDate;
                }
            }
            
            return {
                originalText: nlpResult.originalText,
                amount: patternResult.amount,
                category: patternResult.category || nlpResult.category,
                description: this.generateDescription(patternResult, nlpResult),
                date: finalDate,
                merchant: patternResult.merchant || nlpResult.merchant,
                type: patternResult.type || nlpResult.type,
                confidence: Math.max(patternResult.confidence, nlpResult.confidence),
                extractionMethod: 'pattern+nlp'
            };
        }
        
        // Otherwise use NLP result with high confidence if amount was found
        if (nlpResult.amount !== null) {
            nlpResult.extractionMethod = 'nlp';
            return nlpResult;
        }
        
        // Fallback - return basic NLP result
        nlpResult.extractionMethod = 'nlp_fallback';
        nlpResult.confidence = Math.max(nlpResult.confidence - 20, 0);
        return nlpResult;
    }

    /**
     * Generate description combining pattern and NLP data
     */
    generateDescription(patternResult, nlpResult) {
        let parts = [];
        
        // Add merchant
        const merchant = patternResult.merchant || nlpResult.merchant;
        if (merchant) {
            parts.push(merchant);
        }
        
        // Add context
        if (patternResult.context && patternResult.context !== 'income') {
            parts.push(patternResult.context);
        }
        
        // Fallback to NLP description
        if (parts.length === 0 && nlpResult.description) {
            return nlpResult.description;
        }
        
        // Join parts or use original text
        return parts.length > 0 ? parts.join(' - ') : nlpResult.originalText;
    }

    /**
     * Validate extracted transaction data
     */
    validateExtraction(result) {
        const validation = {
            isValid: true,
            warnings: [],
            errors: []
        };

        // Check amount
        if (result.amount === null) {
            validation.warnings.push('No amount detected');
        } else if (result.amount <= 0) {
            validation.errors.push('Amount must be positive');
            validation.isValid = false;
        } else if (result.amount > 10000) {
            validation.warnings.push('Large amount detected - please verify');
        }

        // Check confidence
        if (result.confidence < 50) {
            validation.warnings.push('Low confidence extraction - please review');
        }

        // Check for missing category
        if (!result.category) {
            validation.warnings.push('Category not detected - please select manually');
        }

        return validation;
    }

    /**
     * Get suggested form fields from extraction
     */
    getSuggestedFormData(extraction) {
        const suggestions = {};

        if (extraction.amount !== null) {
            suggestions.amount = Math.abs(extraction.amount); // Always positive in form
        }

        if (extraction.category) {
            suggestions.category = extraction.category;
        }

        if (extraction.description) {
            suggestions.description = extraction.description;
        }

        if (extraction.date) {
            suggestions.date = extraction.date;
        }

        // Handle debt payments
        if (extraction.type === 'debt_payment') {
            suggestions.category = 'Debt';
            suggestions.amount = extraction.amount; // Keep sign for debt
        }

        return suggestions;
    }
}