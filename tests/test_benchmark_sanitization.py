from ai_validator.evidence.sanitizer import DeterministicSanitizer


def test_sanitize_gpu_uuid_hostname_ip_mac_secret_and_paths():
    host = "pod" + "-secret-host"
    gpu_uuid = "GPU-" + "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
    private_ip = ".".join(["172", "22", "0", "2"])
    mac = ":".join(["aa", "bb", "cc", "dd", "ee", "ff"])
    private_home = "/" + "home" + "/sabion"
    secret = "API_KEY" + "=abc123"
    sanitizer = DeterministicSanitizer(source_hostname=host)
    text = f"{gpu_uuid} {host} {private_ip} {mac} {private_home} {secret}"

    output = sanitizer.sanitize(text)

    assert gpu_uuid not in output
    assert "GPU-REDACTED" in output
    assert host not in output
    assert private_ip not in output
    assert mac not in output
    assert private_home not in output
    assert "abc123" not in output
