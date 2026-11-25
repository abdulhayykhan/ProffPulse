# ProffPulse

Fast, syllabus-locked MCQ and clinical BCQ practice arena for 1st-Year MBBS students (JSMU / UMDC).

## Structure
- `backend/main.py` — FastAPI server providing `/api/syllabus`, `/api/questions`, `/api/sessions/weak-topics`, and serving `frontend/`.
- `data/syllabus.json` — Structured `Module → Subject → Topic → Learning Objectives` tree extracted from JSMU Study Guides (212 topics, 1,142 LOs).
- `data/past_bank.json` — Digitized, syllabus-mapped JSMU Past Papers, Embryology Pre-Proff, and Islamiat MCQs (681 verified questions).
- `frontend/` — Vanilla HTML5, CSS3, and ES6+ 3-screen quiz app (Quiz Configurator, Interactive Quiz Arena, Session Verdict & Mistake Loop).
- `scripts/extract_syllabus.py` — Reproducible parser for JSMU Study Guide PDFs.
- `scripts/digitize_past_bank.py` — Reproducible parser for text-based Past Papers and Islamiat MCQ PDFs.

## Local Run
```bash
uvicorn backend.main:app --reload --port 8000
```

Then open `http://localhost:8000` in your browser.
