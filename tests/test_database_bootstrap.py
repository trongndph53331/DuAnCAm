import sqlite3
from pathlib import Path
from uuid import uuid4

import pytest

from src.config import get_settings
from src.database import BUILTIN_VIDEO_CAMERA_ID, DEFAULT_VIDEO_SOURCE, initialize_database
from src.services.camera_service import camera_service


@pytest.fixture
def fresh_database(tmp_path, monkeypatch):
    path = tmp_path / "fresh.sqlite3"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{path.as_posix()}")
    get_settings.cache_clear()
    try:
        yield path
    finally:
        get_settings.cache_clear()


def cameras(path: Path):
    with sqlite3.connect(path) as connection:
        connection.row_factory = sqlite3.Row
        return connection.execute(
            """SELECT c.*, cs.source_kind, cs.source_uri, cs.playback_path
               FROM cameras c LEFT JOIN camera_sources cs ON cs.camera_id = c.id ORDER BY c.name"""
        ).fetchall()


def test_fresh_database_has_one_demo_camera_and_restart_is_idempotent(fresh_database):
    initialize_database()
    initialize_database()
    rows = cameras(fresh_database)
    assert len(rows) == 1
    assert rows[0]["id"] == BUILTIN_VIDEO_CAMERA_ID
    assert rows[0]["name"] == "Camera demo"
    assert (rows[0]["source_kind"], rows[0]["source_uri"], rows[0]["playback_path"]) == (
        "video_file", DEFAULT_VIDEO_SOURCE, DEFAULT_VIDEO_SOURCE,
    )


def test_missing_demo_camera_is_recreated(fresh_database):
    initialize_database()
    with sqlite3.connect(fresh_database) as connection:
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("DELETE FROM cameras WHERE id = ?", (BUILTIN_VIDEO_CAMERA_ID,))
    initialize_database()
    assert [row["id"] for row in cameras(fresh_database)] == [BUILTIN_VIDEO_CAMERA_ID]


def test_changed_video_source_survives_restart(fresh_database):
    initialize_database()
    selected = "videos/custom-demo.mp4"
    with sqlite3.connect(fresh_database) as connection:
        connection.execute(
            "UPDATE camera_sources SET source_uri = ?, playback_path = ? WHERE camera_id = ?",
            (selected, selected, BUILTIN_VIDEO_CAMERA_ID),
        )
    initialize_database()
    row = cameras(fresh_database)[0]
    assert (row["source_uri"], row["playback_path"]) == (selected, selected)


def test_old_camera_is_archived_without_deleting_history(fresh_database):
    initialize_database()
    old_id = str(uuid4())
    event_id = str(uuid4())
    with sqlite3.connect(fresh_database) as connection:
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute(
            """INSERT INTO cameras (id,name,source_type,source_reference,location_label,is_active)
               VALUES (?, 'Camera cũ', 'webcam', '2', 'Kho', 0)""", (old_id,),
        )
        connection.execute(
            """INSERT INTO events (id,camera_id,event_type,occurred_at,ai_model_name,ai_model_version)
               VALUES (?, ?, 'person_detected', '2026-01-01T00:00:00Z', 'demo', '1')""",
            (event_id, old_id),
        )
    initialize_database()
    with sqlite3.connect(fresh_database) as connection:
        assert connection.execute("SELECT is_archived FROM cameras WHERE id = ?", (old_id,)).fetchone()[0] == 1
        assert connection.execute("SELECT camera_id FROM events WHERE id = ?", (event_id,)).fetchone()[0] == old_id
    assert [item["id"] for item in camera_service.list_cameras()] == [BUILTIN_VIDEO_CAMERA_ID]


def test_camera_identity_setting_persists_without_overwriting_other_config(fresh_database):
    initialize_database()
    with sqlite3.connect(fresh_database) as connection:
        connection.execute(
            "UPDATE camera_sources SET config_json = ? WHERE camera_id = ?",
            ('{"loop_video":false}', BUILTIN_VIDEO_CAMERA_ID),
        )
    camera_service.set_identity_enabled(BUILTIN_VIDEO_CAMERA_ID, True)
    initialize_database()
    desired = camera_service.desired_states()[0]
    assert desired["identity_enabled"] is True
    assert desired["loop_video"] is False
