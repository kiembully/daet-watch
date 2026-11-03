# Architecture

## Shape

```
src/
  app/
    page.tsx                     feed (server-rendered first page, client for the rest)
    issue/[slug]/page.tsx        public issue page + OG metadata
    report/                      six-step report flow (full screen, offline-tolerant)
    map/  water/  leaderboards/  profile/  login/  mod/  status/  offline/  privacy/
    api/                         route handlers — every body validated with zod
  components/                    client components; the server renders the first paint
  lib/
    rules.ts                     PURE business rules (no I/O, no clock reads)
    queries.ts                   server-only reads (barangays, feeds, timelines, boards)
    dto.ts                       document → public wire shape (identity is stripped here)
    api.ts                       envelope, auth guards, rate limit, text screening
    db/mongoose.ts               the single mongoose import + connection lifecycle
    offline/                     Dexie draft store + single-flight flush queue
  models/                        Mongoose schemas
  auth.ts                        Auth.js config
  data/daet-barangays.json       generated from PSA PSGC 2023 boundaries
```

One Next app, no second service: the spec asked for route handlers, and a single deployable
removes CORS, a second project, and the cross-site cookie problem that breaks admin sessions in
Safari.

## Collections

| Collection | Purpose | Key indexes |
| --- | --- | --- |
| `barangays` | the 25 barangays of Daet | `psgcCode` unique, `centroid` 2dsphere |
| `users` | residents, moderators, (future) officials | `email` unique sparse, `phone` unique sparse |
| `issues` | the report itself | `slug` unique, `location` 2dsphere, `status+reportedAt`, `barangayId+status+reportedAt`, `category+status`, `mergedIntoId` |
| `issueupdates` | timeline events | `issueId+createdAt` |
| `confirmations` | one "me too" per person | `issueId+userId` **unique** |
| `fixvotes` | "this is fixed" votes, per round | `issueId+userId+round` **unique** |
| `reopenvotes` | "it is broken again" votes, per round | `issueId+userId+round` **unique** |
| `flags` | community reports on a post | `issueId+userId` unique, `resolvedAt+createdAt` |
| `shareevents` | share analytics | `issueId+createdAt` |
| `watersources` | refill stations, wells, taps | `location` 2dsphere, `barangayId+status+lastConfirmedAt` |
| `watertruckreports` | truck sightings | `barangayId+spottedAt` |
| `ratelimits` | fixed-window counters | `key+windowStart` unique, TTL on `expiresAt` |

### Why votes are a collection, not an array on the issue

The spec allowed either. A unique index on `(issueId, userId, round)` makes "one account, one
vote" a **database constraint** instead of an `if` statement two concurrent requests can both pass.
The counters on `issues` (`confirmations`, `fixVotes`) are the denormalised read path, and are
always written from the vote documents, never from a request body.

`round` is the reopen generation: round 0 is the first fix vote, and after a reopen the counter
increments so the same three people can confirm the next fix.

## Business rules — all in `src/lib/rules.ts`

| Rule | Implementation |
| --- | --- |
| `days_unfixed` | `floor((now − reportedAt) / 24h)`, computed at read time, **never stored** |
| Colour bands | 0–7 neutral, 8–30 amber, 31+ red |
| Fixed counter | frozen as `daysToFix = reportedAt → fixedAt` |
| Fix threshold | `fixThreshold` (default 3) **distinct** residents; the reporter's vote counts once |
| Reopen | only within 60 days of `fixedAt`, needs the same threshold in reverse; a moderator can reopen alone |
| Merge | duplicate is hidden and points at the survivor; the survivor keeps the **oldest** `reportedAt` |
| Auto-hide | `flagCount >= 3` → `status: hidden` pending moderator review |
| Dedupe suggestion | `$nearSphere` within 100 m, same category, open only |
| Water freshness | unconfirmed for >48h renders as "unconfirmed", never as current |
| Timestamps | `reportedAt` is set by the server only; a client-supplied value is never read |

Every one of those has a Vitest case in `src/lib/rules.test.ts` — they are the rules a bug would
silently corrupt, which is why they are the only thing tested.

