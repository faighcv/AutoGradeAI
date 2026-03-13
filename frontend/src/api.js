import axios from "axios";

export const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

export const http = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

http.interceptors.response.use(
  (r) => r,
  (err) => {
    const res = err?.response;
    if (!res) console.error("Network/CORS error:", err.message);
    else console.error("Axios error:", res.status, res.data);
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export async function register(email, password, role) {
  const { data } = await http.post("/auth/register", { email, password, role });
  return data;
}

export async function login(email, password) {
  const { data } = await http.post("/auth/login", { email, password });
  return data;
}

export async function logout() {
  await http.post("/auth/logout");
}

// ── Professor ─────────────────────────────────────────────────────────────────
export async function createExam(payload) {
  const { data } = await http.post("/prof/exams", payload);
  return data;
}

export async function getMyExams() {
  const { data } = await http.get("/prof/exams");
  return data;
}

export async function uploadSolutionPdf(examId, file) {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await http.post(`/prof/exams/${examId}/solution_pdf`, fd);
  return data;
}

export async function getExamSubmissions(examId) {
  const { data } = await http.get(`/prof/exams/${examId}/submissions`);
  return data;
}

export async function getExamStats(examId) {
  const { data } = await http.get(`/prof/exams/${examId}/stats`);
  return data;
}

export async function fetchFlags(examId) {
  const { data } = await http.get(`/prof/exams/${examId}/flags`);
  return data;
}

export async function extendDeadline(examId, due_at) {
  const { data } = await http.patch(`/prof/exams/${examId}/extend`, { due_at });
  return data;
}

export function exportCsvUrl(examId) {
  return `${API_BASE}/prof/exams/${examId}/export_csv`;
}

export async function getSubmissionDetail(submissionId) {
  const { data } = await http.get(`/prof/submissions/${submissionId}`);
  return data;
}

// ── Student ───────────────────────────────────────────────────────────────────
export async function listOpenExams() {
  const { data } = await http.get("/student/exams/open");
  return data;
}

export async function submitPdf(examId, file) {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await http.post(`/student/exams/${examId}/submit_pdf`, fd);
  return data;
}

export async function getMySubmissions() {
  const { data } = await http.get("/student/submissions");
  return data;
}
