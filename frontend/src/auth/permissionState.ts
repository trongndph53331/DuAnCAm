import type { PermissionKey, SettingsUser } from "../api/settings";

export async function requestPermissionChange(
  user: SettingsUser,
  permission: PermissionKey,
  granted: boolean,
  request: (userId: string, key: PermissionKey, value: boolean) => Promise<SettingsUser>,
): Promise<{ user: SettingsUser; error: boolean }> {
  try {
    return { user: await request(user.id, permission, granted), error: false };
  } catch {
    return { user, error: true };
  }
}
