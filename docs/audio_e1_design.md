# Audio E1 — Lecture Capture & Transcription (Design Doc)

Status: **Draft — pre-implementation**
Owner: founder
Target tier: E1 (early experimental, behind a feature flag)
Last updated: 2026-05-27

---

## 1. Goal

Let a student record (or upload) a single class session, get a clean transcript
+ short notes-style summary into the course **Room/Stream**, and seed a few
**Notebook cards** for spaced repetition. Output integrates with everything
already built (stream entries, notebook, coverage) rather than living in a
parallel feature.

**Non-goals for E1:**
- Real-time transcription during class (offline upload only).
- Speaker diarization.
- Multi-session merging or topic stitching across lectures.
- Translating non-English audio (English/Filipino only at launch).

---

## 2. User flow

1. Student opens a course → Stream tab → "Add audio."
2. Two ways in: (a) upload `.m4a / .mp3 / .wav / .webm` file, (b) record in
   browser via `MediaRecorder` (saved as `audio/webm; opus`).
3. UI shows a consent dialog **before** the upload starts (see §3).
4. File is uploaded directly to R2 via presigned PUT.
5. A `Job(job_type="transcribe-audio")` is queued. Worker:
   - Downloads from R2 to a temp file.
   - Calls Whisper-1 (OpenAI) for transcript.
   - Calls gpt-4o-mini for a short notes-style summary + 3–5 candidate
     notebook cards (confirmation-first — student approves before persisting).
6. On completion: a stream entry of type `audio_transcript` is created with
   transcript + summary; proposed cards land in a "review proposals" tray.
7. The raw audio file is deleted from R2 at the end of the job (see §5
   "retention"). The transcript and summary persist.

---

## 3. Consent

Recording another human's voice without consent is a legal and ethical
landmine, especially under PH RA 10173 (Data Privacy Act) and the wiretap
law (RA 4200). E1 ships with an **explicit, in-product consent gate**:

- Before upload/record begins, a modal lists the following and requires
  click-through acknowledgment:
  1. "Only record sessions where the speaker has given consent, or where
     local law permits recording educational lectures."
  2. "Audio is processed by OpenAI Whisper. The audio file itself is
     deleted after transcription; the text transcript is kept in your
     account."
  3. "Don't upload audio containing other students' personal information,
     graded feedback for someone else, or anything you wouldn't paste
     into a study group chat."
- Acknowledgment is logged: `UserAudioConsent` row with
  `(user_id, consent_version, accepted_at)`. Version bumps re-prompt.
- The "record in browser" path additionally shows a persistent indicator
  while recording (red dot + timer) so the user can't forget it's running.

This is *user-facing consent*, not legal absolution — but it forces the
user to acknowledge their responsibility, which is the right ethical
posture for a student-facing tool.

---

## 4. File caps & cost ceiling

OpenAI Whisper bills $0.006/minute. Hard caps below are picked to keep a
worst-case single transcription **under $0.50** and a worst-case month
(plus tier student) under the daily/monthly quota system already wired.

| Knob                          | E1 value                                    |
|-------------------------------|---------------------------------------------|
| Max audio length per upload   | 60 minutes                                  |
| Max file size                 | 100 MB (covers 60 min of opus @ ~20 kbps)   |
| Allowed MIME types            | audio/mpeg, audio/mp4, audio/wav, audio/webm, audio/ogg |
| Per-user daily transcriptions | Free: 0 (gated). Plus: 2/day, 10/month     |
| Per-user monthly cost ceiling | Plus: $5/month for audio specifically       |
| Concurrent jobs per user      | 1 (audio jobs are heavy; serialize)         |

Enforcement points:
- **Client**: refuses files over 100 MB / 60 min before requesting a
  presigned URL (cheap rejection).
- **Presign endpoint**: re-checks size from `Content-Length`, MIME, and
  the user's remaining daily/monthly count.
- **Worker**: re-checks duration via `ffprobe` after download; if it
  exceeds 60 min, fail the job and refund the usage reservation.
- **Cost guard**: existing `lock_quota_for_user` + `check_daily_cap` +
  `check_monthly_quota` get a new per-feature variant
  `check_audio_quota(user_id)` that reads from a separate quota window so
  a heavy audio month doesn't starve text generations.

Pricing reservation: at job-queue time, reserve
`audio_minutes * $0.006 + $0.02` (Whisper + summary) against the user's
audio quota. Replace with actual on completion via `record_usage`.

---

## 5. Retention

- **Audio file (R2)**: deleted immediately on successful job completion,
  and on any terminal failure. Worst case retention is the duration of
  the job (queued → processing → done). If a job is stuck > 6 hours, a
  daily janitor sweeps and deletes the object regardless.
- **Transcript + summary**: persisted in `stream_entries` indefinitely
  (until the user deletes the course or the stream entry). Counts as
  "user content" under the existing data-deletion flow.
- **Notebook cards seeded from audio**: persisted; tagged with
  `origin="audio_seed"` and `source_audio_entry_id` so the user can
  trace them back.
