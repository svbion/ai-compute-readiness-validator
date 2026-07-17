#!/usr/bin/env python3
"""Sanitize collected live evidence without executing imported content."""

from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path

TOKEN_PATTERNS = [
    ("email", re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")),
    ("ssh", re.compile(r"ssh-(?:rsa|ed25519|ecdsa)\s+[A-Za-z0-9+/=]+(?:\s+\S+)?")),
    ("bearer-token", re.compile(r"(?i)(bearer\s+)[A-Za-z0-9._~+/=-]+")),
    ("secret-assignment", re.compile(r"(?i)(token|password|secret|api[_-]?key|authorization)([\s:=]+)[^\s,'\"]+")),
    ("kube-certificate", re.compile(r"(?s)-----BEGIN (?:CERTIFICATE|PRIVATE KEY)-----.*?-----END (?:CERTIFICATE|PRIVATE KEY)-----")),
    ("cloud-metadata", re.compile(r"169\.254\.169\.254|metadata\.google\.internal|latest/meta-data")),
    ("cli-secret", re.compile(r"(?i)(--(?:token|password|secret|api-key|client-secret)[=\s])[^\s]+")),
    ("env-secret", re.compile(r"(?im)^([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|KEY)[A-Z0-9_]*=).+$")),
]

IPV4 = re.compile(r"\b(?:10\.\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])|192\.168|(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-5])\.)\.?(?:\d{1,3}\.){1,2}\d{1,3}\b")
IPV6 = re.compile(r"\b(?:[A-Fa-f0-9]{1,4}:){2,7}[A-Fa-f0-9]{1,4}\b")
DOMAIN = re.compile(r"\b(?!(?:nvidia|ubuntu|github|python|example)\.)(?:[A-Za-z0-9-]+\.)+(?:local|lan|internal|corp|com|net|org|io|cloud)\b")
MAC = re.compile(r"\b[0-9A-Fa-f]{2}(?::[0-9A-Fa-f]{2}){5}\b")
SERIAL = re.compile(r"(?i)\b(serial(?:\s+number)?\s*[:=]?\s*)[A-Z0-9-]{6,}\b")
USER_PATH = re.compile(r"/(?:Users|home)/([^/\s]+)/")


def redact(text: str, args: argparse.Namespace, events: list[dict[str, str]], rel_path: str) -> str:
    def apply(kind: str, pattern: re.Pattern[str], repl: str | None = None) -> None:
        nonlocal text
        matches = list(pattern.finditer(text))
        if matches:
            events.append({"file": rel_path, "kind": kind, "count": str(len(matches))})
            text = pattern.sub(repl or f"[REDACTED_{kind.upper().replace('-', '_')}]", text)

    for kind, pattern in TOKEN_PATTERNS:
        apply(kind, pattern)
    if args.redact_ips:
        apply("ipv4", IPV4)
        apply("ipv6", IPV6)
    if args.redact_domains:
        apply("domain", DOMAIN)
    if args.redact_macs:
        apply("mac", MAC)
    if args.redact_serials:
        apply("serial", SERIAL, r"\1[REDACTED_SERIAL]")

    def user_repl(match: re.Match[str]) -> str:
        events.append({"file": rel_path, "kind": "username-path", "count": "1"})
        prefix = "/Users" if match.group(0).startswith("/Users") else "/home"
        return f"{prefix}/[REDACTED_USER]/"

    text = USER_PATH.sub(user_repl, text)
    return text


def main() -> int:
    parser = argparse.ArgumentParser(description="Sanitize GPU Validator live evidence bundles.")
    parser.add_argument("input", help="Input evidence directory")
    parser.add_argument("--output", required=True, help="Output sanitized directory")
    parser.add_argument("--redact-ips", action="store_true")
    parser.add_argument("--redact-domains", action="store_true")
    parser.add_argument("--redact-serials", action="store_true")
    parser.add_argument("--redact-macs", action="store_true")
    args = parser.parse_args()

    source = Path(args.input).resolve()
    target = Path(args.output).resolve()
    if not source.is_dir():
        raise SystemExit(f"Input directory does not exist: {source}")
    if target.exists():
        shutil.rmtree(target)
    target.mkdir(parents=True)

    events: list[dict[str, str]] = []
    for path in source.rglob("*"):
        rel = path.relative_to(source)
        out = target / rel
        if path.is_symlink():
            raise SystemExit(f"Refusing to follow symlink in evidence bundle: {rel}")
        if path.is_dir():
            out.mkdir(parents=True, exist_ok=True)
            continue
        out.parent.mkdir(parents=True, exist_ok=True)
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            shutil.copy2(path, out)
            events.append({"file": str(rel), "kind": "binary-copied", "count": "1"})
            continue
        out.write_text(redact(text, args, events, str(rel)), encoding="utf-8")

    manifest = {
        "sanitized": True,
        "source_path": str(source),
        "redaction_policy": {
            "ips": args.redact_ips,
            "domains": args.redact_domains,
            "serials": args.redact_serials,
            "macs": args.redact_macs,
            "tokens_emails_ssh_kubeconfig_env_cli_secrets_user_paths": True,
        },
        "redactions": events,
        "note": "Original sensitive values are not retained in this manifest.",
    }
    (target / "sanitization-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Sanitized evidence written to {target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
