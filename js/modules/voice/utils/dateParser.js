/**
 * Enhanced date parsing utilities for natural language processing
 * Handles various date expressions for voice queries
 */

class DateParser {
    constructor() {
        this.today = new Date();
        this.today.setHours(0, 0, 0, 0);
        
        // Common relative date patterns
        this.relativePatterns = {
            // Days
            'today': 0,
            'yesterday': -1,
            'tomorrow': 1,
            
            // Weeks
            'this week': { unit: 'week', offset: 0 },
            'last week': { unit: 'week', offset: -1 },
            'next week': { unit: 'week', offset: 1 },
            
            // Months
            'this month': { unit: 'month', offset: 0 },
            'last month': { unit: 'month', offset: -1 },
            'next month': { unit: 'month', offset: 1 },
            
            // Quarters
            'this quarter': { unit: 'quarter', offset: 0 },
            'last quarter': { unit: 'quarter', offset: -1 },
            'next quarter': { unit: 'quarter', offset: 1 },
            
            // Years
            'this year': { unit: 'year', offset: 0 },
            'last year': { unit: 'year', offset: -1 },
            'next year': { unit: 'year', offset: 1 }
        };
        
        // Month names
        this.monthNames = {
            'january': 0, 'jan': 0,
            'february': 1, 'feb': 1,
            'march': 2, 'mar': 2,
            'april': 3, 'apr': 3,
            'may': 4,
            'june': 5, 'jun': 5,
            'july': 6, 'jul': 6,
            'august': 7, 'aug': 7,
            'september': 8, 'sep': 8, 'sept': 8,
            'october': 9, 'oct': 9,
            'november': 10, 'nov': 10,
            'december': 11, 'dec': 11
        };
        
        // Day names
        this.dayNames = {
            'sunday': 0, 'sun': 0,
            'monday': 1, 'mon': 1,
            'tuesday': 2, 'tue': 2, 'tues': 2,
            'wednesday': 3, 'wed': 3,
            'thursday': 4, 'thu': 4, 'thur': 4, 'thurs': 4,
            'friday': 5, 'fri': 5,
            'saturday': 6, 'sat': 6
        };
    }
    
    /**
     * Parse natural language date expression
     * @param {string} text - Natural language date text
     * @param {Date} referenceDate - Reference date for relative calculations
     * @returns {Object} { startDate, endDate, period }
     */
    parseNaturalLanguage(text, referenceDate = new Date()) {
        const normalized = text.toLowerCase().trim();
        
        // Check for simple relative patterns
        if (this.relativePatterns[normalized]) {
            return this.parseRelativeDate(normalized, referenceDate);
        }
        
        // Check for "in X days/weeks/months" pattern
        const inPattern = /^in (\d+) (day|week|month|year)s?$/i;
        const inMatch = normalized.match(inPattern);
        if (inMatch) {
            return this.parseFutureDate(parseInt(inMatch[1]), inMatch[2], referenceDate);
        }
        
        // Check for "X days/weeks/months ago" pattern
        const agoPattern = /^(\d+|a|an) (day|week|month|year)s? ago$/i;
        const agoMatch = normalized.match(agoPattern);
        if (agoMatch) {
            const amount = agoMatch[1] === 'a' || agoMatch[1] === 'an' ? 1 : parseInt(agoMatch[1]);
            return this.parsePastDate(amount, agoMatch[2], referenceDate);
        }
        
        // Check for "last/next X days/weeks/months" pattern
        const rangePattern = /^(last|next) (\d+) (day|week|month|year)s?$/i;
        const rangeMatch = normalized.match(rangePattern);
        if (rangeMatch) {
            return this.parseDateRange(rangeMatch[1], parseInt(rangeMatch[2]), rangeMatch[3], referenceDate);
        }
        
        // Check for month names
        const monthMatch = this.parseMonthReference(normalized, referenceDate);
        if (monthMatch) {
            return monthMatch;
        }
        
        // Check for day names
        const dayMatch = this.parseDayReference(normalized, referenceDate);
        if (dayMatch) {
            return dayMatch;
        }
        
        // Check for special periods
        const specialMatch = this.parseSpecialPeriod(normalized, referenceDate);
        if (specialMatch) {
            return specialMatch;
        }
        
        // Default to null if no pattern matches
        return null;
    }
    
