# Amar Shohor — আমার শহর

Citizens report city problems in under a minute. Duplicate reports collapse into **one verified
problem** on a live map, ranked by an explainable priority score, assigned to an authority, and
tracked in public until it is fixed.

---

## Run it

You need **Node 20+** and a **MongoDB** you can reach. Everything else is npm.

```bash
cp .env.example .env          # then set MONGO_URL (see below)
npm install
npm run seed                  # ~58 problem clusters across 10 Dhaka wards
npm run dev                   # API on :4000, web on :5173
```

Open **http://localhost:5173**.

### Getting a MongoDB

Any one of these; nothing in the code changes between them.

| Option | What to put in `MONGO_URL` |
|---|---|
| **MongoDB Atlas** free tier (no local install) | the SRV string from *Connect → Drivers* |
| Local install ([Community Server](https://www.mongodb.com/try/download/community)) | `mongodb://localhost:27017/amar_shohor` |
| Docker, if you happen to have it | `mongodb://localhost:27017/amar_shohor` after `docker compose up -d mongo` |

Atlas is the least work: create a free M0 cluster, allow your IP, paste the string. The seed
script and the API both print a readable message rather than a stack trace if they cannot connect.

### Signing in

**Name, email and a password.** Sign up on **/signin**, and the account works immediately — there
is no email confirmation step, because nothing in this app sends mail and an account gated behind a
message that never arrives is an account nobody can use.

Passwords are stored with **scrypt** from node's own crypto, as `scrypt$N$salt$hash` so the cost
parameter travels with each hash and can be raised later without invalidating old ones. Deliberately
no bcrypt or argon2 dependency: both are native modules, and both fail to build on exactly the
machines a demo runs on.

A wrong password and an address with no account return the **same** message. Distinguishing them
turns the login form into a test for whether an address is registered here, which is what someone
working through a list of leaked addresses wants.

**Two entities sign in through the same form.** A citizen account is self-service. An *authority*
account additionally needs a department and the shared `STAFF_SIGNUP_CODE`, because the difference
between the two is the power to close a problem on the public record — a sign-up carrying a
department but no code is refused. Leaving `STAFF_SIGNUP_CODE` blank closes staff registration
entirely, which is the right setting for anything that is not a demo.

Seeded accounts all share `SEED_PASSWORD` (default `amar1234`), so a jury can sign in as any role
without looking anything up. Seeded people who are not the operator get addresses under the reserved
`.test` TLD, which by RFC 2606 can never resolve.

**Phone sign-in was removed.** There is no SMS gateway, and a channel that cannot deliver is worse
than one that is absent: the endpoints, schemas and UI are gone rather than left to fail. `phone`
survives on the user record as a contact detail for SMS notifications, and is never used to
authenticate.

### The AI service (optional)

The app works with this switched off — reports still succeed and get enriched later. To run it:

```bash
cd services/ai
python -m venv .venv && .venv/Scripts/activate     # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

`GET /health` reports p50/p95 latency, mean confidence, and the **override rate** — how often a
citizen disagreed with the model, which is the most useful drift signal there is.

---

## Using the app

### 1 · Create an account

Go to **/signin**. Switch to **Sign up**, enter a name, an email address and a password of at least
8 characters, and you are in — no confirmation mail, nothing to wait for.

To sign in as a city department instead, pick **City authority** on the sign-up form, choose a
department and enter the staff code from `STAFF_SIGNUP_CODE`. That account lands in the triage queue
rather than on the map.

Reading the map and the dashboard needs no account at all.

### 2 · Submit a report

Go to **/report** (or tap the report button on the map). You need to be signed in.

1. **Allow location access** — the report is pinned where you are standing. You can drag the pin if
   the GPS is off.
2. **Take or attach a photo.** At least one is required, up to four. The photo is what makes the
   report verifiable by other people later.
3. **Pick a category** — road damage, water, waste, electricity, drainage, and so on.
4. **Set severity 1–5** and add a short description. Both are optional; the vision service fills in
   severity when you skip it.
5. **Submit.** The response comes back immediately — deduplication and photo analysis run in the
   background, so you are never left waiting.

If you are offline, the report and its photo are saved to the browser and sent automatically when
the connection returns. **/mine** lists anything still waiting to go out.

### 3 · What happens to it

Your report is matched against nearby reports from the last few weeks. If it is the same problem
someone else already reported, the two collapse into **one issue** — the issue page shows the merge
proof ("3 reports → 1 problem") with every contributing photo. Otherwise it becomes a new issue on
the map at **/**.

From there it gets a priority score you can audit factor by factor, and moves through its
lifecycle — reported → verified → assigned → in progress → resolved — with every change recorded on
a public timeline.

### 4 · Verify someone else's report

Open any issue from the map and confirm it. You have to be physically within
`VERIFY_PROXIMITY_M` (400 m by default) of the problem to vote, and confirmations are weighted by
your track record. Once the weighted total passes `VERIFY_THRESHOLD`, the issue becomes **verified**.

### 5 · Staff views

Accounts listed in `SEED_ADMIN_EMAIL` and `SEED_STAFF_EMAILS` sign in the same way and get two more
pages:

| Page | What it is for |
|---|---|
| **/queue** | The authority workspace — assigned issues, SLA clock, closing a job with an optional proof-of-fix photo |
| **/review** | The moderator console — merges the system was not confident enough to make on its own |

**/dashboard** is public: resolution rate, median fix time, SLA breaches by department, trends.

---

## Where things are

```
amar-shohor/
├─ packages/shared/          One source of truth for both sides of the wire
│  ├─ domain.ts              8 categories, lifecycle + legal transitions, roles
│  ├─ priority.ts            The explainable score — 5 named factors, weights sum to 100
│  ├─ schemas.ts             Zod request/response shapes
│  └─ types.ts               Response DTOs
├─ apps/api/                 Express + Mongoose
│  ├─ models.ts              Report vs Issue, append-only StatusEvent
│  ├─ dedup.ts               Candidate generation, match scoring, merge
│  ├─ ai.ts                  Async job queue + AI client + vector helpers
│  ├─ storage.ts             StorageAdapter: local disk now, S3 later   
│  ├─ seed.ts                Deterministic Dhaka data with real duplicate clusters
│  └─ routes/                auth, media, reports, issues, authority, stats
├─ apps/web/                 React + Vite, plain CSS design system
│  ├─ styles/tokens.css      Light / dark / system in one token layer
│  ├─ components/            Icon set, MapCanvas, charts, issue parts
│  └─ pages/                 Home, Map, Issue, Report, Mine, Dashboard, Queue, Review, SignIn
└─ services/ai/              FastAPI — vision, severity, relevance, embeddings
```

---

## The four things worth looking at

**1 · Deduplication that shows its work.** `apps/api/src/dedup.ts` scores each candidate on
distance, category agreement, time proximity, image-embedding similarity and text overlap, then
renormalises over the factors that actually had data — so a missing embedding does not silently
cap every score. Above `DEDUP_AUTO_MERGE` it merges; between that and `DEDUP_REVIEW` it holds for
a human, because a wrong merge hides a real problem. The **merge proof card** on the issue page
puts "3 reports → 1 problem" on screen with the contributing photos.

**2 · A priority score a citizen can audit.** No black box on a public accountability tool. Every
API response carries the five factors, each with its normalised value, its weight, the points it
contributed, and a plain-language reason. The UI renders exactly that and never recomputes it.

**3 · Dark mode as one system.** `tokens.css` defines the full light palette on bare `:root`,
redefines only tokens under `prefers-color-scheme: dark` (guarded so an explicit light choice wins),
and again under `[data-theme="dark"]`. An inline script in `index.html` applies the stored choice
before first paint. The map basemap swaps with it, so it is part of the design rather than a bright
rectangle punched through a dark page.

**4 · Nothing blocks the citizen.** Submit writes the report and returns; vision analysis and dedup
run in a background job. A dead connection sends the report — photo and all — to IndexedDB, and it
flushes itself on reconnect. `MyReportsPage` lists anything still unsent instead of hiding it.

---

## Configuration

Everything comes from the environment; nothing in the tree hardcodes a URL, key or bucket. That is
makes moving to hosted infrastructure a deployment rather than a rewrite. See [`.env.example`](.env.example) — the
tunable behaviour is:

| Variable | Default | What it does |
|---|---|---|
| `DEDUP_AUTO_MERGE` | `0.72` | At or above this match score, merge without asking |
| `DEDUP_REVIEW` | `0.50` | Between the two, hold for the moderator console |
| `DEDUP_RADIUS_M` | `120` | Candidate search radius |
| `VERIFY_THRESHOLD` | `3` | Weighted confirmations needed to mark a problem verified |
| `VERIFY_PROXIMITY_M` | `400` | How close a device must be to vote |
| `AI_ENABLED` | `true` | Set `false` to run without the Python service |
| `STAFF_SIGNUP_CODE` | — | The code that turns a sign-up into an authority account. Blank closes staff registration |
| `SEED_PASSWORD` | `amar1234` | The password every seeded account shares |

Tune the two dedup thresholds against measured moderator capacity, not by feel: too aggressive
floods the review queue, too loose lets bad merges onto the public map.
