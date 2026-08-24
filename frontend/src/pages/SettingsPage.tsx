import {
  AlertTriangle,
  Bell,
  Camera,
  Check,
  Clock3,
  History,
  Laptop,
  LockKeyhole,
  Moon,
  Palette,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Trash2,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  createSettingsUser,
  getSettings,
  saveGeneral,
  saveNotifications,
  setSettingsCameraActive,
  setSettingsCameraVision,
  setSettingsUserActive,
  setUserPermission,
  type PermissionKey,
  type SettingsData,
  type SettingsUser,
} from "../api/settings";
import { deleteCamera } from "../api/cameras";
import { createMockCamera } from "../api/cameras";
import "./settings.css";
import { useTheme, type ThemePreference } from "../design-system";

const tabs = [
  { id: "general", label: "Cài đặt chung", icon: Settings },
  { id: "users", label: "Quản lý người dùng", icon: UsersRound },
  { id: "permissions", label: "Phân quyền", icon: LockKeyhole },
  { id: "notifications", label: "Thông báo", icon: Bell },
  { id: "appearance", label: "Giao diện", icon: Palette },
] as const;
type Tab = (typeof tabs)[number]["id"];
const permissionLabels: Record<PermissionKey, string> = {
  view_history: "Xem lịch sử",
  acknowledge_alert: "Xác nhận cảnh báo",
  resolve_alert: "Xử lý / đóng cảnh báo",
  manage_cameras: "Quản lý camera",
  manage_persons: "Quản lý người thân",
  manage_users: "Quản lý người dùng",
};

function Toggle({
  value,
  onChange,
  disabled = false,
  label,
}: {
  value: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      className={`permission-toggle ${value ? "on" : ""}`}
      role="switch"
      aria-checked={value}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
    >
      <i />
    </button>
  );
}

