# CourseKin Product Roadmap and SaaS Checklist

**Created:** May 25, 2026

**Purpose:** Track production readiness, the completed v1 foundation, the planned v2 course companion, and future v3 feature decisions.

This document complements:

- `PRODUCTION_PROGRESS.md` for engineering migration and hardening history.
- `DEPLOYMENT.md` for infrastructure and release operations.

## Status Legend

- `[x]` Completed
- `[~]` In progress
- `[ ]` Planned
- `[?]` Needs validation or product decision
- `[defer]` Worth retaining, but deliberately not scheduled yet

## Product Direction

### North Star

CourseKin should become a **source-grounded academic course companion**:

> Help a student organize each course, understand its material, prepare before assessments and light assignments, and build mastery through traceable learning support.

### Version Strategy

- **v1: Reviewer Foundation - complete baseline.** The existing product accepts learning sources and creates reviewer content, quizzes, flashcards, and exports on top of the SaaS hardening foundation.
- **v2: Academic Course Companion - next build.** The planned product evolution adds trusted citations, course workspaces, syllabus and semester planning, the private course stream, bounded assignment coaching, assessment runway, workload balancing, and mastery support.
- **v3: Living Learning Platform - future expansion.** Later work may add the living reviewer document, broader media ingestion and transcription, LMS import, collaboration, institutional workflows, and carefully justified broader student-life support.

### Differentiation Principles

- **Traceability:** Generated claims and answers point back to the uploaded source.
- **Exam alignment:** The app prioritizes what the learner is likely to be tested on.
- **Mastery adaptation:** Practice changes based on mistakes and weak topics.
- **Efficient generation:** Spend model budget only where it improves learning outcomes.
- **Trustworthy SaaS:** Privacy, deletion, billing, reliability, and cost controls are part of the product.

## Product Vision Discussion Log

### May 25, 2026: Working Product Name Selected

**Decision:** Use **CourseKin** as the working product name for the v2 build and future SaaS identity, replacing the original ReviewFlow working name.

**Rationale:** The name expresses an ongoing, supportive course relationship rather than a single reviewer-generation action. Domain acquisition, social handles, and formal trademark clearance remain required before public launch.

### May 25, 2026: v2 Course Companion Concept

**Status:** Accepted product direction for v2; implementation sequence remains subject to engineering breakdown and validation.

#### Proposed Direction

CourseKin may evolve from a single reviewer generator into a supportive, course-aware academic companion. The intended relationship is ongoing: it helps a student organize class obligations, preserve learning materials, prepare for assessments, and strengthen understanding without replacing teachers, classmates, or the student's own thinking.

Proposed experience loop:

`Course syllabus -> confirmed deadlines and tasks -> calendar preparation -> collected class materials -> cited reviewer/help -> practice and mastery results -> proactive study guidance`

#### Provisional Discussion Choices

- Initial audience to explore: adult university students.
- Initial product wedge to explore: syllabus-to-preparation workflow connected to a future to-do/calendar system.
- Calendar policy: AI can extract proposed tasks and events, but the student reviews and confirms them before any calendar sync.
- Companion behavior: notify students before assessments, offer preparation help, identify weak topics, and suggest useful next study actions.
- Gamification direction: reward meaningful learning actions such as completed recall sessions and preparation consistency; broader hobby and personal-growth features remain future ideas.

#### Clarification: Per-Course Stream and Living Reviewer

Each enrolled class could have a private, persistent course space that feels like an organized Discord-style channel between the student and the AI. The app already knows the student's class schedule, so the student can enter the correct course space during or after class and add:

- Questions and short typed lecture notes.
- Photos of boards, slides, handwritten notes, or assigned work.
- Uploaded files and course readings.
- Audio recordings or transcripts, subject to permission and privacy controls.
- References to tasks, quizzes, projects, rubrics, and deadlines.

The first version of this idea is a **course compilation stream**: it preserves all course-specific input in one chronological, searchable place and later lets the student generate a reviewer, summary, flashcards, questions, or preparation plan from the collected material.

A v3 version is a **living reviewer workspace**: the course stream remains the input/conversation area while a document-like reviewer exists beside it and updates responsively as the student adds evidence or asks questions. This could feel closer to a collaborative document than a chat response: organized topic sections, revisions, cited definitions, and source-linked explanations.

External web material may later support definitions or additional sources, but it must be clearly marked separately from professor/class materials and cited so students know what came from their course versus the web.

#### Items Still To Resolve Together

- Whether the course stream becomes the primary student workspace or complements an existing course dashboard.
- How a course schedule, syllabus obligations, to-do tasks, and class materials are connected without creating duplicate information.
- Whether an AI answer is saved automatically into course memory or only when the student approves it.
- How the future living reviewer handles edits, evidence conflicts, revisions, and web-sourced additions.
- What recording consent, retention, transcription cost, and deletion rules are required before audio is considered.
- Whether shared class spaces or added people ever belong in this product, and what privacy model that would require.

#### Constraints Already Identified

- Course recordings require explicit permission confirmation, deletion controls, retention rules, and policy updates.
- Course, calendar, assessment, and recording data expand privacy obligations and must be reviewed before release.
- Calendar integrations must request minimal access and must not silently create or alter academic deadlines.
- Product messaging should position the AI as a supportive learning companion, not a substitute for human relationships or student responsibility.

### May 25, 2026: v2 Boundaries and v3 Advanced Feature Decisions

