import type { AlertEvent, ChatMessage, QuickAction } from "./alert.types";

export const initialAlerts: AlertEvent[] = [
  { id: "fall-lan", type: "fall", title: "Có khả năng té ngã", subject: "Bà Lan", location: "Phòng ngủ", time: "09:25", timestamp: "09:25:10", severity: "high", status: "pending", unread: true, preview: "Tôi phát hiện tư thế bất thường và chưa thấy chuyển động.", confidence: 91, immobileSeconds: 12 },
  { id: "inactive-minh", type: "inactivity", title: "Không phát hiện hoạt động", subject: "Ông Minh", location: "Phòng khách", time: "08:10", timestamp: "08:10:22", severity: "medium", status: "checking", unread: false, preview: "Đang kiểm tra thời gian không có hoạt động trong phòng." },
  { id: "stranger-back", type: "stranger", title: "Có người lạ xuất hiện", subject: "Camera cửa sau", location: "Cửa sau", time: "02:15", timestamp: "02:15:04", severity: "critical", status: "pending", unread: true, preview: "Một người chưa nhận diện xuất hiện tại khu vực cửa sau." },
  { id: "camera-front", type: "camera", title: "Camera mất kết nối", subject: "Camera sân trước", location: "Sân trước", time: "Hôm qua", timestamp: "Hôm qua, 18:42", severity: "medium", status: "resolved", unread: false, preview: "Kết nối đã được khôi phục và hoạt động ổn định." },
  { id: "arrival-lan", type: "arrival", title: "Bà Lan đã về nhà", subject: "Bà Lan", location: "Cửa chính", time: "Hôm qua", timestamp: "Hôm qua, 16:20", severity: "info", status: "resolved", unread: false, preview: "Bà Lan đã được nhận diện tại cửa chính." },
  { id: "fall-living", type: "fall", title: "Có khả năng té ngã", subject: "Bà Lan", location: "Phòng khách", time: "3 ngày trước", timestamp: "3 ngày trước, 14:05", severity: "high", status: "false_alarm", unread: false, preview: "Sự kiện đã được đánh dấu là cảnh báo sai." },
];

export const quickActions: QuickAction[] = [
  { id: "camera", label: "Xem camera" }, { id: "snapshot", label: "Xem ảnh" },
  { id: "safe", label: "Tôi đã kiểm tra — An toàn" }, { id: "help", label: "Cần người hỗ trợ" },
  { id: "why", label: "Tại sao có cảnh báo?" }, { id: "false_alarm", label: "Đây là cảnh báo sai" },
];

export function createInitialMessages(alert: AlertEvent): ChatMessage[] {
  return [{ id: `intro-${alert.id}`, role: "assistant", contentType: "event", createdAt: alert.time,
    text: alert.type === "fall" ? "Tôi vừa phát hiện một tình huống có thể cần bạn kiểm tra." : `Tôi đã ghi nhận sự kiện “${alert.title}”. Tôi có thể giúp bạn kiểm tra và xử lý.` }];
}

