import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { http } from "./api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  async function loadProfile(session) {
    if (!session) { setUser(null); return; }
    try {
      const { data } = await http.get("/auth/me", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setUser(data);
    } catch {
      setUser(null);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      loadProfile(session).finally(() => setChecking(false));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      loadProfile(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
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
    <AuthCtx.Provider value={{ user, setUser, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