**Status:** Owner direction recorded for v2 implementation planning and v3 deferrals.

#### Coursework Support Boundary

CourseKin should help students produce reviewers and prepare for coursework, including light assignments and short papers. Proposed support includes requirement breakdown, rubric extraction, planning, explanations, outlines, source organization, and draft feedback.

The product should initially limit or defer:

- Full presentation or PowerPoint production because it requires a separate costly visual/editing workflow.
- Thesis-level papers and data-intensive long-form research workflows because the reliability, source, data, and authorship burden is much higher.
- Large group-paper production because collaboration, ownership, and academic-integrity requirements are not yet defined.

These limitations may be reconsidered for v3 or later if the v2 academic companion succeeds and demand justifies the additional product surface.

#### Advanced Feature Decisions

| Feature | Decision | Timing Rationale |
| --- | --- | --- |
| Rubric-aware assignment coach | Must have | Directly connects assignments, deadlines, grading criteria, preparation, and feedback. |
| Course policy and AI-permission tracker | Do not build as proposed | A policing-style feature would make the experience feel restrictive; keep student support approachable. |
| Assessment runway | Must have | Students need a visible countdown, readiness state, and next step for every major assessment. |
| Confusion inbox | Include | Captures student uncertainty from the course stream and turns it into later help or practice. |
| Source firewall for web material | Include; foundational | Course evidence and external web references must be clearly separated and cited. |
| Draft feedback mode | Include | Supports light assignments and short papers through feedback rather than heavy document production. |
| Office-hours preparation | Include | Helps students take useful, well-grounded questions back to professors. |
| Workload balancer | Must have | Preparation and project work should be distributed across the term, not clustered near deadlines. |
| Learning reflection journal | Include in course stream | The private stream should capture understanding, confusion, and likely assessment topics. |
| LMS import | v3 candidate | Valuable after course/task/calendar models are proven; integration may be complex. |
| Living reviewer with change history | v3 must-have direction | Central long-term product concept, but substantial work after the stream and evidence model exist. |
| Accessible learning modes | Include | Better supports students through simpler explanations, examples, alternate learning approaches, and accessibility needs. |

### May 25, 2026: To-Do and Calendar Project Integration Review

**Status:** Reviewed as a v2 product and behavior reference; direct codebase merge is not recommended.

The owner's `todo-app-backbone` project confirms useful patterns for the course companion:

- Task records with due dates, reminder times, priorities, subtasks, tags, recurrence, focus time, and completion streaks.
- Calendar display and `.ics` export as an initial schedule surface.
- Natural-language and image-based task extraction that proposes data for user confirmation rather than silently creating tasks.
- Voice-planned actions that require explicit review before applying changes.
- Comments and attachments as an early reference for the eventual private course stream.

CourseKin should implement these ideas in its existing SaaS foundation rather than merge the separate app runtime. CourseKin already owns Clerk authentication, verified resource ownership, queued AI generation, quotas, object storage, account export/deletion, and production safeguards. The reference project uses a separate authentication model, SQLite-oriented persistence, local file uploads, and an in-process reminder scheduler that are not appropriate as the deployed CourseKin architecture.

#### Integration Decision

- Convert the generic `Folder` idea into a CourseKin `Course` workspace.
- Convert to-dos into CourseKin-owned `CourseTask`, `Assessment`, and `PreparationMilestone` records.
- Preserve the confirmation-first behavior: syllabus, photo, text, or later voice extraction creates proposals; only a student confirmation creates deadlines or calendar entries.
- Reuse recurrence, reminder, streak, and workload-planning concepts through new CourseKin backend models and worker-driven jobs.
- Treat `.ics` export as a useful early calendar capability; defer write-access calendar synchronization until minimal-access and confirmation policies are implemented.
- Treat comments/attachments as design input for a persistent course stream, not as an existing stream implementation.
- Keep lecture recording and live transcription deferred until privacy, consent, retention, deletion, and cost requirements are complete.

### May 27, 2026: Course Desk UX Reset and Revised v2 Delivery

**Status:** Adopted for the next v2 implementation slices.

The working course-companion capabilities are useful, but the current reviewer/project dashboard no longer expresses the intended student experience. CourseKin should now be designed as a student's **Course Desk**: a calm daily workspace organized around classes, deadlines, questions, materials, and preparation rather than generated artifacts.

#### Experience Model

- **Today:** what needs attention next, including confirmed obligations and preparation sessions.
- **Courses:** the student's enrolled course spaces, each carrying its own context and memory.
- **Course Room:** chronological capture of class notes, questions, reflections, and attached materials.
- **Course Plan:** syllabus obligations, confirmed deadlines, preparation runway, and reminder preferences.
- **Materials:** syllabus, readings, briefs, links, and later photo or audio sources.
- **Notebook:** the existing cited reviewer surface, positioned for the future living reviewer document.

The supported v2 loop is:

`Add course -> add syllabus/material -> confirm extracted dates -> plan preparation -> capture class questions/notes -> get cited help -> build a study notebook`

#### UX and Brand Rules

- Use a flat, calm interface with warm paper neutrals, ink text, and one forest accent; avoid gradients, glassmorphism, and purple/blue startup styling.
- Use plain English copy and student tasks, not generic feature-card language or inflated marketing claims.
- Only expose real, functioning destinations in navigation. Calendar, Library, Practice, and Progress appear only when their useful product surfaces exist.
- Treat the v3 living reviewer as the future notebook experience, not as a chat panel added prematurely to the existing layout.

