# GPUValidator Engineering Principles

Version: 1.0
Status: Canonical Engineering Standard
Owner: Sabion P. Frazier

## Engineering Goal

Build GPUValidator as a maintainable, testable, secure, technically accurate platform for AI infrastructure operations.

GPUValidator engineering should preserve evidence-grounded behavior, explicit unknown states, safe defaults, approval-gated remediation, accurate topology representation, and clear public/private evidence boundaries.

## Scope Discipline

Each engineering session should implement one independently reviewable story.

Agents must not combine unrelated:

- architecture
- frontend
- backend
- database
- documentation
- deployment
- product redesign

unless the story explicitly requires those areas.

Prefer the smallest complete change that satisfies the story and can be reviewed independently.

## Agent Workflow

Required process:

1. start from a known branch or worktree
2. inspect git status
3. read canonical documents
4. identify the exact story boundary
5. inspect only relevant files
6. implement the smallest complete change
7. run focused tests
8. run build or type checks
9. inspect the diff
10. report exact files changed
11. stop before commit unless authorized
12. obtain human review before merge

## Required Canonical Reads

Future Hermes stories should normally read:

- docs/VISION_2027.md
- docs/DESIGN_SYSTEM.md for UI work
- docs/ENGINEERING_PRINCIPLES.md
- only the architecture or story document directly relevant to the task

Do not perform broad documentation scans unless the task is documentation-specific.

Canonical terminology for future stories includes Mission Control, AI Factory, Topology Explorer, Validation Workspace, Benchmark Intelligence, Investigation Workspace, Evidence Explorer, AI Copilot, and Approval Workflow. Use these terms consistently unless a story explicitly changes the product language.

## Context Management

- Use a fresh agent session for each story.
- Avoid inheriting giant prior context.
- Do not load the entire repository.
- Limit initial discovery to directly relevant files.
- Use exact searches before broad searches.
- Avoid generated directories.
- Avoid virtual environments.
- Avoid node_modules.
- Avoid dist.
- Avoid unrelated tests.
- Summarize findings before implementation.
- Preserve exact terminology from canonical documents and relevant source files.

## Git Safety

- Never use git add . on a dirty multi-purpose worktree.
- Stage exact files.
- Inspect staged diff.
- Separate Phase A, UI, documentation, and unrelated changes.
- Do not rewrite shared history.
- Do not delete unrelated work.
- Do not commit secrets or runtime artifacts.
- Use focused commit messages.
- Preserve clean PR boundaries.
- Do not commit or push without explicit authorization.

## Data Integrity

- Label demo, fixture, synthetic, reference, and live data distinctly.
- Never fabricate telemetry.
- Never silently substitute demo data for live data.
- Preserve source provenance.
- Sanitize benchmark packages and logs.
- Avoid secrets, hostnames, tokens, credentials, and internal identifiers.
- Validate external input.
- Retain evidence references.
- Use explicit unknown, unavailable, partial, planned, and blocked states when evidence is incomplete.

## Technical Accuracy

GPUValidator must accurately distinguish among:

- NVLink
- NVSwitch
- PCIe
- InfiniBand
- Ethernet
- RDMA
- NCCL
- MPI
- Slurm
- Kubernetes
- storage
- GPU health
- benchmark performance

Do not simplify concepts into misleading diagrams or labels. In particular, do not place InfiniBand between GPUs, represent NVSwitch as an external cluster switch, or imply exact cabling without source data.

## Frontend Principles

- Build focused components.
- Avoid unnecessary App.tsx growth.
- Do not add heavy dependencies without justification.
- Support accessible interaction.
- Respect reduced motion.
- Preserve responsive behavior.
- Do not present unavailable telemetry as live state.
- Test visible contracts.
- Preserve existing routes unless authorized.
- Reuse design tokens and components.
- Keep evidence close to conclusions.
- Preserve current black and graphite surfaces, restrained green accent, and semantic status colors unless a story explicitly changes the design system.

## Backend Principles

- Use explicit schemas.
- Prefer deterministic parsing.
- Validate at boundaries.
- Use typed models.
- Provide clear error handling.
- Make ingestion idempotent where possible.
- Preserve auditability.
- Use safe defaults.
- Do not perform destructive operations without authorization.
- Preserve API compatibility or use versioning.
- Treat credentials, benchmark packages, logs, paths, and archives as untrusted inputs.

## AI and Copilot Principles

- Output must be evidence-grounded.
- Uncertainty must be explicit.
- Confidence must be visible.
- Evidence must be traceable.
- Do not invent a root cause.
- Do not perform unapproved remediation.
- Output must distinguish observation, inference, recommendation, and action.
- Commands must include risk and approval context.
- If evidence is insufficient, the Copilot should ask for evidence or state the limitation rather than filling the gap.

## Testing Standards

Use appropriate combinations of:

- lint
- type checking
- focused unit tests
- contract tests
- parser tests
- build validation
- accessibility checks
- regression tests
- git diff --check
- manual visual review for UI
- sanitized fixture validation

Do not run every suite when a focused suite is sufficient, but run broader checks before merge or release. Do not claim validation that was not run.

## Security Principles

- Apply least privilege.
- Never commit secrets.
- Sanitize logs and benchmark packages.
- Validate paths.
- Avoid arbitrary command execution.
- Require approval for infrastructure mutation.
- Preserve auditable actions.
- Respect authentication and authorization boundaries.
- Do not expose raw sensitive environment values.
- Reject unsafe archive members, path traversal, and untrusted file operations.

## Definition of Done

A story is done only when:

- acceptance criteria are met
- tests pass
- build passes when applicable
- technical accuracy is reviewed
- accessibility is considered
- demo/live labeling is correct
- diff is scoped
- documentation is updated only when necessary
- human review is complete

For local agent work, stop before commit unless the user explicitly authorizes committing.

## Prohibited Agent Behaviors

- implementing multiple epics in one run
- broad repository rediscovery
- changing unrelated files
- inventing missing requirements
- fabricating data
- silently weakening tests
- deleting tests to pass
- committing or pushing without authorization
- using git add .
- claiming validation that was not run
- declaring production readiness without evidence
- implying live integrations or exact topology when source data is unavailable
- modifying package files, tests, CI, or application code during documentation-only stories

## Story Prompt Template

Read first:
- docs/VISION_2027.md
- docs/ENGINEERING_PRINCIPLES.md
- docs/DESIGN_SYSTEM.md when applicable

Story:
[ID and title]

Objective:
[one outcome]

Allowed scope:
[files or area]

Out of scope:
[explicit exclusions]

Acceptance criteria:
[measurable criteria]

Validation:
[focused commands]

Do not commit.
Do not push.
Stop after local validation.
