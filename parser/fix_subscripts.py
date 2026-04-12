#!/usr/bin/env python3
"""
fix_subscripts.py
Fix chemical and physical formulas with broken subscripts/superscripts in quiz data.

The PDF parser lost inline subscripts/superscripts in three ways:
  1. Displaced subscripts: stripped from formulas and appended as Unicode at end of text
     e.g. "NHMnOje vzorec:₄₄" → "NH₄MnO₄ je vzorec:"
  2. Space-separated: elements and their numbers split by spaces
     e.g. "CO 2 a H O 2" → "CO₂ a H₂O"
  3. Missing space: formula merged with following Czech text
     e.g. "Cl₂vzniká" → "Cl₂ vzniká"
"""

import json
import re
import sys
from pathlib import Path
from collections import OrderedDict

DATA_DIR = Path(__file__).parent.parent / "data"

# ══════════════════════════════════════════════════════════
# Unicode character maps
# ══════════════════════════════════════════════════════════
SUB_DIGITS = "₀₁₂₃₄₅₆₇₈₉"
SUP_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹"
SUB_MAP = str.maketrans("0123456789", SUB_DIGITS)
SUP_MAP = str.maketrans("0123456789+-", SUP_DIGITS + "⁺⁻")
UNSUB_MAP = str.maketrans(SUB_DIGITS, "0123456789")
UNSUP_MAP = str.maketrans(SUP_DIGITS + "⁺⁻", "0123456789+-")

def to_sub(s: str) -> str:
    return s.translate(SUB_MAP)

def to_sup(s: str) -> str:
    return s.translate(SUP_MAP)


# ══════════════════════════════════════════════════════════
# STEP 1: Comprehensive formula dictionary
# ══════════════════════════════════════════════════════════

# ── EXACT STRING REPLACEMENTS ──
# For complex broken patterns that need manual mapping.
# Ordered longest-first to prevent partial matches.

