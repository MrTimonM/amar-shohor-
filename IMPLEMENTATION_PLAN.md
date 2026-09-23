# Amar Shohor — Implementation Plan

**আমার শহর — এক শহর, এক মানচিত্র**

Citizens report city problems in under a minute. Duplicate reports collapse into one verified problem on a live map, ranked by an explainable priority score, assigned to an authority, and tracked in public until it is fixed.

| | |
|---|---|
| **Client** | React + Vite + TypeScript |
| **API** | Node · Express · MongoDB |
| **Intelligence** | Python · FastAPI |
| **Map** | Leaflet · OpenStreetMap |
| **Target** | AWS |

Phases 01–14. Prepared 10 September 2026.

---

## Three commitments

Everything in the fourteen phases serves these three. They are not features bolted on at the end — each one changes decisions in phase 01.

### AI that can be audited

Real models with versions, offline eval sets, confidence thresholds, a human review queue, and a logged reason for every automated decision. Never a demo-only wrapper.

### Dark mode from day one

A single token layer drives light, dark and system. Field workers report at night; a retrofit six weeks in costs three times what it costs in phase 02.

### Cloud-portable, AWS-bound

Docker Compose locally, but storage, queues and inference sit behind interfaces from the start, so phase 14 is a deployment — not a rewrite.

---

## The build

Each phase ends with something demonstrable. Phases 01–07 produce a working product; 08–11 make it intelligent; 12–14 make it accountable and public.

### 01 — Foundations and environments

*Goal: get a repository that four people can work in without stepping on each other, and that deploys the same way on a laptop and on AWS.*

- Monorepo with **pnpm workspaces**: `apps/web`, `apps/api`, `services/ai`, `packages/shared` for types and validation schemas shared across client and server.
- TypeScript everywhere on the JS side, **Zod** schemas as the single source of truth for request and response shapes.
- **Docker Compose** for local dev: API, AI service, MongoDB, Redis, and MinIO standing in for S3 so no code knows it isn't on AWS yet.
- Config through environment variables only — no hardcoded URLs, keys, or bucket names anywhere in the tree.
- GitHub Actions on every pull request: typecheck, lint, unit tests, Docker build. Branch protection on `main`.
- Structured JSON logging and a `/health` endpoint on both services from the first commit.

**Stack:** pnpm · TypeScript · Zod · Docker Compose · MinIO · GitHub Actions

### 02 — Design system and dark mode

`DARK MODE`

*Goal: build the token layer and component kit before any screen, so light and dark are one system rather than two stylesheets.*

- CSS custom properties as the only source of colour: surface, line, ink, accent, plus semantic triples (`base / wash / line`) for **ok**, **waiting**, **critical** and **hazard** issue states.
- Three theme states handled properly — light tokens on `:root`, dark redefined under both `prefers-color-scheme` and `[data-theme="dark"]`, so an explicit choice always beats the OS.
- Theme preference in `localStorage` with an inline head script to kill the white flash on first paint.
- Dark basemap swap: CARTO `dark_matter` tiles with marker and cluster colours re-tuned for contrast on a dark ground.
- Component kit: card with tinted header, KPI stat tile, status pill, data table, vertical lifecycle timeline, priority meter, verification check rows, empty states, skeleton loaders.
- Accessibility floor: visible focus rings, WCAG AA contrast in *both* themes, `prefers-reduced-motion`, 44px minimum touch targets.

Palette:

| Role | Light | Dark |
|---|---|---|
| Ground | `#f5f6f4` | `#0e1412` |
| Surface | `#ffffff` | `#151d1a` |
| Ink | `#16211c` | `#e8ede9` |
| Accent | `#00694c` | `#43c29a` |

**Stack:** CSS custom properties · Tailwind mapped onto the tokens · Storybook for the kit

### 03 — Data model and geospatial core

*Goal: model the difference between a raw citizen* report *and a verified* issue *— the distinction the whole product rests on.*

- Collections: `User`, `Report` (one submission), `Issue` (a cluster of reports), `Authority`, `StatusEvent` (append-only audit trail), `Verification`, `Ward`.
- Every location as a GeoJSON `Point` with a **2dsphere** index, enabling radius queries, near-me feeds, and per-ward aggregation.
- Ward and city boundaries stored as GeoJSON polygons; a report is stamped with its ward on write, not computed on read.
- Issue lifecycle as an explicit state machine with legal transitions only, so no code path can silently jump a stage.
- `StatusEvent` is never updated or deleted — the public timeline and the audit log are the same data.
- Seed script producing realistic Dhaka test data: wards, authorities, and a few hundred reports including deliberate duplicate clusters.

