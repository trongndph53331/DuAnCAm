import { useMemo, useState } from "react";
import { Activity, AlertTriangle, Camera, Check, CheckCircle2, Clock3, HeartHandshake, Video } from "lucide-react";

type AlertState = "pending" | "safe" | "help";

export default function OverviewPage() {
  const [alertState, setAlertState] = useState<AlertState>("pending");
  const [elderMode, setElderMode] = useState(false);
  const statusCopy = useMemo(() => alertState === "safe" ? "Đã được người thân kiểm tra — An toàn" : alertState === "help" ? "Người chăm sóc đã được yêu cầu hỗ trợ" : "Đang chờ người thân xác nhận", [alertState]);

  if (elderMode) return <main className="elder-screen"><div className="elder-card" role="alert" aria-live="assertive"><div className="elder-icon"><AlertTriangle /></div><p className="eyebrow danger-text">Thông báo an toàn</p><h1>Hệ thống phát hiện bạn có thể vừa bị ngã.</h1><p className="elder-help">Nếu bạn vẫn ổn, hãy bấm nút lớn bên dưới để báo cho người thân.</p><button className="elder-safe-button" onClick={() => { setAlertState("safe"); setElderMode(false); }}><CheckCircle2 />Bấm vào đây nếu tôi vẫn ổn</button><div className="audio-placeholder"><Activity /> Âm thanh nhắc sẽ được hỗ trợ sau</div></div></main>;

  return <section className="page-wrap">
    <div className="page-heading"><div><p className="eyebrow">Thứ Tư, 29 tháng 7</p><h1>Chào Minh, tình trạng gia đình hôm nay</h1><p>Biết người thân vẫn an toàn, ngay cả khi bạn không ở bên cạnh.</p></div></div>
    <section className="system-banner" aria-label="Trạng thái hệ thống"><span className="status-icon safe"><Check /></span><div><h2>Hệ thống đang hoạt động ổn định</h2><p>Không có cảnh báo khẩn cấp mới. Một sự kiện đang chờ bạn xác nhận.</p></div><span className="status-label safe"><CheckCircle2 /> Đang bảo vệ</span></section>
    <section className="stats-grid" aria-label="Số liệu tổng quan"><StatCard icon={Video} label="Camera trực tuyến" value="3/3" detail="Tất cả đang hoạt động" tone="blue" /><StatCard icon={Activity} label="Sự kiện hôm nay" value="5" detail="4 sự kiện đã xử lý" tone="green" /><StatCard icon={Clock3} label="Chờ xác nhận" value="1" detail="Cần bạn kiểm tra" tone="orange" /></section>
    <section className="dashboard-grid"><div className="content-column"><section className={`fall-alert state-${alertState}`} aria-live="polite"><div className="fall-title-row"><span className="status-icon danger"><AlertTriangle /></span><div><p className="eyebrow danger-text">Cảnh báo cần chú ý</p><h2>Phát hiện khả năng té ngã</h2></div><span className={`status-label ${alertState === "safe" ? "safe" : alertState === "help" ? "warning" : "pending"}`}>{alertState === "safe" ? <CheckCircle2 /> : alertState === "help" ? <HeartHandshake /> : <Clock3 />}{statusCopy}</span></div><div className="fall-details"><span><Camera /> Phòng ngủ người lớn tuổi</span><span><Clock3 /> 09:25:10</span></div><p className="fall-description">Hệ thống phát hiện một tư thế có khả năng té ngã và người trong khung hình đã bất động khoảng 12 giây. Vui lòng kiểm tra để đảm bảo an toàn.</p><div className="alert-actions"><button className="secondary-button"><Video /> Xem sự kiện</button><button className="safe-button" onClick={() => setAlertState("safe")}><CheckCircle2 /> Tôi đã kiểm tra — An toàn</button><button className="danger-button" onClick={() => setAlertState("help")}><HeartHandshake /> Cần người hỗ trợ</button></div></section></div></section>
    <button className="overview-elder-trigger" onClick={() => setElderMode(true)}>Mô phỏng cảnh báo trên màn hình người thân</button>
  </section>;
}

function StatCard({ icon: Icon, label, value, detail, tone }: { icon: typeof Camera; label: string; value: string; detail: string; tone: string }) { return <article className="stat-card"><span className={`stat-icon ${tone}`}><Icon /></span><div><p>{label}</p><strong>{value}</strong><span>{detail}</span></div></article>; }

