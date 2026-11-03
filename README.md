# Daet Watch

A community-driven civic issue tracker for **Daet, Camarines Norte**. Residents report what
is broken — no water, broken roads, drainage, garbage, streetlights — and every issue carries a
public, growing **DAYS UNFIXED** counter. Only residents can mark an issue fixed, and it takes
three of them.

There is no LGU involvement in this version. The data model reserves an `official` role for a
future responder console without a rewrite (see `ARCHITECTURE.md`).

**Community-reported. Not verified by the LGU.** That line appears on every issue page and on
every share card, because it is the honest description of what this is.

---

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16 App Router, TypeScript strict, Tailwind CSS v4 |
| API | Next route handlers (one deployable — no separate API service) |
| Data | MongoDB Atlas via Mongoose 9, `2dsphere` geo index |
| Auth | Auth.js v5 (JWT sessions) — Google, Facebook, phone demo login |
| Photos | Cloudinary **signed direct upload** (bytes never touch the function) |
| Share cards | `next/og` (Satori) — 1200×630 and 1080×1350 |
| Maps | Leaflet + OpenStreetMap raster tiles (no API key) |
| PWA | Hand-written service worker + manifest + Dexie offline queue |
| Tests | Vitest, on the business rules only |

## Quickstart

```bash
npm install
cp .env.example .env.local     # fill MONGODB_URI + CLOUDINARY_* + AUTH_SECRET
npm run seed                   # 25 real barangays + 18 marked demo issues
npm run dev                    # http://localhost:3000
```

`/status` shows the live database connection, document counts and which integrations are
configured. `/api/health` returns the same as JSON — a 200 with `{count: 0}` is the failure mode
a status-code check cannot see, so the counts are always included.

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | dev server |
| `npm run build` / `npm start` | production build / serve |
| `npm run typecheck` | `tsc --noEmit` (strict, no `any`) |
| `npm run lint` | ESLint (next core-web-vitals + typescript) |
| `npm run test` | Vitest — days counter, vote threshold, dedupe radius, merge date, bands |
| `npm run seed` | wipe + reseed the seeded collections |
| `npm run icons` | regenerate PWA icons from code (no image assets) |
| `node scripts/extract-barangays.mjs <path>` | regenerate `src/data/daet-barangays.json` |

## Environment

Everything is in `.env.example`. The three that matter:

| Variable | Notes |
| --- | --- |
| `MONGODB_URI` | Atlas SRV string. The app boots without it — reads render, writes answer `503 db_unavailable` |
| `AUTH_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | the API secret stays server-side; the browser only ever sees a signature |

Client-inlined values (`NEXT_PUBLIC_*`) are baked at build time — set them **before** the first
deploy, not after.

### MongoDB Atlas

1. Create (or reuse) a project, and a cluster on the free tier.
2. **Database Access** → add a user with *Read and write to any database*.
3. **Network Access** → `0.0.0.0/0` (Vercel functions egress from dynamic IPs; narrow this only if
   you have static egress).
4. Take the SRV string and append the database name: `…mongodb.net/daet-watch`.
5. `npm run seed` — this is what proves the credential, not the dashboard's green dot.

### Cloudinary

1. Free account → dashboard → **API keys**.
2. Copy cloud name, API key and API secret into the env.
3. Uploads go through `POST /api/uploads/sign`, then the browser PUTs directly to Cloudinary.
   If the three values are missing, `/api/uploads/sign` answers `503 storage_unavailable` and the
   report flow stores drafts locally instead of pretending to upload.

### Google / Facebook login

Both providers are optional and env-gated. Without them the phone demo login is the only door.

- **Google**: [console.cloud.google.com](https://console.cloud.google.com/apis/credentials) →
  Create OAuth client → Web application → authorised redirect URI
  `https://<your-domain>/api/auth/callback/google`.
- **Facebook**: [developers.facebook.com](https://developers.facebook.com/apps) → Create app →
  Facebook Login → Valid OAuth redirect URI `https://<your-domain>/api/auth/callback/facebook`.
  Facebook requires a **Privacy Policy URL** (use `/privacy`) and app review before non-testers
  can sign in.

Set `ENABLE_DEMO_LOGIN=0` in production once a real provider works: the phone login accepts any
11-digit number without an OTP.

### Promote a moderator

No self-service. Either:

```js
// mongosh
db.users.updateOne({ email: "you@example.com" }, { $set: { role: "moderator" } })
```

…or put the email in `MODERATOR_EMAILS` (comma-separated) — the next sign-in promotes it.

The seed ships a working moderator account: `moderator@daet.watch`, phone **09000000000**. Sign in
with the demo phone login using that number and `/mod` opens. Override with `SEED_MODERATOR_EMAIL` /
`SEED_MODERATOR_PHONE` before seeding.

To promote a resident you already know, the demo phone account is the quickest handle:

```js
db.users.updateOne({ phone: "09171234567" }, { $set: { role: "moderator" } })
```

## Deployment (Vercel)

```bash
npx vercel link --yes --project daet-watch --scope kiembullys-projects
npx vercel deploy --prod --yes
```

Single project, no root-directory gymnastics. Set the environment variables for **both**
`production` and `preview`, then deploy, then:

```bash
curl -s https://<project>.vercel.app/api/health | head -c 400   # expect "connected": true and real counts
```

`NEXT_PUBLIC_SITE_URL` must be the production origin — it is inlined into every OG/canonical URL.
If you deploy before setting it, every share card will say `localhost`.

## What is real, and what is demo

- **Real:** the 25 barangays of Daet, with PSGC codes, areas and polygon centroids, extracted from
  PSA PSGC 2023 boundaries (NAMRIA geometry) published by BetterGov.ph. `src/data/daet-barangays.json`
  carries its own provenance block. It is flagged `verified: false` in the database until a human
  checks it against the LGU's own list.
- **Demo:** every issue, comment, confirmation, vote and water source in the seed. Each issue's
  description starts with "Demo data." and every photo is a generated placeholder card uploaded to
  Cloudinary under `daet-watch/seed/`.

## Known limitations

- **Phone login has no OTP.** The field exists so verification is a drop-in later; today any
  11-digit number starting with 09 signs in. Do not ship with it enabled as the only door.
- **Push notifications are wired but dark.** The service worker handles `push` and
  `notificationclick`; there is no subscription UI or VAPID sender until keys are set
  (`NEXT_PUBLIC_PUSH_ENABLED=1`).
- **Background Sync is Chromium-only.** iOS Safari has no sync event, so the offline queue also
  flushes on `online` and on `visibilitychange`.
- **Moderator merge takes an id** from a dropdown of open issues; there is no duplicate search box.
- **No account deletion UI** — it is a moderator task (see `/privacy`).
- **The Vercel Hobby plan is non-commercial.** Fine for a civic project; a sponsored version
  needs Pro.
- Water source status is community-reported only, with no LGU feed. A source unconfirmed for 48h
  renders as "unconfirmed" rather than as current.

## License

MIT.
