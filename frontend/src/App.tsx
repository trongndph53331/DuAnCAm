import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  AlertTriangle,
  Bell,
  Camera,
  ChevronDown,
  HeartHandshake,
  History,
  Home,
  LogOut,
  Menu,
  Monitor,
  Moon,
  MoreHorizontal,
  Settings,
  ShieldCheck,
  Sun,
  UsersRound,
} from "lucide-react";
import AlertsPage from "./features/alerts/AlertsPage";
import CameraPage from "./pages/CameraPage";
import FamilyPage from "./pages/FamilyPage";
import HistoryPage from "./pages/HistoryPage";
import OverviewPage from "./pages/OverviewPage";
import SettingsPage from "./pages/SettingsPage";
import StatisticsPage from "./pages/StatisticsPage";
import { fetchAlerts } from "./features/alerts/alertService";
import { logout, me, type AuthUser } from "./api/auth";
import LoginPage from "./pages/LoginPage";
import { IconButton, Tooltip, useTheme } from "./design-system";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { canAccessRoute } from "./auth/accessControl";
import {
  ALERT_SOUND_PREFERENCE_EVENT,
  AlertNotificationController,
  WebAudioAlertPlayer,
  readAlertSoundEnabled,
  type RealtimeAlertMessage,
} from "./features/alerts/alertNotifications";
import { subscribeToAlertStream } from "./features/alerts/alertStream";

const navItems = [
  { label: "Tổng quan", path: "/", icon: Home, badge: undefined },
  { label: "Camera", path: "/camera", icon: Camera, badge: undefined },
  { label: "Cảnh báo", path: "/alerts", icon: Bell, badge: undefined },
  { label: "Người thân", path: "/family", icon: UsersRound, badge: undefined },
  { label: "Lịch sử", path: "/history", icon: History, badge: undefined },
  { label: "Thống kê", path: "/statistics", icon: BarChart3, badge: undefined },
  { label: "Cài đặt", path: "/settings", icon: Settings, badge: undefined },
] as const;

type RoutePath = (typeof navItems)[number]["path"];
const routePaths = new Set<string>(navItems.map((item) => item.path));
const currentPath = (): RoutePath => {
  if (window.location.pathname.startsWith("/alerts/")) return "/alerts";
  if (window.location.pathname.startsWith("/camera/")) return "/camera";
  return routePaths.has(window.location.pathname)
    ? (window.location.pathname as RoutePath)
    : "/";
};

