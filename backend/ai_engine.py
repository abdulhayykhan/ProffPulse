"""AI BCQ generation engine grounded strictly in UMDC lecture slides and JSMU LOs.

Failover chain with cooldown tracking:
    Gemini Key 1 -> Gemini Key 2 -> Gemini Key 3 -> Groq API Key
"""

from __future__ import annotations

import json
import logging
import os
import random
import re
import time
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
PAST_BANK_REF: list[dict[str, Any]] = (
    json.loads((DATA_DIR / "past_bank.json").read_text(encoding="utf-8"))
    if (DATA_DIR / "past_bank.json").exists()
    else []
)

# Per-key cooldown epoch seconds when hitting 429 / 503 / timeout
_KEY_COOLDOWN_UNTIL: dict[str, float] = {}
COOLDOWN_SECONDS = 90.0


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
    max_chars: int = 3400,
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
    for entry in candidates[:2]:
        sources.append(entry["source_file"])
        for chunk in entry["chunks"][:2]:
            if total + len(chunk) > max_chars:
                break
            context_parts.append(f"[{entry['source_file']}] {chunk}")
            total += len(chunk)
    return "\n\n".join(context_parts), sources


def _sample_past_exemplars(module_id: str, subject: str, k: int = 2) -> str:
    pool = [q for q in PAST_BANK_REF if q["module"] == module_id]
    if subject != "all":
        sp = [q for q in pool if q["subject"].lower() == subject.lower()]
        if sp:
            pool = sp
    if not pool:
        return ""
    picks = random.sample(pool, min(k, len(pool)))
    lines = []
    for i, q in enumerate(picks, 1):
        lines.append(f"Example {i}: {q['stem']} | Options: {q['options']}")
    return "\n".join(lines)


