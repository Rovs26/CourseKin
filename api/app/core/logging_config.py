"""Structured logging configuration.

In development: human-readable colored logs.
In production:  JSON-formatted logs for log aggregators.
"""

import logging
import json
import sys
from datetime import datetime, timezone

from app.core.config import settings


class JSONFormatter(logging.Formatter):
    """Emit one JSON object per log line — easy to parse in Railway/Render."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info and record.exc_info[0] is not None:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry)


def setup_logging() -> None:
    """Call once at app startup to configure root logger."""
    is_prod = settings.APP_ENV == "production"
    level = logging.INFO if is_prod else logging.DEBUG

    root = logging.getLogger()
    root.setLevel(level)

    # Clear any existing handlers (uvicorn adds its own)
    root.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)

    if is_prod:
        handler.setFormatter(JSONFormatter())
    else:
        handler.setFormatter(
            logging.Formatter(
                "%(asctime)s  %(levelname)-8s  %(name)-30s  %(message)s",
                datefmt="%H:%M:%S",
            )
        )

    root.addHandler(handler)

    # Quieten noisy libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(
        logging.WARNING if is_prod else logging.INFO
    )
