# WorkTrail Desktop Companion V5

This folder now includes a **real local active-window tracking starter** that persists sessions on your machine.

## What it does now
- Opens as an Electron desktop app
- Polls the **frontmost active window** on your machine every 5 seconds by default
- Groups time into sessions when the active app or title changes
- Tracks app name, window title, optional browser URL when available, and timestamps
- Saves session history locally in Electron's user data folder
- Auto-writes a latest export JSON file locally for easier importing
- Exports JSON in a shape the GitHub Pages dashboard can import
- Lets you change the poll interval and ignore lists from the UI

## What it still is not
- a polished installer
- a tray app that starts automatically on login
- a SQLite-backed production app yet
- a full live sync bridge into the dashboard

## Setup
1. Open a terminal in the `desktop-companion` folder.
2. Run:
   ```bash
   npm install
   ```
3. Start the app:
   ```bash
   npm start
   ```
4. Click **Start tracking**.
5. Work on your machine for a bit.
6. Click **Export JSON**.
7. Import that file into the main WorkTrail dashboard from the Settings view.

## Local files
The app stores local files in Electron's app data folder, including:
- `worktrail-sessions.json`
- `worktrail-settings.json`
- `worktrail-latest-export.json`

You can view the latest export path from inside the app.

## Dependency used
This starter uses the `active-win` package to read the currently active window locally on your computer.

## Suggested next upgrade
The best next step is adding:
- SQLite storage
- tray/background mode
- app exclusion presets
- direct dashboard sync
- local AI summaries
