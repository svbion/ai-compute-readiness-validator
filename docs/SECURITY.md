# Security Profile & Execution Constraints 🔒

This document highlights the security-conscious design principles and hard boundaries implemented in the **AI Compute Readiness Validator**.

---

## 🚫 Principle of Non-Privileged Execution (Zero Sudo)

Traditional system diagnostics tools often rely on administrative access (`sudo` or `root` permissions) to query system configurations. This tool is built specifically to operate **entirely in user space** as a non-privileged user:

*   **No Mutating System Calls**: The diagnostic engine only issues queries (`get`, `list`, `ping`). It does not invoke any state-altering operations (no `set`, `update`, `restart`).
*   **No Sudo Execution**: The runner is explicitly designed to execute commands as the invoking user. If a command requires root (e.g., querying private storage blocks or hardware registers), the collector catches the permission failure, logs it as `UNAVAILABLE` or `UNKNOWN` with a clean suggestion, and proceeds without crashing.

---

## 🛡️ Secure Shell & Command Runner (`src/ai_validator/runner.py`)

To prevent command-injection vulnerabilities (a common risk in automated scripting tools), the `CommandRunner` enforces strict execution rules:

### 1. No Shell Wrapper (`shell=False`)
All commands are executed using Python's `subprocess.Popen` with argument lists rather than raw string execution:
```python
# ❌ UNSAFE: Vulnerable to command injection
subprocess.Popen("nvidia-smi -q -i " + user_input, shell=True)

# ✅ SAFE: Arguments are passed as list elements, bypassing shell evaluation
subprocess.Popen(["nvidia-smi", "-q", "-i", sanitized_input], shell=False)
```

### 2. Standardized Timeouts
All commands are guarded by a default timeout parameter ($2.0$ seconds). This prevents the CLI from hanging indefinitely if a local daemon or network port is unresponsive.

### 3. Argument Validation & Sanitization
No raw user input is ever formatted directly into command arguments. Identifiers like node names or network interfaces are validated using strict alphanumeric regular expressions.

---

## 🧼 Output Censorship & Masking

Terminal outputs captured as `CommandEvidence` may occasionally contain sensitive environment parameters (e.g., API tokens in Kubernetes configs, local IP mappings, user accounts, or proprietary cluster identifiers).

Before storing stdout or writing report outputs, the runner passes raw text through an expansion block that:
*   Strips out standard key-value patterns matching tokens, auth certificates, or environment passwords.
*   Truncates excessively long outputs to a maximum buffer of $2000$ characters, avoiding memory bloat or log pollution.
