# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary — the public observer.** Anyone who opens the map or the accountability dashboard
without an account, to check what is broken in their area and whether anything is being done
about it. Reading never requires signing in, and this visitor's experience is the one that must
not be compromised: the shared public record *is* the product's claim, and a citizen or an
auditor who cannot read it has nothing to trust.

Three further roles use the product and are already implemented, but yield to the observer when
priorities conflict:

- **Citizen reporter** — on the street, on a mid-range Android phone, often on a bad connection,
  frequently Bengali-only. Photo → GPS → category → submit, in around sixty seconds. Signs in by
  email and a password, with no confirmation step.
- **Authority staffer** — a department- and ward-scoped triage queue at a desk: priority sort,
  assignment, an SLA clock, and a proof-of-fix photo attached to the closure where one exists.
- **Moderator / verifier** — works the review queue where deduplication was not confident enough
  to auto-merge: approve, reject, merge, split.

## Product Purpose

Citizens report a city problem in under a minute. Duplicate reports collapse into **one verified
problem** on a live map, ranked by an explainable priority score, assigned to an authority, and
tracked in public until it is fixed.

Success is that the map reads as one shared truth rather than a complaint pile: many reports of
the same pothole appear as one problem with a report count, every problem's rank can be checked
factor by factor, and every status change is a public, timestamped, append-only event. The
question "what happened after I reported?" always has an answer on screen.

## Positioning

Three things a neighbouring civic-reporting app could not truthfully copy:

- **Deduplication that shows its work.** Distance, category agreement, time proximity, image
  similarity and text overlap, renormalised over the factors that actually had data. Above the
  auto-merge threshold it merges; between the thresholds it waits for a human, because a wrong
  merge hides a real problem. The merge proof card puts "3 reports → 1 problem" on screen with
  the contributing photos.
- **An auditable priority score.** Five named factors — severity, report count, population
  density, days open, hazard flag — with weights summing to exactly 100. Every API response
  carries each factor's normalised value, weight, points contributed, and a plain-language
  reason; the UI renders that and never recomputes it. No black box on a public accountability
  tool.
- **Accountability as a scoreboard.** Resolution rate, median time-to-fix and open backlog per
  ward and per department, published rather than claimed. Closure records a note and, where the crew took one,
  a proof-of-fix photo; counting toward resolution statistics needs the reporter's
  own sign-off.

## Operating Context

- **Academic capstone / demo.** The real audience is a jury, supervisors and a pitch deck
  (`Amar_Shohor Slide.pptx`). The product must read as credible and complete inside a short live
  demo — every surface someone might click during ten minutes has to hold up. It is not being
  hardened for a city-scale rollout.
- **Pilot geography is Dhaka.** Ward and city boundaries are GeoJSON polygons; a report is
  stamped with its ward on write.
- **Bengali-first.** `<html lang="bn">` by default with an English toggle, set in Hind Siliguri
  alongside Archivo and IBM Plex Mono. Bengali is the default language, not the alternate.
- **Field conditions drive the report flow.** Client-side image compression, an IndexedDB offline
  queue flushed by a service worker, a duplicate warning shown before submit, and an AI
  enrichment path that is asynchronous so a dead inference service never blocks a citizen.
- **Night use is normal.** Light, dark and system come from one token layer, applied before first
  paint, with the map basemap swapping with the theme rather than staying a bright rectangle.
- **Fourteen-phase build plan** in `IMPLEMENTATION_PLAN.md`, AWS-bound by design: storage, queues
  and inference sit behind interfaces so deployment is configuration, not a rewrite.

## Capabilities and Constraints

Built and working end to end today (React + Vite + TypeScript web app, Express + Mongoose API,
FastAPI intelligence service, Leaflet/OpenStreetMap map, plain-CSS token design system):

- Email-and-password sign-in with no confirmation step, passwords stored with scrypt and the cost
  parameter carried in the hash. A citizen account is self-service; an authority account needs a
  department and the shared staff code, so nobody can appoint themselves to the city. **Phone/SMS
  sign-in was removed**: no gateway exists, and `phone` survives only as a contact detail, never as
  authentication.
- Four roles — citizen, verifier, authority, admin — with a per-user trust score.
- Eight problem categories, each with an owning department and an SLA window; a six-state
  lifecycle (reported → verified → assigned → in_progress → resolved, plus rejected) whose legal
  transitions are enforced server-side.
- `Report` (one submission) versus `Issue` (a cluster) as distinct collections, with append-only
  `StatusEvent` serving as both the public timeline and the audit log.
