import { Bell, Camera, HeartHandshake, MessageCircle, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { initialAlerts } from "../features/alerts/alertMockData";
import type { AlertStatus } from "../features/alerts/alert.types";

const suggestions = [
  { label: "Kiểm tra cảnh báo", path: "/alerts", icon: Bell },
  { label: "Mở camera", path: "/camera", icon: Camera },
];

export default function FloatingAssistant() {
  const [open, setOpen] = useState(false);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, AlertStatus>>({});
  useEffect(() => {
    const syncAlertStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string; status: AlertStatus }>).detail;
      setStatusOverrides((current) => ({ ...current, [detail.id]: detail.status }));
    };
    window.addEventListener("antam:alert-status", syncAlertStatus);
    return () => window.removeEventListener("antam:alert-status", syncAlertStatus);
  }, []);
  const urgentAlerts = initialAlerts.filter((alert) => ["high", "critical"].includes(alert.severity) && ["pending", "need_help"].includes(statusOverrides[alert.id] ?? alert.status));
  const urgentAlert = urgentAlerts[0];

  const navigate = (path: string) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    setOpen(false);
  };

  return <div className={`floating-assistant ${open ? "is-open" : ""} ${urgentAlerts.length > 0 ? "has-urgent-alert" : ""}`}>
    {open && <section className="assistant-popover" aria-label="Trợ lý An Tâm">
      <header><span className="assistant-popover-avatar"><HeartHandshake /></span><div><strong>An Tâm</strong><small><i /> Luôn sẵn sàng</small></div><button onClick={() => setOpen(false)} aria-label="Đóng trợ lý"><X /></button></header>
      <div className="assistant-greeting"><Sparkles /><p><strong>Chào Minh!</strong><span>Mình có thể giúp bạn kiểm tra tình trạng gia đình.</span></p></div>
      {urgentAlert && <button className="assistant-urgent-alert" onClick={() => navigate(`/alerts/${encodeURIComponent(urgentAlert.id)}`)}>
        <span className="urgent-alert-icon"><Bell /></span><span><small>Cảnh báo cần chú ý</small><strong>{urgentAlert.title}</strong><em>{urgentAlert.subject} · {urgentAlert.location} · {urgentAlert.time}</em></span><b>Xem ngay</b>
      </button>}
      <div className="assistant-suggestions">{suggestions.map(({ label, path, icon: Icon }) => <button key={path} onClick={() => navigate(path)}><Icon /><span>{label}</span></button>)}</div>
    </section>}
    {!open && <span className={`assistant-nudge ${urgentAlert ? "urgent" : ""}`}>{urgentAlert ? `${urgentAlerts.length} cảnh báo cần kiểm tra` : "Bạn cần giúp gì không?"}</span>}
    <button className="assistant-pet" onClick={() => setOpen((value) => !value)} aria-label={open ? "Đóng trợ lý An Tâm" : "Mở trợ lý An Tâm"} aria-expanded={open}>
      <span className="pet-glow" />
      <span className="pet-body"><HeartHandshake /><i className="pet-eye left" /><i className="pet-eye right" /></span>
      <span className="pet-status" />
      {urgentAlerts.length > 0 && <span className="pet-alert-badge">{urgentAlerts.length}</span>}
      <MessageCircle className="pet-chat-mark" />
    </button>
  </div>;
}
