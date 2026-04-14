#!/usr/bin/env python3
"""
Generátor vysvětlení pro quiz otázky.
Sestaví vysvětlení algoritmicky z kontextu otázky (bez externího API).

Použití:
  python generate_explanations.py --subject biology --start 1 --end 50
  python generate_explanations.py --subject chemistry --start 1 --end 100
  python generate_explanations.py --subject physics
"""

import argparse
import json
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "..", "data")

SUBJECT_FILES = {
    "biology": "biology.json",
    "chemistry": "chemistry.json",
    "physics": "physics.json",
}

EXPLANATION_FILES = {
    "biology": "explanations-biology.json",
    "chemistry": "explanations-chemistry.json",
    "physics": "explanations-physics.json",
}


def load_questions(subject: str) -> list[dict]:
    """Load all questions from a subject JSON file, flattening chapters/subchapters."""
    path = os.path.join(DATA_DIR, SUBJECT_FILES[subject])
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    questions = []
    for chapter in data["chapters"]:
        if "questions" in chapter:
            questions.extend(chapter["questions"])
        if "subchapters" in chapter:
            for sub in chapter["subchapters"]:
                questions.extend(sub["questions"])
    return questions


def load_existing_explanations(subject: str) -> dict[str, str]:
    """Load existing explanations file."""
    path = os.path.join(DATA_DIR, EXPLANATION_FILES[subject])
    if not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_explanations(subject: str, explanations: dict[str, str]):
    """Save explanations to JSON file."""
    path = os.path.join(DATA_DIR, EXPLANATION_FILES[subject])
    with open(path, "w", encoding="utf-8") as f:
        json.dump(explanations, f, ensure_ascii=False, indent=2)


def generate_explanation(question: dict) -> str:
    """Generate explanation text from question context."""
    correct_letters = question["correct"]
    options = {opt["letter"]: opt["text"] for opt in question["options"]}
    wrong_letters = [opt["letter"] for opt in question["options"] if opt["letter"] not in correct_letters]

    # Build correct answers string
    correct_display = ", ".join(l.upper() for l in correct_letters)
    correct_texts = [f"{l.upper()}) {options[l]}" for l in correct_letters]
    wrong_texts = [f"{l.upper()}) {options[l]}" for l in wrong_letters]

    parts = []

    # Line 1: Correct answer
    parts.append(f"**Správná odpověď: {correct_display}**")

    # Line 2: Why correct answers are correct
    if len(correct_texts) == 1:
        parts.append(f"Správně je {correct_texts[0]}.")
    else:
        parts.append(f"Správné odpovědi jsou: {'; '.join(correct_texts)}.")

    # Line 3: Why wrong answers are wrong
    if len(wrong_texts) == 1:
        parts.append(f"Nesprávná je odpověď {wrong_texts[0]}.")
    elif len(wrong_texts) > 1:
        parts.append(f"Nesprávné odpovědi: {'; '.join(wrong_texts)}.")

    # Line 4: Key concept
    question_text = question["text"].rstrip(":")
    parts.append(f"**Klíčový koncept:** {question_text}")

    return "\n\n".join(parts)


def main():
    parser = argparse.ArgumentParser(description="Generátor vysvětlení pro quiz otázky")
    parser.add_argument("--subject", required=True, choices=["biology", "chemistry", "physics"],
                        help="Předmět (biology/chemistry/physics)")
    parser.add_argument("--start", type=int, default=None,
                        help="ID první otázky (včetně)")
    parser.add_argument("--end", type=int, default=None,
                        help="ID poslední otázky (včetně)")
    parser.add_argument("--overwrite", action="store_true",
                        help="Přepsat existující vysvětlení")
    args = parser.parse_args()

    # Load questions
    questions = load_questions(args.subject)
    print(f"Načteno {len(questions)} otázek z {args.subject}")

    # Filter by range
    if args.start is not None:
        questions = [q for q in questions if q["id"] >= args.start]
    if args.end is not None:
        questions = [q for q in questions if q["id"] <= args.end]

    if not questions:
        print("Žádné otázky v zadaném rozsahu.")
        sys.exit(0)

    print(f"Generuji vysvětlení pro {len(questions)} otázek (ID {questions[0]['id']}–{questions[-1]['id']})")

    # Load existing
    explanations = load_existing_explanations(args.subject)
    generated = 0
    skipped = 0

    for q in questions:
        qid = str(q["id"])
        if qid in explanations and not args.overwrite:
            skipped += 1
            continue
        if not q.get("correct"):
            skipped += 1
            continue

        explanations[qid] = generate_explanation(q)
        generated += 1

    # Sort by numeric ID
    sorted_explanations = dict(sorted(explanations.items(), key=lambda x: int(x[0]) if x[0].isdigit() else 0))

    save_explanations(args.subject, sorted_explanations)
    print(f"Hotovo! Vygenerováno: {generated}, přeskočeno: {skipped}")
    print(f"Celkem vysvětlení v souboru: {len(sorted_explanations)}")


if __name__ == "__main__":
    main()
