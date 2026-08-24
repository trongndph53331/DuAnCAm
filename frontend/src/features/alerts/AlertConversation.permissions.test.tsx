import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { AlertEvent } from "./alert.types";
import { AlertConversation } from "./AlertConversation";

const alert: AlertEvent = {
  id: "alert-1", eventId: "event-1", cameraId: "camera-1", occurredAt: "2026-01-01T00:00:00Z",
  type: "fall", title: "Cảnh báo", subject: "Người thân", location: "Phòng khách", time: "00:00",
  timestamp: "2026-01-01T00:00:00Z", severity: "high", status: "pending", unread: true, preview: "Test",
};

describe("alert action permissions", () => {
  it("disable các nút xác nhận và xử lý khi thiếu quyền", () => {
    const html = renderToStaticMarkup(
      <AlertConversation alert={alert} onBack={vi.fn()} onStatus={vi.fn()} canAcknowledge={false} canResolve={false} />,
    );
    expect(html).toMatch(/alert-action-viewed" disabled=""/);
    expect(html).toMatch(/alert-action-safe" disabled=""/);
    expect(html).toMatch(/alert-action-false" disabled=""/);
  });
});