EXACT_REPLACEMENTS = {
    # ─── "je vzorec:" patterns (formula merged with text, subscripts at end) ───
    "(NH)CrOje vzorec:₄₂₂₇": "(NH₄)₂Cr₂O₇ je vzorec:",
    "Al(HPO)je vzorec:₂₄₃": "Al₂(HPO₄)₃ je vzorec:",
    "Ca(HSO)je vzorec:₃₂": "Ca(HSO₃)₂ je vzorec:",
    "Ca(PO)je vzorec:₃₄₂": "Ca₃(PO₄)₂ je vzorec:",
    "NHMnOje vzorec:₄₄": "NH₄MnO₄ je vzorec:",
    "NaSiOje vzorec:₂₃": "Na₂SiO₃ je vzorec:",
    "NHNOje vzorec:₄₃": "NH₄NO₃ je vzorec:",
    "HSiOje vzorec:₂₃": "H₂SiO₃ je vzorec:",
    "NaHSO je vzorec:₃": "NaHSO₃ je vzorec:",
    "Ca(HS)je vzorec:₂": "Ca(HS)₂ je vzorec:",
    "COClje vzorec:₂": "COCl₂ je vzorec:",
    "KCOje vzorec:₂₃": "K₂CO₃ je vzorec:",
    "MgSOje vzorec:₄": "MgSO₄ je vzorec:",
    "CaHje vzorec:₂": "CaH₂ je vzorec:",
    "BaFje vzorec:₂": "BaF₂ je vzorec:",
    "POje vzorec:₄₆": "P₄O₆ je vzorec:",
    "PFje vzorec:₅": "PF₅ je vzorec:",
    "CSje vzorec:₂": "CS₂ je vzorec:",
    "HS je vzorec:₂": "H₂S je vzorec:",

    # ─── Reaction equations with displaced subscripts ───
    "Chlor můžeme laboratorně připravit oxidací chlorovodíku manga- nistanem draselným. Tuto reakci popisuje rovnice: → a KMnO+ b HCl  c Cl+ d MnCl+ e KCl + f HO₄₂₂₂ Která z následujících odpovědí obsahuje správné stechiometrické koeficienty?":
        "Chlor můžeme laboratorně připravit oxidací chlorovodíku manganistanem draselným. Tuto reakci popisuje rovnice: a KMnO₄ + b HCl → c Cl₂ + d MnCl₂ + e KCl + f H₂O. Která z následujících odpovědí obsahuje správné stechiometrické koeficienty?",
    "Reakcí chloru s hydroxidy alkalických kovů při zvýšené teplotě vznikají chlorečnany. Tuto reakci popisuje rovnice: → a Cl+ b NaOH  x NaClO+ y NaCl + z HO₂₃ ₂ Která z následujících odpovědí obsahuje správné stechiometrické koeficienty?":
        "Reakcí chloru s hydroxidy alkalických kovů při zvýšené teplotě vznikají chlorečnany. Tuto reakci popisuje rovnice: a Cl₂ + b NaOH → x NaClO₃ + y NaCl + z H₂O. Která z následujících odpovědí obsahuje správné stechiometrické koeficienty?",
    "→ Reakce vodíku s kyslíkem probíhá podle rovnice 2 H+ O 2 HO.₂₂₂ Kolik gramů vody vznikne reakcí 1,5 molu vodíku s kyslíkem? A(H) = 1, A(O) = 16rr":
        "Reakce vodíku s kyslíkem probíhá podle rovnice 2 H₂ + O₂ → 2 H₂O. Kolik gramů vody vznikne reakcí 1,5 molu vodíku s kyslíkem? Aᵣ(H) = 1, Aᵣ(O) = 16",
    "→ Reakce vodíku s kyslíkem probíhá podle rovnice 2 H+ O 2 HO.₂₂₂ Kolik gramů vody vznikne reakcí 0,5 molu vodíku s kyslíkem? A(H) = 1, A(O) = 16rr":
        "Reakce vodíku s kyslíkem probíhá podle rovnice 2 H₂ + O₂ → 2 H₂O. Kolik gramů vody vznikne reakcí 0,5 molu vodíku s kyslíkem? Aᵣ(H) = 1, Aᵣ(O) = 16",
    "→ Vyberte správná tvrzení. V reakci Zn + 2 HCl  ZnCl+ H:₂₂":
        "Vyberte správná tvrzení. V reakci Zn + 2 HCl → ZnCl₂ + H₂:",
    "V reakci NH+ HO  NH+ OHmá voda charakter:₃₂₄":
        "V reakci NH₃ + H₂O → NH₄⁺ + OH⁻ má voda charakter:",
    "→+– V reakci HCl + HO  HO+ Clmá voda charakter:₂₃":
        "V reakci HCl + H₂O → H₃O⁺ + Cl⁻ má voda charakter:",
    "Reakcí Cl+ 2 NaOH ve vodném roztoku vzniká:₂":
        "Reakcí Cl₂ + 2 NaOH ve vodném roztoku vzniká:",
    "Reakce Cl+ 2 e 2 Clje příkladem:₂":
        "Reakce Cl₂ + 2 e⁻ → 2 Cl⁻ je příkladem:",
    "Reakce 2 Cl Cl+ 2 eje příkladem:₂":
        "Reakce 2 Cl⁻ → Cl₂ + 2 e⁻ je příkladem:",
    "Reakcí PO+ 6 HO vzniká kyselina:₄₁₀₂":
        "Reakcí P₄O₁₀ + 6 H₂O vzniká kyselina:",
    "2 SO+ O= 2 SO₂₂₃": "2 SO₂ + O₂ = 2 SO₃",
    "Vodík má ve sloučeninách NHa CaHoxidační čísla:₃₂":
        "Vodík má ve sloučeninách NH₃ a CaH₂ oxidační čísla:",
    "Jakého typu jsou reakce chloru s CH a s CH?₄₂₄":
        "Jakého typu jsou reakce chloru s CH₄ a s C₂H₄?",

    # ─── Acid-base equilibrium option texts ───
    "HCO + HO = HCO+ OH₃₂₂₃– ₂–+":
        "HCO₃⁻ + H₂O = H₂CO₃ + OH⁻",
    "HCO+ HO = CO+ HO₃₂₃₃":
        "HCO₃⁻ + H₂O = CO₃²⁻ + H₃O⁺",
    "HCO+ HO = CO+ HO₃₂₃₂– +":
        "HCO₃⁻ + H₂O = CO₃²⁻ + H₃O⁺",
    "HCO+ HO= HCO+ HO₃₃₂₃₂–":
        "HCO₃⁻ + H₃O⁺ = H₂CO₃ + H₂O",
    "HSO+ HO = HSO+ OH₄₂₂₄":
        "H₂SO₄ + H₂O = HSO₄⁻ + H₃O⁺",
    "HSO+ HO = SO+ HO₄₂₄₂–+":
        "HSO₄⁻ + H₂O = SO₄²⁻ + H₃O⁺",
    "HSO+ HO= HSO+ HO₄₃₂₄₂–₂– +":
        "HSO₄⁻ + H₃O⁺ = H₂SO₄ + H₂O",
    "HSO+ HO = SO+ HO₄₂₄₃":
        "HSO₄⁻ + H₂O = SO₄²⁻ + H₃O⁺",
    "RNH+ 2 OH= RN+ 2 HO₂₂–+":
        "RNH₂ + 2 OH⁻ = RN²⁻ + 2 H₂O",
    "RNH+ HO = RNH+ OH₂₂₃––":
        "RNH₂ + H₂O = RNH₃⁺ + OH⁻",
    "RNH+ HO = RNH+ HO₂₂₃+–":
        "RNH₂ + H₂O = RNH₃⁺ + OH⁻",
    "V reakci NH+ HO  NH+ OHmá voda charakter:₃₂₄–":
        "V reakci NH₃ + H₂O → NH₄⁺ + OH⁻ má voda charakter:",

    # ─── Concentration / pH patterns ───
    "+ Koncentrace iontů HOv čisté vodě (při 25 °C) je:₃–₇–₃":
        "Koncentrace iontů H₃O⁺ v čisté vodě (při 25 °C) je 10⁻⁷ mol·dm⁻³:",
    "+ Jaká bude koncentrace c(HO) ve výsledném roztoku?₃–₂ –₃":
        "Jaká bude koncentrace c(H₃O⁺) ve výsledném roztoku?",
    "HOa OH₃₂–": "H₃O⁺ a OH⁻",
    "[HO] < [OH]₃–+": "[H₃O⁺] < [OH⁻]",
    "[HO] > [OH]₃+–": "[H₃O⁺] > [OH⁻]",

    # ─── Oxide lists ───
    "NO, FeO, PO, NaO₂₂₃₂₅₂": "NO₂, Fe₂O₃, P₂O₅, Na₂O",
    "KO, NO, CaO, ZnO₂₂₅": "K₂O, N₂O₅, CaO, ZnO",
    "NO, LiO, SO, CuO₂₃₂₃": "NO₂, Li₂O, SO₃, CuO",
    "ClO, CO, MgO₂₇₂": "Cl₂O₇, CO₂, MgO",
    "AlO, ZnO, CaO₂₃": "Al₂O₃, ZnO, CaO",

    # ─── Option formulas with displaced subscripts ───
    "HSOa HCl₂₄": "H₂SO₄ a HCl",
    "HSOa HNO₂₄₃": "H₂SO₄ a HNO₃",
    "HNOa HBr₃": "HNO₃ a HBr",
    "HNOa HCl₃": "HNO₃ a HCl",
    "HO a PH₂₃": "H₂O a PH₃",
    "CHa AsH₄₃": "CH₄ a AsH₃",
    "NHNO₄₂": "NH₄NO₂",
    "NHNO₄₃": "NH₄NO₃",
    "NHNO₃₃": "NH₃NO₃",
    "ClO₂₇": "Cl₂O₇",
    "BO₂₃": "B₂O₃",
    "NO₂₃": "N₂O₃",
    "PO₂₃": "P₂O₃",
    "NH₄₃–": "NH₃⁻",
    "HPO₄₃–": "H₃PO₄",
    "COCl, Ca(OH), NaNO:₂₂₃": "COCl₂, Ca(OH)₂, NaNO₃:",

    # ─── Hydrates ───
    "CaSO·1/2HO₄ ₂": "CaSO₄·½H₂O",
    "CaSO·2HO₄ ₂": "CaSO₄·2H₂O",
    "CuSO·5HO₄₂": "CuSO₄·5H₂O",
    "NaSO·10HO₂₄ ₂": "Na₂SO₄·10H₂O",

    # ─── Electron configurations (subscripts → superscripts) ───
    "nsnp₂₄": "ns²np⁴",
    "nsnp₂₂": "ns²np²",

    # ─── More reaction equations ───
    "→ CuSO+ Fe  FeSO+ Cu je typem reakce:₄₄":
        "CuSO₄ + Fe → FeSO₄ + Cu je typem reakce:",

    # ─── Compound formulas (displaced subscripts, element order swapped) ───
    "CH₂₂": "C₂H₂",
    "CH₆₆": "C₆H₆",
    "PO₄₁₀": "P₄O₁₀",
    "NO₂₅": "N₂O₅",
    "SO, PbO, SiO, NO₂₂₂": "SO₂, PbO, SiO₂, NO₂",

    # ─── pH and H₃O⁺ notation ───
    "pH = –log [HO]₃+": "pH = –log [H₃O⁺]",
    "pH = –ln [HO]₃+": "pH = –ln [H₃O⁺]",
    "pH = log [HO]₃+": "pH = log [H₃O⁺]",
    "[OH] > [HO]₃+–": "[OH⁻] > [H₃O⁺]",
    "[OH] < [HO]₃+–": "[OH⁻] < [H₃O⁺]",
    "[HO] = [OH]₃+–": "[H₃O⁺] = [OH⁻]",
    "HO₂₂+": "H₂O₂",

    # ─── Ion charges at end ───
    "kationt Li₂+": "kationt Li²⁺",
    "kationt Na₃+": "kationt Na³⁺",
    "kationt Na₂+": "kationt Na²⁺",
    "aniont Cl₂+": "aniont Cl₂⁻",
    "Atomový útvar tvořený dvanácti protony, deseti elektrony a dvanácti neutrony je:₂+":
        "Atomový útvar tvořený dvanácti protony, deseti elektrony a dvanácti neutrony je: Mg²⁺",
    "Atomový útvar tvořený osmi protony, deseti elektrony a osmi neutrony je:₂+":
        "Atomový útvar tvořený osmi protony, deseti elektrony a osmi neutrony je: O²⁻",

    # ─── Concentration notation ───
    "10mol–₇–₃": "10⁻⁷ mol·dm⁻³",
    "větší než 10m–₉–₇": "větší než 10⁻⁷ mol·dm⁻³",

    # ─── Misc remaining ───
    "HPO a HPO₃₄₄": "H₃PO₄ a HPO₄²⁻",
    "HPO₄+": "HPO₄²⁻",
    "HCl₂–": "HCl₂⁻",
    "Které prvky tvoří snadno anionty?₁₂": "Které prvky tvoří snadno anionty?",
    "fluorem a kyslíkem₁₂": "fluorem a kyslíkem",
    "většina nekovů₁₂": "většina nekovů",
    "NO, HO₂₃++": "NO₂⁻, H₃O⁺",
    "FeCl₂₃₂+₂–": "FeCl₃²⁺, Cl₂⁻",
    "RNH+ OH= RNHOH₂₂→+–": "RNH₂ + OH⁻ → RNHOH⁺",
    "HCO₃₂–": "HCO₃²⁻",

    # ─── More compound formulas (pass 3) ───
    "HNO₄₂₃": "H₄N₂O₃",
    "HNO₃₂₂": "H₃N₂O₂",
    "HNO₄₂₂": "H₄N₂O₂",
    "PO₄₆": "P₄O₆",
    "PO₂₅": "P₂O₅",
    "NaClOa KClO₄₄": "NaClO₄ a KClO₄",
    "TiCla PbCl₄₄": "TiCl₄ a PbCl₄",
    "CdCla CuCl₂₂": "CdCl₂ a CuCl₂",
    "CaC₂₂": "CaC₂",
    "NaC₂₂": "Na₂C₂",
    "NaCO₂₃": "Na₂CO₃",
    "Cu(NO)₃₂": "Cu(NO₃)₂",
    "Cu(NO)₂₂": "Cu(NO₂)₂",
    "Ca(HSO)₃₂": "Ca(HSO₃)₂",
    "Ca(HSO)₄₂": "Ca(HSO₄)₂",
    "(NH)SO₄₂₄": "(NH₄)₂SO₄",
    "(NH)S₄₂": "(NH₄)₂S",
    "KCr(SO)·10HO₂₄₂₂": "K₂Cr(SO₄)₂·10H₂O",
    "KCr(SO)·12HO₄₂₂": "KCr(SO₄)₂·12H₂O",
    "KCr(SO)·10HO₄₂₂": "KCr(SO₄)₂·10H₂O",
    "KAl(SO)·12HO₄₂₂": "KAl(SO₄)₂·12H₂O",
    "KAl(SO)·7HO₂₄₂₂": "K₂Al(SO₄)₂·7H₂O",
    "KAl(SO)·10HO₄₂₂": "KAl(SO₄)₂·10H₂O",
    "Ca(HCO)₂₃₂": "Ca₂(HCO₃)₂",
    "Ca(HCO)₃₂": "Ca(HCO₃)₂",
    "Fe(CO)₂₃₃": "Fe₂(CO₃)₃",
    "Fe(CO)₃₂": "Fe(CO₃)₂",
    "Fe(HCO)₃₂": "Fe(HCO₃)₂",
    "HgCl₂₂": "Hg₂Cl₂",
    "ZnSO·5HO₄₂": "ZnSO₄·5H₂O",
    "MgSO·10HO₄₂": "MgSO₄·10H₂O",
    "FeSO·7HO₄₂": "FeSO₄·7H₂O",
    "ZnSO·7HO₄₂": "ZnSO₄·7H₂O",
    "K[Fe(CN)]₃₆": "K₃[Fe(CN)₆]",
    "K[FeCN]₃₆": "K₃[Fe(CN)₆]",
    "K[Fe(CN)]₄₆": "K₄[Fe(CN)₆]",
    "K[Fe(CN)]₂₆": "K₂[Fe(CN)₆]",
    "[Cu(NH)]je kationt:₃₄": "[Cu(NH₃)₄]²⁺ je kationt:",
    "[Ni(NH)]SOje síran:₃₆₄": "[Ni(NH₃)₆]SO₄ je síran:",
    "LiCO₂₃": "Li₂CO₃",
    "KCO₂₃": "K₂CO₃",
    "HSO₂₄": "H₂SO₄",
    "CO(NH)₂₂": "CO(NH₂)₂",
    "HBO₃₃": "H₃BO₃",
    "HSiO₂₃": "H₂SiO₃",
    "HSiO₄₄": "H₄SiO₄",
    "HSiO₄₂": "H₄SiO₂",
    "HSiO₄₃": "H₄SiO₃",
    "HBO₂₂": "H₂BO₂",
    "HSiO₃₃": "H₃SiO₃",
    "HSO₂₃": "H₂SO₃",
    "HPO₃₄": "H₃PO₄",
    "HPO₂₄": "H₂PO₄",
    "HPO₄₂₇": "H₄P₂O₇",
    "HIO₅₅": "H₅IO₅",
    "HIO₅₄": "H₅IO₄",
    "HIO₅₆": "H₅IO₆",
    "HSiOje vzorec kyseliny:₄₄": "H₄SiO₄ je vzorec kyseliny:",
    "HBOje vzorec kyseliny:₃₃": "H₃BO₃ je vzorec kyseliny:",
    "HCO₂₃": "H₂CO₃",
    "HF–₁₀": "HF",
    "HNO a HSO v poměru 1 : 3₃₂₄": "HNO₃ a H₂SO₄ v poměru 1 : 3",
    "HNO a HSO v poměru 3 : 1₃₂₄": "HNO₃ a H₂SO₄ v poměru 3 : 1",
    "NaSO₂₄": "Na₂SO₄",
    "NaSO₂₃": "Na₂SO₃",
    "CHCOONH₃₄": "CH₃COONH₄",
    "NaPO₃₄": "Na₃PO₄",
    "HSO₂₂₇": "H₂S₂O₇",
    "Ca(NO)₃₂": "Ca(NO₃)₂",
    "HPO₃₃": "H₃PO₃",
    "NHPO₄₂": "NH₄PO₂",
    "KPO₃₃": "K₃PO₃",
    "HPO₄₂₅": "H₄P₂O₅",
    "ClO₂₅": "Cl₂O₅",
    "NaIO₅₆": "Na₅IO₆",
    "Ca(IO)₃₂": "Ca(IO₃)₂",
    "IO₂₅": "I₂O₅",
    "ační číslo chromu ve sloučenině KCrO?₂₂₇":
        "ační číslo chromu ve sloučenině K₂Cr₂O₇?",
    "yskytuje železo ve sloučenině Fe(HSO)?₄₂":
        "yskytuje železo ve sloučenině Fe(HSO₄)₂?",
    "ační číslo kyslíku ve sloučenině  HO ?₂₂":
        "ační číslo kyslíku ve sloučenině H₂O₂?",
    "ků v neutrál- ní sloučenině se rovná:–₁₉":
        "ků v neutrální sloučenině se rovná:",
    " tvrzení. V reakci CuSO+ Fe  FeSO+ Cu:₄₄":
        " tvrzení. V reakci CuSO₄ + Fe → FeSO₄ + Cu:",
    "KClKCl₂₂": "KCl → K₂Cl₂",
    "ClKClK₂₂": "Cl₂ → KCl + K",
    "ClKClH (KOH)₂₂₂": "Cl₂ + KOH → KCl + KClO + H₂O",
    "(SO)+  b NaOH    x Fe(OH)+  y Na₂SO₄₃₃₂₄":
        "₂(SO₄)₃ + b NaOH → x Fe(OH)₃ + y Na₂SO₄",
    # ─── Reaction equations (pass 8) ───
    "→ Doplňte rovnici 2 Al(OH)+ 3 HSO :₃₂₄":
        "Doplňte rovnici 2 Al(OH)₃ + 3 H₂SO₄ →",
    "Al(HSO)+ 3 HO₄₃₂": "Al(HSO₄)₃ + 3 H₂O",
    "Al(SO)+ 6 HO₂₄₃₂": "Al₂(SO₄)₃ + 6 H₂O",
    "Al(HSO) + 2 HO₂₄₂": "Al₂(HSO₄) + 2 H₂O",
    "Al(SO)+ 3 HO₂₄₃₂": "Al₂(SO₄)₃ + 3 H₂O",
    " Ca(OH)+ b HPO   x Ca(PO)+ y HO :₂₃₄₃₄₂₂":
        " Ca(OH)₂ + b H₃PO₄ → x Ca₃(PO₄)₂ + y H₂O:",
    "ice? → a HSO+ b Al  x Al(SO)+ y H:₂₄₂₄₃₂":
        "ice? a H₂SO₄ + b Al → x Al₂(SO₄)₃ + y H₂:",
    # ─── Scientific notation (10^x) ───
    "6,02 · 10atomů Ag₂₂": "6,02 · 10²² atomů Ag",
    "1,2 · 10atomů Ag–₂₃": "1,2 · 10⁻²³ atomů Ag",
    "3,01 · 10atomů Ag₂₃": "3,01 · 10²³ atomů Ag",
    # ─── Nuclide notation ───
    "nuklidu dusíku N₁₂": "nuklidu dusíku ¹⁴₇N",
    "nuklidu vodíku H₁₆": "nuklidu vodíku ¹₁H",
    "hmotnostní konstanta je definována jako:₁₄":
        "hmotnostní konstanta je definována jako:",
    # ─── Avogadro / molar mass patterns ───
    "A(Ag) = 108r₂₃": "Aᵣ(Ag) = 108",
    "A(Cu) = 64r₂₄": "Aᵣ(Cu) = 64",
    "A(Fe) = 56r–₂₃": "Aᵣ(Fe) = 56",
    "A(Fe) = 56r₂₃": "Aᵣ(Fe) = 56",
    "6,02 · 10atomů Cu₂₃": "6,02 · 10²³ atomů Cu",
    "1,2 · 10atomů Cu₂₃": "1,2 · 10²³ atomů Cu",
    "0,6 · 10atomů Cu–₂₃": "0,6 · 10²³ atomů Cu",
    "0,356 mol Fe; 2,14 · 10atomů Fe₂₃": "0,356 mol Fe; 2,14 · 10²³ atomů Fe",
    "0,178 mol Fe; 1,07 · 10atomů Fe–₂₃": "0,178 mol Fe; 1,07 · 10²³ atomů Fe",
    "0,178 mol Fe; 1,07 · 10atomů Fe₂₃": "0,178 mol Fe; 1,07 · 10²³ atomů Fe",
    "1 mol Fe; 6,023 · 10atomů Fe₂₃": "1 mol Fe; 6,023 · 10²³ atomů Fe",
    "0,0178 mol Fe; 0,107 · 10atomů Fe–₂₂₂": "0,0178 mol Fe; 0,107 · 10²² atomů Fe",
    "Fe(SO)+  b NaOH    x Fe(OH)+  y NaSO₂₄ ₃ ₃₂₄":
        "Fe₂(SO₄)₃ + b NaOH → x Fe(OH)₃ + y Na₂SO₄",
    "a Cl+ b NaOH  x NaClO+ y NaCl + z HO₂₃ ₂":
        "a Cl₂ + b NaOH → x NaClO₃ + y NaCl + z H₂O",

    # ─── Nuclear notation ───
    "He₂₁": "⁴₂He",
    "H₁₁": "¹₁H",
    "p₁–": "p⁻",

    # ─── Nuclear reaction (line 869) ───
    "Reakci, při které ozařováním hliníku částicemi alfa vzniká radio- aktivní fosfor, popisuje rovnice:₂₇ ₄  ₃ ₀ → Al + He P + ?₁₃ ₂ ₁₅ Na místo otazníku je třeba zapsat částici:–":
        "Reakci, při které ozařováním hliníku částicemi alfa vzniká radioaktivní fosfor, popisuje rovnice: ²⁷₁₃Al + ⁴₂He → ³⁰₁₅P + ? Na místo otazníku je třeba zapsat částici:",

    # ─── Atomový útvar pattern ───
    "Atomový útvar tvořený šestnácti protony, osmnácti elektrony a šestnácti neutrony je:₂–":
        "Atomový útvar tvořený šestnácti protony, osmnácti elektrony a šestnácti neutrony je: S²⁻",

    # ─── Electron config in questions ───
    "Atomy chalkogenů mají ve valenčních orbitalech uspořádání elektronů:₂₃":
        "Atomy chalkogenů mají ve valenčních orbitalech uspořádání elektronů:",
    "Ve které periodě a skupině periodické soustavy chemických prvků₂₂₃ je umístěn prvek s elektronovou konfigurací 1s2s2p?":
        "Ve které periodě a skupině periodické soustavy chemických prvků je umístěn prvek s elektronovou konfigurací 1s²2s²2p³?",

    # ─── Brönsted patterns ───
    "Podle Brönstedovy teorie je zásadou:₂–":
        "Podle Brönstedovy teorie je zásadou:",

    # ─── kationt patterns (Na²⁻ etc. — wrong, but parser artifact) ───
    "kationt Na₂–": "kationt Na⁺",
    "kationt Be₂–": "kationt Be²⁺",

    # ─── Biology: space-separated formulas ───
    "CO a H O 2 2": "CO₂ a H₂O",
    "CO 2 a H O 2": "CO₂ a H₂O",
    "H O a CO 2 2": "H₂O a CO₂",
    "CO a H O₂ 2": "CO₂ a H₂O",
    "donorem elektronů H O 2": "donorem elektronů H₂O",
    "na vázání CO 2": "na vázání CO₂",
    "jako zdroj vodíku H O 2": "jako zdroj vodíku H₂O",
    "jako zdroj vodíku H S 2": "jako zdroj vodíku H₂S",
    "rostliny C mají nižší fotorespiraci než rostliny C 4 3":
        "rostliny C₄ mají nižší fotorespiraci než rostliny C₃",
    "rostliny C poskytují vyšší výnosy biomasy než rostliny C 4 3":
        "rostliny C₄ poskytují vyšší výnosy biomasy než rostliny C₃",
    "rostliny C využívají jako akceptoru CO molekuly fosfoenolpyruvátu 3 2":
        "rostliny C₃ využívají jako akceptoru CO₂ molekuly fosfoenolpyruvátu",
    "rostliny C využívají jako akceptoru CO molekuly ribulóza-1,5-bisfosfátu 3 2":
        "rostliny C₃ využívají jako akceptoru CO₂ molekuly ribulóza-1,5-bisfosfátu",
    "glukózy na H O a CO 2 2": "glukózy na H₂O a CO₂",

    # ─── Physics: variable subscripts ───
    "Označme E 1 kinetickou energii": "Označme E₁ kinetickou energii",
    "E a E ? 1 2": "E₁ a E₂?",
    "E = E 1 2": "E₁ = E₂",
    "E > E 1 2": "E₁ > E₂",
    "E < E 1 2": "E₁ < E₂",
}


