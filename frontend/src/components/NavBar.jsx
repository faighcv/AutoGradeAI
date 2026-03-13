import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth";

export default function NavBar() {
  const { user, logout } = useAuth() || {};
  const loc = useLocation();

  return (
    <header className="nav">
      <div className="nav-brand">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{stroke:"url(#grad)"}}>
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a78bfa"/>
              <stop offset="100%" stopColor="#7c3aed"/>
            </linearGradient>
          </defs>
          <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
          <path d="M6 12v5c3 3 9 3 12 0v-5"/>
        </svg>
        AutoGradeAI
      </div>

      <div className="nav-right">
        {user ? (
          <>
            <div className="nav-user">
              <strong>{user.email}</strong>
              &nbsp;·&nbsp;{user.role === "PROF" ? "Professor" : "Student"}
            </div>
            <button className="btn-logout" onClick={logout}>Sign out</button>
          </>
        ) : (
          <div className="nav-links">
            <Link to="/login" className={loc.pathname === "/login" ? "active" : ""}>Sign in</Link>
            <Link to="/register" className={loc.pathname === "/register" ? "active" : ""}>Register</Link>
          </div>
        )}
      </div>
    </header>
  );
}
