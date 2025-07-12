// js/modules/utils.js

import { convertToMonthlyPrecise, roundMoney } from './financialMath.js';

export const DEFAULT_CASH_ACCOUNTS = ["Cash Account", "Debit Checking", "Savings High-Yield"];
export const CHART_COLORS = ["#1FB8CD", "#FFC185", "#B4413C", "#ECEBD5", "#5D878F", "#DB4545", "#D2BA4C", "#964325", "#944454", "#13343B"];

export function safeParseFloat(value, defaultValue = 0) {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
}

export function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

export function formatCurrency(amount) {
    // Handle null/undefined/NaN values
    if (amount == null || isNaN(amount)) {
        amount = 0;
    }
    
    // Round to 2 decimal places before formatting to avoid floating point display issues
    const rounded = roundMoney(amount);
    
    return new Intl.NumberFormat(navigator.language, {
        style: "currency",
        currency: "USD"  // Change to dynamic if needed, e.g., localStorage.get('currency') || 'USD'
    }).format(rounded);
}

export function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const timezoneOffset = date.getTimezoneOffset();
    const adjustedDate = new Date(date.getTime() + (timezoneOffset * 60 * 1000));
    return adjustedDate.toLocaleDateString(navigator.language, {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

export function getDueDateClass(dueDate) {
    if (!dueDate) return "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "overdue";
    if (diffDays <= 7) return "due-soon";
    return "";
}

export function getDueDateText(dueDate) {
    if (!dueDate) return 'No due date';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)} days`;
    if (diffDays === 0) return "Due today";
    if (diffDays === 1) return "Due tomorrow";
    if (diffDays <= 7) return `Due in ${diffDays} days`;
    return `Due ${formatDate(dueDate)}`;
}

export function getDaysUntilText(days) {
    if (days === 0) return "today";
    if (days === 1) return "tomorrow";
    if (days < 0) return `${Math.abs(days)} days overdue`;
    return `in ${days} days`;
}

export function convertToMonthly(amount, frequency) {
    if (!amount || !frequency) return 0;
    
    // Use precise financial math for accurate calculations
    return convertToMonthlyPrecise(amount, frequency);
}

export function getNextDueDate(currentDateStr, frequency) {
    if (!currentDateStr || !frequency) return currentDateStr;

    const currentDate = new Date(currentDateStr);
    // Adjust for timezone issues by working with UTC dates
    const date = new Date(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate());

    switch (frequency) {
        case 'weekly':
            date.setDate(date.getDate() + 7);
            break;
        case 'monthly':
            date.setMonth(date.getMonth() + 1);
            break;
        case 'quarterly':
            date.setMonth(date.getMonth() + 3);
            break;
        case 'semi-annually':
            date.setMonth(date.getMonth() + 6);
            break;
        case 'annually':
            date.setFullYear(date.getFullYear() + 1);
            break;
        default:
            return currentDateStr;
    }
    // Return the new date formatted as YYYY-MM-DD
    return date.toISOString().split('T')[0];
}