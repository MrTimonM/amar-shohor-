# Amar Shohor onboarding guide

This repo is a civic reporting app called Amar Shohor. The product idea is simple:

- citizens submit city problems like potholes, waterlogging, waste, street lights, etc.
- duplicate reports are merged into one issue
- issues are ranked by priority and shown on a public map
- authorities can triage and resolve them
- the public can see the status history and accountability stats

The codebase is split into a few moving parts:

- web app: React + Vite
- API: Node.js + Express
- AI service: Python + FastAPI
- shared package: TypeScript models and schemas
- local infrastructure: MongoDB, Redis, MinIO via Docker Compose

---



## 2. How the app works at runtime

### Frontend (React + Vite)

The web app runs in the browser and uses:

- React for components
- React Router for page navigation
- TanStack Query for fetch/cache state
- Leaflet for map rendering
- a custom auth context for signed-in state

The main entry point is:

- `amar-shohor/apps/web/src/main.tsx`

This bootstraps the React app, sets up query client and auth providers, and mounts the app into the page.

The app includes pages such as:

- dashboard
- map
- issue detail
- report form
- mine/reports
- queue
- review
- sign-in

### Backend API (Express)

The API runs in Node and handles:

- sign-in / sign-up
- report creation
- issue lookup
- deduplication logic
- authority actions
- stats and public dashboard data
- media uploads and image serving

The main entry point is:

- `amar-shohor/apps/api/src/index.ts`

That file:

- creates the Express app
- attaches middleware
- registers routes
- connects to MongoDB
- starts listening on the configured port

The route groups are organized under:

- `routes/auth.ts`
- `routes/reports.ts`
- `routes/issues.ts`
- `routes/authority.ts`
- `routes/admin.ts`
- `routes/stats.ts`
- `routes/media.ts`

### AI service (FastAPI)

The AI service is separate from the API so that image analysis does not block citizens during submission.

The main file is:

- `amar-shohor/services/ai/app/main.py`

It exposes:

- `/health` for service diagnostics
- `/v1/models` for model metadata
- `/v1/analyse` for image analysis requests

This service is responsible for things like:

- category classification
- image relevance checks
- severity estimation
- embeddings / vector similarity
- reused-image detection

The important idea is: the API can still accept a report even if AI is down. AI runs asynchronously and enriches later instead of blocking the citizen.

---

## 3. Shared domain model

The shared package defines the source-of-truth types for the whole app:

- `packages/shared/src/domain.ts`
- `packages/shared/src/schemas.ts`
- `packages/shared/src/types.ts`
- `packages/shared/src/priority.ts`

This is where the app defines:

- roles (citizen, verifier, authority, admin)
- issue lifecycle states
- categories and departments
- schema validation rules
- explainable priority scoring logic

This matters because frontend and backend both use the same definitions instead of drifting apart.

---

## 4. What a report flow looks like

A typical citizen flow is:

1. sign up or sign in
2. open the report form
3. allow location access
4. upload one or more photos
5. choose a category and optionally notes
6. submit
7. backend stores the report
8. backend runs deduplication checks
9. if it matches nearby reports, it joins an existing issue
10. otherwise a new issue is created
11. AI may enrich the data in the background
12. the issue appears on the map and timeline

The key concept is: report vs issue.

- a Report is one citizen submission
- an Issue is a deduplicated cluster of reports

This distinction is core to the product.

---

## 5. How deduplication works

Deduplication is one of the product’s main claims. The logic lives in:

- `amar-shohor/apps/api/src/dedup.ts`

It compares candidate reports based on things like:

- distance between locations
- category agreement
- time proximity
- image similarity
- text similarity

The goal is to collapse many reports of the same pothole or problem into one verified issue rather than a pile of duplicates.
The code intentionally supports:

- auto-merge when confidence is high
- human review when confidence is medium
- leave separate when confidence is low

---

## 6. Why the repo is a monorepo

The root `package.json` defines workspaces for:

- apps/web
- apps/api
- packages/shared

This means the project shares tooling and installs dependencies once at the repo root.

Useful commands from the root:

```bash
npm install
npm run dev
npm run build
npm run typecheck
npm run seed
```

Relevant scripts:

- `dev`: starts API and web together
- `build`: builds both apps
- `seed`: populates demo data
- `typecheck`: checks TypeScript across the codebase

---

## 7. Local environment and dependencies

The repo expects local infrastructure for development.

`docker-compose.yml` starts:

- MongoDB
- Redis
- MinIO (S3-like local storage)

This is important because the app is designed as if it will later run on AWS, while local dev uses Docker to stand in for cloud services.

You will likely need:

- Node 20+
- MongoDB reachable locally or via Atlas
- environment variables in `.env`

The README includes instructions for running the app and connecting to MongoDB.

---

## 8. How auth works

The auth system is in the API routes and the web app auth context.

Main bits:

- `apps/api/src/auth.ts`
- `apps/api/src/routes/auth.ts`
- `apps/web/src/lib/auth-context.tsx`

The app supports user sign-in and role-based access. It also has a special staff flow for authority accounts.

Important product behavior:

- citizen accounts can report issues
- authority accounts can triage and resolve issues
- admin can manage access and oversight
- public browsing does not require sign-in

---

## 9. How the map and dashboard are used

The app is not just a form; it is a public accountability tool.

The web frontend has pages like:

- map view for geography
- issue page for detail and timeline
- dashboard for department/ward stats
- queue page for authority work
- review page for moderation and review of uncertain merges

The map and stats are designed to make the city’s problems visible and trackable over time.

---

## 10. What to read first

If you are starting from zero, read in this order:

1. `README.md` — how the product is meant to work
2. `IMPLEMENTATION_PLAN.md` — roadmap and architecture goals
3. `package.json` — repo scripts and workspace layout
4. `apps/api/src/index.ts` — API startup and route wiring
5. `apps/web/src/main.tsx` — frontend bootstrap and providers
6. `apps/api/src/dedup.ts` — core product logic
7. `services/ai/app/main.py` — AI platform behavior

---
# 11. Quick mental model

If you want the shortest possible understanding:

- frontend = what citizens and staff see
- API = the decision-making backend
- shared package = the rules everyone agrees on
- AI = background intelligence for photos and dedup
- MongoDB/Redis/MinIO = persistence and infrastructure support

This repo is a demo-grade civic reporting platform, not a random web app. The real product goal is not just form submission; it is public trust, traceability, deduplication, and accountability.

---


## 12. Best next step

The next practical step is to run the app locally:

```bash
cd amar-shohor
cp .env.example .env
npm install
npm run seed
npm run dev
```

Then open the web app in the browser and click around the main flows:

- sign in
- submit a report
- look at a map issue
- inspect dashboard stats
- review staff queue behavior

That hands-on walkthrough will teach you more about the repo than reading the code alone.

