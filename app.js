/* =========================================================
   SUBSCRIPTION LEAK DETECTOR
   Beginner-friendly HTML, CSS and Vanilla JavaScript
   All data is stored locally in this browser.
========================================================= */

/* 1. APP DATA AND SETTINGS */

const STORAGE_KEY = "sld_subscriptions_v2";
const OLD_STORAGE_KEY = "subscriptions";

let subscriptions = readSavedSubscriptions();
let currentPage = "dashboard";
let selectedCurrency = localStorage.getItem("sld_currency") || "INR";
let calendarMonth = new Date();
let toastTimer;

/* Approximate offline rates. They are for display/demo only, not live FX rates. */
const currencyRates = {
    INR: 1,
    USD: 0.012,
    EUR: 0.011,
    GBP: 0.0095,
    AED: 0.044,
    SGD: 0.016
};

const currencySymbols = {
    INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "د.إ ", SGD: "S$"
};

const content = document.getElementById("content");
const pageTitle = document.getElementById("pageTitle");
const pageEyebrow = document.getElementById("pageEyebrow");
const modal = document.getElementById("modal");
const form = document.getElementById("subscriptionForm");
const currencySelect = document.getElementById("currencySelect");
const importFile = document.getElementById("importFile");

/* 2. LOAD AND SAVE */

function readSavedSubscriptions() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(OLD_STORAGE_KEY);
        const parsed = saved ? JSON.parse(saved) : [];
        return Array.isArray(parsed) ? parsed.map(cleanSubscription) : [];
    } catch (error) {
        console.warn("Saved subscriptions could not be read.", error);
        return [];
    }
}

function cleanSubscription(sub) {
    return {
        id: String(sub.id || makeId()),
        name: String(sub.name || "Unnamed service"),
        category: String(sub.category || "Other"),
        price: Math.max(0, Number(sub.price) || 0),
        currency: currencyRates[sub.currency] ? sub.currency : "INR",
        billing: sub.billing === "yearly" ? "yearly" : "monthly",
        renewalDate: validDateString(sub.renewalDate) ? sub.renewalDate : todayString(),
        usage: ["high", "medium", "low", "none"].includes(sub.usage) ? sub.usage : "medium",
        lastUsed: validDateString(sub.lastUsed) ? sub.lastUsed : "",
        trial: Boolean(sub.trial),
        trialEndDate: validDateString(sub.trialEndDate) ? sub.trialEndDate : "",
        autoRenew: sub.autoRenew !== false,
        status: ["active", "paused", "cancelled"].includes(sub.status) ? sub.status : "active",
        notes: String(sub.notes || "")
    };
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(subscriptions));
}

/* 3. SMALL HELPERS */

function makeId() {
    return "sub-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (character) {
        return {
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[character];
    });
}

function todayString() {
    const today = new Date();
    return dateToString(today);
}

function dateToString(date) {
    return date.getFullYear() + "-" +
        String(date.getMonth() + 1).padStart(2, "0") + "-" +
        String(date.getDate()).padStart(2, "0");
}

function validDateString(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(new Date(value + "T12:00:00").getTime());
}

function dateFromString(value) {
    return new Date(value + "T12:00:00");
}

function daysUntil(value) {
    if (!validDateString(value)) return null;
    const today = dateFromString(todayString());
    const target = dateFromString(value);
    return Math.round((target - today) / 86400000);
}

function formatDate(value) {
    if (!validDateString(value)) return "Not set";
    return dateFromString(value).toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric"
    });
}

function money(amount, currency = selectedCurrency) {
    const symbol = currencySymbols[currency] || currency + " ";
    return symbol + Number(amount || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 0, maximumFractionDigits: 2
    });
}

function convertMoney(amount, fromCurrency) {
    const amountInINR = Number(amount || 0) / currencyRates[fromCurrency];
    return amountInINR * currencyRates[selectedCurrency];
}

function monthlyPrice(sub) {
    return sub.billing === "yearly" ? sub.price / 12 : sub.price;
}

function monthlyCost(sub) {
    return convertMoney(monthlyPrice(sub), sub.currency);
}

function yearlyCost(sub) {
    return monthlyCost(sub) * 12;
}

function isActive(sub) {
    return sub.status === "active";
}

function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
        toast.classList.remove("show");
    }, 2800);
}

function emptyState(title, message) {
    return `<div class="empty-state"><div class="empty-icon">○</div><h3>${escapeHTML(title)}</h3><p>${escapeHTML(message)}</p></div>`;
}

function pageHeader(title, subtitle, button = "") {
    return `<div class="page-header"><div><h1>${title}</h1><p class="muted">${subtitle}</p></div>${button}</div>`;
}

function addButton() {
    return '<button class="main-button" id="addButton">＋ Add subscription</button>';
}

/* 4. LEAK AND RISK CHECKS */

