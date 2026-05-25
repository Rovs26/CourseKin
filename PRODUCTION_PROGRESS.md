# ReviewFlow Production Migration — Progress Tracker

**Hardening in progress: May 25, 2026. This branch addresses turnover-review launch blockers before any production deploy.**

This file tracks the status of each phase in the production migration.
After completing each sub-task, update the status marker: [ ] = not started,
[~] = in progress, [x] = done.

At the end of each phase, record the git commit SHA and any manual follow-ups
the human needs to do (like setting an environment variable in Railway or
verifying a DNS record).

## Phase 0 — Bootstrap
[x] Create PRODUCTION_PROGRESS.md
[x] Create DEPLOYMENT.md
[x] Create api/.env.example
[x] Create frontend/.env.local.example
[x] Verify .env files are in .gitignore
[x] Commit

Commit SHA: 261479d
Manual follow-ups: none.

## Phase 1 — OpenAI cost controls
[x] Switch default model to gpt-4.1-nano via env var
[x] Lower MAX_SOURCE_CHARS from 400000 to 50000
[x] Add max_tokens=1500 and timeout=60 to OpenAI call
[x] Create usage_log table + UsageLog model
[x] Create usage_service.py with check_monthly_quota + record_usage
[x] Instrument generation_service to call both
[x] Add FREE_TIER_MONTHLY_USD config
[x] Test: verify quota blocks 11th generation when limit is low
[x] Commit

Commit SHA: d5468f1
Manual follow-ups: on OpenAI dashboard, verify auto-recharge is OFF and
monthly budget alert is set to $10 with thresholds at $3/$6/$9.

## Phase 2 — Clerk JWT backend verification
[x] Add fastapi-clerk-auth to requirements.txt
[x] Add CLERK_JWKS_URL, CLERK_SECRET_KEY, CLERK_ISSUER to config
[x] Create app/core/auth.py with get_current_user dependency
[x] Apply dependency to all mutation and data-access routes
[x] Enforce user_id ownership checks on project/source/job fetches
[x] Remove X-User-Id from CORS allow_headers
[x] Update frontend API client to send Clerk JWT as Authorization: Bearer
[x] Test: verify unauthenticated calls return 401
[x] Commit

Commit SHA: ce0ef43
Manual follow-ups: in Clerk dashboard, under JWT Templates, ensure the default
template includes the user ID claim. Get the JWKS URL from Clerk → API Keys.
Set CLERK_JWKS_URL, CLERK_SECRET_KEY, CLERK_ISSUER in Railway/Render env vars.
Valid-JWT and cross-user-403 tests must be run in staging once Clerk is wired up.

## Phase 3 — Per-user rate limiting
[x] Create key_func that returns user_id for authed, IP for anon
[x] Set /jobs/generate limits to 10/hour, 30/day, 100/month per user
[x] Set /sources/upload limits to 20/hour per user
[x] Set /sources/url limits to 20/hour per user
[x] Set global default 600/hour per user
[x] Return friendly 429 messages
[x] Commit

Commit SHA: c657fe3

## Phase 4 — PostgreSQL migration with Alembic
[x] Add psycopg2-binary, alembic to requirements.txt
[x] Initialize alembic/ directory
[x] Generate initial migration from current models
[x] Remove ALTER TABLE hacks from main.py
[x] Update DATABASE_URL handling (sqlite dev, postgres prod)
[x] Add pool_pre_ping=True for Neon serverless
[x] Document migration workflow in DEPLOYMENT.md
[x] Test: migrate local SQLite (all 5 tables, API boots, health 200)
[x] Commit

Commit SHA: 77f8435
Manual follow-ups: run `alembic upgrade head` against Neon production DB
when deploying. Create a Neon branch for staging.
Neon test (step 7b) skipped this session — run manually once Neon dev branch exists:
  DATABASE_URL=<neon-dev-url> alembic upgrade head

## Phase 5 — Cloudflare R2 + presigned uploads
[x] Add boto3 to requirements.txt
[x] Add R2_* env vars to config (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_ENDPOINT_URL, R2_PRESIGN_EXPIRY_SECONDS)
[x] Create app/services/storage_service.py with presign_put/get/download/delete
[x] Add storage_key column to sources (nullable, migration a9ac25803428)
[x] New endpoints: POST /sources/upload/presign + POST /sources/upload/finalize
[x] Remove old multipart POST /sources/upload
[x] Update frontend upload component to presign → PUT (XHR with progress) → finalize flow
[x] delete_source also calls storage_service.delete_object for R2-backed sources
[ ] Test: full upload → generate flow against real R2
[x] Commit

Commit SHA: 6aa8325
Manual follow-ups:
- In Cloudflare R2 dashboard → reviewflow-uploads bucket → Settings → Lifecycle rules:
  1. Delete objects with prefix "temp/" after 7 days
  2. Delete incomplete multipart uploads after 1 day
- Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT_URL in Railway env vars
- Live upload test (step 8) must be done once R2 bucket and env vars are configured

## Phase 6 — Input-hash generation cache
[x] Add generation_cache table + model
[x] Compute SHA256 of extracted_text + model + prompt_version + sections + counts
[x] Check cache before OpenAI call
[x] Store result after successful OpenAI call
[x] Expose cache hit rate in GET /admin/cache-stats
[x] Commit

Commit SHA: 1e3775d

## Phase 7 — Abuse prevention hardening
[x] Add python-magic and httpx to requirements.txt
[x] MIME-check uploaded PDFs with python-magic (validation_service.py)
[x] Reject PDFs >100 pages (validate_pdf_structure)
[x] Reject extracted text <500 chars (validate_extracted_text)
[x] Add Turnstile widget to GenerationOptionsPanel (frontend)
[x] Verify Turnstile token on first 3 /jobs/generate calls per user
[x] Add BannedUser table + ban check in get_current_user dependency
[x] Create GET /admin/abuse page + POST /admin/abuse/ban + unban (frontend + backend)
[ ] Block disposable email domains in Clerk dashboard (manual — see follow-ups)
[x] Commit

Commit SHA: c7c0c77
Manual follow-ups:
- macOS dev: brew install libmagic (done). Linux/Railway Docker: apt-get install libmagic1 (add to Dockerfile in Phase 10).
- Set TURNSTILE_SECRET_KEY in Railway env vars. Set NEXT_PUBLIC_TURNSTILE_SITE_KEY in Vercel env vars.
- In Clerk dashboard → User & Authentication → Attack Protection: enable "Bot Protection".
- In Clerk dashboard → User & Authentication → Email, Phone, Username: enable "Block subaddresses" and "Block disposable email domains".

## Phase 8 — Observability (Sentry + Axiom)
[x] Add sentry-sdk[fastapi] to requirements.txt
[x] Initialize Sentry in api/app/main.py
[x] Install @sentry/nextjs in frontend
[x] Configure Sentry in frontend via sentry.*.config.ts
[x] Add JSON formatter + Axiom HTTP handler to logging_config.py
[x] Create scripts/daily_digest.py
[x] Document Axiom alert rules in DEPLOYMENT.md
[x] Commit

Commit SHA:
Manual follow-ups:
- Set SENTRY_DSN_API in Railway env vars. Set NEXT_PUBLIC_SENTRY_DSN in Vercel env vars.
- Set AXIOM_TOKEN and AXIOM_DATASET in Railway env vars.
- Set RESEND_API_KEY in Railway env vars. Set ADMIN_EMAILS in Railway env vars.
- Set NEXT_PUBLIC_APP_ENV=production in Vercel env vars.
- Set SENTRY_AUTH_TOKEN in Vercel/CI env vars (for source map uploads during builds).
- In next.config.ts, replace "your-org-slug" with your actual Sentry org slug.
- In Axiom dashboard, create the 3 alert monitors documented in DEPLOYMENT.md.
- Schedule daily_digest.py cron on Railway in Phase 10.

## Phase 9 — Legal and compliance
[x] Update /privacy page with AI disclaimer, subprocessor list, GDPR rights
[x] Update /terms page with age-16+ requirement, user-content rules, AI accuracy disclaimer
[x] Add /legal/dpa page listing subprocessors
[x] Create cookie consent banner (EU-only via Cloudflare CF-IPCountry header)
[x] Create DELETE /users/me endpoint (Clerk delete + data purge + R2 purge)
[x] Create GET /users/me/export endpoint (ZIP of user data)
[x] Link both from /settings/account on frontend
[x] Commit

Commit SHA:
Manual follow-ups:
- Sign DPAs with OpenAI (platform.openai.com/account/data-controls), Clerk (automatic for
  paid tier), Cloudflare (in dashboard under Billing), Neon (automatic on Launch plan).
  Download all four DPA PDFs and store in a `legal/signed-dpas/` folder outside git.
- Set CLERK_SECRET_KEY in Railway env vars (needed for account deletion to call Clerk API).
- Install clerk-backend-api in production: it is in requirements.txt.
- The cookie consent banner relies on the CF-IPCountry header set by Cloudflare. In local
  dev this header is absent, so no banner appears. Test with a VPN or Cloudflare Workers
  once the site is deployed behind Cloudflare.

## Phase 10 — Deployment configuration
[x] Rewrite api/Dockerfile as multi-stage, non-root, slim
[x] Add HEALTHCHECK to Dockerfile
[x] Create railway.toml
[ ] Create vercel.json — SKIPPED (Vercel auto-detects Next.js; no rewrites needed)
[x] Create .github/workflows/ci.yml
[x] Create scripts/backup-db.sh
[x] Document every env var in DEPLOYMENT.md
[x] Document release workflow in DEPLOYMENT.md
[x] Commit

