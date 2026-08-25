import pytest

from src.config import get_settings


@pytest.mark.asyncio
async def test_demo_login_is_disabled_by_default(client):
    response = await client.post("/api/v1/auth/demo-login", json={"role": "admin"})
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_demo_login_returns_expected_roles(client, monkeypatch):
    monkeypatch.setenv("DEMO_LOGIN_ENABLED", "true")
    get_settings.cache_clear()
    try:
        for role in ("admin", "caregiver"):
            response = await client.post("/api/v1/auth/demo-login", json={"role": role})
            assert response.status_code == 200
            payload = response.json()
            assert payload["token"]
            assert payload["user"]["role"] == role
            assert payload["user"]["force_password_change"] is False
    finally:
        get_settings.cache_clear()
