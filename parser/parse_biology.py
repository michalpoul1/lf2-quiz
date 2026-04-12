#!/usr/bin/env python3
"""
Parser for biology entrance exam questions PDF (2. LF UK).
Extracts questions, options, answer keys and outputs structured JSON.
"""

import json
import re
import sys
from pathlib import Path

import pdfplumber

# --- Configuration ---

PDF_PATH = Path(__file__).resolve().parent.parent / "data" / \
    "Modelove otazky z biologie pro prijimaci zkousky_978-80-246-4444-8.pdf"
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "data" / "biology.json"

QUESTION_PAGES = range(9, 197)   # pages 9–196 (1-indexed)
ANSWER_PAGES = range(198, 205)   # pages 198–204 (1-indexed)

CHAPTERS = [
    {"id": 1,  "name": "Úvod do biologie",
     "subtitle": "obecná charakteristika živých systémů, biologické a medicínské obory, základní biochemické procesy v živých organismech",
     "first_q": 1},
    {"id": 2,  "name": "Buněčná biologie", "subtitle": None, "first_q": 31},
    {"id": 3,  "name": "Molekulární biologie", "subtitle": None, "first_q": 155},
    {"id": 4,  "name": "Obecná, populační a lékařská genetika", "subtitle": None, "first_q": 305},
    {"id": 5,  "name": "Bakteriologie a virologie",
     "subtitle": "prokaryota, viry, priony", "first_q": 505},
    {"id": 6,  "name": "Biologie rostlin a hub",
     "subtitle": "obecná a systematická botanika, fyziologie rostlin, mykologie",
     "first_q": 545},
    {"id": 7,  "name": "Biologie živočichů a protistů",
     "subtitle": "obecná a systematická zoologie a protozoologie, fylogeneze živočichů a protistů",
     "first_q": 595},
    {"id": 8,  "name": "Biologie člověka",
     "subtitle": "anatomie, histologie, fyziologie a imunologie",
     "first_q": 695},
    {"id": 9,  "name": "Evoluční biologie",
     "subtitle": "zákonitosti evoluce, evoluční teorie, vývoj života na Zemi, vývoj člověka",
     "first_q": 857},
    {"id": 10, "name": "Ekologie",
     "subtitle": "obecná ekologie, ochrana životního prostředí, globální problémy",
     "first_q": 873},
    {"id": 11, "name": "Historie biologie a medicíny", "subtitle": None, "first_q": 896},
]

# Watermark / noise patterns to strip from every line
NOISE_PATTERNS = [
    re.compile(r"202110401.*?17:29:29"),
    re.compile(r"afc92a0a-c9ba-4cc4-9745-6c31467c07d8"),
    re.compile(r"Licence\s+dle\s+objedn[aá]vky.*", re.IGNORECASE),
    re.compile(r"^–\s*\d+\s*–$"),                       # page numbers
    re.compile(r"^\s*Poznámky\s*:\s*$", re.IGNORECASE),
    re.compile(r"Výběr doporučené literatury", re.IGNORECASE),
]

# Regex helpers
RE_QUESTION = re.compile(r"^(\d{1,3})\s*\.\s*(.+)")
RE_OPTION = re.compile(r"^([a-d])\)\s+(.+)")
RE_ANSWER_ENTRY = re.compile(
    r"(\d{1,3})\s*\.?\s*[,\s]*([a-d][,\s]*(?:[a-d][,\s]*)*)", re.IGNORECASE
)


# --- Helpers ---

def clean_line(line: str) -> str:
    """Remove watermarks and noise from a single line."""
    for pat in NOISE_PATTERNS:
        line = pat.sub("", line)
    return line.strip()


def extract_text_from_pages(pdf_path: Path, page_range: range) -> str:
    """Extract and clean text from a range of 1-indexed PDF pages."""
    lines = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_num in page_range:
            page = pdf.pages[page_num - 1]  # pdfplumber is 0-indexed
            text = page.extract_text() or ""
            for raw_line in text.split("\n"):
                cleaned = clean_line(raw_line)
                if cleaned:
                    lines.append(cleaned)
    return "\n".join(lines)


def is_upozorneni_block(line: str) -> bool:
    return line.lower().startswith("upozornění")


# --- Question parser ---

