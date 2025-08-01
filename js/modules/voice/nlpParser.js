// js/modules/voice/nlpParser.js - Natural Language Processing for Transaction Parsing

import { debug } from '../debug.js';
import DateParser from './utils/dateParser.js';

/**
 * NLP Parser for extracting transaction data from natural language
 */
export class NLPParser {
    constructor() {
        this.dateParser = new DateParser();
        this.initializePatterns();
    }

    /**
     * Initialize regex patterns and mappings for parsing
     */
    initializePatterns() {
        // Currency patterns - matches various ways people say amounts
        this.currencyPatterns = [
            // Exact dollar amounts: "$50", "50 dollars", "fifty dollars"
            /(?:\$|dollar[s]?)\s*(\d+(?:\.\d{2})?)|(\d+(?:\.\d{2})?)\s*(?:dollar[s]?|\$|buck[s]?)/gi,
            // Written numbers: "fifty", "twenty five", "one hundred"
            /\b((?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)\s*)+\s*(?:dollar[s]?|buck[s]?)\b/gi,
            // Decimal amounts: "50.25", "twenty five point five zero"
            /\b(\d+)\.(\d{2})\b/g
        ];

        // Written number mappings
        this.numberWords = {
            'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
            'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
            'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
            'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
            'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
            'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
            'hundred': 100, 'thousand': 1000
        };

        // Date patterns and mappings
        this.datePatterns = [
            /\b(yesterday|today|tomorrow)\b/gi,
            /\b(last|this|next)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
            /\b(\d{1,2})\s+days?\s+ago\b/gi,
            /\b(last|this|next)\s+(week|month|year)\b/gi
        ];

        // Category mappings - common words to transaction categories
        this.categoryMappings = {
            // Groceries & Food
            'grocery': 'Groceries', 'groceries': 'Groceries', 'food': 'Groceries',
            'supermarket': 'Groceries', 'walmart': 'Groceries', 'target': 'Shopping',
            'kroger': 'Groceries', 'safeway': 'Groceries', 'whole foods': 'Groceries',
            
            // Dining
            'coffee': 'Dining', 'restaurant': 'Dining', 'lunch': 'Dining', 'dinner': 'Dining',
            'breakfast': 'Dining', 'starbucks': 'Dining', 'mcdonald': 'Dining',
            'burger': 'Dining', 'pizza': 'Dining', 'cafe': 'Dining',
            
            // Transportation
            'gas': 'Transportation', 'fuel': 'Transportation', 'gasoline': 'Transportation',
            'uber': 'Transportation', 'lyft': 'Transportation', 'taxi': 'Transportation',
            'parking': 'Transportation', 'toll': 'Transportation', 'bus': 'Transportation',
            
            // Bills & Utilities
            'electric': 'Utilities', 'electricity': 'Utilities', 'power': 'Utilities',
            'water': 'Utilities', 'internet': 'Utilities', 'phone': 'Utilities',
            'rent': 'Housing', 'mortgage': 'Housing', 'insurance': 'Insurance',
            
            // Shopping & Entertainment
            'shopping': 'Shopping', 'clothes': 'Shopping', 'clothing': 'Shopping',
            'amazon': 'Shopping', 'online': 'Shopping',
            'movie': 'Entertainment', 'movies': 'Entertainment', 'theater': 'Entertainment',
            'netflix': 'Subscriptions', 'spotify': 'Subscriptions',
            
            // Healthcare
            'doctor': 'Healthcare', 'medical': 'Healthcare', 'pharmacy': 'Healthcare',
            'medicine': 'Healthcare', 'hospital': 'Healthcare',
            
            // Debt & Banking
            'credit card': 'Debt', 'loan': 'Debt', 'payment': 'Debt',
            'atm': 'ATM/Cash', 'cash': 'ATM/Cash', 'withdrawal': 'ATM/Cash',
            
            // Income
            'salary': 'Income', 'paycheck': 'Income', 'paid': 'Income',
            'income': 'Income', 'bonus': 'Income', 'freelance': 'Income'
        };

        // Transaction type indicators
        this.expenseIndicators = ['spent', 'paid', 'bought', 'purchased', 'cost', 'charge'];
        this.incomeIndicators = ['received', 'earned', 'got paid', 'income', 'salary'];
        
        // Merchant extraction patterns
        this.merchantPatterns = [
            /\bat\s+([a-zA-Z\s&]+?)(?:\s+for|\s+on|\s*$)/gi,
            /\bfrom\s+([a-zA-Z\s&]+?)(?:\s+for|\s+on|\s*$)/gi,
            /\b(?:to|in)\s+([a-zA-Z\s&]+?)(?:\s+for|\s+on|\s*$)/gi
        ];
    }

