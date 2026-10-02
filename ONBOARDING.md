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

## 1. High-level architecture

The app is organized like a small monorepo:

```text
amar-shohor/
├─ apps/
│  ├─ web/            # frontend UI
│  └─ api/            # backend API
├─ packages/
│  └─ shared/         # shared domain logic, types, schemas
├─ services/
│  └─ ai/             # AI/vision service
├─ docker-compose.yml # local database and storage stack
├─ package.json       # root scripts
├─ README.md          # product and local dev instructions
└─ IMPLEMENTATION_PLAN.md
```

In plain English:

- the frontend is the part users interact with
- the API is the app logic and data access layer
- the AI service handles image analysis, category guesses, severity, and embeddings
- the shared package keeps all the domain definitions consistent across frontend and backend

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