function isTrialEndingSoon(sub) {
    if (!sub.trial || !sub.trialEndDate || !isActive(sub)) return false;
    const days = daysUntil(sub.trialEndDate);
    return days !== null && days >= 0 && days <= 7;
}

function isRenewingSoon(sub, windowDays = 7) {
    if (!isActive(sub) || !sub.autoRenew) return false;
    const days = daysUntil(sub.renewalDate);
    return days !== null && days >= 0 && days <= windowDays;
}

function overlappingSubscriptions() {
    const groups = {};
    subscriptions.filter(isActive).forEach(function (sub) {
        const key = sub.category.toLowerCase();
        if (!groups[key]) groups[key] = [];
        groups[key].push(sub);
    });
    const overlaps = new Set();
    Object.keys(groups).forEach(function (category) {
        if (groups[category].length > 1) {
            groups[category].forEach(function (sub) {
                overlaps.add(sub.id);
            });
        }
    });
    return overlaps;
}

function leakReasons(sub, overlapIds = overlappingSubscriptions()) {
    const reasons = [];
    if (!isActive(sub)) return reasons;
    if (sub.usage === "none") reasons.push("Not being used");
    else if (sub.usage === "low") reasons.push("Low usage");
    if (overlapIds.has(sub.id)) reasons.push("Category overlap — review");
    if (isTrialEndingSoon(sub)) reasons.push("Trial ends within 7 days");
    if (isRenewingSoon(sub, 7)) reasons.push("Renews within 7 days");
    return reasons;
}

/* Conservative estimate: only active plans marked low/unused count here.
   It is an estimate, not a guarantee of actual savings. */
function isSavingsCandidate(sub) {
    return isActive(sub) && (sub.usage === "none" || sub.usage === "low");
}

/* 5. DASHBOARD */

function showDashboard() {
    pageTitle.textContent = "Dashboard";
    pageEyebrow.textContent = "YOUR MONEY, MADE CLEAR";

    const active = subscriptions.filter(isActive);
    const monthlyTotal = active.reduce((sum, sub) => sum + monthlyCost(sub), 0);
    const yearlyTotal = active.reduce((sum, sub) => sum + yearlyCost(sub), 0);
    const savings = active.filter(isSavingsCandidate).reduce((sum, sub) => sum + yearlyCost(sub), 0);
    const upcoming = active.filter(sub => {
        const days = daysUntil(sub.renewalDate);
        return days !== null && days >= 0 && days <= 30 && sub.autoRenew;
    }).length;
    const trials = active.filter(sub => sub.trial).length;
    const overlapIds = overlappingSubscriptions();
    const flagged = active.filter(sub => leakReasons(sub, overlapIds).length > 0);

    const categoryTotals = {};
    active.forEach(function (sub) {
        categoryTotals[sub.category] = (categoryTotals[sub.category] || 0) + monthlyCost(sub);
    });
    const categories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const maxCategory = Math.max(1, ...categories.map(item => item[1]));
    const chart = categories.length ? categories.map(function (item) {
        const width = Math.max(2, (item[1] / maxCategory) * 100);
        return `<div class="chart-row"><div class="chart-label"><span>${escapeHTML(item[0])}</span><strong>${money(item[1])}</strong></div><div class="chart-track"><div class="chart-fill" style="width:${width}%"></div></div></div>`;
    }).join("") : '<p class="muted">Add active subscriptions to see your spending chart.</p>';

    const alertItems = [];
    active.forEach(function (sub) {
        const days = daysUntil(sub.renewalDate);
        if (sub.trial && sub.trialEndDate && daysUntil(sub.trialEndDate) >= 0 && daysUntil(sub.trialEndDate) <= 7) {
            alertItems.push({ level: "warning", name: sub.name, detail: "Trial ends " + formatDate(sub.trialEndDate) });
        } else if (sub.autoRenew && days >= 0 && days <= 7) {
            alertItems.push({ level: "warning", name: sub.name, detail: "Renews " + formatDate(sub.renewalDate) });
        } else if (sub.usage === "none" || sub.usage === "low") {
            alertItems.push({ level: "review", name: sub.name, detail: sub.usage === "none" ? "Marked as not being used" : "Marked as low usage" });
        }
    });
    const alerts = alertItems.slice(0, 5).map(item =>
        `<div class="alert-item ${item.level}"><span class="alert-dot"></span><div><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.detail)}</small></div></div>`
    ).join("") || '<div class="good-state"><span>✓</span><div><strong>You are looking good</strong><p>No urgent alerts found.</p></div></div>';

    content.innerHTML = `
        ${pageHeader("Your subscriptions at a glance", "Understand recurring costs, upcoming charges and possible waste.", addButton())}
        <div class="stats">
            <article class="stat-card"><div class="stat-top"><span>Monthly spend</span><span class="stat-icon">↻</span></div><h2>${money(monthlyTotal)}</h2><p>Across ${active.length} active plan${active.length === 1 ? "" : "s"}</p></article>
            <article class="stat-card"><div class="stat-top"><span>Yearly spend</span><span class="stat-icon">▦</span></div><h2>${money(yearlyTotal)}</h2><p>Estimated annual cost</p></article>
            <article class="stat-card"><div class="stat-top"><span>Possible savings</span><span class="stat-icon">↗</span></div><h2>${money(savings)}</h2><p>Annual cost of low/unused plans</p></article>
            <article class="stat-card"><div class="stat-top"><span>Renewing soon</span><span class="stat-icon">◷</span></div><h2>${upcoming}</h2><p>Auto-renewing in the next 30 days</p></article>
        </div>
        <div class="dashboard-grid">
            <section class="panel"><div class="panel-heading"><div><h2>Monthly spend by category</h2><p>Real totals from your active subscriptions</p></div><span class="subtle-tag">Monthly</span></div>${chart}</section>
            <section class="panel"><div class="panel-heading"><div><h2>Things to review</h2><p>Alerts based on your saved details</p></div><span class="subtle-tag">${alertItems.length} alerts</span></div><div class="alerts-list">${alerts}</div><button class="text-button" id="goInsights">See all insights →</button></section>
        </div>
        <section class="panel section-gap"><div class="panel-heading"><div><h2>Recent subscriptions</h2><p>Your latest saved services</p></div><button class="secondary-button" id="viewAll">View all →</button></div>${createTable([...subscriptions].sort((a,b) => b.id.localeCompare(a.id)).slice(0,5), false)}</section>
    `;

    document.getElementById("addButton").addEventListener("click", openAddModal);
    document.getElementById("viewAll").addEventListener("click", () => changePage("subscriptions"));
    document.getElementById("goInsights").addEventListener("click", () => changePage("insights"));
}

