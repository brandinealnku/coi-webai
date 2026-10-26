# CMC Fossil Scan V2

Version 2 converts the original similarity demo into a small validation instrument.

## What changed

- TensorFlow.js MobileNet embeddings + KNN classifier
- Three classes:
  - THIS FOSSIL
  - OTHER OBJECT
  - BACKGROUND
- Explicit training lock
- Held-out test recording
- Overall accuracy
- Fossil false positives
- Fossil false negatives
- Average prediction confidence
- Evidence snapshot for every recorded test
- JSON results export

## Recommended protocol

### Training
Capture at least 10 examples for each class.

**Fossil**
- multiple rotations
- multiple distances
- slight lighting changes

**Other object**
- another rock
- phone
- cup
- book
- object similar in color/texture to fossil

**Background**
- empty table
- room background
- hand
- empty scan frame

Then click **Lock training & begin test**.

### Validation
Do not add any new training examples after locking.

For each held-out camera view:
1. Start live classification.
2. Put a test item in the frame.
3. Wait for the prediction to stabilize.
4. Click the button describing what is actually present.
5. The system records prediction, confidence, correctness, and a snapshot.

## Evidence gate

Initial experimental target:
- at least 20 held-out tests
- >= 90% overall accuracy
- <= 10% fossil false-positive rate

Passing this does **not** prove general fossil detection. It only supports the hypothesis that a browser can distinguish one trained fossil instance from selected alternatives under tested conditions.
