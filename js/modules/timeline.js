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
        .sort((a, b) => new Date(a.next_due) - new Date(b.next_due))
        .slice(0, 5); // Get the next 5 upcoming bills

    if (upcomingBills.length === 0) {
        container.innerHTML = `<div class="empty-state empty-state--small">No upcoming bills.</div>`;
        return;
    }

    const timelineItemsHTML = upcomingBills.map(bill => {
        const dueDate = new Date(bill.next_due);
        const daysUntil = daysDifference(dueDate, today);
        let dueText = `in ${daysUntil} days`;
        if (daysUntil === 0) dueText = 'Today';
        if (daysUntil === 1) dueText = 'Tomorrow';

        return `
            <div class="timeline-item">
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                    <div class="timeline-title">${escapeHtml(bill.name)}</div>
                    <div class="timeline-amount">${formatCurrency(bill.amount)}</div>
                    <div class="timeline-date">${formatDate(bill.next_due)} (${dueText})</div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `<div class="timeline">${timelineItemsHTML}</div>`;
}