/* 6. SUBSCRIPTIONS LIST, SEARCH, FILTER AND SORT */

function showSubscriptions() {
    pageTitle.textContent = "Subscriptions";
    pageEyebrow.textContent = "YOUR RECURRING PAYMENTS";
    content.innerHTML = `
        ${pageHeader("All subscriptions", "Edit plans, track usage and review their status.", addButton())}
        <section class="panel">
            <div class="filters">
                <input id="search" type="search" placeholder="Search name, category or notes…" aria-label="Search subscriptions">
                <select id="filterStatus" aria-label="Filter status"><option value="all">All statuses</option><option value="active">Active</option><option value="paused">Paused</option><option value="cancelled">Cancelled</option></select>
                <select id="filterType" aria-label="Filter subscription type"><option value="all">All types</option><option value="leaks">Potential leaks</option><option value="trial">Free trials</option><option value="renewing">Renewing in 7 days</option><option value="unused">Unused</option><option value="overlap">Category overlaps</option></select>
                <select id="sortBy" aria-label="Sort subscriptions"><option value="renewal">Sort: renewal date</option><option value="name">Sort: service name</option><option value="costHigh">Sort: highest monthly cost</option><option value="costLow">Sort: lowest monthly cost</option></select>
            </div>
            <div id="subscriptionTable"></div>
        </section>`;
    document.getElementById("addButton").addEventListener("click", openAddModal);
    ["search", "filterStatus", "filterType", "sortBy"].forEach(id => {
        document.getElementById(id).addEventListener(id === "search" ? "input" : "change", updateSubscriptionTable);
    });
    updateSubscriptionTable();
}

function updateSubscriptionTable() {
    const search = document.getElementById("search").value.trim().toLowerCase();
    const status = document.getElementById("filterStatus").value;
    const type = document.getElementById("filterType").value;
    const sortBy = document.getElementById("sortBy").value;
    const overlapIds = overlappingSubscriptions();

    let list = subscriptions.filter(function (sub) {
        const searchable = [sub.name, sub.category, sub.notes].join(" ").toLowerCase();
        if (!searchable.includes(search)) return false;
        if (status !== "all" && sub.status !== status) return false;
        if (type === "leaks" && leakReasons(sub, overlapIds).length === 0) return false;
        if (type === "trial" && !sub.trial) return false;
        if (type === "renewing" && !isRenewingSoon(sub, 7)) return false;
        if (type === "unused" && sub.usage !== "none") return false;
        if (type === "overlap" && !overlapIds.has(sub.id)) return false;
        return true;
    });

    list.sort(function (a, b) {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "costHigh") return monthlyCost(b) - monthlyCost(a);
        if (sortBy === "costLow") return monthlyCost(a) - monthlyCost(b);
        return (daysUntil(a.renewalDate) ?? 999999) - (daysUntil(b.renewalDate) ?? 999999);
    });

    document.getElementById("subscriptionTable").innerHTML = createTable(list, true);
}

/* 7. REUSABLE SUBSCRIPTION TABLE */

