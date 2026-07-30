import type { SecurityEvent } from "../../types";
export const mockEvents: SecurityEvent[] = [{
  id: "event-fall-lan", cameraId: "cam-bedroom", cameraName: "Camera phòng ngủ", zoneId: "bedroom", zoneName: "Phòng ngủ",
  eventType: "fall_with_immobility", severity: "high", status: "pending_review", occurredAt: new Date().toISOString(),
  description: "Có khả năng té ngã", identity: { memberId: "member-lan", memberName: "Bà Lan", status: "recognized", confidence: .96 },
  fall: { confidence: .91, immobileSeconds: 12 }, snapshotUrl: null,
}];

