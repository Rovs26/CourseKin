# ReviewFlow Deployment Runbook

## Environments
- Production: api.reviewflow.app (Railway) + reviewflow.app (Vercel)
- Staging: (using Vercel preview deployments against Neon branches — no dedicated staging env)
- Local dev: docker-compose in docker/docker-compose.yml

## Environment variables
### API (Railway)
(to be filled in Phase 10)

### Frontend (Vercel)
(to be filled in Phase 10)

## Database migrations

We use Alembic for all schema changes. SQLite is used locally; Neon Postgres is used in production.

### To create a new migration
1. Edit models in `api/app/db/models.py`
2. `cd api && alembic revision --autogenerate -m "description of change"`
3. Review the generated file in `api/alembic/versions/` — autogenerate is not perfect, always read it
4. Test locally: `alembic upgrade head`
5. Commit the migration file alongside the model change

### To deploy a migration to production
Migrations run automatically on Railway via the start command:
```
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### To roll back
```
alembic downgrade -1
```

### Neon branches for staging
- **Production DB**: Neon `main` branch
- **Staging DB**: Neon `dev` branch (kept in sync with `main` schema)

Preview deploys use the `dev` branch. To test a destructive migration safely:
1. Create a new Neon branch from `main`
2. Point `DATABASE_URL` at the new branch
3. Run `alembic upgrade head` and verify
4. If good, apply to `main` by running the migration in the Railway deploy

## Release workflow
(to be filled in Phase 10)

## Backup and restore
(to be filled in Phase 10)

## Incident response

### OpenAI spend alert fires
1. Log into OpenAI dashboard, check current balance.
2. If balance is unexpectedly low, rotate the API key immediately.
3. Check /admin/abuse for suspicious user activity.
4. Check Axiom for unusual /jobs/generate request patterns.

### API is down
1. Check Railway deployment logs.
2. Check Neon dashboard for database connectivity.
3. Check Sentry for recent error spike.
4. If deployment is broken, `git revert` the latest commit and push.

## Monitoring dashboards
- Sentry API: (URL to be added in Phase 8)
- Sentry Web: (URL)
- Axiom logs: (URL)
- Railway project: (URL)
- Neon project: (URL)