function createTable(list, showActions = true) {
    if (!list.length) return emptyState("Nothing here yet", "Try changing the filters or add a subscription.");

    const overlapIds = overlappingSubscriptions();
    const rows = list.map(function (sub) {
        const reasons = leakReasons(sub, overlapIds);
        const statusClass = sub.status === "active" ? "green" : sub.status === "paused" ? "yellow" : "gray";
        const statusLabel = sub.status.charAt(0).toUpperCase() + sub.status.slice(1);
        const days = daysUntil(sub.renewalDate);
        const renewalLabel = days < 0 ? "Past date" : days === 0 ? "Today" : days + " days";
        const risk = reasons.length ? `<span class="badge ${sub.usage === "none" ? "red" : "yellow"}">${escapeHTML(reasons[0])}</span>` : `<span class="badge ${statusClass}">${statusLabel}</span>`;
        return `<tr>
            <td><div class="service-cell"><span class="service-avatar">${escapeHTML(sub.name.slice(0,1).toUpperCase())}</span><div><strong>${escapeHTML(sub.name)}</strong><small>${escapeHTML(sub.category)}${sub.trial ? " · Free trial" : ""}</small></div></div></td>
            <td><strong>${money(monthlyCost(sub))}</strong><small class="table-subtext">/ month</small></td>
            <td><strong>${formatDate(sub.renewalDate)}</strong><small class="table-subtext">${escapeHTML(renewalLabel)}</small></td>
            <td><span class="usage-label">${escapeHTML(sub.usage === "none" ? "Not using" : sub.usage)}</span></td>
            <td>${risk}</td>
            ${showActions ? `<td class="actions-cell"><button class="action-button" data-action="edit" data-id="${escapeHTML(sub.id)}">Edit</button><button class="action-button danger-action" data-action="delete" data-id="${escapeHTML(sub.id)}">Delete</button></td>` : ""}
        </tr>`;
    }).join("");

    return `<div class="table-wrap"><table><thead><tr><th>Service</th><th>Monthly cost</th><th>Next renewal</th><th>Usage</th><th>Review</th>${showActions ? "<th>Actions</th>" : ""}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

/* 8. RENEWAL LIST AND MONTH CALENDAR */

function showRenewals() {
    pageTitle.textContent = "Renewals & calendar";
    pageEyebrow.textContent = "PLAN AHEAD, AVOID SURPRISES";

    const monthName = calendarMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
    const byDay = {};

    subscriptions.filter(isActive).forEach(function (sub) {
        if (!validDateString(sub.renewalDate)) return;
        const date = dateFromString(sub.renewalDate);
        if (date.getFullYear() === calendarMonth.getFullYear() && date.getMonth() === calendarMonth.getMonth()) {
            const day = date.getDate();
            if (!byDay[day]) byDay[day] = [];
            byDay[day].push(sub);
        }
    });

    const cells = [];
    ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].forEach(day => cells.push(`<div class="calendar-weekday">${day}</div>`));
    for (let i = 0; i < startOffset; i++) cells.push('<div class="calendar-day outside"></div>');
    for (let day = 1; day <= daysInMonth; day++) {
        const dayDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
        const key = dateToString(dayDate);
        const todayClass = key === todayString() ? " today" : "";
        const items = (byDay[day] || []).map(sub => `<button class="calendar-event" data-calendar-id="${escapeHTML(sub.id)}" title="${escapeHTML(sub.name)} — ${money(monthlyCost(sub))}">${escapeHTML(sub.name)} <small>${money(monthlyCost(sub))}</small></button>`).join("");
        cells.push(`<div class="calendar-day${todayClass}"><span class="calendar-number">${day}</span>${items}</div>`);
    }
    while (cells.length % 7 !== 0) cells.push('<div class="calendar-day outside"></div>');

    const upcoming = subscriptions.filter(sub => isActive(sub) && daysUntil(sub.renewalDate) >= 0)
        .sort((a,b) => daysUntil(a.renewalDate) - daysUntil(b.renewalDate));
    const list = upcoming.length ? upcoming.slice(0, 10).map(function (sub) {
        const days = daysUntil(sub.renewalDate);
        const label = days === 0 ? "Renews today" : days === 1 ? "Tomorrow" : "In " + days + " days";
        return `<div class="renewal-row"><div class="service-avatar">${escapeHTML(sub.name.slice(0,1).toUpperCase())}</div><div class="renewal-main"><strong>${escapeHTML(sub.name)}</strong><small>${formatDate(sub.renewalDate)} · ${escapeHTML(sub.billing)} billing</small></div><div class="renewal-price"><strong>${money(convertMoney(sub.price, sub.currency))}</strong><small>${label}</small></div></div>`;
    }).join("") : emptyState("No upcoming renewals", "Active subscriptions with future dates will show here.");

    content.innerHTML = `
        ${pageHeader("Renewals calendar", "See upcoming charges and plan ahead.")}
        <section class="panel calendar-panel">
            <div class="calendar-toolbar"><button class="secondary-button" id="previousMonth">←</button><h2>${monthName}</h2><button class="secondary-button" id="nextMonth">→</button><button class="text-button" id="thisMonth">Today</button></div>
            <div class="calendar-grid">${cells.join("")}</div>
            <p class="calendar-note">Select a subscription event to edit its details. Calendar dates use the renewal dates you entered.</p>
        </section>
        <section class="panel section-gap"><div class="panel-heading"><div><h2>Next charges</h2><p>Upcoming active subscriptions, nearest first</p></div></div><div class="renewal-list">${list}</div></section>`;

    document.getElementById("previousMonth").addEventListener("click", () => { calendarMonth.setMonth(calendarMonth.getMonth() - 1); showRenewals(); });
    document.getElementById("nextMonth").addEventListener("click", () => { calendarMonth.setMonth(calendarMonth.getMonth() + 1); showRenewals(); });
    document.getElementById("thisMonth").addEventListener("click", () => { calendarMonth = new Date(); showRenewals(); });
}

/* 9. INSIGHTS */

function showInsights() {
    pageTitle.textContent = "Leak insights";
    pageEyebrow.textContent = "MAKE EVERY SUBSCRIPTION COUNT";

    const active = subscriptions.filter(isActive);
    const overlapIds = overlappingSubscriptions();
    const unused = active.filter(sub => sub.usage === "none");
    const lowUse = active.filter(sub => sub.usage === "low");
    const trials = active.filter(sub => sub.trial);
    const trialSoon = trials.filter(sub => sub.trialEndDate && daysUntil(sub.trialEndDate) >= 0 && daysUntil(sub.trialEndDate) <= 7);
    const overlaps = active.filter(sub => overlapIds.has(sub.id));
    const savings = active.filter(isSavingsCandidate).reduce((sum, sub) => sum + yearlyCost(sub), 0);
    const categoryTotals = {};

    active.forEach(sub => categoryTotals[sub.category] = (categoryTotals[sub.category] || 0) + monthlyCost(sub));
    const categoryCards = Object.entries(categoryTotals).sort((a,b) => b[1] - a[1]).map(([name, total]) =>
        `<div class="category-summary"><span>${escapeHTML(name)}</span><strong>${money(total)}<small>/month</small></strong></div>`
    ).join("");

    const risks = active.filter(sub => leakReasons(sub, overlapIds).length).map(sub => {
        const reasons = leakReasons(sub, overlapIds);
        return `<div class="risk-row"><div><strong>${escapeHTML(sub.name)}</strong><p>${escapeHTML(reasons.join(" · "))}</p></div><strong>${money(yearlyCost(sub))}<small>/year</small></strong></div>`;
    }).join("");

    content.innerHTML = `
        ${pageHeader("Your leak report", "Review these signals before deciding what to keep or cancel.")}
        <div class="stats three-stats">
            <article class="stat-card"><div class="stat-top"><span>Unused plans</span><span class="stat-icon">◌</span></div><h2>${unused.length}</h2><p>${money(unused.reduce((sum,sub) => sum + yearlyCost(sub),0))} yearly cost</p></article>
            <article class="stat-card"><div class="stat-top"><span>Low-usage plans</span><span class="stat-icon">⌁</span></div><h2>${lowUse.length}</h2><p>${money(lowUse.reduce((sum,sub) => sum + yearlyCost(sub),0))} yearly cost</p></article>
            <article class="stat-card"><div class="stat-top"><span>Trials running</span><span class="stat-icon">✦</span></div><h2>${trials.length}</h2><p>${trialSoon.length} ending within 7 days</p></article>
        </div>
        <div class="dashboard-grid section-gap">
            <section class="panel"><div class="panel-heading"><div><h2>Plans to review</h2><p>Signals are suggestions, not automatic cancellation advice</p></div><span class="subtle-tag">${active.filter(sub => leakReasons(sub, overlapIds).length).length} flagged</span></div>
                ${risks || emptyState("No obvious leaks found", "Keep your usage details updated for better insights.")}
            </section>
            <section class="panel"><div class="panel-heading"><div><h2>Spending by category</h2><p>Monthly equivalent</p></div></div>
                ${categoryCards || '<p class="muted">No active subscriptions yet.</p>'}
            </section>
        </div>
        <section class="panel section-gap"><div class="panel-heading"><div><h2>Potential savings estimate</h2><p>Annual cost of active subscriptions marked low-use or unused. Actual savings depend on whether you cancel.</p></div></div><div class="big-saving">${money(savings)}<span>/ year</span></div><p class="muted">Category overlap is a prompt to review plans in the same category; it does not assume they are identical.</p></section>`;
}

/* 10. SETTINGS, NOTIFICATIONS AND BACKUPS */

function showSettings() {
    pageTitle.textContent = "Settings & backup";
    pageEyebrow.textContent = "YOUR DATA, YOUR CHOICE";
    const permission = ("Notification" in window) ? Notification.permission : "unsupported";
    const permissionText = permission === "granted" ? "Enabled in this browser" : permission === "denied" ? "Blocked in browser settings" : permission === "unsupported" ? "Not supported by this browser" : "Not enabled yet";
    content.innerHTML = `
        ${pageHeader("Settings & data", "Control reminders, preferences and your backup files.")}
        <div class="settings-grid">
            <section class="panel"><div class="panel-heading"><div><h2>Renewal reminders</h2><p>Alerts for renewals and trial endings in the next 7 days.</p></div><span class="status-pill">${escapeHTML(permissionText)}</span></div>
                <p class="muted">Browser notifications work while this page is open. For alerts when the website is closed, a push service and backend are required.</p>
                <button class="main-button" id="enableNotifications">${permission === "granted" ? "Send test notification" : "Enable notifications"}</button>
                <button class="secondary-button" id="checkReminders">Check reminders now</button>
                <p class="form-help">The app checks when opened and periodically while it remains open. The browser may ask permission only once.</p>
            </section>
            <section class="panel"><div class="panel-heading"><div><h2>Preferences</h2></div></div>
                <div class="setting-line"><span>Display currency</span><strong>${selectedCurrency}</strong></div>
                <div class="setting-line"><span>Active subscriptions</span><strong>${subscriptions.filter(isActive).length}</strong></div>
                <div class="setting-line"><span>All saved subscriptions</span><strong>${subscriptions.length}</strong></div>
                <div class="setting-line"><span>Data storage</span><strong>Only this browser</strong></div>
            </section>
            <section class="panel"><div class="panel-heading"><div><h2>Backup & restore</h2><p>Keep a copy of your data or move it to another browser.</p></div></div>
                <div class="button-stack"><button class="main-button" id="exportButton">↓ Export JSON backup</button><button class="secondary-button" id="importButton">↑ Import JSON backup</button></div>
                <p class="form-help">Import replaces the current list after you confirm. Export a backup before importing if you want to keep the current list.</p>
            </section>
            <section class="panel"><div class="panel-heading"><div><h2>Demo data</h2></div></div>
                <p class="muted">Load example services to explore the dashboard. This replaces your current list, so export first if needed.</p>
                <button class="secondary-button" id="demoButton2">Replace with demo data</button>
            </section>
        </div>`;
    document.getElementById("enableNotifications").addEventListener("click", enableNotifications);
    document.getElementById("checkReminders").addEventListener("click", () => checkRenewalNotifications(true));
    document.getElementById("exportButton").addEventListener("click", exportData);
    document.getElementById("importButton").addEventListener("click", () => importFile.click());
    document.getElementById("demoButton2").addEventListener("click", loadDemoData);
}

/* 11. NAVIGATION */

function changePage(page) {
    currentPage = page;
    document.querySelectorAll(".nav-button").forEach(button => {
        button.classList.toggle("active", button.dataset.page === page);
    });

    if (page === "dashboard") showDashboard();
    else if (page === "subscriptions") showSubscriptions();
    else if (page === "renewals") showRenewals();
    else if (page === "insights") showInsights();
    else if (page === "settings") showSettings();

    document.getElementById("sidebar").classList.remove("open");
}

/* 12. ADD AND EDIT MODAL */

function openAddModal() {
    form.reset();
    document.getElementById("subscriptionId").value = "";
    document.getElementById("modalTitle").textContent = "Add subscription";
    document.getElementById("formError").textContent = "";
    document.getElementById("subCurrency").value = selectedCurrency;
    document.getElementById("renewalDate").value = todayString();
    document.getElementById("autoRenew").checked = true;
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
    document.getElementById("serviceName").focus();
}

function openEditModal(id) {
    const sub = subscriptions.find(item => item.id === id);
    if (!sub) return;

    document.getElementById("subscriptionId").value = sub.id;
    document.getElementById("serviceName").value = sub.name;
    document.getElementById("category").value = sub.category;
    document.getElementById("price").value = sub.price;
    document.getElementById("subCurrency").value = sub.currency;
    document.getElementById("billing").value = sub.billing;
    document.getElementById("renewalDate").value = sub.renewalDate;
    document.getElementById("usage").value = sub.usage;
    document.getElementById("lastUsed").value = sub.lastUsed || "";
    document.getElementById("trial").checked = sub.trial;
    document.getElementById("trialEndDate").value = sub.trialEndDate || "";
    document.getElementById("autoRenew").checked = sub.autoRenew;
    document.getElementById("status").value = sub.status;
    document.getElementById("notes").value = sub.notes || "";
    document.getElementById("modalTitle").textContent = "Edit subscription";
    document.getElementById("formError").textContent = "";
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
}

/* 13. SAVE FORM AND VALIDATE INPUT */

form.addEventListener("submit", function (event) {
    event.preventDefault();
    const errorBox = document.getElementById("formError");
    const name = document.getElementById("serviceName").value.trim();
    const category = document.getElementById("category").value;
    const price = Number(document.getElementById("price").value);
    const renewalDate = document.getElementById("renewalDate").value;
    const trial = document.getElementById("trial").checked;
    const trialEndDate = document.getElementById("trialEndDate").value;

    if (!name || !category || !Number.isFinite(price) || price <= 0 || !validDateString(renewalDate)) {
        errorBox.textContent = "Please enter a service name, category, positive price and valid renewal date.";
        return;
    }
    if (trial && !validDateString(trialEndDate)) {
        errorBox.textContent = "Please add the free-trial end date so reminders can work.";
        return;
    }
    if (trial && daysUntil(trialEndDate) < 0) {
        errorBox.textContent = "The free-trial end date is in the past. Update it or uncheck free trial.";
        return;
    }

    const id = document.getElementById("subscriptionId").value;
    const old = subscriptions.find(sub => sub.id === id);
    const subscription = cleanSubscription({
        id: id || makeId(),
        name, category, price,
        currency: document.getElementById("subCurrency").value,
        billing: document.getElementById("billing").value,
        renewalDate,
        usage: document.getElementById("usage").value,
        lastUsed: document.getElementById("lastUsed").value,
        trial,
        trialEndDate: trial ? trialEndDate : "",
        autoRenew: document.getElementById("autoRenew").checked,
        status: document.getElementById("status").value,
        notes: document.getElementById("notes").value.trim()
    });

    if (old) subscriptions = subscriptions.map(sub => sub.id === id ? subscription : sub);
    else subscriptions.push(subscription);

    saveData();
    closeModal();
    showToast(old ? "Subscription updated" : "Subscription added");
    changePage(currentPage);
    checkRenewalNotifications(false);
});

/* 14. DELEGATED EDIT AND DELETE EVENTS */

document.addEventListener("click", function (event) {
    const button = event.target.closest("[data-action]");
    if (button) {
        const id = button.dataset.id;
        if (button.dataset.action === "edit") openEditModal(id);
        if (button.dataset.action === "delete") {
            const sub = subscriptions.find(item => item.id === id);
            if (!sub || !confirm("Delete " + sub.name + "? This cannot be undone unless you have a backup.")) return;
            subscriptions = subscriptions.filter(item => item.id !== id);
            saveData();
            showToast("Subscription deleted");
            changePage(currentPage);
        }
    }

    const calendarButton = event.target.closest("[data-calendar-id]");
    if (calendarButton) openEditModal(calendarButton.dataset.calendarId);
});

/* 15. DEMO DATA */

function loadDemoData() {
    if (subscriptions.length && !confirm("Replace your current subscriptions with demo data? Export a backup first if needed.")) return;
    const demo = [
        { name: "Netflix", category: "Streaming", price: 649, currency: "INR", billing: "monthly", renewalDate: addDaysToDate(7), usage: "low", lastUsed: addDaysToDate(-18), trial: false, trialEndDate: "", autoRenew: true, status: "active", notes: "Review whether I still use this enough." },
        { name: "Spotify", category: "Music", price: 119, currency: "INR", billing: "monthly", renewalDate: addDaysToDate(14), usage: "high", lastUsed: todayString(), trial: false, trialEndDate: "", autoRenew: true, status: "active", notes: "" },
        { name: "Canva Pro", category: "Software", price: 499, currency: "INR", billing: "monthly", renewalDate: addDaysToDate(3), usage: "none", lastUsed: addDaysToDate(-75), trial: false, trialEndDate: "", autoRenew: true, status: "active", notes: "Example unused plan." },
        { name: "Notion", category: "Software", price: 10, currency: "USD", billing: "monthly", renewalDate: addDaysToDate(10), usage: "medium", lastUsed: addDaysToDate(-2), trial: true, trialEndDate: addDaysToDate(5), autoRenew: true, status: "active", notes: "Example free trial." },
        { name: "Cloud Storage", category: "Cloud", price: 1499, currency: "INR", billing: "yearly", renewalDate: addDaysToDate(25), usage: "high", lastUsed: todayString(), trial: false, trialEndDate: "", autoRenew: false, status: "active", notes: "" }
    ];
    subscriptions = demo.map(sub => cleanSubscription({ ...sub, id: makeId() }));
    saveData();
    showToast("Demo data loaded");
    changePage("dashboard");
    checkRenewalNotifications(false);
}

function addDaysToDate(days) {
    const date = dateFromString(todayString());
    date.setDate(date.getDate() + days);
    return dateToString(date);
}

/* 16. EXPORT AND IMPORT JSON */

function exportData() {
    const backup = {
        app: "Subscription Leak Detector",
        version: 2,
        exportedAt: new Date().toISOString(),
        subscriptions
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "subscription-leak-detector-backup.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Backup exported");
}

importFile.addEventListener("change", async function () {
    const file = importFile.files[0];
    if (!file) return;
    try {
        const parsed = JSON.parse(await file.text());
        const list = Array.isArray(parsed) ? parsed : parsed.subscriptions;
        if (!Array.isArray(list)) throw new Error("The file does not contain a subscriptions list.");
        const cleaned = list.map(cleanSubscription);
        if (!confirm("Import " + cleaned.length + " subscription(s) and replace your current list?")) return;
        subscriptions = cleaned;
        saveData();
        showToast("Backup imported");
        changePage(currentPage);
    } catch (error) {
        alert("Could not import this JSON file. " + error.message);
    } finally {
        importFile.value = "";
    }
});

/* 17. BROWSER NOTIFICATIONS */

function enableNotifications() {
    if (!("Notification" in window)) {
        showToast("This browser does not support notifications.");
        return;
    }
    if (Notification.permission === "denied") {
        alert("Notifications are blocked for this site. Open the browser's site settings and allow notifications.");
        return;
    }
    if (Notification.permission === "granted") {
        new Notification("Subscription Leak Detector", { body: "Test notification is working." });
        showToast("Test notification sent");
        checkRenewalNotifications(false);
        return;
    }
    Notification.requestPermission().then(function (permission) {
        if (permission === "granted") {
            showToast("Notifications enabled");
            new Notification("Subscription Leak Detector", { body: "Renewal and trial reminders are enabled." });
            checkRenewalNotifications(false);
            if (currentPage === "settings") showSettings();
        } else {
            showToast("Notification permission was not granted");
            if (currentPage === "settings") showSettings();
        }
    });
}

function checkRenewalNotifications(showNoAlertsMessage) {
    if (!("Notification" in window) || Notification.permission !== "granted") {
        if (showNoAlertsMessage) showToast("Enable browser notifications first.");
        return;
    }

    let sent = {};
    try {
        sent = JSON.parse(localStorage.getItem("sld_sent_notifications") || "{}");
    } catch (error) {
        sent = {};
    }

    let count = 0;
    subscriptions.filter(isActive).forEach(function (sub) {
        const checks = [];
        if (sub.autoRenew && sub.renewalDate) {
            const days = daysUntil(sub.renewalDate);
            if (days !== null && days >= 0 && days <= 7) {
                checks.push({ type: "renewal", date: sub.renewalDate, message: days === 0 ? "renews today" : "renews in " + days + " day(s)" });
            }
        }
        if (sub.trial && sub.trialEndDate) {
            const days = daysUntil(sub.trialEndDate);
            if (days !== null && days >= 0 && days <= 7) {
                checks.push({ type: "trial", date: sub.trialEndDate, message: days === 0 ? "free trial ends today" : "free trial ends in " + days + " day(s)" });
            }
        }
        checks.forEach(function (item) {
            const key = sub.id + "|" + item.type + "|" + item.date;
            if (sent[key]) return;
            new Notification("Subscription reminder: " + sub.name, {
                body: item.message + ". Review the plan before you are charged.",
                tag: key
            });
            sent[key] = true;
            count++;
        });
    });

    localStorage.setItem("sld_sent_notifications", JSON.stringify(sent));
    if (showNoAlertsMessage) showToast(count ? count + " reminder(s) sent" : "No new reminders due right now");
}

/* 18. CURRENCY, DARK MODE AND NAVIGATION EVENTS */

currencySelect.value = currencyRates[selectedCurrency] ? selectedCurrency : "INR";
selectedCurrency = currencySelect.value;
currencySelect.addEventListener("change", function () {
    selectedCurrency = currencySelect.value;
    localStorage.setItem("sld_currency", selectedCurrency);
    changePage(currentPage);
});

document.getElementById("darkButton").addEventListener("click", function () {
    document.body.classList.toggle("dark");
    const dark = document.body.classList.contains("dark");
    localStorage.setItem("sld_dark_mode", dark ? "true" : "false");
});

if (localStorage.getItem("sld_dark_mode") === "true") document.body.classList.add("dark");

document.querySelectorAll(".nav-button").forEach(button => {
    button.addEventListener("click", () => changePage(button.dataset.page));
});

document.getElementById("closeModal").addEventListener("click", closeModal);
document.getElementById("cancelModal").addEventListener("click", closeModal);
modal.addEventListener("click", event => { if (event.target === modal) closeModal(); });
document.addEventListener("keydown", event => { if (event.key === "Escape") closeModal(); });
document.getElementById("menuButton").addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));

document.getElementById("demoButton").addEventListener("click", loadDemoData);
document.getElementById("clearButton").addEventListener("click", function () {
    if (!confirm("Delete every saved subscription? Export a backup first if you might need this data.")) return;
    subscriptions = [];
    saveData();
    showToast("All subscriptions cleared");
    changePage("dashboard");
});

window.addEventListener("focus", () => checkRenewalNotifications(false));
document.addEventListener("visibilitychange", () => {
    if (!document.hidden) checkRenewalNotifications(false);
});

/* Check on launch and every 6 hours while the page is open. */
changePage("dashboard");
checkRenewalNotifications(false);
setInterval(() => checkRenewalNotifications(false), 6 * 60 * 60 * 1000);
