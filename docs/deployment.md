# Noted production deployment runbook

Live: `https://noted-six-chi.vercel.app` (deployed 2026-10-04).
S3 details live in [phase-4-s3-deploy.md](./plans/phase-4-s3-deploy.md); this
note covers the rest of production: topology, every env var, the incident
log from deploy day, demo media, and what is still pending.

## Topology

| Layer    | Provider            | Detail                                                      |
| -------- | ------------------- | ----------------------------------------------------------- |
| App      | Vercel (personal)   | Project `noted`, auto-deploys `main`, Framework Next.js     |
| Repo     | GitHub (personal)   | `jethroDavid/noted`, author `jethrodavid6@gmail.com`        |
| Postgres | Neon                | Pooled connection string, `sslmode=require`                 |
| Redis    | Upstash             | TLS endpoint, full-access user (cache + pub/sub + presence) |
| Queue    | Upstash QStash (US) | Regional endpoint + token + signing keys, all same region   |
| Media    | AWS S3 via CDK      | Account `576884309830`, `us-east-1` (see phase-4 note)      |
| Auth     | Firebase            | Google sign-in; client config + service-account key         |

## Vercel project setup

- Framework preset: Next.js. Root Directory: `apps/web`. Defaults otherwise.
- Hobby plan, private repo: the commit author must be a contributor —
  company-email commits block deploys (see incident log). All history is
  `jethrodavid6@gmail.com`; keep `git config user.email` on the personal
  address.
- Every env change needs a redeploy to take effect.

## Environment variables (Production)

| Variable                                                                            | Value / format                                                      | Source                                              |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------- |
| `DATABASE_URL`                                                                      | `postgresql://...pooler...?sslmode=require&channel_binding=require` | Neon pooled string (NOT the direct host)            |
| `REDIS_URL`                                                                         | `rediss://default:<token>@<host>:6379` (note two `s`)               | Upstash Redis Connect tab, default full-access user |
| `QSTASH_URL`                                                                        | `https://qstash-us-east-1.upstash.io`                               | Upstash QStash Quickstart, US region                |
| `QSTASH_TOKEN`                                                                      | secret                                                              | Same Quickstart panel — same region as `QSTASH_URL` |
| `QSTASH_CURRENT_SIGNING_KEY`                                                        | secret                                                              | Same panel                                          |
| `QSTASH_NEXT_SIGNING_KEY`                                                           | secret                                                              | Same panel                                          |
| `APP_URL`                                                                           | `https://noted-six-chi.vercel.app` (no trailing slash)              | This deployment's URL                               |
| `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | per phase-4 note                                                    | CDK outputs + minted writer key                     |
| `FIREBASE_SERVICE_ACCOUNT_KEY_INLINE`                                               | service-account JSON on one line                                    | Firebase console → service account key              |
| `NEXT_PUBLIC_FIREBASE_API_KEY`                                                      | client key                                                          | Firebase console → web app config                   |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`                                                  | `*.firebaseapp.com`                                                 | Same                                                |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`                                                   | project id                                                          | Same                                                |
| `NEXT_PUBLIC_FIREBASE_APP_ID`                                                       | app id                                                              | Same (required — sign-in fails without it)          |

Secrets never enter chat or the repo — Vercel dashboard only.

## Service notes

- **Neon**: use the pooled string. The direct host exhausts connections
  under serverless; the pooler is required.
- **Upstash Redis**: ioredis enables TLS only via the `rediss://` scheme.
  A `redis://` URL against the TLS endpoint dies with `read ECONNRESET`.
  The user must have full command access — a restricted user fails every
  write with `NOPERM` (the app fails open, so the board works but cache,
  realtime, and presence silently degrade).
- **Upstash QStash**: two independent regions (EU default, US). Tokens and
  signing keys are region-bound; the client defaults to EU
  (`https://qstash.upstash.io`), so a US token without `QSTASH_URL`
  fails with `user ... not found in this region (eu-central-1)` and the
  job is dropped. `QSTASH_URL`, token, and both keys must come from the
  same region's Quickstart panel. Source:
  `https://upstash.com/docs/qstash/howto/multi-region`.
- **Firebase**: Google provider only. The server verifies ID tokens with
  the Admin SDK; the client needs all four `NEXT_PUBLIC_*` values.
- **AWS**: SSO login via the `noted` profile (no long-lived keys except
  the bucket-scoped writer key in Vercel). Every CLI/CDK command pins
  `--region us-east-1` / `AWS_REGION=us-east-1` explicitly.

