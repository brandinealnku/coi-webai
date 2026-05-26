# LogoLens Safe Promo Blur

A GitHub Pages-ready WebAI prototype for blurring clothing text/logos in student videos before posting promotional content to social media.

## Why this version exists

If OCR is not reliably identifying logos/text because the uploaded video already has overlays, bounding boxes, motion blur, or small shirt text, the safer strategy is:

> Detect people → blur likely shirt/sweatshirt text regions → export a clean promotional version.

This avoids needing to correctly identify every logo or competitor name.

## What it does

- Uploads a local video in the browser
- Uses TensorFlow.js + COCO-SSD to detect people
- Automatically estimates the torso/chest region
- Blurs/pixelates that clothing region
- Lets you tune:
  - blur strength
  - how low the blur begins
  - blur region height
  - blur region width
  - detection confidence
- Saves review snapshots
- Exports a blurred video as `.webm`
- Exports a CSV summary

## Files

```text
index.html
styles.css
app.js
README.md
```

## Deploy to GitHub Pages

1. Create a new GitHub repository, for example: `logolens-safe-promo-blur`
2. Upload:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `README.md`
3. Go to **Settings > Pages**
4. Choose:
   - Source: Deploy from a branch
   - Branch: `main`
   - Folder: `/root`
5. Open your GitHub Pages URL.

## How to use

1. Upload your student video.
2. Click **Preview Blur**.
3. Adjust the sliders until clothing text/logos are covered.
4. Use **Save Review Snapshot** to capture evidence of the blur settings.
5. Click **Export Blurred Video**.
6. The exported file will download as `.webm`.

## Note about MP4

Most browsers export canvas video as WEBM, not MP4. You can convert the downloaded WEBM to MP4 using:

- Canva
- CapCut
- Adobe Express
- HandBrake
- CloudConvert
- ffmpeg

Example ffmpeg command:

```bash
ffmpeg -i input.webm -c:v libx264 -pix_fmt yuv420p output.mp4
```

## Why this is better for your use case

Your goal is not really “identify Ohio State or Columbia.”

Your goal is:

> Make promotional videos safe to post without displaying competitor universities or distracting clothing brand text.

This version focuses directly on that outcome.
