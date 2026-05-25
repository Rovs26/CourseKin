"""Run the persistent generation queue worker."""

import argparse
import logging
import time

from app.core.config import settings
from app.services.job_queue_service import process_next_queued_job, recover_stale_jobs

logger = logging.getLogger("reviewflow.worker")


def run(once: bool = False) -> None:
    settings.validate_deployment()
    while True:
        recovered = recover_stale_jobs()
        if recovered:
            logger.info("Recovered %d stale generation jobs", recovered)
        processed = process_next_queued_job()
        if once:
            return
        if not processed:
            time.sleep(settings.JOB_POLL_SECONDS)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true", help="Process at most one queued job")
    args = parser.parse_args()
    run(once=args.once)