export default function SettingsPage({ isAdmin }: { isAdmin: boolean }) {
  const { theme, setTheme } = useTheme();
  const [data, setData] = useState<SettingsData | null>(null);
  const [tab, setTab] = useState<Tab>("general");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cameraSaving, setCameraSaving] = useState<Record<string, boolean>>({});
  const [cameraFeedback, setCameraFeedback] = useState<
    Record<string, { kind: "saved" | "error"; message: string }>
  >({});
  const [invite, setInvite] = useState(false);
  const [selectedUser, setSelectedUser] = useState("");
  const [addCamera, setAddCamera] = useState(false);
  const [cameraUploading, setCameraUploading] = useState(false);
  const [cameraUploadError, setCameraUploadError] = useState("");
  const settingsRequestInFlight = useRef(false);
  const dirtyRef = useRef(false);
  const pollErrorLoggedRef = useRef(false);
  const mountedRef = useRef(true);
  const autoSaveTimerRef = useRef<number | undefined>(undefined);
  const feedbackTimersRef = useRef<Record<string, number>>({});
  const load = () => {
    if (settingsRequestInFlight.current) return;
    settingsRequestInFlight.current = true;
    setLoading(true);
    setError("");
    getSettings()
      .then((value) => {
        if (!mountedRef.current) return;
        setData(value);
        dirtyRef.current = false;
        setSelectedUser((current) => current || value.users[0]?.id || "");
      })
      .catch(() => {
        if (mountedRef.current) setError("Không tải được cài đặt từ Local Hub");
      })
      .finally(() => {
        settingsRequestInFlight.current = false;
        if (mountedRef.current) setLoading(false);
      });
  };
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (autoSaveTimerRef.current)
        window.clearTimeout(autoSaveTimerRef.current);
      Object.values(feedbackTimersRef.current).forEach(window.clearTimeout);
    };
  }, []);
  useEffect(load, []);
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const schedule = () => {
      if (!cancelled) timer = window.setTimeout(poll, 3000);
    };
    const poll = async () => {
      if (settingsRequestInFlight.current) {
        schedule();
        return;
      }
      settingsRequestInFlight.current = true;
      try {
        const value = await getSettings();
        if (!cancelled && !dirtyRef.current) {
          setData(value);
          setSelectedUser((current) => current || value.users[0]?.id || "");
        }
        pollErrorLoggedRef.current = false;
      } catch (pollError) {
        if (!cancelled && !pollErrorLoggedRef.current) {
          console.warn("Không thể làm mới cài đặt nền", pollError);
          pollErrorLoggedRef.current = true;
        }
      } finally {
        settingsRequestInFlight.current = false;
        schedule();
      }
    };
    schedule();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);
  if (loading)
    return (
      <section className="settings-page page-wrap">
        <div className="permission-empty">
          <RefreshCw />
          <h3>Đang tải cài đặt…</h3>
        </div>
      </section>
    );
  if (!data)
    return (
      <section className="settings-page page-wrap">
        <div className="permission-empty">
          <Settings />
          <h3>{error || "Không có dữ liệu cài đặt"}</h3>
          <button onClick={load}>Thử lại</button>
        </div>
      </section>
    );
  const selected = data.users.find((user) => user.id === selectedUser);
  const updateData = (next: SettingsData) => {
    dirtyRef.current = false;
    setData(next);
  };
  const updateDraft = (next: SettingsData) => {
    dirtyRef.current = true;
    setData(next);
    if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    const section = tab === "notifications" ? "notifications" : "general";
    autoSaveTimerRef.current = window.setTimeout(() => {
      const request =
        section === "notifications"
          ? saveNotifications(next.notifications)
          : saveGeneral(next.general);
      void request
        .then((saved) => {
          dirtyRef.current = false;
          setData((current) =>
            current
              ? section === "notifications"
                ? {
                    ...current,
                    notifications: saved as SettingsData["notifications"],
                  }
                : { ...current, general: saved as SettingsData["general"] }
              : current,
          );
        })
        .catch(() => {
          setError("Không thể lưu thay đổi. Vui lòng thử lại.");
          dirtyRef.current = false;
          load();
        });
    }, 650);
  };
  const showCameraFeedback = (
    id: string,
    kind: "saved" | "error",
    message: string,
  ) => {
    setCameraFeedback((current) => ({ ...current, [id]: { kind, message } }));
    if (feedbackTimersRef.current[id])
      window.clearTimeout(feedbackTimersRef.current[id]);
    feedbackTimersRef.current[id] = window.setTimeout(
      () =>
        setCameraFeedback((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        }),
      2500,
    );
  };
  const toggleCamera = async (id: string, active: boolean) => {
    if (cameraSaving[id]) return;
    setCameraSaving((current) => ({ ...current, [id]: true }));
    setCameraFeedback((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setData((current) =>
      current
        ? {
            ...current,
            cameras: current.cameras.map((camera) =>
              camera.id === id ? { ...camera, is_active: active } : camera,
            ),
          }
        : current,
    );
    try {
      const updated = await setSettingsCameraActive(id, active);
      setData((current) =>
        current
          ? {
              ...current,
              cameras: current.cameras.map(
                (camera) =>
                  updated.cameras.find((item) => item.id === camera.id) ??
                  camera,
              ),
            }
          : current,
      );
      showCameraFeedback(id, "saved", "Đã lưu");
      window.dispatchEvent(new CustomEvent("camera-settings-updated"));
    } catch (reason) {
      setData((current) =>
        current
          ? {
              ...current,
              cameras: current.cameras.map((camera) =>
                camera.id === id ? { ...camera, is_active: !active } : camera,
              ),
            }
          : current,
      );
      showCameraFeedback(
        id,
        "error",
        reason instanceof Error &&
          reason.message &&
          !reason.message.startsWith("API request failed")
          ? reason.message
          : "Không thể lưu thay đổi. Vui lòng thử lại.",
      );
    } finally {
      setCameraSaving((current) => ({ ...current, [id]: false }));
    }
  };
  const toggleVision = async (id: string, enabled: boolean) => {
    if (cameraSaving[id]) return;
    setCameraSaving((current) => ({ ...current, [id]: true }));
    setCameraFeedback((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setData((current) =>
      current
        ? {
            ...current,
            cameras: current.cameras.map((camera) =>
              camera.id === id
                ? { ...camera, vision_enabled: enabled }
                : camera,
            ),
          }
        : current,
    );
    try {
      const updated = await setSettingsCameraVision(id, enabled);
      setData((current) =>
        current
          ? {
              ...current,
              cameras: current.cameras.map(
                (camera) =>
                  updated.cameras.find((item) => item.id === camera.id) ??
                  camera,
              ),
            }
          : current,
      );
      showCameraFeedback(id, "saved", "Đã lưu");
      window.dispatchEvent(new CustomEvent("camera-settings-updated"));
    } catch (reason) {
      setData((current) =>
        current
          ? {
              ...current,
              cameras: current.cameras.map((camera) =>
                camera.id === id
                  ? { ...camera, vision_enabled: !enabled }
                  : camera,
              ),
            }
          : current,
      );
      showCameraFeedback(
        id,
        "error",
        reason instanceof Error &&
          reason.message &&
          !reason.message.startsWith("API request failed")
          ? reason.message
          : "Không thể lưu thay đổi. Vui lòng thử lại.",
      );
    } finally {
      setCameraSaving((current) => ({ ...current, [id]: false }));
    }
  };
  const removeCamera = async (camera: SettingsData["cameras"][number]) => {
    if (cameraSaving[camera.id] || !window.confirm(`Xóa camera "${camera.name}"?`)) return;
    setCameraSaving((current) => ({ ...current, [camera.id]: true }));
    try {
      if (camera.is_active) await setSettingsCameraActive(camera.id, false);
      await deleteCamera(camera.id);
      setData((current) => current ? ({ ...current, cameras: current.cameras.filter((item) => item.id !== camera.id) }) : current);
      window.dispatchEvent(new CustomEvent("camera-settings-updated"));
    } catch (reason) {
      showCameraFeedback(camera.id, "error", reason instanceof Error ? reason.message : "Không thể xóa camera");
      load();
    } finally {
      setCameraSaving((current) => ({ ...current, [camera.id]: false }));
    }
  };
  const toggleUser = (user: SettingsUser) => {
    void setSettingsUserActive(user.id, !user.active)
      .then((updated) =>
        setData({
          ...data,
          users: data.users.map((item) =>
            item.id === updated.id ? updated : item,
          ),
        }),
      )
      .catch(() => setError("Không thể thay đổi tài khoản này"));
  };
  const togglePermission = (key: PermissionKey) => {
    if (!selected || selected.role === "admin") return;
    const granted = !selected.permissions[key];
    void setUserPermission(selected.id, key, granted)
      .then((updated) =>
        setData({
          ...data,
          users: data.users.map((item) =>
            item.id === updated.id ? updated : item,
          ),
        }),
      )
      .catch(() => setError("Không lưu được quyền"));
  };
  const addUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const user = await createSettingsUser({
        name: String(form.get("name")),
        email: String(form.get("email")),
        password: String(form.get("password")),
        role: String(form.get("role")) as "admin" | "caregiver",
      });
      setData({ ...data, users: [...data.users, user] });
      setInvite(false);
      setSelectedUser(user.id);
    } catch {
      setError("Email đã tồn tại hoặc dữ liệu không hợp lệ");
    }
  };
  const addMockCamera = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (cameraUploading) return;
    setCameraUploading(true);
    setCameraUploadError("");
    try {
      await createMockCamera(new FormData(event.currentTarget));
      setAddCamera(false);
      load();
      window.dispatchEvent(new CustomEvent("camera-settings-updated"));
    } catch (reason) {
      setCameraUploadError(
        reason instanceof Error ? reason.message : "Không thể tải video lên",
      );
    } finally {
      setCameraUploading(false);
    }
  };

  return (
    <section className="settings-page page-wrap">
      <header className="settings-heading">
        <div>
          <h1>Cài đặt</h1>
          <p>Quản lý cấu hình được lưu trên Local Hub.</p>
        </div>
        <span>
          <ShieldCheck /> Chỉ dành cho quản trị viên
        </span>
      </header>
      {error && (
        <div className="inactive-notice">
          <LockKeyhole />
          <span>{error}</span>
          <button onClick={() => setError("")}>
            <X />
          </button>
        </div>
      )}
      <div className="settings-shell">
        <nav className="settings-tabs">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <main className="settings-content">
          {tab === "general" && (
            <div className="settings-scroll-content">
              <header className="section-page-heading">
                <div>
                  <h2>Cài đặt chung</h2>
                  <p>Camera, lưu trữ và ngưỡng phát hiện AI.</p>
                </div>
              </header>
              <section className="settings-section-card">
                <div className="settings-card-heading row">
                  <span>
                    <Camera />
                  </span>
                  <div>
                    <h3>Cấu hình camera</h3>
                    <p>
                      {data.cameras.length} camera trên Local Hub. Mỗi công tắc
                      được tự động lưu ngay sau khi thay đổi.
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      className="settings-primary-small"
                      type="button"
                      onClick={() => {
                        setCameraUploadError("");
                        setAddCamera(true);
                      }}
                    >
                      <Plus /> Thêm cam
                    </button>
                  )}
                </div>
                <div className="settings-data-list">
                  {data.cameras.map((camera) => {
                    const busy = Boolean(cameraSaving[camera.id]);
                    const feedback = cameraFeedback[camera.id];
                    return (
                      <div className="camera-setting-row" key={camera.id}>
                        <span className="data-icon">
                          <Camera />
                        </span>
                        <div>
                          <strong>{camera.name}</strong>
                          <small>
                            {camera.location_label || "Chưa đặt vị trí"} ·{" "}
                            {sourceLabel(camera.source_kind)} · Vision:{" "}
                            {camera.vision_enabled
                              ? visionLabel(camera.vision_status)
                              : "Đã tắt"}
                          </small>
                          {!camera.is_active && (
                            <small className="vision-disabled-reason">
                              Camera đang tắt nên Vision không thể hoạt động.
                            </small>
                          )}
                          {(busy || feedback) && (
                            <small
                              className={`camera-save-feedback ${feedback?.kind ?? "saving"}`}
                              aria-live="polite"
                            >
                              {busy ? (
                                <>
                                  <RefreshCw className="spin" /> Đang lưu…
                                </>
                              ) : feedback?.kind === "saved" ? (
                                <>
                                  <Check /> {feedback.message}
                                </>
                              ) : (
                                <>
                                  <AlertTriangle /> {feedback?.message}
                                </>
                              )}
                            </small>
                          )}
                        </div>
                        <span
                          className={`operational-badge ${camera.operational_status}`}
                        >
                          {runtimeLabel(camera.operational_status)}
                        </span>
                        <div className="camera-setting-toggles">
                          <label>
                            Camera {camera.is_active ? "đang bật" : "đã tắt"}{" "}
                            <Toggle
                              label={`${camera.is_active ? "Tắt" : "Bật"} camera ${camera.name}`}
                              value={camera.is_active}
                              disabled={busy}
                              onChange={() =>
                                void toggleCamera(camera.id, !camera.is_active)
                              }
                            />
                          </label>
                          <label>
                            Vision{" "}
                            {camera.vision_enabled ? "đang bật" : "đã tắt"}{" "}
                            <Toggle
                              label={`${camera.vision_enabled ? "Tắt" : "Bật"} Vision ${camera.name}`}
                              value={camera.vision_enabled}
                              disabled={busy || !camera.is_active}
                              onChange={() =>
                                void toggleVision(
                                  camera.id,
                                  !camera.vision_enabled,
                                )
                              }
                            />
                          </label>
                        </div>
                        {isAdmin && (
                          <button
                            type="button"
                            className="camera-row-delete"
                            disabled={busy}
                            title={`Xóa ${camera.name}`}
                            onClick={() => void removeCamera(camera)}
                          >
                            <Trash2 /> <span>Xóa</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
              <section className="settings-section-card">
                <div className="settings-card-heading">
                  <span>
                    <ShieldCheck />
                  </span>
                  <div>
                    <h3>Lưu trữ cục bộ</h3>
                    <p>Video thô không được tải lên cloud.</p>
                  </div>
                </div>
                <div className="setting-inline-row">
                  <label>
                    <span>Thời gian lưu snapshot</span>
                    <select
                      value={data.general.retention_days}
                      onChange={(event) =>
                        updateDraft({
                          ...data,
                          general: {
                            ...data.general,
                            retention_days: Number(event.target.value) as
                              7 | 30 | 90,
                          },
                        })
                      }
                    >
                      <option value={7}>7 ngày</option>
                      <option value={30}>30 ngày</option>
                      <option value={90}>90 ngày</option>
                    </select>
                  </label>
                </div>
              </section>
              <section className="settings-section-card">
                <div className="settings-card-heading">
                  <span>
                    <SlidersHorizontal />
                  </span>
                  <div>
                    <h3>Ngưỡng cảnh báo AI</h3>
                    <p>
                      Ngưỡng thấp làm hệ thống nhạy hơn nhưng có thể tăng báo
                      động giả; ngưỡng cao cần độ tin cậy lớn hơn mới tạo cảnh
                      báo.
                    </p>
                  </div>
                </div>
                <div className="threshold-grid">
                  <label>
                    <span>
                      Người lạ{" "}
                      <strong>{data.general.stranger_threshold}%</strong>
                    </span>
                    <input
                      aria-describedby="threshold-help"
                      type="range"
                      min="50"
                      max="99"
                      value={data.general.stranger_threshold}
                      onChange={(event) =>
                        updateDraft({
                          ...data,
                          general: {
                            ...data.general,
                            stranger_threshold: Number(event.target.value),
                          },
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>
                      Té ngã <strong>{data.general.fall_threshold}%</strong>
                    </span>
                    <input
                      aria-describedby="threshold-help"
                      type="range"
                      min="70"
                      max="99"
                      value={data.general.fall_threshold}
                      onChange={(event) =>
                        updateDraft({
                          ...data,
                          general: {
                            ...data.general,
                            fall_threshold: Number(event.target.value),
                          },
                        })
                      }
                    />
                  </label>
                </div>
                <p id="threshold-help" className="threshold-help">
                  Chỉ thay đổi khi đã đánh giá dữ liệu thực tế tại nhà; cấu hình
                  được tự động lưu sau khi thay đổi.
                </p>
                {(data.general.stranger_threshold < 65 ||
                  data.general.fall_threshold < 80) && (
                  <div className="threshold-warning" role="alert">
                    <AlertTriangle /> Ngưỡng hiện tại khá thấp và có thể làm
                    tăng số cảnh báo nhầm.
                  </div>
                )}
                <div className="sensitive-hours">
                  <Clock3 />
                  <div>
                    <strong>Khung giờ nhạy cảm</strong>
                    <small>Tăng ưu tiên cảnh báo ngoài giờ.</small>
                  </div>
                  <input
                    type="time"
                    aria-label="Bắt đầu khung giờ nhạy cảm"
                    value={data.general.sensitive_from}
                    onChange={(event) =>
                      updateDraft({
                        ...data,
                        general: {
                          ...data.general,
                          sensitive_from: event.target.value,
                        },
                      })
                    }
                  />
                  <span>đến</span>
                  <input
                    type="time"
                    aria-label="Kết thúc khung giờ nhạy cảm"
                    value={data.general.sensitive_to}
                    onChange={(event) =>
                      updateDraft({
                        ...data,
                        general: {
                          ...data.general,
                          sensitive_to: event.target.value,
                        },
                      })
                    }
                  />
                  <Toggle
                    label="Khung giờ nhạy cảm"
                    value={data.general.sensitive_enabled}
                    onChange={() =>
                      updateDraft({
                        ...data,
                        general: {
                          ...data.general,
                          sensitive_enabled: !data.general.sensitive_enabled,
                        },
                      })
                    }
                  />
                </div>
              </section>
            </div>
          )}

          {tab === "users" && (
            <div className="settings-scroll-content">
              <header className="section-page-heading">
                <div>
                  <h2>Quản lý người dùng</h2>
                  <p>Tài khoản truy cập Local Hub.</p>
                </div>
                <button
                  className="settings-primary-small"
                  onClick={() => setInvite(true)}
                >
                  <UserPlus /> Thêm thành viên
                </button>
              </header>
              <section className="settings-section-card user-table-card">
                <div className="settings-user-table">
                  <div className="user-table-head">
                    <span>Thành viên</span>
                    <span>Vai trò</span>
                    <span>Trạng thái</span>
                    <span>Ngày tạo</span>
                    <span>Hành động</span>
                  </div>
                  {data.users.map((user) => (
                    <div className="user-table-row" key={user.id}>
                      <div>
                        <span className="caregiver-avatar">
                          {user.name
                            .split(" ")
                            .map((part) => part[0])
                            .slice(-2)
                            .join("")}
                        </span>
                        <span>
                          <strong>{user.name}</strong>
                          <small>{user.email}</small>
                        </span>
                      </div>
                      <span className={`role-badge ${user.role}`}>
                        {user.role}
                      </span>
                      <span
                        className={`account-badge ${user.active ? "active" : "inactive"}`}
                      >
                        {user.active ? "Hoạt động" : "Đã khóa"}
                      </span>
                      <time>
                        {new Date(user.created_at).toLocaleDateString("vi-VN")}
                      </time>
                      <div>
                        <button
                          title={user.active ? "Vô hiệu hóa" : "Kích hoạt"}
                          onClick={() => toggleUser(user)}
                        >
                          <ShieldCheck />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="last-admin-note">
                  <ShieldCheck /> Không thể vô hiệu hóa admin cuối cùng.
                </p>
              </section>
            </div>
          )}

          {tab === "permissions" && (
            <div className="permission-view">
              <header className="permission-heading">
                <div>
                  <h2>Phân quyền</h2>
                  <p>Quyền caregiver được lưu trong `user_permissions`.</p>
                </div>
              </header>
              <div className="permission-layout">
                <aside className="caregiver-panel">
                  <div className="caregiver-list">
                    {data.users.map((user) => (
                      <button
                        key={user.id}
                        className={selectedUser === user.id ? "selected" : ""}
                        onClick={() => setSelectedUser(user.id)}
                      >
                        <span className="caregiver-avatar">
                          {user.name
                            .split(" ")
                            .map((part) => part[0])
                            .slice(-2)
                            .join("")}
                        </span>
                        <span>
                          <strong>{user.name}</strong>
                          <small>{user.email}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </aside>
                {selected && (
                  <section className="permission-panel">
                    <header>
                      <span className="caregiver-avatar large">
                        {selected.name[0]}
                      </span>
                      <div>
                        <h3>{selected.name}</h3>
                        <p>{selected.role}</p>
                      </div>
                    </header>
                    <div className="permission-groups">
                      <section>
                        <h4>
                          <History /> Quyền hệ thống
                        </h4>
                        {(Object.keys(permissionLabels) as PermissionKey[]).map(
                          (key) => (
                            <div className="permission-row" key={key}>
                              <div>
                                <strong>{permissionLabels[key]}</strong>
                                <p>
                                  {selected.role === "admin"
                                    ? "Admin luôn có quyền này."
                                    : "Cho phép caregiver thực hiện thao tác."}
                                </p>
                              </div>
                              <Toggle
                                label={permissionLabels[key]}
                                value={selected.permissions[key]}
                                disabled={
                                  selected.role === "admin" || !selected.active
                                }
                                onChange={() => togglePermission(key)}
                              />
                            </div>
                          ),
                        )}
                      </section>
                    </div>
                  </section>
                )}
              </div>
            </div>
          )}

          {tab === "notifications" && (
            <div className="settings-scroll-content">
              <header className="section-page-heading">
                <div>
                  <h2>Thông báo</h2>
                  <p>Cấu hình cách Local Hub thông báo cảnh báo.</p>
                </div>
              </header>
              <section className="settings-section-card">
                <div className="settings-card-heading">
                  <span>
                    <Bell />
                  </span>
                  <div>
                    <h3>Kênh thông báo</h3>
                    <p>SMS bị khóa vì baseline chưa có hạ tầng gửi thật.</p>
                  </div>
                </div>
                <div className="notification-options">
                  {(["app", "email", "sms"] as const).map((key) => (
                    <div key={key}>
                      <Bell />
                      <span>
                        <strong>{key.toUpperCase()}</strong>
                        <small>
                          {key === "sms"
                            ? "Chưa khả dụng"
                            : "Được lưu trên Local Hub"}
                        </small>
                      </span>
                      <Toggle
                        label={key}
                        disabled={key === "sms"}
                        value={data.notifications[key]}
                        onChange={() =>
                          updateDraft({
                            ...data,
                            notifications: {
                              ...data.notifications,
                              [key]: !data.notifications[key],
                            },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </section>
              <section className="settings-section-card">
                <div className="setting-inline-row">
                  <label>
                    <span>Mức độ nhận</span>
                    <select
                      value={data.notifications.level}
                      onChange={(event) =>
                        updateDraft({
                          ...data,
                          notifications: {
                            ...data.notifications,
                            level: event.target.value as "all" | "important",
                          },
                        })
                      }
                    >
                      <option value="all">Tất cả</option>
                      <option value="important">Chỉ cảnh báo quan trọng</option>
                    </select>
                  </label>
                  <div>
                    <strong>Gộp cảnh báo</strong>
                    <small>Gộp cảnh báo liên tiếp.</small>
                  </div>
                  <Toggle
                    label="Gộp cảnh báo"
                    value={data.notifications.grouped}
                    onChange={() =>
                      updateDraft({
                        ...data,
                        notifications: {
                          ...data.notifications,
                          grouped: !data.notifications.grouped,
                        },
                      })
                    }
                  />
                </div>
                <div className="quiet-hours">
                  <Toggle
                    label="Giờ yên tĩnh"
                    value={data.notifications.quiet_enabled}
                    onChange={() =>
                      updateDraft({
                        ...data,
                        notifications: {
                          ...data.notifications,
                          quiet_enabled: !data.notifications.quiet_enabled,
                        },
                      })
                    }
                  />
                  <label>
                    <span>Từ</span>
                    <input
                      aria-label="Bắt đầu giờ yên tĩnh"
                      type="time"
                      value={data.notifications.quiet_from}
                      onChange={(event) =>
                        updateDraft({
                          ...data,
                          notifications: {
                            ...data.notifications,
                            quiet_from: event.target.value,
                          },
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Đến</span>
                    <input
                      aria-label="Kết thúc giờ yên tĩnh"
                      type="time"
                      value={data.notifications.quiet_to}
                      onChange={(event) =>
                        updateDraft({
                          ...data,
                          notifications: {
                            ...data.notifications,
                            quiet_to: event.target.value,
                          },
                        })
                      }
                    />
                  </label>
                </div>
              </section>
            </div>
          )}

          {tab === "appearance" && (
            <AppearanceSettings theme={theme} onChange={setTheme} />
          )}
        </main>
      </div>
      {invite && (
        <div className="settings-modal-backdrop">
          <form className="settings-modal" onSubmit={addUser}>
            <header>
              <div>
                <h3>Thêm thành viên</h3>
                <p>
                  Tạo tài khoản cục bộ. Người dùng sẽ đổi mật khẩu sau lần đăng
                  nhập đầu tiên.
                </p>
              </div>
              <button type="button" onClick={() => setInvite(false)}>
                <X />
              </button>
            </header>
            <label>
              <span>Tên</span>
              <input name="name" required />
            </label>
            <label>
              <span>Email</span>
              <input name="email" type="email" required />
            </label>
            <label>
              <span>Mật khẩu tạm</span>
              <input name="password" type="password" minLength={8} required />
            </label>
            <label>
              <span>Vai trò</span>
              <select name="role">
                <option value="caregiver">Caregiver</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <footer>
              <button type="button" onClick={() => setInvite(false)}>
                Huỷ
              </button>
              <button type="submit">
                <Plus /> Thêm
              </button>
            </footer>
          </form>
        </div>
      )}
      {isAdmin && addCamera && (
        <div className="settings-modal-backdrop">
          <form className="settings-modal" onSubmit={addMockCamera}>
            <header>
              <div>
                <h3>Thêm camera mô phỏng</h3>
                <p>
                  Video sẽ phát lặp như camera thời gian thực. Vision mặc định
                  tắt để tránh làm máy bị lag.
                </p>
              </div>
              <button
                type="button"
                disabled={cameraUploading}
                onClick={() => setAddCamera(false)}
              >
                <X />
              </button>
            </header>
            <label>
              <span>Tên camera</span>
              <input
                name="name"
                maxLength={255}
                placeholder="Ví dụ: Camera phòng khách"
                required
              />
            </label>
            <label>
              <span>Vị trí</span>
              <input
                name="location"
                maxLength={255}
                placeholder="Ví dụ: Phòng khách"
                required
              />
            </label>
            <label>
              <span>Video mock (tối đa 95 MB)</span>
              <input
                name="video"
                type="file"
                accept="video/mp4,video/quicktime,video/webm,.avi,.mkv"
                required
              />
            </label>
            {cameraUploadError && (
              <p className="camera-upload-error" role="alert">
                <AlertTriangle /> {cameraUploadError}
              </p>
            )}
            <footer>
              <button
                type="button"
                disabled={cameraUploading}
                onClick={() => setAddCamera(false)}
              >
                Huỷ
              </button>
              <button type="submit" disabled={cameraUploading}>
                {cameraUploading ? (
                  <>
                    <RefreshCw className="spin" /> Đang tải video…
                  </>
                ) : (
                  <>
                    <Plus /> Thêm camera
                  </>
                )}
              </button>
            </footer>
          </form>
        </div>
      )}
    </section>
  );
}

function AppearanceSettings({
  theme,
  onChange,
}: {
  theme: ThemePreference;
  onChange: (theme: ThemePreference) => void;
}) {
  const choices = [
    {
      value: "light" as const,
      label: "Sáng",
      description: "Luôn sử dụng giao diện sáng.",
      icon: Sun,
    },
    {
      value: "dark" as const,
      label: "Tối",
      description: "Giảm độ chói trong môi trường thiếu sáng.",
      icon: Moon,
    },
    {
      value: "system" as const,
      label: "Theo hệ thống",
      description: "Tự động theo cài đặt giao diện của thiết bị.",
      icon: Laptop,
    },
  ];
  return (
    <div className="settings-scroll-content">
      <header className="section-page-heading">
        <div>
          <h2>Giao diện</h2>
          <p>Lựa chọn được lưu trên thiết bị này và áp dụng ngay lập tức.</p>
        </div>
      </header>
      <section className="settings-section-card appearance-settings">
        <div className="settings-card-heading">
          <span>
            <Palette />
          </span>
          <div>
            <h3>Chế độ màu</h3>
            <p>Chọn giao diện phù hợp với môi trường sử dụng.</p>
          </div>
        </div>
        <div
          className="appearance-options"
          role="radiogroup"
          aria-label="Chế độ giao diện"
        >
          {choices.map(({ value, label, description, icon: Icon }) => (
            <button
              type="button"
              role="radio"
              aria-checked={theme === value}
              className={theme === value ? "selected" : ""}
              key={value}
              onClick={() => onChange(value)}
            >
              <span>
                <Icon />
              </span>
              <span>
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
              <i aria-hidden="true">{theme === value && <Check />}</i>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function runtimeLabel(status: string): string {
  if (status === "online") return "Đang chạy";
  if (status === "connecting") return "Đang kết nối";
  if (status === "error") return "Lỗi nguồn";
  if (status === "ended") return "Đã kết thúc";
  return "Đã dừng";
}
function visionLabel(status: string | null | undefined): string {
  if (status === "running") return "Đang hoạt động";
  if (status === "connecting" || status === "waiting") return "Đang chờ nguồn";
  if (status === "error") return "Có lỗi";
  if (status === "disabled" || status === "stopped") return "Đã tắt";
  return "Chưa có trạng thái";
}
function sourceLabel(source: string | null | undefined): string {
  if (source === "video_file") return "Video";
  if (source === "webcam") return "Webcam";
  if (source === "rtsp") return "RTSP";
  return "Chưa rõ nguồn";
}
