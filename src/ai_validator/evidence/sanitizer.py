from __future__ import annotations

import re


class DeterministicSanitizer:
    """Bundle-local deterministic sanitizer for host-identifying text."""

    _email_pattern = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
    _ipv4_pattern = re.compile(r"(?<![\w.-])(?:\d{1,3}\.){3}\d{1,3}(?![\w.-])")
    _ipv6_pattern = re.compile(
        r"(?<![\w:])(?:"
        r"(?:[0-9A-Fa-f]{1,4}:){2,7}[0-9A-Fa-f]{0,4}|"
        r"(?:[0-9A-Fa-f]{1,4}:){1,7}:|"
        r"(?:[0-9A-Fa-f]{1,4}:){1,6}:[0-9A-Fa-f]{1,4}|"
        r"(?:[0-9A-Fa-f]{1,4}:){1,5}(?::[0-9A-Fa-f]{1,4}){1,2}|"
        r"(?:[0-9A-Fa-f]{1,4}:){1,4}(?::[0-9A-Fa-f]{1,4}){1,3}|"
        r"(?:[0-9A-Fa-f]{1,4}:){1,3}(?::[0-9A-Fa-f]{1,4}){1,4}|"
        r"(?:[0-9A-Fa-f]{1,4}:){1,2}(?::[0-9A-Fa-f]{1,4}){1,5}|"
        r"[0-9A-Fa-f]{1,4}:(?:(?::[0-9A-Fa-f]{1,4}){1,6})|"
        r":(?:(?::[0-9A-Fa-f]{1,4}){1,7}|:)"
        r")(?:%[\w.-]+)?(?![\w:])"
    )
    _user_path_pattern = re.compile(r"(?P<prefix>/(?:home|Users)/)(?P<user>[A-Za-z0-9._-]+)(?=/|\b)")
    _gpu_uuid_pattern = re.compile(r"GPU-(?!REDACTED\b)[0-9A-Fa-f-]{8,}")
    _mac_pattern = re.compile(r"(?i)(?:[0-9a-f]{2}:){5}[0-9a-f]{2}")
    _secret_pattern = re.compile(r"(?i)(api[_-]?key|access[_-]?token|secret|password)\s*[:=]\s*[^\s]+")

    def __init__(self, *, source_hostname: str | None = None) -> None:
        self.source_hostname = source_hostname or ""
        self.hostname_replacements: dict[str, str] = {}
        self.ipv4_replacements: dict[str, str] = {}
        self.ipv6_replacements: dict[str, str] = {}
        self.user_replacements: dict[str, str] = {}
        self.email_replacements: dict[str, str] = {}
        if self.source_hostname:
            self.hostname_replacements[self.source_hostname] = "HOST-001"

    def display_hostname(self) -> str:
        if not self.source_hostname:
            return "HOST-001"
        return self.hostname_replacements.setdefault(self.source_hostname, "HOST-001")

    @staticmethod
    def _next(mapping: dict[str, str], prefix: str, value: str) -> str:
        if value not in mapping:
            mapping[value] = f"{prefix}-{len(mapping) + 1:03d}"
        return mapping[value]

    def sanitize(self, text: str) -> str:
        if not text:
            return ""
        sanitized = text

        if self.source_hostname:
            sanitized = sanitized.replace(self.source_hostname, self.display_hostname())

        sanitized = self._email_pattern.sub(
            lambda match: self._next(self.email_replacements, "EMAIL", match.group(0)),
            sanitized,
        )
        sanitized = self._ipv6_pattern.sub(
            lambda match: self._next(self.ipv6_replacements, "IPV6", match.group(0)),
            sanitized,
        )
        sanitized = self._ipv4_pattern.sub(
            lambda match: self._next(self.ipv4_replacements, "IPV4", match.group(0)),
            sanitized,
        )
        sanitized = self._user_path_pattern.sub(
            lambda match: f"{match.group('prefix')}{self._next(self.user_replacements, 'USER', match.group('user'))}",
            sanitized,
        )
        sanitized = self._gpu_uuid_pattern.sub("GPU-REDACTED", sanitized)
        sanitized = self._mac_pattern.sub("MAC-REDACTED", sanitized)
        sanitized = self._secret_pattern.sub(lambda match: f"{match.group(1)}=REDACTED", sanitized)
        return sanitized
