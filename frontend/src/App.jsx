// frontend/src/App.jsx
import React, { useState } from 'react'
import axios from 'axios'

const API = 'http://127.0.0.1:8000'

function Auth({ onToken }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('STUDENT')
  const [busy, setBusy] = useState(false)

  const register = async () => {
    setBusy(true)
    try {
      await axios.post(`${API}/auth/register`, { email, password, role })
      alert('Registered! Now login.')
    } catch (err) {
      console.error(err)
      alert('Register failed: ' + (err.response?.data?.detail || err.message))
    } finally {
      setBusy(false)
    }
  }

  const login = async () => {
    setBusy(true)
    try {
      const { data } = await axios.post(`${API}/auth/login`, { email, password, role })
      localStorage.setItem('token', data.access_token)
      onToken(data.access_token)
    } catch (err) {
      console.error(err)
      alert('Login failed: ' + (err.response?.data?.detail || err.message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{border:'1px solid #ddd', padding:16, borderRadius:8}}>
      <h3>Auth</h3>
      <div>
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@u.edu"/>
      </div>
      <div>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="********"/>
      </div>
      <div>
        <select value={role} onChange={e=>setRole(e.target.value)}>
          <option value="STUDENT">STUDENT</option>
          <option value="PROF">PROF</option>
        </select>
      </div>
      <div style={{marginTop:8}}>
        <button onClick={register} disabled={busy}>Register</button>
        <button onClick={login} style={{marginLeft:8}} disabled={busy}>Login</button>
      </div>
    </div>
  )
}

function Professor() {
  const token = localStorage.getItem('token')
  const auth = { headers: { Authorization: `Bearer ${token}` } }
  const [title, setTitle] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [examId, setExamId] = useState('')
  const [questions, setQuestions] = useState([
    { idx: 1, prompt: '', max_points: 10, answer_key: { text: '', keywords: [] } }
  ])
  const [flags, setFlags] = useState([])
  const [solutionPdf, setSolutionPdf] = useState(null)

  const createExam = async () => {
    const { data } = await axios.post(`${API}/prof/exams`, { title, due_at: dueAt }, auth)
    setExamId(data.id)
    alert('Exam created with id ' + data.id)
  }

  const addQuestions = async () => {
    const payload = questions.map(q => ({...q, max_points: Number(q.max_points)}))
    await axios.post(`${API}/prof/exams/${examId}/questions`, payload, auth)
    alert('Questions added')
  }

  const uploadSolution = async () => {
    if (!solutionPdf) return alert('Choose a PDF first')
    const form = new FormData()
    form.append('file', solutionPdf)
    await axios.post(`${API}/prof/exams/${examId}/solution_pdf`, form, {
      ...auth,
      headers: { ...auth.headers, 'Content-Type': 'multipart/form-data' }
    })
    alert('Solution PDF processed: answer keys created/updated')
  }

  const loadFlags = async () => {
    const { data } = await axios.get(`${API}/prof/exams/${examId}/flags`, auth)
    setFlags(data)
  }

  const addRow = () => {
    setQuestions(qs => [...qs, { idx: qs.length+1, prompt:'', max_points:10, answer_key:{text:'', keywords:[]}}])
  }

  return (
    <div style={{border:'1px solid #ddd', padding:16, borderRadius:8, marginTop:12}}>
      <h3>Professor</h3>
      <div>
        <input placeholder="Exam title" value={title} onChange={e=>setTitle(e.target.value)}/>
        <input placeholder="Due (UTC ISO e.g. 2025-10-25T23:59:00Z)" value={dueAt} onChange={e=>setDueAt(e.target.value)} style={{marginLeft:8, width:320}}/>
        <button onClick={createExam} style={{marginLeft:8}}>Create Exam</button>
      </div>

      {examId && (
        <>
          <h4 style={{marginTop:12}}>Solution PDF for Exam {examId}</h4>
          <input type="file" accept="application/pdf" onChange={e=>setSolutionPdf(e.target.files?.[0] || null)} />
          <button onClick={uploadSolution} style={{marginLeft:8}}>Upload Solution PDF</button>

          <h4 style={{marginTop:12}}>Questions (manual add / edit optional)</h4>
          {questions.map((q, i)=>(
            <div key={i} style={{marginBottom:8}}>
              <input style={{width:40}} type="number" value={q.idx} onChange={e=>setQuestions(prev=>prev.map((x,j)=> j===i? {...x, idx:Number(e.target.value)}:x))}/>
              <input style={{marginLeft:8, width:360}} placeholder="Prompt" value={q.prompt} onChange={e=>setQuestions(prev=>prev.map((x,j)=> j===i? {...x, prompt:e.target.value}:x))}/>
              <input style={{marginLeft:8, width:80}} type="number" value={q.max_points} onChange={e=>setQuestions(prev=>prev.map((x,j)=> j===i? {...x, max_points:e.target.value}:x))}/>
              <input style={{marginLeft:8, width:360}} placeholder="Answer key text" value={q.answer_key.text} onChange={e=>setQuestions(prev=>prev.map((x,j)=> j===i? {...x, answer_key:{...x.answer_key, text:e.target.value}}:x))}/>
              <input style={{marginLeft:8, width:300}} placeholder="Keywords comma-separated" onChange={e=>setQuestions(prev=>prev.map((x,j)=> j===i? {...x, answer_key:{...x.answer_key, keywords:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)}}:x))}/>
            </div>
          ))}
          <button onClick={addRow}>Add Row</button>
          <button onClick={addQuestions} style={{marginLeft:8}}>Save Questions</button>

          <div style={{marginTop:16}}>
            <button onClick={loadFlags}>Load Similarity Flags</button>
            <ul>
              {flags.map(f=>(
                <li key={f.id}>Sub {f.submission_a} vs {f.submission_b} (Q{f.question_id}) — sem {f.sem}, jacc {f.jacc}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}

function Student() {
  const token = localStorage.getItem('token')
  const auth = { headers: { Authorization: `Bearer ${token}` } }
  const [exams, setExams] = useState([])
  const [examId, setExamId] = useState('')
  const [pdf, setPdf] = useState(null)
  const [grade, setGrade] = useState(null)

  const loadOpen = async () => {
    const { data } = await axios.get(`${API}/student/exams/open`, auth)
    setExams(data)
  }

  const submitPdf = async () => {
    if (!pdf) return alert('Choose a PDF first')
    const form = new FormData()
    form.append('file', pdf)
    const { data } = await axios.post(`${API}/student/exams/${examId}/submit_pdf`, form, {
      ...auth,
      headers: { ...auth.headers, 'Content-Type': 'multipart/form-data' }
    })
    setGrade(data)
  }

  return (
    <div style={{border:'1px solid #ddd', padding:16, borderRadius:8, marginTop:12}}>
      <h3>Student</h3>
      <button onClick={loadOpen}>Load Open Exams</button>
      <ul>
        {exams.map(e=>(
          <li key={e.id}>
            {e.title} — due {new Date(e.due_at).toISOString()}
            <button onClick={()=>setExamId(e.id)} style={{marginLeft:8}}>Choose</button>
          </li>
        ))}
      </ul>

      {examId && (
        <>
          <h4>Submit PDF for exam {examId}</h4>
          <input type="file" accept="application/pdf" onChange={e=>setPdf(e.target.files?.[0] || null)} />
          <button onClick={submitPdf} style={{marginLeft:8}}>Upload & Grade</button>
          {grade && (
            <pre style={{background:'#f7f7f7', padding:12, marginTop:12}}>{JSON.stringify(grade, null, 2)}</pre>
          )}
        </>
      )}
    </div>
  )
}


export default function App(){
  const [token, setToken] = useState(localStorage.getItem('token') || null)
  return (
    <div style={{fontFamily:'ui-sans-serif', padding:20}}>
      <h2>AutoGradeAI</h2>
      {!token && <Auth onToken={setToken} />}
      {token && (
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
          <Professor/>
          <Student/>
        </div>
      )}
    </div>
  )
}
