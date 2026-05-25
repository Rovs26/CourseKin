# CourseKin Deployment Runbook

`coursekin.app` addresses and email addresses in this runbook are provisional deployment targets. Acquire and verify the final domain before configuring DNS, legal contact mailboxes, or production traffic.

## Environments
- Production: api.coursekin.app (Railway) + coursekin.app (Vercel)
- Staging: api-staging.coursekin.app (Railway API + worker) + a Vercel preview or staging domain, using separate staging provider data
- Local dev: docker-compose in `docker/docker-compose.yml`

### Staging boundary

Do not connect preview testing to production data or production uploads. Before enabling real user traffic, provision:

- A Railway staging API service and a Railway staging generation worker.
- A Neon staging/dev branch for `DATABASE_URL`.
- A dedicated `coursekin-staging-uploads` R2 bucket with the same temporary-object lifecycle policy as production.
- Clerk development or staging keys and a Turnstile staging widget.
- A staging Redis instance or isolated Redis database for distributed limiter verification.
- Staging Axiom/Sentry labeling or datasets so acceptance-test noise is distinguishable from production.

Use `APP_ENV=staging` on the staging API and worker. Both `staging` and `production` boot modes enforce Postgres, Clerk, R2, Turnstile, and shared rate-limit configuration; a partially configured deployed service should fail fast.

---

## Environment variables

### API (Railway)

Paste the following into Railway → your service → Variables. Every variable must be set before the first deploy.
In `APP_ENV=production`, the API and worker intentionally refuse to boot with SQLite or without authentication, R2, Turnstile, and shared rate-limit configuration.

```
# Core
APP_NAME=CourseKin API
APP_ENV=production                 # use staging for the isolated staging API/worker
DATABASE_URL=postgresql://...         # Neon connection string (pooled)
FRONTEND_URL=https://coursekin.app

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-nano
OPENAI_MAX_OUTPUT_TOKENS=1500
OPENAI_TIMEOUT_SECONDS=60

# Clerk
CLERK_JWKS_URL=https://<your-clerk-instance>.clerk.accounts.dev/.well-known/jwks.json
CLERK_SECRET_KEY=sk_live_...
CLERK_ISSUER=https://<your-clerk-instance>.clerk.accounts.dev

# Cost controls / quotas
FREE_TIER_MONTHLY_USD=0.25
PAID_TIER_MONTHLY_USD=5.00
MAX_EXTRACTED_CHARS=50000

# Durable generation jobs and distributed rate limiting
RATE_LIMIT_STORAGE_URI=redis://<railway-redis-host>:6379/0
JOB_POLL_SECONDS=1
JOB_STALE_SECONDS=300
JOB_MAX_ATTEMPTS=3

# Cloudflare Turnstile
TURNSTILE_SECRET_KEY=...

# Admin
ADMIN_EMAILS=your@email.com

# Observability
SENTRY_DSN_API=https://...@sentry.io/...
AXIOM_TOKEN=xaat-...
AXIOM_DATASET=coursekin-prod
RESEND_API_KEY=re_...

# Polar payments (enable only after live acceptance tests)
BILLING_ENABLED=false
POLAR_ACCESS_TOKEN=pat_...          # Polar dashboard → Settings → Developers → Personal Access Token
POLAR_WEBHOOK_SECRET=whsec_...      # Polar dashboard → Webhooks → endpoint → Signing Secret
POLAR_PLUS_MONTHLY_PRODUCT_ID=     # Product ID from the Plus Monthly product
POLAR_PLUS_YEARLY_PRODUCT_ID=      # Product ID from the Plus Yearly product

# Cloudflare R2 (uploads bucket)
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=coursekin-uploads
R2_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
R2_PRESIGN_EXPIRY_SECONDS=300
```

`RATE_LIMIT_STORAGE_URI` backs request throttling shared across API replicas. Request throttling is keyed by client IP because it runs before JWT verification; generation limits and cost quotas are additionally enforced by verified Clerk user ID after authentication.

### Generation worker service (Railway — separate service, same project)

Create a second service from the same repository with root directory `api/` and configuration file path `api/railway.worker.toml`. Reference the API variables above, including `DATABASE_URL` and `RATE_LIMIT_STORAGE_URI`. Its start command is:

```bash
python -m scripts.job_worker
```

The API only enqueues generation work. At least one running worker is required for queued jobs to complete.

