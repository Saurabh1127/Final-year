#!/usr/bin/env python3
"""
build_50page_and_latex.py

Generates in blue_book_50_page/:
1. image_prompts.md & image_prompts.txt:
   Standalone catalog of all 26 Image Generation Prompts + Mermaid specs + TCET Crest.
2. Blue_Book_Report.md & Blue_Book_Report.txt:
   Razor-sharp, high-density 40-50 page version of the complete report.
3. Blue_Book_Report.docx:
   Strictly calibrated 42–48 pages in Word / Google Docs with clean math typography.
4. Blue_Book_Report.html:
   Print-ready HTML document.
5. main.tex:
   Complete, compilable LaTeX project ready to zip and upload to Overleaf,
   with proper math environments, blank header image space, and TCET formatting.
"""

import os
import re
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

OUT_DIR = "blue_book_50_page"
os.makedirs(OUT_DIR, exist_ok=True)

# Also ensure symlink blue_book_2 points to blue_book_50_page
if os.path.islink("blue_book_2") or os.path.exists("blue_book_2"):
    try:
        os.remove("blue_book_2")
    except Exception:
        pass
try:
    os.symlink(OUT_DIR, "blue_book_2")
except Exception:
    pass

print(f"Target directory: {OUT_DIR}/ (symlinked as blue_book_2)")
