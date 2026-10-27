# CMC Fossil Experience Lab — AI Day V3

## Research goal

Determine whether a camera-based "scan the object" interaction helps people engage more deeply with a physical museum object—and identify what visitors expect, value, misunderstand, or want to do next after the object is recognized.

This is a **formative visitor-experience study**, not a claim of production-ready fossil identification.

## Visitor flow

1. Invitation — "What can this fossil tell you?"
2. Scan — camera-based recognition with minimal AI jargon
3. Look Closer — visitor chooses shape, texture, or pattern
4. Discover — short prototype interpretation
5. Expand Your World — concept test for collection connections
6. Reaction — did scanning encourage closer looking?
7. Next action — what would the visitor want to do next?

## Research mode

Open **Research** from the visitor header.

### Setup
- Train three classes: fossil, other object, background.
- Aim for 10+ examples per class.
- Save training to the device.
- The saved KNN classifier persists in localStorage so Visitor Mode can be reused across many participants without retraining.

### Dashboard
Tracks:
- total visitor sessions
- completion rate
- scan success
- median scan time
- "looked closer" response
- median dwell time
- what visitors noticed
- desired next action
- session log

### Evidence
Successful recognition snapshots are kept in memory for the current browser session. Session-level research data persists locally and can be exported as JSON.

## Interpretation boundary

The visitor-facing interpretation is deliberately generic. A museum deployment should replace it with curator-approved content tied to the actual fossil and collection records.

## AI Day use

Recommended station setup:
- one trained phone/tablet/laptop
- physical fossil beside the device
- one student observer nearby
- avoid coaching unless the participant is clearly stuck
- note behavioral observations separately: hesitation, whether attention returns to the fossil, conversation with companions, and where help was needed

## What success would mean

A successful AI Day test would provide evidence about:
- discoverability of the scan interaction
- recognition friction
- whether scanning increases physical-object observation
- desired next-step content
- potential value of "Expand Your World" collection connections

It would **not** validate general fossil detection or a production museum system.
