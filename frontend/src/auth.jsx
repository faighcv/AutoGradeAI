import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { http, createProfile } from "./api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]               = useState(null);
  const [checking, setChecking]       = useState(true);
  const [needsRoleSetup, setNeedsRoleSetup] = useState(false);
  const [roleLoading, setRoleLoading] = useState(false);

  async function loadProfile(session) {
    if (!session) { setUser(null); return; }
    try {
      const { data } = await http.get("/auth/me", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      // Social login users have no role in Supabase metadata — ask them once
      const provider = session.user?.app_metadata?.provider;
      const hasRole  = session.user?.user_metadata?.role;
      if (provider && provider !== "email" && !hasRole) {
        setNeedsRoleSetup(true);
      }
      setUser(data);
    } catch {
      setUser(null);
    }
  }

  async function confirmRole(role) {
    setRoleLoading(true);
    try {
      const updated = await createProfile(role);
      await supabase.auth.updateUser({ data: { role } });
      setUser(updated);
      setNeedsRoleSetup(false);
    } catch {}
    finally { setRoleLoading(false); }
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
      {needsRoleSetup && (
        <div className="role-modal-overlay">
          <div className="role-modal">
            <h2 className="role-modal-title">One quick thing</h2>
            <p className="role-modal-sub">How will you be using this?</p>
            <div className="role-modal-btns">
              <button className="role-btn" onClick={() => confirmRole("STUDENT")} disabled={roleLoading}>
                <span className="role-btn-icon">🎓</span>
                <span className="role-btn-label">Student</span>
                <span className="role-btn-desc">Submit exams &amp; view feedback</span>
              </button>
              <button className="role-btn" onClick={() => confirmRole("PROF")} disabled={roleLoading}>
                <span className="role-btn-icon">📋</span>
                <span className="role-btn-label">Teacher</span>
                <span className="role-btn-desc">Create exams &amp; grade submissions</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