#### Active Blockers and Launch Trust Gates

- A local browser syllabus upload is currently blocked because the private R2 uploads bucket does not return an allowed CORS response for `http://localhost:3000` on presigned `PUT` uploads. Configure and acceptance-test approved local, staging, and production origins before considering upload workflows complete.
- Audit rate limiting across application endpoints; Clerk sign-in abuse controls belong in the Clerk/Turnstile configuration, while CourseKin API routes require their own limits. Target at most 5 sensitive auth-adjacent attempts in 15 minutes where CourseKin controls the endpoint.
- Scan the codebase and Git history for committed credentials, move all secrets to environment configuration, and rotate any exposed provider credential before public release.
- Complete input-size, malformed-payload, and sanitization review for every user-content surface, including syllabus, stream, feedback, and coaching endpoints.
- Complete a security audit report, privacy policy selection or review (for example Termly or iubenda), terms of use, data/compliance review, and an IP infringement/reporting process before public SaaS launch.

## v1: Current Foundation

### Completed SaaS Hardening Baseline

- [x] Authentication and resource ownership enforcement.
- [x] Per-user generation quota and cost accounting foundation.
- [x] Bot protection for generation flows.
- [x] Safe upload validation and Cloudflare R2 storage flow.
- [x] URL redirect target validation for remote-source ingestion.
- [x] User-scoped generation cache and account data export/deletion.
- [x] Database-backed generation jobs and dedicated worker entry point.
- [x] Billing endpoint gated until provider acceptance testing is complete.
- [x] Observability, legal pages, account settings, and CI validation foundation.
- [x] Patched frontend dependency baseline with zero npm audit findings at creation time.

### Existing Product Capabilities

- [x] Projects and uploaded source organization.
- [x] Text, URL, and PDF source inputs.
- [x] AI reviewer generation with summaries, key points, definitions, Q&A, quizzes, and flashcards.
- [x] Multi-source reviewer generation foundation.
- [x] PDF reviewer export.
- [x] Free and paid-plan UI/billing foundations.

## v1 Production Launch Checklist

These items should be completed before accepting real paid users.

### Infrastructure and Deployment

- [ ] Provision Neon production PostgreSQL and a staging branch.
- [ ] Provision shared Redis-compatible rate-limit storage.
- [ ] Configure Railway API service using `api/railway.toml`.
- [ ] Configure Railway generation worker service using `api/railway.worker.toml`.
- [ ] Configure Vercel frontend deployment with Node.js 20.19 or newer.
- [ ] Configure Cloudflare R2 uploads bucket and `temp/` lifecycle cleanup.
- [ ] Configure R2 browser-upload CORS for approved local, staging, and production frontend origins; current localhost syllabus uploads fail before this is set.
- [ ] Configure backup bucket and complete one backup/restore rehearsal.
- [ ] Set up domains, TLS, WAF rules, and basic bot controls.

### Provider Acceptance Testing

- [ ] Validate a real PDF upload, extraction, generation, download, project delete, and account delete against R2.
- [ ] Validate Clerk sign-up, JWT auth, data export, and account deletion.
- [ ] Validate Turnstile in production for generate, regenerate, and batch-generate paths.
- [ ] Validate Redis-backed rate limits across multiple API processes.
- [ ] Validate a worker restart while a generation job is processing.
- [ ] Validate Sentry, Axiom logging, and daily digest delivery.

### Billing Launch Gate

- [ ] Complete Polar seller onboarding and create product IDs.
- [ ] Test checkout creation and successful subscription activation.
- [ ] Test duplicate webhook delivery and idempotency.
- [ ] Test canceled-at-period-end and revoked subscription behavior.
- [ ] Test account deletion while an active subscription exists.
- [ ] Keep `BILLING_ENABLED=false` and `NEXT_PUBLIC_BILLING_ENABLED=false` until all billing acceptance tests pass.
- [ ] Enable payments only after confirming quotas and plan access update correctly.

### Security and Compliance

- [ ] Complete live SSRF defense review, including outbound network controls against DNS rebinding.
- [ ] Confirm signed DPAs and subprocessor records.
- [ ] Confirm production retention and backup-deletion procedures match the privacy policy.
- [ ] Scan repository and Git history for credentials, rotate any exposed secret, and verify secrets are environment-only.
- [ ] Audit endpoint throttling, input sanitization, malformed/oversized payload rejection, and Clerk sign-in protections.
- [ ] Publish reviewed terms, privacy/data-compliance disclosures, and an IP infringement/reporting process.
- [ ] Add incident response contacts and production alert recipients.
- [ ] Run a launch security review before paid traffic.

## v2: Prioritized Product Upgrades

### P1: Trusted Study Output

Goal: make every generated study artifact reliable and defensible.

- [x] Add citations to each generated item: source ID, page/chunk reference, and supporting excerpt.
- [x] Add inline `View evidence` interactions for summaries, key points, definitions, flashcards, Q&A, and quiz rationales.
- [ ] Add full source-document navigation/highlighting from citations.
- [ ] Expand evidence states beyond source-linked and not-found to a defensible `weak support` classification.
- [ ] Separate class/course evidence, student notes, external web references, and AI explanations in every generated output.
- [x] Include source citations in exported reviewer PDFs.
- [x] Add user feedback controls: accurate, unsupported, unclear, or incorrect.
- [x] Track versioned item feedback so prompts and generation quality can be improved.

