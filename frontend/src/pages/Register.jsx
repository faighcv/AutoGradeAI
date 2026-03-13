import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as api from "../api";

export default function Register() {
  const nav = useNavigate();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole]         = useState("STUDENT");
  const [err, setErr]           = useState("");
  const [ok, setOk]             = useState("");
  const [loading, setLoading]   = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(""); setOk("");
    setLoading(true);
    try {
      await api.register(email, password, role);
      setOk("Account created! Redirecting to login…");
      setTimeout(() => nav("/login"), 1200);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-text">AutoGradeAI</div>
        </div>

        <h1 className="auth-title">Create an account</h1>
        <p className="auth-sub">Join as a professor or student.</p>

        <form onSubmit={onSubmit}>
          <div className="form-field">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              placeholder="you@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label">I am a…</label>
            <select
              className="form-input"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="STUDENT">Student</option>
              <option value="PROF">Professor</option>
            </select>
          </div>

          {err && <div className="alert alert-error mb-16">{err}</div>}
          {ok  && <div className="alert alert-success mb-16">{ok}</div>}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", justifyContent: "center" }}
            disabled={loading}
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?&nbsp;
          <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