**Stack:** MongoDB · Mongoose · GeoJSON · 2dsphere · aggregation pipelines

### 04 — Identity, roles and trust

*Goal: let anyone report with almost no friction, while making sure votes and authority actions cannot be faked.*

- Phone-number sign-in with OTP as the primary path — no passwords for citizens.
- Four roles: **citizen**, **verifier**, **authority**, **admin**. Authority accounts are provisioned by an admin and tied to a department and ward set.
- JWT access tokens with refresh rotation; role and scope checks enforced in middleware, never in the UI alone.
- A per-user **trust score** that rises with confirmed reports and falls with rejected ones — the input that later weights verification votes.
- Rate limits per phone, per IP and per device on submit and vote endpoints.
- Anonymous browsing of the whole public map: reading never requires an account.

**Stack:** JWT · Redis for OTP and rate limits · SMS gateway (local provider, SNS-ready)

### 05 — The citizen report flow

`OFFLINE-FIRST`

*Goal: make the sixty-second report real, on a mid-range Android phone, on a bad connection.*

- Mobile-first shell — bottom tab bar and a thumb-reachable camera button, not a desktop sidebar squeezed onto a phone.
- Capture flow: photo → automatic GPS with a draggable pin correction → category → optional note → submit. Four taps in the happy path.
- Client-side image compression before upload so a 4MB phone photo leaves as roughly 300KB.
- **Offline queue** in IndexedDB: reports written on a dead connection are held and flushed by a service worker when the network returns. Nothing typed is ever lost.
- Duplicate warning at the point of capture — nearby open issues shown before submitting, letting the citizen confirm an existing problem instead of creating another report.
- Installable PWA with an app icon, splash screen and offline shell.

**Stack:** React · Vite PWA · Workbox · IndexedDB (idb) · browser-image-compression

### 06 — Media pipeline

`S3-READY`

*Goal: handle photos as first-class evidence, behind an interface that swaps MinIO for S3 with one config change.*

- Presigned direct-to-bucket uploads — image bytes never pass through the API process.
- A `StorageAdapter` interface with MinIO and S3 implementations chosen at runtime.
- Server-side derivatives on upload: thumbnail, feed size, full size, all WebP with JPEG fallback.
- EXIF handled deliberately: capture time and GPS extracted and kept for integrity checks, then **stripped** from anything served publicly.
- MIME and magic-byte validation, size ceilings, and a virus scan hook before any image becomes visible.
- Before-and-after pairing so an authority's proof-of-fix photo renders beside the original report.

**Stack:** MinIO → S3 · presigned URLs · sharp · exifr

### 07 — The live map and discovery

*Goal: deliver the promise on the pitch deck's fourth slide — one map, one shared truth, fast enough to feel live.*

- Leaflet over OpenStreetMap with marker clustering, plus the dark tile set wired to the theme token from phase 02.
- Markers encode category by glyph and status by colour, so the map is readable without opening a single issue.
- Viewport-bounded queries — the API returns only what the current bounding box and zoom need, never the whole city.
- Filters that survive a page reload in the URL: category, status, severity, date range, ward.
- Heatmap layer for density and a ward-boundary overlay for jurisdiction.
- Issue detail: photo gallery, report count, verification state, priority breakdown, and the public lifecycle timeline.
- List view paired with the map for low-end devices and for screen-reader users, who get the same data as rows.

**Stack:** Leaflet · react-leaflet · Leaflet.markercluster · CARTO tiles · TanStack Query

### 08 — The AI platform foundation

`AI PLATFORM`

*Goal: stand up the machine-learning service as real infrastructure — versioned, asynchronous, observable, and never able to block a citizen.*

- **FastAPI** service with typed Pydantic contracts, its own container, and its own deploy cycle.
- Inference is **asynchronous**: submit writes the report and enqueues a job. If the AI service is down, reports still succeed and get enriched later.
- Job queue on Redis (BullMQ) locally, with the same interface pointed at SQS on AWS.
- A model registry: every model has a name, a semantic version, a checksum and a config, and every prediction stored on a report records which version produced it.
- Confidence thresholds with three outcomes — auto-accept, send to human review, or reject — configurable per model without a redeploy.
- Frozen offline evaluation sets with committed precision and recall targets; CI fails a model that regresses against them.
- Prediction latency, confidence distribution and override rate exported as metrics, so drift is visible instead of guessed at.

