# Team contributions

**Amar Shohor** — a civic problem reporting and accountability platform.

The project was divided into five areas along module boundaries, so that each member owns a
coherent part of the system rather than a scattering of files. Ownership means the member wrote or
maintains that area, is the reviewer for changes to it, and answers for it under examination.

| Member | Student ID | GitHub | Area owned | Files |
|---|---|---|---|---|
| Mahedi Hasan Sorol | 0112310359 | [@MrTimonM](https://github.com/MrTimonM) | Domain model, priority scoring, deduplication engine | 16 |
| Antor Ghosh | 0112330131 | [@antorghSD](https://github.com/antorghSD) | Backend API, authentication, authorisation, administration | 20 |
| Tanjid Ahmad Anik | 0112230651 | [@tanjidahmad](https://github.com/tanjidahmad) | Web platform, design system, theming, accessibility | 21 |
| Sampriti Biswas Joya | 0112230018 | [@joyabiswas](https://github.com/joyabiswas) | Application screens, map, data visualisation | 13 |
| Meherin Sohani | 0112330420 | [@meherin20](https://github.com/meherin20) | Intelligence service, CI pipeline, QA, documentation | 14 |

Work reaches the shared branch through pull requests. [`.github/CODEOWNERS`](.github/CODEOWNERS)
maps each directory to its owner, so the correct reviewer is requested automatically. Three files
are deliberately shared between areas and are the only expected source of conflict: the client API
wrapper, the application router, and the shared request schemas.

---

## Mahedi Hasan Sorol — domain model, priority scoring, deduplication

The rules the rest of the system is built on, and the repository foundation.

- **The shared domain package.** Eight problem categories, each with its owning department, hazard
  flag and service-level budget; the six-state lifecycle and the table of legally permitted
  transitions; the role and department vocabulary.
- **The explainable priority algorithm.** Five weighted factors totalling exactly 100, a logarithmic
  curve on report count, and a return type of *factors* rather than a bare number — so every score
  can be published alongside its own reasoning.
- **The data model.** The separation of `Report` from `Issue`, the append-only `StatusEvent` with
  modification refused at the model layer, and the geospatial and compound indexes every query
  depends on.
- **The deduplication engine.** Candidate generation by indexed geospatial query, five-factor match
  scoring, and renormalisation over the factors that actually carried data — so a missing photograph
  embedding does not depress every score below the merge threshold.
- **Repository foundation.** Workspace configuration, ignore rules, and line-ending normalisation
  across five machines.

**Key files:** `packages/shared/src/` (domain, priority, geo, schemas, types),
`apps/api/src/models.ts`, `apps/api/src/dedup.ts`

---

## Antor Ghosh — backend API, authentication, administration

Every route, and every rule about who may do what.

- **The complete HTTP surface.** Authentication, reports, issues, media, authority workspace,
  administration and statistics.
- **Password authentication** using scrypt from the Node standard library, with the cost parameter
  stored alongside each hash, constant-time comparison, and an identical response for an unknown
  address and a wrong password — so the login form cannot be used to discover which addresses are
  registered.
- **Authorisation in middleware**, not in the interface, scoped by department as well as by role: an
  administrator, the owning department, or the assignee may act on a problem, and nobody else.
- **The staff code lifecycle.** Issue, scope to a department, limit by expiry and use count, consume
  on sign-up, and withdraw.
- **The media pipeline.** File type verified from magic bytes rather than the declared content type,
  size limits, server-side resizing and re-encoding, derivative thumbnails, and capture metadata
  retained for integrity checking but never served.
- **The storage adapter** and its drivers, and the seed and staff provisioning scripts.

**Key files:** `apps/api/src/routes/`, `apps/api/src/auth.ts`, `apps/api/src/storage.ts`,
`apps/api/src/seed.ts`, `apps/api/src/staff.ts`

---

## Tanjid Ahmad Anik — web platform, design system, accessibility

The foundation every screen is built on.

- **The client application shell.** Build configuration, routing, navigation for desktop and mobile,
  and the error surface that reports the first failure without destroying the page reporting it.
- **The design token layer.** The complete light palette defined once, only the changed tokens
  redefined for dark, and the stored preference applied before first paint — so no theme flashes.
- **The reusable component kit.** Cards, pills, meters, banners, empty states, segmented controls,
  sheets, tables and the icon set, all built to the WCAG AA contrast floor in *both* themes.
- **Client libraries.** The typed API wrapper, the authentication context, and the bilingual
  interface context with Bengali as the default language.
- **The offline queue.** A report filed without a connection is stored on the device and sent
  automatically when connectivity returns.
- **Accessibility.** Visible focus, keyboard reachability, reduced-motion support, and minimum touch
  target sizes.

**Key files:** `apps/web/src/styles/`, `apps/web/src/components/` (AppShell, ui, Icon,
ErrorSurface), `apps/web/src/lib/`, `apps/web/src/App.tsx`, `apps/web/vite.config.ts`

---

## Sampriti Biswas Joya — application screens, map, data visualisation

Every screen a user actually looks at.

- **Ten screens.** Home, live map, problem detail, report submission, my reports, triage queue,
  merge review, administration, accountability dashboard and sign-in.
- **The map canvas.** Marker clustering, viewport-bounded querying so payload does not grow with the
  database, theme-aware base layers, and a list view carrying the same data as a first-class
  equivalent rather than a fallback.
- **The merge proof presentation**, which puts the collapse of several reports into one problem on
  screen with the contributing photographs — the product's central claim, made visible.
- **The priority breakdown panel**, which renders the factors exactly as the server computed them
  and never recalculates a score.
- **The public timeline, verification panel and proof-of-fix** presentation on the problem page.
- **The dashboard charts**, with a palette validated for colour-vision deficiency in both themes.

**Key files:** `apps/web/src/pages/` (all ten), `apps/web/src/components/MapCanvas.tsx`,
`Charts.tsx`, `issue-parts.tsx`

---

## Meherin Sohani — intelligence service, CI, QA, documentation

- **The FastAPI intelligence service.** Photograph classification, severity estimation, relevance
  checking and image embedding, behind a bounded-timeout interface the platform can run entirely
  without.
- **The model registry**, which records the name, version and training status of every model — so a
  run of wrong predictions can be traced to the version that produced it.
- **The honesty controls on untrained models.** A capped confidence ceiling, the citizen's category
  always overriding the model, and every override logged as future training signal.
- **The perceptual hash embedding** used by deduplication, together with its verification that the
  transform is orthonormal and invertible.
- **The continuous integration pipeline.** Type-checking both applications, building the client and
  import-checking the service on every change.
- **Project documentation** and the contributor guide, including the code-owners mapping that
  records this division of work inside the repository itself.

**Key files:** `services/ai/`, `.github/workflows/ci.yml`, `.github/CODEOWNERS`,
`CONTRIBUTING.md`, `README.md`

---



See also [`docs/SRS-Amar-Shohor.pdf`](docs/SRS-Amar-Shohor.pdf) for the full requirements
specification, and [`CONTRIBUTING.md`](CONTRIBUTING.md) for the working agreement.
