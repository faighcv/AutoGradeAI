import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth";

export default function Login() {
  const nav = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("STUDENT");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      // The backend expects "PROF" or "STUDENT" only
      await login(email, password, role);
      nav("/app");
    } catch (error) {
      console.error("Login failed:", error?.response?.data || error);
      setErr("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h1>Welcome back</h1>
      <p className="muted">Sign in to continue.</p>

      <form onSubmit={onSubmit} className="form">
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <label>
          Role
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            required
          >
            <option value="STUDENT">Student</option>
            <option value="PROF">Professor</option>
          </select>
        </label>

        {err && <div className="error">{err}</div>}

        <button className="primary" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="muted">
        No account? <Link to="/register">Create one</Link>
      </p>
    </div>
  );
}
