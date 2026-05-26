# LogoLens AI V2

A GitHub Pages-friendly WebAI prototype that identifies possible logos/apparel without training a custom model.

## What V2 does

- Upload a classroom/event video
- Detect people with TensorFlow.js + COCO-SSD
- Crop likely shirt/sweatshirt regions
- Run OCR with Tesseract.js to read visible apparel text
- Flag keywords like Ohio State, Buckeyes, OSU, NKU, UC, Cincinnati, Miami, Nike, Adidas
- Optionally upload reference logo images
- Compare shirt crops to reference images with simple image similarity
- Export CSV and JSON results

## Important limitation

This is not the same as a trained logo detector. V2 can detect likely text and weak visual similarity, but it may miss logos, misread text, or create false matches.

## How to use

1. Open `index.html` in a browser or deploy to GitHub Pages.
2. Upload your classroom demo video.
3. Optionally upload reference images/logos, such as `Ohio-State-logo.png` or `NKU-logo.png`.
4. Click **Analyze Video**.
5. Review detected shirt/logo candidates.
6. Export CSV or JSON.

## GitHub Pages setup

1. Create a new GitHub repo.
2. Upload `index.html`, `styles.css`, `app.js`, and `README.md`.
3. Go to Settings > Pages.
4. Deploy from the `main` branch.
5. Open your published GitHub Pages URL.

## Recommended V3

Use V2 results to collect examples and train a small TensorFlow.js image classifier.