def parse_questions(text: str) -> dict[int, dict]:
    """Parse question text into {question_id: {text, options}}."""
    questions: dict[int, dict] = {}
    current_q_id = None
    current_q_text = ""
    current_option_letter = None
    current_option_text = ""
    current_options: list[dict] = []
    in_upozorneni = False

    def save_option():
        nonlocal current_option_letter, current_option_text
        if current_option_letter and current_option_text.strip():
            current_options.append({
                "letter": current_option_letter,
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
        # Skip "Upozornění:" blocks until next question
        if is_upozorneni_block(line):
            in_upozorneni = True
            continue
        if in_upozorneni:
            if RE_QUESTION.match(line):
                in_upozorneni = False
            else:
                continue

        # Try matching a new question
        m_q = RE_QUESTION.match(line)
        if m_q:
            q_num = int(m_q.group(1))
            # Distinguish a question number from a stray number:
            # valid question numbers are 1-920 and should increase
            if 1 <= q_num <= 920:
                save_question()
                current_q_id = q_num
                current_q_text = m_q.group(2)
                current_option_letter = None
                current_option_text = ""
                continue

        # Try matching an option
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

    # Save last question
    save_question()
    return questions


# --- Answer key parser ---

def parse_answer_key(text: str) -> dict[int, list[str]]:
    """Parse answer key pages into {question_id: [correct_letters]}."""
    answers: dict[int, list[str]] = {}
    # Process the entire text to find answer entries.
    # Strategy: split into tokens that start with a digit sequence.
    # Each answer entry looks like: <number>[. ] <letters separated by optional , or space>

    # First, collapse the text into a single line for easier processing
    flat = " ".join(text.split())

    # Find all answer entries using a regex that captures:
    #   - a number (1-3 digits)
    #   - optional dot
    #   - letters a-d possibly separated by commas/spaces
    # We need to be careful: entries are tightly packed, e.g. "1abd2bd3abcd"

    # Approach: iterate character by character to split number+letters groups
    i = 0
    chars = flat.replace(",", " ").replace(".", " ")
    # Tokenize by splitting on spaces
    tokens = chars.split()

    pending_number = None
    pending_letters: list[str] = []

    def save_pending():
        nonlocal pending_number, pending_letters
        if pending_number is not None and pending_letters:
            answers[pending_number] = sorted(set(pending_letters))
        pending_number = None
        pending_letters = []

    for token in tokens:
        # A token can be: pure number, pure letters, or mixed like "1abd"
        # Try to split mixed tokens: leading digits + trailing letters
        m = re.match(r"^(\d+)([a-d]+)?$", token, re.IGNORECASE)
        if m:
            num_str, letters_str = m.group(1), m.group(2)
            num = int(num_str)
            if 1 <= num <= 920:
                save_pending()
                pending_number = num
                if letters_str:
                    pending_letters.extend(list(letters_str.lower()))
            elif pending_number is not None:
                # Could be stray number, ignore
                pass
            continue

        # Pure letters token (a-d only)
        if re.match(r"^[a-d]+$", token, re.IGNORECASE):
            if pending_number is not None:
                pending_letters.extend(list(token.lower()))
            continue

        # Mixed token that doesn't start with digit but contains letters
        # e.g. unlikely but handle gracefully
        letter_only = re.findall(r"[a-d]", token, re.IGNORECASE)
        if letter_only and pending_number is not None:
            pending_letters.extend([l.lower() for l in letter_only])

    save_pending()
    return answers


# --- Assemble chapters ---

def assign_to_chapters(questions: dict[int, dict], answer_key: dict[int, list[str]]) -> list[dict]:
    """Group questions into chapters and attach correct answers."""
    chapter_boundaries = [ch["first_q"] for ch in CHAPTERS]

    def get_chapter_idx(q_id: int) -> int:
        for i in range(len(chapter_boundaries) - 1, -1, -1):
            if q_id >= chapter_boundaries[i]:
                return i
        return 0

    chapter_data = []
    for ch in CHAPTERS:
        entry = {
            "id": ch["id"],
            "name": ch["name"],
            "questions": [],
        }
        if ch["subtitle"]:
            entry["subtitle"] = ch["subtitle"]
        chapter_data.append(entry)

    for q_id in sorted(questions.keys()):
        q = questions[q_id]
        ch_idx = get_chapter_idx(q_id)
        correct = answer_key.get(q_id, [])
        chapter_data[ch_idx]["questions"].append({
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
    print(f"  STATISTIKY PARSOVÁNÍ")
    print("=" * 55)
    print(f"  Celkový počet naparsovaných otázek: {total}")
    print()
    for ch in chapters:
        print(f"  Kapitola {ch['id']:>2}. {ch['name']}: {len(ch['questions'])} otázek")
    print()
    print(f"  Otázky BEZ odpovědi v klíči: {len(missing_answers)}")
    if missing_answers:
        print(f"    ID: {sorted(missing_answers)[:20]}{'...' if len(missing_answers) > 20 else ''}")
    print(f"  Odpovědi v klíči BEZ otázky: {len(orphan_answers)}")
    if orphan_answers:
        print(f"    ID: {sorted(orphan_answers)[:20]}{'...' if len(orphan_answers) > 20 else ''}")
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

    # 1. Extract question text
    print("Extrahuji text otázek (strany 9–196)...")
    question_text = extract_text_from_pages(PDF_PATH, QUESTION_PAGES)

    # 2. Extract answer key text
    print("Extrahuji klíč odpovědí (strany 198–204)...")
    answer_text = extract_text_from_pages(PDF_PATH, ANSWER_PAGES)

    # 3. Parse questions
    print("Parsuji otázky...")
    questions = parse_questions(question_text)

    # 4. Parse answer key
    print("Parsuji klíč odpovědí...")
    answer_key = parse_answer_key(answer_text)

    # 5. Assemble into chapters
    print("Sestavuji kapitoly...")
    chapters = assign_to_chapters(questions, answer_key)

    total = sum(len(ch["questions"]) for ch in chapters)

    # 6. Build output JSON
    output = {
        "subject": "Biologie",
        "totalQuestions": total,
        "chapters": chapters,
    }

    # 7. Write JSON
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"\nJSON uložen: {OUTPUT_PATH}")

    # 8. Print stats
    print()
    print_stats(questions, answer_key, chapters)


if __name__ == "__main__":
    main()