    /**
     * Main parsing function - extracts all transaction data from text
     */
    parseTransaction(text) {
        debug.log('Parsing transaction text:', text);
        
        const result = {
            originalText: text,
            amount: null,
            category: null,
            description: null,
            date: null,
            merchant: null,
            type: null, // 'expense' or 'income'
            confidence: 0
        };

        try {
            // Extract amount
            result.amount = this.extractAmount(text);
            
            // Extract date
            result.date = this.extractDate(text);
            
            // Extract merchant
            result.merchant = this.extractMerchant(text);
            
            // Extract category
            result.category = this.extractCategory(text, result.merchant);
            
            // Determine transaction type
            result.type = this.extractTransactionType(text);
            
            // Generate description
            result.description = this.generateDescription(text, result);
            
            // Calculate confidence score
            result.confidence = this.calculateConfidence(result);
            
            debug.log('Parsed transaction result:', result);
            return result;
            
        } catch (error) {
            debug.error('Error parsing transaction:', error);
            return result;
        }
    }

    /**
     * Extract monetary amount from text
     */
    extractAmount(text) {
        // Try exact dollar amounts first
        for (const pattern of this.currencyPatterns) {
            const matches = [...text.matchAll(pattern)];
            if (matches.length > 0) {
                const match = matches[0];
                // Extract the number part
                const numberStr = match[1] || match[2] || match[0];
                
                if (numberStr.match(/^\d+(\.\d{2})?$/)) {
                    return parseFloat(numberStr);
                }
                
                // Handle written numbers
                const amount = this.parseWrittenNumber(numberStr);
                if (amount > 0) {
                    return amount;
                }
            }
        }
        
        // Try to find any number that might be an amount
        const numberMatch = text.match(/\b(\d+(?:\.\d{2})?)\b/);
        if (numberMatch) {
            const amount = parseFloat(numberMatch[1]);
            if (amount > 0 && amount < 100000) { // Reasonable transaction range
                return amount;
            }
        }
        
        return null;
    }

    /**
     * Parse written numbers to numeric values
     */
    parseWrittenNumber(text) {
        const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
        let total = 0;
        let current = 0;
        
        for (const word of words) {
            if (word in this.numberWords) {
                const value = this.numberWords[word];
                
                if (value === 100) {
                    current *= 100;
                } else if (value === 1000) {
                    total += current * 1000;
                    current = 0;
                } else {
                    current += value;
                }
            }
        }
        
        return total + current;
    }