### Why "longest unfixed" needs no counter

`days_unfixed` is monotonic in `reportedAt`, so sorting by `reportedAt ASC` **is** the
longest-unfixed order. Cursor pagination is then `(reportedAt, _id)`, stable under inserts — a
skip/limit page would silently repeat or drop rows as new reports arrive.

## Request flow

```
client component ──fetch──> route handler
                               │  zod parse → 422
                               │  requireUser → 401
                               │  enforceRateLimit → 429
                               │  screenText (strip HTML, cap links, profanity hook)
                               ▼
                            Mongoose ──> Atlas
                               │
                               ▼
                     { item } / { items, total, nextCursor } / { ok } / { error }
```

Envelopes are fixed so no client has to guess: `item()` for one, `list()` for many, `fail()` for
errors with `{error:{code,message,details}}`. Validation is 422, auth 401/403, a missing database
is **503 `db_unavailable`** (never a 500), and a duplicate vote is a named 409 rather than an
`E11000` surfacing as "something went wrong".

### Rate limits live in Mongo

In-memory counters reset whenever Vercel recycles a container — exactly when a spammer retries.
The limiter is a fixed-window `$inc` on `ratelimits`, keyed `${userId}:${action}` with a TTL index.
Defaults: 5 reports/day, 20 confirms/day, 10 flags/day, 50 fix votes/day.

## Identity

`toPublicIssue()` is the only place a document becomes public. Reporter identity is resolved
there:

1. `showName === true` and a name exists → the real name;
2. otherwise the user's `displayAlias` ("Neighbor 3B");
3. otherwise `Neighbor from Brgy. <the issue's barangay>`.

Email, phone, `_id` and trust score never appear in a public payload.

## PWA and offline

| Concern | Implementation |
| --- | --- |
| Worker | `public/sw.js`, hand-written. next-pwa/Serwist inject through webpack and Next 16 builds with Turbopack, so the plugin would silently do nothing |
| Caching | shell + icons cache-first; API GETs stale-while-revalidate; issue pages and navigations network-first with a cached fallback; `/offline` as the last resort |
| Drafts | Dexie (`daet-watch` DB). A report is written to IndexedDB before any network call, photos included as compressed data URLs |
| Sync | one `flushQueue()` guarded by a module-level flag, so a sync event + `online` + focus cannot triple-post. Uploads each photo, POSTs the issue, deletes the draft. Failures keep the draft with its error |
| Install | `beforeinstallprompt` captured, banner delayed 18s and only on touch devices; iOS gets an instructions sheet because Safari has no prompt event |

The service worker is served with `Cache-Control: no-store` — a cached worker is a worker that
never updates.

## Share images

`/api/og/[slug]` renders with `next/og`:

- 1200×630 landscape and 1080×1350 portrait (`?format=portrait`);
- Anton + Inter **woff** files committed under `public/fonts/` — Satori reads ttf/otf/woff, never
  woff2, and Google's CSS2 endpoint only serves woff to a legacy UA;
- fonts are fetched from the request's own origin at render time; if that fails the card renders
  without them rather than 500ing;
- the QR code is generated as an SVG data URI;
- `s-maxage=21600` so DAY 47 becomes DAY 48 within six hours without a rebuild.

The issue page's Open Graph and Twitter metadata point at that route, which is what makes a
pasted link render a rich preview in Messenger or Viber.

## Adding the LGU "official" role

Already present, deliberately unbuilt:

1. `users.role` includes `"official"`; `requireModerator()` already accepts it.
2. `issueupdates.type` includes `"official_response"` — the timeline renders any type it is given.
3. `toPublicIssue()` does not expose roles, so an official's reply needs one new field
   (`officialResponseId` or a `verifiedBy` array on the issue) rather than a schema rewrite.
4. A responder console would be `/lgu` with `role === "official"` in its layout, reusing
   `POST /api/mod/[slug]` for status changes and a new `POST /api/issues/[slug]/official-response`
   for the reply itself.
5. Nothing in the current data model would need migrating: issues, votes and timelines are all
   keyed on ids, not on who may write them.