# ══════════════════════════════════════════════════════════
# STEP 2: Formula dictionary for pattern-based fixes
# ══════════════════════════════════════════════════════════

# Correct formulas → broken variants that should map to them.
# Each entry: correct_unicode → list of (broken_pattern, is_regex)
# Applied AFTER exact replacements.

FORMULA_DICT = OrderedDict()

# Helper: generate simple space variants for a formula
def _space_variants(correct: str) -> list:
    """Given 'CO₂', return ['CO 2', 'CO2'] etc."""
    variants = []
    # Replace each subscript digit with space+digit
    plain = correct
    for sub_ch, digit in zip(SUB_DIGITS, "0123456789"):
        plain = plain.replace(sub_ch, digit)
    for sup_ch, ch in zip(SUP_DIGITS + "⁺⁻", "0123456789+-"):
        plain = plain.replace(sup_ch, ch)

    # Variant: digit with space before it (e.g. "CO 2")
    spaced = ""
    for i, ch in enumerate(plain):
        if ch.isdigit() and i > 0 and plain[i-1].isalpha():
            spaced += " " + ch
        else:
            spaced += ch
    if spaced != correct:
        variants.append(spaced)

    # Variant: digit without space (e.g. "CO2")
    no_space = plain
    if no_space != correct and no_space != spaced:
        variants.append(no_space)

    return variants

