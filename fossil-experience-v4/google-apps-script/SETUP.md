# Google Sheets setup for V4

V4 uses Google Apps Script only as an anonymous event collector. Fossil recognition stays entirely in the visitor's browser and loads the frozen classifier from `training.json`.

## One-time setup

1. Create a new Google Sheet named **CMC Fossil Experience — AI Day Research**.
2. In that Sheet, open **Extensions → Apps Script**.
3. Replace the starter code with the contents of `Code.gs` in this folder.
4. Run `setupWorkbook()` once and approve permissions.
5. Choose **Deploy → New deployment → Web app**.
6. Execute as: **Me**.
7. Who has access: choose the broadest option your NKU Google account allows for anonymous AI Day visitors.
8. Copy the deployed **Web app URL**.
9. Put that URL into `fossil-experience-v4/config.js` as `GOOGLE_SCRIPT_URL`.
10. Put the Google Sheet URL into `GOOGLE_SHEET_URL`.

## Fossil model

1. Open `admin.html`.
2. Train at least 10 examples per class.
3. Download `training.json`.
4. Replace the repository's `fossil-experience-v4/training.json` with the downloaded file.
5. Wait for GitHub Pages to deploy.
6. Test the public visitor URL from a different phone.

No visitor camera image is uploaded. The Sheet receives anonymous event/timing records only.
