import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth";

export default function NavBar() {
  const { user, logout } = useAuth() || {};
  const loc = useLocation();
  return (
    <header className="nav">
      <div className="brand">AutoGradeAI</div>
      <nav>
        {user ? (
          <>
            <Link to="/app" className={loc.pathname === "/app" ? "active" : ""}>Dashboard</Link>
            <button onClick={logout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login" className={loc.pathname === "/login" ? "active" : ""}>Login</Link>
            <Link to="/register" className={loc.pathname === "/register" ? "active" : ""}>Register</Link>
          </>
        )}
      </nav>
    </header>
  );
}
