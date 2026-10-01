# AI Blind Spot

A browser-based AI literacy experiment:

> **AI sees evidence. Humans supply context.**

## What it does

1. Runs local object detection on the user's camera for 12 seconds.
2. Shows only visible object detections — no identity, emotion, age, personality, race, gender, health, or other sensitive-trait inference.
3. Explicitly contrasts **what AI sees** with **what AI cannot know**.
4. Asks the user for one piece of human context the model could not infer.
5. Generates a 1080×1350 share card for LinkedIn / social sharing.

## Architecture

- Static HTML/CSS/JavaScript
- TensorFlow.js
- COCO-SSD object detection
- `getUserMedia()`
- Canvas overlays + share-card rendering
- No backend
- No login
- No image upload
- No storage
- No model API

## Experiment question

**What did the machine miss?**

## Success criterion

The first validation is not feature usage. It is whether people:

- finish the 60-second experience,
- save/share the card,
- and comment with meaningful examples of context the model could not know.

Do not expand into accounts, analytics, leaderboards, identity inference, emotion detection, or generative image features before this interaction itself earns engagement.