    /**
     * Parse relative date patterns
     */
    parseRelativeDate(pattern, referenceDate) {
        const ref = new Date(referenceDate);
        ref.setHours(0, 0, 0, 0);
        
        // Simple day offsets
        if (typeof this.relativePatterns[pattern] === 'number') {
            const date = new Date(ref);
            date.setDate(date.getDate() + this.relativePatterns[pattern]);
            return {
                startDate: date,
                endDate: date,
                period: pattern
            };
        }
        
        // Complex period offsets
        const { unit, offset } = this.relativePatterns[pattern];
        return this.calculatePeriodDates(ref, unit, offset);
    }
    
    /**
     * Parse future date expressions (e.g., "in 3 months")
     */
    parseFutureDate(amount, unit, referenceDate) {
        const ref = new Date(referenceDate);
        const future = new Date(ref);
        
        switch (unit) {
            case 'day':
                future.setDate(future.getDate() + amount);
                break;
            case 'week':
                future.setDate(future.getDate() + (amount * 7));
                break;
            case 'month':
                future.setMonth(future.getMonth() + amount);
                break;
            case 'year':
                future.setFullYear(future.getFullYear() + amount);
                break;
        }
        
        return {
            startDate: future,
            endDate: future,
            period: `in ${amount} ${unit}${amount > 1 ? 's' : ''}`
        };
    }
    
    /**
     * Parse past date expressions (e.g., "3 months ago")
     */
    parsePastDate(amount, unit, referenceDate) {
        const ref = new Date(referenceDate);
        const past = new Date(ref);
        
        switch (unit) {
            case 'day':
                past.setDate(past.getDate() - amount);
                break;
            case 'week':
                past.setDate(past.getDate() - (amount * 7));
                break;
            case 'month':
                past.setMonth(past.getMonth() - amount);
                break;
            case 'year':
                past.setFullYear(past.getFullYear() - amount);
                break;
        }
        
        return {
            startDate: past,
            endDate: past,
            period: `${amount} ${unit}${amount > 1 ? 's' : ''} ago`
        };
    }
    
    /**
     * Parse date range expressions (e.g., "last 30 days")
     */
    parseDateRange(direction, amount, unit, referenceDate) {
        const ref = new Date(referenceDate);
        const start = new Date(ref);
        const end = new Date(ref);
        
        if (direction === 'last') {
            // Past range
            switch (unit) {
                case 'day':
                    start.setDate(start.getDate() - amount);
                    break;
                case 'week':
                    start.setDate(start.getDate() - (amount * 7));
                    break;
                case 'month':
                    start.setMonth(start.getMonth() - amount);
                    break;
                case 'year':
                    start.setFullYear(start.getFullYear() - amount);
                    break;
            }
            return {
                startDate: start,
                endDate: end,
                period: `last ${amount} ${unit}${amount > 1 ? 's' : ''}`
            };
        } else {
            // Future range
            switch (unit) {
                case 'day':
                    end.setDate(end.getDate() + amount);
                    break;
                case 'week':
                    end.setDate(end.getDate() + (amount * 7));
                    break;
                case 'month':
                    end.setMonth(end.getMonth() + amount);
                    break;
                case 'year':
                    end.setFullYear(end.getFullYear() + amount);
                    break;
            }
            return {
                startDate: start,
                endDate: end,
                period: `next ${amount} ${unit}${amount > 1 ? 's' : ''}`
            };
        }
    }
    
    /**
     * Parse month references (e.g., "january", "last december")
     */
    parseMonthReference(text, referenceDate) {
        const ref = new Date(referenceDate);
        
        // Check for month names
        for (const [monthName, monthIndex] of Object.entries(this.monthNames)) {
            if (text.includes(monthName)) {
                const year = ref.getFullYear();
                const currentMonth = ref.getMonth();
                
                // Determine if it's this year, last year, or next year
                let targetYear = year;
                if (text.includes('last')) {
                    targetYear = monthIndex > currentMonth ? year - 1 : year;
                } else if (text.includes('next')) {
                    targetYear = monthIndex < currentMonth ? year + 1 : year;
                } else if (monthIndex < currentMonth) {
                    // Assume next year if month has passed
                    targetYear = year + 1;
                }
                
                const startDate = new Date(targetYear, monthIndex, 1);
                const endDate = new Date(targetYear, monthIndex + 1, 0);
                
                return {
                    startDate,
                    endDate,
                    period: `${monthName} ${targetYear}`
                };
            }
        }
        
        return null;
    }
    