# ── Gases ──
SIMPLE_FORMULAS = {
    "O₂": ["O 2"],
    "N₂": ["N 2"],
    "H₂": ["H 2"],
    "CO₂": ["CO 2"],
    "SO₂": ["SO 2"],
    "SO₃": ["SO 3"],
    "NO₂": ["NO 2"],
    "NH₃": ["NH 3"],
    "Cl₂": ["Cl 2"],
    "F₂": ["F 2"],
    "Br₂": ["Br 2"],
    "I₂": ["I 2"],
    # Water & derivatives
    "H₂O": ["H 2 O", "H 2O"],
    "H₂O₂": ["H 2 O 2", "H 2O 2"],
    "H₂S": ["H 2 S", "H 2S"],
    # Acids
    "H₂SO₄": ["H 2 SO 4", "H 2SO 4", "H2SO4"],
    "HNO₃": ["HNO 3"],
    "H₃PO₄": ["H 3 PO 4", "H 3PO 4", "H3PO4"],
    "H₂CO₃": ["H 2 CO 3", "H 2CO 3"],
    # Bases
    "Ca(OH)₂": ["Ca(OH) 2"],
    "Ba(OH)₂": ["Ba(OH) 2"],
    "Mg(OH)₂": ["Mg(OH) 2"],
    "Al(OH)₃": ["Al(OH) 3"],
    "Fe(OH)₂": ["Fe(OH) 2"],
    "Fe(OH)₃": ["Fe(OH) 3"],
    # Salts
    "CaCl₂": ["CaCl 2"],
    "MgCl₂": ["MgCl 2"],
    "Na₂SO₄": ["Na 2 SO 4", "Na 2SO 4"],
    "K₂SO₄": ["K 2 SO 4"],
    "CaSO₄": ["CaSO 4"],
    "Na₂CO₃": ["Na 2 CO 3", "Na 2CO 3"],
    "NaHCO₃": ["NaHCO 3"],
    "KNO₃": ["KNO 3"],
    "NaNO₃": ["NaNO 3"],
    "CaCO₃": ["CaCO 3"],
    "Na₃PO₄": ["Na 3 PO 4"],
    "K₂Cr₂O₇": ["K 2 Cr 2 O 7"],
    "FeCl₃": ["FeCl 3"],
    "FeCl₂": ["FeCl 2"],
    "AlCl₃": ["AlCl 3"],
    "ZnCl₂": ["ZnCl 2"],
    "CuSO₄": ["CuSO 4"],
    "AgNO₃": ["AgNO 3"],
    "BaSO₄": ["BaSO 4"],
    # Oxides
    "Na₂O": ["Na 2 O", "Na 2O"],
    "K₂O": ["K 2 O", "K 2O"],
    "Al₂O₃": ["Al 2 O 3", "Al 2O 3"],
    "Fe₂O₃": ["Fe 2 O 3", "Fe 2O 3"],
    "Fe₃O₄": ["Fe 3 O 4", "Fe 3O 4"],
    "SiO₂": ["SiO 2"],
    "P₂O₅": ["P 2 O 5", "P 2O 5"],
    "Cr₂O₃": ["Cr 2 O 3"],
    "MnO₂": ["MnO 2"],
    "TiO₂": ["TiO 2"],
    "Cu₂O": ["Cu 2 O", "Cu 2O"],
    "N₂O₅": ["N 2 O 5", "N 2O 5"],
    "P₄O₁₀": ["P 4 O 10"],
    # Organics
    "CH₄": ["CH 4"],
    "C₂H₆": ["C 2 H 6", "C 2H 6"],
    "C₂H₄": ["C 2 H 4", "C 2H 4"],
    "C₂H₂": ["C 2 H 2", "C 2H 2"],
    "C₆H₆": ["C 6 H 6"],
    "CH₃OH": ["CH 3 OH", "CH 3OH"],
    "C₂H₅OH": ["C 2 H 5 OH", "C 2H 5OH"],
    "C₆H₁₂O₆": ["C 6 H 12 O 6"],
    "C₁₂H₂₂O₁₁": ["C 12 H 22 O 11"],
    # Ions
    "Na⁺": ["Na +"],
    "K⁺": ["K +"],
    "Ca²⁺": ["Ca 2+", "Ca2+"],
    "Mg²⁺": ["Mg 2+", "Mg2+"],
    "Fe²⁺": ["Fe 2+", "Fe2+"],
    "Fe³⁺": ["Fe 3+", "Fe3+"],
    "Cu²⁺": ["Cu 2+", "Cu2+"],
    "Zn²⁺": ["Zn 2+", "Zn2+"],
    "Al³⁺": ["Al 3+", "Al3+"],
    "SO₄²⁻": ["SO 4 2-", "SO4 2-"],
    "NO₃⁻": ["NO 3 -", "NO3-"],
    "CO₃²⁻": ["CO 3 2-", "CO3 2-"],
    "PO₄³⁻": ["PO 4 3-", "PO4 3-"],
    "HCO₃⁻": ["HCO 3 -", "HCO3-"],
    "NH₄⁺": ["NH 4 +", "NH4+"],
    "MnO₄⁻": ["MnO 4 -", "MnO4-"],
}


