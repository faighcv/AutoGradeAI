import React, { useState } from 'react'
import axios from 'axios'

const API = 'http://localhost:8000'

function Auth({ onToken }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('STUDENT')

  const register = async () => {
    await axios.post(`${API}/auth/register`, { email, password, role })
    alert('Registered! Now login.')
  }

  const login = async () => {
    const { data } = await axios.post(`${API}/auth/login`, { email, password, role })
    localStorage.setItem('token', data.access_token)
    onToken(data.access_token)
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
        <button onClick={register}>Register</button>
        <button onClick={login} style={{marginLeft:8}}>Login</button>
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
          <h4 style={{marginTop:12}}>Questions for Exam {examId}</h4>
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
  const [answers, setAnswers] = useState([])
  const [grade, setGrade] = useState(null)

  const loadOpen = async () => {
    const { data } = await axios.get(`${API}/student/exams/open`, auth)
    setExams(data)
  }

  const selectExam = (id) => {
    setExamId(id)
    setAnswers([{question_id: 0, text: ''}])
  }

  const submit = async () => {
    const { data } = await axios.post(`${API}/student/exams/${examId}/submit`, { answers }, auth)
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
            <button onClick={()=>selectExam(e.id)} style={{marginLeft:8}}>Choose</button>
          </li>
        ))}
      </ul>
      {examId && (
        <>
          <h4>Answers for exam {examId}</h4>
          {answers.map((a, i)=>(
            <div key={i} style={{marginBottom:8}}>
              <input style={{width:120}} type="number" placeholder="question_id" value={a.question_id} onChange={e=>setAnswers(prev=>prev.map((x,j)=> j===i? {...x, question_id:Number(e.target.value)}:x))}/>
              <input style={{marginLeft:8, width:600}} placeholder="your answer text" value={a.text} onChange={e=>setAnswers(prev=>prev.map((x,j)=> j===i? {...x, text:e.target.value}:x))}/>
            </div>
          ))}
          <button onClick={()=>setAnswers(prev=>[...prev, {question_id: 0, text:''}])}>Add Answer Row</button>
          <button onClick={submit} style={{marginLeft:8}}>Submit</button>
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