    /**
     * Parse day references (e.g., "last monday", "next friday")
     */
    parseDayReference(text, referenceDate) {
        const ref = new Date(referenceDate);
        
        for (const [dayName, dayIndex] of Object.entries(this.dayNames)) {
            if (text.includes(dayName)) {
                const currentDay = ref.getDay();
                let daysOffset = dayIndex - currentDay;
                
                if (text.includes('last')) {
                    // Previous occurrence
                    daysOffset = daysOffset <= 0 ? daysOffset - 7 : daysOffset - 7;
                } else if (text.includes('next')) {
                    // Next occurrence
                    daysOffset = daysOffset >= 0 ? daysOffset + 7 : daysOffset + 7;
                } else {
                    // Nearest occurrence (prefer future)
                    if (daysOffset < 0) daysOffset += 7;
                }
                
                const targetDate = new Date(ref);
                targetDate.setDate(targetDate.getDate() + daysOffset);
                
                return {
                    startDate: targetDate,
                    endDate: targetDate,
                    period: text
                };
            }
        }
        
        return null;
    }
    
    /**
     * Parse special periods (e.g., "weekend", "quarter", "ytd")
     */
    parseSpecialPeriod(text, referenceDate) {
        const ref = new Date(referenceDate);
        
        // Weekend
        if (text.includes('weekend')) {
            const dayOfWeek = ref.getDay();
            let startOffset, endOffset;
            
            if (text.includes('last')) {
                // Last weekend
                startOffset = dayOfWeek === 0 ? -2 : -(dayOfWeek + 1);
                endOffset = dayOfWeek === 0 ? -1 : -(dayOfWeek - 6);
            } else if (text.includes('next')) {
                // Next weekend
                startOffset = 6 - dayOfWeek + 7;
                endOffset = 7 - dayOfWeek + 7;
            } else {
                // This weekend
                startOffset = 6 - dayOfWeek;
                endOffset = 7 - dayOfWeek;
            }
            
            const start = new Date(ref);
            const end = new Date(ref);
            start.setDate(start.getDate() + startOffset);
            end.setDate(end.getDate() + endOffset);
            
            return {
                startDate: start,
                endDate: end,
                period: text
            };
        }
        
        // Year to date (YTD)
        if (text === 'ytd' || text === 'year to date') {
            const start = new Date(ref.getFullYear(), 0, 1);
            return {
                startDate: start,
                endDate: ref,
                period: 'year to date'
            };
        }
        
        // Quarter to date (QTD)
        if (text === 'qtd' || text === 'quarter to date') {
            const quarter = Math.floor(ref.getMonth() / 3);
            const start = new Date(ref.getFullYear(), quarter * 3, 1);
            return {
                startDate: start,
                endDate: ref,
                period: 'quarter to date'
            };
        }
        
        // Month to date (MTD)
        if (text === 'mtd' || text === 'month to date') {
            const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
            return {
                startDate: start,
                endDate: ref,
                period: 'month to date'
            };
        }
        
        return null;
    }
    
    /**
     * Calculate period dates for week, month, quarter, year
     */
    calculatePeriodDates(referenceDate, unit, offset) {
        const ref = new Date(referenceDate);
        let startDate, endDate;
        
        switch (unit) {
            case 'week':
                // Start on Sunday
                const dayOfWeek = ref.getDay();
                startDate = new Date(ref);
                startDate.setDate(ref.getDate() - dayOfWeek + (offset * 7));
                endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6);
                break;
                
            case 'month':
                startDate = new Date(ref.getFullYear(), ref.getMonth() + offset, 1);
                endDate = new Date(ref.getFullYear(), ref.getMonth() + offset + 1, 0);
                break;
                
            case 'quarter':
                const currentQuarter = Math.floor(ref.getMonth() / 3);
                const targetQuarter = currentQuarter + offset;
                startDate = new Date(ref.getFullYear(), targetQuarter * 3, 1);
                endDate = new Date(ref.getFullYear(), (targetQuarter + 1) * 3, 0);
                break;
                
            case 'year':
                startDate = new Date(ref.getFullYear() + offset, 0, 1);
                endDate = new Date(ref.getFullYear() + offset, 11, 31);
                break;
        }
        
        return {
            startDate,
            endDate,
            period: `${offset === 0 ? 'this' : offset === -1 ? 'last' : 'next'} ${unit}`
        };
    }
    
    /**
     * Format date for display
     */
    formatDate(date) {
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
    
    /**
     * Get date range description
     */
    getDateRangeDescription(startDate, endDate) {
        if (startDate.getTime() === endDate.getTime()) {
            return this.formatDate(startDate);
        }
        return `${this.formatDate(startDate)} - ${this.formatDate(endDate)}`;
    }
}

// Export for use in other modules
export default DateParser;