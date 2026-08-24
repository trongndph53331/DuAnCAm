import {
  AlertTriangle,
  Box,
  CameraOff,
  Check,
  ChevronRight,
  Expand,
  Minimize,
  RefreshCw,
  ShieldCheck,
  Upload,
  UserSearch,
  Video,
  Wifi,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  completeDemoVideo,
  discardDemoVideo,
  getCamera,
  getCameras,
  getDemoScenarios,
  selectDemoScenario,
  setCameraIdentity,
  uploadDemoVideo,
  type CameraDto,
  type CameraEventDto,
  type DemoScenarioDto,
  type PendingDemoUploadDto,
} from "../api/cameras";
import { CameraStream } from "../components";
import "./cameraViewer.css";
import "./cameraApi.css";
import "./cameraTheme.css";

export default function CameraPage({ isAdmin }: { isAdmin: boolean }) {
  const [feeds, setFeeds] = useState<CameraDto[]>([]);
  const [selectedId, setSelectedId] = useState(
    () => new URLSearchParams(window.location.search).get("camera") ?? "",
  );
  const [events, setEvents] = useState<CameraEventDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [scenarios, setScenarios] = useState<DemoScenarioDto[]>([]);
  const [scenarioId, setScenarioId] = useState("");
  const [scenarioName, setScenarioName] = useState("");
  const [pendingUpload, setPendingUpload] = useState<PendingDemoUploadDto | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);
  const camerasRequestInFlight = useRef(false);
  const [showBoxes, setShowBoxes] = useState(
    () => localStorage.getItem("camera.showBoxes") !== "false",
  );
  const [recognitionEnabled, setRecognitionEnabled] = useState(false);
  const [identitySaving, setIdentitySaving] = useState(false);

  const load = async () => {
    if (camerasRequestInFlight.current) return;
    camerasRequestInFlight.current = true;
    setLoading(true);
    setError(false);
    try {
      const items = await getCameras();
      setFeeds(items);
      setSelectedId((current) =>
        items.some((item) => item.id === current)
          ? current
          : items[0]?.id || "",
      );
    } catch {
      setError(true);
    } finally {
      camerasRequestInFlight.current = false;
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
    void getDemoScenarios().then(setScenarios).catch(() => setScenarios([]));
  }, []);
  useEffect(() => {
    const sync = () => void load();
    window.addEventListener("camera-settings-updated", sync);
    return () => window.removeEventListener("camera-settings-updated", sync);
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (
        document.visibilityState !== "visible" ||
        camerasRequestInFlight.current
      )
        return;
      camerasRequestInFlight.current = true;
      void getCameras()
        .then(setFeeds)
        .catch(() => undefined)
        .finally(() => {
          camerasRequestInFlight.current = false;
        });
    }, 5_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const sync = () =>
      setFullscreen(document.fullscreenElement === viewerRef.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  useEffect(() => {
    if (!selectedId) return;
    getCamera(selectedId)
      .then((camera) => setEvents(camera.events ?? []))
      .catch(() => setEvents([]));
  }, [selectedId]);

  const selected = feeds.find((feed) => feed.id === selectedId);
  useEffect(() => {
    setRecognitionEnabled(Boolean(selected?.identity_enabled));
  }, [selected?.id, selected?.identity_enabled]);
  const todayEvents = events.filter((event) => isToday(event.occurred_at));
  const eventGroups = useMemo(
    () =>
      Array.from(
        todayEvents
          .reduce(
            (groups, event) =>
              groups.set(event.event_type, {
                label: event.title,
                count: (groups.get(event.event_type)?.count ?? 0) + 1,
              }),
            new Map<string, { label: string; count: number }>(),
          )
          .values(),
      ),
    [todayEvents],
  );
  const offline = !selected || selected.status !== "online";
  const navigate = (path: string) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };
  const toggleFullscreen = () =>
    void (document.fullscreenElement
      ? document.exitFullscreen()
      : viewerRef.current?.requestFullscreen());
  const toggleBoxes = (enabled: boolean) => {
    setShowBoxes(enabled);
    localStorage.setItem("camera.showBoxes", String(enabled));
  };
  const toggleRecognition = async (enabled: boolean) => {
    if (identitySaving || !selected) return;
    setIdentitySaving(true);
    setRecognitionEnabled(enabled);
    try {
      await setCameraIdentity(selected.id, enabled);
      await load();
    } catch {
      setRecognitionEnabled(!enabled);
    } finally {
      setIdentitySaving(false);
    }
  };
  const changeScenario = async () => {
    if (!scenarioId || saving) return;
    setActionError("");
    setSaving(true);
    try {
      await selectDemoScenario(scenarioId);
      await load();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Không thể đổi kịch bản demo.");
    } finally {
      setSaving(false);
    }
  };
  const uploadVideo = async (file?: File) => {
    if (!file || saving) return;
    setActionError("");
    setSaving(true);
    try {
      const uploaded = await uploadDemoVideo(file);
      setPendingUpload(uploaded);
      setScenarioName(file.name.replace(/\.[^.]+$/, ""));
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Không thể tải video lên.");
    } finally {
      setSaving(false);
    }
  };
  const nameUploadedVideo = async () => {
    const name = scenarioName.trim();
    if (!pendingUpload || !name || saving) return;
    setActionError("");
    setSaving(true);
    try {
      const result = await completeDemoVideo(pendingUpload.upload_id, name);
      setScenarios(await getDemoScenarios());
      setScenarioId(result.scenario.id);
      setPendingUpload(null);
      setScenarioName("");
      await load();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Không thể lưu tên kịch bản.");
    } finally {
      setSaving(false);
    }
  };
  const cancelUploadedVideo = async () => {
    if (!pendingUpload || saving) return;
    await discardDemoVideo(pendingUpload.upload_id).catch(() => undefined);
    setPendingUpload(null);
    setScenarioName("");
  };

  if (loading)
    return (
      <div className="camera-api-state">
        <ShieldCheck />
        <strong>Đang tải camera từ Local Hub…</strong>
      </div>
    );
  if (error)
    return (
      <div className="camera-api-state error">
        <CameraOff />
        <strong>Không kết nối được backend</strong>
        <button onClick={load}>
          <RefreshCw /> Thử lại
        </button>
      </div>
    );
  if (!selected)
    return (
      <div className="camera-api-state">
        <CameraOff />
        <strong>Chưa có camera nào được cấu hình</strong>
      </div>
    );

  return (
    <section className="smart-camera-page">
      <header className="smart-camera-heading">
        <div>
          <p>Không gian của bạn</p>
          <h1>Camera</h1>
        </div>
        <span>
          <ShieldCheck />{" "}
          {feeds.filter((item) => item.status === "online").length}/
          {feeds.length} camera trực tuyến
        </span>
      </header>
      <div className="smart-viewer-shell">
        <div className="camera-stage-grid">
          <div
            className="smart-camera-viewer"
            key={selected.id}
            ref={viewerRef}
          >
            <CameraStream
              cameraId={selected.id}
              streamReady={selected.stream_ready}
              streamUrl={selected.stream_url}
              showBoxes={showBoxes}
              showIdentity={recognitionEnabled}
            />
            {selected.status === "connecting" ||
            (selected.status === "online" && !selected.stream_ready) ? (
              <div className="camera-stream-skeleton" role="status">
                <span />
                <strong>Đang kết nối luồng camera…</strong>
              </div>
            ) : null}
            {selected.source_kind === "rtsp" &&
              !selected.playback_url &&
              !offline && (
                <div className="smart-camera-offline">
                  <Wifi />
                  <strong>Camera RTSP đã được cấu hình</strong>
                  <span>
                    Đang chờ Local Hub cung cấp luồng phát cho trình duyệt
                  </span>
                </div>
              )}
            {offline && selected.status !== "connecting" && (
              <div className="smart-camera-offline">
                <CameraOff />
                <strong>
                  {selected.status === "error"
                    ? "Không thể mở camera"
                    : selected.status === "ended"
                      ? "Camera đã mất nguồn"
                      : "Camera đang ngoại tuyến"}
                </strong>
                <span>
                  {selected.error ??
                    (selected.last_seen_at
                      ? `Lần cuối ${formatTime(selected.last_seen_at)}`
                      : "Chưa có heartbeat")}
                </span>
                <button onClick={() => void load()}>
                  <RefreshCw /> Thử lại
                </button>
              </div>
            )}
            <div className="smart-viewer-top">
              {!offline && (
                <span
                  className="smart-live-dot"
                  role="status"
                  aria-label="Camera đang trực tuyến"
                  title="Camera đang trực tuyến"
                  tabIndex={0}
                />
              )}
              <div className="viewer-overlay-toolbar">
                <label title="Hiển thị khung nhận diện">
                  <input
                    type="checkbox"
                    checked={showBoxes}
                    onChange={(event) => toggleBoxes(event.target.checked)}
                  />{" "}
                  Hiện khung
                </label>
                {isAdmin && <label title="Bật phát hiện người lạ">
                  <input
                    type="checkbox"
                    checked={recognitionEnabled}
                    disabled={identitySaving}
                    onChange={(event) =>
                      void toggleRecognition(event.target.checked)
                    }
                  />{" "}
                  Phát hiện người lạ
                </label>}
                <button
                  className="camera-fullscreen-button"
                  onClick={toggleFullscreen}
                  aria-label={
                    fullscreen ? "Thu nhỏ camera" : "Phóng to toàn màn hình"
                  }
                  title={fullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
                >
                  {fullscreen ? <Minimize /> : <Expand />}
                </button>
              </div>
            </div>
            <div className="smart-viewer-bottom">
              <div>
                <strong>{selected.name}</strong>
                <span>
                  {selected.location} · {selected.source}
                </span>
              </div>
              <time>
                {selected.last_seen_at
                  ? formatTime(selected.last_seen_at)
                  : "—"}
              </time>
            </div>
          </div>
        </div>
        <div
          className="mobile-viewer-options"
          aria-label="Tuỳ chọn hiển thị camera"
        >
          <button
            type="button"
            className={showBoxes ? "active" : ""}
            aria-pressed={showBoxes}
            aria-label="Hiển thị khung nhận diện"
            title="Hiển thị khung nhận diện"
            onClick={() => toggleBoxes(!showBoxes)}
          >
            <Box />
            <span>Hiện khung</span>
            {showBoxes ? <Check /> : <i aria-hidden="true" />}
          </button>
          {isAdmin && <button
            type="button"
            className={recognitionEnabled ? "active" : ""}
            aria-pressed={recognitionEnabled}
            aria-label="Bật phát hiện người lạ"
            title="Bật phát hiện người lạ"
            disabled={identitySaving}
            onClick={() => void toggleRecognition(!recognitionEnabled)}
          >
            <UserSearch />
            <span>Phát hiện lạ</span>
            {identitySaving ? (
              <RefreshCw className="spin" />
            ) : recognitionEnabled ? (
              <Check />
            ) : (
              <i aria-hidden="true" />
            )}
          </button>}
        </div>
        {isAdmin && (
          <section className="demo-scenario-panel" aria-labelledby="demo-scenario-title">
            <div>
              <h2 id="demo-scenario-title">Chọn kịch bản demo</h2>
              <p>Đổi video nguồn và khởi động lại luồng camera hiện tại.</p>
            </div>
            <div className="demo-scenario-actions">
              <select value={scenarioId} onChange={(event) => setScenarioId(event.target.value)} disabled={saving}>
                <option value="">{scenarios.length ? "Chọn một kịch bản…" : "Chưa có kịch bản"}</option>
                {scenarios.map((scenario) => <option value={scenario.id} key={scenario.id}>{scenario.name}</option>)}
              </select>
              <button type="button" disabled={!scenarioId || saving} onClick={() => void changeScenario()}>
                {saving ? <RefreshCw className="spin" /> : <Video />} Áp dụng
              </button>
              <label className="demo-upload-button">
                <Upload /> Tải video lên
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                  disabled={saving}
                  onChange={(event) => {
                    void uploadVideo(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
            {actionError && <p className="camera-edit-error" role="alert">{actionError}</p>}
          </section>
        )}
        {pendingUpload && (
          <div className="demo-name-backdrop" role="dialog" aria-modal="true" aria-labelledby="demo-name-title">
            <form className="demo-name-dialog" onSubmit={(event) => { event.preventDefault(); void nameUploadedVideo(); }}>
              <h2 id="demo-name-title">Video đã tải lên thành công</h2>
              <p>Đặt tên để lưu video này thành một kịch bản demo.</p>
              <small>{pendingUpload.filename}</small>
              <input
                value={scenarioName}
                maxLength={80}
                autoFocus
                required
                disabled={saving}
                placeholder="Tên kịch bản"
                onChange={(event) => setScenarioName(event.target.value)}
              />
              <div>
                <button type="button" disabled={saving} onClick={() => void cancelUploadedVideo()}>Hủy</button>
                <button type="submit" disabled={saving || !scenarioName.trim()}>{saving ? "Đang lưu…" : "Lưu và áp dụng"}</button>
              </div>
            </form>
          </div>
        )}

        <section className="smart-camera-actions">
          <div className="camera-readonly-state">
            <ShieldCheck />
            <span>
              <strong>
                {selected.active ? "Camera đang bật" : "Camera đang tắt"}
              </strong>
              <small>
                Vision: {visionStatusLabel(selected.vision_status)} · Bật/tắt
                trong Cài đặt
              </small>
            </span>
          </div>
        </section>

        <section className="viewer-recent-events">
          <header>
            <div>
              <h2>Sự kiện hôm nay</h2>
              <p>
                Dữ liệu thật được lưu trong SQLite cho{" "}
                {selected.name.toLocaleLowerCase("vi")}.
              </p>
            </div>
            <button onClick={() => navigate("/history")}>
              Xem lịch sử <ChevronRight />
            </button>
          </header>
          {eventGroups.length > 0 && (
            <div className="detection-summary" aria-label="Tóm tắt phát hiện">
              {eventGroups.map((group) => (
                <span key={group.label}>
                  <strong>{group.count}</strong>
                  {group.label}
                </span>
              ))}
            </div>
          )}
          <div>
            {todayEvents.length ? (
              todayEvents.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  onOpen={() => navigate("/history")}
                />
              ))
            ) : (
              <p className="viewer-events-empty">
                Hôm nay camera này chưa ghi nhận sự kiện.
              </p>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

function EventRow({
  event,
  onOpen,
}: {
  event: CameraEventDto;
  onOpen: () => void;
}) {
  const fall =
    event.event_type.includes("FALL") || event.event_type === "fall_suspected";
  const Icon = fall
    ? AlertTriangle
    : event.event_type.includes("CAMERA")
      ? Wifi
      : Video;
  return (
    <button
      className={`viewer-event-row ${fall ? "danger" : "info"}`}
      onClick={onOpen}
    >
      <time>{formatTime(event.occurred_at)}</time>
      <span>
        <Icon />
      </span>
      <div>
        <strong>{event.title}</strong>
        <small>{event.description}</small>
      </div>
      <ChevronRight />
    </button>
  );
}

function cameraStatusLabel(status: CameraDto["status"]): string {
  if (status === "online") return "Trực tuyến";
  if (status === "connecting") return "Đang kết nối";
  if (status === "error") return "Lỗi camera";
  if (status === "ended") return "Mất nguồn";
  return "Ngoại tuyến";
}

function visionStatusLabel(status: CameraDto["vision_status"]): string {
  if (status === "running") return "Đang hoạt động";
  if (status === "waiting_for_source") return "Đang chờ nguồn";
  if (status === "error") return "Có lỗi";
  return "Đã tắt";
}

function isToday(value: string): boolean {
  const date = new Date(value);
  const now = new Date();
  return date.toDateString() === now.toDateString();
}
function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}