**Why first:** Basic AI generation is common. Source-linked output creates trust and is required for serious exam preparation.

### P2: Course Workspace and Semester Planning

Goal: establish the ongoing student-to-course relationship and prevent last-minute preparation.

- [x] Evolve the current project concept into a course-oriented workspace without breaking existing reviewer flows.
- [x] Let students add a syllabus and class schedule to each course.
- [x] Extract proposed assessments, light assignments, projects, deadlines, rubric notes, and uncertain fields for student review.
- [ ] Extract syllabus topic coverage for readiness mapping.
- [x] Require student review and correction before confirmed deadlines appear in calendar export.
- [x] Review the owner's to-do/calendar system and record reusable behavior patterns and architecture boundaries.
- [x] Implement CourseKin-owned confirmed obligation records and confirmation-only `.ics` calendar export.
- [x] Implement preparation milestones based on confirmed obligations.
- [x] Add initial in-app reminder preferences and dashboard prompts for upcoming preparation milestones.
- [x] Add a private Calendar and Tasks workspace showing confirmed deadlines, preparation sessions, and student-created course tasks.
- [ ] Add consent-based outbound reminder delivery channels only after in-app reminder usefulness is validated.
- [x] Add an assessment runway showing due dates, missing materials, recommended preparation, and session progress; reserve readiness claims for measured mastery.
- [x] Add an initial workload balancer that distributes bounded preparation and project steps under a student-selected daily capacity.

**First validation wedge:** An adult university student uploads a syllabus, confirms extracted obligations, and receives a realistic preparation plan before the first assessment.

### P3: Private Course Stream and Course Memory

Goal: keep the student's actual learning journey organized inside each course.

- [x] Add a student-owned private chronological course stream foundation for typed notes and questions.
- [x] Add AI reply interactions grounded in course evidence and clearly separate them from student entries.
- [x] Support uploaded readings and references to assessments or rubric items in the stream.
- [x] Add a confusion inbox and learning reflection prompts inside the stream.
- [x] Add citation-grounded course Q&A with accessible learning modes such as simpler explanation, step-by-step reasoning, and example-first explanation.
- [ ] Let students select accumulated stream content when generating summaries, reviewers, flashcards, or preparation plans.
- [ ] Add OCR/photo and audio/transcript inputs only through staged privacy- and quality-reviewed releases.

**Important boundary:** This stream is course memory and learning interaction, not an early social network or public chat.

### P4: Coursework and Preparation Coach

Goal: support bounded assignments and short papers without expanding prematurely into heavy content production.

- [x] Add a rubric-aware assignment coach that uses confirmed requirements and evidence to prepare a completion checklist.
- [ ] Connect confirmed assignment milestones to task planning and workload balancing.
- [x] Add draft feedback mode for light assignments and short papers: requirement coverage, clarity, missing support, and revision guidance.
- [x] Add office-hours preparation from course evidence and draft blockers.
- [x] Clearly communicate product limits for presentations, thesis-level work, complex data-heavy papers, and undefined group-authoring workflows.
- [ ] Do not build a restrictive course AI-permission tracking feature as part of the student experience.

### P5: Learning and Mastery Loop

Goal: move from collected course content to measurable learning improvement.

- [x] Store notebook quiz attempts, selected answers, server-computed scores, and time spent.
- [x] Show explanations for wrong notebook-quiz answers with citations to original material.
- [ ] Automatically create remedial flashcards from missed questions.
- [~] Track recall performance by topic or concept. Source-grounded quiz topics now support focus summaries; validated mastery remains future work.
- [x] Add a Focus Areas view and recommended next actions from source-grounded quiz topics.
- [ ] Add spaced repetition scheduling for flashcards.
- [ ] Add confidence self-rating before and after practice sessions.

**Key user outcome:** "The app knows what I keep getting wrong and helps me fix it."

### P6: Course Coverage and v3 Living Reviewer Preparation

Goal: structure v2 course memory so it can support an organized, evolving, evidence-linked v3 study document.

- [ ] Parse expected topics, weights, question formats, and required competencies.
- [ ] Map uploaded sources against required exam coverage.
- [ ] Show covered, weakly covered, and missing topics.
- [ ] Generate a prioritized reviewer based on exam weight and source evidence.
- [ ] Add an exam readiness score based on mastery and coverage.
- [ ] Define the evidence and revision model required for a v3 living document-style reviewer.
- [ ] Define v3 change history requirements for new course evidence, student corrections, web enrichment, and evidence conflicts.
- [ ] Deduplicate repeated concepts, highlight frequently taught topics, and flag possible contradictions.

**Sequencing note:** The living reviewer is a v3 must-have direction; v2 should establish the stable course storage, citations, and stream-based collection it requires.

### P7: Adaptive Practice Exams

Goal: make testing realistic and personalized.

- [ ] Generate timed mock exams from selected sources and blueprint topics.
- [ ] Support question formats: multiple choice, identification, short answer, essay prompts, and case-based items.
- [ ] Allow easy, standard, and challenging difficulty settings.
- [ ] Bias new tests toward weak topics while retaining broad coverage.
- [ ] Provide post-exam analysis by topic, difficulty, and confidence.
- [ ] Use mistakes to schedule the next study session automatically.

### P8: v3 Expanded Inputs and Integrations

