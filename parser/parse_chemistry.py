#!/usr/bin/env python3
"""
Parser for chemistry entrance exam questions PDF (2. LF UK).
Questions have no numbers and no answer key — correct answers are
detected via bold font (Times-Bold) in the PDF.
"""

import json
import re
import sys
from pathlib import Path

import pdfplumber

# --- Configuration ---

PDF_PATH = Path(__file__).resolve().parent.parent / "data" / \
    "Modelove otazky z chemie pro prijimaci zkousky_978-80-246-4442-4.pdf"
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "data" / "chemistry.json"

QUESTION_PAGES = range(7, 220)  # pages 7–219 (1-indexed)

SUBCHAPTERS = [
    # (chapter_id, sub_id, name, start_page)
    (1, "1.1", "Složení a struktura atomu",                        7),
    (1, "1.2", "Periodická soustava prvků",                        15),
    (1, "1.3", "Biogenní prvky",                                   30),
    (1, "1.4", "Chemické vzorce a chemická vazba",                 31),
    (1, "1.5", "Reakční kinetika a chemická rovnováha",            34),
    (1, "1.6", "Disperzní soustavy",                               36),
    (1, "1.7", "Voda a iontový součin vody",                       37),
    (1, "1.8", "Brönstedova teorie kyselin a zásad",               39),
    (2, "2.1", "Anorganické sloučeniny",                           42),
    (2, "2.2", "Elektrolyty",                                      62),
    (2, "2.3", "Oxidační číslo; oxidace a redukce",                70),
    (2, "2.4", "Elektrolýza",                                      79),
    (2, "2.5", "Úprava chemických rovnic",                         81),
    (3, "3.1", "Výpočty z chemických vzorců",                      84),
    (3, "3.2", "Látkové množství a koncentrace",                   86),
    (3, "3.3", "Hmotnostní a objemový zlomek",                     98),
    (3, "3.4", "Molární objem plynu",                              106),
    (3, "3.5", "pH kyselin a zásad",                               108),
    (4, "4.1", "Reakce organických sloučenin a organická činidla",  118),
    (4, "4.2", "Izomerie, konformace, konfigurace",                122),
    (4, "4.3", "Alifatické a alicyklické uhlovodíky a jejich deriváty", 127),
    (4, "4.4", "Aromatické uhlovodíky, jejich reakce a deriváty",  136),
    (4, "4.5", "Terpeny (isoprenoidy)",                            144),
    (4, "4.6", "Alkoholy a thioly",                                145),
    (4, "4.7", "Fenoly",                                           150),
    (4, "4.8", "Aldehydy",                                         152),
    (4, "4.9", "Ketony a ethery",                                  155),
    (4, "4.10", "Karboxylové kyseliny, jejich reakce a deriváty",  157),
    (4, "4.11", "Aminy, amidy, alkaloidy",                         166),
    (5, "5.1", "Heterocyklické sloučeniny a jejich deriváty",      171),
    (5, "5.2", "Monosacharidy, disacharidy, polysacharidy",        179),
    (5, "5.3", "Lipidy",                                           185),
    (5, "5.4", "Vitaminy",                                         190),
    (5, "5.5", "Hormony",                                          193),
    (5, "5.6", "Aminokyseliny",                                    195),
    (5, "5.7", "Bílkoviny, peptidy",                               206),
    (5, "5.8", "Enzymy a metabolismus",                            211),
    (5, "5.9", "Nukleové kyseliny",                                218),
]

CHAPTERS = [
    {"id": 1, "name": "Obecná chemie"},
    {"id": 2, "name": "Anorganická chemie"},
    {"id": 3, "name": "Chemické výpočty"},
    {"id": 4, "name": "Organická chemie"},
    {"id": 5, "name": "Biochemie"},
]

NOISE_PATTERNS = [
    re.compile(r"202110401.*?17:29:57"),
    re.compile(r"96378b6f-ea8f-4d70-b694-89fed4becdab"),
    re.compile(r"^–\s*\d+\s*–$"),
]

# Patterns for chapter/subchapter headers
RE_CHAPTER_HEADER = re.compile(
    r"^\d\s+(OBECNÁ CHEMIE|ANORGANICKÁ CHEMIE|CHEMICKÉ VÝPOČTY|ORGANICKÁ CHEMIE|BIOCHEMIE)",
    re.IGNORECASE,
)
RE_SUBCHAPTER_HEADER = re.compile(r"^\d+\.\d+(\.\d+)?\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]")
RE_OPTION = re.compile(r"^([A-D])\)\s*(.*)", re.IGNORECASE)

# Unicode subscript digits for chemical formulas
SUBSCRIPT_MAP = str.maketrans("0123456789", "₀₁₂₃₄₅₆₇₈₉")


# --- Line extraction with font info ---

