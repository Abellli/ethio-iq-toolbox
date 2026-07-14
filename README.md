# Ethio IQ Toolbox — Phase 1

Following the blueprint's own roadmap, built so far:
**Foundation (Weeks 1-2)**, **Survey builder (Weeks 3-5)**,
**Campaign & budget manager (Weeks 5-6)**,
**Submission API & fraud engine (Weeks 6-8)**, and
**Analytics engine v1 (Weeks 8-11)**, and
**Advanced visualizations (Weeks 11-13)**.

## What's scaffolded so far

- **`database/schema.sql`** — full Postgres + PostGIS schema (corporate
  clients, respondents, surveys, geofences, questions, responses, answers,
  transactions, fraud_logs), cleaned up from the blueprint and ready to run.
- **`apps/api`** — NestJS Core API:
  - `auth` module: client onboarding (`POST /auth/onboard`), login
    (`POST /auth/login`), refresh, JWT access+refresh tokens, bcrypt password
    hashing. Stateless/token-based only, per the guiding principle — no
    session cookies anywhere.
  - `clients` module: fetch the logged-in admin's own corporate client
    record and its admin users, tenant-scoped by the JWT's `clientId` claim.
  - Plain `pg` Pool for now (swap for Prisma/TypeORM later if you want an
    ORM layer — the schema is ORM-agnostic).
- **`apps/admin`** — Next.js 14 (App Router) admin shell:
  - Tailwind config with the *exact* design tokens from spec 4.1 (primary
    `#2196F3`, tint `#E3F2FD`, slate text, hairline borders, 8-12px radius).
  - Sidebar (Surveys / Analytics / Campaigns / Respondents / Billing /
    Settings) and top bar per spec 4.2.
  - Analytics view page (`/dashboard`) laid out per spec 4.3: KPI strip,
    heatmap + sentiment row, cross-tab table — currently placeholders where
    the real chart/heatmap components go in Weeks 8-13.
  - Login page wired to the Core API.
- **`apps/analytics`** — FastAPI microservice skeleton with `/sentiment`
  and `/crosstab` endpoints stubbed out, ready to wire to the Anthropic API.

### Survey builder (Weeks 3-5)

- **`apps/api/src/surveys`** — NestJS module, tenant-scoped by JWT `clientId`:
  - `POST /surveys` — create draft, `GET /surveys` — list, `GET /surveys/:id`
    — full detail incl. questions + geofence, `PATCH /surveys/:id` — update
    settings (incentive, budget cap, demographics, max responses, dates).
  - `POST /surveys/:id/questions` — the drag-and-drop builder's canvas
    "save": replaces the full ordered question list in one transaction
    (order comes from array position, matching what dnd-kit produces).
  - `POST /surveys/:id/publish|pause|close|resume` — status transitions
    with guardrails (e.g. can't publish with zero questions, can't publish
    a closed survey).
  - `POST /surveys/:id/geofence` — the geofence drawing tool's save
    endpoint; accepts either a polygon (array of [lng, lat]) or a
    center+radius, matching "draw a polygon or radius on a map."
- **`apps/admin/app/dashboard/surveys`** — list page, new-survey form, and
  the three-pane builder (`/dashboard/surveys/[id]`):
  - Left: question-type palette (single/multi choice, scale, NPS, open
    text, location) — click to add.
  - Center: `dnd-kit` sortable canvas — drag to reorder, click to select.
  - Right: contextual settings drawer — prompt text, options editor for
    choice types, scale min/max, required toggle.
  - Edit/Preview toggle — preview renders the question flow as a
    respondent would see it (read-only inputs).
  - Save as draft / Publish / Pause buttons wired to the API above.

**Not yet built**: the actual map-based geofence *drawing* UI (the backend
endpoint is ready, but drawing a polygon/radius on a Mapbox GL/deck.gl map
in the admin app is its own chunk of work — happy to build that next).

### Campaign & budget manager (Weeks 5-6)