Goal: broaden course input and institutional connectivity only after the core companion workflow is stable.

- [ ] Add PPTX ingestion.
- [ ] Add DOCX ingestion.
- [ ] Add OCR for scanned PDFs and photos of notes.
- [ ] Detect poor extraction quality and request a clearer upload.
- [ ] Add page-level extraction previews so students can correct source text.
- [ ] Add asynchronous lecture audio/video transcription only after consent, retention, cost, and deletion controls are designed.
- [ ] Explore LMS assignment import in a later version after course and task models are stable.

## v2 SaaS and Retention Upgrades

### Student Experience

- [ ] Add exam countdown and next-session recommendations.
- [ ] Add assessment runway cards for quizzes, light assignments, projects, and exams.
- [ ] Add workload-balanced preparation plans across each term.
- [ ] Add study streaks based on completed recall sessions, not page visits.
- [ ] Add progress snapshots and weekly mastery reports.
- [ ] Add saved study sessions that resume from unfinished weak areas.
- [ ] Add shareable reviewer links with private-by-default permissions.

### Monetization Strategy

- [ ] Validate free-tier limits against acquisition and model cost.
- [ ] Make paid value about adaptive learning, OCR, blueprint mode, larger source collections, and mock exams, not merely more generations.
- [ ] Add clear usage display before the billing gate is enabled.
- [ ] Add billing history and plan management once Polar live flow is verified.
- [ ] Define education/teacher or review-center plans only after student retention is proven.

### Instructor or Review-Center Expansion

- [ ] Explore shared course workspaces.
- [ ] Explore instructor-created reviewer packs.
- [ ] Explore class-level aggregate mastery without exposing individual content unnecessarily.
- [ ] Explore organization billing and access management.

## v2 Efficiency and Platform Upgrades

### AI Cost and Latency

- [x] Store source chunks with stable identifiers and page references.
- [ ] Use retrieval to send only relevant chunks for each generation task.
- [ ] Cache artifacts separately: summary, flashcards, quiz items, and explanations.
- [ ] Regenerate only impacted artifacts when a source changes.
- [ ] Route lightweight classification/extraction work to cheaper models.
- [ ] Reserve stronger-model calls for hard explanations, quality review, or complex exam simulation.
- [ ] Add prompt/output quality metrics tied to cost.

### Application Performance

- [ ] Split or lazy-load the large PDF/export frontend bundle.
- [ ] Add job progress reporting for OCR, extraction, generation, and exports.
- [ ] Add retry controls for failed user jobs without duplicate model spend.
- [ ] Add pagination and archival for large projects and long usage histories.
- [ ] Add worker concurrency tuning and queue health dashboard.

### Reliability and Operations

- [ ] Add end-to-end tests covering auth, upload, generation, deletion, and billing test mode.
- [ ] Add production smoke tests after deploy.
- [ ] Add alert thresholds for stuck jobs, queue depth, model spend, provider failures, and webhook retries.
- [ ] Add retention cleanup jobs for stale temporary uploads, expired jobs, and deletion workflows.
- [ ] Add disaster recovery runbook evidence after each restore rehearsal.

## Adopted v2 Course Desk Delivery Sequence

This sequence supersedes the UI delivery order below while preserving completed engineering checkpoints as capability history.

### V2-R0: Workflow Unblock and Trust Baseline

- [ ] Configure R2 CORS and validate the complete syllabus upload, extraction, review, confirmation, and export flow in the browser.
- [ ] Run credential/code/history scan and document rotations or remediation.
- [ ] Audit endpoint throttling and content payload validation; document remaining vulnerabilities.
- [ ] Define the pre-launch legal and data-compliance work products.

### V2-R1: Course Desk UX Foundation

- [~] Replace generic dashboard/project framing with Today, Courses, Course Room, Plan, Materials, and Notebook framing.
- [~] Establish flat brand tokens, clear typography, plain-language UI copy, and real-workflow empty states.
- [ ] Validate the new shell with at least one complete existing-course journey before expanding the information architecture.

### V2-R2: Planning and Materials Journey

- [x] Make syllabus intake, confirmed obligations, calendar export, and preparation runway feel like one guided course-plan flow.
- [x] Make material type, processing state, evidence availability, and upload failure recovery understandable to students.
- [ ] Complete browser PDF-upload acceptance after the R2 bucket CORS policy is configured.

### V2-R3: Course Room and Notebook Journey

- [x] Recompose the existing private stream, confusion inbox, cited answers, and coaching into a coherent Course Room.
- [x] Reframe cited reviewer generation as a student Notebook fed by selected course materials and connected visibly to the Room.
- [ ] Let students intentionally include selected Room entries in Notebook generation; the current Notebook does not automatically use saved room context.

**May 27, 2026 Room-to-Notebook checkpoint:** Room now presents capture, open questions, cited answers, and bounded coursework guidance as one student workflow with a direct path to Notebook. Notebook states that it builds from selected processed materials and does not yet absorb Room notes or questions automatically. A living document editor and real-time lecture capture remain v3 work.

### V2-R4: Mastery and Pilot Validation

- [~] Add practice history, mistake explanations, weak-topic guidance, and readiness indicators only after the core desk journey tests well. Quiz history, cited mistakes, and Focus Areas are implemented; validated mastery and readiness require coverage mapping and student validation.
- [ ] Run an adult university-student pilot and measure usefulness, correction rates, return behavior, and trust.