### Daily digest cron service (Railway — separate service, same project)

Reference all variables from the main API service using Railway's "reference variable" feature, plus:

```
# No extra vars needed — the cron script reads DATABASE_URL, RESEND_API_KEY,
# ADMIN_EMAILS, and AXIOM_TOKEN from shared env.
# Set the Railway service start command to:
#   python -m scripts.daily_digest
# Set the cron schedule to:
#   0 9 * * *   (09:00 UTC = 17:00 Manila)
```

### Backup cron service (Railway — separate service, same project)

```
# References DATABASE_URL from main service.
# Also needs R2 credentials for the backups bucket:
R2_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
AWS_ACCESS_KEY_ID=...         # R2 key scoped to coursekin-backups bucket only
AWS_SECRET_ACCESS_KEY=...
# Start command:
#   bash scripts/backup-db.sh
# Cron schedule:
#   0 2 * * *   (02:00 UTC daily)
```

### Frontend (Vercel)

Use Node.js 20.19 or newer. Paste the following into Vercel → your project → Settings → Environment Variables. Set for Production (and optionally Preview).

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_COURSEKIN_API_URL=https://api.coursekin.app
NEXT_PUBLIC_BILLING_ENABLED=false
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_TURNSTILE_SITE_KEY=...

# Sentry (optional — skip until Sentry is wired up in Phase 8)
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_AUTH_TOKEN=sntrys_...
SENTRY_ORG=your-sentry-org
```

Switch both `BILLING_ENABLED` and `NEXT_PUBLIC_BILLING_ENABLED` to `true` only after the Polar acceptance tests in the launch checklist pass.

---

## Database migrations

We use Alembic for all schema changes. SQLite is used locally; Neon Postgres is used in production.

### To create a new migration
1. Edit models in `api/app/db/models.py`
2. `cd api && alembic revision --autogenerate -m "description of change"`
3. Review the generated file in `api/alembic/versions/` — autogenerate is not perfect, always read it
4. Test locally: `alembic upgrade head`
5. Commit the migration file alongside the model change

### To deploy a migration to production
Set the API service root directory to `api/`; its Docker image runs migrations before starting the HTTP server:
```
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```
If the migration fails, Railway will not start the new container and the previous version continues serving traffic — zero downtime for failed migrations.

### To roll back
```bash
# SSH into Railway via railway run, or use a one-off job:
alembic downgrade -1
```

### Neon branches for staging
- **Production DB**: Neon `main` branch
- **Staging DB**: Neon `dev` branch (kept in sync with `main` schema)

The staging API and any frontend preview configured for acceptance testing use the `dev` branch. To test a destructive migration safely:
1. Create a new Neon branch from `main`
2. Point `DATABASE_URL` at the new branch
3. Run `alembic upgrade head` and verify
4. If good, apply to `main` by running the migration in the Railway deploy

---

## Release workflow

1. **Feature branch** — work on `feat/...` or `fix/...` branched off `master`.
2. **Open PR to `master`** — GitHub Actions runs CI (API tests/migrations plus frontend lint/build).
3. **Preview deploy** — Vercel automatically deploys a preview for the PR, pointing at the Neon `dev` branch.
4. **Review** — test the preview URL, smoke-test the happy path.
5. **Merge to `master`** — Vercel auto-deploys frontend to production. Railway auto-deploys API to production.
6. **Migrations** — Railway's CMD runs `alembic upgrade head` before starting uvicorn. If a migration fails, the deploy fails and Railway keeps the previous version serving traffic.

---

## Staging smoke checks

The API exposes separate probes:

- `/health` is a lightweight liveness endpoint used by Railway.
- `/ready` additionally confirms database connectivity and is required before acceptance testing.

After deploying the isolated staging API, worker, and frontend, run:

```bash
cd api
python -m scripts.staging_smoke \
  --api-url https://api-staging.coursekin.app \
  --frontend-url https://<staging-frontend-domain> \
  --expected-env staging
```

For the authenticated read check, create or sign into a staging-only test account, obtain a short-lived Clerk token, and pass it through an environment variable rather than a shell argument:

```bash
COURSEKIN_SMOKE_BEARER_TOKEN="<short-lived-staging-token>" \
python -m scripts.staging_smoke \
  --api-url https://api-staging.coursekin.app \
  --frontend-url https://<staging-frontend-domain> \
  --expected-env staging