Commit SHA:

### Manual deployment steps (do these in order)
[ ] a) Railway: connect GitHub repo, select "Deploy from railway.toml", wait for first build
[ ] b) Railway: add all API env vars from DEPLOYMENT.md (API section)
[ ] c) Railway: add custom domain api.reviewflow.app; point CNAME in Cloudflare DNS to Railway hostname; start with gray cloud (DNS only) so Railway provisions TLS; once healthy flip to orange cloud (proxied)
[ ] d) Vercel: connect repo, set root directory to frontend/, add all env vars from DEPLOYMENT.md (Frontend section)
[ ] e) Vercel: add custom domain reviewflow.app; follow Vercel DNS instructions in Cloudflare
[ ] f) Cloudflare: enable WAF Managed Rules on both api.reviewflow.app and reviewflow.app (free tier); enable Bot Fight Mode
[ ] g) Hit https://api.reviewflow.app/health — verify response is {"status":"ok","version":"0.1.0","env":"production"}
[ ] h) Hit https://reviewflow.app — verify marketing page renders
[ ] i) Sign up as a test user end-to-end: upload a PDF, generate, verify Axiom gets logs, Neon has data, R2 has the file

### Railway cron services (set up after main API is healthy)
[ ] Daily digest: new Railway service in same project with root directory `api/`, start command = `python -m scripts.daily_digest`, cron schedule = `0 9 * * *` (09:00 UTC = 17:00 Manila); reference all vars from main API service
[ ] Daily backup: new Railway service, start command = `bash scripts/backup-db.sh`, cron schedule = `0 2 * * *`; set AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY scoped to reviewflow-backups R2 bucket
[ ] Create R2 bucket `reviewflow-backups` (separate from uploads); set lifecycle rule: delete objects older than 30 days

## Phase 11 — Polar payments
[x] Add Subscription model + Alembic migration (d4f2a8bc91e3)
[x] Add Polar config vars to config.py
[x] Create POST /billing/checkout (Polar checkout session via direct API)
[x] Create GET /billing/subscription (return current plan status)
[x] Create POST /webhooks/polar (Svix signature verified, upserts Subscription row)
[x] Update usage_service: tier-aware monthly quota + daily cap (free=3/day, plus=50/day)
[x] Call check_daily_cap in jobs.py alongside check_monthly_quota
[x] Add Billing page at /settings/billing (plan badge, upgrade cards, manage link)
[x] Add Billing to sidebar nav
[x] Rewrite pricing page with real plans and upgrade CTAs
[x] Commit

Commit SHA:

### Manual follow-ups
[ ] Sign up at polar.sh and complete seller onboarding (Philippines tax ID or individual seller)
[ ] Create "Plus Monthly" product at $5.99 — note its Product ID from the dashboard
[ ] Create "Plus Yearly" product at $39.99 — note its Product ID
[ ] Set POLAR_ACCESS_TOKEN in Railway env vars (Settings → Developers → Personal Access Token)
[ ] Add Polar webhook endpoint in Polar dashboard pointing to https://api.reviewflow.app/webhooks/polar; enable events: subscription.created, subscription.updated, subscription.canceled, subscription.revoked; copy the Signing Secret
[ ] Set POLAR_WEBHOOK_SECRET (whsec_...) in Railway env vars
[ ] Set POLAR_PLUS_MONTHLY_PRODUCT_ID = <product ID from dashboard> in Railway env vars
[ ] Set POLAR_PLUS_YEARLY_PRODUCT_ID = <product ID from dashboard> in Railway env vars
[ ] Test end-to-end: sign up, go to /settings/billing, click upgrade, complete Polar checkout, verify subscription row appears in DB, verify plan badge changes to Plus
[ ] Verify webhook by checking Railway logs for "Subscription upserted" after a test purchase
[ ] Keep `BILLING_ENABLED=false` until checkout, webhook idempotency, subscription revocation, and deletion tests succeed; then explicitly set it to `true`.

## Turnover hardening — SaaS launch blockers
[x] Align public API environment variable naming across frontend and CI/deployment docs
[x] Switch Polar checkout to the current product-based API and gate paid checkout behind `BILLING_ENABLED`
[x] Enforce upload size before/after R2 transfer and use lifecycle-compatible temporary keys
[x] Validate each URL redirect target before fetching remote content
[x] Apply Turnstile and reserved quota accounting to generate, regenerate, and batch requests
[x] Scope generated-content cache rows per user and delete/export them with account data
[x] Replace HTTP background generation with DB-backed jobs and a dedicated worker entry point
[x] Correct admin failure aggregation and add enforceable CI test coverage
[x] Fail production startup when required Postgres/auth/R2/Turnstile/shared limiter variables are absent
[ ] Live acceptance: R2 upload, Clerk deletion, Polar sandbox/live webhook flow, Redis, worker restart recovery, backup restore
