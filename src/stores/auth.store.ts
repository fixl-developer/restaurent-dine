/**
 * Auth state — staff JWT + user + permissions, persisted to localStorage.
 * Phase 0 ships the skeleton; Phase 1 wires login/refresh through the API.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser, LoginResponse } from "@/lib/types";
import { api, configureApiAuth } from "@/lib/api";
import { closeAllSockets, configureSocketAuth } from "@/lib/socket";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;

  setSession: (s: LoginResponse) => void;
  setUser: (user: AuthUser | null) => void;
  setAccessToken: (token: string | null) => void;
  logout: () => void;

  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,

      setSession: (s) =>
        set({
          accessToken: s.accessToken,
          refreshToken: s.refreshToken,
          user: s.user,
        }),
      setUser: (user) => set({ user }),
      setAccessToken: (accessToken) => set({ accessToken }),
      logout: () => {
        closeAllSockets();
        set({ accessToken: null, refreshToken: null, user: null });
      },

      hasPermission: (perm) => {
        const u = get().user;
        if (!u) return false;
        if (u.role.permissions.includes("*")) return true;
        return u.role.permissions.includes(perm);
      },
    }),
    {
      name: "smartdine.auth",
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        user: s.user,
      }),
    },
  ),
);

// HTTP and socket reconnects share one refresh request.
let refreshing: Promise<string | null> | null = null;
function refreshStaffSession(): Promise<string | null> {
  if (refreshing) return refreshing;
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) return Promise.resolve(null);
  refreshing = (async () => {
    try {
      const result = await api.post<{ accessToken: string; user: AuthUser }>(
        "/auth/staff/refresh",
        { refreshToken },
        { noAuth: true },
      );
      // A logout or account switch while the request was in flight must win.
      if (useAuthStore.getState().refreshToken !== refreshToken) return null;
      useAuthStore.getState().setAccessToken(result.accessToken);
      if (result.user) useAuthStore.getState().setUser(result.user);
      return result.accessToken;
    } catch {
      if (useAuthStore.getState().refreshToken === refreshToken)
        useAuthStore.getState().logout();
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}
configureApiAuth({
  getAccessToken: () => useAuthStore.getState().accessToken,
  refreshAccessToken: refreshStaffSession,
  handleUnauthorized: () => useAuthStore.getState().logout(),
});
configureSocketAuth(
  () => useAuthStore.getState().accessToken,
  refreshStaffSession,
);
