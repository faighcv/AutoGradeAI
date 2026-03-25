import { useState, useEffect, useCallback } from "react";
import * as api from "../api";

// ── helpers ───────────────────────────────────────────────────────────────────

function gradeColor(v) {
  if (v === null || v === undefined) return "";
  return v >= 80 ? "grade-excellent" : v >= 50 ? "grade-good" : "grade-poor";
}

// ── Grade breakdown panel ─────────────────────────────────────────────────────

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

// ── Exam detail view ──────────────────────────────────────────────────────────

function ExamDetail({ exam, onBack, onRefresh }) {
  const [tab, setTab]               = useState("submissions");
  const [submissions, setSubmissions] = useState([]);
  const [flags, setFlags]             = useState([]);
  const [stats, setStats]             = useState(null);
  const [pdf, setPdf]                 = useState(null);
  const [uploadMsg, setUploadMsg]     = useState("");
  const [uploadErr, setUploadErr]     = useState("");
  const [uploading, setUploading]     = useState(false);
  const [extendVal, setExtendVal]     = useState("");
  const [extendMsg, setExtendMsg]     = useState("");
  const [expandedSub, setExpandedSub] = useState(null);
  const [subDetail, setSubDetail]     = useState({});

  const load = useCallback(async () => {
    try {
      const [subs, fs, st] = await Promise.all([
        api.getExamSubmissions(exam.id),
        api.fetchFlags(exam.id),
        api.getExamStats(exam.id),
      ]);
      setSubmissions(subs);
      setFlags(fs);
      setStats(st);
    } catch {}
  }, [exam.id]);

  useEffect(() => { load(); }, [load]);

  const doUpload = async () => {
    if (!pdf) return;
    setUploadMsg(""); setUploadErr(""); setUploading(true);
    try {
      const r = await api.uploadSolutionPdf(exam.id, pdf);
      setUploadMsg(`Done! ${r.questions_detected} question(s) detected, ${r.total_points} pts total.`);
      setPdf(null);
      load(); onRefresh();
    } catch (e) {
      setUploadErr(e?.response?.data?.detail || "Upload failed");
    } finally { setUploading(false); }
  };

  const doExtend = async () => {
    if (!extendVal) return;
    setExtendMsg("");
    try {
      await api.extendDeadline(exam.id, new Date(extendVal).toISOString());
      setExtendMsg("Deadline extended!"); setExtendVal(""); onRefresh();
    } catch (e) { setExtendMsg(e?.response?.data?.detail || "Failed"); }
  };

  const toggleSub = async (subId) => {
    if (expandedSub === subId) { setExpandedSub(null); return; }
    setExpandedSub(subId);
    if (!subDetail[subId]) {
      try {
        const d = await api.getSubmissionDetail(subId);
        setSubDetail(prev => ({ ...prev, [subId]: d }));
      } catch {}
    }
  };

  const isPast = new Date(exam.due_at) < new Date();

  return (
    <div className="container content">
      {/* Header */}
      <div className="detail-header">
        <button className="btn btn-ghost" onClick={onBack} style={{ flexShrink: 0 }}>← Back</button>
        <div style={{ flex: 1 }}>
          <div className="detail-title">{exam.title}</div>
          <div className="detail-meta">
            Exam ID #{exam.id} · Due {new Date(exam.due_at).toLocaleString()}
          </div>
          <div className="detail-badges">
            <span className={`badge ${isPast ? "badge-muted" : "badge-success"}`}>
              {isPast ? "Closed" : "Open"}
            </span>
            {exam.has_solution
              ? <span className="badge badge-success">✓ Solution uploaded</span>
              : <span className="badge badge-warn">⚠ No solution yet</span>}
            {exam.flag_count > 0 &&
              <span className="badge badge-danger">⚠ {exam.flag_count} integrity flag{exam.flag_count > 1 ? "s" : ""}</span>}
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-val">{stats.total_submissions}</div>
            <div className="stat-label">Submissions</div>
          </div>
          <div className="stat-card">
            <div className="stat-val">{stats.graded_count}</div>
            <div className="stat-label">Graded</div>
          </div>
          <div className={`stat-card ${stats.average !== null ? "" : ""}`}>
            <div className="stat-val">{stats.average ?? "—"}</div>
            <div className="stat-label">Avg Score</div>
            <div className="stat-sub">out of 100</div>
          </div>
          <div className="stat-card">
            <div className="stat-val">{stats.min ?? "—"}</div>
            <div className="stat-label">Min</div>
          </div>
          <div className="stat-card">
            <div className="stat-val">{stats.max ?? "—"}</div>
            <div className="stat-label">Max</div>
          </div>
          <div className={`stat-card ${stats.cheating_flags > 0 ? "stat-danger" : ""}`}>
            <div className="stat-val">{stats.cheating_flags}</div>
            <div className="stat-label">Integrity Alerts</div>
          </div>
        </div>
      )}

      {/* Action row */}
      <div className="action-row">
        {/* Upload solution */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <label className={`file-drop ${pdf ? "has-file" : ""}`} style={{ padding: "8px 16px", minWidth: 180 }}>
            <input type="file" accept="application/pdf"
              onChange={e => { setPdf(e.target.files?.[0] || null); setUploadMsg(""); setUploadErr(""); }} />
            {pdf ? `📄 ${pdf.name}` : (exam.has_solution ? "Replace solution PDF" : "Upload solution PDF")}
          </label>
          {pdf && (
            <button className="btn btn-primary" onClick={doUpload} disabled={uploading}>
              {uploading ? "Processing…" : "Process"}
            </button>
          )}
          {uploadMsg && <span className="text-success text-sm">{uploadMsg}</span>}
          {uploadErr && <span className="text-danger text-sm">{uploadErr}</span>}
        </div>

        <div className="action-sep" />

        {/* Extend deadline */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <input
            className="form-input" type="datetime-local" value={extendVal}
            onChange={e => setExtendVal(e.target.value)}
            style={{ width: "auto", padding: "7px 12px" }}
          />
          <button className="btn btn-secondary" onClick={doExtend} disabled={!extendVal}>
            Extend deadline
          </button>
          {extendMsg && <span className="text-success text-sm">{extendMsg}</span>}
        </div>

        <div className="action-sep" />

        <a className="btn btn-secondary" href={api.exportCsvUrl(exam.id)} download>
          ⬇ Export CSV
        </a>
      </div>

      {/* Tabs */}
      <div className="tabs-bar">
        <button className={`tab-btn ${tab === "submissions" ? "active" : ""}`} onClick={() => setTab("submissions")}>
          Submissions
          <span className="tab-badge">{submissions.length}</span>
        </button>
        <button className={`tab-btn ${tab === "integrity" ? "active" : ""}`} onClick={() => setTab("integrity")}>
          Academic Integrity
          {flags.length > 0
            ? <span className="tab-badge warn">{flags.length}</span>
            : <span className="tab-badge">{flags.length}</span>}
        </button>
      </div>

      {/* Submissions tab */}
      {tab === "submissions" && (
        submissions.length === 0
          ? <div className="empty">
              <div className="empty-icon">📭</div>
              <div className="empty-title">No submissions yet</div>
              <div className="empty-desc">Students will appear here once they submit their PDFs.</div>
            </div>
          : <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Student</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th>Grade</th>
                    <th>Flag</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map(s => (
                    <>
                      <tr key={s.submission_id} className={s.flagged ? "row-flagged" : ""}>
                        <td className="text-muted text-sm">{s.submission_id}</td>
                        <td style={{ fontWeight: 600 }}>{s.student_email}</td>
                        <td className="text-muted text-sm">{new Date(s.submitted_at).toLocaleString()}</td>
                        <td>
                          <span className={`badge ${s.status === "GRADED" ? "badge-success" : "badge-muted"}`}>
                            {s.status}
                          </span>
                        </td>
                        <td>
                          {s.grade_total !== null
                            ? <span className={`fw-700 ${gradeColor(s.grade_total)}`}>{s.grade_total} / 100</span>
                            : <span className="text-muted">—</span>}
                        </td>
                        <td>{s.flagged && <span className="badge badge-danger">⚠ Flagged</span>}</td>
                        <td>
                          {s.status === "GRADED" && (
                            <button
                              className="btn btn-ghost text-sm"
                              onClick={() => toggleSub(s.submission_id)}
                            >
                              {expandedSub === s.submission_id ? "▲ Hide" : "▼ Details"}
                            </button>
                          )}
                        </td>
                      </tr>
                      {expandedSub === s.submission_id && subDetail[s.submission_id] && (
                        <tr key={`${s.submission_id}-detail`}>
                          <td colSpan={7} style={{ padding: "16px 14px", background: "var(--surface2)" }}>
                            <Breakdown breakdown={subDetail[s.submission_id].breakdown} />
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
      )}

      {/* Academic integrity tab */}
      {tab === "integrity" && (
        flags.length === 0
          ? <div className="integrity-ok">
              <div className="ok-icon">✅</div>
              <div style={{ fontWeight: 600, color: "var(--text2)" }}>No suspicious similarity detected</div>
              <div className="text-muted text-sm">Checks run automatically after each submission.</div>
            </div>
          : <div>
              <div className="alert alert-warn mb-16">
                These pairs were flagged based on document-level text similarity. Review carefully before taking action.
              </div>
              <div className="flags-list">
                {flags.map(f => (
                  <div key={f.id} className={`flag-card flag-${f.severity.toLowerCase()}`}>
                    <div className="flag-top">
                      <span className={`badge ${f.severity === "HIGH" ? "badge-danger" : "badge-warn"}`}>
                        {f.severity}
                      </span>
                      <div className="flag-emails">
                        <strong>{f.student_a_email}</strong>
                        <span className="vs">vs</span>
                        <strong>{f.student_b_email}</strong>
                      </div>
                    </div>
                    <div className="flag-scores">
                      <span>Semantic similarity: <strong>{(f.sem * 100).toFixed(1)}%</strong></span>
                      <span>Jaccard similarity: <strong>{(f.jacc * 100).toFixed(1)}%</strong></span>
                    </div>
                    <div className="flag-reason">{f.reason}</div>
                    <div className="flag-sub-ids">
                      Submission #{f.submission_a} · Submission #{f.submission_b}
                    </div>
                  </div>
                ))}
              </div>
            </div>
      )}
    </div>
  );
}

// ── Create exam form ──────────────────────────────────────────────────────────

function CreateExam({ onCreate }) {
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [err, setErr]     = useState("");
  const [loading, setLoading] = useState(false);

  const toIsoUtc = (s) => {
    if (!s) return null;
    const d = new Date(s.includes("T") ? s : s.replace(" ", "T"));
    if (isNaN(d)) return null;
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
  };

  const submit = async () => {
    setErr("");
    if (!title.trim()) { setErr("Title is required"); return; }
    const iso = toIsoUtc(dueAt);
    if (!iso) { setErr("Please select a valid deadline"); return; }
    setLoading(true);
    try {
      await api.createExam({ title, due_at: iso });
      setTitle(""); setDueAt("");
      onCreate();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to create exam");
    } finally { setLoading(false); }
  };

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <h2 style={{ marginBottom: 20 }}>New Exam</h2>
      <div className="form-field">
        <label className="form-label">Exam title</label>
        <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Midterm 1" />
      </div>
      <div className="form-field">
        <label className="form-label">Submission deadline</label>
        <input className="form-input" type="datetime-local" value={dueAt} onChange={e => setDueAt(e.target.value)} />
        <span className="form-hint">Date/time in your local timezone</span>
      </div>
      {err && <div className="alert alert-error mb-16">{err}</div>}
      <button className="btn btn-primary" onClick={submit} disabled={loading}>
        {loading ? "Creating…" : "Create exam"}
      </button>
    </div>
  );
}

// ── Exam card ─────────────────────────────────────────────────────────────────

function ExamCard({ exam, onClick }) {
  const isPast = new Date(exam.due_at) < new Date();
  return (
    <div className="exam-card" onClick={onClick}>
      <div className="exam-card-header">
        <div className="exam-card-title">{exam.title}</div>
        <div className="exam-card-flags">
          <span className={`badge ${isPast ? "badge-muted" : "badge-success"}`}>
            {isPast ? "Closed" : "Open"}
          </span>
          {exam.flag_count > 0 &&
            <span className="badge badge-danger">⚠ {exam.flag_count}</span>}
        </div>
      </div>
      <div className="exam-card-meta">Due {new Date(exam.due_at).toLocaleString()}</div>
      <div className={`exam-card-solution ${exam.has_solution ? "solution-ok" : "solution-miss"}`}>
        {exam.has_solution ? "✓ Solution uploaded" : "⚠ No solution PDF yet"}
      </div>
      {exam.enrollment_code && (
        <div className="exam-code-row">
          <span className="exam-code-label">Join code</span>
          <span className="exam-code-val">{exam.enrollment_code}</span>
        </div>
      )}
      <div className="exam-card-stats">
        <div className="exam-stat">
          <div className="exam-stat-val">{exam.submission_count}</div>
          <div className="exam-stat-label">Submitted</div>
        </div>
        <div className="exam-stat">
          <div className="exam-stat-val">{exam.graded_count}</div>
          <div className="exam-stat-label">Graded</div>
        </div>
        <div className="exam-stat">
          <div className="exam-stat-val" style={{ color: exam.flag_count > 0 ? "var(--danger)" : "var(--success)" }}>
            {exam.flag_count}
          </div>
          <div className="exam-stat-label">Flags</div>
        </div>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function Professor() {
  const [tab, setTab]           = useState("exams");
  const [exams, setExams]       = useState([]);
  const [selected, setSelected] = useState(null);

  const loadExams = useCallback(async () => {
    try { setExams(await api.getMyExams()); } catch {}
  }, []);

  useEffect(() => { loadExams(); }, [loadExams]);

  if (selected) {
    const live = exams.find(e => e.id === selected.id) || selected;
    return <ExamDetail exam={live} onBack={() => setSelected(null)} onRefresh={loadExams} />;
  }

  return (
    <div className="container content">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 36 }}>
        <div>
          <h1 style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 6 }}>Professor Dashboard</h1>
          <p style={{ color: "var(--muted)", fontSize: "1rem" }}>
            {exams.length === 0
              ? "No exams yet — create your first one below."
              : `${exams.length} exam${exams.length !== 1 ? "s" : ""} · ${exams.filter(e => new Date(e.due_at) >= new Date()).length} open`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setTab("create")}>+ New Exam</button>
      </div>

      <div className="tabs-bar">
        <button className={`tab-btn ${tab === "exams" ? "active" : ""}`} onClick={() => setTab("exams")}>
          My Exams
          <span className="tab-badge">{exams.length}</span>
        </button>
        <button className={`tab-btn ${tab === "create" ? "active" : ""}`} onClick={() => setTab("create")}>
          + New Exam
        </button>
      </div>

      {tab === "exams" && (
        exams.length === 0
          ? <div className="empty">
              <div className="empty-icon">🎓</div>
              <div className="empty-title">No exams yet</div>
              <div className="empty-desc">Create your first exam and upload a solution PDF to get started.</div>
              <button className="btn btn-primary" onClick={() => setTab("create")}>Create exam</button>
            </div>
          : <div className="exams-grid">
              {exams.map(e => (
                <ExamCard key={e.id} exam={e} onClick={() => setSelected(e)} />
              ))}
            </div>
      )}

      {tab === "create" && (
        <CreateExam onCreate={() => { loadExams(); setTab("exams"); }} />
      )}
    </div>
  );
}
