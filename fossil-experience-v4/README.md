# CMC Fossil Experience V4 — QR Field Study (Google Edition)

V4 is optimized for NKU AI Day:

**QR → visitor phone → local fossil scan → museum interaction → anonymous event rows in Google Sheets**

## Simplified architecture

### GitHub Pages
Hosts the mobile visitor experience and the frozen `training.json` classifier.

### TensorFlow.js
Runs MobileNet + KNN locally in each visitor's browser. Camera frames are not uploaded.

### Google Apps Script + Google Sheets
Receives anonymous event data and writes one event per row to a shared research Sheet.

No Cloudflare Worker or database is required.

## Setup

See `google-apps-script/SETUP.md`.

## Research data

The Sheet captures:
- session id
- event type and timestamps
- scan attempts
- scan confidence and class probabilities
- scan time
- observation choice
- looked-closer response
- desired next action
- manual bypass
- total experience time
- screen progression
- user agent

## Model publishing

Use `admin.html` to train the three classes and download `training.json`. Replace the static file in this folder before AI Day.

## Research boundary

This is a formative visitor-experience study. It tests interaction value and scan usability for one trained fossil instance. It does not validate general fossil identification or a production museum system.