# ══════════════════════════════════════════════════════════
# STEP 3: Regex-based fixes
# ══════════════════════════════════════════════════════════

# Patterns for biology/chemistry: element followed by space and subscript number
# Only match when preceded by an uppercase letter (element symbol context)
# E.g. "CO 2" → "CO₂" but NOT "kapitola 2"

# Chemistry/biology: common element+number patterns at word boundaries
CHEM_ELEMENT_REGEX = [
    # "H 2 O" → H₂O (water - special case with O after number)
    (r'\bH 2 O\b', 'H₂O'),
    (r'\bH 2O\b', 'H₂O'),
    # "H 2 S" → H₂S
    (r'\bH 2 S\b', 'H₂S'),
    # "CO 2" → CO₂ (must not be followed by another element)
    (r'\bCO 2\b', 'CO₂'),
    # "SO 2" → SO₂ etc.
    (r'\bSO 2\b', 'SO₂'),
    (r'\bSO 3\b', 'SO₃'),
    (r'\bNO 2\b', 'NO₂'),
    (r'\bNH 3\b', 'NH₃'),
    (r'\bCl 2\b', 'Cl₂'),
    (r'\bO 2\b', 'O₂'),
    (r'\bN 2\b', 'N₂'),
    (r'\bH 2\b', 'H₂'),
    (r'\bCH 4\b', 'CH₄'),
]

