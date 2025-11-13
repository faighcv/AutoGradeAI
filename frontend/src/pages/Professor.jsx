import { useState } from "react";
import * as api from "../api";
import { useAuth } from "../auth.jsx";

export default function Professor() {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [exam, setExam] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [flags, setFlags] = useState([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // Convert datetime-local input → ISO string (UTC)
  const toIsoUtc = (s) => {
    if (!s) return null;
    const normalized = s.includes("T") ? s : s.replace(" ", "T");
    const local = new Date(normalized);
    if (Number.isNaN(local.getTime())) return null;
    return new Date(local.getTime() - local.getTimezoneOffset() * 60000).toISOString();
  };

  // ------------------ Create Exam ------------------
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
      setMsg("✅ Exam created successfully. You can now upload the solution PDF below.");
    } catch (e) {
      const message =
        e?.response?.data?.detail ||
        e?.response?.data?.message ||
        e?.message ||
        "Failed to create exam";
      console.error("Create exam error:", e?.response || e);
      setErr(message);
    }
  };

  // ------------------ Upload PDF ------------------
  const upload = async () => {
    setErr("");
    setMsg("");
    try {
      const res = await api.uploadSolutionPdf(exam.id, pdf);
      setMsg(
        `✅ Upload complete! Detected ${res.questions_detected} questions (${res.total_points} total points).`
      );
      const f = await api.fetchFlags(exam.id);
      setFlags(f);
    } catch (e) {
      const message =
        e?.response?.data?.detail ||
        e?.response?.data?.message ||
        e?.message ||
        "Upload failed";
      console.error("Upload error:", e?.response || e);
      setErr(message);
    }
  };

  return (
    <div className="grid2">
      {/* ------------------ Create Exam ------------------ */}
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

      {/* ------------------ Success Message ------------------ */}
      {msg && (
        <div className="card">
          <h2>Status</h2>
          <div className="banner success">{msg}</div>
        </div>
      )}

      {/* ------------------ Error Message (only if error exists) ------------------ */}
      {err && (
        <div className="card">
          <h2>Error</h2>
          <div className="banner error">{err}</div>
        </div>
      )}

      {/* ------------------ Upload Solution PDF ------------------ */}
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

      {/* ------------------ Similarity Flags Table ------------------ */}
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
