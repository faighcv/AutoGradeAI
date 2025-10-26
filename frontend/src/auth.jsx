import React, { createContext, useContext, useEffect, useState } from "react";
import * as api from "./api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("ag_user");
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    if (user) localStorage.setItem("ag_user", JSON.stringify(user));
    else localStorage.removeItem("ag_user");
  }, [user]);

  const login = async (email, password) => {
    const u = await api.login(email, password); // cookie set by server
    setUser(u);
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  return <AuthCtx.Provider value={{ user, login, logout, setUser }}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}
