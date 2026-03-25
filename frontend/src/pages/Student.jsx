import { useEffect, useState, useCallback } from "react";
import * as api from "../api";

function JoinExam({ onJoined }) {
  const [code, setCode] = useState("");
  const [err, setErr]   = useState("");
  const [ok, setOk]     = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setOk("");
    if (!code.trim()) return;
    setLoading(true);
    try {
      const exam = await api.joinExam(code.trim());
      setOk(`Joined "${exam.title}"!`);
      setCode("");
      onJoined();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Invalid code");
    } finally { setLoading(false); }
  };

  return (
    <div className="join-exam-bar">
      <form onSubmit={submit} className="join-exam-form">
        <input
          className="form-input join-exam-input"
          placeholder="Enter exam code (e.g. AB12CD34)"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          maxLength={8}
        />
        <button className="btn btn-primary" disabled={loading || !code.trim()}>
          {loading ? "Joining…" : "Join exam"}
        </button>
      </form>
      {err && <div className="alert alert-error" style={{ marginTop: 8 }}>{err}</div>}
      {ok  && <div className="alert alert-success" style={{ marginTop: 8 }}>{ok}</div>}
    </div>
  );
}

// ── Grade breakdown ───────────────────────────────────────────────────────────

function Breakdown({ breakdown }) {
  if (!breakdown || !Object.keys(breakdown).length)
    return <p className="text-muted text-sm">No breakdown available.</p>;
  return (
    <div className="breakdown-grid">
      {Object.entries(breakdown).map(([qId, data]) => {
        const fb = data?.feedback || {};
        return (
          <div key={qId} className="breakdown-card">
            <div className="breakdown-head">
              <span className="breakdown-q">Question {qId}</span>
              <span className="breakdown-pts">{data?.points ?? 0} pts</span>
            </div>
            {fb.rationale && <p className="breakdown-rationale">{fb.rationale}</p>}
            {fb.strengths?.length > 0 && (
              <div className="breakdown-section">
                <div className="breakdown-section-label label-success">✓ Strengths</div>
                <ul>{fb.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            )}
            {fb.missing?.length > 0 && (
              <div className="breakdown-section">
                <div className="breakdown-section-label label-danger">✗ Missing</div>
                <ul>{fb.missing.map((m, i) => <li key={i}>{m}</li>)}</ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Grade colour helper ───────────────────────────────────────────────────────

function GradePill({ total }) {
  if (total === null || total === undefined)
    return <span className="badge badge-muted">Pending</span>;
  const cls = total >= 80 ? "grade-pill-good" : total >= 50 ? "grade-pill-ok" : "grade-pill-poor";
  return <span className={`grade-pill ${cls}`}>{total} / 100</span>;
}

function GradeNum({ total }) {
  const cls = total >= 80 ? "grade-excellent" : total >= 50 ? "grade-good" : "grade-poor";
  return (
    <div className="grade-hero">
      <span className={`grade-num ${cls}`}>{total}</span>
      <span className="grade-denom">/ 100 points</span>
    </div>
  );
}

// ── History item ──────────────────────────────────────────────────────────────

function HistoryItem({ sub }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="history-item">
      <div className="history-head" onClick={() => setOpen(v => !v)}>
        <div>
          <div className="history-exam">{sub.exam_title}</div>
          <div className="history-date">{new Date(sub.submitted_at).toLocaleString()}</div>
        </div>
        <div className="history-right">
          <GradePill total={sub.grade_total} />
          <span className="text-muted text-sm">{open ? "▲" : "▼"}</span>
        </div>
      </div>
      {open && (
        <div className="history-body">
          <Breakdown breakdown={sub.breakdown} />
        </div>
      )}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function Student() {
  const [tab, setTab]         = useState("submit");
  const [openExams, setOpenExams]   = useState([]);
  const [mySubmissions, setMySubs]  = useState([]);
  const [selected, setSelected]     = useState(null);
  const [pdf, setPdf]               = useState(null);
  const [result, setResult]         = useState(null);
  const [err, setErr]               = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadOpen = useCallback(async () => {
    try { setOpenExams(await api.listOpenExams()); } catch {}
  }, []);

  const loadHistory = useCallback(async () => {
    try { setMySubs(await api.getMySubmissions()); } catch {}
  }, []);

  useEffect(() => { loadOpen(); loadHistory(); }, [loadOpen, loadHistory]);

  const submit = async () => {
    setErr(""); setResult(null); setSubmitting(true);
    try {
      const r = await api.submitPdf(selected.id, pdf);
      setResult(r);
      setPdf(null); setSelected(null);
      loadOpen(); loadHistory();
      setTab("submit"); // stay on submit tab to show result
    } catch (e) {
      setErr(e?.response?.data?.detail || "Submission failed");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="container content">
      <JoinExam onJoined={loadOpen} />
      <div className="tabs-bar">
        <button className={`tab-btn ${tab === "submit" ? "active" : ""}`} onClick={() => setTab("submit")}>
          Submit Exam
        </button>
        <button className={`tab-btn ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>
          My Grades
          <span className="tab-badge">{mySubmissions.length}</span>
        </button>
      </div>

      {/* ── Submit tab ─────────────────────────────── */}
      {tab === "submit" && (
        <div>
          {/* Grade result */}
          {result && (
            <div className="card mb-16" style={{ marginBottom: 24 }}>
              <div className="alert alert-success mb-16">Your exam was submitted and graded.</div>
              <GradeNum total={result.grade_total} />
              <div className="divider" />
              <h3 style={{ marginBottom: 12 }}>Question Breakdown</h3>
              <Breakdown breakdown={result.breakdown} />
            </div>
          )}

          <div className="grid2">
            {/* Exam list */}
            <div>
              <h2 style={{ marginBottom: 16 }}>Open Exams</h2>
              {openExams.length === 0 ? (
                <div className="empty" style={{ padding: "32px 0" }}>
                  <div className="empty-icon">📋</div>
                  <div className="empty-title">No open exams</div>
                  <div className="empty-desc">Check back later for upcoming exams.</div>
                </div>
              ) : (
                <div className="exam-list">
                  {openExams.map(e => (
                    <div
                      key={e.id}
                      className={`exam-list-item ${selected?.id === e.id ? "selected" : ""}`}
                      onClick={() => { setSelected(e); setResult(null); setErr(""); setPdf(null); }}
                    >
                      <div>
                        <div className="exam-list-title">{e.title}</div>
                        <div className="exam-list-due">Due {new Date(e.due_at).toLocaleString()}</div>
                      </div>
                      <span className="badge badge-success">Open</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Upload panel */}
            {selected ? (
              <div>
                <h2 style={{ marginBottom: 16 }}>Submit Your Answers</h2>
                <div className="card">
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: "1rem" }}>{selected.title}</div>
                    <div className="text-muted text-sm mt-4">
                      Due {new Date(selected.due_at).toLocaleString()}
                    </div>
                  </div>

                  <div className="form-field">
                    <label
                      className={`file-drop ${pdf ? "has-file" : ""}`}
                      style={{ flexDirection: "column" }}
                    >
                      <input type="file" accept="application/pdf"
                        onChange={e => { setPdf(e.target.files?.[0] || null); setErr(""); }} />
                      {pdf ? (
                        <>
                          <span style={{ fontSize: "1.5rem" }}>📄</span>
                          <span style={{ fontWeight: 600 }}>{pdf.name}</span>
                          <span className="text-sm">Click to change file</span>
                        </>
                      ) : (
                        <>
                          <span style={{ fontSize: "1.5rem" }}>📤</span>
                          <span style={{ fontWeight: 600 }}>Click to upload PDF</span>
                          <span className="text-sm">Your completed exam as a PDF</span>
                        </>
                      )}
                    </label>
                  </div>

                  {err && <div className="alert alert-error mb-16">{err}</div>}

                  {submitting && (
                    <div className="alert alert-info mb-16">
                      ⏳ Grading in progress — this takes 20–60 seconds. Please wait…
                    </div>
                  )}

                  <button
                    className="btn btn-primary"
                    style={{ width: "100%", justifyContent: "center" }}
                    disabled={!pdf || submitting}
                    onClick={submit}
                  >
                    {submitting ? "Grading…" : "Submit & Grade"}
                  </button>
                </div>
              </div>
            ) : (
              !result && (
                <div className="empty" style={{ padding: "32px 0" }}>
                  <div className="empty-icon">👈</div>
                  <div className="empty-title">Select an exam</div>
                  <div className="empty-desc">Choose an open exam on the left to upload your PDF.</div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* ── History tab ────────────────────────────── */}
      {tab === "history" && (
        mySubmissions.length === 0
          ? <div className="empty">
              <div className="empty-icon">📊</div>
              <div className="empty-title">No submissions yet</div>
              <div className="empty-desc">Your grades will appear here after you submit exams.</div>
            </div>
          : <div className="history-list">
              {mySubmissions.map(s => <HistoryItem key={s.submission_id} sub={s} />)}
            </div>
      )}
    </div>
  );
}
