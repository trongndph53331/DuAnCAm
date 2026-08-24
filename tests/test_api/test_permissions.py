from datetime import datetime
from uuid import uuid4

import pytest

from src.api.auth import current_user
from src.database import BUILTIN_VIDEO_CAMERA_ID, database_connection
from src.main import app
from src.models.schemas import VisionEventRequest
from src.services.auth_service import auth_service, hash_password
from src.services.event_service import event_service

ALL_PERMISSIONS = (
    "view_history", "acknowledge_alerts", "resolve_alerts",
    "manage_cameras", "manage_family", "manage_users",
)


def create_caregiver() -> tuple[str, dict[str, str]]:
    user_id = str(uuid4())
    email = f"permission-{user_id}@example.test"
    password = "SecurePass@123"
    with database_connection() as connection:
        connection.execute(
            """INSERT INTO users
               (id,email,display_name,role,password_hash,force_password_change)
               VALUES (?,?,'Permission Caregiver','caregiver',?,0)""",
            (user_id, email, hash_password(password)),
        )
        connection.execute("UPDATE user_permissions SET is_granted = 0 WHERE user_id = ?", (user_id,))
    token, _ = auth_service.login(email, password, False)
    return user_id, {"Authorization": f"Bearer {token}"}


def set_permission(user_id: str, permission: str, granted: bool) -> None:
    with database_connection() as connection:
        connection.execute(
            "UPDATE user_permissions SET is_granted = ? WHERE user_id = ? AND permission_key = ?",
            (int(granted), user_id, permission),
        )


@pytest.fixture
def real_auth():
    default = app.dependency_overrides.pop(current_user)
    try:
        yield
    finally:
        app.dependency_overrides[current_user] = default


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("permission", "method", "path", "payload"),
    [
        ("view_history", "GET", "/api/v1/history", None),
        ("manage_family", "GET", "/api/v1/persons", None),
        ("manage_cameras", "POST", f"/api/v1/cameras/{BUILTIN_VIDEO_CAMERA_ID}/stop", None),
    ],
)
async def test_permission_is_enforced_and_revocation_is_immediate(
    client, real_auth, permission, method, path, payload
):
    user_id, headers = create_caregiver()
    denied = await client.request(method, path, json=payload, headers=headers)
    assert denied.status_code == 403
    assert denied.json() == {"detail": "Bạn không có quyền truy cập chức năng này"}

    set_permission(user_id, permission, True)
    assert (await client.request(method, path, json=payload, headers=headers)).status_code < 400
    assert (await client.get("/api/v1/auth/me", headers=headers)).json()["permissions"][permission] is True

    set_permission(user_id, permission, False)
    assert (await client.request(method, path, json=payload, headers=headers)).status_code == 403
    assert (await client.get("/api/v1/auth/me", headers=headers)).json()["permissions"][permission] is False


@pytest.mark.asyncio
async def test_alert_permissions_are_separate_and_current(client, real_auth):
    user_id, headers = create_caregiver()
    accepted = await event_service.create(
        VisionEventRequest(
            event_id=f"permission-alert-{uuid4()}", camera_id="camera-permission",
            camera_location="Phòng test", event_type="FALL_SUSPECTED",
            occurred_at=datetime.now().astimezone(), confidence=0.9, track_id="permission-track",
        )
    )
    assert (await client.patch(f"/api/v1/alerts/{accepted.id}", json={"status": "checking"}, headers=headers)).status_code == 403
    set_permission(user_id, "acknowledge_alerts", True)
    assert (await client.patch(f"/api/v1/alerts/{accepted.id}", json={"status": "checking"}, headers=headers)).status_code == 200
    assert (await client.patch(f"/api/v1/alerts/{accepted.id}", json={"status": "safe"}, headers=headers)).status_code == 403
    set_permission(user_id, "resolve_alerts", True)
    assert (await client.patch(f"/api/v1/alerts/{accepted.id}", json={"status": "safe"}, headers=headers)).status_code == 200


@pytest.mark.asyncio
async def test_caregiver_cannot_grant_permissions_even_with_spoofed_claims(client, real_auth):
    user_id, headers = create_caregiver()
    set_permission(user_id, "manage_users", True)
    target_id, _ = create_caregiver()
    spoofed = headers | {"X-Role": "admin", "X-Permissions": "manage_users"}
    response = await client.patch(
        f"/api/v1/settings/users/{target_id}/permissions/manage_users",
        json={"granted": True, "role": "admin", "user_id": user_id},
        headers=spoofed,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_unauthenticated_is_401_and_admin_bypasses_permissions(client, real_auth):
    assert (await client.get("/api/v1/history")).status_code == 401
    app.dependency_overrides[current_user] = lambda: {
        "id": "admin", "role": "admin", "force_password_change": False,
        "permissions": {permission: False for permission in ALL_PERMISSIONS},
    }
    try:
        assert (await client.get("/api/v1/history")).status_code == 200
        assert (await client.get("/api/v1/persons")).status_code == 200
    finally:
        app.dependency_overrides.pop(current_user, None)
