#!/usr/bin/env python3
"""
Parser for physics entrance exam questions PDF (2. LF UK).
Extracts questions, options, answer keys and outputs structured JSON.
"""

import json
import re
import sys
from pathlib import Path

import pdfplumber

# --- Configuration ---

PDF_PATH = Path(__file__).resolve().parent.parent / "data" / \
    "Modelove otazky z fyziky pro prijimaci zkousky_978-80-246-4446-2.pdf"
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "data" / "physics.json"

QUESTION_PAGES = range(5, 167)   # pages 5–166 (1-indexed)
ANSWER_PAGES = range(167, 175)   # pages 167–174 (1-indexed)

CHAPTERS = [
    {"id": 1,  "name": "Základní pojmy",                "subtitle": ""},
    {"id": 2,  "name": "Mechanika I",                   "subtitle": ""},
    {"id": 3,  "name": "Mechanika II",                  "subtitle": ""},
    {"id": 4,  "name": "Kmitání, vlnění a akustika",    "subtitle": ""},
    {"id": 5,  "name": "Termika",                       "subtitle": ""},
    {"id": 6,  "name": "Molekulová fyzika",             "subtitle": ""},
    {"id": 7,  "name": "Elektřina a magnetismus I",     "subtitle": ""},
    {"id": 8,  "name": "Elektřina a magnetismus II",    "subtitle": ""},
    {"id": 9,  "name": "Elektromagnetické vlnění",      "subtitle": ""},
    {"id": 10, "name": "Optika",                        "subtitle": ""},
    {"id": 11, "name": "Atomová fyzika",                "subtitle": ""},
]

NOISE_PATTERNS = [
    re.compile(r"202110401.*?17:29:46"),
    re.compile(r"4b843901-b445-4721-9e7e-da5ebe03d0d9"),
    re.compile(r"^–\s*\d+\s*–$"),
    re.compile(r"^\d+$"),  # bare page numbers
    re.compile(r"^12\s+Správné\s+odpov", re.IGNORECASE),  # answer section header
]

# Question id: "1.01", "11.91" etc.
RE_QUESTION = re.compile(r"^(\d{1,2}\.\d{2})\s+(.+)")
RE_OPTION = re.compile(r"^([A-D])\)\s*(.*)", re.IGNORECASE)
# Chapter header: "1 Základní pojmy", "11 Atomová fyzika"
RE_CHAPTER_HEADER = re.compile(r"^\d{1,2}\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]")

# Answer key entry: "1.01 A" or "1.03 B, C" or "11.11B"
RE_ANSWER_ENTRY = re.compile(
    r"(\d{1,2}\.\d{2})\s*([A-D](?:\s*,\s*[A-D])*)"
)


# --- Helpers ---

# Fix combining diacritics that PDF renders as separate chars
COMBINING_FIXES = {
    "rˇ": "ř", "Rˇ": "Ř",
    "eˇ": "ě", "Eˇ": "Ě",
    "cˇ": "č", "Cˇ": "Č",
    "sˇ": "š", "Sˇ": "Š",
    "nˇ": "ň", "Nˇ": "Ň",
    "dˇ": "ď", "Dˇ": "Ď",
    "tˇ": "ť", "Tˇ": "Ť",
    "zˇ": "ž", "Zˇ": "Ž",
    "u˚": "ů", "U˚": "Ů",
    # space variants: "r ˇ" → "ř" etc.
    "r ˇ": "ř", "e ˇ": "ě", "c ˇ": "č", "s ˇ": "š",
    "n ˇ": "ň", "d ˇ": "ď", "t ˇ": "ť", "z ˇ": "ž",
    "u ˚": "ů",
}


def fix_diacritics(text: str) -> str:
    for bad, good in COMBINING_FIXES.items():
        text = text.replace(bad, good)
    # Clean up any remaining standalone carons/rings
    text = text.replace("ˇ", "").replace("˚", "")
    return text


def clean_line(line: str) -> str:
    for pat in NOISE_PATTERNS:
        line = pat.sub("", line)
    return line.strip()


def extract_text_from_pages(pdf_path: Path, page_range: range) -> str:
    lines = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_num in page_range:
            page = pdf.pages[page_num - 1]
            text = page.extract_text(x_tolerance=1) or ""
            text = fix_diacritics(text)
            for raw_line in text.split("\n"):
                cleaned = clean_line(raw_line)
                if cleaned:
                    lines.append(cleaned)
    return "\n".join(lines)


# --- Question parser ---

def parse_questions(text: str) -> dict[str, dict]:
    questions: dict[str, dict] = {}
    current_q_id: str | None = None
    current_q_text = ""
    current_option_letter: str | None = None
    current_option_text = ""
    current_options: list[dict] = []

    def save_option():
        nonlocal current_option_letter, current_option_text
        if current_option_letter and current_option_text.strip():
            current_options.append({
                "letter": current_option_letter.lower(),
                "text": current_option_text.strip(),
            })
        current_option_letter = None
        current_option_text = ""

    def save_question():
        nonlocal current_q_id, current_q_text, current_options
        save_option()
        if current_q_id is not None and current_q_text.strip():
            questions[current_q_id] = {
                "text": current_q_text.strip(),
                "options": current_options,
            }
        current_q_id = None
        current_q_text = ""
        current_options = []

    for line in text.split("\n"):
        # Skip chapter headers like "1 Základní pojmy"
        if RE_CHAPTER_HEADER.match(line) and not RE_QUESTION.match(line):
            continue

        m_q = RE_QUESTION.match(line)
        if m_q:
            save_question()
            current_q_id = m_q.group(1)
            current_q_text = m_q.group(2)
            current_option_letter = None
            current_option_text = ""
            continue

        m_o = RE_OPTION.match(line)
        if m_o and current_q_id is not None:
            save_option()
            current_option_letter = m_o.group(1)
            current_option_text = m_o.group(2)
            continue

        # Continuation line
        if current_q_id is not None:
            if current_option_letter:
                current_option_text += " " + line
            else:
                current_q_text += " " + line

    save_question()
    return questions


