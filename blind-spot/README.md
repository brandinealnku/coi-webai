# AI Blind Spot

A browser-based AI literacy experiment built around one idea:

> **A model can detect. That does not mean it understands.**

## Version 2

The experience now has a stronger narrative arc:

1. **Hook** — "I can see. I cannot understand."
2. **Scan** — 12 seconds of local object detection with live labels and uncertainty.
3. **Confidence** — the user estimates how much the AI actually understands about the scene.
4. **Reveal** — detected evidence is placed directly beside context the model cannot know.
5. **Human context** — the user adds the most important thing AI missed.
6. **Share card** — a 1080×1350 social artifact designed to provoke discussion.

## What the browser AI does

- TensorFlow.js + COCO-SSD object detection
- camera access through `getUserMedia()`
- local live bounding boxes and confidence scores
- no image upload
- no backend
- no account
- no database
- no generative model API

## What it explicitly does not do

It does **not** infer or analyze:

- identity
- emotion
- age
- personality
- race
- gender
- health
- expertise
- intention
- other sensitive traits

The point of the experiment is the opposite: visible detections should not be mistaken for human understanding.

## Share-card hook

**AI SAW N THINGS.  
IT MISSED THE MOST IMPORTANT ONE.**

The card then shows:

- what the model detected,
- the human context supplied by the user,
- the user's own estimate of AI understanding,
- and the core message: **the gap was context.**

## Success criterion

This version earns further investment only if people:

- finish the experience,
- react to the reveal,
- save/share the card,
- or comment with meaningful examples of what the machine missed.

Do not add accounts, identity inference, emotion detection, leaderboards, or additional AI models before the core reveal proves it can create engagement.
