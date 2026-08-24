import { describe, expect, it, vi } from "vitest";

import { AlertNotificationController, type AlertSoundPlayer } from "./alertNotifications";

function player(unlocked = true): AlertSoundPlayer & { play: ReturnType<typeof vi.fn> } {
  return {
    unlocked,
    unlock: vi.fn(async () => true),
    play: vi.fn(() => true),
    close: vi.fn(),
  };
}

describe("AlertNotificationController", () => {
  it("phát âm thanh cho cảnh báo mới", () => {
    const sound = player();
    const controller = new AlertNotificationController(sound, true, vi.fn(), () => 3_000);
    expect(controller.handle({ type: "alert_created", alert: { id: "new-1" } })).toBe("played");
    expect(sound.play).toHaveBeenCalledOnce();
  });

  it("không phát cho cảnh báo cũ, ready hoặc cập nhật trạng thái", () => {
    const sound = player();
    const controller = new AlertNotificationController(sound, true, vi.fn());
    controller.handle({ type: "alert_created", alert: { id: "same" } });
    controller.handle({ type: "alert_created", alert: { id: "same" } });
    controller.handle({ type: "alert_updated", alert: { id: "updated" } });
    controller.handle({ type: "ready" });
    expect(sound.play).toHaveBeenCalledOnce();
  });

  it("không phát khi người dùng tắt âm thanh", () => {
    const sound = player();
    const controller = new AlertNotificationController(sound, false, vi.fn());
    expect(controller.handle({ type: "alert_created", alert: { id: "muted" } })).toBe("muted");
    expect(sound.play).not.toHaveBeenCalled();
  });

  it("giới hạn cảnh báo liên tiếp và không phát chồng", () => {
    const sound = player();
    let now = 10_000;
    const controller = new AlertNotificationController(sound, true, vi.fn(), () => now);
    expect(controller.handle({ type: "alert_created", alert: { id: "first" } })).toBe("played");
    now += 1_000;
    expect(controller.handle({ type: "alert_created", alert: { id: "second" } })).toBe("throttled");
    expect(sound.play).toHaveBeenCalledOnce();
  });
});
