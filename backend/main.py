"""ProffPulse FastAPI Backend (Phase 2: Syllabus + Past Bank API & Static Frontend)."""

from __future__ import annotations

import json
import random
import re
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.ai_engine import LECTURE_INDEX, generate_ai_bcqs, is_ai_configured

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
FRONTEND_DIR = ROOT / "frontend"

SYLLABUS_DATA: dict[str, Any] = json.loads((DATA_DIR / "syllabus.json").read_text(encoding="utf-8"))
PAST_BANK: list[dict[str, Any]] = json.loads((DATA_DIR / "past_bank.json").read_text(encoding="utf-8"))
if (DATA_DIR / "cracked_bank.json").exists():
    PAST_BANK = PAST_BANK + json.loads((DATA_DIR / "cracked_bank.json").read_text(encoding="utf-8"))

app = FastAPI(title="ProffPulse API", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class WeakTopicsRequest(BaseModel):
    module: str
    weak_topics: list[str] = []
    limit: int = 10
    exclude_ids: list[str] = []
    source: str = "mixed"


def _tokenize(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]{3,}", text.lower()))


def _topic_meta(module_id: str, subject: str, topic_id: str) -> tuple[str, str | None, list[str]]:
    mod_name = module_id.title()
    topic_title = None
    los: list[str] = []
    for mod in SYLLABUS_DATA.get("modules", []):
        if mod["id"] == module_id:
            mod_name = mod["name"]
            for subj in mod.get("subjects", []):
                if subject != "all" and subj["id"] != subject.lower():
                    continue
                for t in subj.get("topics", []):
                    if topic_id in ("", "all"):
                        los.extend(t.get("los", [])[:2])
                    elif t["id"] == topic_id:
                        topic_title = t["title"]
                        los = t.get("los", [])
                        return mod_name, topic_title, los
    return mod_name, topic_title, los


def _score_topic_match(q: dict[str, Any], target_title: str) -> int:
    q_tokens = _tokenize(f"{q.get('topic', '')} {q.get('stem', '')}")
    t_tokens = _tokenize(target_title)
    if not t_tokens:
        return 0
    return len(q_tokens & t_tokens)


def _shuffle_question_options(q: dict[str, Any]) -> dict[str, Any]:
    """Return a copy of question with uniformly shuffled options & remapped distractor letters."""
    opts = q.get("options") or []
    c_idx = q.get("correctIndex", 0)
    if len(opts) != 4 or not (0 <= c_idx <= 3):
        return q

    perm = [0, 1, 2, 3]
    random.shuffle(perm)
    letters = ["A", "B", "C", "D"]
    old_to_new_letter = {letters[old_i]: letters[new_i] for new_i, old_i in enumerate(perm)}

    new_opts = [opts[i] for i in perm]
    new_correct = perm.index(c_idx)

    remapped_distractors: list[str] = []
    for d in q.get("distractors") or []:
        m = re.match(r"^([A-D])\s*[:\.\)\-]\s*(.+)$", d.strip(), re.I)
        if m:
            old_l = m.group(1).upper()
            new_l = old_to_new_letter.get(old_l, old_l)
            remapped_distractors.append(f"{new_l}: {m.group(2).strip()}")
        else:
            remapped_distractors.append(d)
    remapped_distractors.sort(key=lambda s: s[0] if s and s[0] in letters else "Z")

    return {
        **q,
        "options": new_opts,
        "correctIndex": new_correct,
        "distractors": remapped_distractors,
    }


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "modules": len(SYLLABUS_DATA.get("modules", [])),
        "past_bank_count": len(PAST_BANK),
        "lecture_index_count": len(LECTURE_INDEX),
        "ai_configured": is_ai_configured(),
    }


@app.get("/api/syllabus")
def get_syllabus() -> dict[str, Any]:
    return SYLLABUS_DATA


@app.get("/api/questions")
def get_questions(
    module: str = Query(..., description="Module id, e.g. foundation, blood, locomotion, respiration, cvs, islamiat"),
    subject: str = Query("all", description="Subject id or 'all'"),
    topic: str = Query("all", description="Topic id or 'all'"),
    source: str = Query("mixed", description="past | ai | mixed"),
    limit: int = Query(10, ge=1, le=50),
) -> dict[str, Any]:
    pool = [q for q in PAST_BANK if q["module"] == module]

    if subject != "all":
        subj_pool = [q for q in pool if q["subject"].lower() == subject.lower()]
        if subj_pool:
            pool = subj_pool

    mod_name, target_title, los = _topic_meta(module, subject, topic)
    if target_title:
        scored = sorted(pool, key=lambda q: _score_topic_match(q, target_title), reverse=True)
        exact = [q for q in scored if _score_topic_match(q, target_title) > 0]
        remainder = [q for q in scored if _score_topic_match(q, target_title) == 0]
        random.shuffle(remainder)
        ordered_past = exact + remainder
    else:
        ordered_past = list(pool)
        random.shuffle(ordered_past)

    ai_questions: list[dict[str, Any]] = []
    if source in ("ai", "mixed") and is_ai_configured():
        # Keep AI generation fast (< 4s) even on 20/30/50-MCQ sessions
        ai_target = min(limit, 8) if source == "ai" else min(max(2, limit // 2), 5)
        try:
            ai_questions = generate_ai_bcqs(module, mod_name, subject, target_title, los, count=ai_target)
        except Exception:
            ai_questions = []

    if source == "ai" and ai_questions:
        past_topup = ordered_past[: max(0, limit - len(ai_questions))]
        selected = ai_questions + past_topup
    elif source == "mixed" and ai_questions:
        past_needed = max(0, limit - len(ai_questions))
        selected = ai_questions + ordered_past[:past_needed]
        random.shuffle(selected)
    else:
        selected = ordered_past[:limit]

    selected = [_shuffle_question_options(q) for q in selected]

    return {
        "questions": selected,
        "total_available": len(pool),
        "source": source,
        "ai_used": len(ai_questions),
        "ai_configured": is_ai_configured(),
    }


@app.post("/api/sessions/weak-topics")
def get_weak_topic_questions(req: WeakTopicsRequest) -> dict[str, Any]:
    excluded = set(req.exclude_ids)
    pool = [q for q in PAST_BANK if q["module"] == req.module and q["id"] not in excluded]
    if not pool:
        pool = [q for q in PAST_BANK if q["module"] == req.module]

    if req.weak_topics:
        scored = sorted(
            pool,
            key=lambda q: max((_score_topic_match(q, wt) for wt in req.weak_topics), default=0),
            reverse=True,
        )
        ordered_past = scored
    else:
        ordered_past = list(pool)
        random.shuffle(ordered_past)

    ai_questions: list[dict[str, Any]] = []
    if req.source in ("ai", "mixed") and is_ai_configured():
        mod_name, _, _ = _topic_meta(req.module, "all", "all")
        ai_target = min(req.limit, 5)
        try:
            ai_questions = generate_ai_bcqs(
                req.module,
                mod_name,
                "all",
                ", ".join(req.weak_topics[:3]) if req.weak_topics else None,
                req.weak_topics,
                count=ai_target,
            )
        except Exception:
            ai_questions = []

    if ai_questions:
        past_needed = max(0, req.limit - len(ai_questions))
        selected = ai_questions + ordered_past[:past_needed]
        random.shuffle(selected)
    else:
        selected = ordered_past[: req.limit]

    selected = [_shuffle_question_options(q) for q in selected]
    return {"questions": selected, "total_available": len(pool), "ai_used": len(ai_questions)}


# Mount static frontend last so /api/* routes take precedence
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