    /**
     * Extract date from text using advanced date parser
     */
    extractDate(text) {
        // First check for specific date patterns like "July 25th", "on the 15th"
        
        // Check for month + day patterns first (most specific)
        const monthDayPattern = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?\b/gi;
        const monthDayMatch = text.match(monthDayPattern);
        if (monthDayMatch) {
            const fullMatch = monthDayMatch[0];
            const parts = fullMatch.split(/\s+/);
            const monthStr = parts[0];
            const dayStr = parts[1].replace(/[^\d]/g, ''); // Remove st, nd, rd, th
            
            const monthIndex = this.dateParser.monthNames[monthStr.toLowerCase()];
            if (monthIndex !== undefined) {
                const currentYear = new Date().getFullYear();
                const date = new Date(currentYear, monthIndex, parseInt(dayStr));
                if (!isNaN(date.getTime())) {
                    return date.toISOString().split('T')[0];
                }
            }
        }
        
        // Check for day + month patterns (e.g., "25th of July", "15th December")
        const dayMonthPattern = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi;
        const dayMonthMatch = text.match(dayMonthPattern);
        if (dayMonthMatch) {
            const fullMatch = dayMonthMatch[0];
            const dayMatch = fullMatch.match(/(\d{1,2})/);
            const monthMatch = fullMatch.match(/(january|february|march|april|may|june|july|august|september|october|november|december)/i);
            
            if (dayMatch && monthMatch) {
                const dayStr = dayMatch[1];
                const monthStr = monthMatch[1];
                const monthIndex = this.dateParser.monthNames[monthStr.toLowerCase()];
                
                if (monthIndex !== undefined) {
                    const currentYear = new Date().getFullYear();
                    const date = new Date(currentYear, monthIndex, parseInt(dayStr));
                    if (!isNaN(date.getTime())) {
                        return date.toISOString().split('T')[0];
                    }
                }
            }
        }
        
        // Check for other specific date formats
        const datePatterns = [
            // Just "on the Xth"
            /\bon\s+the\s+(\d{1,2})(?:st|nd|rd|th)?/gi,
            // ISO date format
            /\b(\d{4}-\d{2}-\d{2})\b/g,
            // US date format
            /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/g
        ];

        // Check other specific date patterns
        for (const pattern of datePatterns) {
            const match = text.match(pattern);
            if (match) {
                // Handle different match formats
                if (match[0].includes('/')) {
                    // US format MM/DD/YYYY
                    const parts = match[0].split('/');
                    const month = parts[0];
                    const day = parts[1];
                    const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
                    const date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
                    if (!isNaN(date.getTime())) {
                        return date.toISOString().split('T')[0];
                    }
                } else if (match[0].match(/^\d{4}-\d{2}-\d{2}$/)) {
                    // ISO format
                    return match[0];
                } else if (match[1]) {
                    // "on the Xth" - use current month
                    const day = parseInt(match[1]);
                    const today = new Date();
                    const date = new Date(today.getFullYear(), today.getMonth(), day);
                    return date.toISOString().split('T')[0];
                }
            }
        }

        // Try to extract just the date phrase for relative dates
        const relativeDatePatterns = [
            /\b(yesterday|today|tomorrow)\b/gi,
            /\b(last|this|next)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
            /\b(\d+|a|an)\s+(day|week|month|year)s?\s+ago\b/gi,
            /\b(last|this|next)\s+(week|month|year)\b/gi,
            /\b(last|this|next)\s+\d+\s+(day|week|month|year)s?\b/gi
        ];
        
        for (const pattern of relativeDatePatterns) {
            const match = text.match(pattern);
            if (match) {
                // Parse just the matched date phrase
                const parsed = this.dateParser.parseNaturalLanguage(match[0]);
                if (parsed && parsed.startDate) {
                    return parsed.startDate.toISOString().split('T')[0];
                }
            }
        }
        
        // Fall back to DateParser for the full text
        const parsed = this.dateParser.parseNaturalLanguage(text);
        if (parsed && parsed.startDate) {
            return parsed.startDate.toISOString().split('T')[0];
        }
        
        // Default to null (will use today's date in form)
        return null;
    }

    /**
     * Extract merchant/business name from text
     */
    extractMerchant(text) {
        for (const pattern of this.merchantPatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return match[1].trim().replace(/\s+/g, ' ');
            }
        }
        return null;
    }

    /**
     * Extract or infer category from text and merchant
     */
    extractCategory(text, merchant = null) {
        const searchText = `${text} ${merchant || ''}`.toLowerCase();
        
        // Check direct category mappings
        for (const [keyword, category] of Object.entries(this.categoryMappings)) {
            if (searchText.includes(keyword.toLowerCase())) {
                return category;
            }
        }
        
        // Default category inference
        if (this.incomeIndicators.some(indicator => searchText.includes(indicator))) {
            return 'Income';
        }
        
        return null; // Let user select if we can't determine
    }

    /**
     * Determine if transaction is expense or income
     */
    extractTransactionType(text) {
        const lowerText = text.toLowerCase();
        
        if (this.incomeIndicators.some(indicator => lowerText.includes(indicator))) {
            return 'income';
        }
        
        if (this.expenseIndicators.some(indicator => lowerText.includes(indicator))) {
            return 'expense';
        }
        
        return 'expense'; // Default assumption
    }

    /**
     * Generate a clean description from parsed data
     */
    generateDescription(originalText, parsed) {
        let description = '';
        
        if (parsed.merchant) {
            description = parsed.merchant;
        }
        
        // Add context from original text
        const cleanedText = originalText
            .replace(/\$?\d+(?:\.\d{2})?\s*(?:dollar[s]?|buck[s]?)?/gi, '') // Remove amounts
            .replace(/\b(?:yesterday|today|tomorrow|\d+\s+days?\s+ago)\b/gi, '') // Remove dates
            .replace(/\b(?:spent|paid|bought|purchased|at|from|for|on)\b/gi, '') // Remove common words
            .replace(/\s+/g, ' ')
            .trim();
        
        if (cleanedText && cleanedText !== description) {
            description = description ? `${description} - ${cleanedText}` : cleanedText;
        }
        
        return description || originalText;
    }

    /**
     * Calculate confidence score based on what was successfully parsed
     */
    calculateConfidence(result) {
        let score = 0;
        
        if (result.amount !== null) score += 30;
        if (result.category !== null) score += 25;
        if (result.merchant !== null) score += 20;
        if (result.date !== null) score += 15;
        if (result.type !== null) score += 10;
        
        return Math.min(score, 100);
    }
}