**May 27, 2026 practice-foundation checkpoint:** Notebook quizzes now save server-scored attempts, answers, elapsed time, and cited mistake review. The Notebook shows recent practice and next-focus questions, but deliberately labels its result as a practice signal rather than exam readiness. Topic-level mastery, remedial card generation, spaced repetition, and true readiness require later topic/coverage mapping and student validation.

**May 27, 2026 Focus Areas checkpoint:** Newly generated Notebook questions include a concise topic label supported by the same cited course material used for the question. Submitted attempts preserve those labels and group recent recall results into Focus Areas with recommended next actions. Older unlabelled practice attempts stay in history but are not retroactively classified. This is topic-focused practice guidance, not a mastery score or exam-readiness claim.

### Next Tracked UX Task: Calendar Tab

- [x] Add a real Calendar tab that shows confirmed course obligations and planned preparation sessions in one term view.
- [x] Keep proposed syllabus dates outside the calendar until the student confirms them.
- [x] Add private student-created course tasks with due date, priority, completion, export, and deletion coverage.
- [x] Begin with the existing reviewed `.ics` export and in-app schedule; do not silently write to external calendars.

**May 27, 2026 Calendar and Tasks checkpoint:** Calendar now combines confirmed syllabus deadlines, generated preparation sessions, and student-created course tasks across courses. Tasks can be created, completed, reopened, or removed from a private course-linked task panel; they are included in account export and deletion paths. AI extraction still creates reviewable obligations rather than silent tasks or calendar entries.

### Next High-Priority Capability: Consent-Governed Audio to AI

- [ ] Design the capture consent step, visible recording state, deletion controls, retention window, file-duration limits, and cost ceilings before enabling audio uploads.
- [ ] Implement an asynchronous first pipeline only after those controls are approved: student starts capture or uploads permitted audio, Whisper transcribes it, student reviews the transcript, then explicitly chooses AI summary, notes, questions, or tasks.
- [ ] Treat transcript-derived tasks and deadlines as proposals that require confirmation before Calendar placement.
- [ ] Defer live lecture assistance and continuous listening until consent, privacy, quality, and cost behavior are proven with the asynchronous pipeline.

### Launch Gate

- [ ] Complete upload/infrastructure acceptance, security audit, legal/privacy/data-compliance/IP review, billing acceptance, and production smoke testing before accepting paid public users.

## Recommended Version Roadmap

### v1 Release Gate: Launch Confidence

**Objective:** Safely deploy the hardened baseline and begin controlled testing.

- [ ] Finish production infrastructure and provider acceptance checks.
- [ ] Deploy API, worker, frontend, database, shared limiter, and storage.
- [ ] Keep paid billing disabled while testing with invited users.
- [ ] Collect feedback on reviewer accuracy, usability, and generation latency.

### v2 Phase A: Evidence-Linked Reviewers

**Objective:** Make CourseKin noticeably more trustworthy than basic AI generators.

- [x] Implement source chunk/page indexing.
- [x] Add validated citations and inline evidence previews for generated content.
- [ ] Add full source-document navigation/highlighting and weak-support classification.
- [x] Include citations in exports.
- [x] Capture accuracy feedback from users.

**May 25, 2026 implementation checkpoint:** v2a stores deterministic chunks for new text, URL, and PDF sources; preserves PDF page references during new ingestion; instructs generation to cite chunk IDs; rejects unindexed citation IDs before display; renders evidence excerpts in reviewer and export views; and stores versioned item feedback. Existing sources are lazily indexed when regenerated, but older already-extracted PDFs require re-upload for page-specific citations because their historical page boundaries were not stored.

### v2 Phase B: Course Foundation and Semester Planning

**Objective:** Move from one-time reviewer generation into an ongoing, useful course relationship.

- [x] Add course workspaces, class schedules, syllabus ingestion, and confirmed obligation extraction.
- [x] Review the owner's to-do/calendar project and preserve its useful behavior through CourseKin-owned records.
- [x] Add reviewed `.ics` calendar export without granting calendar write access.
- [x] Add assessment runway, preparation milestones, and initial workload balancing.
- [x] Add in-app reminder preferences and dashboard prompts for planned sessions.
- [x] Add a private Calendar and Tasks workspace using confirmed dates, preparation sessions, and student-created tasks.
- [x] Add measurement instrumentation for confirmed syllabus extraction corrections and pre-assessment preparation return.
- [ ] Run the real-student pilot and evaluate the collected validation metrics before expanding reminders or calendar access.
- [ ] Deferred pending pilot: Add consent-based outbound reminder delivery and optional reviewed calendar synchronization.

**May 25, 2026 implementation checkpoint:** The first v2b slice adds optional course profile fields to new and existing workspaces; labels sources as syllabus, lecture notes, assignment briefs, or study materials; allows older uploads to be reclassified; queues syllabus obligation extraction into proposed records; requires student editing and confirmation before export; and generates `.ics` files only from confirmed dated obligations. It deliberately does not create external calendar events, reminders, or readiness plans yet.

**May 26, 2026 implementation checkpoint:** The second v2b slice adds a deterministic Preparation Runway from confirmed dated obligations. It creates bounded study or light-coursework sessions, balances them under a selected daily capacity where deadlines permit, preserves completed sessions during rebalancing, flags missing study material, and tracks session completion as preparation progress only. It does not send reminders, create calendar events for suggested sessions, or claim mastery/readiness.

