import { Camera, Clock3, MapPin, UserRound } from "lucide-react";
import type { AlertEvent } from "./alert.types";
import { SnapshotCard } from "./SnapshotCard";

export function EventDetailCard({ alert, onExpand }: { alert: AlertEvent; onExpand: () => void }) {
  return <article className="event-detail-card">
    <p>Tôi vừa phát hiện một tình huống có thể cần bạn kiểm tra.</p><h3>{alert.title}</h3>
    <div className="event-detail-layout"><div className="event-facts">
      <span><UserRound /> Người<strong>{alert.subject}</strong></span><span><MapPin /> Vị trí<strong>{alert.location}</strong></span>
      <span><Clock3 /> Thời gian<strong>{alert.timestamp}</strong></span><span><Camera /> Không chuyển động<strong>khoảng {alert.immobileSeconds ?? 12} giây</strong></span>
      <span>Độ tin cậy<strong>{alert.confidence ?? 91}%</strong></span><span>Mức độ<strong className="danger-copy">Cao</strong></span>
    </div><SnapshotCard alert={alert} onExpand={onExpand} /></div>
    <p className="event-description">Tôi nhận thấy người trong khung hình chuyển từ tư thế đứng sang nằm và chưa có chuyển động rõ ràng trong khoảng 12 giây.</p>
    <div className="event-mobile-meta"><span>{alert.confidence ?? 91}% khả năng</span><span>{alert.location}</span><span>{alert.time}</span></div>
  </article>;
}
