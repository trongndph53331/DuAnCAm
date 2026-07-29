import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Camera,
  Check,
  CheckCircle2,
  Clock3,
  HeartHandshake,
  History,
  Home,
  Menu,
  Settings,
  ShieldCheck,
  UsersRound,
  Video,
} from "lucide-react";
import CameraPage from "./pages/CameraPage";

type AlertState = "pending" | "safe" | "help";

const navItems = [
  { label: "Tổng quan", icon: Home },
  { label: "Camera", icon: Camera },
  { label: "Cảnh báo", icon: Bell, badge: 1 },
  { label: "Người thân", icon: UsersRound },
  { label: "Lịch sử", icon: History },
  { label: "Thống kê", icon: BarChart3 },
  { label: "Cài đặt", icon: Settings },
];

function App() {
  const [activeNav, setActiveNav] = useState("Tổng quan");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    window.matchMedia("(max-width: 860px)").matches
  );
  const [alertState, setAlertState] = useState<AlertState>("pending");
  const [elderMode, setElderMode] = useState(false);

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 860px)");
    const syncLayout = () => {
      setIsMobileLayout(mobileQuery.matches);
      setMobileOpen(false);
    };

    syncLayout();
    mobileQuery.addEventListener("change", syncLayout);
    window.addEventListener("resize", syncLayout);
    window.visualViewport?.addEventListener("resize", syncLayout);

    return () => {
      mobileQuery.removeEventListener("change", syncLayout);
      window.removeEventListener("resize", syncLayout);
      window.visualViewport?.removeEventListener("resize", syncLayout);
    };
  }, []);

  const statusCopy = useMemo(() => {
    if (alertState === "safe") return "Đã được người thân kiểm tra — An toàn";
    if (alertState === "help") return "Người chăm sóc đã được yêu cầu hỗ trợ";
    return "Đang chờ người thân xác nhận";
  }, [alertState]);

  if (elderMode) {
    return (
      <main className="elder-screen">
        <div className="elder-card" role="alert" aria-live="assertive">
          <div className="elder-icon"><AlertTriangle aria-hidden="true" /></div>
          <p className="eyebrow danger-text">Thông báo an toàn</p>
          <h1>Hệ thống phát hiện bạn có thể vừa bị ngã.</h1>
          <p className="elder-help">Nếu bạn vẫn ổn, hãy bấm nút lớn bên dưới để báo cho người thân.</p>
          <button
            className="elder-safe-button"
            onClick={() => {
              setAlertState("safe");
              setElderMode(false);
            }}
          >
            <CheckCircle2 aria-hidden="true" />
            Bấm vào đây nếu tôi vẫn ổn
          </button>
          <div className="audio-placeholder"><Activity aria-hidden="true" /> Âm thanh nhắc sẽ được hỗ trợ sau</div>
        </div>
      </main>
    );
  }

  return (
    <div className={`app-shell ${isMobileLayout ? "mobile-layout" : "desktop-layout"}`}>
      <aside
        className={`sidebar ${mobileOpen ? "is-open" : ""}`}
        aria-label="Điều hướng chính"
        aria-hidden={isMobileLayout && !mobileOpen}
      >
        <div className="brand">
          <span className="brand-mark"><HeartHandshake aria-hidden="true" /></span>
          <span><strong>An Tâm</strong><small>Home Care</small></span>
        </div>
        <nav>
          {navItems.map(({ label, icon: Icon, badge }) => (
            <button
              key={label}
              className={`nav-item ${activeNav === label ? "active" : ""}`}
              onClick={() => {
                setActiveNav(label);
                setMobileOpen(false);
              }}
              aria-current={activeNav === label ? "page" : undefined}
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
              {badge ? <span className="nav-badge" aria-label={`${badge} cảnh báo chờ xử lý`}>{badge}</span> : null}
            </button>
          ))}
        </nav>
        <div className="privacy-note">
          <ShieldCheck aria-hidden="true" />
          <div><strong>Dữ liệu được bảo vệ</strong><span>Xử lý cục bộ, không gửi video thô lên cloud.</span></div>
        </div>
      </aside>

      {isMobileLayout && mobileOpen && <button className="scrim" aria-label="Đóng menu" onClick={() => setMobileOpen(false)} />}

      <main className="main-content">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setMobileOpen(true)} aria-label="Mở menu"><Menu /></button>
          <div className="topbar-spacer" />
          <button className="notification-button" aria-label="Có một cảnh báo chưa xác nhận"><Bell /><span /></button>
          <div className="profile"><span className="avatar small">M</span><span><strong>Minh Nguyễn</strong><small>Người chăm sóc</small></span></div>
        </header>

        <div className={`route-content ${activeNav === "Tổng quan" ? "overview-route" : ""}`} key={activeNav}>
        {activeNav === "Camera" ? <CameraPage /> : <section className="page-wrap">
          <div className="page-heading">
            <div><p className="eyebrow">Thứ Tư, 29 tháng 7</p><h1>Chào Minh, tình trạng gia đình hôm nay</h1><p>Biết người thân vẫn an toàn, ngay cả khi bạn không ở bên cạnh.</p></div>
          </div>

          <section className="system-banner" aria-label="Trạng thái hệ thống">
            <span className="status-icon safe"><Check /></span>
            <div><h2>Hệ thống đang hoạt động ổn định</h2><p>Không có cảnh báo khẩn cấp mới. Một sự kiện đang chờ bạn xác nhận.</p></div>
            <span className="status-label safe"><CheckCircle2 /> Đang bảo vệ</span>
          </section>

          <section className="stats-grid" aria-label="Số liệu tổng quan">
            <StatCard icon={Video} label="Camera trực tuyến" value="3/3" detail="Tất cả đang hoạt động" tone="blue" />
            <StatCard icon={Activity} label="Sự kiện hôm nay" value="5" detail="4 sự kiện đã xử lý" tone="green" />
            <StatCard icon={Clock3} label="Chờ xác nhận" value="1" detail="Cần bạn kiểm tra" tone="orange" />
          </section>

          <section className="dashboard-grid">
            <div className="content-column">
              <section className={`fall-alert state-${alertState}`} aria-live="polite">
                <div className="fall-title-row">
                  <span className="status-icon danger"><AlertTriangle /></span>
                  <div><p className="eyebrow danger-text">Cảnh báo cần chú ý</p><h2>Phát hiện khả năng té ngã</h2></div>
                  <span className={`status-label ${alertState === "safe" ? "safe" : alertState === "help" ? "warning" : "pending"}`}>{alertState === "safe" ? <CheckCircle2 /> : alertState === "help" ? <HeartHandshake /> : <Clock3 />}{statusCopy}</span>
                </div>
                <div className="fall-details"><span><Camera /> Phòng ngủ người lớn tuổi</span><span><Clock3 /> 09:25:10</span></div>
                <p className="fall-description">Hệ thống phát hiện một tư thế có khả năng té ngã và người trong khung hình đã bất động khoảng 12 giây. Vui lòng kiểm tra để đảm bảo an toàn.</p>
                <div className="alert-actions">
                  <button className="secondary-button"><Video /> Xem sự kiện</button>
                  <button className="safe-button" onClick={() => setAlertState("safe")}><CheckCircle2 /> Tôi đã kiểm tra — An toàn</button>
                  <button className="danger-button" onClick={() => setAlertState("help")}><HeartHandshake /> Cần người hỗ trợ</button>
                </div>
              </section>
            </div>
          </section>
        </section>}
        </div>
      </main>

      {isMobileLayout && (
        <nav className="mobile-bottom-nav" aria-label="Điều hướng nhanh trên điện thoại">
          {navItems.slice(0, 4).map(({ label, icon: Icon, badge }) => (
            <button
              key={label}
              className={activeNav === label ? "active" : ""}
              onClick={() => {
                setActiveNav(label);
                setMobileOpen(false);
              }}
              aria-current={activeNav === label ? "page" : undefined}
            >
              <span className="mobile-nav-icon">
                <Icon aria-hidden="true" />
                {badge ? <span className="mobile-nav-badge">{badge}</span> : null}
              </span>
              <span>{label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, detail, tone }: { icon: typeof Camera; label: string; value: string; detail: string; tone: string }) {
  return <article className="stat-card"><span className={`stat-icon ${tone}`}><Icon /></span><div><p>{label}</p><strong>{value}</strong><span>{detail}</span></div></article>;
}

export default App;
