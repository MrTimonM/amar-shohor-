# Contributing

Five people own this project. This file is how we keep that true in the git
history as well as in the room.

## Before your first commit — the step everyone gets wrong

GitHub decides who wrote a commit from the **email address inside it**. If that
address is not verified on your GitHub account, your commit shows no avatar and
never lands on your contribution graph. It will look like you did nothing.

Run this once, inside the repository:

```bash
git config user.name  "Your Real Name"
git config user.email "the-address-verified-on-your-github@example.com"
```

Do not have a verified address you want public? Use the noreply one GitHub
gives you, from **Settings to Emails**:

```bash
git config user.email "12345678+yourusername@users.noreply.github.com"
```

Then push one commit and check on github.com that your avatar is next to it,
**before** you write anything real.

## Who owns what

| Member | Area |
|---|---|
| 1 | Domain model, priority score, deduplication |
| 2 | Backend API, authentication, admin console |
| 3 | Web platform, design system, dark mode |
| 4 | Application screens, map, charts |
| 5 | AI service, CI pipeline, QA, documentation |

`.github/CODEOWNERS` encodes this and auto-requests the right reviewer.

## Working

Branch from `main`, named for your area:

```bash
git checkout main
git pull
git checkout -b 02-api/fix-photo-url
# work, commit as yourself
git push -u origin 02-api/fix-photo-url
```

Open a pull request, have a teammate review it, merge.

**Merge with "Create a merge commit" or "Rebase and merge" — not "Squash and
merge".** Squashing collapses several people's commits into one authored by
whoever pressed the button.

**Merge to `main` often.** The contribution graph only counts commits on the
default branch, so work parked on a branch for three weeks shows as nothing.

## Files two people share

Keep changes to these small, single-purpose, and in their own commit:

| File | Shared by |
|---|---|
| `apps/web/src/lib/api.ts` | 2, 3, 4 |
| `apps/web/src/App.tsx` | 3, 4 |
| `packages/shared/src/schemas.ts` | 1, 2 |

## Never commit

`.env`. It holds the database password. `.env.example` is the template that
belongs in the repo; the real one does not.
