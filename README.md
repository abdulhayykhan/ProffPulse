# ProffPulse

Fast, syllabus-locked MCQ and clinical BCQ practice arena for 1st-Year MBBS students (JSMU / UMDC).

## Structure
- `data/syllabus.json` — Structured `Module → Subject → Topic → Learning Objectives` tree extracted from JSMU Study Guides (212 topics, 1,142 LOs).
- `frontend/` — Vanilla HTML5, CSS3, and ES6+ 3-screen quiz app (Quiz Configurator, Interactive Quiz Arena, Session Verdict & Mistake Loop).
- `scripts/extract_syllabus.py` — Reproducible parser for JSMU Study Guide PDFs.

## Local Preview
Serve from the repository root so `frontend/app.js` can fetch `data/syllabus.json`:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/frontend/` in your browser.