**Stack:** Python · FastAPI · Pydantic · PyTorch · Redis/BullMQ → SQS · MLflow-style registry

### 09 — Vision: category, severity and photo integrity

`COMPUTER VISION`

*Goal: read the photo so the citizen doesn't have to classify anything, and so obvious abuse never reaches the map.*

- **Category classifier** across the deck's eight problem types. Ship on zero-shot CLIP for day one, then fine-tune a ViT or EfficientNet on labelled Bangladeshi street imagery as data accumulates.
- **Severity estimate** — a pothole's rough size, how far waterlogging spreads, whether garbage is a pile or a dump — feeding the priority score rather than replacing human judgement.
- **Relevance and safety gate**: reject selfies, screenshots, indoor shots and explicit content before publication.
- **Integrity checks** as a bundle of signals — EXIF capture time versus submit time, EXIF GPS versus the dropped pin, screenshot detection, and a reverse-embedding search against existing photos to catch a recycled image.
- Predictions are suggestions: the citizen sees the detected category pre-filled and can override it, and every override is logged as training signal.
- Bangladeshi road-scene fine-tuning is the differentiator — a generic model misreads local street conditions badly.

**Stack:** PyTorch · timm (ViT / EfficientNet) · OpenCLIP · ONNX Runtime for serving · exifr

### 10 — Deduplication and explainable priority

`CORE AI` `EXPLAINABLE`

*Goal: turn many reports into one verified problem, then rank problems in a way a citizen or an auditor can check.*

- Candidate generation by geospatial and temporal window; scoring on a weighted blend of distance, category agreement, time proximity, **image embedding similarity** and text similarity.
- Embeddings from CLIP or DINOv2 stored in **MongoDB Atlas Vector Search**, so two photos of the same pothole merge even when GPS drifts twenty metres.
- Three-way outcome: auto-merge above the high threshold, human review queue in the middle, distinct issue below — with unmerge always available and audited.
- **Merge proof card** — "3 reports → 1 problem" with the contributing thumbnails side by side. It makes the product's central claim legible in five seconds.
- **Explainable priority score**: severity × report count × population density × days open × hazard flag, shown to every user as a per-factor breakdown with each factor's contribution. No black box on a public accountability tool.
- Upgrade path: once enough resolutions have been recorded, replace the hand-tuned weights with gradient boosting trained on real outcomes — keeping the per-factor explanation via SHAP values.
- Moderator console for the review queue: approve, reject, merge, split, with keyboard shortcuts, because throughput here decides whether the map stays clean.

**Stack:** DINOv2 / CLIP embeddings · Atlas Vector Search (HNSW) · scikit-learn · XGBoost · SHAP

### 11 — Bengali-first interface and voice reporting

`SPEECH & NLP` `NEW FEATURE`

*Goal: reach the citizens most affected by these problems, including those who will not type a report.*

- **Bengali as the default language**, English as the toggle — not the other way round. Typography set with Hind Siliguri or Noto Sans Bengali at a looser line-height than the Latin scale.
- Full `i18n` extraction with no hardcoded strings, and locale-aware dates and numbers.
- **Voice reporting**: the citizen holds a button and speaks; Bengali speech-to-text produces the description. A fine-tuned Whisper model handles Bangladeshi Bengali far better than an off-the-shelf endpoint.
- Bengali NLP on descriptions — normalisation, romanised-Bengali handling, keyword extraction, and a short auto-summary for the authority queue.
- Text similarity from a multilingual sentence encoder feeds straight back into phase 10's deduplication.
- Screen-reader labels and keyboard navigation verified in both languages and both themes.

**Stack:** react-i18next · Hind Siliguri · Whisper (fine-tuned) · IndicBERT / LaBSE · Web Speech API fallback

### 12 — Community verification and anti-abuse

*Goal: make "verified by the community" mean something measurable rather than a slogan on a slide.*

- Confirm or dispute on an issue, **gated by proximity** — only devices that have actually been near the location can vote.
- Votes weighted by the phase 04 trust score, so a brand-new account cannot swing an issue alone.
- An explicit verification threshold moves an issue from *reported* to *verified*, and the threshold is published.
- The verification panel shows counts, not just a badge: how many confirmed, how many disputed, over what period.
- Abuse defences: velocity limits, device fingerprinting, coordinated-voting detection, and a reporting path for malicious content.
- Disputed issues route to the moderator console rather than quietly disappearing.

**Stack:** weighted consensus · geofenced voting · anomaly detection on vote patterns

