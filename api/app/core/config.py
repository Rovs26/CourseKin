from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "ReviewFlow API"
    APP_ENV: str = "development"
    DATABASE_URL: str = "sqlite:///./data/reviewflow.db"
    FRONTEND_URL: str = ""  # e.g. "https://reviewflow.app" — added to CORS in production

    # ── OpenAI ────────────────────────────────────────────────────────────────
    OPENAI_API_KEY: str = ""
    # gpt-4.1-nano: $0.10/$0.40 per M tokens, 1M context, best for structured extraction
    OPENAI_MODEL: str = "gpt-4.1-nano"
    # Hard cap on output tokens per call — prevents runaway spend on long responses
    OPENAI_MAX_OUTPUT_TOKENS: int = 1500
    # HTTP timeout for the OpenAI call in seconds — prevents hung background tasks
    OPENAI_TIMEOUT_SECONDS: int = 60

    # ── Clerk auth ────────────────────────────────────────────────────────────
    # JWKS URL from Clerk dashboard → API Keys → Advanced → JWKS URL
    CLERK_JWKS_URL: str = ""
    # Secret key from Clerk dashboard → API Keys (used for server-side SDK calls)
    CLERK_SECRET_KEY: str = ""
    # JWT issuer — Clerk instance URL, e.g. "https://clerk.reviewflow.app"
    # Leave empty in development if not enforcing issuer
    CLERK_ISSUER: str = ""

    # ── Cost controls / quotas ────────────────────────────────────────────────
    # Max USD spend per user per calendar month on the free tier
    FREE_TIER_MONTHLY_USD: float = 0.25
    # Max USD spend per user per calendar month on a paid tier (Phase 11)
    PAID_TIER_MONTHLY_USD: float = 5.00
    # Hard character cap on extracted source text sent to OpenAI — ~12.5k tokens
    MAX_EXTRACTED_CHARS: int = 50_000

    # ── Local storage (legacy / dev-only) ────────────────────────────────────
    # Used only when R2 is not configured. In Docker this is /app/uploads.
    # In local dev it falls back to ./uploads. Superseded by R2 in production.
    UPLOAD_DIR: str = "./uploads"

    # ── Turnstile ─────────────────────────────────────────────────────────────
    # From Cloudflare dashboard → Turnstile → Add Widget
    TURNSTILE_SECRET_KEY: str = ""
    TURNSTILE_VERIFY_URL: str = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

    # ── Admin ─────────────────────────────────────────────────────────────────
    # Comma-separated list of Clerk user emails that can access /admin/* endpoints
    ADMIN_EMAILS: str = ""

    # ── Runtime safeguards ─────────────────────────────────────────────────────
    # Configure a shared Redis-compatible backend in production so limits apply
    # across API replicas. Leave empty for single-process local development.
    RATE_LIMIT_STORAGE_URI: str = ""
    # DB-backed generation worker settings.
    JOB_POLL_SECONDS: float = 1.0
    JOB_STALE_SECONDS: int = 300
    JOB_MAX_ATTEMPTS: int = 3

    # ── Observability ─────────────────────────────────────────────────────────
    # From Sentry dashboard → Settings → Projects → <project> → Client Keys (DSN)
    SENTRY_DSN_API: str = ""
    # From Axiom dashboard → Settings → API Tokens
    AXIOM_TOKEN: str = ""
    AXIOM_DATASET: str = "reviewflow-prod"
    # From Resend dashboard → API Keys (used by daily_digest.py)
    RESEND_API_KEY: str = ""

    # ── Polar payments ────────────────────────────────────────────────────────
    # From Polar dashboard → Settings → Developers → Personal Access Token
    POLAR_ACCESS_TOKEN: str = ""
    # From Polar dashboard → Settings → Webhooks → endpoint → Signing Secret
    # Format: whsec_<base64>
    POLAR_WEBHOOK_SECRET: str = ""
    # Keep disabled until live checkout/webhook/cancellation verification passes.
    BILLING_ENABLED: bool = False
    # From Polar dashboard → Products → Plus Monthly → product ID
    POLAR_PLUS_MONTHLY_PRODUCT_ID: str = ""
    # From Polar dashboard → Products → Plus Yearly → product ID
    POLAR_PLUS_YEARLY_PRODUCT_ID: str = ""

    # ── Cloudflare R2 ─────────────────────────────────────────────────────────
    # From Cloudflare dashboard → R2 → Manage R2 API Tokens
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = "reviewflow-uploads"
    # e.g. https://<account-id>.r2.cloudflarestorage.com
    R2_ENDPOINT_URL: str = ""
    # Presigned PUT URL lifetime — 5 minutes is enough to complete any upload
    R2_PRESIGN_EXPIRY_SECONDS: int = 300

    @property
    def r2_configured(self) -> bool:
        return bool(self.R2_ENDPOINT_URL and self.R2_ACCESS_KEY_ID and self.R2_SECRET_ACCESS_KEY)

    @property
    def is_postgres(self) -> bool:
        return self.DATABASE_URL.startswith("postgresql://") or self.DATABASE_URL.startswith("postgres://")

    def validate_production(self) -> None:
        """Fail startup rather than serving a production instance without safeguards."""
        if self.APP_ENV != "production":
            return
        required = {
            "PostgreSQL DATABASE_URL": self.is_postgres,
            "FRONTEND_URL": bool(self.FRONTEND_URL),
            "OPENAI_API_KEY": bool(self.OPENAI_API_KEY),
            "CLERK_JWKS_URL": bool(self.CLERK_JWKS_URL),
            "CLERK_SECRET_KEY": bool(self.CLERK_SECRET_KEY),
            "TURNSTILE_SECRET_KEY": bool(self.TURNSTILE_SECRET_KEY),
            "RATE_LIMIT_STORAGE_URI": bool(self.RATE_LIMIT_STORAGE_URI),
            "R2_ENDPOINT_URL/R2 credentials": self.r2_configured,
        }
        if self.BILLING_ENABLED:
            required.update(
                {
                    "POLAR_ACCESS_TOKEN": bool(self.POLAR_ACCESS_TOKEN),
                    "POLAR_WEBHOOK_SECRET": bool(self.POLAR_WEBHOOK_SECRET),
                    "POLAR_PLUS_MONTHLY_PRODUCT_ID": bool(self.POLAR_PLUS_MONTHLY_PRODUCT_ID),
                    "POLAR_PLUS_YEARLY_PRODUCT_ID": bool(self.POLAR_PLUS_YEARLY_PRODUCT_ID),
                }
            )
        missing = [name for name, configured in required.items() if not configured]
        if missing:
            raise RuntimeError(f"Production configuration is incomplete: {', '.join(missing)}")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
