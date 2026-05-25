#!/bin/bash
# Daily Postgres backup via pg_dump.
# Run via a Railway cron service or any machine with DATABASE_URL and aws CLI.
#
# Required env vars:
#   DATABASE_URL     — Neon postgres connection string
#   R2_ENDPOINT_URL  — e.g. https://<account-id>.r2.cloudflarestorage.com
#   AWS_ACCESS_KEY_ID       — R2 access key
#   AWS_SECRET_ACCESS_KEY   — R2 secret key
#
# The target bucket "coursekin-backups" should have a lifecycle rule:
#   Delete objects older than 30 days.

set -euo pipefail

DATE=$(date -u +%Y%m%d-%H%M%S)
OUT="/tmp/coursekin-${DATE}.sql.gz"

echo "Starting backup ${DATE}..."
pg_dump "$DATABASE_URL" | gzip > "$OUT"

echo "Uploading to R2..."
aws s3 cp "$OUT" "s3://coursekin-backups/${DATE}.sql.gz" \
  --endpoint-url "$R2_ENDPOINT_URL"

rm "$OUT"
echo "Backup complete: ${DATE}.sql.gz"