# Physics: single-letter variables with subscript numbers
# E.g. "E 1", "R 1", "U 2", "T 1", "Q 1", "I 1"
# Only in physics.json context
PHYSICS_VAR_REGEX = [
    # Variable_space_digit where variable is a physics quantity letter
    # Match: uppercase letter (not followed by lowercase = not a word), space, single digit
    (r'\b([EIRUQTNPV]) (\d)\b', lambda m: m.group(1) + to_sub(m.group(2))),
]


# ══════════════════════════════════════════════════════════
# Processing functions
# ══════════════════════════════════════════════════════════

def apply_exact_replacements(text: str, log: list) -> str:
    """Apply exact string replacements (longest first)."""
    for broken, fixed in sorted(EXACT_REPLACEMENTS.items(), key=lambda x: -len(x[0])):
        if broken in text:
            text = text.replace(broken, fixed)
            log.append(("exact", broken, fixed))
    return text


def apply_formula_dict(text: str, log: list) -> str:
    """Apply formula dictionary replacements."""
    for correct, broken_list in SIMPLE_FORMULAS.items():
        for broken in sorted(broken_list, key=len, reverse=True):
            if broken in text:
                # Only replace if it looks like a formula context
                # (preceded by space/start, followed by space/end/punctuation)
                pattern = re.escape(broken)
                # Use word-boundary-like matching
                regex = r'(?<![a-zA-Z₀-₉])' + pattern + r'(?![a-zA-Z])'
                new_text = re.sub(regex, correct, text)
                if new_text != text:
                    log.append(("dict", broken, correct))
                    text = new_text
    return text