# --- Answer key parser ---

def parse_answer_key(text: str) -> dict[str, list[str]]:
    answers: dict[str, list[str]] = {}
    for match in RE_ANSWER_ENTRY.finditer(text):
        q_id = match.group(1)
        letters_str = match.group(2)
        letters = [l.strip().lower() for l in letters_str.split(",") if l.strip()]
        # If no commas, split individual letters: "ABCD" -> ["a","b","c","d"]
        if len(letters) == 1 and len(letters[0]) > 1:
            letters = [ch.lower() for ch in letters[0] if ch.isalpha()]
        answers[q_id] = sorted(set(letters))
    return answers


# --- Assemble chapters ---

def get_chapter_for_question(q_id: str) -> int:
    chapter_num = int(q_id.split(".")[0])
    return chapter_num


def assign_to_chapters(
    questions: dict[str, dict], answer_key: dict[str, list[str]]
) -> list[dict]:
    chapter_data = []
    for ch in CHAPTERS:
        entry: dict = {
            "id": ch["id"],
            "name": ch["name"],
            "questions": [],
        }
        if ch["subtitle"]:
            entry["subtitle"] = ch["subtitle"]
        chapter_data.append(entry)

    # Map chapter id (1-11) -> index (0-10)
    ch_index = {ch["id"]: i for i, ch in enumerate(CHAPTERS)}

    for q_id in sorted(questions.keys(), key=lambda x: (int(x.split(".")[0]), int(x.split(".")[1]))):
        q = questions[q_id]
        ch_num = get_chapter_for_question(q_id)
        correct = answer_key.get(q_id, [])
        idx = ch_index.get(ch_num)
        if idx is None:
            continue
        chapter_data[idx]["questions"].append({
            "id": q_id,
            "text": q["text"],
            "options": q["options"],
            "correct": correct,
        })

    return chapter_data


# --- Statistics ---

def print_stats(questions: dict, answer_key: dict, chapters: list):
    q_ids = set(questions.keys())
    a_ids = set(answer_key.keys())
    missing_answers = q_ids - a_ids
    orphan_answers = a_ids - q_ids

    total = sum(len(ch["questions"]) for ch in chapters)

    print("=" * 55)
    print("  STATISTIKY PARSOVÁNÍ")
    print("=" * 55)
    print(f"  Celkový počet naparsovaných otázek: {total}")
    print()
    for ch in chapters:
        print(f"  Kapitola {ch['id']:>2}. {ch['name']}: {len(ch['questions'])} otázek")
    print()
    print(f"  Otázky BEZ odpovědi v klíči: {len(missing_answers)}")
    if missing_answers:
        ids = sorted(missing_answers, key=lambda x: (int(x.split(".")[0]), int(x.split(".")[1])))
        print(f"    ID: {ids[:20]}{'...' if len(missing_answers) > 20 else ''}")
    print(f"  Odpovědi v klíči BEZ otázky: {len(orphan_answers)}")
    if orphan_answers:
        ids = sorted(orphan_answers, key=lambda x: (int(x.split(".")[0]), int(x.split(".")[1])))
        print(f"    ID: {ids[:20]}{'...' if len(orphan_answers) > 20 else ''}")
    print("=" * 55)

    # Preview first 5 questions
    print("\n  UKÁZKA – prvních 5 otázek:\n")
    count = 0
    for ch in chapters:
        for q in ch["questions"]:
            if count >= 5:
                break
            print(f"  {q['id']}. {q['text']}")
            for opt in q["options"]:
                marker = " *" if opt["letter"] in q["correct"] else ""
                print(f"     {opt['letter']}) {opt['text']}{marker}")
            print(f"     Správné: {', '.join(q['correct'])}")
            print()
            count += 1
        if count >= 5:
            break


# --- Main ---

def main():
    if not PDF_PATH.exists():
        print(f"CHYBA: PDF soubor nenalezen: {PDF_PATH}", file=sys.stderr)
        sys.exit(1)

    print(f"Načítám PDF: {PDF_PATH.name}")

    print("Extrahuji text otázek (strany 5–166)...")
    question_text = extract_text_from_pages(PDF_PATH, QUESTION_PAGES)

    print("Extrahuji klíč odpovědí (strany 167–174)...")
    answer_text = extract_text_from_pages(PDF_PATH, ANSWER_PAGES)

    print("Parsuji otázky...")
    questions = parse_questions(question_text)

    print("Parsuji klíč odpovědí...")
    answer_key = parse_answer_key(answer_text)

    print("Sestavuji kapitoly...")
    chapters = assign_to_chapters(questions, answer_key)

    total = sum(len(ch["questions"]) for ch in chapters)

    output = {
        "subject": "Fyzika",
        "totalQuestions": total,
        "chapters": chapters,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"\nJSON uložen: {OUTPUT_PATH}")

    print()
    print_stats(questions, answer_key, chapters)


if __name__ == "__main__":
    main()