def _build_prompt(
    module_id: str,
    module_name: str,
    subject: str,
    topic_title: str | None,
    los: list[str],
    context: str,
    count: int,
) -> str:
    lo_sample = random.sample(los, min(len(los), 8)) if los else []
    lo_block = "\n".join(f"- {lo}" for lo in lo_sample) or "- Core module concepts"
    exemplars = _sample_past_exemplars(module_id, subject, k=2)

    if module_id == "islamiat":
        rigor_rules = (
            "Write JSMU Annual Exam level MCQs testing exact Quranic Surah/verse context, historical battles/treaties, "
            "Hadith sciences, or comparative Fiqh distinctions. Avoid trivial giveaways; all 4 options must be plausible."
        )
    else:
        rigor_rules = (
            "Write HARD, USMLE Step 1 / JSMU Proff-level 2-step clinical vignette BCQs:\n"
            "- Every question MUST present a realistic clinical vignette (age, sex, symptoms, exam signs, or lab/ABG/ECG values) "
            "requiring 2-step deduction (vignette -> anatomical/physiological/biochemical mechanism -> answer).\n"
            "- NEVER ask simple 1-line recall or 'Which of the following is defined as...' questions.\n"
            "- All 4 options must be the SAME category (e.g., 4 adjacent nerves, 4 pathway enzymes, 4 embryological derivatives) "
            "with similar word length and high-plausibility traps so elimination requires deep understanding.\n"
            "- Medical accuracy check: ensure correctAnswer is 100% medically true (no inverted mechanisms) and ALL 3 wrongOptions "
            "are unequivocally false for the stem (never write two partially-correct options)."
        )

    return f"""You are a senior JSMU / UMDC 1st-Year MBBS exam-paper author.
Generate exactly {count} challenging syllabus-locked BCQs strictly grounded in the JSMU Learning Objectives and UMDC Lecture Excerpts below.

Module: {module_name}
Subject: {subject}
Topic: {topic_title or 'High-Yield Mixed Topics'}

Difficulty & Quality Standard:
{rigor_rules}

JSMU Past Paper Style Reference:
{exemplars or 'Standard JSMU clinical BCQ difficulty.'}

JSMU Learning Objectives:
{lo_block}

UMDC Lecture Excerpts:
{context or 'Use rigorous 1st-year MBBS JSMU curriculum concepts for the listed LOs.'}

Return ONLY a valid JSON array of {count} objects with this exact schema:
[
  {{
    "stem": "A 34-year-old man presents with...",
    "correctAnswer": "The single 100% medically accurate answer choice",
    "wrongOptions": [
      "Plausible same-category distractor 1",
      "Plausible same-category distractor 2",
      "Plausible same-category distractor 3"
    ],
    "distractorReasons": [
      "Why distractor 1 is incorrect",
      "Why distractor 2 is incorrect",
      "Why distractor 3 is incorrect"
    ],
    "topic": "Specific topic name",
    "subject": "Anatomy|Histology|Embryology|Physiology|Biochemistry|Islamiat",
    "concept": "Concise 1-2 sentence explanation of the core mechanism.",
    "loRef": "JSMU {module_name} · Specific LO / UMDC ref"
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
    letters = ["A", "B", "C", "D"]
    valid: list[dict[str, Any]] = []
    for idx, item in enumerate(data):
        if not item.get("stem"):
            continue

        # Preferred schema: correctAnswer + wrongOptions (eliminates LLM index mismatch!)
        correct_ans = str(item.get("correctAnswer", "")).strip()
        wrong_opts = item.get("wrongOptions")
        reasons = item.get("distractorReasons") or []

        if correct_ans and isinstance(wrong_opts, list) and len(wrong_opts) >= 3:
            tagged = [(correct_ans, True, "")]
            for w_i, w_opt in enumerate(wrong_opts[:3]):
                reason = str(reasons[w_i]).strip() if w_i < len(reasons) else ""
                tagged.append((str(w_opt).strip(), False, reason))
            random.shuffle(tagged)

            opts = [t[0] for t in tagged]
            c_idx = next(i for i, t in enumerate(tagged) if t[1])
            distractors = [
                f"{letters[i]}: {t[2]}"
                for i, t in enumerate(tagged)
                if not t[1] and t[2]
            ]
        else:
            # Backward-compatible fallback for legacy options + correctIndex format
            opts = item.get("options")
            c_idx = item.get("correctIndex")
            if not (isinstance(opts, list) and len(opts) == 4 and isinstance(c_idx, int) and 0 <= c_idx <= 3):
                continue
            opts = [str(o).strip() for o in opts]
            distractors = [str(d).strip() for d in item.get("distractors", [])]

        valid.append({
            "id": f"ai-{random.randint(10000, 99999)}-{idx}",
            "module": "",
            "subject": item.get("subject", "General"),
            "topic": item.get("topic", "AI Generated"),
            "source": "AI Fresh BCQ",
            "stem": str(item["stem"]).strip(),
            "options": opts,
            "correctIndex": c_idx,
            "concept": str(item.get("concept", "")).strip(),
            "distractors": distractors,
            "loRef": str(item.get("loRef", "UMDC Lecture Grounded")).strip(),
        })
    return valid


def _call_gemini(api_key: str, prompt: str) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={api_key}"
    payload = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.25, "maxOutputTokens": 2400},
    }).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=5) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    candidates = data.get("candidates") or []
    if not candidates:
        return ""
    parts = candidates[0].get("content", {}).get("parts") or []
    return "".join(p.get("text", "") for p in parts)


def _call_groq(api_key: str, prompt: str) -> str:
    from groq import Groq

    client = Groq(api_key=api_key, timeout=12.0)
    resp = client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.25,
        max_tokens=3200,
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
    prompt = _build_prompt(module_id, module_name, subject, topic_title, los, context, count)

    now = time.time()
    gemini_keys = get_gemini_keys()
    active_gemini = [(i + 1, k) for i, k in enumerate(gemini_keys) if _KEY_COOLDOWN_UNTIL.get(k, 0.0) <= now]
    if not active_gemini and gemini_keys:
        # If all cooled down, still allow trying the oldest cooled-down key before Groq
        active_gemini = [(1, gemini_keys[0])]

    # 1. Try Gemini keys 1 -> 2 -> 3 with 8s timeout & cooldown on 429/503/timeout
    for idx, gemini_key in active_gemini:
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
            _KEY_COOLDOWN_UNTIL[gemini_key] = time.time() + COOLDOWN_SECONDS
            logger.warning("Gemini key #%d failed (%s); cooling down 90s & failing over.", idx, type(exc).__name__)

    # 2. Fast fallback to Groq
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