def apply_chem_regex(text: str, log: list) -> str:
    """Apply chemistry regex patterns."""
    for pattern, replacement in CHEM_ELEMENT_REGEX:
        new_text = re.sub(pattern, replacement, text)
        if new_text != text:
            log.append(("regex", pattern, replacement))
            text = new_text
    return text


def apply_physics_regex(text: str, log: list) -> str:
    """Apply physics-specific regex patterns."""
    for pattern, replacement in PHYSICS_VAR_REGEX:
        new_text = re.sub(pattern, replacement, text)
        if new_text != text:
            log.append(("phys_regex", pattern, str(replacement)))
            text = new_text
    return text


def fix_stray_subscript_spaces(text: str, log: list) -> str:
    """Fix spaces between Unicode subscript characters: '₄ ₂' → '₄₂'."""
    pattern = r'([₀₁₂₃₄₅₆₇₈₉])\s+([₀₁₂₃₄₅₆₇₈₉])'
    new_text = re.sub(pattern, r'\1\2', text)
    if new_text != text:
        log.append(("space_fix", "subscript space", "removed"))
        text = new_text
    return text


def fix_missing_spaces(text: str, log: list) -> str:
    """Fix missing spaces between formula and Czech text.
    E.g. 'Cl₂vzniká' → 'Cl₂ vzniká'
    """
    # Unicode subscript/superscript followed directly by Czech lowercase letter
    pattern = r'([₀-₉⁰-⁹⁺⁻])([a-záčďéěíňóřšťúůýž])'
    new_text = re.sub(pattern, r'\1 \2', text)
    if new_text != text:
        log.append(("space_add", "formula+text", "added space"))
        text = new_text
    return text


