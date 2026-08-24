import asyncio
import re
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile
from pydantic import BaseModel

from src.api.auth import require_admin
from src.database import BUILTIN_VIDEO_CAMERA_ID
from src.services.camera_service import CameraNotFoundError, camera_service
from src.services.demo_scenario_service import demo_scenario_service

router = APIRouter(prefix="/cameras", tags=["Cameras"])
UPLOAD_DIRECTORY = Path("uploads/videos")
MAX_VIDEO_BYTES = 95 * 1024 * 1024
ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".mov", ".webm"}
class IdentityUpdate(BaseModel):
    enabled: bool


class DemoScenarioUpdate(BaseModel):
    scenario_id: str


class DemoScenarioName(BaseModel):
    name: str


def _pending_video(upload_id: str) -> Path:
    if not re.fullmatch(r"[0-9a-f]{32}", upload_id):
        raise HTTPException(status_code=404, detail="Không tìm thấy video đang chờ đặt tên")
    matches = list(UPLOAD_DIRECTORY.glob(f"pending-{upload_id}.*"))
    if len(matches) != 1 or matches[0].suffix.lower() not in ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(status_code=404, detail="Không tìm thấy video đang chờ đặt tên")
    return matches[0]


@router.get("")
async def list_cameras(request: Request):
    runtime = request.app.state.local_runtime
    cameras = camera_service.list_cameras(runtime.camera, runtime.vision, runtime.frame_hub)
    return {"items": cameras, "total": len(cameras)}


@router.get("/demo-scenarios")
async def list_demo_scenarios():
    return {"items": [{"id": item["id"], "name": item["name"]} for item in demo_scenario_service.list()]}


def _replace_demo_source(request: Request, source_path: str):
    camera_service.update_source(BUILTIN_VIDEO_CAMERA_ID, "video_file", source_path, source_path)
    runtime = request.app.state.local_runtime
    runtime.restart_camera_if_enabled(BUILTIN_VIDEO_CAMERA_ID)
    return camera_service.get_camera(BUILTIN_VIDEO_CAMERA_ID, runtime.camera, runtime.vision, runtime.frame_hub)


@router.post("/demo-scenario")
async def select_demo_scenario(
    data: DemoScenarioUpdate, request: Request, _admin: dict = Depends(require_admin)
):
    scenario = demo_scenario_service.get(data.scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy kịch bản demo")
    try:
        camera_service.resolve_video_path(scenario["source"])
        return _replace_demo_source(request, scenario["source"])
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/demo-video")
async def upload_demo_video(
    request: Request,
    video: UploadFile = File(...),
    _admin: dict = Depends(require_admin),
):
    suffix = Path(video.filename or "").suffix.lower()
    if suffix not in ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(status_code=422, detail="Chỉ hỗ trợ video MP4, MOV hoặc WebM")

    UPLOAD_DIRECTORY.mkdir(parents=True, exist_ok=True)
    upload_id = uuid4().hex
    target = UPLOAD_DIRECTORY / f"pending-{upload_id}{suffix}"
    size = 0
    try:
        with target.open("xb") as output:
            while chunk := await video.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_VIDEO_BYTES:
                    raise HTTPException(status_code=413, detail="Video vượt quá giới hạn 95 MB")
                output.write(chunk)
        if size == 0:
            raise HTTPException(status_code=422, detail="Video tải lên đang trống")

        return {"upload_id": upload_id, "filename": video.filename or target.name}
    except HTTPException:
        target.unlink(missing_ok=True)
        raise
    except Exception:
        target.unlink(missing_ok=True)
        raise
    finally:
        await video.close()


@router.post("/demo-video/{upload_id}/complete")
async def complete_demo_video(
    upload_id: str,
    data: DemoScenarioName,
    request: Request,
    _admin: dict = Depends(require_admin),
):
    name = data.name.strip()
    if not name or len(name) > 80:
        raise HTTPException(status_code=422, detail="Tên kịch bản phải có từ 1 đến 80 ký tự")
    pending = _pending_video(upload_id)
    final_path = UPLOAD_DIRECTORY / f"{uuid4().hex}{pending.suffix.lower()}"
    pending.replace(final_path)
    try:
        camera = _replace_demo_source(request, final_path.as_posix())
        scenario = demo_scenario_service.add(name, final_path.as_posix())
        return {"camera": camera, "scenario": {"id": scenario["id"], "name": scenario["name"]}}
    except Exception:
        final_path.unlink(missing_ok=True)
        raise


@router.delete("/demo-video/{upload_id}", status_code=204)
async def discard_demo_video(upload_id: str, _admin: dict = Depends(require_admin)):
    _pending_video(upload_id).unlink(missing_ok=True)


@router.get("/{camera_id}")
async def get_camera(camera_id: str, request: Request):
    try:
        runtime = request.app.state.local_runtime
        return camera_service.get_camera(camera_id, runtime.camera, runtime.vision, runtime.frame_hub)
    except CameraNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Không tìm thấy camera") from exc


@router.post("/{camera_id}/start", status_code=202)
async def start_camera(
    camera_id: str, request: Request, loop_video: bool = True, _admin: dict = Depends(require_admin)
):
    try:
        camera_service.set_camera_enabled(camera_id, True)
        return request.app.state.local_runtime.start_persisted_camera(camera_id, loop_video)
    except CameraNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Không tìm thấy camera") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/{camera_id}/stop")