```

This smoke script does not create, edit, upload, generate, or delete data. Complete the authenticated upload/generation/deletion workflow manually during provider acceptance testing.

---

## Backup and restore

### Daily backup
`scripts/backup-db.sh` runs as a Railway cron service (02:00 UTC daily).
It does `pg_dump | gzip` and uploads to the `coursekin-backups` R2 bucket.
Lifecycle rule: delete objects older than 30 days (set in Cloudflare R2 bucket settings).

### To restore from backup
```bash
# 1. Download the backup
aws s3 cp s3://coursekin-backups/20260425-020000.sql.gz /tmp/restore.sql.gz \
  --endpoint-url "$R2_ENDPOINT_URL"

# 2. Decompress
gunzip /tmp/restore.sql.gz

# 3. Restore (this DROPS the existing DB — do this on a Neon branch first)
psql "$DATABASE_URL" < /tmp/restore.sql
```

Always restore to a Neon branch, verify data, then promote if correct.

### Secret rotation procedures

| Secret | How to rotate |
|--------|--------------|
| `OPENAI_API_KEY` | Create new key in OpenAI dashboard → update Railway var → delete old key |
| `CLERK_SECRET_KEY` | Clerk dashboard → API Keys → rotate → update Railway var |
| `CLERK_JWKS_URL` | Changes only if Clerk instance domain changes — update both Railway and Vercel |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Cloudflare → R2 → Manage R2 API Tokens → create new → update Railway var → delete old |
| `TURNSTILE_SECRET_KEY` | Cloudflare → Turnstile → Widget → Rotate Secret Key → update Railway var |
| `SENTRY_DSN_API` | Sentry → Settings → Client Keys → Revoke + Add → update Railway var |
| `AXIOM_TOKEN` | Axiom → Settings → API Tokens → delete + create → update Railway var |
| `RESEND_API_KEY` | Resend → API Keys → create new → update Railway var → delete old |
| `SENTRY_AUTH_TOKEN` | Sentry → Settings → Auth Tokens → create new → update Vercel var → delete old |
| `POLAR_ACCESS_TOKEN` | Polar → Settings → Developers → rotate → update Railway var → revoke old |

---

## Incident response

### OpenAI spend alert fires
1. Log into OpenAI dashboard, check current balance.
2. If balance is unexpectedly low, rotate the API key immediately.
3. Check /admin/abuse for suspicious user activity.
4. Check Axiom for unusual /jobs/generate request patterns.

### Queued jobs stop completing
1. Check the worker service is healthy and using the same `DATABASE_URL` as the API.
2. Inspect worker logs for retry-limit failures or OpenAI/provider errors.
3. Verify `RATE_LIMIT_STORAGE_URI` points to shared Redis for every API replica.

### API is down
1. Check Railway deployment logs.
2. Check Neon dashboard for database connectivity.
3. Check Sentry for recent error spike.
4. If deployment is broken, `git revert` the latest commit and push.

### Database is unreachable
1. Check Neon dashboard status page.
2. Check `DATABASE_URL` is correct in Railway vars (no extra whitespace).
3. Check Neon connection limit — the app uses connection pooling via SQLAlchemy but Neon free tier has a low limit.
4. If Neon is degraded, revert to the last backup on a new Neon branch and point `DATABASE_URL` at it.

---

## Axiom alert rules

Configure these in Axiom → Monitors after first logs arrive in production.

### 1. Error rate >5/min
**Query (APL):**
```
['coursekin-prod']
| where level == "ERROR"
| summarize count() by bin(_time, 1m)
| where count_ > 5
```
**Threshold:** count > 5 over a 1-minute window
**Action:** email admin

### 2. Failed jobs ratio >20% over 1 hour
**Query (APL):**
```
['coursekin-prod']
| where logger contains "generation_service" and message contains "failed"
| summarize count() by bin(_time, 1h)
```
**Threshold:** count > 20% of total generation attempts over 1 hour
**Action:** email admin

### 3. OpenAI spend spike
Rely on the daily digest email for now (MVP). Revisit if spend exceeds $1/day.

---

## Monitoring dashboards
- Sentry API: (add project URL after Phase 8 deploy)
- Sentry Web: (add project URL after Phase 8 deploy)
- Axiom logs: (add dataset URL after Phase 8 deploy)
- Railway project: (URL)
- Neon project: (URL)
