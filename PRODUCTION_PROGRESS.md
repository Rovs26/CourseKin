# ReviewFlow Production Migration — Progress Tracker

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
[ ] Commit

Commit SHA:
Manual follow-ups: in Clerk dashboard, under JWT Templates, ensure the default
template includes the user ID claim. Get the JWKS URL from Clerk → API Keys.
Set CLERK_JWKS_URL, CLERK_SECRET_KEY, CLERK_ISSUER in Railway/Render env vars.
Valid-JWT and cross-user-403 tests must be run in staging once Clerk is wired up.

## Phase 3 — Per-user rate limiting
[ ] Create key_func that returns user_id for authed, IP for anon
[ ] Set /jobs/generate limits to 10/hour, 30/day, 100/month per user
[ ] Set /sources/upload limits to 20/hour per user
[ ] Set /sources/url limits to 20/hour per user
[ ] Set global default 600/hour per user
[ ] Return friendly 429 messages
[ ] Commit

Commit SHA:

## Phase 4 — PostgreSQL migration with Alembic
[ ] Add psycopg2-binary, alembic to requirements.txt
[ ] Initialize alembic/ directory
[ ] Generate initial migration from current models
[ ] Remove ALTER TABLE hacks from main.py
[ ] Update DATABASE_URL handling (sqlite dev, postgres prod)
[ ] Add pool_pre_ping=True for Neon serverless
[ ] Document migration workflow in DEPLOYMENT.md
[ ] Test: migrate local SQLite, then test against Neon dev branch
[ ] Commit

Commit SHA:
Manual follow-ups: run `alembic upgrade head` against Neon production DB
when deploying. Create a Neon branch for staging.

## Phase 5 — Cloudflare R2 + presigned uploads
[ ] Add boto3 to requirements.txt
[ ] Add R2_* env vars to config
[ ] Create app/services/storage_service.py with presign_put/get/delete
[ ] Add storage_key column to sources (nullable, migration)
[ ] New endpoint POST /uploads/presign
[ ] Rewrite POST /sources/upload as POST /sources/finalize
[ ] Update frontend upload component to presign → PUT → finalize flow
[ ] Delete old local UPLOAD_DIR logic
[ ] Test: full upload → generate flow against real R2
[ ] Commit

Commit SHA:
Manual follow-ups: in Cloudflare R2 dashboard, set lifecycle rule on
reviewflow-uploads to delete objects with prefix "temp/" after 7 days.

## Phase 6 — Input-hash generation cache
[ ] Add generation_cache table + model
[ ] Compute SHA256 of extracted_text + model + prompt_version + sections + counts
[ ] Check cache before OpenAI call
[ ] Store result after successful OpenAI call
[ ] Expose cache hit rate in GET /admin/cache-stats
[ ] Commit

Commit SHA:

## Phase 7 — Abuse prevention hardening
[ ] Add python-magic and disposable-email-domains to requirements.txt
[ ] MIME-check uploaded PDFs with python-magic
[ ] Reject PDFs >100 pages
[ ] Reject extracted text <500 chars or >50000 chars
[ ] Add Turnstile to frontend signup page
[ ] Verify Turnstile token on first /jobs/generate call per user
[ ] Add BannedUser table + ban check middleware
[ ] Create GET /admin/abuse page (behind Clerk role)
[ ] Block disposable email domains in Clerk dashboard
[ ] Commit

Commit SHA:
Manual follow-ups: in Clerk dashboard, enable "Block subaddresses" and
"Block disposable emails" under User & Authentication → Email, Phone,
Username.

## Phase 8 — Observability (Sentry + Axiom)
[ ] Add sentry-sdk[fastapi] to requirements.txt
[ ] Initialize Sentry in api/app/main.py
[ ] Install @sentry/nextjs in frontend
[ ] Configure Sentry in frontend via sentry.*.config.ts
[ ] Add JSON formatter + Axiom HTTP handler to logging_config.py
[ ] Create scripts/daily_digest.py
[ ] Document Axiom alert rules in DEPLOYMENT.md
[ ] Commit

Commit SHA:
Manual follow-ups: in Axiom dashboard, create alerts for: error rate >5/min,
OpenAI spend >$5/day, failed_jobs ratio >20%. Set up the daily digest cron
on Railway in Phase 10.

## Phase 9 — Legal and compliance
[ ] Update /privacy page with AI disclaimer, subprocessor list, GDPR rights
[ ] Update /terms page with age-16+ requirement, user-content rules, AI accuracy disclaimer
[ ] Add /legal/dpa page listing subprocessors
[ ] Create cookie consent banner (EU-only via Cloudflare CF-IPCountry header)
[ ] Create DELETE /users/me endpoint (Clerk delete + data purge + R2 purge)
[ ] Create GET /users/me/export endpoint (ZIP of user data)
[ ] Link both from /settings/account on frontend
[ ] Commit

Commit SHA:
Manual follow-ups: sign DPAs with OpenAI (platform.openai.com/account/data-controls),
Clerk (automatic for paid tier), Cloudflare (in dashboard under Billing),
Neon (automatic on Launch plan). Download all four DPA PDFs and store in
a `legal/signed-dpas/` folder outside git.

## Phase 10 — Deployment configuration
[ ] Rewrite api/Dockerfile as multi-stage, non-root, slim
[ ] Add HEALTHCHECK to Dockerfile
[ ] Create railway.toml
[ ] Create vercel.json (if needed)
[ ] Create .github/workflows/ci.yml
[ ] Create scripts/backup-db.sh
[ ] Document every env var in DEPLOYMENT.md
[ ] Document release workflow in DEPLOYMENT.md
[ ] Commit

Commit SHA:
Manual follow-ups: deploy API to Railway, deploy frontend to Vercel,
configure custom domains (api.reviewflow.app for API, reviewflow.app for
web), set all environment variables, run alembic upgrade head, verify
Sentry is receiving events from both services.

## Phase 11 — Polar payments (optional, post-launch)
[ ] See Phase 11 prompt when ready to monetize
