import { useEffect, useState, useCallback } from "react";
import * as api from "../api";

// ── Grade breakdown display ───────────────────────────────────────────────────

function GradeBreakdown({ breakdown, examTotal }) {
  if (!breakdown || Object.keys(breakdown).length === 0) {
    return <p className="muted">No breakdown available.</p>;
  }

  return (
    <div className="breakdown-grid">
      {Object.entries(breakdown).map(([qId, data]) => {
        const pts = data?.points ?? 0;
        const fb = data?.feedback || {};
        const maxPts = examTotal
          ? Math.round((examTotal / Object.keys(breakdown).length) * 10) / 10
          : null;

        return (
          <div key={qId} className="breakdown-card">
            <div className="breakdown-header">
              <span className="breakdown-q">Question {qId}</span>
              <span className="breakdown-pts">{pts} pts</span>
            </div>
            {fb.rationale && (
              <p className="breakdown-rationale">{fb.rationale}</p>
            )}
            {fb.strengths?.length > 0 && (
              <div className="breakdown-section">
                <span className="label-success">✓ Strengths</span>
                <ul>
                  {fb.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {fb.missing?.length > 0 && (
              <div className="breakdown-section">
                <span className="label-danger">✗ Missing</span>
                <ul>
                  {fb.missing.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Submission history item ───────────────────────────────────────────────────

function HistoryItem({ sub }) {
  const [open, setOpen] = useState(false);

  const pct =
    sub.grade_total !== null ? Math.round(sub.grade_total) : null;
  const color =
    pct === null ? "" : pct >= 80 ? "text-success" : pct >= 50 ? "text-warn" : "text-danger";

  return (
    <div className="history-item">
      <div
        className="history-item-header"
        onClick={() => setOpen((v) => !v)}
        style={{ cursor: "pointer" }}
      >
        <div>
          <div className="history-exam-title">{sub.exam_title}</div>
          <div className="muted" style={{ fontSize: "0.8rem" }}>
            Submitted {new Date(sub.submitted_at).toLocaleString()}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {pct !== null ? (
            <span className={`grade-pill ${color}`}>{pct} / 100</span>
          ) : (
            <span className="badge badge-muted">{sub.status}</span>
          )}
          <span className="muted">{open ? "▲" : "▼"}</span>
        </div>
      </div>
      {open && (
        <div className="history-breakdown">
          <GradeBreakdown breakdown={sub.breakdown} examTotal={sub.grade_total} />
        </div>
      )}
    </div>
  );
}

// ── Root Student component ────────────────────────────────────────────────────

export default function Student() {
  const [activeTab, setActiveTab] = useState("submit");
  const [openExams, setOpenExams] = useState([]);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [result, setResult] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadOpen = useCallback(async () => {
    try {
      setOpenExams(await api.listOpenExams());
    } catch {
      setErr("Failed to load open exams");
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      setMySubmissions(await api.getMySubmissions());
    } catch {
      console.error("Failed to load submission history");
    }
  }, []);

  useEffect(() => {
    loadOpen();
    loadHistory();
  }, [loadOpen, loadHistory]);

  const submit = async () => {
    setErr("");
    setMsg("");
    setResult(null);
    setSubmitting(true);
    try {
      const r = await api.submitPdf(selected.id, pdf);
      setResult(r);
      setMsg("Submission received and graded!");
      setPdf(null);
      setSelected(null);
      loadOpen();
      loadHistory();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container">
      <div className="tabs">
        <button
          className={`tab ${activeTab === "submit" ? "active" : ""}`}
          onClick={() => setActiveTab("submit")}
        >
          Submit Exam
        </button>
        <button
          className={`tab ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          My Grades ({mySubmissions.length})
        </button>
      </div>

      {/* ── Submit tab ── */}
      {activeTab === "submit" && (
        <div className="grid2">
          <div className="card">
            <h2>Open Exams</h2>
            {openExams.length === 0 ? (
              <p className="muted">No open exams right now.</p>
            ) : (
              <ul className="list">
                {openExams.map((e) => (
                  <li
                    key={e.id}
                    className={selected?.id === e.id ? "sel" : ""}
                    onClick={() => {
                      setSelected(e);
                      setResult(null);
                      setMsg("");
                      setErr("");
                      setPdf(null);
                    }}
                  >
                    <div className="title">{e.title}</div>
                    <div className="muted">
                      Due: {new Date(e.due_at).toLocaleString()}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selected && (
            <div className="card">
              <h2>Upload your answers</h2>
              <p className="muted">
                Exam: <strong>{selected.title}</strong>
              </p>
              <p className="muted" style={{ fontSize: "0.85rem" }}>
                Due: {new Date(selected.due_at).toLocaleString()}
              </p>
              <label className="form-group">
                <span>Answer PDF</span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setPdf(e.target.files?.[0] || null)}
                />
              </label>
              <button
                className="btn-primary"
                disabled={!pdf || submitting}
                onClick={submit}
              >
                {submitting ? "Grading… (this may take a minute)" : "Submit & Grade"}
              </button>
              {err && <div className="banner error">{err}</div>}
            </div>
          )}

          {result && (
            <div className="card full">
              <div className="banner success">{msg}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, margin: "16px 0" }}>
                <span className="grade">{result.grade_total}</span>
                <span className="muted">/ 100 points</span>
              </div>
              <h3>Question Breakdown</h3>
              <GradeBreakdown breakdown={result.breakdown} examTotal={result.grade_total} />
            </div>
          )}
        </div>
      )}

      {/* ── History tab ── */}
      {activeTab === "history" && (
        <div>
          {mySubmissions.length === 0 ? (
            <div className="empty-state">
              <p>You haven't submitted any exams yet.</p>
            </div>
          ) : (
            <div className="history-list">
              {mySubmissions.map((s) => (
                <HistoryItem key={s.submission_id} sub={s} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
