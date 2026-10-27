# CMC Fossil Experience V4 — QR Field Study

V4 is designed for NKU AI Day visitors to join from their **own phones via QR code**, scan the physical fossil, complete the experience, and contribute anonymous interaction data to one shared research dataset.

## Architecture

### Public visitor
`/fossil-experience-v4/`

Loads:
- MobileNet + KNN in the browser
- the published fossil classifier from the Worker `GET /model`
- camera access on the participant's own phone

Posts anonymous interaction events to `POST /events`.

No camera image is uploaded by V4.

### Research setup
`/fossil-experience-v4/admin.html`

Researchers:
1. train fossil / other object / background,
2. publish the classifier to the Worker,
3. display/copy the visitor QR code.

### Shared dashboard
`/fossil-experience-v4/dashboard.html`

Loads the shared event log and calculates:
- sessions
- completion
- scan success
- median scan time
- looked-closer response
- median dwell time

## Backend

The `worker/` folder contains a minimal Cloudflare Worker + D1 implementation.

Endpoints:
- `GET /health`
- `GET /model`
- `PUT /model` — admin key required
- `POST /events`
- `GET /events` — admin key required

## Deployment setup

1. Create a Cloudflare D1 database named `cmc-fossil-ai-day`.
2. Run `worker/schema.sql` against it.
3. Put the D1 database id into `worker/wrangler.toml`.
4. Set `ADMIN_KEY` as a Worker secret.
5. Deploy the Worker.
6. Put the Worker URL into `config.js` as `API_BASE`.
7. Open `admin.html`, train the three classes, and publish the classifier.
8. Test the visitor URL from a phone not used for training.

## Research boundary

V4 tests whether people can independently join, grant camera access, recognize the fossil, look more closely, and continue exploring. It does not establish general fossil identification or production museum readiness.
