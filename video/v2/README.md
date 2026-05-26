# LogoLens AI

A GitHub Pages-friendly WebAI prototype inspired by a classroom demo video where a student appeared in an Ohio State sweatshirt.

This version helps you upload a video, detect people, crop likely shirt/logo regions, manually label those regions, and export a dataset foundation for future custom logo detection.

## What this version does

- Uploads a video locally in the browser
- Samples frames every 0.5, 1, 2, or 3 seconds
- Uses TensorFlow.js and COCO-SSD to detect people
- Crops likely torso/shirt regions
- Creates a visual review gallery
- Lets you manually label shirt/logo candidates
- Exports CSV and JSON metadata

## What this version does not do yet

This version does not truly recognize specific logos like Ohio State, NKU, Nike, Adidas, etc.

COCO-SSD detects general objects. It does not know brand logos or university apparel.

## How to deploy on GitHub Pages

1. Create a new GitHub repository named something like `logolens-ai`
2. Upload these files:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `README.md`
3. Go to **Settings > Pages**
4. Under **Build and deployment**, choose:
   - Source: Deploy from a branch
   - Branch: main
   - Folder: `/root`
5. Open your GitHub Pages link.

## Recommended V3

1. Use this page to capture shirt/logo crops.
2. Save screenshots/crops into folders like:

```text
dataset/
  ohio-state/
  nku/
  nike/
  adidas/
  unknown/
```

3. Train with Teachable Machine or TensorFlow transfer learning.
4. Export the model as TensorFlow.js.
5. Add the model to this app.
6. Replace manual review with predictions such as `Ohio State sweatshirt — 91% confidence`.

## Privacy note

This prototype runs in the browser. Uploaded videos are not sent to a server by this app.
