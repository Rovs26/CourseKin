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
- [ ] Add incident response contacts and production alert recipients.
- [ ] Run a launch security review before paid traffic.

## v2: Prioritized Product Upgrades

### P1: Trusted Study Output

Goal: make every generated study artifact reliable and defensible.

- [ ] Add citations to each generated item: source ID, page/chunk reference, and supporting excerpt.
- [ ] Add `View source` interactions for summary paragraphs, flashcards, Q&A, and quiz rationales.
- [ ] Add evidence states such as `supported`, `weak support`, and `not found in source`.
- [ ] Separate class/course evidence, student notes, external web references, and AI explanations in every generated output.
- [ ] Include source citations in exported reviewer PDFs.
- [ ] Add user feedback controls: accurate, unsupported, unclear, or incorrect.
- [ ] Track feedback so prompts and generation quality can be improved.

**Why first:** Basic AI generation is common. Source-linked output creates trust and is required for serious exam preparation.

### P2: Course Workspace and Semester Planning

Goal: establish the ongoing student-to-course relationship and prevent last-minute preparation.

- [ ] Evolve the current project concept into a course-oriented workspace without breaking existing reviewer flows.
- [ ] Let students add a syllabus and class schedule to each course.
- [ ] Extract assessments, light assignments, projects, deadlines, rubrics, topic coverage, and uncertain fields.
- [ ] Require student review and correction before tasks or calendar entries are synchronized.
- [x] Review the owner's to-do/calendar system and record reusable behavior patterns and architecture boundaries.
- [ ] Implement CourseKin-owned confirmed task, milestone, reminder, and calendar-export capabilities based on the reviewed patterns.
- [ ] Add an assessment runway showing due dates, readiness, missing materials, and recommended preparation.
- [ ] Add a workload balancer that distributes preparation and bounded project steps across the available term.

**First validation wedge:** An adult university student uploads a syllabus, confirms extracted obligations, and receives a realistic preparation plan before the first assessment.

### P3: Private Course Stream and Course Memory

Goal: keep the student's actual learning journey organized inside each course.

- [ ] Add a private chronological course stream between the student and AI.
- [ ] Support typed notes, questions, uploaded readings, and references to assessments or rubric items.
- [ ] Add a confusion inbox and learning reflection prompts inside the stream.
- [ ] Add citation-grounded course Q&A with accessible learning modes such as simpler explanation, analogy, worked example, and practice prompt.
- [ ] Let students select accumulated stream content when generating summaries, reviewers, flashcards, or preparation plans.
- [ ] Add OCR/photo and audio/transcript inputs only through staged privacy- and quality-reviewed releases.

**Important boundary:** This stream is course memory and learning interaction, not an early social network or public chat.

### P4: Coursework and Preparation Coach

Goal: support bounded assignments and short papers without expanding prematurely into heavy content production.

- [ ] Add a rubric-aware assignment coach that extracts deliverables, dates, criteria, formatting expectations, and a completion checklist.
- [ ] Connect confirmed assignment milestones to task planning and workload balancing.
- [ ] Add draft feedback mode for light assignments and short papers: requirement coverage, clarity, missing support, and revision guidance.
- [ ] Add office-hours preparation from confusion items, weak topics, and draft blockers.
- [ ] Clearly communicate product limits for presentations, thesis-level work, complex data-heavy papers, and undefined group-authoring workflows.
- [ ] Do not build a restrictive course AI-permission tracking feature as part of the student experience.

### P5: Learning and Mastery Loop

Goal: move from collected course content to measurable learning improvement.

- [ ] Store quiz attempts, answers, scores, and time spent.
- [ ] Add explanations for wrong answers with citations to original material.
- [ ] Automatically create remedial flashcards from missed questions.
- [ ] Track mastery by topic or concept.
- [ ] Add a weak-topics view and recommended next actions.
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

- [ ] Store source chunks with stable identifiers and page references.
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

## Recommended Version Roadmap

### v1 Release Gate: Launch Confidence

**Objective:** Safely deploy the hardened baseline and begin controlled testing.

- [ ] Finish production infrastructure and provider acceptance checks.
- [ ] Deploy API, worker, frontend, database, shared limiter, and storage.
- [ ] Keep paid billing disabled while testing with invited users.
- [ ] Collect feedback on reviewer accuracy, usability, and generation latency.

### v2 Phase A: Evidence-Linked Reviewers

**Objective:** Make CourseKin noticeably more trustworthy than basic AI generators.

- [ ] Implement source chunk/page indexing.
- [ ] Add citations and source highlighting for generated content.
- [ ] Include citations in exports.
- [ ] Capture accuracy feedback from users.

