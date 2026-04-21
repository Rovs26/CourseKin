"""Cloudflare R2 object storage via S3-compatible API.

We use presigned URLs so that large PDF uploads go browser→R2 directly,
bypassing our FastAPI container. This avoids DOS risk, filesystem
dependencies, and egress costs.

All public API functions raise HTTPException on misconfiguration so that
callers get a clean 500 with a logged message rather than a boto3 traceback.
"""

import logging
from functools import lru_cache
from uuid import uuid4

from botocore.config import Config
from fastapi import HTTPException

from app.core.config import settings

logger = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB hard cap


# ── Client ────────────────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def _get_client():
    """Return a cached boto3 S3 client configured for Cloudflare R2.

    lru_cache means the client is created once per process and reused.
    This is safe because boto3 clients are thread-safe for reads.
    """
    if not settings.r2_configured:
        raise HTTPException(
            status_code=500,
            detail="Server misconfiguration: R2 storage is not configured",
        )

    import boto3  # deferred so missing dep doesn't break startup if R2 unused

    return boto3.client(
        "s3",
        endpoint_url=settings.R2_ENDPOINT_URL,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )


# ── Public API ────────────────────────────────────────────────────────────────

def generate_presigned_put(user_id: str, filename: str, content_type: str) -> dict:
    """Generate a presigned PUT URL for direct browser→R2 upload.

    Returns {"upload_url": str, "key": str, "expires_in": int}.

    The key is scoped under the user's ID so cross-user key injection is
    detectable by the finalize endpoint.
    """
    client = _get_client()

    # Sanitise filename: strip path separators, collapse to alphanumeric + safe chars
    safe_name = "".join(
        c if c.isalnum() or c in "._- " else "_" for c in filename
    ).strip().replace(" ", "_")
    if not safe_name:
        safe_name = "upload.pdf"

    key = f"uploads/{user_id}/{uuid4()}/{safe_name}"

    try:
        upload_url = client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": settings.R2_BUCKET_NAME,
                "Key": key,
                "ContentType": content_type,
            },
            ExpiresIn=settings.R2_PRESIGN_EXPIRY_SECONDS,
        )
    except Exception as exc:
        logger.error("Failed to generate presigned PUT URL: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to generate upload URL")

    return {
        "upload_url": upload_url,
        "key": key,
        "expires_in": settings.R2_PRESIGN_EXPIRY_SECONDS,
    }


def generate_presigned_get(key: str, expires_in: int = 3600) -> str:
    """Generate a presigned GET URL for temporary download access."""
    client = _get_client()
    try:
        return client.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.R2_BUCKET_NAME, "Key": key},
            ExpiresIn=expires_in,
        )
    except Exception as exc:
        logger.error("Failed to generate presigned GET URL for key %s: %s", key, exc)
        raise HTTPException(status_code=500, detail="Failed to generate download URL")


def download_to_bytes(key: str) -> bytes:
    """Download an R2 object and return its raw bytes.

    Used by the finalize endpoint to fetch the PDF for server-side text extraction.
    Raises HTTPException(404) if the object doesn't exist.
    """
    client = _get_client()
    try:
        response = client.get_object(Bucket=settings.R2_BUCKET_NAME, Key=key)
        return response["Body"].read()
    except client.exceptions.NoSuchKey:
        raise HTTPException(status_code=404, detail="Uploaded file not found in storage")
    except Exception as exc:
        logger.error("Failed to download object %s from R2: %s", key, exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve uploaded file")


def delete_object(key: str) -> None:
    """Delete an object from R2. Silently no-ops if the object doesn't exist."""
    if not settings.r2_configured:
        return  # No-op in local dev where R2 is not configured
    client = _get_client()
    try:
        client.delete_object(Bucket=settings.R2_BUCKET_NAME, Key=key)
        logger.info("Deleted R2 object: %s", key)
    except Exception as exc:
        # Log but don't raise — a failed delete shouldn't crash the caller
        logger.warning("Failed to delete R2 object %s: %s", key, exc)