- **`apps/api/src/billing`**:
  - `GET /billing/wallet` — current prefunded balance.
  - `POST /billing/topup` — manual-invoice top-up request (per the
    blueprint: "manual invoice for Phase 1, payment gateway integration
    optional"). Creates a `pending` `client_charge` transaction.
  - `POST /billing/topup/:id/confirm` — owner/admin-only confirmation that
    credits the wallet once payment is received; this is the seam where a
    real payment-gateway webhook would plug in later.
  - `GET /billing/transactions` — history.
  - `GET /billing/spend` — real-time spend vs. `budget_cap_cents` per paid
    survey, computed from completed `payout` transactions.
- **`apps/admin/app/dashboard/billing`** — wallet balance, top-up form,
  transaction history.
- **`apps/admin/app/dashboard/campaigns`** — paid surveys with a spend
  progress bar against their budget cap.

### Submission API & fraud engine (Weeks 6-8)

- **`apps/api/src/submissions`** (public, unauthenticated — the Phase 1
  respondent-facing surface, since the TMA isn't live yet):
  - `GET /public/surveys/:id` — survey + questions, only if `status = 'active'`.
  - `POST /public/surveys/:id/responses` — the submission endpoint:
    1. Redis IP-velocity rate limit (10/min) checked before touching Postgres.
    2. Redis `SET NX` dedup lock (device + survey) to stop duplicate
       concurrent submissions fast, backed by the DB's
       `uq_responses_dedup` unique constraint as the source of truth.
    3. Finds or creates the `respondents` row by device fingerprint.
    4. Inserts the response, then runs the geofence check synchronously
       (`ST_Contains` for polygons, `ST_DWithin` for center+radius) and
       stores `is_within_geofence`.
    5. Inserts answers, then enqueues an async fraud-scoring job — keeps
       the endpoint fast under concurrent load, per the blueprint.
- **`apps/api/src/queue`** — BullMQ (Redis-backed) `fraud-scoring` worker:
  - Heuristic v1 score: device reuse rate, implausibly-fast completion,
    IP reuse on the same survey. `fraud_score >= 0.6` or outside-geofence
    → `flagged` + a `fraud_logs` row; otherwise → `verified` + `auto_approved` log.
  - On `verified` responses to paid-tier surveys: creates a `payout`
    transaction, decrements the client's wallet, and — this is the tie-in
    to the budget manager above — auto-pauses the survey if the payout
    would exceed `budget_cap_cents`.
- **`apps/admin/app/s/[id]`** — the public web-form fallback itself:
  renders each question type, requests geolocation only if the survey has
  a `location` question, generates/persists a device fingerprint in
  `localStorage`, tracks completion time, and posts to the submission
  endpoint above.

**Not yet built**: this heuristic fraud score is intentionally simple
(three signals) — real tuning (device reputation over time, IP
reputation feeds, ML-based scoring) is a good candidate for a later pass
once you have real pilot data to tune thresholds against.

### Analytics engine v1 (Weeks 8-11)

- **`apps/api/src/analytics`** — tenant-scoped, and every endpoint accepts
  the same `AnalyticsFilterDto` (region, gender, age range, date range) —
  spec 4.3's "global filters that cascade to every chart below":
  - `GET /analytics/surveys/:id/kpis` — total responses, completion rate,
    fraud-flagged %, avg sentiment (the KPI strip).
  - `GET /analytics/surveys/:id/sentiment-breakdown` — positive/neutral/
    negative counts from scored `open_text` answers.
  - `GET /analytics/surveys/:id/trend` — responses per day.
  - `GET /analytics/surveys/:id/crosstab?rowQuestionId=&columnQuestionId=`
    — the swappable-axis pivot table (spec 4.3's "brand preference × age
    group" example), restricted to single/multi-choice, scale, and NPS
    questions since open text doesn't pivot meaningfully.
  - `GET /analytics/surveys/:id/export.csv` — long-format CSV export
    (one row per response × question), filtered the same way.
- **`apps/api/src/queue/sentiment.processor.ts`** — a new BullMQ worker,
  enqueued automatically from the submission endpoint for every
  `open_text` answer, that calls the FastAPI analytics service.
- **`apps/analytics/main.py`** — `/sentiment` now actually calls the
  Anthropic API (Claude) with a strict-JSON prompt for Amharic + English
  sentiment/theming, per the blueprint's stack table. Falls back to a
  keyword heuristic if `ANTHROPIC_API_KEY` isn't set, so the whole
  pipeline still runs end-to-end without a key configured. (The
  cross-tab endpoint that used to be stubbed here was dropped — it's
  simpler and faster directly against Postgres, which is where it ended
  up living, in `apps/api/src/analytics` above.)
- **`apps/admin/app/dashboard/analytics/[id]`** — the real analytics view:
  KPI strip, global filter bar, a Recharts sentiment bar chart, a Recharts
  trend line, the cross-tab table with a swap-axes button, and a
  "Export CSV" button that downloads the filtered data. `/dashboard` is
  now a survey picker that links into this page.

**Not yet built**: the geospatial heatmap and D3 sunburst diagram are
now built below — see Weeks 11-13.

### Advanced visualizations (Weeks 11-13)

- **`apps/api/src/analytics`**:
  - `GET /analytics/surveys/:id/heatmap` — up to 5,000 lat/lng points for
    geo-tagged responses (PostGIS `ST_X`/`ST_Y`), filtered the same way as
    everything else. deck.gl's `HeatmapLayer` does the density aggregation
    client-side, so the API just needs raw points, not pre-binned cells.
  - `GET /analytics/surveys/:id/sunburst` — nested region → sub-region →
    sentiment counts. One honest adaptation from the spec: the schema has
    a single `respondents.region` text field, not a separate sub-city
    column, so region labels that encode one (e.g. `"Addis Ababa - Bole"`,
    matching the geofence label example already in the schema) are split
    on `" - "` into two levels; the innermost ring is sentiment as a stand-in
    for "response". Documented inline in `analytics.service.ts` rather than
    silently reinterpreting the spec.
- **Materialized view for dashboard performance** (`database/schema.sql`):
  `mv_survey_daily_stats` pre-aggregates per-survey daily response/sentiment
  stats. `getTrend()` reads from it when no demographic filter is active
  (the common case — the default view a client lands on) and falls back to
  a live join the moment a region/gender/age filter is applied, since those
  dimensions aren't in the view. A new `@nestjs/schedule` cron job
  (`apps/api/src/analytics/mv-refresh.scheduler.ts`) runs
  `REFRESH MATERIALIZED VIEW CONCURRENTLY` every 2 minutes — the unique
  index the concurrent refresh needs is created alongside the view.
- **`apps/admin/components/analytics/response-heatmap.tsx`** — deck.gl
  `HeatmapLayer` over free OpenStreetMap raster tiles (no Mapbox token
  needed to run this locally; swap the `TileLayer` URL for Mapbox GL later
  if you want vector tiles/styling — the blueprint listed both as options).
  Loaded via `next/dynamic` with `ssr: false`, since deck.gl touches
  WebGL/`window` at module load and breaks Next's server render pass for
  client components otherwise.
- **`apps/admin/components/analytics/sunburst.tsx`** — `d3-hierarchy`
  (`partition`) + `d3-shape` (`arc`) rendered as plain SVG arcs, colored by
  region with sentiment on the innermost ring.

## Running it locally

```bash
# 0. Postgres + Redis (or point at your own instances)
docker compose up -d

# 1. Database
npm run db:migrate   # runs database/schema.sql

# 2. Core API
cd apps/api
cp .env.example .env   # fill in DATABASE_URL, REDIS_URL, JWT secrets
npm install
npm run start:dev      # http://localhost:4000/api/v1

# 3. Admin frontend
cd apps/admin
npm install
npm run dev             # http://localhost:3000

# 4. Analytics microservice
cd apps/analytics
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...   # optional — heuristic fallback works without it
uvicorn main:app --reload --port 8001
```

Then hit `POST http://localhost:4000/api/v1/auth/onboard` with:
```json
{
  "companyName": "Acme Corp",
  "billingEmail": "billing@acme.com",
  "ownerEmail": "owner@acme.com",
  "ownerPassword": "supersecret123"
}
```
That creates your first pilot corporate client and owner login — then log
in at `http://localhost:3000/login`, build a survey at
`/dashboard/surveys/new`, publish it, and submit a response at
`/s/<survey-id>` to see it flow through fraud + sentiment scoring and show
up on `/dashboard/analytics/<survey-id>`.

## Next up

The blueprint's Phase 1 roadmap (sections 3 and 4) is now fully built end
to end — foundation, survey builder, campaign/budget manager, submission
API + fraud engine, analytics engine, and advanced visualizations.

What's left on the table:

- **Geofence drawing UI**: Mapbox GL/deck.gl polygon+radius drawing tool in
  the admin app, calling the already-built `/surveys/:id/geofence` endpoint
  — this has been the one open item since Weeks 3-5.
- **Section 5, "What to validate in Phase 1"**: run 2-3 pilot surveys
  through the web-form fallback and see whether (a) clients can build/
  launch without support, (b) the analytics view answers their questions
  without a custom export, and (c) response quality actually looks clean.
  That's a real-world exercise more than a code one, but I can help set up
  the pilot data if useful.
- **Phase 2 (Telegram Mini App)**: the schema, stateless JWT auth, and
  respondent model were built TMA-ready from day one (`telegram_id_hash`,
  device fingerprinting, no session cookies) — per the blueprint's guiding
  principle, this should be "a new client on the same API, not a rebuild."

Tell me which of these you want to tackle next.