### v2 Phase B: Course Foundation and Semester Planning

**Objective:** Move from one-time reviewer generation into an ongoing, useful course relationship.

- [ ] Add course workspaces, class schedules, syllabus ingestion, and confirmed obligation extraction.
- [ ] Review the owner's to-do/calendar project and integrate only after its shared-domain boundaries are clear.
- [ ] Add reviewed calendar synchronization, assessment runway, and workload balancing.
- [ ] Measure confirmed syllabus extraction accuracy and student return before upcoming assessments.

### v2 Phase C: Private Course Stream and Coursework Coach

**Objective:** Let each course remember learning activity and support bounded coursework preparation.

- [ ] Add the private course compilation stream for notes, questions, files, and reflections.
- [ ] Add confusion inbox, cited course answers, accessible explanation modes, and source separation.
- [ ] Add rubric-aware assignment coaching, draft feedback for short work, and office-hours preparation.
- [ ] Validate usefulness with adult university students across one academic term.

### v2 Phase D: Mastery and Proactive Preparation

**Objective:** Make the companion increasingly useful as assessments approach.

- [ ] Implement attempts, scoring, mistake explanations, weak-topic mastery, and spaced practice.
- [ ] Add targeted reminders, preparation recommendations, meaningful streaks, and readiness indicators.
- [ ] Add adaptive practice exams after course evidence and mastery signals are reliable.
- [ ] Enable paid plans only after billing acceptance passes and paid-value hypotheses are tested.

### v3: Living Reviewer and Expansion

**Objective:** Build the ambitious evolving course artifact and consider high-complexity integrations only after v2 value is proven.

- [ ] Build the document-style living reviewer with source-linked change history.
- [ ] Add OCR/photo workflows and later consent-governed transcription if demand justifies it.
- [ ] Explore LMS import once course/task/calendar behavior is stable.
- [ ] Evaluate collaboration, institutional plans, and broader student features only after retention is proven.

## v3 Backlog: Avoid Building During v2

Keep these ideas visible, but defer implementation until trusted output and mastery behavior are validated.

- [defer] Generic "chat with your PDF" as the primary product surface.
- [defer] Social feed, public marketplace, or broad creator community.
- [defer] Native iOS or Android applications before responsive web study sessions retain users.
- [defer] AI podcasts or voice tutoring before citations and mastery tracking are reliable.
- [defer] Lecture audio/video ingestion before document-based workflows show repeated demand.
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
| Integrate the future to-do/calendar project with syllabus obligations | Students lose track of deadlines and prepare too late | Connects planning with learning support | To assess after project review | Discovery | Preserve for evaluation |
| Course-aware companion workspace | A one-time reviewer does not support an ongoing semester | Establishes a student-to-app relationship around each class | High | v2 direction | Accepted for v2 |
| Private per-course compilation stream | Notes, photos, files, recordings, and questions are fragmented | Creates one course memory that can produce study outputs | High | v2 direction | Accepted for v2 |
| Rubric-aware assignment coach and draft feedback | Students need help understanding and completing bounded coursework | Joins assessment requirements, planning, and learning support | High | v2 must-have | Accepted for v2 |
| Assessment runway and workload balancing | Deadlines bunch together and preparation starts too late | Enables useful proactive support across a term | High | v2 must-have | Accepted for v2 |
| Confusion inbox, reflection, and office-hours preparation | Students lose unclear points or do not know what to ask | Turns everyday uncertainty into understanding and human support | Medium | v2 direction | Accepted for v2 |
| Accessible explanation modes | Students need concepts presented in ways they can understand | Improves inclusion and usefulness of course help | Medium | v2 direction | Accepted for v2 |
| Living document-style reviewer beside the course stream | Chat outputs are harder to study and refine over time | Creates an evolving, source-linked learning document | Very high | v3 must-have direction | Schedule for v3 planning |
| Meaningful study streaks and later personal-growth features | Students need motivation beyond one assessment | Could increase consistency when tied to learning effort | Medium to high | Later exploration | Keep academic-first |

### Decision Notes

- [x] Target adult university students for the first v2 validation segment.
- [x] Use syllabus-to-preparation and reviewed calendar sync as the initial v2 companion wedge.
- [x] Treat rubric-aware assignment support, assessment runway, and workload balancing as v2 must-have directions.
- [x] Include confusion capture, office-hours preparation, draft feedback for short work, source separation, and accessible learning modes in v2 scope.
- [x] Exclude a student-facing AI permission/policy tracker feature from the intended product experience.
- [ ] Review the owner's to-do/calendar project when it is provided before choosing an integration design.
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
