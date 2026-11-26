"""Extract JSMU Study Guides into a structured syllabus tree (data/syllabus.json).

Usage:
    python scripts/extract_syllabus.py
"""

from __future__ import annotations

import html
import json
import re
from pathlib import Path
import fitz  # PyMuPDF

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
GUIDES_DIR = DATA_DIR / "JSMU Study Guides"
OUTPUT_PATH = DATA_DIR / "syllabus.json"

MODULES = [
    {
        "id": "foundation",
        "name": "Foundation",
        "order": 1,
        "pdf": GUIDES_DIR / "FOUNDATION.pdf",
        "fallback": ROOT / "1st year/1. Module 1 - Foundation/JSMU study guide.pdf",
        "type": "medical",
    },
    {
        "id": "blood",
        "name": "Blood (Hematopoietic)",
        "order": 2,
        "pdf": GUIDES_DIR / "BLOOD.pdf",
        "fallback": ROOT / "1st year/2. Module 2 - Blood/JSMU study guide.pdf",
        "type": "medical",
    },
    {
        "id": "locomotion",
        "name": "Locomotor",
        "order": 3,
        "pdf": GUIDES_DIR / "LOCO.pdf",
        "fallback": ROOT / "1st year/3. Module 3 - Locomotion/Locomotor System.pdf",
        "type": "medical",
    },
    {
        "id": "respiration",
        "name": "Respiratory",
        "order": 4,
        "pdf": GUIDES_DIR / "RESPO.pdf",
        "fallback": ROOT / "1st year/4. Module 4 - Respiration_/Study guide.pdf",
        "type": "medical",
    },
    {
        "id": "cvs",
        "name": "Cardiovascular",
        "order": 5,
        "pdf": GUIDES_DIR / "CVS.pdf",
        "fallback": ROOT / "1st year/5. Module 5 - CVS/Study guide.pdf",
        "type": "medical",
    },
    {
        "id": "islamiat",
        "name": "Islamic Studies",
        "order": 6,
        "pdf": GUIDES_DIR / "ISLAMIAT.pdf",
        "fallback": ROOT / "1st year/ISLAMIAT STUDIES/JSMU study guide.pdf",
        "type": "islamiat",
    },
]

BULLET_RE = re.compile(r"^[\u2022\uf0b7\u25cf\u25cb\u27a2\uf0d8\uf0fc✓•\-]+\s*(.*)$")
# Allow optional whitespace after "." and digits like "17. 1st week", "25.VITAMINS", "10.Anatomy"
TOPIC_NUM_RE = re.compile(r"^[\u2022\uf0b7•\s]*(\d{1,2}[a-z]?)\.\s*([A-Za-z0-9].+)$", re.I)
# Special unnumbered / missing-dot topic lines present in JSMU Study Guides
SPECIAL_TOPICS = {
    "HISTOLOGY OF SKIN": ("Histology", "Histology of Skin"),
    "BACK": ("Anatomy", "Back & Vertebral Column"),
}
MISSING_DOT_TOPIC_RE = re.compile(r"^(15)\s+(Pulmonary causes of Dyspnea.*)$", re.I)

SUBSECTION_RE = re.compile(r"^(I{1,3}|IV|V)\.\s*(.+)$")
BROAD_TOPIC_BANNER_RE = re.compile(
    r"^(TOPIC\s*[-–:]?\s*\d+.*|EXTRACELLULAR MATRIX|BONE METABOLISM|PROTEIN METABOLISM|UPPER LIMB|LOWER LIMB)$",
    re.I,
)

EMBRYO_KEYWORDS = (
    "embryo",
    "embryology",
    "gametogenesis",
    "oogenesis",
    "spermatogenesis",
    "fertilization",
    "cleavage",
    "blastocyst",
    "implantation",
    "gastrulation",
    "neurulation",
    "somite",
    "folding of embryo",
    "extra embryonic",
    "extraembryonic",
    "placenta",
    "amnion",
    "chorion",
    "umbilical",
    "fetal",
    "prenatal",
    "congenital",
    "teratogenesis",
    "development of",
    "anomalies of",
    "reproductive organs",
    "1st week",
    "2nd week",
    "3rd week",
    "first week",
    "second week",
    "third week",
)

