"""Digitize text-based JSMU Past Papers, Pre-Proff MCQs, and Islamiat MCQs into data/past_bank.json.

Usage:
    python scripts/digitize_past_bank.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path
import fitz  # PyMuPDF

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
SYLLABUS_PATH = DATA_DIR / "syllabus.json"
OUTPUT_PATH = DATA_DIR / "past_bank.json"

PP1_PATH = ROOT / "1st year/PAST PAPERS/Solved Past Paper 1 JSMU.pdf"
PP2_PATH = ROOT / "1st year/PAST PAPERS/Solved Past Paper 2 JSMU.pdf"
EMBRYO_PATH = ROOT / "1st year/ANATOMY/Pre proff anatomy all modules/embryology_mcqs_with_answers.pdf"
ISL_MCQS_PATH = ROOT / "1st year/ISLAMIAT STUDIES/Prof Habib Un Nabi Islamiat MCQS .pdf"
ISL_TRICKS_PATH = ROOT / "1st year/ISLAMIAT STUDIES/Islamic Studies MCQs Answer + Trick for Every Question.pdf"

SUBJECT_HEADERS = {"Anatomy", "Histology", "Embryology", "Physiology", "Biochemistry"}

LOCO_KEYWORDS = (
    "femoral", "brachial", "plexus", "tarsal", "carpal", "scapula", "humerus", "radius",
    "ulna", "clavicle", "femur", "tibia", "fibula", "hip", "gluteal", "thigh", "leg",
    "foot", "hand", "wrist", "elbow", "shoulder", "knee", "ankle", "axilla", "pectoral",
    "deltoid", "trapezius", "rotator", "median nerve", "ulnar nerve", "radial nerve",
    "sciatic", "obturator", "popliteal", "cubital", "snuff box", "retinaculum",
    "lumbrical", "interossei", "thenar", "hypothenar", "upper limb", "lower limb",
    "sarcolemma", "sarcomere", "neuromuscular", "urea cycle", "collagen", "elastin",
    "osteology", "bone", "fracture", "dislocation", "palsy", "locomotor",
)

BLOOD_KEYWORDS = (
    "rbc", "erythro", "hemoglobin", "haemoglobin", "heme", "haem", "porphyr", "jaundice",
    "bilirubin", "iron", "ferritin", "transferrin", "hepcidin", "wbc", "leukocyte",
    "neutrophil", "lymphocyte", "monocyte", "eosinophil", "basophil", "platelet",
    "thromb", "coagul", "clotting", "fibrin", "hemophilia", "haemophilia", "anemia",
    "anaemia", "blood group", "abo", "rh ", "transfusion", "spleen", "thymus",
    "lymph node", "tonsil", "immunoglobulin", "plasma protein", "albumin", "b12",
    "folate", "vitamin k", "reticulocyte", "hematopo", "haematopo", "esr",
)

CVS_KEYWORDS = (
    "heart", "cardiac", "coronary", "pericardi", "myocardi", "endocardi", "epicardi",
    "atrium", "atrial", "ventric", "mitral", "tricuspid", "aortic valve", "pulmonary valve",
    "sa node", "av node", "purkinje", "ecg", "ekg", "qrs", "p wave", "t wave",
    "cardiac cycle", "heart sound", "murmur", "stroke volume", "cardiac output",
    "preload", "afterload", "frank-starling", "baroreceptor", "blood pressure",
    "hypertension", "shock", "lipoprotein", "ldl", "hdl", "chylomicron", "cholesterol",
    "ketone", "beta oxidation", "fatty acid", "fetal circulation", "foramen ovale",
    "ductus arteriosus", "aortic arch", "tetralogy", "septal defect", "angina",
)

RESPO_KEYWORDS = (
    "lung", "pleura", "trachea", "bronch", "alveol", "diaphragm", "intercostal",
    "thoracic", "mediastin", "rib", "sternum", "phrenic", "vagus", "azygos",
    "surfactant", "spirometr", "vital capacity", "tidal volume", "residual volume",
    "compliance", "bohr", "haldane", "oxygen dissociation", "oxyhemoglobin",
    "hypoxia", "dyspnea", "pneumothorax", "asthma", "emphysema", "copd",
    "respiratory", "ventilation", "perfusion", "abg", "acid-base", "anion gap",
    "pco2", "po2", "chemoreceptor", "carotid body",
)


def infer_module(paper: str, subject: str, topic: str, stem: str) -> str:
    text = f"{topic} {stem}".lower()
    if paper == "pp1":
        if any(k in text for k in LOCO_KEYWORDS):
            return "locomotion"
        return "foundation"
    # pp2: Blood, CVS, Respiration
    scores = {
        "blood": sum(1 for k in BLOOD_KEYWORDS if k in text),
        "cvs": sum(1 for k in CVS_KEYWORDS if k in text),
        "respiration": sum(1 for k in RESPO_KEYWORDS if k in text),
    }
    best = max(scores, key=lambda k: scores[k])
    return best if scores[best] > 0 else "cvs"


def refine_subject(subject: str, topic: str, stem: str) -> str:
    text = f"{topic} {stem}".lower()
    if subject == "Anatomy":
        if any(k in text for k in ("embryo", "fetal", "development of", "neural crest", "gastrulation", "somite", "pharyngeal", "aortic arch", "congenital", "foramen ovale", "ductus arteriosus")):
            return "Embryology"
        if any(k in text for k in ("histolog", "epithelium", "connective tissue", "intercalated disc", "alveolar epithelium", "hassall")):
            return "Histology"
    return subject


def parse_solved_past_paper(pdf_path: Path, paper_tag: str) -> list[dict]:
    doc = fitz.open(pdf_path)
    lines: list[str] = []
    for page in doc:
        for raw in page.get_text("text").splitlines():
            s = re.sub(r"\s+", " ", raw).strip()
            if not s:
                continue
            if s.startswith("PAK MEDICS JSMU PAPERS"):
                continue
            if s in ("JSMU PAST MCQ BANK", "PAPER 1", "PAPER 2", "FOUNDATION & LOCOMOTOR") or "CARDIOVASCULAR SYSTEM" in s and "•" in s:
                continue
            if "All rights reserved" in s:
                continue
            lines.append(s)

    questions: list[dict] = []
    subject = "Anatomy"
    last_topic = "General"
    i = 0
    q_start_re = re.compile(r"^Q(\d+)\.\s*(.+)$")
    opt_re = re.compile(r"^([A-D])\.\s*(.+)$")
    ans_re = re.compile(r"^Correct answer:\s*([A-D])\b(.*)$", re.I)

    while i < len(lines):
        s = lines[i]
        if s in SUBJECT_HEADERS:
            subject = s
            i += 1
            continue

        qm = q_start_re.match(s)
        if not qm:
            # Track likely topic heading (short non-question line before Qn.)
            if len(s) < 90 and not opt_re.match(s) and not s.startswith("Correct answer:") and not s.startswith("Explanation:"):
                last_topic = s
            i += 1
            continue

        q_num = qm.group(1)
        stem_parts = [qm.group(2)]
        i += 1
        while i < len(lines) and not opt_re.match(lines[i]) and not q_start_re.match(lines[i]):
            stem_parts.append(lines[i])
            i += 1

        options = ["", "", "", ""]
        cur_opt = -1
        while i < len(lines) and not ans_re.match(lines[i]) and not q_start_re.match(lines[i]):
            om = opt_re.match(lines[i])
            if om:
                cur_opt = ord(om.group(1)) - ord("A")
                options[cur_opt] = om.group(2)
            elif cur_opt >= 0:
                options[cur_opt] = (options[cur_opt] + " " + lines[i]).strip()
            i += 1

        correct_idx = -1
        explanation_parts: list[str] = []
        if i < len(lines) and ans_re.match(lines[i]):
            am = ans_re.match(lines[i])
            correct_idx = ord(am.group(1).upper()) - ord("A")
            i += 1
            # Consume wrapped answer line until Explanation: or next Q/subject
            while i < len(lines) and not lines[i].startswith("Explanation:") and not q_start_re.match(lines[i]) and lines[i] not in SUBJECT_HEADERS:
                # Could be wrapped option text on Correct answer line; stop if it looks like next topic
                if len(lines[i]) < 70 and i + 1 < len(lines) and q_start_re.match(lines[i + 1]):
                    break
                i += 1

        if i < len(lines) and lines[i].startswith("Explanation:"):
            explanation_parts.append(lines[i][len("Explanation:"):].strip())
            i += 1
            while i < len(lines) and not q_start_re.match(lines[i]) and lines[i] not in SUBJECT_HEADERS:
                # If next line is Qn., current line is likely the topic header for next Q
                if i + 1 < len(lines) and q_start_re.match(lines[i + 1]):
                    break
                explanation_parts.append(lines[i])
                i += 1

        stem = " ".join(stem_parts).strip()
        if all(o.strip() for o in options) and 0 <= correct_idx <= 3 and stem:
            subj = refine_subject(subject, last_topic, stem)
            mod = infer_module(paper_tag, subj, last_topic, stem)
            questions.append({
                "id": f"{paper_tag}-q{q_num}",
                "module": mod,
                "subject": subj,
                "topic": last_topic,
                "source": "Past Bank",
                "stem": stem,
                "options": [o.strip() for o in options],
                "correctIndex": correct_idx,
                "concept": " ".join(explanation_parts).strip() or f"Verified answer: {options[correct_idx].strip()}",
                "distractors": [],
                "loRef": f"JSMU Solved Past Paper {'1' if paper_tag == 'pp1' else '2'} · {subj}",
            })

    return questions


def parse_embryo_mcqs(pdf_path: Path) -> list[dict]:
    doc = fitz.open(pdf_path)
    lines = [re.sub(r"\s+", " ", ln).strip() for p in doc for ln in p.get_text("text").splitlines()]
    lines = [ln for ln in lines if ln and not ln.startswith("Embryology MCQs") and not ln.startswith("Answer is written")]

    questions: list[dict] = []
    q_re = re.compile(r"^(\d+)\.\s+(.+)$")
    opt_re = re.compile(r"^([A-D])\.\s+(.+)$")
    ans_re = re.compile(r"^Answer:\s*([A-D])\.", re.I)

    i = 0
    while i < len(lines):
        qm = q_re.match(lines[i])
        if not qm:
            i += 1
            continue
        q_num = qm.group(1)
        stem_parts = [qm.group(2)]
        i += 1
        while i < len(lines) and not opt_re.match(lines[i]) and not q_re.match(lines[i]):
            stem_parts.append(lines[i])
            i += 1
        options = ["", "", "", ""]
        cur_opt = -1
        while i < len(lines) and not ans_re.match(lines[i]) and not q_re.match(lines[i]):
            om = opt_re.match(lines[i])
            if om:
                cur_opt = ord(om.group(1)) - ord("A")
                options[cur_opt] = om.group(2)
            elif cur_opt >= 0:
                options[cur_opt] = (options[cur_opt] + " " + lines[i]).strip()
            i += 1

        correct_idx = -1
        notes: list[str] = []
        if i < len(lines) and ans_re.match(lines[i]):
            correct_idx = ord(ans_re.match(lines[i]).group(1).upper()) - ord("A")
            i += 1
            while i < len(lines) and not q_re.match(lines[i]):
                notes.append(lines[i])
                i += 1

        if all(o.strip() for o in options) and 0 <= correct_idx <= 3:
            questions.append({
                "id": f"embryo-q{q_num}",
                "module": "foundation",
                "subject": "Embryology",
                "topic": "General Embryology",
                "source": "Past Bank",
                "stem": " ".join(stem_parts).strip(),
                "options": [o.strip() for o in options],
                "correctIndex": correct_idx,
                "concept": " ".join(notes).strip() or f"Correct option: {options[correct_idx].strip()}",
                "distractors": [],
                "loRef": "JSMU Pre-Proff · Embryology",
            })
    return questions


def parse_islamiat_tricks(pdf_path: Path) -> dict[int, tuple[str, str]]:
    doc = fitz.open(pdf_path)
    full_text = "\n".join(p.get_text("text") for p in doc)
    # Join wrapped lines that don't start with Q<num> or Topic
    merged_lines: list[str] = []
    for raw in full_text.splitlines():
        s = re.sub(r"\s+", " ", raw).strip()
        if not s:
            continue
        if re.match(r"^Q\d+\s+", s) or s.startswith("Topic "):
            merged_lines.append(s)
        elif merged_lines:
            merged_lines[-1] += " " + s

    tricks: dict[int, tuple[str, str]] = {}
    q_re = re.compile(r"^Q(\d+)\s+.+?→\s*(.+?)(?:💡\s*(.+))?$")
    for line in merged_lines:
        m = q_re.match(line)
        if m:
            q_num = int(m.group(1))
            ans_text = m.group(2).replace("⚠️", "").strip()
            trick = (m.group(3) or "").strip()
            tricks[q_num] = (ans_text, trick)
    return tricks


def parse_islamiat_mcqs(mcqs_path: Path, tricks_path: Path) -> list[dict]:
    tricks = parse_islamiat_tricks(tricks_path)
    doc = fitz.open(mcqs_path)
    lines = [re.sub(r"\s+", " ", ln).strip() for p in doc for ln in p.get_text("text").splitlines()]

    topic_re = re.compile(r"^Topic\s*\d+:\s*(.+)$", re.I)
    q_re = re.compile(r"^(\d+)\.\s+(.+)$")
    opt_re = re.compile(r"^([a-d])[\.\)]\s*(.+)$", re.I)

    questions: list[dict] = []
    current_topic = "Introduction to Holy Quran"
    global_q_num = 0
    i = 0

    while i < len(lines):
        s = lines[i]
        tm = topic_re.match(s)
        if tm:
            current_topic = tm.group(1).strip()
            i += 1
            continue

        qm = q_re.match(s)
        if not qm:
            i += 1
            continue

        if qm:
            global_q_num += 1

        stem_parts = [qm.group(2)]
        i += 1
        while i < len(lines) and not opt_re.match(lines[i]) and not q_re.match(lines[i]) and not topic_re.match(lines[i]):
            stem_parts.append(lines[i])
            i += 1

        raw_opts: list[tuple[str, str]] = []
        while i < len(lines) and not q_re.match(lines[i]) and not topic_re.match(lines[i]):
            om = opt_re.match(lines[i])
            if om:
                raw_opts.append((om.group(1).lower(), om.group(2)))
            elif raw_opts:
                k, v = raw_opts[-1]
                raw_opts[-1] = (k, (v + " " + lines[i]).strip())
            i += 1

        # Handle glued option A (e.g. "54. ...?Cattle" followed by a, b, c)
        stem_joined = " ".join(stem_parts).strip()
        if len(raw_opts) == 3 and [k for k, _ in raw_opts] == ["a", "b", "c"] and "?" in stem_joined:
            q_part, glued_a = stem_joined.split("?", 1)
            if glued_a.strip():
                stem_joined = q_part.strip() + "?"
                options = [glued_a.strip(), raw_opts[0][1], raw_opts[1][1], raw_opts[2][1]]
            else:
                options = ["", "", "", ""]
        elif len(raw_opts) >= 4:
            options = ["", "", "", ""]
            for k, v in raw_opts:
                idx = ord(k) - ord("a")
                if 0 <= idx <= 3:
                    options[idx] = v
        else:
            options = ["", "", "", ""]

        if all(o.strip() for o in options):
            ans_hint, trick = tricks.get(global_q_num, ("", ""))
            if not ans_hint:
                continue

            # Match ans_hint to best option (exact/substring/token overlap)
            best_idx = -1
            best_score = -1.0
            ans_l = re.sub(r"[^a-z0-9\s]", "", ans_hint.lower())
            ans_tokens = set(ans_l.split())
            for idx, opt in enumerate(options):
                opt_l = re.sub(r"[^a-z0-9\s]", "", opt.lower())
                if ans_l and (ans_l in opt_l or opt_l in ans_l):
                    best_idx = idx
                    best_score = 999.0
                    break
                opt_tokens = set(opt_l.split())
                overlap = len(ans_tokens & opt_tokens) / max(len(ans_tokens | opt_tokens), 1)
                if overlap > best_score:
                    best_score = overlap
                    best_idx = idx

            if best_idx >= 0 and best_score >= 0.25:
                concept = f"Answer: {options[best_idx].strip()}"
                if trick:
                    concept += f" — Memory trick: {trick}"
                questions.append({
                    "id": f"isl-q{global_q_num}",
                    "module": "islamiat",
                    "subject": "Islamiat",
                    "topic": current_topic,
                    "source": "Past Bank",
                    "stem": stem_joined,
                    "options": [o.strip() for o in options],
                    "correctIndex": best_idx,
                    "concept": concept,
                    "distractors": [],
                    "loRef": f"JSMU Islamiat · {current_topic}",
                })

    return questions


def main() -> None:
    pp1 = parse_solved_past_paper(PP1_PATH, "pp1")
    pp2 = parse_solved_past_paper(PP2_PATH, "pp2")
    embryo = parse_embryo_mcqs(EMBRYO_PATH)
    islamiat = parse_islamiat_mcqs(ISL_MCQS_PATH, ISL_TRICKS_PATH)

    all_q = pp1 + pp2 + embryo + islamiat

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(all_q, indent=2, ensure_ascii=False), encoding="utf-8")

    by_mod: dict[str, int] = {}
    for q in all_q:
        by_mod[q["module"]] = by_mod.get(q["module"], 0) + 1

    print(f"PP1: {len(pp1)}, PP2: {len(pp2)}, Embryo: {len(embryo)}, Islamiat: {len(islamiat)}")
    print(f"Total digitized: {len(all_q)} questions -> {OUTPUT_PATH}")
    for mod, cnt in sorted(by_mod.items()):
        print(f"  - {mod}: {cnt}")


if __name__ == "__main__":
    main()
