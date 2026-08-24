import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { me, type AuthUser } from "../api/auth";
import type { PermissionKey } from "../api/settings";

type AuthContextValue = {
  user: AuthUser;
  hasPermission: (permission: PermissionKey) => boolean;
  refreshUser: () => Promise<AuthUser>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ initialUser, children }: { initialUser: AuthUser; children: ReactNode }) {
  const [user, setUser] = useState(initialUser);
  const refreshUser = useCallback(async () => {
    const current = await me();
    setUser(current);
    return current;
  }, []);

  useEffect(() => {
    const refresh = () => void refreshUser().catch(() => undefined);
    const timer = window.setInterval(refresh, 10_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("antam:auth-refresh", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("antam:auth-refresh", refresh);
    };
  }, [refreshUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      hasPermission: (permission) => user.role === "admin" || user.permissions[permission] === true,
      refreshUser,
    }),
    [refreshUser, user],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
