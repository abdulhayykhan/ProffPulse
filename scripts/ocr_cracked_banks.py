"""OCR digitization pipeline for scanned JSMU Cracked MCQ Banks (1st year/MCQS CRACKED/*.pdf).

Requires GEMINI_API_KEY (or GOOGLE_API_KEY) in environment / .env to extract MCQs from scanned pages
via Gemini Vision into data/cracked_bank.json.

Usage:
    python scripts/ocr_cracked_banks.py
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

import fitz  # PyMuPDF
from dotenv import load_dotenv

load_dotenv()

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
OUTPUT_PATH = DATA_DIR / "cracked_bank.json"

CRACKED_FILES = [
    ("foundation", ROOT / "1st year/MCQS CRACKED/Foundation.pdf"),
    ("blood", ROOT / "1st year/MCQS CRACKED/Blood.pdf"),
    ("locomotion", ROOT / "1st year/MCQS CRACKED/Loco.pdf"),
    ("respiration", ROOT / "1st year/MCQS CRACKED/Respo.pdf"),
    ("cvs", ROOT / "1st year/MCQS CRACKED/CVS.pdf"),
]

OCR_PROMPT = """Extract all complete 4-option MCQs visible on this scanned medical exam page.
Return ONLY a JSON array of objects with this exact schema:
[
  {
    "stem": "Question text",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "subject": "Anatomy|Histology|Embryology|Physiology|Biochemistry",
    "topic": "Short topic label",
    "concept": "Brief explanation if visible, otherwise empty string"
  }
]
Skip any question whose answer key is not visible or unclear."""


def _get_gemini_keys() -> list[str]:
    keys: list[str] = []
    for var in ("GEMINI_API_KEY_1", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3", "GEMINI_API_KEY", "GOOGLE_API_KEY"):
        val = os.environ.get(var, "").strip()
        if val and val not in keys:
            keys.append(val)
    return keys


def ocr_pdf_with_gemini(pdf_path: Path, module_id: str, gemini_keys: list[str]) -> list[dict]:
    import google.generativeai as genai

    doc = fitz.open(pdf_path)
    extracted: list[dict] = []
    key_idx = 0

    for page_idx, page in enumerate(doc, 1):
        pix = page.get_pixmap(dpi=150)
        img_bytes = pix.tobytes("png")
        resp = None
        while key_idx < len(gemini_keys):
            try:
                genai.configure(api_key=gemini_keys[key_idx])
                model = genai.GenerativeModel("gemini-3.8-flash")
                resp = model.generate_content([
                    OCR_PROMPT,
                    {"mime_type": "image/png", "data": img_bytes},
                ])
                break
            except Exception as exc:
                print(f"  [failover] {pdf_path.name} p.{page_idx} key #{key_idx + 1}: {exc}")
                key_idx += 1
        if resp is None:
            print(f"  [stop] All Gemini keys exhausted at {pdf_path.name} p.{page_idx}")
            break
        try:
            raw = (resp.text or "").strip()
            start, end = raw.find("["), raw.rfind("]")
            if start == -1 or end == -1:
                continue
            items = json.loads(raw[start : end + 1])
            for q_idx, item in enumerate(items):
                opts = item.get("options")
                c_idx = item.get("correctIndex")
                if isinstance(opts, list) and len(opts) == 4 and isinstance(c_idx, int) and 0 <= c_idx <= 3:
                    extracted.append({
                        "id": f"cracked-{module_id}-p{page_idx}-{q_idx}",
                        "module": module_id,
                        "subject": item.get("subject", "General"),
                        "topic": item.get("topic", module_id.title()),
                        "source": "Cracked Bank",
                        "stem": str(item.get("stem", "")).strip(),
                        "options": [str(o).strip() for o in opts],
                        "correctIndex": c_idx,
                        "concept": str(item.get("concept", "")).strip() or f"Verified answer: {opts[c_idx]}",
                        "distractors": [],
                        "loRef": f"JSMU Cracked Bank · {module_id.title()}",
                    })
        except Exception as exc:
            print(f"  [warn] {pdf_path.name} p.{page_idx}: {exc}")

    return extracted


def main() -> None:
    gemini_keys = _get_gemini_keys()
    if not gemini_keys:
        print("GEMINI_API_KEY_1..3 not set. Set at least one Gemini key in .env to run Vision OCR.")
        sys.exit(0)

    all_q: list[dict] = []
    for mod_id, pdf_path in CRACKED_FILES:
        if not pdf_path.exists():
            continue
        print(f"OCR scanning {pdf_path.name} ({mod_id})...")
        qs = ocr_pdf_with_gemini(pdf_path, mod_id, gemini_keys)
        print(f"  -> extracted {len(qs)} MCQs")
        all_q.extend(qs)

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(all_q, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Saved {len(all_q)} Cracked Bank MCQs -> {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
