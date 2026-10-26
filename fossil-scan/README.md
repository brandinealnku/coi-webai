# CMC Fossil Scan Prototype

A browser-based **instance recognition experiment** for the Cincinnati Museum Center / NKU AI Native Studio project.

## Purpose

Test the smallest useful question:

> Can a visitor-facing browser recognize one known fossil from live camera views well enough to justify deeper object-recognition work?

This is **not** a general fossil detector and does not identify fossil species.

## How it works

1. Opens the device camera.
2. Uses TensorFlow.js MobileNet embeddings from the center scan region.
3. Captures multiple positive examples of the physical fossil.
4. Captures negative/background examples.
5. During live scan, compares the current embedding with the stored examples using cosine similarity.
6. Displays a simple fossil-match score and threshold.

## Suggested first test

- Add 12–20 fossil examples:
  - front/back
  - slight rotations
  - near/far
  - different lighting
- Add 8–12 background examples:
  - empty table
  - your hand
  - another rock/object
  - room background
- Start live scan.
- Move the fossil in/out of the scan box at least 10 times.
- Record false positives and false negatives.

## Evidence gate

Continue only if the prototype consistently separates the known fossil from ordinary backgrounds across multiple angles.

If this fails, do **not** jump directly to a custom detection model. First determine whether framing, lighting, training examples, or the recognition approach is the limiting factor.

## Run

Serve over HTTPS (GitHub Pages is fine) because mobile browsers require a secure context for camera access.
