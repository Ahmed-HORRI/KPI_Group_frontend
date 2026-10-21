import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import apiClient, { setAuthFailureHandler } from "../api/client";

const AuthContext = createContext(null);

// Session state for the whole app. The session itself lives in an HttpOnly
// cookie the page cannot read; GET /api/auth/me says who it belongs to.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [sessionExpired, setSessionExpired] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await apiClient.get("/api/auth/me");
      setUser(res.data?.user || null);
      setStatus("ready");
      return res.data?.user || null;
    } catch {
      setUser(null);
      setStatus("error");
      return null;
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    setAuthFailureHandler((reason) => {
      if (reason === "expired") {
        setSessionExpired(true);
        setUser(null);
      } else if (reason === "password-change") {
        setUser((current) => (current ? { ...current, must_change_password: true } : current));
      }
    });
    return () => setAuthFailureHandler(null);
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await apiClient.post("/api/auth/login", { email, password });
    setSessionExpired(false);
    setUser(res.data.user);
    setStatus("ready");
    return res.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post("/api/auth/logout");
    } finally {
      setSessionExpired(false);
      setUser(null);
    }
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const res = await apiClient.post("/api/auth/change-password", {
      current_password: currentPassword,
      new_password: newPassword,
    });
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      sessionExpired,
      isAdmin: user?.role === "admin",
      refresh,
      login,
      logout,
      changePassword,
    }),
    [user, status, sessionExpired, refresh, login, logout, changePassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>.");
  return context;
}
