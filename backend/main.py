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

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
FRONTEND_DIR = ROOT / "frontend"

SYLLABUS_DATA: dict[str, Any] = json.loads((DATA_DIR / "syllabus.json").read_text(encoding="utf-8"))
PAST_BANK: list[dict[str, Any]] = json.loads((DATA_DIR / "past_bank.json").read_text(encoding="utf-8"))

app = FastAPI(title="ProffPulse API", version="0.2.0")

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


def _topic_title_for_id(module_id: str, topic_id: str) -> str | None:
    if not topic_id or topic_id == "all":
        return None
    for mod in SYLLABUS_DATA.get("modules", []):
        if mod["id"] == module_id:
            for subj in mod.get("subjects", []):
                for t in subj.get("topics", []):
                    if t["id"] == topic_id:
                        return t["title"]
    return topic_id


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

    target_title = _topic_title_for_id(module, topic)
    if target_title:
        scored = sorted(pool, key=lambda q: _score_topic_match(q, target_title), reverse=True)
        exact = [q for q in scored if _score_topic_match(q, target_title) > 0]
        remainder = [q for q in scored if _score_topic_match(q, target_title) == 0]
        random.shuffle(remainder)
        ordered = exact + remainder
    else:
        ordered = list(pool)
        random.shuffle(ordered)

    selected = ordered[:limit]
    return {
        "questions": selected,
        "total_available": len(pool),
        "source": source,
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
