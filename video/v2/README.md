# LogoLens Dashboard

A GitHub Pages-ready WebAI prototype for reviewing visible apparel text/logos in uploaded classroom or event videos.

## What it does

- Uploads a student/classroom video in the browser
- Uses TensorFlow.js + COCO-SSD to detect students/people
- Crops likely shirt/sweatshirt regions
- Uses Tesseract.js OCR to read visible clothing text
- Flags keywords like:
  - Ohio State
  - Columbia
  - NKU
  - UC
  - Cincinnati
  - Miami
  - Nike
  - Adidas
  - Champion
  - Under Armour
- Prints a dashboard summary
- Shows evidence cards with timestamps and clothing crops
- Exports CSV and JSON
- Includes a print-friendly dashboard view

## Files

```text
index.html
styles.css
app.js
README.md
```

## How to deploy to GitHub Pages

1. Create a new GitHub repository, for example: `logolens-dashboard`
2. Upload these files:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `README.md`
3. Go to **Settings > Pages**
4. Under **Build and deployment**, choose:
   - Source: Deploy from a branch
   - Branch: `main`
   - Folder: `/root`
5. Open the published GitHub Pages URL.

## How to use

1. Open the page.
2. Upload a video.
3. Adjust sampling settings if needed.
4. Edit the keywords if you want to search for additional brands/universities.
5. Click **Analyze Video**.
6. Review the summary dashboard and evidence cards.
7. Export CSV/JSON or print the dashboard.

## Important limitation

This version does not use a custom-trained logo model.

It uses:
- TensorFlow.js to detect people
- OCR to read visible apparel text
- keyword matching to group detections

This means it works best when the clothing has readable text like `OHIO STATE` or `Columbia`.

For icon-only logos, small logos, blurry text, or partially blocked clothing, results may need manual review.

## Recommended next version

A more advanced version could add:

- Uploaded reference-logo matching
- A custom TensorFlow.js classifier trained on apparel examples
- Automatic duplicate reduction so the same shirt is counted once instead of across multiple frames
- PDF report export
- Better torso tracking across frames
