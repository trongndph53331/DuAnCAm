import type { AuthUser } from "../api/auth";
import type { PermissionKey } from "../api/settings";

export type ProtectedPath = "/" | "/camera" | "/alerts" | "/family" | "/history" | "/statistics" | "/settings";

export const routePermissions: Partial<Record<ProtectedPath, PermissionKey>> = {
  "/family": "manage_family",
  "/history": "view_history",
};

export function hasPermission(user: AuthUser, permission: PermissionKey): boolean {
  return user.role === "admin" || user.permissions[permission] === true;
}

export function canAccessRoute(user: AuthUser, path: ProtectedPath): boolean {
  if (path === "/statistics") return user.role === "admin";
  const permission = routePermissions[path];
  return permission ? hasPermission(user, permission) : true;
}

export function visiblePaths(user: AuthUser, paths: readonly ProtectedPath[]): ProtectedPath[] {
  return paths.filter((path) => canAccessRoute(user, path));
}
