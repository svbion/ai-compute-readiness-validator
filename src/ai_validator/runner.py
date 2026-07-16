import re
import time
import subprocess
from datetime import datetime
from typing import List, Optional
from ai_validator.models import CommandEvidence

# Sensitive patterns to sanitize
SENSITIVE_PATTERNS = [
    (re.compile(r"(bearer\s+)[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*", re.IGNORECASE), r"\1[REDACTED_JWT]"),
    (re.compile(r"(password|token|secret|key|passwd)([\"'\s]*[:=][\"'\s]*)[^\s\"'\n,]+", re.IGNORECASE), r"\1\2[REDACTED]"),
    (re.compile(r"(--password|--token|--api-key|--secret-key)([\s=])[^\s\"'\n]+", re.IGNORECASE), r"\1\2[REDACTED]"),
]

def sanitize_output(text: str) -> str:
    """Redacts passwords, tokens, keys, and authorization details from logs and stdout."""
    if not text:
        return ""
    sanitized = text
    for pattern, replacement in SENSITIVE_PATTERNS:
        sanitized = pattern.sub(replacement, sanitized)
    return sanitized

class CommandRunner:
    """Centralized read-only command runner with standard safety guarantees."""

    @staticmethod
    def run_command(args: List[str], timeout: float = 10.0) -> CommandEvidence:
        """
        Executes a command safely using list notation.
        Handles missing utilities, execution timeouts, permission errors, and sanitization.
        """
        start_time = time.time()
        timestamp = datetime.utcnow()
        
        # Enforce no-mutation check (defensive block)
        mutation_keywords = {"install", "remove", "purge", "restart", "stop", "reboot", "shutdown", "sudo", "chown", "chmod", "rm", "mv"}
        intersection = set(args).intersection(mutation_keywords)
        if intersection:
            return CommandEvidence(
                command=args,
                exit_code=126,
                duration_seconds=0.0,
                stdout="",
                stderr=f"Security Alert: Command execution blocked. Contains mutating keywords: {list(intersection)}",
                timestamp=timestamp
            )

        try:
            # shell=False is enforced implicitly by passing args list directly
            result = subprocess.run(
                args,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=timeout,
                shell=False
            )
            duration = time.time() - start_time
            return CommandEvidence(
                command=args,
                exit_code=result.returncode,
                duration_seconds=round(duration, 3),
                stdout=sanitize_output(result.stdout),
                stderr=sanitize_output(result.stderr),
                timestamp=timestamp
            )
        except FileNotFoundError:
            # Command not found
            duration = time.time() - start_time
            return CommandEvidence(
                command=args,
                exit_code=127,
                duration_seconds=round(duration, 3),
                stdout="",
                stderr=f"Command '{args[0]}' was not found on this system.",
                timestamp=timestamp
            )
        except subprocess.TimeoutExpired:
            duration = time.time() - start_time
            return CommandEvidence(
                command=args,
                exit_code=-1,
                duration_seconds=round(duration, 3),
                stdout="",
                stderr=f"Command '{args[0]}' execution timed out after {timeout} seconds.",
                timestamp=timestamp
            )
        except PermissionError as pe:
            duration = time.time() - start_time
            return CommandEvidence(
                command=args,
                exit_code=13,
                duration_seconds=round(duration, 3),
                stdout="",
                stderr=f"Permission Denied running command '{args[0]}': {str(pe)}",
                timestamp=timestamp
            )
        except Exception as e:
            duration = time.time() - start_time
            return CommandEvidence(
                command=args,
                exit_code=-2,
                duration_seconds=round(duration, 3),
                stdout="",
                stderr=f"Error executing command '{args[0]}': {str(e)}",
                timestamp=timestamp
            )
