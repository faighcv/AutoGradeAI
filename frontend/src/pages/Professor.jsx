import { useState, useEffect, useCallback } from "react";
import * as api from "../api";

// ── Small reusable components ─────────────────────────────────────────────────

function SeverityBadge({ severity }) {
  return (
    <span className={`badge badge-${severity === "HIGH" ? "danger" : "warn"}`}>
      {severity}
    </span>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value ?? "—"}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

// ── Exam detail panel ─────────────────────────────────────────────────────────

function ExamDetail({ exam, onBack, onRefresh }) {
  const [innerTab, setInnerTab] = useState("submissions");
  const [submissions, setSubmissions] = useState([]);
  const [flags, setFlags] = useState([]);
  const [stats, setStats] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploadErr, setUploadErr] = useState("");
  const [extendDate, setExtendDate] = useState("");
  const [extendMsg, setExtendMsg] = useState("");
  const [loading, setLoading] = useState(false);

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
    } catch (e) {
      console.error("Failed to load exam detail:", e);
    }
  }, [exam.id]);

  useEffect(() => {
    load();
  }, [load]);

  const uploadSolution = async () => {
    if (!pdf) return;
    setUploadErr("");
    setUploadMsg("");
    setLoading(true);
    try {
      const res = await api.uploadSolutionPdf(exam.id, pdf);
      setUploadMsg(
        `Solution uploaded! Detected ${res.questions_detected} question(s), ${res.total_points} total pts.`
      );
      setPdf(null);
      load();
      onRefresh();
    } catch (e) {
      setUploadErr(e?.response?.data?.detail || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const doExtend = async () => {
    if (!extendDate) return;
    setExtendMsg("");
    try {
      const iso = new Date(extendDate).toISOString();
      await api.extendDeadline(exam.id, iso);
      setExtendMsg("Deadline extended successfully.");
      setExtendDate("");
      onRefresh();
    } catch (e) {
      setExtendMsg(e?.response?.data?.detail || "Failed to extend deadline");
    }
  };

  const isPast = new Date(exam.due_at) < new Date();

  return (
    <div className="exam-detail">
      <div className="exam-detail-header">
        <button className="btn-ghost" onClick={onBack}>← Back to exams</button>
        <div>
          <h2>{exam.title}</h2>
          <span className={`badge ${isPast ? "badge-muted" : "badge-success"}`}>
            {isPast ? "Closed" : "Open"}
          </span>
          <span className="muted" style={{ marginLeft: 12, fontSize: "0.85rem" }}>
            Due: {new Date(exam.due_at).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="stats-row">
          <StatCard label="Submissions" value={stats.total_submissions} />
          <StatCard label="Graded" value={stats.graded_count} />
          <StatCard label="Average" value={stats.average !== null ? `${stats.average}` : null} sub="/ 100 pts" />
          <StatCard label="Min" value={stats.min} />
          <StatCard label="Max" value={stats.max} />
          <StatCard
            label="Integrity Alerts"
            value={stats.cheating_flags > 0 ? `⚠ ${stats.cheating_flags}` : "0"}
          />
        </div>
      )}

      {/* Action bar */}
      <div className="action-bar">
        <div className="action-group">
          <span className="muted" style={{ fontSize: "0.85rem" }}>Solution PDF:</span>
          <label className="btn-outline file-btn">
            {pdf ? pdf.name : exam.has_solution ? "Replace solution" : "Upload solution"}
            <input
              type="file"
              accept="application/pdf"
              style={{ display: "none" }}
              onChange={(e) => { setPdf(e.target.files?.[0] || null); setUploadMsg(""); setUploadErr(""); }}
            />
          </label>
          {pdf && (
            <button className="btn-primary" onClick={uploadSolution} disabled={loading}>
              {loading ? "Processing…" : "Upload & Process"}
            </button>
          )}
          {uploadMsg && <span className="text-success">{uploadMsg}</span>}
          {uploadErr && <span className="text-danger">{uploadErr}</span>}
        </div>

        <div className="action-group">
          <span className="muted" style={{ fontSize: "0.85rem" }}>Extend deadline:</span>
          <input
            type="datetime-local"
            value={extendDate}
            onChange={(e) => setExtendDate(e.target.value)}
            style={{ padding: "6px 10px" }}
          />
          <button className="btn-outline" onClick={doExtend} disabled={!extendDate}>
            Extend
          </button>
          {extendMsg && <span className="text-success">{extendMsg}</span>}
        </div>

        <a
          href={api.exportCsvUrl(exam.id)}
          className="btn-outline"
          download
        >
          ⬇ Export CSV
        </a>
      </div>

      {/* Inner tabs */}
      <div className="tabs">
        <button
          className={`tab ${innerTab === "submissions" ? "active" : ""}`}
          onClick={() => setInnerTab("submissions")}
        >
          Submissions ({submissions.length})
        </button>
        <button
          className={`tab ${innerTab === "integrity" ? "active" : ""}`}
          onClick={() => setInnerTab("integrity")}
        >
          {flags.length > 0 && <span className="tab-alert">⚠</span>}
          Academic Integrity ({flags.length})
        </button>
      </div>

      {/* Submissions tab */}
      {innerTab === "submissions" && (
        <div>
          {submissions.length === 0 ? (
            <p className="muted">No submissions yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Student</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Grade</th>
                  <th>Flag</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s.submission_id} className={s.flagged ? "row-flagged" : ""}>
                    <td className="muted">{s.submission_id}</td>
                    <td>{s.student_email}</td>
                    <td className="muted">{new Date(s.submitted_at).toLocaleString()}</td>
                    <td>
                      <span className={`badge ${s.status === "GRADED" ? "badge-success" : "badge-muted"}`}>
                        {s.status}
                      </span>
                    </td>
                    <td>
                      {s.grade_total !== null ? (
                        <strong>{s.grade_total} / 100</strong>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      {s.flagged && <span className="badge badge-danger">⚠ Flagged</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Academic integrity tab */}
      {innerTab === "integrity" && (
        <div>
          {flags.length === 0 ? (
            <div className="integrity-empty">
              <div style={{ fontSize: "2rem" }}>✅</div>
              <p>No suspicious similarity detected among submissions.</p>
            </div>
          ) : (
            <div>
              <p className="muted" style={{ marginBottom: 12 }}>
                The following pairs were flagged based on document-level text similarity.
                Review carefully before taking action.
              </p>
              <div className="flag-list">
                {flags.map((f) => (
                  <div
                    key={f.id}
                    className={`flag-card flag-${f.severity.toLowerCase()}`}
                  >
                    <div className="flag-header">
                      <SeverityBadge severity={f.severity} />
                      <span className="flag-pair">
                        <strong>{f.student_a_email}</strong>
                        <span className="muted"> vs </span>
                        <strong>{f.student_b_email}</strong>
                      </span>
                    </div>
                    <div className="flag-scores">
                      <span>Semantic similarity: <strong>{(f.sem * 100).toFixed(1)}%</strong></span>
                      <span>Jaccard similarity: <strong>{(f.jacc * 100).toFixed(1)}%</strong></span>
                    </div>
                    <div className="flag-reason muted">{f.reason}</div>
                    <div className="flag-meta muted">
                      Submission #{f.submission_a} & #{f.submission_b}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Exam list card ─────────────────────────────────────────────────────────────

function ExamCard({ exam, onClick }) {
  const isPast = new Date(exam.due_at) < new Date();
  return (
    <div className="exam-card" onClick={onClick}>
      <div className="exam-card-top">
        <span className="exam-card-title">{exam.title}</span>
        <span className={`badge ${isPast ? "badge-muted" : "badge-success"}`}>
          {isPast ? "Closed" : "Open"}
        </span>
        {exam.flag_count > 0 && (
          <span className="badge badge-danger">⚠ {exam.flag_count} flag{exam.flag_count > 1 ? "s" : ""}</span>
        )}
      </div>
      <div className="exam-card-meta muted">
        Due {new Date(exam.due_at).toLocaleString()}
      </div>
      <div className="exam-card-stats">
        <span>{exam.submission_count} submission{exam.submission_count !== 1 ? "s" : ""}</span>
        <span>{exam.graded_count} graded</span>
        <span>{exam.has_solution ? "✓ Solution uploaded" : "⚠ No solution yet"}</span>
      </div>
    </div>
  );
}

// ── Create exam form ───────────────────────────────────────────────────────────

function CreateExam({ onCreate }) {
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const toIsoUtc = (s) => {
    if (!s) return null;
    const normalized = s.includes("T") ? s : s.replace(" ", "T");
    const local = new Date(normalized);
    if (Number.isNaN(local.getTime())) return null;
    return new Date(local.getTime() - local.getTimezoneOffset() * 60000).toISOString();
  };

  const submit = async () => {
    setErr("");
    setMsg("");
    const iso = toIsoUtc(dueAt);
    if (!title.trim()) { setErr("Title is required"); return; }
    if (!iso) { setErr("Please select a valid deadline"); return; }
    try {
      const exam = await api.createExam({ title, due_at: iso });
      setMsg(`Exam "${exam.title}" created (ID ${exam.id}). Select it below to upload a solution.`);
      setTitle("");
      setDueAt("");
      onCreate();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to create exam");
    }
  };

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <h2>Create new exam</h2>
      <div className="form-group">
        <label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Midterm 1" />
      </div>
      <div className="form-group">
        <label>Deadline (local time)</label>
        <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
      </div>
      <button className="btn-primary" onClick={submit}>Create exam</button>
      {msg && <div className="banner success">{msg}</div>}
      {err && <div className="banner error">{err}</div>}
    </div>
  );
}

// ── Root Professor component ───────────────────────────────────────────────────

export default function Professor() {
  const [activeTab, setActiveTab] = useState("exams");
  const [myExams, setMyExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);

  const loadExams = useCallback(async () => {
    try {
      const list = await api.getMyExams();
      setMyExams(list);
    } catch (e) {
      console.error("Failed to load exams:", e);
    }
  }, []);

  useEffect(() => { loadExams(); }, [loadExams]);

  const handleSelectExam = (exam) => {
    setSelectedExam(exam);
    setActiveTab("exams");
  };

  if (selectedExam) {
    const liveExam = myExams.find((e) => e.id === selectedExam.id) || selectedExam;
    return (
      <div className="container">
        <ExamDetail
          exam={liveExam}
          onBack={() => setSelectedExam(null)}
          onRefresh={loadExams}
        />
      </div>
    );
  }

  return (
    <div className="container">
      <div className="tabs">
        <button
          className={`tab ${activeTab === "exams" ? "active" : ""}`}
          onClick={() => setActiveTab("exams")}
        >
          My Exams ({myExams.length})
        </button>
        <button
          className={`tab ${activeTab === "create" ? "active" : ""}`}
          onClick={() => setActiveTab("create")}
        >
          + New Exam
        </button>
      </div>

      {activeTab === "exams" && (
        <div>
          {myExams.length === 0 ? (
            <div className="empty-state">
              <p>You haven't created any exams yet.</p>
              <button className="btn-primary" onClick={() => setActiveTab("create")}>
                Create your first exam
              </button>
            </div>
          ) : (
            <div className="exam-grid">
              {myExams.map((exam) => (
                <ExamCard
                  key={exam.id}
                  exam={exam}
                  onClick={() => handleSelectExam(exam)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "create" && (
        <CreateExam
          onCreate={() => {
            loadExams();
            setActiveTab("exams");
          }}
        />
      )}
    </div>
  );
}