- **Whisper / OpenAI side**: we use OpenAI's standard API (not the
  fine-tuning endpoint). Per their policy, API audio is not used for
  training and is retained ≤ 30 days for abuse monitoring. Disclose this
  in the consent modal.
- **Right to delete**: deleting the stream entry deletes its summary,
  transcript, and (via cascade) any audio-seeded notebook cards that
  reference it. Existing cascade rules cover this once we add the FK.

---

## 6. Data model

New tables / columns:

```python
class UserAudioConsent(Base):
    __tablename__ = "user_audio_consents"
    id: str (uuid pk)
    user_id: str (fk users.id, index)
    consent_version: str            # e.g. "2026-05-v1"
    accepted_at: str (iso)
    accepted_user_agent: str | null # for forensics

# stream_entries gets a new entry_type "audio_transcript" — no schema
# change needed since entry_type is already a free string column.
# Payload shape for audio_transcript entries:
#   {
#     "transcript": "...",
#     "summary": "...",
#     "duration_seconds": int,
#     "audio_filename": "lecture_2026-05-27.m4a",
#   }

# notebook_cards: gain a new origin enum value "audio_seed" and a
# nullable source_audio_entry_id FK to stream_entries (cascade delete).
```

New Job type: `transcribe-audio` with stages `queued → uploading → 
transcribing → summarizing → done` (or `failed`).

---

## 7. Endpoints

```
POST   /projects/{id}/audio/consent          (idempotent; logs latest version)
POST   /projects/{id}/audio/upload-url       (presigned PUT, with caps re-check)
POST   /projects/{id}/audio/transcribe       (creates job referencing the R2 key)
GET    /projects/{id}/audio/jobs/{job_id}    (poll status — existing job route works)
DELETE /projects/{id}/stream/{entry_id}      (already exists; cascade covers cards)
```

Rate limits (slowapi):

- `/audio/upload-url`: `5/hour;15/day`
- `/audio/transcribe`: `5/hour;15/day` (mirrors the upload limit)

---

## 8. Failure modes & their handling

| Failure                                  | Behavior                                                                 |
|------------------------------------------|--------------------------------------------------------------------------|
| File > 100 MB                            | Client + presign endpoint both reject with 413.                          |
| Duration > 60 min (detected post-upload) | Worker fails job, deletes R2 object, refunds usage reservation.          |
| Whisper API error                        | Retry once with backoff, then fail. R2 object deleted on terminal fail.  |
| Summary step error                       | Keep transcript (still useful); skip summary; mark job partial-success.  |
| User cancels mid-job                     | Job marked cancelled; R2 object deleted; no usage charged.               |
| Worker dies mid-job                      | Janitor (6h sweep) reclaims the object and marks job failed.             |
| Non-English audio                        | Whisper auto-detects; if not en/fil, mark `language_unsupported` warning and still return transcript. |

---

## 9. Security considerations

- Presigned PUT URLs are scoped per-user and short-lived (≤ 10 min).
- R2 bucket has no public-read; objects are accessed by the worker via
  presigned GET, also short-lived.
- File extension and Content-Type must both be in the allowlist; the
  worker independently sniffs the magic bytes before sending to Whisper.
- Transcripts are sanitized for stream display: rendered as plain text,
  no HTML — same path as paste-text entries.
- Webhooks/storage events are *not* trusted as triggers for job state;
  the API explicitly transitions jobs based on worker calls only.

---

## 10. What's deliberately out of scope for E1

- Real-time / streaming transcription (Whisper-1 is batch-only; would need
  Realtime API → separate cost model + UX work).
- Speaker labels (Whisper alone can't do this reliably; would need
  pyannote/diarization → extra infra).
- Multi-language switching mid-recording (rare for a single lecture).
- Auto-extracting follow-up tasks from audio (out of scope until task
  extraction from text+image stabilizes — Feature 5).
- Search across all transcripts (will revisit once we have 10+ stored
  transcripts in real student accounts).

These belong in an Audio E2 doc after we see E1 usage data.

---

## 11. Open questions

- Do we need an audible "this conversation is being recorded" injected
  into the in-browser recorder for jurisdictions that require two-party
  consent notification? (E1: rely on the consent modal; revisit if PH
  legal review flags it.)
- Should the consent modal block on **every** upload, or only when the
  version bumps? (Current draft: only on version bump, but show a
  one-line reminder above the upload button each time.)
- How do we surface partial-success (transcript-but-no-summary) without
  cluttering the stream? (Possibly: stream entry shows transcript + a
  "Generate summary" retry button.)

---

## 12. Implementation order (when we pick this up)

1. Migration: `user_audio_consents` table + `notebook_cards.origin` enum
   addition + nullable FK.
2. Backend service `audio_transcription_service.py` (wraps Whisper + the
   summary LLM call). Mirror the structure of
   `task_extraction_service.py`.
3. Worker stage handlers for `transcribe-audio`.
4. Routes: consent, upload-url, transcribe.
5. Frontend: consent modal + upload widget + (later) MediaRecorder.
6. Cost dashboard tile: "Audio usage this month."
7. Soft launch behind `feature_flags.audio_e1 = true` per-user.
