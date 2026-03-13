import React, { createContext, useContext, useEffect, useState } from "react";
import * as api from "./api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true); // true while verifying session

  // On mount: verify the cookie is still valid against the server.
  // If not, clear any stale localStorage and stay logged out.
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
    try {
      await api.logout();
    } catch {
      // ignore backend errors — still clear local state
    }
    setUser(null);
  };

  // Don't render anything until we know whether the session is valid
  if (checking) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#9aa4b2" }}>
        Loading…
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
