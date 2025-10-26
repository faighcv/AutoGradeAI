import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as api from "../api";

export default function Register() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("STUDENT");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(""); setOk("");
    try {
      await api.register(email, password, role);
      setOk("Registered! You can now log in.");
      setTimeout(()=>nav("/login"), 600);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Registration failed");
    }
  };

  return (
    <div className="card">
      <h1>Create an account</h1>
      <form onSubmit={onSubmit} className="form">
        <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></label>
        <label>Role
          <select value={role} onChange={e=>setRole(e.target.value)}>
            <option value="STUDENT">Student</option>
            <option value="PROF">Professor</option>
          </select>
        </label>
        {err && <div className="error">{err}</div>}
        {ok && <div className="success">{ok}</div>}
        <button className="primary">Register</button>
      </form>
      <p className="muted">Already have an account? <Link to="/login">Log in</Link></p>
    </div>
  );
}
