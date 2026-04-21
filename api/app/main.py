import logging
import time
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import inspect, text

from app.core.config import settings
from app.core.logging_config import setup_logging
from app.core.rate_limit import limiter
from app.api.routes import health, projects, sources, jobs, reviewer, templates
from app.db.database import Base, engine
from app.db import models  # noqa: F401

# ── Logging ──────────────────────────────────────────────────────────
setup_logging()
logger = logging.getLogger("reviewflow")

# ── App ──────────────────────────────────────────────────────────────
app = FastAPI(title=settings.APP_NAME)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── DB bootstrap ─────────────────────────────────────────────────────
Path("./data").mkdir(parents=True, exist_ok=True)
Base.metadata.create_all(bind=engine)

# Add new columns to existing tables (safe for SQLite — no-ops if column exists)
with engine.connect() as conn:
    inspector = inspect(engine)
    project_cols = {c["name"] for c in inspector.get_columns("projects")}
    if "template_id" not in project_cols:
        conn.execute(text("ALTER TABLE projects ADD COLUMN template_id VARCHAR"))
        conn.commit()
    if "user_id" not in project_cols:
        conn.execute(text("ALTER TABLE projects ADD COLUMN user_id VARCHAR"))
        conn.commit()

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
app.include_router(templates.router)

logger.info("ReviewFlow API started (env=%s)", settings.APP_ENV)