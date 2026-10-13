# Subscription Leak Detector

A beginner-friendly subscription management dashboard built with **HTML, CSS and Vanilla JavaScript**. No React, package installation, server, or database is needed.

## Run it

1. Extract the ZIP.
2. Open the folder in VS Code.
3. Run `index.html` with the VS Code Live Server extension (recommended), or open the file in a modern browser.
4. Add your subscriptions or select **Load demo data**.

## Features

- Dashboard with active monthly spend, estimated annual spend, reviewable savings estimate and upcoming renewals.
- Add, edit and delete subscriptions.
- Track category, price, currency, billing cycle, next renewal date, usage, last-used date, trial end date, auto-renew, status and notes.
- Search by name, category or notes.
- Filter by status, possible leaks, free trials, upcoming renewals, unused services and category overlaps.
- Sort by renewal date, service name or monthly cost.
- Renewal calendar with previous/next month controls and clickable subscription entries.
- Renewal and trial-ending browser notifications for items due within 7 days, with duplicate prevention.
- Notification permission and test button in Settings.
- Leak insights for low usage, unused plans, same-category overlap and trial/renewal risk.
- Real category spending bars based on subscription prices (not random data).
- Display currency selection with offline approximate conversion rates.
- Dark mode, responsive mobile sidebar, localStorage persistence.
- JSON export and JSON import/restore.
- Demo data and clear-data controls.
- Basic form validation and safe escaping of user-entered text in generated HTML.

## Notification limitation

Browser notifications are checked when the page opens, when you return to the tab, and every six hours while the page remains open. Notifications require browser permission and a supported browser context such as `localhost` via Live Server. If the page/browser is fully closed, this simple frontend cannot guarantee notifications. True background push reminders need a service worker, push subscription and a backend/scheduler.

## Currency note

Conversion rates in `app.js` are static approximate values intended for a demo. They are not live exchange rates and should not be used for financial decisions.

## Leak detection note

The app gives review signals, not automatic financial advice. Same-category services are marked for review but may serve different needs. The savings estimate only counts active subscriptions you marked as low usage or not used, and assumes cancelling them would save their full annualized cost.

## Data and privacy

Subscriptions are saved in this browser's `localStorage`. Clearing browser site data can remove them. Export a JSON backup regularly if you want to keep your data. No subscription data is sent to a server by this project.
