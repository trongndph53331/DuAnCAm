from pathlib import Path

import pytest

from src.api.auth import require_admin
from src.database import BUILTIN_VIDEO_CAMERA_ID, database_connection
from src.main import app
from src.services.demo_scenario_service import demo_scenario_service


def _admin():
    return {"id": "admin", "role": "admin", "force_password_change": False}


async def _upload_and_complete(client, name: str):
    uploaded = await client.post(
        "/api/v1/cameras/demo-video",
        files={"video": ("custom.webm", b"demo-video", "video/webm")},
    )
    assert uploaded.status_code == 200
    return await client.post(
        f"/api/v1/cameras/demo-video/{uploaded.json()['upload_id']}/complete",
        json={"name": name},
    )


@pytest.fixture
def demo_scenario_metadata(tmp_path):
    original = demo_scenario_service.metadata_path
    demo_scenario_service.metadata_path = tmp_path / "demo_scenarios.json"
    try:
        yield
    finally:
        demo_scenario_service.metadata_path = original


@pytest.fixture
def admin_api():
    app.dependency_overrides[require_admin] = _admin
    try:
        yield
    finally:
        app.dependency_overrides.pop(require_admin, None)


@pytest.mark.asyncio
async def test_camera_api_exposes_exactly_one_demo_camera(client):
    listing = await client.get("/api/v1/cameras")
    assert listing.status_code == 200
    assert listing.json()["total"] == 1
    assert listing.json()["items"][0]["id"] == BUILTIN_VIDEO_CAMERA_ID
    assert (await client.delete(f"/api/v1/cameras/{BUILTIN_VIDEO_CAMERA_ID}")).status_code == 405
    assert (await client.post("/api/v1/cameras/mock")).status_code == 405


@pytest.mark.asyncio
async def test_demo_source_changes_require_admin(client, admin_api, demo_scenario_metadata):
    completed = await _upload_and_complete(client, "Kịch bản tự tải")
    scenario_id = completed.json()["scenario"]["id"]
    app.dependency_overrides.pop(require_admin, None)
    denied = await client.post("/api/v1/cameras/demo-scenario", json={"scenario_id": scenario_id})
    assert denied.status_code == 401
    app.dependency_overrides[require_admin] = _admin
    selected = await client.post("/api/v1/cameras/demo-scenario", json={"scenario_id": scenario_id})
    assert selected.status_code == 200
    assert selected.json()["id"] == BUILTIN_VIDEO_CAMERA_ID
    Path(selected.json()["source"]).unlink(missing_ok=True)


@pytest.mark.asyncio
async def test_upload_reuses_demo_camera_record(client, admin_api, demo_scenario_metadata):
    with database_connection() as connection:
        before = connection.execute("SELECT count(*) FROM cameras").fetchone()[0]
    response = await _upload_and_complete(client, "Kịch bản phòng khách")
    assert response.status_code == 200
    assert response.json()["camera"]["id"] == BUILTIN_VIDEO_CAMERA_ID
    assert response.json()["scenario"]["name"] == "Kịch bản phòng khách"
    with database_connection() as connection:
        assert connection.execute("SELECT count(*) FROM cameras").fetchone()[0] == before
        source = connection.execute(
            "SELECT source_uri, config_json FROM camera_sources WHERE camera_id = ?",
            (BUILTIN_VIDEO_CAMERA_ID,),
        ).fetchone()
    assert Path(source["source_uri"]).suffix == ".webm"
    assert source["config_json"] is not None and '"loop_video": true' in source["config_json"].lower()
    Path(source["source_uri"]).unlink(missing_ok=True)


@pytest.mark.asyncio
async def test_upload_rejects_unsupported_video(client, admin_api, demo_scenario_metadata):
    response = await client.post(
        "/api/v1/cameras/demo-video",
        files={"video": ("bad.avi", b"not-supported", "video/x-msvideo")},
    )
    assert response.status_code == 422
