// frontend/src/pages/Professor.jsx
import { useState } from "react";
import * as api from "../api";
import { useAuth } from "../auth.jsx";

export default function Professor() {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState(""); // datetime-local string
  const [exam, setExam] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [flags, setFlags] = useState([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // Normalize datetime-local to ISO string that FastAPI accepts
  const toIsoUtc = (s) => {
    if (!s) return null;
    // Ensure there's a 'T' between date and time (handles locales like "YYYY-MM-DD HH:MM")
    const normalized = s.includes("T") ? s : s.replace(" ", "T");
    const local = new Date(normalized);
    if (Number.isNaN(local.getTime())) return null;
    // Convert local time to an ISO string that preserves the same wall-clock time
    const iso = new Date(local.getTime() - local.getTimezoneOffset() * 60000).toISOString();
    return iso;
  };

  const create = async () => {
    setErr("");
    setMsg("");
    try {
      const iso = toIsoUtc(dueAt);
      if (!iso) {
        setErr("Please select a valid deadline");
        return;
      }
      const e = await api.createExam({ title, due_at: iso });
      setExam(e);
      setMsg("Exam created. Now upload the solution PDF.");
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        e?.response?.data?.message ||
        e?.message ||
        "Failed to create exam";
      console.error("Create exam error:", e?.response || e);
      setErr(msg);
    }
  };

  const upload = async () => {
    setErr("");
    setMsg("");
    try {
      await api.uploadSolutionPdf(exam.id, pdf);
      setMsg("Solution uploaded and questions synced!");
      const f = await api.fetchFlags(exam.id);
      setFlags(f);
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        e?.response?.data?.message ||
        e?.message ||
        "Upload failed";
      console.error("Upload error:", e?.response || e);
      setErr(msg);
    }
  };

  return (
    <div className="grid2">
      <div className="card">
        <h2>Create exam</h2>
        <label>
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Midterm 1"
          />
        </label>
        <label>
          Deadline (UTC)
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
        </label>
        <button className="primary" onClick={create}>
          Create
        </button>
      </div>

      {msg && (
        <div className="card">
          <h2>Status</h2>
          <div className="banner success">{msg}</div>
        </div>
      )}
      {err && (
        <div className="card">
          <h2>Error</h2>
          <div className="banner error">{err}</div>
        </div>
      )}

      {exam && (
        <div className="card">
          <h2>Upload solution PDF</h2>
          <p className="muted">
            Exam: <b>{exam.title}</b> · ID {exam.id}
          </p>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setPdf(e.target.files?.[0] || null)}
          />
          <button disabled={!pdf} onClick={upload}>
            Upload &amp; Sync
          </button>
        </div>
      )}

      {!!flags.length && (
        <div className="card full">
          <h2>Potential Similarity Flags</h2>
          <table>
            <thead>
              <tr>
                <th>Sub A</th>
                <th>Sub B</th>
                <th>Question</th>
                <th>Semantic</th>
                <th>Jaccard</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((f) => (
                <tr key={f.id}>
                  <td>{f.submission_a}</td>
                  <td>{f.submission_b}</td>
                  <td>{f.question_id}</td>
                  <td>{f.sem}</td>
                  <td>{f.jacc}</td>
                  <td>{f.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