HISTO_KEYWORDS = (
    "histology",
    "histological",
    "tissue preparation",
    "cell membrane",
    "cytoplasm",
    "nucleus",
    "cytoskeleton",
    "cell cycle",
    "epithelium",
    "epithelial",
    "cell junctions",
    "glands",
    "connective tissue",
    "lymphoid tissue",
    "spleen and tonsils",
)


def clean_pdf_lines(pdf_path: Path) -> list[str]:
    doc = fitz.open(pdf_path)
    raw: list[str] = []
    for page in doc:
        for line in page.get_text("text").splitlines():
            s = html.unescape(re.sub(r"\s+", " ", line)).strip()
            if not s:
                continue
            if re.match(r"^JINNAH SINDH MEDICAL(\s+UNIVERSITY)?$", s, re.I):
                continue
            if re.match(r"^\d+\s*\|\s*P\s*a\s*g\s*e$", s, re.I):
                continue
            if re.match(r"^\d{1,2}$", s):
                continue
            raw.append(s)

    merged: list[str] = []
    i = 0
    while i < len(raw):
        cur = raw[i]
        is_lone_num = bool(re.match(r"^[\u2022\uf0b7•\s]*\d{1,2}[a-z]?\.$", cur, re.I))
        bm = BULLET_RE.match(cur)
        is_lone_bullet = bool(bm and not bm.group(1))
        if (is_lone_num or is_lone_bullet) and i + 1 < len(raw):
            merged.append(f"{cur} {raw[i + 1]}".strip())
            i += 2
        else:
            merged.append(cur)
            i += 1
    return merged


def classify_anatomy_subtopic(title: str, subsection: str) -> str:
    sub_l = subsection.lower()
    if "histology" in sub_l:
        return "Histology"
    if "embryology" in sub_l:
        return "Embryology"

    t_l = title.lower()
    if "histology" in t_l or "histological" in t_l:
        return "Histology"
    if any(k in t_l for k in EMBRYO_KEYWORDS):
        return "Embryology"
    if any(k in t_l for k in HISTO_KEYWORDS):
        return "Histology"
    return "Anatomy"


def _is_boundary_line(nxt: str) -> bool:
    u = nxt.upper()
    if BULLET_RE.match(nxt) or TOPIC_NUM_RE.match(nxt) or MISSING_DOT_TOPIC_RE.match(nxt):
        return True
    if u in SPECIAL_TOPICS:
        return True
    if u in ("ANATOMY", "HISTOLOGY", "EMBRYOLOGY", "BIOCHEMISTRY", "PHYSIOLOGY", "DEMONSTRATIONS", "DEMONSTRATI", "PRACTICALS", "PRACTICAL"):
        return True
    if SUBSECTION_RE.match(nxt) and nxt.isupper():
        return True
    if BROAD_TOPIC_BANNER_RE.match(nxt) and nxt.upper() == nxt:
        return True
    return False


