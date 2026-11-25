# ProffPulse

Fast, syllabus-locked MCQ and clinical BCQ practice arena for 1st-Year MBBS students (JSMU / UMDC).

## Structure
- `api/index.py` & `vercel.json` — Single-service Vercel deployment entrypoint.
- `backend/main.py` — FastAPI server providing `/api/health`, `/api/syllabus`, `/api/questions`, `/api/sessions/weak-topics`, and serving `frontend/`.
- `backend/ai_engine.py` — Grounded AI BCQ generator (Groq / Gemini) using `data/lecture_index.json` + `data/syllabus.json`.
- `data/syllabus.json` — Structured `Module → Subject → Topic → Learning Objectives` tree (212 topics, 1,142 LOs).
- `data/past_bank.json` — Digitized JSMU Past Papers, Embryology Pre-Proff, and Islamiat MCQs (681 verified questions).
- `data/lecture_index.json` — Indexed excerpts from 208 UMDC lecture/note PDFs.
- `db/schema.sql` — Optional Supabase PostgreSQL schema for cloud mistake persistence.
- `frontend/` — Vanilla HTML5, CSS3, and ES6+ 3-screen quiz app with local mistake persistence.
- `scripts/` — Reproducible extractors (`extract_syllabus.py`, `digitize_past_bank.py`, `index_lectures.py`, `ocr_cracked_banks.py`).

## Local Run
```bash
cp .env.example .env   # optional: add GROQ_API_KEY or GEMINI_API_KEY for live AI BCQs
uvicorn backend.main:app --reload --port 8000
```

Then open `http://localhost:8000` in your browser.
