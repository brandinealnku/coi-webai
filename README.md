# WorkTrail AI Starter V7

A GitHub Pages-friendly starter for a **personal activity intelligence app**.

## What this version does
- Lets you log activity sessions manually
- Organizes sessions into projects and categories
- Supports smart auto-organization rules
- Stores dashboard data locally in the browser using `localStorage`
- Imports and exports JSON
- Connects to the Chrome extension for browser-session imports
- Supports desktop JSON import from the Electron companion
- Skips duplicate imports automatically using a fingerprint
- Adds stronger **Reports** with longest session, focus blocks, unassigned time, and suggested rules
- Lets you delete imported or manual sessions directly from the dashboard

## What is included
- `index.html` — dashboard UI
- `styles.css` — app styling
- `app.js` — dashboard logic, local storage, rules, reports, import/export, dedupe, extension import, desktop import
- `browser-extension/` — Chrome extension scaffold for browser tracking
- `desktop-companion/` — Electron companion with active-window tracking and SQLite persistence

## Best new additions in V7
- **Desktop companion now uses SQLite** via Node’s built-in `node:sqlite` API
- **Daily recap** added to the desktop app
- **Suggested rules** added to dashboard reports so repeated unassigned work is easier to organize
- **Fingerprint-based dedupe** made more consistent across imports
- **Legacy state migration** from earlier dashboard versions

## Important limitation
This version is now a much stronger starter system, but it is still not a fully packaged production tracker.

It can:
- organize activity locally
- import browser sessions
- capture desktop sessions locally
- persist desktop sessions in SQLite
- produce useful summaries and suggestions

It still does **not yet**:
- live-sync browser and desktop data into one shared local database automatically
- run as a silent tray app
- package installers for distribution
- generate true LLM-powered AI summaries automatically

## Fastest way to test the dashboard
1. Open the dashboard locally or host it on GitHub Pages.
2. Click **Load demo data**.
3. Open **Timeline** and **Reports**.
4. Try importing the sample desktop JSON.
5. If using Chrome, connect the extension and import browser sessions.

## Fastest way to test the desktop companion
1. Open the `desktop-companion` folder.
2. Run `npm install`.
3. Run `npm start`.
4. Click **Start tracking**.
5. Switch between a few apps or browser tabs.
6. Click **Export JSON** and import that file into the dashboard.
7. Use **Open data folder** to inspect the local SQLite DB and latest export JSON.

## Desktop companion notes
- Local DB path: created in Electron's app data folder as `worktrail.db`
- Latest JSON export file: `worktrail-latest-export.json`
- Session schema: see `desktop-companion/schema.sql`

## Best next upgrade after V7
The strongest next step is **Version 8**:
- shared local ingestion layer for browser + desktop
- optional tray mode
- project suggestions promoted into the timeline UI
- optional daily recap generation from a model API
