import { useEffect, useState } from "react";
import * as api from "../api";

export default function Student(){
  const [exams, setExams] = useState([]);
  const [selected, setSelected] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [result, setResult] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(()=>{(async()=>{
    try{ setExams(await api.listOpenExams()) }catch(e){ setErr("Failed to load exams") }
  })()},[]);

  const submit = async () => {
    setErr(""); setMsg(""); setResult(null);
    try{
      const r = await api.submitPdf(selected.id, pdf);
      setResult(r);
      setMsg("Submitted! Your grade is below.");
    }catch(e){ setErr(e?.response?.data?.detail || "Submit failed"); }
  };

  return (
    <div className="grid2">
      <div className="card">
        <h2>Open Exams</h2>
        {!exams.length && <p className="muted">No open exams yet.</p>}
        <ul className="list">
          {exams.map(e=> (
            <li key={e.id} className={selected?.id===e.id? "sel":""} onClick={()=>setSelected(e)}>
              <div className="title">{e.title}</div>
              <div className="muted">Due: {new Date(e.due_at).toLocaleString()}</div>
            </li>
          ))}
        </ul>
      </div>

      {selected && (
        <div className="card">
          <h2>Upload your answers (PDF)</h2>
          <p className="muted">Exam: <b>{selected.title}</b> · ID {selected.id}</p>
          <input type="file" accept="application/pdf" onChange={e=>setPdf(e.target.files?.[0] || null)} />
          <button disabled={!pdf} onClick={submit}>Submit</button>
        </div>
      )}

      {msg && <div className="banner success">{msg}</div>}
      {err && <div className="banner error">{err}</div>}

      {result && (
        <div className="card full">
          <h2>Grade</h2>
          <p className="muted">Submission #{result.submission_id}</p>
          <div className="grade">{result.grade_total} / 100</div>
          <details>
            <summary>Breakdown</summary>
            <pre>{JSON.stringify(result.breakdown, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
