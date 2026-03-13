# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AutoGradeAI is a full-stack AI-powered exam grading platform. Professors upload solution PDFs; students submit answer PDFs; GPT-4o Vision automatically grades submissions. Two user roles: `PROF` and `STUDENT`.

## Development Commands

### Backend (FastAPI)
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload   # http://127.0.0.1:8000
# Swagger UI at http://127.0.0.1:8000/docs
```

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run build
npm run preview
```

## Architecture

### Backend (`backend/app/`)

- **`main.py`** — FastAPI app init, CORS config, router registration
- **`models.py`** — 10 SQLAlchemy ORM models; key ones: `User`, `Exam`, `Question`, `Submission`, `Grade`, `SolutionDoc`, `SubmissionDoc`, `SimilarityFlag`
- **`deps.py`** — `get_db` and `get_current_user` dependencies used across all routers
- **`config.py`** — Pydantic `Settings` loaded from `.env`; key vars: `DATABASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL` (default `gpt-4o-mini`)
- **`database.py`** — SQLAlchemy engine + `SessionLocal`
- **`routers/auth.py`** — Cookie-based sessions (`ag_session` httponly cookie); custom `Session` table (not JWT)
- **`routers/professor.py`** — Exam CRUD, solution PDF upload/question detection, submission/flag viewing
- **`routers/student.py`** — List open exams, submit PDF for grading
- **`services/grading_vision.py`** — Core AI grading engine; PDF→PNG→GPT-4o vision pipeline
- **`utils/images.py`** — `pdf2image` conversion at 200 DPI

### Frontend (`frontend/src/`)

- **`auth.jsx`** — `AuthProvider` context; user persisted in localStorage
- **`api.js`** — Axios instance with `withCredentials: true`; all API call wrappers
- **`App.jsx`** — React Router v6 routes; `PrivateOutlet` guards authenticated routes
- **`pages/Dashboard.jsx`** — Branches to `Professor.jsx` or `Student.jsx` based on `user.role`

### Grading Pipeline

1. Professor uploads solution PDF → backend converts to PNGs → `detect_question_spans()` calls GPT-4o Vision to identify question boundaries → auto-creates `Question` records → stores metadata in `SolutionDoc`
2. Student submits PDF → backend converts to PNGs → for each question, `grade_question_images()` sends student + solution images to GPT-4o → receives JSON `{points, rationale, strengths, missing}` → stores `Grade` with breakdown JSON

### Auth Flow

Session-based: login creates a `Session` DB record + sets httponly cookie. `get_current_user` dependency validates cookie against DB on every request.

## Environment Configuration

Copy `.env.example` to `backend/.env`. Required vars:
- `DATABASE_URL` — PostgreSQL (`postgresql+psycopg://...`) or SQLite for dev
- `OPENAI_API_KEY`
- `OPENAI_MODEL` — `gpt-4o` for best results, `gpt-4o-mini` for cheaper dev testing

## Key Implementation Details

- PDFs stored under `backend/app/uploads/`; paths referenced in DB JSON fields
- Vision API calls batch up to `MAX_IMAGES_PER_CALL` (default 10) images per request
- Plagiarism detection computes semantic similarity (sentence-transformers) + Jaccard similarity; flags stored in `SimilarityFlag` table
- Role enforcement via `get_current_user` + explicit role checks in router handlers (not middleware)