async def stop_camera(camera_id: str, request: Request, _admin: dict = Depends(require_admin)):
    try:
        return request.app.state.local_runtime.set_camera_enabled(camera_id, False)
    except CameraNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Không tìm thấy camera") from exc


@router.post("/{camera_id}/vision/enable")
async def enable_camera_vision(camera_id: str, request: Request, _admin: dict = Depends(require_admin)):
    try:
        public_id = camera_service.public_id(camera_id)
    except CameraNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Không tìm thấy camera") from exc
    return request.app.state.local_runtime.set_vision_enabled(public_id, True)


@router.post("/{camera_id}/vision/disable")
async def disable_camera_vision(camera_id: str, request: Request, _admin: dict = Depends(require_admin)):
    try:
        public_id = camera_service.public_id(camera_id)
    except CameraNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Không tìm thấy camera") from exc
    return request.app.state.local_runtime.set_vision_enabled(public_id, False)


@router.get("/{camera_id}/vision/status")
async def get_camera_vision_status(camera_id: str, request: Request):
    try:
        public_id = camera_service.public_id(camera_id)
    except CameraNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Không tìm thấy camera") from exc
    return request.app.state.local_runtime.vision.get_status(public_id)


@router.patch("/{camera_id}/vision/identity")
async def set_camera_identity(
    camera_id: str, data: IdentityUpdate, request: Request, _admin: dict = Depends(require_admin)
):
    try:
        public_id = camera_service.public_id(camera_id)
    except CameraNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Không tìm thấy camera") from exc
    runtime = request.app.state.local_runtime
    if not data.enabled:
        # Persist the hard event gate before cancelling the running workflow,
        # so an already queued unknown event cannot commit during the handoff.
        camera_service.set_identity_enabled(public_id, False)
    if runtime.vision.get_status(public_id)["enabled"]:
        await asyncio.to_thread(runtime.vision.set_identity_enabled, public_id, data.enabled)
    if data.enabled:
        # Cold model preparation and runtime activation must succeed before the
        # persisted state advertises the feature as enabled.
        camera_service.set_identity_enabled(public_id, True)
    return {"camera_id": public_id, "identity_enabled": data.enabled}


@router.get("/{camera_id}/preview")
async def latest_camera_preview(camera_id: str, request: Request):
    try:
        public_id = camera_service.public_id(camera_id)
    except CameraNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Camera not found") from exc
    encoded = request.app.state.local_runtime.stream.latest_jpeg(public_id)
    if encoded is None:
        raise HTTPException(status_code=404, detail="Camera preview is not available")
    jpeg, frame_id = encoded
    return Response(
        content=jpeg,
        media_type="image/jpeg",
        headers={"Cache-Control": "no-store", "X-Frame-Id": str(frame_id)},
    )
