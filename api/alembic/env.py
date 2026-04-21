from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

# ── App imports ───────────────────────────────────────────────────────────────
# Import settings so we can read DATABASE_URL at migration time.
from app.core.config import settings

# Import Base AND all models so SQLAlchemy's metadata is fully populated.
# Alembic's autogenerate compares Base.metadata against the live DB schema —
# if a model isn't imported here, autogenerate won't know it exists.
from app.db.database import Base
import app.db.models  # noqa: F401

# ── Alembic config ────────────────────────────────────────────────────────────
config = context.config

# Inject the runtime DATABASE_URL — never hardcoded in alembic.ini.
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Set up Python logging from the alembic.ini [loggers] section.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


# ── Migration runners ─────────────────────────────────────────────────────────

def run_migrations_offline() -> None:
    """Emit SQL to stdout without a live connection (useful for review/dry-run)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations against a live database connection."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,  # NullPool is correct for migration runs
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
