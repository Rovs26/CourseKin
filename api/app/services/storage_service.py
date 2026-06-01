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
from botocore.exceptions import ClientError
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

def generate_presigned_put(user_id: str, filename: str, content_type: str, size_bytes: int) -> dict:
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

    if size_bytes <= 0 or size_bytes > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="PDF is too large (max 25 MB)")

    # Objects remain temporary until server-side validation completes.
    # A lifecycle policy can safely remove abandoned temp/ uploads.
    key = f"temp/{user_id}/{uuid4()}/{safe_name}"

    try:
        upload_url = client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": settings.R2_BUCKET_NAME,
                "Key": key,
                "ContentType": content_type,
                "ContentLength": size_bytes,
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


def generate_presigned_put_audio(
    user_id: str,
    filename: str,
    content_type: str,
    size_bytes: int,
    *,
    max_bytes: int,
) -> dict:
    """Audio E1 variant of `generate_presigned_put`.

    Audio uploads have a larger size budget than PDFs and live under a
    separate key prefix so the R2 lifecycle policy can sweep them on its own
    cadence (raw audio is short-lived per the design doc).
    """
    client = _get_client()
    safe_name = "".join(
        c if c.isalnum() or c in "._- " else "_" for c in filename
    ).strip().replace(" ", "_")
    if not safe_name:
        safe_name = "lecture.m4a"
    if size_bytes <= 0 or size_bytes > max_bytes:
        raise HTTPException(status_code=413, detail="Audio file is too large")
    key = f"audio-temp/{user_id}/{uuid4()}/{safe_name}"
    try:
        upload_url = client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": settings.R2_BUCKET_NAME,
                "Key": key,
                "ContentType": content_type,
                "ContentLength": size_bytes,
            },
            ExpiresIn=settings.R2_PRESIGN_EXPIRY_SECONDS,
        )
    except Exception as exc:
        logger.error("Failed to generate presigned PUT URL for audio: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to generate upload URL")
    return {
        "upload_url": upload_url,
        "key": key,
        "expires_in": settings.R2_PRESIGN_EXPIRY_SECONDS,
    }


def download_audio_to_bytes(key: str, max_bytes: int) -> bytes:
    """Audio variant of `download_to_bytes` with caller-supplied size budget."""
    client = _get_client()
    try:
        size = get_object_size(key)
        if size > max_bytes:
            raise HTTPException(status_code=413, detail="Audio file is too large")
        response = client.get_object(Bucket=settings.R2_BUCKET_NAME, Key=key)
        body = response["Body"].read(max_bytes + 1)
        if len(body) > max_bytes:
            raise HTTPException(status_code=413, detail="Audio file is too large")
        return body
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to download audio object %s from R2: %s", key, exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve audio file")


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


def get_object_size(key: str) -> int:
    """Return object size without downloading its body."""
    client = _get_client()
    try:
        response = client.head_object(Bucket=settings.R2_BUCKET_NAME, Key=key)
        return int(response.get("ContentLength", 0))
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") in ("404", "NoSuchKey"):
            raise HTTPException(status_code=404, detail="Uploaded file not found in storage")
        logger.error("Failed to inspect object %s in R2: %s", key, exc)
        raise HTTPException(status_code=500, detail="Failed to inspect uploaded file")


def download_to_bytes(key: str, max_bytes: int = MAX_UPLOAD_BYTES) -> bytes:
    """Download an R2 object and return its raw bytes.

    Used by the finalize endpoint to fetch the PDF for server-side text extraction.
    Raises HTTPException(404) if the object doesn't exist.
    """
    client = _get_client()
    try:
        size = get_object_size(key)
        if size > max_bytes:
            raise HTTPException(status_code=400, detail="PDF is too large (max 25 MB)")
        response = client.get_object(Bucket=settings.R2_BUCKET_NAME, Key=key)
        body = response["Body"].read(max_bytes + 1)
        if len(body) > max_bytes:
            raise HTTPException(status_code=400, detail="PDF is too large (max 25 MB)")
        return body
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to download object %s from R2: %s", key, exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve uploaded file")


def promote_temp_object(temp_key: str, user_id: str) -> str:
    """Copy a validated temp upload to its retained key and remove the temp object."""
    client = _get_client()
    if not temp_key.startswith(f"temp/{user_id}/"):
        raise HTTPException(status_code=403, detail="Access denied")
    final_key = temp_key.replace("temp/", "uploads/", 1)
    try:
        client.copy_object(
            Bucket=settings.R2_BUCKET_NAME,
            CopySource={"Bucket": settings.R2_BUCKET_NAME, "Key": temp_key},
            Key=final_key,
        )
        client.delete_object(Bucket=settings.R2_BUCKET_NAME, Key=temp_key)
        return final_key
    except Exception as exc:
        logger.error("Failed to promote R2 object %s: %s", temp_key, exc)
        raise HTTPException(status_code=500, detail="Failed to finalize uploaded file")


def delete_object(key: str, *, strict: bool = False) -> None:
    """Delete an object from R2. Silently no-ops if the object doesn't exist."""
    if not settings.r2_configured:
        return  # No-op in local dev where R2 is not configured
    client = _get_client()
    try:
        client.delete_object(Bucket=settings.R2_BUCKET_NAME, Key=key)
        logger.info("Deleted R2 object: %s", key)
    except Exception as exc:
        logger.warning("Failed to delete R2 object %s: %s", key, exc)
        if strict:
            raise HTTPException(status_code=503, detail="Unable to delete stored file; please retry")