def parse_medical_module(mod_cfg: dict) -> dict:
    pdf_path = mod_cfg["pdf"] if mod_cfg["pdf"].exists() else mod_cfg["fallback"]
    lines = clean_pdf_lines(pdf_path)

    start_idx = 0
    end_idx = len(lines)
    for i, s in enumerate(lines):
        if s.upper() == "LECTURES":
            start_idx = i + 1
            break
    for i in range(start_idx, len(lines)):
        if re.match(r"^PRACTICALS?$", lines[i].upper()):
            end_idx = i
            break

    body = lines[start_idx:end_idx]

    dept: str | None = None
    subsection = ""
    topics_by_subject: dict[str, list[dict]] = {}
    current_topic: dict | None = None
    in_bullet = False

    def flush_topic():
        nonlocal current_topic
        if current_topic:
            title = current_topic["title"].strip(" :-")
            los = [lo.strip() for lo in current_topic["los"] if lo.strip()]
            # Handle unbulleted LO on Radiology of upper limb
            if not los and " Identify " in title:
                t_part, lo_part = title.split(" Identify ", 1)
                title = t_part.strip()
                los = ["Identify " + lo_part.strip()]
            current_topic["title"] = title
            current_topic["los"] = los
            subj = current_topic.pop("_subject")
            topics_by_subject.setdefault(subj, []).append(current_topic)
            current_topic = None

    i = 0
    while i < len(body):
        s = body[i]
        u = s.upper()

        if u in ("DEMONSTRATIONS", "DEMONSTRATI", "ONS", "TUTORIAL", "TUTORIALS"):
            i += 1
            continue

        if u in ("ANATOMY", "HISTOLOGY", "EMBRYOLOGY", "BIOCHEMISTRY", "PHYSIOLOGY"):
            flush_topic()
            dept = u.title()
            subsection = ""
            in_bullet = False
            i += 1
            continue

        # Broad section banners inside Biochemistry/Anatomy (e.g. "TOPIC 1: WATER", "LOWER LIMB")
        if BROAD_TOPIC_BANNER_RE.match(s) and s.isupper():
            in_bullet = False
            i += 1
            continue

        sub_m = SUBSECTION_RE.match(s)
        if sub_m and dept in ("Anatomy", "Histology", "Embryology") and s.isupper():
            flush_topic()
            subsection = sub_m.group(2).strip()
            in_bullet = False
            i += 1
            continue

        if dept is None:
            i += 1
            continue

        # Special unnumbered topic (e.g. "Histology of Skin", "BACK")
        if u in SPECIAL_TOPICS:
            flush_topic()
            spec_subj, spec_title = SPECIAL_TOPICS[u]
            current_topic = {"_subject": spec_subj, "title": spec_title, "los": []}
            in_bullet = False
            i += 1
            continue

        b_m = BULLET_RE.match(s)
        t_m = TOPIC_NUM_RE.match(s) or MISSING_DOT_TOPIC_RE.match(s)

        # In Locomotor: "5. UPPER LIMB" followed by "Clavicle (Osteology & muscle attachments)"
        if t_m and t_m.group(2).strip().upper() == "UPPER LIMB" and i + 1 < len(body) and not _is_boundary_line(body[i + 1]):
            flush_topic()
            i += 1
            title = body[i].strip()
            while i + 1 < len(body) and not _is_boundary_line(body[i + 1]):
                title += " " + body[i + 1]
                i += 1
            subj = classify_anatomy_subtopic(title, subsection) if dept == "Anatomy" else dept
            current_topic = {"_subject": subj, "title": re.sub(r"\s+", " ", title).strip(), "los": []}
            in_bullet = False
            i += 1
            continue

        if t_m and not (b_m and not re.match(r"^\d{1,2}[a-z]?\.\s*[A-Za-z0-9]", b_m.group(1))):
            flush_topic()
            title = t_m.group(2).strip()
            while i + 1 < len(body) and not _is_boundary_line(body[i + 1]):
                title += " " + body[i + 1]
                i += 1

            subj = classify_anatomy_subtopic(title, subsection) if dept == "Anatomy" else dept
            current_topic = {
                "_subject": subj,
                "title": re.sub(r"\s+", " ", title).strip(),
                "los": [],
            }
            in_bullet = False
            i += 1
            continue

        if b_m and current_topic is not None:
            lo_text = b_m.group(1).strip()
            current_topic["los"].append(lo_text)
            in_bullet = True
            i += 1
            continue

        if current_topic is not None and in_bullet and current_topic["los"]:
            prev = current_topic["los"][-1]
            current_topic["los"][-1] = (prev + " " + s).strip() if prev else s
        i += 1

    flush_topic()

    subj_order = ["Anatomy", "Histology", "Embryology", "Physiology", "Biochemistry"]
    subjects = []
    for subj_name in subj_order:
        t_list = topics_by_subject.get(subj_name, [])
        if not t_list:
            continue
        formatted_topics = []
        for idx, t in enumerate(t_list, 1):
            formatted_topics.append({
                "id": f"{mod_cfg['id']}-{subj_name.lower()}-{idx}",
                "title": t["title"],
                "los": t["los"],
            })
        subjects.append({
            "id": subj_name.lower(),
            "name": subj_name,
            "topics": formatted_topics,
        })

    return {
        "id": mod_cfg["id"],
        "name": mod_cfg["name"],
        "order": mod_cfg["order"],
        "subjects": subjects,
    }