function DashboardApp({
  onLogout,
}: {
  onLogout: () => Promise<void>;
}) {
  const { user } = useAuth();
  const { theme, cycleTheme } = useTheme();
  const [activePath, setActivePath] = useState<RoutePath>(currentPath);
  const [routeRevision, setRouteRevision] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const unreadAlertIdsRef = useRef<Set<string>>(new Set());
  const pendingReadIdsRef = useRef<Set<string>>(new Set());
  const [accountOpen, setAccountOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [alertToast, setAlertToast] = useState(false);
  const initialAlertSoundEnabled = useRef(
    readAlertSoundEnabled(user.id, user.role === "admin"),
  ).current;
  const [soundPermissionHint, setSoundPermissionHint] = useState(initialAlertSoundEnabled);
  const alertToastTimerRef = useRef<number | undefined>(undefined);
  const loggingOutRef = useRef(false);
  const alertPlayerRef = useRef<WebAudioAlertPlayer | null>(null);
  const alertControllerRef = useRef<AlertNotificationController | null>(null);
  if (!alertPlayerRef.current) alertPlayerRef.current = new WebAudioAlertPlayer();
  if (!alertControllerRef.current) {
    alertControllerRef.current = new AlertNotificationController(
      alertPlayerRef.current,
      initialAlertSoundEnabled,
      (soundBlocked) => {
        setAlertToast(true);
        setSoundPermissionHint(soundBlocked);
        if (alertToastTimerRef.current) window.clearTimeout(alertToastTimerRef.current);
        alertToastTimerRef.current = window.setTimeout(() => setAlertToast(false), 4_000);
      },
    );
  }
  const accountRef = useRef<HTMLDivElement>(null);
  const cancelLogoutRef = useRef<HTMLButtonElement>(null);
  const [isMobileLayout, setIsMobileLayout] = useState(
    () => window.matchMedia("(max-width: 767px)").matches,
  );

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 767px)");
    const syncLayout = () => {
      setIsMobileLayout(mobileQuery.matches);
      setMobileOpen(false);
    };
    const syncRoute = () => {
      setActivePath(currentPath());
      setRouteRevision((value) => value + 1);
    };
    syncLayout();
    mobileQuery.addEventListener("change", syncLayout);
    window.addEventListener("resize", syncLayout);
    window.visualViewport?.addEventListener("resize", syncLayout);
    window.addEventListener("popstate", syncRoute);
    return () => {
      mobileQuery.removeEventListener("change", syncLayout);
      window.removeEventListener("resize", syncLayout);
      window.visualViewport?.removeEventListener("resize", syncLayout);
      window.removeEventListener("popstate", syncRoute);
    };
  }, []);
  useEffect(() => {
    const closeAccount = (event: PointerEvent) => {
      if (!accountRef.current?.contains(event.target as Node))
        setAccountOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (logoutConfirmOpen && !logoutPending) setLogoutConfirmOpen(false);
      else setAccountOpen(false);
    };
    document.addEventListener("pointerdown", closeAccount);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeAccount);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [logoutConfirmOpen, logoutPending]);
  useEffect(() => {
    if (logoutConfirmOpen) cancelLogoutRef.current?.focus();
  }, [logoutConfirmOpen]);
  useEffect(() => {
    const player = alertPlayerRef.current!;
    const unlock = () => {
      void player.unlock().then((allowed) => {
        if (allowed) setSoundPermissionHint(false);
      });
    };
    document.addEventListener("pointerdown", unlock, { passive: true });
    document.addEventListener("keydown", unlock);
    document.addEventListener("touchend", unlock, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
      document.removeEventListener("touchend", unlock);
    };
  }, []);
  useEffect(() => {
    const syncPreference = (event: Event) => {
      const detail = (event as CustomEvent<{ userId: string; enabled: boolean }>).detail;
      if (detail?.userId !== user.id) return;
      alertControllerRef.current?.setEnabled(detail.enabled);
      setSoundPermissionHint(detail.enabled && !alertPlayerRef.current!.unlocked);
    };
    window.addEventListener(ALERT_SOUND_PREFERENCE_EVENT, syncPreference);
    return () => window.removeEventListener(ALERT_SOUND_PREFERENCE_EVENT, syncPreference);
  }, [user.id]);
  useEffect(() => {
    const sync = () =>
      window.dispatchEvent(new CustomEvent("antam:alerts-changed"));
    const receiveAlert = (data: string) => {
      sync();
      try {
        const message = JSON.parse(data) as RealtimeAlertMessage;
        alertControllerRef.current?.handle(message, !loggingOutRef.current);
      } catch {
        // A malformed realtime message can still trigger the normal list refresh.
      }
    };
    return subscribeToAlertStream({ onReady: sync, onAlert: receiveAlert });
  }, []);
  useEffect(() => () => {
    if (alertToastTimerRef.current) window.clearTimeout(alertToastTimerRef.current);
    alertPlayerRef.current?.close();
  }, []);
  useEffect(() => {
    const refreshUnread = () => {
      void fetchAlerts()
        .then((items) => {
          const unique = new Map(items.map((item) => [item.id, item]));
          unreadAlertIdsRef.current = new Set(
            [...unique.values()]
              .filter(
                (item) =>
                  item.unread && !pendingReadIdsRef.current.has(item.id),
              )
              .map((item) => item.id),
          );
          setUnreadAlerts(unreadAlertIdsRef.current.size);
        })
        .catch(() => undefined);
    };
    const syncRead = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          id: string;
          phase: "pending" | "committed" | "rollback";
        }>
      ).detail;
      if (!detail?.id) return;
      if (detail.phase === "pending") {
        pendingReadIdsRef.current.add(detail.id);
        unreadAlertIdsRef.current.delete(detail.id);
      } else if (detail.phase === "rollback") {
        pendingReadIdsRef.current.delete(detail.id);
        unreadAlertIdsRef.current.add(detail.id);
      } else {
        pendingReadIdsRef.current.delete(detail.id);
        unreadAlertIdsRef.current.delete(detail.id);
      }
      setUnreadAlerts(unreadAlertIdsRef.current.size);
    };
    refreshUnread();
    const timer = window.setInterval(refreshUnread, 15_000);
    window.addEventListener("focus", refreshUnread);
    window.addEventListener("antam:alerts-changed", refreshUnread);
    window.addEventListener("antam:alert-status", refreshUnread);
    window.addEventListener("antam:alert-read", syncRead);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshUnread);
      window.removeEventListener("antam:alerts-changed", refreshUnread);
      window.removeEventListener("antam:alert-status", refreshUnread);
      window.removeEventListener("antam:alert-read", syncRead);
    };
  }, []);

  const navigate = (path: RoutePath) => {
    if (path !== activePath) window.history.pushState({}, "", path);
    setActivePath(path);
    setMobileOpen(false);
    setAccountOpen(false);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  };
  const requestLogout = () => {
    setAccountOpen(false);
    setLogoutError("");
    setLogoutConfirmOpen(true);
  };
  const confirmLogout = async () => {
    loggingOutRef.current = true;
    setLogoutPending(true);
    setLogoutError("");
    try {
      await onLogout();
    } catch {
      loggingOutRef.current = false;
      setLogoutError("Không thể đăng xuất lúc này. Vui lòng thử lại.");
      setLogoutPending(false);
    }
  };
  const activeNav =
    navItems.find((item) => item.path === activePath)?.label ?? "Tổng quan";
  const visibleNav = navItems.filter((item) => canAccessRoute(user, item.path));

  return (
    <div
      className={`app-shell ${isMobileLayout ? "mobile-layout" : "desktop-layout"} ${activePath === "/alerts" ? "alerts-active" : ""}`}
    >
      <aside
        className={`sidebar ${mobileOpen ? "is-open" : ""}`}
        aria-label="Điều hướng chính"
        aria-hidden={isMobileLayout && !mobileOpen}
      >
        <button
          className="brand brand-link"
          onClick={() => navigate("/")}
          aria-label="Về Tổng quan"
          title="GuardianCam Local Hub"
        >
          <span className="brand-mark">
            <HeartHandshake />
          </span>
          <span>
            <strong>GuardianCam</strong>
            <small>Local Hub</small>
          </span>
        </button>
        <nav>
          {visibleNav.map(({ label, path, icon: Icon }) => {
            const badge = path === "/alerts" ? unreadAlerts : 0;
            return (
              <a
                key={path}
                href={path}
                title={label}
                data-tooltip={label}
                className={`nav-item ${activePath === path ? "active" : ""}`}
                onClick={(event) => {
                  event.preventDefault();
                  navigate(path);
                }}
                aria-current={activePath === path ? "page" : undefined}
              >
                <Icon />
                <span>{label}</span>
                {badge > 0 ? (
                  <span
                    className="nav-badge"
                    aria-label={`${badge} cảnh báo chưa xem`}
                  >
                    {badge > 99 ? "99+" : badge}
                  </span>
                ) : null}
              </a>
            );
          })}
        </nav>
        <div className="privacy-note">
          <ShieldCheck />
          <div>
            <strong>Dữ liệu được bảo vệ</strong>
            <span>Xử lý cục bộ, không gửi video thô lên cloud.</span>
          </div>
        </div>
      </aside>
      {isMobileLayout && mobileOpen && (
        <button
          className="scrim"
          aria-label="Đóng menu"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <main className="main-content">
        <header className="topbar">
          <button
            className="icon-button menu-button"
            onClick={() => setMobileOpen(true)}
            aria-label="Mở menu"
          >
            <Menu />
          </button>
          <button
            className="mobile-brand"
            onClick={() => navigate("/")}
            aria-label="Về Tổng quan"
          >
            <span className="brand-mark">
              <HeartHandshake />
            </span>
          </button>
          <div className="topbar-spacer" />
          {activePath === "/alerts" && (
            <span className="topbar-protection">
              <ShieldCheck /> Đang bảo vệ
            </span>
          )}
          <Tooltip
            content={`Giao diện: ${theme === "light" ? "Sáng" : theme === "dark" ? "Tối" : "Theo hệ thống"}`}
          >
            <IconButton
              className="theme-toggle"
              variant="secondary"
              label="Chuyển chế độ giao diện"
              onClick={cycleTheme}
            >
              {theme === "light" ? (
                <Sun />
              ) : theme === "dark" ? (
                <Moon />
              ) : (
                <Monitor />
              )}
            </IconButton>
          </Tooltip>
          <div className="account-control" ref={accountRef}>
            <button
              type="button"
              className="account-trigger"
              aria-label="Mở menu tài khoản"
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen((open) => !open)}
            >
              <span className="avatar small">{user.name[0]}</span>
              <span className="account-trigger-copy">
                <strong>{user.name}</strong>
                <small>
                  {user.role === "admin" ? "Quản trị viên" : "Người chăm sóc"}
                </small>
              </span>
              <ChevronDown className="account-chevron" />
            </button>
            {accountOpen && (
              <div className="account-menu" role="menu">
                <div className="account-menu-header">
                  <span className="avatar small">{user.name[0]}</span>
                  <span>
                    <strong>{user.name}</strong>
                    <small>
                      {user.role === "admin"
                        ? "Quản trị viên"
                        : "Người chăm sóc"}
                    </small>
                  </span>
                </div>
                <div className="account-menu-divider" />
                <button
                  type="button"
                  className="account-logout"
                  role="menuitem"
                  onClick={requestLogout}
                >
                  <LogOut />
                  <span>Đăng xuất</span>
                </button>
              </div>
            )}
          </div>
        </header>
        <div
          className={`route-content ${activeNav === "Tổng quan" ? "overview-route" : ""} ${activePath === "/history" ? "history-route" : ""} ${activePath === "/family" ? "family-route" : ""}`}
          key={`${activePath}-${routeRevision}`}
        >
          <RouteContent path={activePath} />
        </div>
      </main>
      {isMobileLayout && (
        <nav
          className="mobile-bottom-nav"
          aria-label="Điều hướng nhanh trên điện thoại"
        >
          {visibleNav.filter((item) => navItems.slice(0, 4).some(({ path }) => path === item.path)).map(({ label, path, icon: Icon }) => {
            const badge = path === "/alerts" ? unreadAlerts : 0;
            return (
              <a
                key={path}
                href={path}
                className={activePath === path ? "active" : ""}
                onClick={(event) => {
                  event.preventDefault();
                  navigate(path);
                }}
                aria-current={activePath === path ? "page" : undefined}
              >
                <span className="mobile-nav-icon">
                  <Icon />
                  {badge > 0 ? (
                    <span
                      className="mobile-nav-badge"
                      aria-label={`${badge} cảnh báo chưa xem`}
                    >
                      {badge > 99 ? "99+" : badge}
                    </span>
                  ) : null}
                </span>
                <span>{label}</span>
              </a>
            );
          })}
          <button
            type="button"
            className={
              navItems.slice(4).some(({ path }) => path === activePath)
                ? "active"
                : ""
            }
            onClick={() => setMobileOpen(true)}
            aria-expanded={mobileOpen}
          >
            <MoreHorizontal />
            <span>Thêm</span>
          </button>
        </nav>
      )}
      {alertToast && (
        <div className="realtime-alert-toast" role="status" aria-live="assertive">
          <Bell />
          <span><strong>Có cảnh báo mới</strong><small>Mở mục Cảnh báo để xem chi tiết.</small></span>
        </div>
      )}
      {soundPermissionHint && (
        <div className={`alert-sound-permission ${alertToast ? "" : "standalone"}`} role="status">
          <AlertTriangle />
          <span><strong>Chưa thể phát âm thanh</strong><small>Chạm vào trang hoặc nút bên cạnh để cho phép âm thanh cảnh báo.</small></span>
          <button type="button" onClick={() => void alertPlayerRef.current?.unlock().then((allowed) => setSoundPermissionHint(!allowed))}>Bật âm thanh</button>
        </div>
      )}
      {logoutConfirmOpen && (
        <div
          className="logout-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !logoutPending)
              setLogoutConfirmOpen(false);
          }}
        >
          <section
            className="logout-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="logout-dialog-title"
            aria-describedby="logout-dialog-description"
          >
            <span className="logout-dialog-icon">
              <LogOut />
            </span>
            <h2 id="logout-dialog-title">Đăng xuất</h2>
            <p id="logout-dialog-description">
              Bạn có chắc chắn muốn đăng xuất không?
            </p>
            {logoutError && (
              <p className="logout-dialog-error" role="alert">
                {logoutError}
              </p>
            )}
            <div className="logout-dialog-actions">
              <button
                ref={cancelLogoutRef}
                type="button"
                className="logout-cancel"
                disabled={logoutPending}
                onClick={() => setLogoutConfirmOpen(false)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="logout-confirm"
                disabled={logoutPending}
                onClick={() => void confirmLogout()}
              >
                {logoutPending ? "Đang đăng xuất…" : "Đăng xuất"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function ForbiddenPage() {
  return <section className="forbidden-page" role="alert"><ShieldCheck /><h1>403</h1><h2>Bạn không có quyền truy cập</h2><p>Hãy liên hệ quản trị viên nếu bạn cần sử dụng chức năng này.</p></section>;
}

function RouteContent({ path }: { path: RoutePath }) {
  const { user, hasPermission } = useAuth();
  if (!canAccessRoute(user, path)) return <ForbiddenPage />;
  if (path === "/camera") return <CameraPage canManageCamera={hasPermission("manage_cameras")} />;
  if (path === "/alerts") return <AlertsPage canAcknowledge={hasPermission("acknowledge_alerts")} canResolve={hasPermission("resolve_alerts")} />;
  if (path === "/family") return <FamilyPage />;
  if (path === "/history") return <HistoryPage />;
  if (path === "/statistics") return <StatisticsPage />;
  if (path === "/settings")
    return <SettingsPage isAdmin={user.role === "admin"} userId={user.id} canManageCameras={hasPermission("manage_cameras")} canManageUsers={user.role === "admin"} />;
  return <OverviewPage />;
}

function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, []);
  if (checking)
    return (
      <div className="auth-loading" aria-label="Đang tải">
        Đang tải…
      </div>
    );
  if (!user || user.force_password_change)
    return <LoginPage user={user} onAuthenticated={setUser} />;
  return (
    <AuthProvider initialUser={user}>
      <DashboardApp
        onLogout={async () => {
          await logout();
          setUser(null);
        }}
      />
    </AuthProvider>
  );
}

export default App;
