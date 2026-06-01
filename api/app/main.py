import logging
import time

import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.logging_config import setup_logging
from app.core.rate_limit import limiter
from app.api.routes import health, projects, sources, jobs, reviewer, planning, stream, notebook, templates, admin, users, billing, audio, exams, calendar_export, planner
from app.db.database import Base, engine
from app.db import models  # noqa: F401 — imported so SQLAlchemy registers all tables

# ── Logging ──────────────────────────────────────────────────────────
setup_logging()
logger = logging.getLogger("reviewflow")
settings.validate_deployment()

# ── Sentry ───────────────────────────────────────────────────────────
if settings.SENTRY_DSN_API and settings.requires_deployment_safeguards:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN_API,
        integrations=[StarletteIntegration(), FastApiIntegration()],
        traces_sample_rate=0.1,
        profiles_sample_rate=0.0,
        environment=settings.APP_ENV,
        send_default_pii=False,
    )

# ── App ──────────────────────────────────────────────────────────────
app = FastAPI(title=settings.APP_NAME)

# Rate limiter
app.state.limiter = limiter


async def friendly_rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={
            "error": "rate_limit_exceeded",
            "detail": "You're going a bit fast. Please wait a moment and try again.",
            "retry_after_seconds": 60,
        },
        headers={"Retry-After": "60"},
    )


app.add_exception_handler(RateLimitExceeded, friendly_rate_limit_handler)

# ── DB bootstrap ──────────────────────────────────────────────────────
# In production (Postgres) Alembic manages all schema changes — never auto-create.
# In local SQLite dev, create_all is a convenience so you can run without Alembic.
if not settings.is_postgres:
    Base.metadata.create_all(bind=engine)

logger.info("Database tables ready")

# ── CORS ─────────────────────────────────────────────────────────────
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

# In production, allow the configured frontend origin
if settings.FRONTEND_URL:
    allowed_origins.append(settings.FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# ── Request logging middleware ───────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000

    # Skip noisy health-check polls
    if request.url.path not in ("/", "/health"):
        logger.info(
            "%s %s → %d (%.0fms)",
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
        )

    return response

# ── Routes ───────────────────────────────────────────────────────────
app.include_router(health.router)
app.include_router(projects.router)
app.include_router(sources.router)
app.include_router(jobs.router)
app.include_router(reviewer.router)
app.include_router(planning.router)
app.include_router(stream.router)
app.include_router(notebook.router)
app.include_router(templates.router)
app.include_router(admin.router)
app.include_router(users.router)
app.include_router(billing.router)
app.include_router(audio.router)
app.include_router(exams.router)
app.include_router(calendar_export.router)
app.include_router(planner.router)

logger.info("CourseKin API started (env=%s)", settings.APP_ENV)