**May 26, 2026 reminder checkpoint:** The next v2b slice adds per-course controls for dashboard reminder visibility and lead time, plus a user-scoped dashboard feed of due or upcoming planned sessions. This is an in-app prompt surface only: it does not request browser notification permission, send email or push alerts, or write suggested sessions to a calendar.

**May 26, 2026 validation checkpoint:** Phase B implementation is complete for pilot use. New syllabus reviews retain the original AI proposal and the student's first review decision, and an internal validation view reports correction rates plus an early-preparation proxy based on completing a planned session before a confirmed assessment due date. Measuring student return and usefulness still requires real university-student use; outbound reminder channels and write-access calendar synchronization remain deferred until that evidence exists.

**May 27, 2026 Calendar and Tasks checkpoint:** A new workspace calendar displays only confirmed obligation dates alongside preparation sessions and the student's own course tasks. Course tasks are stored in CourseKin, owner-scoped, manageable without external calendar permission, and covered by account export/deletion. AI-created or transcript-derived task proposals remain a gated follow-on.

### v2 Phase C: Private Course Stream and Coursework Coach

**Objective:** Let each course remember learning activity and support bounded coursework preparation.

- [x] Add the private course compilation stream foundation for typed notes and questions.
- [x] Add reflections and references to existing course files/materials in the private stream.
- [x] Add confusion inbox, cited course-material answers, and explicit course-only source separation.
- [x] Add accessible explanation modes while preserving citation grounding.
- [x] Add rubric-aware assignment coaching, draft feedback for short work, and office-hours preparation.
- [ ] Validate usefulness with adult university students across one academic term.

**May 26, 2026 course-stream checkpoint:** The first v2c slice adds an owner-scoped private stream inside each course for typed notes and questions, with editing, deletion, account export, and deletion coverage. It is a student capture surface only: saving an entry does not ask AI for an answer or send stream text for generation. Files, photos, audio/transcription, AI replies, cited Q&A, and collaboration remain staged future work.

**May 26, 2026 material-link checkpoint:** The second v2c slice adds reflection entries and allows any stream entry to reference course materials already stored as CourseKin sources, including uploaded PDFs, pasted text, or URLs. Links are owner-scoped, included in account export, and removed when an entry or its source is deleted. Direct photo/audio capture, transcription, AI answers, and collaboration remain deferred.

**May 26, 2026 confusion-inbox checkpoint:** The third v2c slice turns saved questions into an open/resolved confusion inbox. Students may explicitly request an answer only from processed materials attached to that question; answers are queued under existing quota controls and displayed only when at least one attached source chunk validates as cited evidence. The UI identifies the response as course-material-only and does not perform web lookup. Explanation modes and broader coursework coaching remain next steps.

**May 26, 2026 coursework-coach checkpoint:** The final engineered v2c slice adds student-selected explanation styles for cited answers and a separate coursework-coaching request path. Coaching is limited to guidance for confirmed light assignments, short papers, and office-hours preparation; assignment and draft requests require rubric evidence or an attached assignment brief, and all output must cite selected processed course material. The interface and terms explicitly exclude finished submissions, presentations or slide decks, thesis-level writing, complex data-heavy papers, and group-paper authorship. Real-term usefulness validation remains pending adult university-student use.

### v2 Phase D: Mastery and Proactive Preparation

**Objective:** Make the companion increasingly useful as assessments approach.

- [~] Implement attempts, scoring, mistake explanations, topic focus guidance, and spaced practice. Notebook quiz attempts, scoring, cited mistake review, and Focus Areas are implemented; validated mastery and spaced practice remain.
- [~] Add targeted reminders, preparation recommendations, meaningful streaks, and readiness indicators. Preparation prompts exist and Notebook now shows a non-readiness practice signal; validated readiness and streaks remain.
- [ ] Add adaptive practice exams after course evidence and mastery signals are reliable.
- [ ] Enable paid plans only after billing acceptance passes and paid-value hypotheses are tested.

### v2 Phase E: Gated Capture Pipeline

**Objective:** Test the differentiating lecture-to-study loop without creating an unsafe recording feature.

- [ ] Specify affirmative recording consent, visible capture controls, deletion and retention, allowed file types and duration, transcription cost limits, and institution/privacy guidance.
- [ ] Implement asynchronous audio capture or upload, Whisper transcription, transcript review, and selected AI actions after the controls above are accepted.
- [ ] Require review before transcript-extracted tasks or dates enter Calendar and Tasks.
- [ ] Measure transcription usefulness, correction rates, privacy comfort, and cost before live capture is considered.

### v3: Living Reviewer and Expansion

**Objective:** Build the ambitious evolving course artifact and consider high-complexity integrations only after v2 value is proven.

- [ ] Build the document-style living reviewer with source-linked change history.
- [ ] Expand validated asynchronous audio/OCR capture into responsive living-reviewer workflows only if v2 evidence justifies it.
- [ ] Explore LMS import once course/task/calendar behavior is stable.
- [ ] Evaluate collaboration, institutional plans, and broader student features only after retention is proven.

## v3 Backlog: Avoid Building During v2

Keep these ideas visible, but defer implementation until trusted output and mastery behavior are validated.