### 13 — Authority workspace and public accountability

*Goal: give the city a queue worth using, and give the citizen the answer to "what happened after I reported?"*

- Priority-sorted triage queue scoped to the authority's department and wards, with bulk assignment.
- Assignment, ownership and an **SLA clock** per category, with overdue issues escalating visibly.
- Status updates require a note, and closure requires a **proof-of-fix photo** — an issue cannot be marked resolved on an authority's word alone.
- The **public lifecycle timeline** on every issue: reported → verified → assigned → in progress → resolved, each stage stamped with a time and an actor.
- Notifications to the reporter and every verifier on each transition — web push, with SMS fallback for users without a browser session.
- Citizen sign-off: the reporter can confirm the fix or reopen the issue, which is the only closure that counts toward the resolution statistics.
- CSV and PDF export for internal reporting, because that is how city offices actually work.

**Stack:** Express · MongoDB aggregation · Web Push (VAPID) · SMS gateway · Puppeteer for PDF

### 14 — Analytics, predictive hotspots and the AWS launch

`STANDOUT` `FORECASTING` `DEPLOYMENT`

*Goal: turn the accumulated data into something no comparable project shows, then ship the whole thing on AWS.*

- **Public accountability dashboard**: resolution rate, median time-to-fix and open backlog per ward and per department, with a trend line. Transparency as a scoreboard, not a claim.
- **Predictive hotspots** — a spatiotemporal model over historical reports, ward attributes, season and rainfall, forecasting where waterlogging and road damage will recur, so the city can act before the complaints arrive. This is the phase that moves the product from reactive to preventive.
- Forecasts rendered as a risk layer on the same map, with an honest accuracy figure displayed beside them and a backtest published against held-out months.
- AWS deployment: containers to **ECS Fargate** behind an ALB, client and images on **S3 + CloudFront**, MongoDB Atlas peered into the VPC, **SQS** for the inference queue, ElastiCache for Redis, models served from a GPU task or a SageMaker endpoint.
- Operations: Secrets Manager, CloudWatch dashboards and alarms, Route 53 with ACM certificates, WAF in front of the ALB, automated Atlas backups, and a documented restore drill that has actually been run.
- Infrastructure as code in Terraform so staging and production are the same description with different variables — and load testing before launch, not after.

**Stack:** Prophet / LightGBM spatiotemporal model · ECS Fargate · S3 · CloudFront · SQS · SageMaker · Terraform · CloudWatch

---

## The AWS target, and what it replaces

Every local dependency is chosen so that phase 14 changes configuration rather than code. This is the mapping the earlier phases are written against.

| Concern | Local (phases 01–13) | AWS (phase 14) |
|---|---|---|
| Web client | Vite dev server | S3 + CloudFront |
| API | Node container | ECS Fargate + ALB |
| AI service | FastAPI container | ECS Fargate (GPU) or SageMaker |
| Database | MongoDB container | MongoDB Atlas, VPC-peered |
| Object storage | MinIO | S3 + lifecycle rules |
| Job queue | Redis / BullMQ | SQS + dead-letter queue |
| Cache, OTP, rate limits | Redis | ElastiCache |
| Thumbnails | In-process sharp | Lambda on S3 events |
| Secrets | `.env` files | Secrets Manager |
| Logs and metrics | stdout JSON | CloudWatch + alarms |
| SMS | Local gateway | SNS or the same gateway |

---

## Open decisions and honest risks

**Training data is the real constraint, not model choice.**
The vision and dedup models need a few thousand labelled Bangladeshi street photos to beat a zero-shot baseline. Plan a labelling effort in parallel from phase 05 onward — every citizen category override is a free label, which is why phase 09 logs them.

**Moderation throughput decides whether the map is trusted.**
Confidence thresholds tuned too aggressively flood the review queue; tuned too loosely they let bad merges onto the public map. Set the thresholds against measured queue capacity, and treat the override rate from phase 08 as the signal to retune.

**Authority adoption is a product problem, not a technical one.**
A public resolution scoreboard is the strongest feature here and the hardest sell to the institution being scored. Ship the internal triage queue and the SLA clock as the value proposition first; the public dashboard lands better once the workspace is already saving the department time.

**Assumptions worth confirming.**
This plan assumes a four-to-six person team, roughly one to three weeks per phase, Dhaka as the pilot city, and MongoDB Atlas rather than self-managed Mongo or DocumentDB — Atlas is assumed because phase 10's vector search depends on it. Any of those changing shifts phases 03, 10 and 14 in particular.
