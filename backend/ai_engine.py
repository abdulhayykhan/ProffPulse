"""AI BCQ generation engine grounded strictly in UMDC lecture slides and JSMU LOs.

Failover chain:
    Gemini Key 1 -> Gemini Key 2 -> Gemini Key 3 -> Groq API Key
"""

from __future__ import annotations

import json
import logging
import os
import random
import re
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("proffpulse.ai")

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
LECTURE_INDEX: list[dict[str, Any]] = (
    json.loads((DATA_DIR / "lecture_index.json").read_text(encoding="utf-8"))
    if (DATA_DIR / "lecture_index.json").exists()
    else []
)


def get_gemini_keys() -> list[str]:
    """Return ordered, deduplicated Gemini API keys from environment."""
    candidates: list[str] = []
    for var in ("GEMINI_API_KEY_1", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3", "GEMINI_API_KEY", "GOOGLE_API_KEY"):
        val = os.environ.get(var, "").strip()
        if val:
            candidates.append(val)
    multi = os.environ.get("GEMINI_API_KEYS", "").strip()
    if multi:
        for part in multi.split(","):
            if part.strip():
                candidates.append(part.strip())

    seen: set[str] = set()
    ordered: list[str] = []
    for key in candidates:
        if key not in seen:
            seen.add(key)
            ordered.append(key)
    return ordered


def is_ai_configured() -> bool:
    return bool(get_gemini_keys() or os.environ.get("GROQ_API_KEY", "").strip())


def _tokenize(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]{3,}", text.lower()))


def _select_lecture_context(
    module_id: str,
    subject: str,
    topic_title: str | None,
    los: list[str],
    max_chars: int = 4500,
) -> tuple[str, list[str]]:
    candidates = [e for e in LECTURE_INDEX if e["module"] == module_id]
    if subject != "all":
        subj_matches = [e for e in candidates if e["subject"].lower() == subject.lower()]
        if subj_matches:
            candidates = subj_matches

    if not candidates:
        return "", []

    query_tokens = _tokenize(f"{topic_title or ''} {' '.join(los[:5])}")
    if query_tokens:
        candidates = sorted(
            candidates,
            key=lambda e: len(_tokenize(f"{e['topic']} {e['source_file']}") & query_tokens),
            reverse=True,
        )
    else:
        random.shuffle(candidates)

    context_parts: list[str] = []
    sources: list[str] = []
    total = 0
    for entry in candidates[:3]:
        sources.append(entry["source_file"])
        for chunk in entry["chunks"][:2]:
            if total + len(chunk) > max_chars:
                break
            context_parts.append(f"[{entry['source_file']}] {chunk}")
            total += len(chunk)
    return "\n\n".join(context_parts), sources


def _build_prompt(
    module_name: str,
    subject: str,
    topic_title: str | None,
    los: list[str],
    context: str,
    count: int,
) -> str:
    lo_block = "\n".join(f"- {lo}" for lo in los[:10]) or "- Core module concepts"
    return f"""You are a senior 1st-Year MBBS medical educator at JSMU / UMDC.
Generate exactly {count} high-yield clinical vignette BCQs (or direct concept MCQs for Islamiat) strictly grounded in the JSMU Learning Objectives and UMDC Lecture Excerpts below. Do NOT include out-of-syllabus material.

Module: {module_name}
Subject: {subject}
Topic: {topic_title or 'Mixed Module Topics'}

JSMU Learning Objectives:
{lo_block}

UMDC Lecture Excerpts:
{context or 'Use standard 1st-year MBBS JSMU curriculum concepts for the listed LOs.'}

Return ONLY a valid JSON array of {count} objects with this exact schema:
[
  {{
    "stem": "Clinical vignette or question stem...",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "topic": "Short topic name",
    "subject": "Anatomy|Histology|Embryology|Physiology|Biochemistry|Islamiat",
    "concept": "Concise 1-2 sentence explanation of the core concept.",
    "distractors": [
      "B: Why option B is wrong.",
      "C: Why option C is wrong.",
      "D: Why option D is wrong."
    ],
    "loRef": "JSMU {module_name} · Specific LO or UMDC slide ref"
  }}
]"""


def _parse_json_array(raw: str) -> list[dict[str, Any]]:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    start = cleaned.find("[")
    end = cleaned.rfind("]")
    if start == -1 or end == -1:
        return []
    data = json.loads(cleaned[start : end + 1])
    valid: list[dict[str, Any]] = []
    for idx, item in enumerate(data):
        opts = item.get("options")
        c_idx = item.get("correctIndex")
        if (
            isinstance(opts, list)
            and len(opts) == 4
            and isinstance(c_idx, int)
            and 0 <= c_idx <= 3
            and item.get("stem")
        ):
            valid.append({
                "id": f"ai-{random.randint(10000, 99999)}-{idx}",
                "module": "",  # filled by caller
                "subject": item.get("subject", "General"),
                "topic": item.get("topic", "AI Generated"),
                "source": "AI Fresh BCQ",
                "stem": str(item["stem"]).strip(),
                "options": [str(o).strip() for o in opts],
                "correctIndex": c_idx,
                "concept": str(item.get("concept", "")).strip(),
                "distractors": [str(d).strip() for d in item.get("distractors", [])],
                "loRef": str(item.get("loRef", "UMDC Lecture Grounded")).strip(),
            })
    return valid


def _call_gemini(api_key: str, prompt: str) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key={api_key}"
    payload = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.4, "maxOutputTokens": 3000},
    }).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=25) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    candidates = data.get("candidates") or []
    if not candidates:
        return ""
    parts = candidates[0].get("content", {}).get("parts") or []
    return "".join(p.get("text", "") for p in parts)


def _call_groq(api_key: str, prompt: str) -> str:
    from groq import Groq

    client = Groq(api_key=api_key)
    resp = client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
        max_tokens=3000,
    )
    return resp.choices[0].message.content or ""


def generate_ai_bcqs(
    module_id: str,
    module_name: str,
    subject: str,
    topic_title: str | None,
    los: list[str],
    count: int = 5,
) -> list[dict[str, Any]]:
    if not is_ai_configured() or count <= 0:
        return []

    context, sources = _select_lecture_context(module_id, subject, topic_title, los)
    prompt = _build_prompt(module_name, subject, topic_title, los, context, count)

    raw_text = ""

    # 1. Try Gemini keys 1 -> 2 -> 3 in order
    for idx, gemini_key in enumerate(get_gemini_keys(), 1):
        try:
            raw_text = _call_gemini(gemini_key, prompt)
            if raw_text.strip():
                questions = _parse_json_array(raw_text)
                if questions:
                    for q in questions:
                        q["module"] = module_id
                        if sources and "UMDC" not in q["loRef"]:
                            q["loRef"] = f"{q['loRef']} ({sources[0]})"
                    return questions[:count]
        except Exception as exc:
            logger.warning("Gemini key #%d failed (%s); falling back to next provider.", idx, type(exc).__name__)

    # 2. Fall back to Groq if all Gemini keys failed or hit rate limits
    groq_key = os.environ.get("GROQ_API_KEY", "").strip()
    if groq_key:
        try:
            raw_text = _call_groq(groq_key, prompt)
            questions = _parse_json_array(raw_text)
            for q in questions:
                q["module"] = module_id
                if sources and "UMDC" not in q["loRef"]:
                    q["loRef"] = f"{q['loRef']} ({sources[0]})"
            return questions[:count]
        except Exception as exc:
            logger.warning("Groq fallback failed (%s).", type(exc).__name__)

    return []