- [defer] Generic "chat with your PDF" as the primary product surface.
- [defer] Social feed, public marketplace, or broad creator community.
- [defer] Native iOS or Android applications before responsive web study sessions retain users.
- [defer] AI podcasts or voice tutoring before citations and mastery tracking are reliable.
- [defer] Continuous listening or live lecture assistance before the consent-governed asynchronous audio pipeline is safe, useful, and affordable.
- [defer] Full presentation or PowerPoint production before the core study and coursework companion retains students.
- [defer] Thesis-level, data-intensive, or long group-paper generation before research and collaboration requirements are defined.
- [defer] Broad personal-growth or hobby tracking before academic companion retention is proven.
- [defer] Large instructor/admin platform before a clear student retention loop exists.
- [defer] Expanding into many exam categories before validating one focused segment.

## Product Metrics to Track

### Activation

- [ ] Percentage of signed-up users who upload a source.
- [ ] Percentage who successfully generate a reviewer.
- [ ] Time from sign-up to first useful reviewer.

### Learning Engagement

- [ ] Percentage who take a quiz after generating a reviewer.
- [ ] Weekly completed practice sessions per active learner.
- [ ] Flashcard review completion and return rate.
- [ ] Improvement in weak-topic mastery over time.

### Quality and Trust

- [ ] Unsupported-content feedback rate.
- [ ] Citation click-through rate.
- [ ] Percentage of questions with sufficient cited evidence.
- [ ] User-reported accuracy and usefulness ratings.

### Business and Efficiency

- [ ] Generation cost per activated user.
- [ ] Cost per retained weekly learner.
- [ ] Free-to-paid conversion after paid launch.
- [ ] Worker latency, failure rate, cache benefit, and queue depth.

## Validation Questions Before Major Builds

- [ ] Does this feature improve exam outcomes or merely add more generated content?
- [ ] Can generated output remain cited and source-grounded?
- [ ] Can the feature be measured through retention, mastery, accuracy, or revenue?
- [ ] Does it introduce new billing, privacy, copyright, or safety obligations?
- [ ] Can it run at an acceptable model cost per active user?

## Owner Feature Ideas and Decisions

Use this section for ideas to evaluate together before implementation.

### Proposed Ideas

| Idea | Target User Problem | Differentiation Value | Effort | Priority | Decision |
| --- | --- | --- | --- | --- | --- |
| Integrate the future to-do/calendar project with syllabus obligations | Students lose track of deadlines and prepare too late | Connects planning with learning support | High | v2 delivered foundation | Calendar and private course tasks implemented; AI proposals remain next |
| Course-aware companion workspace | A one-time reviewer does not support an ongoing semester | Establishes a student-to-app relationship around each class | High | v2 direction | Accepted for v2 |
| Private per-course compilation stream | Notes, photos, files, recordings, and questions are fragmented | Creates one course memory that can produce study outputs | High | v2 direction | Accepted for v2 |
| Rubric-aware assignment coach and draft feedback | Students need help understanding and completing bounded coursework | Joins assessment requirements, planning, and learning support | High | v2 must-have | Accepted for v2 |
| Assessment runway and workload balancing | Deadlines bunch together and preparation starts too late | Enables useful proactive support across a term | High | v2 must-have | Accepted for v2 |
| Confusion inbox, reflection, and office-hours preparation | Students lose unclear points or do not know what to ask | Turns everyday uncertainty into understanding and human support | Medium | v2 direction | Accepted for v2 |
| Accessible explanation modes | Students need concepts presented in ways they can understand | Improves inclusion and usefulness of course help | Medium | v2 direction | Accepted for v2 |
| Living document-style reviewer beside the course stream | Chat outputs are harder to study and refine over time | Creates an evolving, source-linked learning document | Very high | v3 must-have direction | Schedule for v3 planning |
| Meaningful study streaks and later personal-growth features | Students need motivation beyond one assessment | Could increase consistency when tied to learning effort | Medium to high | Later exploration | Keep academic-first |
| Consent-governed audio to transcript to AI actions | Students need lecture material captured into their study workflow | Connects class experience to notes, questions, and reviewed tasks | Very high | v2 gated next | Prioritize after capture/privacy/cost controls |

### Decision Notes

- [x] Target adult university students for the first v2 validation segment.
- [x] Use syllabus-to-preparation and reviewed calendar sync as the initial v2 companion wedge.
- [x] Treat rubric-aware assignment support, assessment runway, and workload balancing as v2 must-have directions.
- [x] Include confusion capture, office-hours preparation, draft feedback for short work, source separation, and accessible learning modes in v2 scope.
- [x] Exclude a student-facing AI permission/policy tracker feature from the intended product experience.
- [x] Review the owner's to-do/calendar project and preserve compatible behavior through CourseKin-owned models.
- [x] Reorder the v2 roadmap around course foundation and the private course stream after trusted output.
- [ ] Define v2 success metrics before implementation.
- [ ] Decide what belongs in free versus paid plans.

## Market Context References

- [Quizlet AI Study Tools](https://quizlet.com/features/ai-study-tools)
- [Quizlet AI Practice Test Generator](https://quizlet.com/features/ai-test-generator)
- [Knowt AI Notes](https://knowt.com/ai-notes)
- [Knowt Learn Mode](https://knowt.com/learn-mode)
- [Google NotebookLM Student Features](https://blog.google/innovation-and-ai/models-and-research/google-labs/notebooklm-student-features/)
- [RemNote AI Flashcard Generation](https://help.remnote.com/en/articles/10102901-generating-flashcards-with-ai)
