from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

connect_args: dict = {}
engine_kwargs: dict = {}

if settings.is_postgres:
    # Neon serverless-friendly settings.
    # pool_pre_ping reconnects transparently after idle connection drops.
    # pool_recycle evicts connections older than 5 min to stay ahead of Neon's
    # idle-connection timeout.
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_size"] = 5
    engine_kwargs["max_overflow"] = 5
    engine_kwargs["pool_recycle"] = 300
else:
    # SQLite needs check_same_thread=False to be usable from multiple threads
    # (FastAPI runs handlers in a thread pool).
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    **engine_kwargs,
)

# Enable WAL mode for SQLite — much better concurrency under FastAPI's thread pool.
if not settings.is_postgres:
    @event.listens_for(engine, "connect")
    def _set_sqlite_wal(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
