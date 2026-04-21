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
(to be filled in Phase 4)

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
