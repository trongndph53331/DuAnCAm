import { describe, expect, it } from "vitest";
import type { AuthUser } from "../api/auth";
import { canAccessRoute, visiblePaths } from "./accessControl";

const caregiver = (permissions: Partial<AuthUser["permissions"]> = {}): AuthUser => ({
  id: "caregiver", email: "care@example.test", name: "Caregiver", role: "caregiver", active: true,
  force_password_change: false,
  permissions: {
    view_history: false, acknowledge_alerts: false, resolve_alerts: false,
    manage_cameras: false, manage_family: false, manage_users: false, ...permissions,
  },
});

describe("frontend access control", () => {
  it("ẩn menu không có quyền", () => {
    expect(visiblePaths(caregiver(), ["/", "/family", "/history"])).toEqual(["/"]);
  });
  it("chặn URL trực tiếp trước khi render trang", () => {
    expect(canAccessRoute(caregiver(), "/history")).toBe(false);
    expect(canAccessRoute(caregiver({ view_history: true }), "/history")).toBe(true);
  });
  it("áp dụng user mới ngay khi quyền bị thu hồi", () => {
    expect(canAccessRoute(caregiver({ manage_family: true }), "/family")).toBe(true);
    expect(canAccessRoute(caregiver({ manage_family: false }), "/family")).toBe(false);
  });
});