## Verify a deploy

1. `GET /api/trpc/hello.greet?batch=1&input={"0":{"json":{}}}` → 200
   `Hello, world!`
2. `GET /api/trpc/me.get?...` without a token → 401
   `Sign in to continue.`
3. Sign in with Google; create a home; post a text note.
4. Upload a photo, confirm it renders; remove it, confirm the book
   archive (exercises presigned PUT/GET/delete + the process-media job).
5. Two-browser check: a move on one appears on the other (proves Redis
   pub/sub, not just polling).

## Incident log (deploy day 2026-10-04)

- **Deploy blocked: commit author.** Vercel Hobby rejects deploys whose
  commit author lacks access; history was on the company identity.
  Fixed by rewriting 27 commits to `jethrodavid6@gmail.com` and
  force-pushing with lease (explicit owner go-ahead).
- **`No Output Directory named "public"`.** Project created with wrong
  framework settings. Fixed: Framework Next.js, Root `apps/web`.
- **`Sign-in is unavailable for now.`** Client Firebase config missing.
  Fixed by adding the four `NEXT_PUBLIC_FIREBASE_*` vars.
- **Empty 500 on all `/api/trpc/*`.** The tRPC bundle evaluated `sharp`
  - `ffmpeg-static` at import via the `@noted/media` barrel.
    Fixed (`1c784b3`): variants moved to a subpath import, loaded lazily
    in `handleProcessMedia`.
- **500 `ERR_REQUIRE_ESM` (`jose`).** `firebase-admin` →
  `jwks-rsa@4.1.0` → `jose@6` (ESM-only), but jwks-rsa `require()`s it
  from CJS — every route crashed at import. Fixed (`53cf0b1`): pnpm
  override pins `jose` to v5 (dual CJS/ESM; jwks-rsa uses only
  `importJWK`/`exportSPKI`, unchanged in v5), plus `firebase-admin` in
  `serverExternalPackages`.
- **`QSTASH_TOKEN is set but APP_URL is missing.`** Fail-fast on first
  publish. Fixed by adding `APP_URL` (no trailing slash).
- **Redis `read ECONNRESET`.** `REDIS_URL` pasted as `redis://` against
  a TLS endpoint. Fixed: `rediss://` scheme.
- **Redis `NOPERM` on `set`/`publish`/`zadd`/`del`/`info`.** Restricted
  Upstash user. Fix: repaste the default full-access credential.
  App fails open (board works, realtime/cache/presence degrade).
- **QStash `user not found in this region (eu-central-1)`.** US token,
  default EU endpoint. Fix: `QSTASH_URL` =
  `https://qstash-us-east-1.upstash.io` (note the segment order — the
  `https://us-east-1.qstash...` form does not resolve). Dropped jobs
  never retry: re-upload anything stuck `processing`.
- **Photos stuck `processing`, no client error.** Consequence of the
  QStash failure above: `confirmUpload` returns 200 while the
  `process-media` job is dropped. Re-upload after the endpoint fix.

## Demo media (`test-media/`, gitignored)

Working-tree folder, never committed. Upload caps: photos 10MB
(jpeg/png/webp), videos 100MB (mp4/webm).

- `photos/family/` — 9 modern candid family shots (Wikimedia Commons).
- `photos/vintage/` — 6 vintage family photos, each eyeballed (Commons).
- `photos/` root — 8 generic orientation/size variants (Picsum).
- `clips/` — 5 Prelinger/Archive.org home movies 1940–1959, verified
  via ffmpeg frame extracts (wedding, snow day, two vacations,
  children's party). `clips/vintage-thumbs/` holds preview stills.
- `.local/tv-samples/` — 5 older dog clips (pre-dates this set).

All Commons/Archive.org material is freely licensed; Picsum and MDN
samples are free for test use.

## Pending and risks

- QStash `sweep-reels` schedule not created: `0 3 * * *` →
  `{APP_URL}/api/workers/sweep-reels`, body `{"job":"sweep-reels"}`.
- Rate/cost guards and Upstash Fluid limits not verified.
- `docs/plans/qa-driving-lanes.md` fails root `prettier --check`
  (pre-existing); `PLAN.md` carries owner edits.
- Next: two-account + physical-phone reviews, then resume the
  Capacitor grill (`docs/plans/capacitor-shell.md`, Draft-PAUSED).
