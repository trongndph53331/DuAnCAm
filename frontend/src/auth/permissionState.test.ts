import { describe, expect, it, vi } from "vitest";
import type { SettingsUser } from "../api/settings";
import { requestPermissionChange } from "./permissionState";

const user: SettingsUser = {
  id: "caregiver", name: "Caregiver", email: "care@example.test", role: "caregiver", active: true,
  created_at: "2026-01-01", permissions: {
    view_history: true, acknowledge_alerts: false, resolve_alerts: false,
    manage_cameras: false, manage_family: false, manage_users: false,
  },
};

describe("permission switch state", () => {
  it("giữ nguyên công tắc khi API thất bại", async () => {
    const result = await requestPermissionChange(user, "view_history", false, vi.fn().mockRejectedValue(new Error("offline")));
    expect(result.error).toBe(true);
    expect(result.user).toBe(user);
    expect(result.user.permissions.view_history).toBe(true);
  });
});
