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

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