- Live map with clustering, viewport-bounded queries, URL-persisted filters, and a paired list
  view that gives low-end devices and screen-reader users the same data as rows.
- Proximity-gated, trust-weighted community verification with a published threshold.
- Authority workspace: priority triage, assignment, SLA clock, proof-of-fix photo,
  citizen sign-off.
- Accountability dashboard with per-ward and per-department figures.

Deliberately incomplete, and marked as such in the code rather than faked — **future work must
not present any of these as finished**:

- Vision models are heuristics, not trained. The classifier caps its own confidence at 0.62 and
  the citizen's category always wins; every override is logged as training signal.
- Image embeddings are a DCT perceptual hash (good at near-duplicates of the same spot), not
  DINOv2/CLIP.
- Vector search runs in-process over the geo query's candidates, not Atlas Vector Search.
- The S3 storage driver throws 501; only the local driver works.
- Predictive hotspots are absent — the dashboard says so on the page instead of showing invented
  numbers.
- No SMS and no web push.
- No Terraform, no test suite.

Undecided / unresolved: the labelled Bangladeshi street-imagery dataset the vision and dedup
models need does not exist yet; the dedup thresholds are meant to be tuned against measured
moderator capacity rather than by feel; and authority adoption is treated as a product problem
(ship the internal queue's value before the public scoreboard), not a technical one.

## Brand Commitments

- **Name:** Amar Shohor / আমার শহর. Tagline: এক শহর, এক মানচিত্র — "one city, one map".
- **Bengali-first** interface with English as the toggle.
- **Dark mode is part of the design**, not a retrofit — one token layer for light, dark and
  system.
- **Accessibility floor:** WCAG AA contrast in *both* themes, visible focus rings,
  `prefers-reduced-motion`, 44px minimum touch targets.
- **Honesty in the interface.** Unbuilt capability is stated on the page rather than mocked;
  automated decisions show their reasoning; nothing is presented as measured when it is seeded.

## Evidence on Hand

Real and citable:

- `Amar_Shohor Slide.pptx` — the pitch deck the eight categories and the "one map" promise come
  from.
- `IMPLEMENTATION_PLAN.md` — the fourteen-phase build plan, prepared 10 September 2026.
- Deterministic Dhaka seed data: **127 reports collapsing into 58 problems (69 duplicates merged)
  across 10 wards**, with a full lifecycle spread. Any figure taken from it must be labelled as
  seeded demo data, never as real usage.
- Real Dhaka street photographs **exist but are not in the repository**. The user will supply them
  on request. Design work should mark image slots and ask for them rather than substituting stock
  imagery or generated pictures of Dhaka.
- A **real city/ward partner exists but is deliberately unnamed** in this record. Future work may
  say a participating authority exists; it must not name one, describe the scope of the agreement,
  or imply a signed pilot.

Explicitly absent — must not be fabricated:

- No real citizen reports, no real users, no interviews, no field testing.
- No testimonials, customers, press, benchmarks, pricing, licensing or deployment claims.
- No live deployment; nothing is on AWS.

## Product Principles

1. **Reading is free and comes first.** The public map and dashboard work with no account, on any
   device, in either theme. When a design decision helps a signed-in role at the observer's
   expense, the observer wins.
2. **One problem, not many complaints.** Every surface should make the collapse of duplicates into
   a single verified problem visible, because that is the product's central claim.
3. **Nothing automated is unexplained.** A merge, a priority rank, a status change and a model
   prediction each show what produced them, at the level of detail a sceptical citizen could check.
4. **The citizen is never blocked.** Submit succeeds before enrichment, offline before online,
   the citizen's own category over the model's guess. Nothing typed or photographed is lost.
5. **Say what is not built.** A gap stated plainly on the page is worth more than a convincing
   mock, particularly in front of a jury.

## Accessibility & Inclusion

- WCAG AA contrast required in **both** light and dark themes; the chart palette is validated for
  colour-vision deficiency in both (the obvious green/amber pair failed deuteranopia separation,
  which is why the trend chart is blue and orange).
- Screen-reader labels and keyboard navigation must hold in **both languages and both themes**.
- The list view is a first-class equivalent of the map, not a fallback — it exists for
  screen-reader users and low-end devices and carries the same data.
- Bengali typography needs a looser line-height than the Latin scale.
- 44px minimum touch targets; thumb-reachable primary actions on the mobile shell.
- `prefers-reduced-motion` respected.
