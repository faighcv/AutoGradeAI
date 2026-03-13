import React, { createContext, useContext, useEffect, useState } from "react";
import * as api from "./api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api.http
      .get("/auth/me")
      .then(({ data }) => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, []);

  const login = async (email, password) => {
    const u = await api.login(email, password);
    setUser(u);
  };

  const logout = async () => {
    try { await api.logout(); } catch {}
    setUser(null);
  };

  if (checking) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <span className="loading-text">Checking session…</span>
      </div>
    );
  }

  return (
    <AuthCtx.Provider value={{ user, login, logout, setUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
