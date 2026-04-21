# WorkTrail Desktop Companion V7

This Electron app tracks the frontmost app/window locally and stores finalized sessions in a local SQLite database.

## Included in V7
- active window polling with `active-win`
- local SQLite persistence using `node:sqlite`
- latest export JSON file for dashboard import
- manual JSON export
- ignored apps and title filters
- daily recap in the desktop UI

## Run locally
```bash
npm install
npm start
```

## Data files
- SQLite database: `worktrail.db`
- Latest export JSON: `worktrail-latest-export.json`
- Settings JSON: `worktrail-settings.json`

These are created in Electron's app data folder for your OS.
