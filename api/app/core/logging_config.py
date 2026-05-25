"""Structured logging configuration.

In development: human-readable colored logs.
In production:  JSON-formatted logs for log aggregators.
"""

import json
import logging
import logging.handlers
import queue
import sys
from datetime import datetime, timezone

import httpx

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


class AxiomHandler(logging.Handler):
    """Ships JSON log records to Axiom via HTTP. Blocking — wrap in QueueHandler."""

    def __init__(self, token: str, dataset: str) -> None:
        super().__init__()
        self.url = f"https://api.axiom.co/v1/datasets/{dataset}/ingest"
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        self._client = httpx.Client(timeout=5)

    def emit(self, record: logging.LogRecord) -> None:
        try:
            payload = [{
                "_time": int(record.created * 1000),  # ms epoch
                "level": record.levelname,
                "logger": record.name,
                "message": record.getMessage(),
                "module": record.module,
            }]
            self._client.post(self.url, headers=self.headers, json=payload)
        except Exception:
            pass  # never let logging errors crash the app


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

    # Ship logs to Axiom in production via a non-blocking background queue
    if is_prod and settings.AXIOM_TOKEN:
        axiom_handler = AxiomHandler(settings.AXIOM_TOKEN, settings.AXIOM_DATASET)
        axiom_handler.setLevel(logging.INFO)
        log_queue: queue.Queue = queue.Queue(maxsize=1000)
        queue_handler = logging.handlers.QueueHandler(log_queue)
        listener = logging.handlers.QueueListener(
            log_queue, axiom_handler, respect_handler_level=True
        )
        listener.start()
        root.addHandler(queue_handler)

    # Quieten noisy libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(
        logging.WARNING if is_prod else logging.INFO
    )
