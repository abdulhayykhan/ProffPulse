"""AI BCQ generation engine grounded strictly in UMDC lecture slides and JSMU LOs."""

from __future__ import annotations

import json
import os
import random
import re
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

load_dotenv()

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
LECTURE_INDEX: list[dict[str, Any]] = (
    json.loads((DATA_DIR / "lecture_index.json").read_text(encoding="utf-8"))
    if (DATA_DIR / "lecture_index.json").exists()
    else []
)


def is_ai_configured() -> bool:
    return bool(os.environ.get("GROQ_API_KEY") or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))


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
    groq_key = os.environ.get("GROQ_API_KEY")
    gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")

    if groq_key:
        from groq import Groq

        client = Groq(api_key=groq_key)
        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=3000,
        )
        raw_text = resp.choices[0].message.content or ""
    elif gemini_key:
        import google.generativeai as genai

        genai.configure(api_key=gemini_key)
        model = genai.GenerativeModel("gemini-2.0-flash")
        resp = model.generate_content(prompt)
        raw_text = resp.text or ""

    questions = _parse_json_array(raw_text)
    for q in questions:
        q["module"] = module_id
        if sources and "UMDC" not in q["loRef"]:
            q["loRef"] = f"{q['loRef']} ({sources[0]})"
    return questions[:count]