def extract_annotated_lines(page) -> list[dict]:
    """Extract lines from a page with bold/subscript info.

    Returns list of {text, is_bold, is_subscript, top}.
    """
    chars = page.chars
    if not chars:
        return []

    # Group chars by rounded top position
    lines_by_top: dict[float, list] = {}
    for c in chars:
        top = round(c["top"], 0)
        if top not in lines_by_top:
            lines_by_top[top] = []
        lines_by_top[top].append(c)

    result = []
    for top in sorted(lines_by_top.keys()):
        line_chars = sorted(lines_by_top[top], key=lambda c: c["x0"])
        text_parts = []
        for c in line_chars:
            text_parts.append(c["text"])
        raw_text = "".join(text_parts).strip()
        if not raw_text:
            continue

        # Determine if this is a subscript line (small font)
        sizes = [c["size"] for c in line_chars if c["text"].strip()]
        avg_size = sum(sizes) / len(sizes) if sizes else 10
        is_subscript = avg_size < 8

        # Determine if first significant char is bold
        is_bold = False
        for c in line_chars:
            if c["text"].strip():
                is_bold = "Bold" in c["fontname"]
                break

        # Determine font family (Helvetica = header, Times = content)
        is_helvetica = False
        for c in line_chars:
            if c["text"].strip():
                is_helvetica = "Helvetica" in c["fontname"]
                break

        result.append({
            "text": raw_text,
            "is_bold": is_bold,
            "is_subscript": is_subscript,
            "is_helvetica": is_helvetica,
            "top": top,
        })

    return result


def merge_subscripts(lines: list[dict]) -> list[dict]:
    """Merge subscript lines into the preceding line using Unicode subscript digits."""
    merged = []
    for line in lines:
        if line["is_subscript"] and merged:
            # Append subscript digits to previous line
            sub_text = line["text"].translate(SUBSCRIPT_MAP)
            merged[-1]["text"] += sub_text
        else:
            merged.append(dict(line))
    return merged


def clean_text(text: str) -> str:
    """Remove noise patterns from text."""
    for pat in NOISE_PATTERNS:
        text = pat.sub("", text)
    # Clean up tab characters from pdfplumber
    text = re.sub(r"\t+", " ", text)
    return text.strip()


# --- Question parser ---

def is_header_line(line: dict) -> bool:
    """Check if a line is a chapter or subchapter header."""
    if line["is_helvetica"] and line["is_bold"]:
        return True
    if RE_CHAPTER_HEADER.match(line["text"]):
        return True
    if line["is_helvetica"] and RE_SUBCHAPTER_HEADER.match(line["text"]):
        return True
    return False


def is_noise_line(text: str) -> bool:
    """Check if a line is a watermark, page number, or other noise."""
    for pat in NOISE_PATTERNS:
        if pat.search(text):
            return True
    return False


def parse_page(page, page_num: int) -> list[dict]:
    """Parse a single page into annotated, cleaned lines."""
    raw_lines = extract_annotated_lines(page)

    # Filter noise BEFORE subscript merging to avoid polluting content
    filtered = [l for l in raw_lines if not is_noise_line(l["text"])]
    merged = merge_subscripts(filtered)

    result = []
    for line in merged:
        text = clean_text(line["text"])
        if not text:
            continue
        result.append({
            "text": text,
            "is_bold": line["is_bold"],
            "is_helvetica": line["is_helvetica"],
            "is_subscript": line["is_subscript"],
            "page": page_num,
        })
    return result


def determine_subchapter(page_num: int) -> str | None:
    """Find which subchapter a page belongs to."""
    best = None
    for _, sub_id, _, start_page in SUBCHAPTERS:
        if page_num >= start_page:
            best = sub_id
    return best


def parse_all_questions(pdf_path: Path) -> list[dict]:
    """Parse all questions from the PDF.

    Returns list of {text, options: [{letter, text, is_correct}], subchapter, page}.
    """
    all_lines = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_num in QUESTION_PAGES:
            page = pdf.pages[page_num - 1]
            lines = parse_page(page, page_num)
            all_lines.extend(lines)

    # Now parse lines into questions
    questions = []
    current_q_text = ""
    current_q_page = 0
    current_options: list[dict] = []
    current_option_letter: str | None = None
    current_option_text = ""
    current_option_bold = False
    in_header = False

    def save_option():
        nonlocal current_option_letter, current_option_text, current_option_bold
        if current_option_letter:
            current_options.append({
                "letter": current_option_letter.lower(),
                "text": current_option_text.strip(),
                "is_correct": current_option_bold,
            })
        current_option_letter = None
        current_option_text = ""
        current_option_bold = False

    def save_question():
        nonlocal current_q_text, current_options, current_q_page
        save_option()
        if current_q_text.strip() and current_options:
            questions.append({
                "text": current_q_text.strip(),
                "options": list(current_options),
                "page": current_q_page,
            })
        current_q_text = ""
        current_options = []
        current_q_page = 0

    def have_all_options() -> bool:
        """Check if we have collected D) already (all 4 options)."""
        collected = {o["letter"] for o in current_options}
        if current_option_letter:
            collected.add(current_option_letter.lower())
        return "d" in collected

    for line in all_lines:
        text = line["text"]

        # Skip headers
        if is_header_line(line):
            # Save any pending question before header
            if current_options or current_option_letter:
                save_question()
            in_header = True
            continue
        if in_header:
            if line["is_helvetica"]:
                continue
            in_header = False

        # Try matching an option line
        m_o = RE_OPTION.match(text)
        if m_o:
            letter = m_o.group(1).upper()
            # If we see A) and already have options, save the previous question
            if letter == "A" and (current_options or current_option_letter):
                save_question()

            save_option()
            current_option_letter = m_o.group(1)
            current_option_text = m_o.group(2)
            current_option_bold = line["is_bold"]
            continue

        # Non-option line: either continuation or new question text
        if current_option_letter:
            if have_all_options():
                # We already have A-D, so this line starts a new question
                save_question()
                current_q_text = text
                current_q_page = line["page"]
            else:
                # Continuation of current option text
                current_option_text += " " + text
            continue

        # No pending option — accumulate question text
        if not current_q_text:
            current_q_page = line["page"]
        if current_q_text:
            current_q_text += " " + text
        else:
            current_q_text = text

    # Save last question
    save_question()

    return questions


