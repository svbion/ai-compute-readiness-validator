import json
from pathlib import Path
from typer.testing import CliRunner

from ai_validator.cli import app

runner = CliRunner()


def test_bootstrap_admin_persists_hash_and_refuses_second_admin(tmp_path: Path, monkeypatch) -> None:
    store = tmp_path / "users.json"
    password_file = tmp_path / "admin-password.txt"
    password_file.write_text("StrongBootstrap-123!\n", encoding="utf-8")
    monkeypatch.setenv("AI_VALIDATOR_USER_STORE", str(store))

    result = runner.invoke(app, ["users", "bootstrap-admin", "--username", "AdminUser", "--display-name", "Admin User", "--password-file", str(password_file)])
    assert result.exit_code == 0, result.output
    assert "StrongBootstrap" not in result.output
    data = json.loads(store.read_text(encoding="utf-8"))
    assert data["users"][0]["username"] == "adminuser"
    assert data["users"][0]["password_hash"].startswith("scrypt$")
    assert "StrongBootstrap-123!" not in store.read_text(encoding="utf-8")

    refused = runner.invoke(app, ["users", "bootstrap-admin", "--username", "otheradmin", "--display-name", "Other Admin", "--password-file", str(password_file)])
    assert refused.exit_code != 0
    assert "already exists" in refused.output
