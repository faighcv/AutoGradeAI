import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="lp-page">

      {/* ── Nav ─────────────────────────────────────────── */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <span className="lp-logo">AutoGradeAI</span>
          <div className="lp-nav-actions">
            <Link to="/login" className="lp-link">Sign in</Link>
            <Link to="/register" className="lp-btn-outline">Get started</Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────── */}
      <section className="lp-hero">
        <div className="lp-hero-inner">
          <p className="lp-eyebrow">For professors who grade PDF exams</p>
          <h1 className="lp-h1">
            Grade 30 exams in<br />
            minutes, not hours
          </h1>
          <p className="lp-sub">
            Upload your solution PDF. Students submit their answers.
            GPT-4o reads every page and scores each question — with
            point breakdowns and written rationale.
          </p>
          <div className="lp-hero-actions">
            <Link to="/register" className="lp-btn-primary">Start grading free</Link>
            <Link to="/login" className="lp-btn-ghost">Sign in →</Link>
          </div>
          <p className="lp-hero-note">No credit card required. Works on any PDF exam.</p>
        </div>

        {/* Product preview */}
        <div className="lp-preview">
          <div className="lp-preview-bar">
            <span className="lp-dot" />
            <span className="lp-dot" />
            <span className="lp-dot" />
            <span className="lp-preview-label">AutoGradeAI — Professor Dashboard</span>
          </div>
          <div className="lp-preview-body">
            <div className="lp-mock-stat-row">
              <div className="lp-mock-stat">
                <span className="lp-mock-stat-val">94%</span>
                <span className="lp-mock-stat-key">Avg score</span>
              </div>
              <div className="lp-mock-stat">
                <span className="lp-mock-stat-val">28</span>
                <span className="lp-mock-stat-key">Submissions</span>
              </div>
              <div className="lp-mock-stat">
                <span className="lp-mock-stat-val">4 min</span>
                <span className="lp-mock-stat-key">Graded in</span>
              </div>
            </div>
            <div className="lp-mock-divider" />
            <div className="lp-mock-card">
              <div className="lp-mock-card-header">
                <span className="lp-mock-name">student_zhang.pdf</span>
                <span className="lp-mock-badge lp-badge-green">Graded</span>
              </div>
              <div className="lp-mock-scores">
                <div className="lp-mock-score-row">
                  <span>Q1 — Kinematics</span>
                  <span className="lp-mock-pts">10 / 10</span>
                </div>
                <div className="lp-mock-score-row">
                  <span>Q2 — Energy conservation</span>
                  <span className="lp-mock-pts lp-pts-warn">7 / 10</span>
                </div>
                <div className="lp-mock-score-row">
                  <span>Q3 — Momentum</span>
                  <span className="lp-mock-pts">8 / 10</span>
                </div>
              </div>
              <p className="lp-mock-rationale">
                "Q2: Student correctly identified initial KE but did not
                account for friction losses in the final calculation."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────── */}
      <section className="lp-section">
        <div className="lp-section-inner">
          <h2 className="lp-h2">How it works</h2>
          <p className="lp-section-sub">Three steps from exam PDF to graded results.</p>
          <div className="lp-steps">
            <div className="lp-step">
              <div className="lp-step-num">1</div>
              <h3 className="lp-step-title">Professor uploads solution PDF</h3>
              <p className="lp-step-body">
                Upload your answer key as a PDF. AutoGradeAI reads it with
                GPT-4o Vision to detect each question and its correct answer.
              </p>
            </div>
            <div className="lp-step-arrow">→</div>
            <div className="lp-step">
              <div className="lp-step-num">2</div>
              <h3 className="lp-step-title">Students submit their PDFs</h3>
              <p className="lp-step-body">
                Students log in and upload their exam PDF. No special
                formatting required — handwritten or typed, any layout.
              </p>
            </div>
            <div className="lp-step-arrow">→</div>
            <div className="lp-step">
              <div className="lp-step-num">3</div>
              <h3 className="lp-step-title">GPT-4o grades every question</h3>
              <p className="lp-step-body">
                Each question gets a numeric score, a rationale paragraph,
                and a list of what the student got right and what they missed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── For who ──────────────────────────────────────── */}
      <section className="lp-section lp-section-alt">
        <div className="lp-section-inner">
          <h2 className="lp-h2">Built for professors and students</h2>
          <p className="lp-section-sub">Each role gets exactly what they need.</p>
          <div className="lp-two-col">

            <div className="lp-col-card">
              <div className="lp-col-icon lp-icon-prof">P</div>
              <h3 className="lp-col-title">Professors</h3>
              <ul className="lp-col-list">
                <li>Create exams and upload solution PDFs</li>
                <li>See every student's score broken down by question</li>
                <li>Read GPT-4o's rationale for each grade</li>
                <li>Export results to CSV</li>
                <li>Get flagged if two submissions look suspiciously similar</li>
                <li>Extend deadlines per student</li>
              </ul>
            </div>

            <div className="lp-col-card">
              <div className="lp-col-icon lp-icon-student">S</div>
              <h3 className="lp-col-title">Students</h3>
              <ul className="lp-col-list">
                <li>See all open exams in one place</li>
                <li>Submit a PDF from any device</li>
                <li>Get scores back fast — usually under 5 minutes</li>
                <li>Read question-by-question feedback</li>
                <li>See what you got right, and exactly what you missed</li>
                <li>View your full submission history</li>
              </ul>
            </div>

          </div>
        </div>
      </section>

      {/* ── Why different ────────────────────────────────── */}
      <section className="lp-section">
        <div className="lp-section-inner lp-narrow">
          <h2 className="lp-h2">Why not just use a rubric spreadsheet?</h2>
          <div className="lp-diff-grid">
            <div className="lp-diff-card lp-diff-before">
              <p className="lp-diff-label">Before AutoGradeAI</p>
              <ul className="lp-diff-list">
                <li>Read every page by hand</li>
                <li>Open each PDF, flip to each question</li>
                <li>Write the same feedback comment 28 times</li>
                <li>Copy scores into a spreadsheet</li>
                <li>Miss plagiarism until someone tells you</li>
              </ul>
            </div>
            <div className="lp-diff-card lp-diff-after">
              <p className="lp-diff-label">With AutoGradeAI</p>
              <ul className="lp-diff-list">
                <li>Upload solution once, grade runs automatically</li>
                <li>Scores and rationale generated per question</li>
                <li>Feedback written by GPT-4o for every student</li>
                <li>One-click CSV export</li>
                <li>Similarity flags surface automatically</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section className="lp-cta-section">
        <div className="lp-cta-inner">
          <h2 className="lp-cta-h2">Ready to stop grading by hand?</h2>
          <p className="lp-cta-sub">
            Set up your first exam in under two minutes.
          </p>
          <Link to="/register" className="lp-btn-primary lp-btn-lg">
            Create your free account
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <span className="lp-logo">AutoGradeAI</span>
          <div className="lp-footer-links">
            <Link to="/login">Sign in</Link>
            <Link to="/register">Register</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