# --- Assign to chapters/subchapters ---

def assign_to_structure(questions: list[dict]) -> list[dict]:
    """Assign questions to chapters and subchapters."""
    # Build subchapter lookup: sub_id -> {chapter_id, name, questions}
    sub_data = {}
    for ch_id, sub_id, name, start_page in SUBCHAPTERS:
        sub_data[sub_id] = {
            "id": sub_id,
            "name": name,
            "chapter_id": ch_id,
            "start_page": start_page,
            "questions": [],
        }

    # Sort subchapters by start_page for page-based assignment
    sub_list = sorted(SUBCHAPTERS, key=lambda x: x[3])

    global_id = 0
    for q in questions:
        global_id += 1
        page = q["page"]
        # Find the subchapter this page belongs to
        best_sub = sub_list[0][1]
        for _, sub_id, _, start_page in sub_list:
            if page >= start_page:
                best_sub = sub_id

        correct = [o["letter"] for o in q["options"] if o["is_correct"]]
        sub_data[best_sub]["questions"].append({
            "id": global_id,
            "text": q["text"],
            "options": [{"letter": o["letter"], "text": o["text"]} for o in q["options"]],
            "correct": correct,
        })

    # Build chapter structure
    chapters = []
    for ch in CHAPTERS:
        ch_subs = []
        for _, sub_id, name, _ in SUBCHAPTERS:
            sd = sub_data[sub_id]
            if sd["chapter_id"] == ch["id"]:
                entry: dict = {
                    "id": sd["id"],
                    "name": sd["name"],
                    "questions": sd["questions"],
                }
                ch_subs.append(entry)
        chapters.append({
            "id": ch["id"],
            "name": ch["name"],
            "subchapters": ch_subs,
        })

    return chapters


# --- Statistics ---

def print_stats(chapters: list):
    total = 0
    no_correct = 0

    print("=" * 60)
    print("  STATISTIKY PARSOVÁNÍ")
    print("=" * 60)

    for ch in chapters:
        ch_count = 0
        for sub in ch["subchapters"]:
            sub_count = len(sub["questions"])
            ch_count += sub_count
            for q in sub["questions"]:
                if not q["correct"]:
                    no_correct += 1
            print(f"    {sub['id']:>5s} {sub['name']}: {sub_count} otázek")
        total += ch_count
        print(f"  Kapitola {ch['id']}. {ch['name']}: {ch_count} otázek celkem")
        print()

    print(f"  CELKEM: {total} otázek")
    print(f"  Otázky BEZ správné odpovědi: {no_correct}")
    if no_correct > 0:
        for ch in chapters:
            for sub in ch["subchapters"]:
                for q in sub["questions"]:
                    if not q["correct"]:
                        print(f"    Q{q['id']} (sub {sub['id']}): {q['text'][:60]}...")
    print("=" * 60)

    # Preview first 5 questions
    print("\n  UKÁZKA – prvních 5 otázek:\n")
    count = 0
    for ch in chapters:
        for sub in ch["subchapters"]:
            for q in sub["questions"]:
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
        if count >= 5:
            break


# --- Main ---

def main():
    if not PDF_PATH.exists():
        print(f"CHYBA: PDF soubor nenalezen: {PDF_PATH}", file=sys.stderr)
        sys.exit(1)

    print(f"Načítám PDF: {PDF_PATH.name}")
    print("Extrahuji a parsuji otázky (strany 7–219)...")

    questions = parse_all_questions(PDF_PATH)
    print(f"Nalezeno {len(questions)} otázek, sestavuji kapitoly...")

    chapters = assign_to_structure(questions)

    total = sum(
        len(q)
        for ch in chapters
        for sub in ch["subchapters"]
        for q in [sub["questions"]]
    )

    output = {
        "subject": "Chemie",
        "totalQuestions": total,
        "chapters": chapters,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"\nJSON uložen: {OUTPUT_PATH}")

    print()
    print_stats(chapters)


if __name__ == "__main__":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    main()
