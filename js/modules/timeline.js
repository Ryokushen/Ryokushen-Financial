// js/modules/timeline.js
import { escapeHtml, formatDate, formatCurrency } from './utils.js';

/**
 * Calculates the difference in days between two dates.
 * @param {Date} date1 The first date.
 * @param {Date} date2 The second date.
 * @returns {number} The difference in days.
 */
function daysDifference(date1, date2) {
    const timeDiff = date1.getTime() - date2.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
}

export function renderBillsTimeline({ appData }) { // <-- THIS LINE IS NOW CORRECT
    const container = document.getElementById('bills-timeline-container');
    if (!container) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to the start of the day

    const upcomingBills = appData.recurringBills
        .filter(bill => bill.active !== false && new Date(bill.next_due) >= today)
        .sort((a, b) => new Date(a.next_due) - new Date(b.next_due));

    // Update bills count - show total count even if we limit display
    const billsCountEl = document.getElementById('bills-count');
    if (billsCountEl) billsCountEl.textContent = upcomingBills.length;

    if (upcomingBills.length === 0) {
        container.innerHTML = `<div class="empty-state empty-state--small">No upcoming bills.</div>`;
        return;
    }

    // Limit bills to prevent overflow
    const maxBillsToShow = 4; // Show only 4 bills to prevent overflow
    const billsToDisplay = upcomingBills.slice(0, maxBillsToShow);
    const hasMoreBills = upcomingBills.length > maxBillsToShow;

    const billsHTML = billsToDisplay.map(bill => {
        const dueDate = new Date(bill.next_due);
        const daysUntil = daysDifference(dueDate, today);
        let dueText = `${daysUntil} days`;
        if (daysUntil === 0) dueText = 'Today';
        if (daysUntil === 1) dueText = 'Tomorrow';

        return `
            <div class="bill-mini">
                <div class="bill-name">${escapeHtml(bill.name)}</div>
                <div class="bill-amount">${formatCurrency(bill.amount)}</div>
                <div class="bill-days">${dueText}</div>
            </div>
        `;
    }).join('');

    // Add indicator if there are more bills
    let finalHTML = billsHTML;
    if (hasMoreBills) {
        const remainingCount = upcomingBills.length - maxBillsToShow;
        finalHTML += `
            <div class="bill-mini more-indicator">
                <div class="bill-name">+${remainingCount} more</div>
                <div class="bill-amount">...</div>
                <div class="bill-days">See Bills tab</div>
            </div>
        `;
    }
    
    container.innerHTML = finalHTML;
}