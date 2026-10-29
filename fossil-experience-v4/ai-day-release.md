# AI Day release — October 29, 2026

## Two visual treatments, identical flow
Use index.html?mode=test&design=blue or index.html?mode=test&design=gold.
For LIVE use index.html?design=blue or index.html?design=gold.
Blue is the default. Preserve assigned design for a participant's full journey.
Alternate first-view assignment; record invitation counts separately from people who start.
Ask which feels inviting/easy after the task, without leading participants.

## Evidence
Feedback is optional. Blank Noticed New means unanswered, not No.
Next Action yes/no means Continue/Finish, not satisfaction.
Every stop has a separate session. Event Name contains release, design and journey ID
so the existing Apps Script stores these without a redeploy. Observer rows pair by
Observed Session ID; join those to visitor rows for design/journey. Do not count
manual-bypass as scan-success. Browser no-cors sends cannot confirm Sheet receipt.
Verify paired TEST records in the Sheet before research. Never mix TEST with LIVE.

## Artifact/model readiness — not yet validated
Published training.json has no classes. Choose three exact proxies and record:
fossil1 = Stop 1; fossil2 = Stop 4; fossil3 = Stop 5.
Use /train/ for varied submissions and /fossil-admin/ to load shared examples.
Keep held-out examples out of training; use /validate/ and actual iPhone/Android.
Review errors and unrelated-object false positives before exporting training.json.
Publish that file only after validation; class counts alone are not validation.
Do not synthesize embeddings or claim a model is ready from a successful export.
The app now offers manual selection if the model is absent/unavailable.

## Physical content gate
No proxy-feature audit or approved specimen images supplied for this release.
Current prompts explicitly describe museum stories, not features claimed to exist
on the table proxies. To test physical noticing, supply approved reference images
or matching proxies; then audit all three questions before changing this wording.
Do not report story-only testing as proof of physical-object engagement.
Stop 6 remains an honest brief rehearsal ending until an approved image/task exists.

## Before Tuesday
Print table-labels.html. Place labels by the corresponding proxies.
Run all three stops, skipped feedback, answered feedback, early Finish, finale,
and Start again on blue and gold. Test camera denied, unavailable model, camera
interruption, keyboard, screen reader and small screens. Verify Sheet receipt.
Have 3–5 unfamiliar people use the actual setup without coaching.
Record help, hesitation, wrong actions, scroll problems and physical attention.
