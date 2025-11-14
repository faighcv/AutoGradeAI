# 🎓 **AutoGradeAI**
### AI-powered exam grading using **GPT-4o Vision**, **CNN preprocessing**, and **FastAPI + React**

---

</div>

<div align="center">

![FastAPI](https://img.shields.io/badge/FastAPI-109989?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT4oVision-blue?style=for-the-badge)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-2d6db3?style=for-the-badge&logo=postgresql&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)

</div>

---

# 📌 **Overview**

**AutoGradeAI** is a full-stack automated grading platform that allows:

👨‍🏫 **Professors**  
- Create exams  
- Upload a solution PDF  
- Automatically extract question segments  
- Automatically assign points  
- View all student submissions  
- View grading breakdown  

👨‍🎓 **Students**  
- See open exams  
- Upload answer PDFs  
- Receive instant AI-generated grades  
- View detailed explanation per question  

### 🧠 Powered by:
- **GPT-4o Vision** for OCR + answer understanding  
- **CNN preprocessing** for clean image extraction  
- **FastAPI** backend  
- **React + Vite** frontend  
- **PostgreSQL** database  

---

# 🖼️ Screenshots

> After pushing to GitHub, drag and drop your screenshots here to replace the placeholders.

### 🔐 Login Page  
![Login](UPLOAD_LOGIN_IMAGE)

### 🧑‍🏫 Professor Dashboard  
![Professor Dashboard](UPLOAD_PROFESSOR_DASHBOARD_IMAGE)

### ➕ Create Exam  
![Create Exam](UPLOAD_CREATE_EXAM_IMAGE)

### 📤 Upload Solution PDF  
![Upload Solution](UPLOAD_SOLUTION_IMAGE)

### 🎓 Student Exam List  
![Student List](UPLOAD_STUDENT_LIST_IMAGE)

### 📥 Student Submission  
![Student Submission](UPLOAD_STUDENT_SUBMISSION_IMAGE)

### 📝 AI Grading Breakdown  
![Grading Result](UPLOAD_GRADING_RESULT_IMAGE)

---

# 🧩 System Architecture

```

+------------------+           +-------------------------+
|     React UI     | <-------> |       FastAPI API       |
| (Student/Prof)   |           |  Auth, Exams, Grading   |
+------------------+           +-------------------------+
↑                       |
|                       ↓
+---------------------------------------------------------+
|                AI Grading Engine                        |
|  - PDF → PNG conversion                                  |
|  - CNN cleanup                                           |
|  - GPT-4o Vision OCR                                     |
|  - GPT-4o reasoning for grading                          |
+---------------------------------------------------------+
|
↓
+-------------------------+
|     PostgreSQL DB       |
| Exams, Submissions,     |
| Questions, Solutions     |
+-------------------------+

````

---

# ✨ **Features**

### 👨‍🏫 Professors
- Create exams with deadlines  
- Upload solution PDFs  
- Auto-create questions  
- Auto-distribute points  
- View all student submissions  
- Inspect grading breakdown  

### 👨‍🎓 Students
- View all open exams  
- Upload PDF responses  
- Instant AI grading  
- Full breakdown per question  

### 🤖 AI Grading Pipeline
1. PDF → Images extraction  
2. CNN preprocessing (denoise, threshold)  
3. GPT-4o Vision parses text  
4. GPT-4o compares answer vs solution  
5. AI assigns score per question  
6. Total score returned  

---

# ⚙️ **Installation**

## 1️⃣ Clone the repo

```bash
git clone https://github.com/yourusername/AutoGradeAI.git
cd AutoGradeAI
````

---

# 🛠 Backend Setup (FastAPI)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Create `.env` file:

```
DATABASE_URL=postgresql://username:password@localhost:5432/autograde
OPENAI_API_KEY=your_openai_key
```

### Start backend server:

```bash
uvicorn app.main:app --reload
```

API docs:
👉 [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

# 💻 Frontend Setup (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at:
👉 [http://localhost:5173](http://localhost:5173)

---

# 🗂 Folder Structure

```
AutoGradeAI/
├── backend/
│   ├── app/
│   │   ├── auth/
│   │   │   └── hashing.py
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── professor.py
│   │   │   └── student.py
│   │   ├── services/
│   │   │   └── grading_vision.py
│   │   ├── utils/
│   │   │   ├── images.py
│   │   │   └── __init__.py
│   │   ├── uploads/                         # Student + solution PDFs / images
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── deps.py
│   │   ├── main.py
│   │   ├── models.py
│   │   └── schemas.py
│   └── .env
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Professor.jsx
│   │   │   ├── Register.jsx
│   │   │   └── Student.jsx
│   │   ├── api.js
│   │   ├── auth.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── public/
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.js
│   └── .env
│
├── README.md
├── requirements.txt
└── .gitignore
```

---

# 👨‍🏫 **Professor Workflow**

1. Create an exam
2. Upload solution PDF
3. AI extracts questions
4. Students submit their answers
5. Professor views submissions
6. Review grading results

---

# 👨‍🎓 **Student Workflow**

1. View available exams
2. Upload answer PDF
3. AI grades instantly
4. View scoring breakdown

---

# 📡 API Endpoints Summary

### Professor

```
POST /prof/exams/create
POST /prof/exams/{id}/solution_pdf
GET  /prof/exams/{id}/submissions
GET  /prof/exams/{id}/submission/{sid}
```

### Student

```
GET  /student/exams/open
POST /student/exams/{id}/submit_pdf
```

---

# 📝 License

MIT License.

---

# 👤 Author

**Faig — AutoGradeAI**