def find_suspicious_patterns(text: str) -> list:
    """Find patterns that look like broken formulas but weren't fixed."""
    warnings = []
    # Unicode subscripts at end of text (possible displaced subscripts)
    m = re.search(r'[₀₁₂₃₄₅₆₇₈₉]{2,}$', text.rstrip('.:,;!? '))
    if m:
        warnings.append(f"Trailing subscripts: ...{text[-40:]}")
    # Letter followed by space then digit in chem-like context
    if re.search(r'[A-Z][a-z]?\s+\d+(?:\s|$)', text):
        # Check if it's not a normal number context
        for match in re.finditer(r'([A-Z][a-z]?)\s+(\d+)', text):
            elem = match.group(1)
            if elem in {'A', 'I', 'V', 'Na', 'K', 'Ca', 'Fe', 'Cu', 'Zn',
                        'Al', 'Mg', 'Ba', 'Cl', 'Br', 'Si', 'Cr', 'Mn',
                        'Ti', 'Pb', 'Ag', 'Li', 'Be', 'B', 'C', 'N',
                        'O', 'F', 'P', 'S', 'H', 'He', 'Ne', 'Ar',
                        'Se', 'Te', 'As', 'Ge', 'Sn', 'Sb', 'Bi', 'Po'}:
                warnings.append(f"Possible broken formula: '{match.group()}'")
    return warnings


# ══════════════════════════════════════════════════════════
# File processing
# ══════════════════════════════════════════════════════════

def process_text(text: str, is_physics: bool = False) -> tuple:
    """Process a single text string. Returns (fixed_text, log_entries, warnings)."""
    log = []
    original = text

    # Phase 1: Exact replacements (highest priority)
    text = apply_exact_replacements(text, log)

    # Phase 2: Fix stray spaces between subscripts
    text = fix_stray_subscript_spaces(text, log)

    # Phase 3: Formula dictionary
    text = apply_formula_dict(text, log)

    # Phase 4: Chemistry regex
    text = apply_chem_regex(text, log)

    # Phase 5: Physics regex (only for physics data)
    if is_physics:
        text = apply_physics_regex(text, log)

    # Phase 6: Fix missing spaces between formula and text
    text = fix_missing_spaces(text, log)

    # Validation: find suspicious remaining patterns
    warnings = find_suspicious_patterns(text)

    return text, log, warnings


def walk_questions(data: dict, is_physics: bool = False):
    """Walk through all questions and options in a subject data structure."""
    total_fixes = 0
    all_log = []
    all_warnings = []

    chapters = data.get("chapters", [])
    for chapter in chapters:
        for q_list_key in ["questions"]:
            for question in chapter.get(q_list_key, []):
                # Fix question text
                text, log, warnings = process_text(question["text"], is_physics)
                if log:
                    all_log.extend([(question["id"], "Q", entry) for entry in log])
                    total_fixes += 1
                    question["text"] = text
                all_warnings.extend([(question["id"], "Q", w) for w in warnings])

                # Fix option texts
                for opt in question.get("options", []):
                    text, log, warnings = process_text(opt["text"], is_physics)
                    if log:
                        all_log.extend([(question["id"], f"opt:{opt['letter']}", entry) for entry in log])
                        total_fixes += 1
                        opt["text"] = text
                    all_warnings.extend([(question["id"], f"opt:{opt['letter']}", w) for w in warnings])

        # Also handle subchapters (chemistry has them)
        for sub in chapter.get("subchapters", []):
            for question in sub.get("questions", []):
                text, log, warnings = process_text(question["text"], is_physics)
                if log:
                    all_log.extend([(question["id"], "Q", entry) for entry in log])
                    total_fixes += 1
                    question["text"] = text
                all_warnings.extend([(question["id"], "Q", w) for w in warnings])

                for opt in question.get("options", []):
                    text, log, warnings = process_text(opt["text"], is_physics)
                    if log:
                        all_log.extend([(question["id"], f"opt:{opt['letter']}", entry) for entry in log])
                        total_fixes += 1
                        opt["text"] = text
                    all_warnings.extend([(question["id"], f"opt:{opt['letter']}", w) for w in warnings])

    return data, total_fixes, all_log, all_warnings


# ══════════════════════════════════════════════════════════
# Main
# ══════════════════════════════════════════════════════════

def main():
    files = [
        ("biology.json", False),
        ("chemistry.json", False),
        ("physics.json", True),
    ]

    grand_total = 0
    grand_log = []
    grand_warnings = []

    for filename, is_physics in files:
        filepath = DATA_DIR / filename
        if not filepath.exists():
            print(f"  ⚠ File not found: {filepath}")
            continue

        print(f"\n{'='*60}")
        print(f"  Processing: {filename}")
        print(f"{'='*60}")

        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        data, total_fixes, log, warnings = walk_questions(data, is_physics)

        # Save
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        print(f"  OK: {total_fixes} text fields fixed")
        grand_total += total_fixes
        grand_log.extend([(filename, *entry) for entry in log])
        grand_warnings.extend([(filename, *entry) for entry in warnings])

    # ── Report ──
    print(f"\n{'='*60}")
    print(f"  SUMMARY: {grand_total} text fields fixed across all files")
    print(f"{'='*60}")

    # Show first 30 concrete fixes
    print(f"\n── First 30 fixes (before → after) ──")
    shown = set()
    count = 0
    for entry in grand_log:
        filename, qid, field, (fix_type, before, after) = entry
        key = (before, after)
        if key not in shown:
            shown.add(key)
            count += 1
            if count > 30:
                break
            # Truncate long strings
            b = before[:60] + "..." if len(before) > 60 else before
            a = after[:60] + "..." if len(after) > 60 else after
            print(f"  [{filename}] Q{qid} ({fix_type})")
            print(f"    BEFORE: {b}")
            print(f"    AFTER:  {a}")

    # Show warnings
    if grand_warnings:
        print(f"\n── Warnings ({len(grand_warnings)} suspicious patterns) ──")
        shown_warnings = set()
        for entry in grand_warnings[:20]:
            filename, qid, field, warning = entry
            if warning not in shown_warnings:
                shown_warnings.add(warning)
                print(f"  [{filename}] Q{qid}: {warning}")

    print(f"\nDone.")


if __name__ == "__main__":
    main()
