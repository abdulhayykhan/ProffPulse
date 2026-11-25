"""Index UMDC lecture slides and notes into a compact JSON index (data/lecture_index.json).

Usage:
    python scripts/index_lectures.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path
import fitz  # PyMuPDF

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
OUTPUT_PATH = DATA_DIR / "lecture_index.json"

# Map module folders -> (module_id, subject_hint_map)
MODULE_DIRS = [
    ("foundation", ROOT / "1st year/1. Module 1 - Foundation/1. Subjects"),
    ("blood", ROOT / "1st year/2. Module 2 - Blood/1. Subjects"),
    ("locomotion", ROOT / "1st year/3. Module 3 - Locomotion"),
    ("respiration", ROOT / "1st year/4. Module 4 - Respiration_"),
    ("cvs", ROOT / "1st year/5. Module 5 - CVS"),
    ("islamiat", ROOT / "1st year/ISLAMIAT STUDIES"),
]

SKIP_DIR_PARTS = {"ospe", "practical", "practicals", "skills lab", "clinical skill", "hand written", "imp mcqs", "7. books"}


def infer_subject(path_str: str, module_id: str) -> str:
    if module_id == "islamiat":
        return "Islamiat"
    low = path_str.lower()
    if "histolog" in low:
        return "Histology"
    if "embryo" in low:
        return "Embryology"
    if "biochem" in low:
        return "Biochemistry"
    if "physio" in low:
        return "Physiology"
    if "anatomy" in low or "bones" in low or "upper limb" in low or "lower limb" in low or "flowchart" in low:
        return "Anatomy"
    return "General"


def clean_topic_name(filename: str) -> str:
    name = re.sub(r"\.pdf_?$", "", filename, flags=re.I)
    name = re.sub(r"^\d+[a-z]?\.?\s*", "", name)
    name = re.sub(r"[_]+", " ", name)
    return re.sub(r"\s+", " ", name).strip()


def extract_chunks(pdf_path: Path, max_chars: int = 1200, max_chunks: int = 8) -> list[str]:
    try:
        doc = fitz.open(pdf_path)
    except Exception:
        return []

    text_parts: list[str] = []
    for page in doc:
        t = re.sub(r"\s+", " ", page.get_text("text")).strip()
        if len(t) > 40:
            text_parts.append(t)
        if sum(len(x) for x in text_parts) >= max_chars * max_chunks:
            break

    full = " ".join(text_parts)
    if len(full) < 80:
        return []

    chunks: list[str] = []
    for start in range(0, min(len(full), max_chars * max_chunks), max_chars):
        chunk = full[start : start + max_chars].strip()
        if chunk:
            chunks.append(chunk)
    return chunks


def main() -> None:
    entries: list[dict] = []

    for mod_id, base_dir in MODULE_DIRS:
        if not base_dir.exists():
            continue
        for pdf_path in sorted(base_dir.rglob("*.pdf*")):
            if not pdf_path.is_file():
                continue
            rel = pdf_path.relative_to(ROOT).as_posix()
            rel_low = rel.lower()
            if any(skip in rel_low for skip in SKIP_DIR_PARTS):
                continue
            # Skip study guides, schedules, MCQ sheets, and large senior/textbook compilations
            if any(k in pdf_path.name.lower() for k in ("study guide", "schedule", "mcqs", "mcq", "ospe", "ospie", "syllabus tracker", "rohma")):
                continue

            chunks = extract_chunks(pdf_path)
            if not chunks:
                continue

            entries.append({
                "module": mod_id,
                "subject": infer_subject(rel, mod_id),
                "topic": clean_topic_name(pdf_path.name),
                "source_file": pdf_path.name,
                "chunks": chunks,
            })

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(entries, indent=2, ensure_ascii=False), encoding="utf-8")

    by_mod: dict[str, int] = {}
    for e in entries:
        by_mod[e["module"]] = by_mod.get(e["module"], 0) + 1
    print(f"Indexed {len(entries)} UMDC lecture/note PDFs -> {OUTPUT_PATH}")
    for m, c in sorted(by_mod.items()):
        print(f"  - {m}: {c} files")


if __name__ == "__main__":
    main()