def parse_islamiat_module(mod_cfg: dict) -> dict:
    pdf_path = mod_cfg["pdf"] if mod_cfg["pdf"].exists() else mod_cfg["fallback"]
    lines = clean_pdf_lines(pdf_path)

    start_idx = 0
    end_idx = len(lines)
    for i, s in enumerate(lines):
        if s.upper().startswith("TOPIC:"):
            start_idx = i
            break
    for i in range(start_idx, len(lines)):
        if lines[i].upper() in ("INTERNAL", "INTERNAL ASSESSMENT", "ASSESSMENT"):
            end_idx = i
            break

    body = lines[start_idx:end_idx]
    topics: list[dict] = []
    current_topic: dict | None = None
    topic_re = re.compile(r"^TOPIC:\s*(\d+)\s*[-–—]\s*(.+)$", re.I)

    for s in body:
        m = topic_re.match(s)
        if m:
            if current_topic:
                topics.append(current_topic)
            topics_num = m.group(1)
            title = m.group(2).strip().title()
            current_topic = {"id": f"islamiat-{topics_num}", "title": title, "los": []}
            continue

        if current_topic is None:
            continue

        cleaned = BULLET_RE.sub("", s).strip()
        if not cleaned:
            continue
        if re.match(r"^(i{1,3}|iv|vi{0,3}|ix|x|I{1,3}|IV|VI{0,3}|IX|X|\d+)\.?$", cleaned):
            current_topic["los"].append("")
        elif current_topic["los"] and current_topic["los"][-1] == "":
            current_topic["los"][-1] = cleaned
        elif (
            current_topic["los"]
            and not re.match(r"^(Lecture|LECTURE|\d+\.|[iIxXvV]+\.)", cleaned)
            and len(current_topic["los"][-1]) < 90
            and not current_topic["los"][-1].endswith(".")
            and cleaned[0].islower()
        ):
            current_topic["los"][-1] += " " + cleaned
        else:
            current_topic["los"].append(cleaned)

    if current_topic:
        topics.append(current_topic)

    for t in topics:
        t["los"] = [lo for lo in t["los"] if lo]

    return {
        "id": mod_cfg["id"],
        "name": mod_cfg["name"],
        "order": mod_cfg["order"],
        "subjects": [{"id": "islamiat", "name": "Islamiat", "topics": topics}],
    }


def build_syllabus() -> dict:
    modules = []
    for mod in MODULES:
        if mod["type"] == "islamiat":
            modules.append(parse_islamiat_module(mod))
        else:
            modules.append(parse_medical_module(mod))
    return {"curriculum": "JSMU / UMDC 1st-Year MBBS", "modules": modules}


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    syllabus = build_syllabus()
    OUTPUT_PATH.write_text(json.dumps(syllabus, indent=2, ensure_ascii=False), encoding="utf-8")

    total_topics = 0
    total_los = 0
    for mod in syllabus["modules"]:
        anat_sum = sum(len(s["topics"]) for s in mod["subjects"] if s["name"] in ("Anatomy", "Histology", "Embryology"))
        print(f"\n[{mod['order']}] {mod['name']} (Anatomy+Histo+Embryo={anat_sum})")
        for subj in mod["subjects"]:
            t_count = len(subj["topics"])
            lo_count = sum(len(t["los"]) for t in subj["topics"])
            total_topics += t_count
            total_los += lo_count
            print(f"    - {subj['name']}: {t_count} topics, {lo_count} LOs")
    print(f"\nSaved {OUTPUT_PATH} ({total_topics} topics, {total_los} LOs)")


if __name__ == "__main__":
    main()
