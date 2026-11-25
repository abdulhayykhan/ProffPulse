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
        ai_target = limit if source == "ai" else max(1, limit // 2)
        try:
            ai_questions = generate_ai_bcqs(module, mod_name, subject, target_title, los, count=min(ai_target, 15))
        except Exception:
            ai_questions = []

    if source == "ai" and ai_questions:
        selected = ai_questions[:limit]
    elif source == "mixed" and ai_questions:
        past_needed = max(0, limit - len(ai_questions))
        selected = ai_questions + ordered_past[:past_needed]
        random.shuffle(selected)
    else:
        selected = ordered_past[:limit]

    return {
        "questions": selected,
        "total_available": len(pool),
        "source": source,
        "ai_used": len(ai_questions),
        "ai_configured": is_ai_configured(),
    }


@app.post("/api/sessions/weak-topics")
def get_weak_topic_questions(req: WeakTopicsRequest) -> dict[str, Any]:
    pool = [q for q in PAST_BANK if q["module"] == req.module]
    if req.weak_topics:
        scored = sorted(
            pool,
            key=lambda q: max((_score_topic_match(q, wt) for wt in req.weak_topics), default=0),
            reverse=True,
        )
        selected = scored[: req.limit]
    else:
        selected = random.sample(pool, min(req.limit, len(pool)))
    return {"questions": selected, "total_available": len(pool)}


# Mount static frontend last so /api/* routes take precedence
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
