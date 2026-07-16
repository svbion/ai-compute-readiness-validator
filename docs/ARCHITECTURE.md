# System Architecture 🏛️

This document describes the design patterns, data flows, and architectural boundaries of the **AI Compute Readiness Validator**.

---

## 🗺️ High-Level Design Pattern

The application is structured around a clear separation of concerns, dividing collectors, scoring logic, reporting, and visualization:

```
[System Layer] ──> [Collectors (BaseCollector)]
                         │ (Return List[ValidationCheck])
                         ▼
[Pydantic Models] ──> [Scoring Engine (ScoringEngine)]
                         │ (Applies weights & overrides)
                         ▼
                  [Report Generators] ──> [HTML, Markdown, JSON, Rich CLI, React SPA]
```

---

## 🗄️ Data Model Specifications (`src/ai_validator/models.py`)

Every entity is defined using Pydantic V2 for automatic parsing, strict runtime validation, and serialization.

### 1. `CommandEvidence`
Captures raw terminal diagnostic output from local read-only executions.
*   `command`: `List[str]` — Executable and arguments.
*   `exit_code`: `int` — Return code.
*   `duration_seconds`: `float` — Execution duration.
*   `stdout` / `stderr`: `str` — Output buffers.

### 2. `ValidationCheck`
Represents a single atomic validation check (e.g. hugepages check, ECC registers check).
*   `id`: `str` — Unique dot-separated identifier (e.g., `gpu.ecc_errors`).
*   `status`: `StatusEnum` — `pass`, `warning`, `fail`, `unknown`, `unavailable`.
*   `severity`: `SeverityEnum` — `low`, `medium`, `high`, `critical`.
*   `summary`: `str` — Plain-text human-friendly conclusion.
*   `recommendation`: `Optional[str]` — Corrective action to take if warn/fail.
*   `evidence`: `List[CommandEvidence]` — Command references.

### 3. `ValidationCategory`
Aggregates checks within a logical domain (e.g., `gpu`, `network`, `storage`).
*   `id`: `str` — Category key.
*   `weight`: `float` — Relative percentage value in scoring.
*   `checks`: `List[ValidationCheck]` — Child check containers.

### 4. `Node`
Represents an individual physical or virtual server.
*   `name`: `str` — Hostname identifier.
*   `categories`: `Dict[str, ValidationCategory]` — Subsystem categories.
*   `status`: `StatusEnum` — Collective status of the node.

---

## 📊 Scoring & Redistribution Engine (`src/ai_validator/scoring.py`)

The scoring engine is a robust, dynamic validator that prevents skewed or misleading reports.

### 1. Simple Category Evaluation
For any given category, the score is determined as:
$$\text{Category Score} = \frac{\text{Passed Checks}}{\text{Total Available Checks}} \times 100$$
Checks with status `UNAVAILABLE` are omitted from the category calculation entirely.

### 2. Dynamic Weight Redistribution
In heterogeneous clusters or local development environments, some categories may have zero active checks (e.g., no Slurm daemon running locally, or no Kubernetes API configured). Rather than penalizing the score, the engine dynamically excludes these categories and redistributes their weights proportionally to the active categories:

$$\text{Active Weights} = \{c : w_c \mid \text{Category } c \text{ has active checks}\}$$
$$\text{Total Active Weight} = \sum_{c \in \text{Active Weights}} w_c$$
$$\text{Overall Cluster Score} = \sum_{c \in \text{Active Weights}} \left( \frac{w_c}{\text{Total Active Weight}} \times \text{Category Score}_c \right)$$

This ensures that a macOS local run with only Linux & Storage active still scores a logical $100\%$ if all checks pass.

### 3. Critical Severity Overrides
An infrastructure check marked as `SeverityEnum.CRITICAL` represents a blocker for AI workload execution. If any such check fails (status `fail`), the engine activates an override:
*   The cluster's classification is immediately forced to **Remediation required** regardless of the numerical score average.
*   The failed check is bubbled up into the executive summary recommendations.
*   Critical targets include: **NVIDIA GPU ECC hardware failures**, **Slurm DRAINED states**, and **Kubernetes Node NotReady states**.
