import axios from "axios";

export const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

export const http = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // <-- sends/receives session cookie
});

// Optional: logs real error details instead of vague “Network Error”
http.interceptors.response.use(
  (r) => r,
  (err) => {
    const res = err?.response;
    if (!res) console.error("Axios network/CORS error:", err?.message || err);
    else console.error("Axios error:", res.status, res.data);
    return Promise.reject(err);
  }
);

// ----- API wrappers -----
export async function register(email, password, role) {
  const { data } = await http.post("/auth/register", { email, password, role });
  return data;
}
export async function login(email, password) {
  const { data } = await http.post("/auth/login", { email, password, role: "STUDENT" });
  return data; // {id,email,role}; cookie set by server
}
export async function logout() { await http.post("/auth/logout"); }

export async function createExam(payload) {
  const { data } = await http.post(`/prof/exams`, payload);
  return data;
}
export async function uploadSolutionPdf(examId, file) {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await http.post(`/prof/exams/${examId}/solution_pdf`, fd);
  return data;
}
export async function fetchFlags(examId) {
  const { data } = await http.get(`/prof/exams/${examId}/flags`);
  return data;
}

export async function listOpenExams() {
  const { data } = await http.get(`/student/exams/open`);
  return data;
}
export async function submitPdf(examId, file) {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await http.post(`/student/exams/${examId}/submit_pdf`, fd);
  return data;
}
export async function getGrade(submissionId) {
  const { data } = await http.get(`/grade/submissions/${submissionId}`);
  return data;
}
