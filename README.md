# ProffPulse

**Syllabus-locked 1st-Year MBBS MCQ & clinical BCQ practice arena built for JSMU / UMDC students.**

ProffPulse pairs **681 verified past-paper MCQs**, **1,150 JSMU Learning Objectives (275 topics across 6 modules)**, and **208 indexed UMDC lecture/note PDFs** with a fast, multi-key **AI BCQ generator** (Gemini + Groq failover), a **realistic frosted glassmorphism UI** (Dark & Light themes, mobile-first responsive), and **zero-login browser persistence**.

- **Live App:** https://proffpulse-ahk.vercel.app
- **Repository:** https://github.com/abdulhayykhan/ProffPulse

---

## Table of Contents

- [Key Features](#key-features)
- [Curriculum & Dataset Coverage](#curriculum--dataset-coverage)
- [Architecture & Project Structure](#architecture--project-structure)
- [AI BCQ Engine & Failover Design](#ai-bcq-engine--failover-design)
- [API Reference](#api-reference)
- [Browser Persistence (`localStorage`)](#browser-persistence-localstorage)
- [Local Setup & Running](#local-setup--running)
- [Data Pipeline Scripts (`scripts/`)](#data-pipeline-scripts-scripts)
- [Deployment (Vercel)](#deployment-vercel)
- [Optional Database Schema (`db/schema.sql`)](#optional-database-schema-dbsql)

---

## Key Features

- **10-Second Start, Syllabus-Locked:** Filter by JSMU Module, Subject (`Anatomy`, `Histology`, `Embryology`, `Physiology`, `Biochemistry`, `Islamiat`), and specific Topic, or drill a High-Yield Mix.
- **3 Question Sources:**
  - **Mixed:** Combines fresh lecture-grounded AI BCQs with Past Bank questions.
  - **Past Bank:** 681 digitized JSMU Past Papers, Embryology Pre-Proff, and Islamiat MCQs.
  - **AI BCQs:** Real-time 2-step clinical vignette BCQs grounded in UMDC lecture excerpts and JSMU Learning Objectives.
- **2 Study Modes:**
  - **Practice Mode:** Instant answer reveal, core mechanism explanation, and option-by-option distractor breakdown.
  - **Exam Mode:** Timed (`1 min/Q`), question flagging, and full post-session verdict review.
- **Dedicated JSMU Syllabus & LO Explorer (`Syllabus & LOs`):** Browse, search, and filter all **1,150 Learning Objectives** across 275 topics, track completed LOs locally, and launch targeted practice directly.
- **Smart Mistake & Weak-Topic Loop:**
  - Tracks missed questions and weak topics locally in the browser.
  - Re-attempt missed questions cleanly without inflating your total solved MCQ count.
  - After clearing wrong answers, offers **10 more targeted MCQs** on the same weak topics to reinforce mastery.
  - Automatically clears completed session resume banners once all mistakes are resolved.
- **Realistic Glassmorphism & Mobile-First UX:**
  - Translucent frosted glass panels (`backdrop-filter`), refractive mesh grid, 3-orb ambient lighting, specular top highlights, Dark & Light themes, Web Audio feedback toggle, and keyboard shortcuts (`1–4` / `A–D` to answer, `N` / `Enter` for next, `F` to flag, `Ctrl+Enter` to start).
  - Responsive across Desktop, Tablet (`<= 860px`), and Mobile (`<= 640px` bottom-sheet modal, sticky glass topbar, 2×2 session length pills, `46px` touch targets, `16px` input sizing).

---

## Curriculum & Dataset Coverage

| Module ID | Display Name | Subjects Covered | Topics | JSMU LOs |
| :--- | :--- | :--- | :---: | :---: |
| `foundation` | Foundation | Anatomy, Histology, Embryology, Physiology, Biochemistry | 79 | 284 |
| `blood` | Blood (Hematopoietic) | Histology, Physiology, Biochemistry | 30 | 96 |
| `locomotion` | Locomotor | Anatomy, Histology, Embryology, Physiology, Biochemistry | 80 | 323 |
| `respiration` | Respiratory | Anatomy, Histology, Embryology, Physiology, Biochemistry | 37 | 167 |
| `cvs` | Cardiovascular | Anatomy, Histology, Embryology, Physiology, Biochemistry | 38 | 122 |
| `islamiat` | Islamic Studies | Islamiat | 11 | 158 |
| **Total** | **6 Modules** | **6 Subjects** | **275** | **1,150** |

- **Past Bank (`data/past_bank.json`):** `681` verified MCQs
- **Lecture Index (`data/lecture_index.json`):** `208` indexed UMDC lecture & note PDFs

---

## Architecture & Project Structure

```text
ProffPulse/
├── api/
│   └── index.py                 # Vercel serverless ASGI entrypoint (exports FastAPI app)
├── backend/
│   ├── main.py                  # FastAPI server, syllabus/question APIs, option shuffler, static mount
│   └── ai_engine.py             # Lecture-grounded AI BCQ generator + 4-key failover & cooldowns
├── data/
│   ├── syllabus.json            # Module -> Subject -> Topic -> Learning Objectives tree (275 topics, 1,150 LOs)
│   ├── past_bank.json           # 681 verified past-paper / pre-proff / Islamiat MCQs
│   └── lecture_index.json       # Excerpts indexed from 208 UMDC lecture PDFs
├── db/
│   └── schema.sql               # Optional Supabase PostgreSQL schema (mistake_logs)
├── frontend/
│   ├── index.html               # 3-screen arena + JSMU Syllabus & LO Explorer modal
│   ├── styles.css               # Frosted glassmorphism theme (dark/light) + responsive breakpoints
│   ├── app.js                   # Quiz engine, localStorage persistence, audio, keyboard shortcuts
│   └── favicon.svg              # App icon
├── scripts/
│   ├── extract_syllabus.py      # Extracts JSMU Study Guide PDFs -> data/syllabus.json
│   ├── digitize_past_bank.py    # Digitizes past MCQ PDFs -> data/past_bank.json
│   ├── index_lectures.py        # Indexes UMDC lecture PDFs -> data/lecture_index.json
│   └── ocr_cracked_banks.py     # Optional OCR helper for scanned MCQ banks -> data/cracked_bank.json
├── .env.example                 # Environment variable template
├── requirements.txt             # Python dependencies
└── vercel.json                  # Vercel Python build + catch-all routing config
```

---

## AI BCQ Engine & Failover Design

Located in [`backend/ai_engine.py`](backend/ai_engine.py):

1. **Lecture & LO Grounding:** Matches the requested module, subject, topic, and up to 8 JSMU Learning Objectives against `data/lecture_index.json` (up to `3,400` chars from the top 2 relevant lecture files) plus 2 past-paper exemplars for exam style.
2. **Exam-Level Rigor:**
   - **Medical Modules:** Enforces 2-step USMLE Step 1 / JSMU Proff-level clinical vignettes with same-category plausible distractors and verified mechanisms.
   - **Islamiat:** Enforces JSMU Annual Exam level Quranic, Seerah, Hadith, and Fiqh precision.
3. **Zero Position Bias:** Requests `{ correctAnswer, wrongOptions, distractorReasons }` from the model and performs uniform server-side permutation (`random.shuffle`) in both `ai_engine.py` and `main.py` (`_shuffle_question_options`), remapping distractor labels (`A`–`D`) accurately.
4. **4-Key Failover Chain & Cooldowns:**
   - **Primary:** `GEMINI_API_KEY_1` → `GEMINI_API_KEY_2` → `GEMINI_API_KEY_3` (also supports `GEMINI_API_KEY`, `GOOGLE_API_KEY`, `GEMINI_API_KEYS`) calling `gemini-flash-latest` with a `5s` timeout.
   - **Cooldown:** Any key hitting `429`, `503`, or timeout enters a `90s` per-key cooldown (`_KEY_COOLDOWN_UNTIL`) and immediately fails over to the next key.
   - **Fallback:** `GROQ_API_KEY` calling `openai/gpt-oss-120b` (`12s` timeout).
5. **Fast Batched Generation:** Generates AI BCQs in a single batched API call per session (`min(limit, 8)` for `ai` source, `min(max(2, limit // 2), 5)` for `mixed` source) and tops up remaining slots from `data/past_bank.json` so sessions load quickly even for 20/30/50-MCQ drills.

---

## API Reference

FastAPI app (`ProffPulse API v0.3.0`) defined in [`backend/main.py`](backend/main.py):

| Method | Endpoint | Description | Parameters / Body |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Health check & dataset counts | — |
| `GET` | `/api/syllabus` | Full module/subject/topic/LO tree | — |
| `GET` | `/api/questions` | Fetch Past Bank, AI, or Mixed MCQs | Query: `module` (required), `subject` (`all`), `topic` (`all`), `source` (`mixed\|past\|ai`), `limit` (`1..50`) |
| `POST` | `/api/sessions/weak-topics` | Targeted drill for missed topics | JSON: `{ module, weak_topics, limit, exclude_ids, source }` |

---

## Browser Persistence (`localStorage`)

ProffPulse requires no account or login. All user progress is persisted locally in the browser across refreshes:

- `proffpulse-mistakes` — Saved incorrect questions for targeted re-practice
- `proffpulse-stats` — Deduplicated solved count, accuracy, and streak metrics
- `proffpulse-history` — Completed session history log
- `proffpulse-active-session` — In-progress session snapshot for resume
- `proffpulse-config` — Last selected module, subject, source, mode, and length
- `proffpulse-lo-done` — Checked JSMU Learning Objectives in the Syllabus Explorer
- `proffpulse-theme` — Dark / Light glassmorphism theme preference
- `proffpulse-sound` — Web Audio sound effects preference

---

## Local Setup & Running

### Prerequisites
- **Python 3.12+** (or 3.10+)

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/abdulhayykhan/ProffPulse.git
cd ProffPulse
python -m venv .venv

# Windows (PowerShell)
.venv\Scripts\Activate.ps1
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

### 2. Configure Environment Variables (Optional for AI BCQs)

```bash
cp .env.example .env
```

Edit `.env` and add one or more keys (Past Bank mode works without any API keys):

```env
GEMINI_API_KEY_1=your_primary_gemini_key
GEMINI_API_KEY_2=your_backup_gemini_key
GEMINI_API_KEY_3=your_third_gemini_key
GROQ_API_KEY=your_groq_fallback_key
```

### 3. Run the Server

```bash
uvicorn backend.main:app --reload --port 8000
```

Open **http://localhost:8000** in your browser.

---

## Data Pipeline Scripts (`scripts/`)

Reproducible Python scripts (using `PyMuPDF` / `pymupdf`) to rebuild JSON datasets from raw local PDFs:

- `scripts/extract_syllabus.py` — Parses JSMU Study Guide PDFs into `data/syllabus.json`
- `scripts/digitize_past_bank.py` — Extracts and structures past-paper MCQs into `data/past_bank.json`
- `scripts/index_lectures.py` — Extracts searchable text chunks from UMDC lecture PDFs into `data/lecture_index.json`
- `scripts/ocr_cracked_banks.py` — Optional OCR pipeline for scanned MCQ banks (`data/cracked_bank.json`)

*(Raw study guide and lecture PDF directories are intentionally excluded via `.gitignore` and `.vercelignore`.)*

---

## Deployment (Vercel)

ProffPulse deploys as a single-service Vercel Python + static app via [`vercel.json`](vercel.json) and [`api/index.py`](api/index.py):

```bash
vercel --prod --yes
```

Configure `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`, `GEMINI_API_KEY_3`, and `GROQ_API_KEY` in your Vercel Project Environment Variables for live AI BCQ generation.

---

## Optional Database Schema (`db/schema.sql`)

[`db/schema.sql`](db/schema.sql) provides a ready-to-use Supabase PostgreSQL `public.mistake_logs` table and index (`idx_mistake_logs_client_module`) if you choose to extend ProffPulse with cloud-synced mistake persistence.
