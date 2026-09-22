#!/usr/bin/env python3
"""
generate_blue_book_75pages.py

Generates:
1. blue_book/image_prompts.md & blue_book/image_prompts.txt:
   Standalone catalog of all 26 Image Generation Prompts + Mermaid Diagram Specifications
   + Institutional Emblems.
2. blue_book/Blue_Book_Report.md & blue_book/Blue_Book_Report.txt:
   Clean report text where diagrams are replaced by clean figure placeholders referencing
   the prompt numbers.
3. blue_book/Blue_Book_Report.docx:
   Publication-grade Microsoft Word document strictly calibrated to 70–80 pages
   adhering to TCET 2026-27 Computer Engineering guidelines.
4. blue_book/Blue_Book_Report.html:
   Print-ready HTML document.
"""

import os
import re
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def clean_text_for_word(text):
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
    text = re.sub(r'\*(.*?)\*', r'\1', text)
    text = re.sub(r'`(.*?)`', r'\1', text)
    # Remove XML-incompatible control characters
    text = ''.join(c for c in text if ord(c) >= 32 or c in '\n\r\t')
    return text

def set_cell_border(cell, **kwargs):
    tcPr = cell._tc.get_or_add_tcPr()
    tcBorders = tcPr.first_child_found_in("w:tcBorders")
    if tcBorders is None:
        tcBorders = OxmlElement('w:tcBorders')
        tcPr.append(tcBorders)
    for edge in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        edge_data = kwargs.get(edge)
        if edge_data:
            tag = 'w:{}'.format(edge)
            element = tcBorders.find(qn(tag))
            if element is None:
                element = OxmlElement(tag)
                tcBorders.append(element)
            for key in ["sz", "val", "color", "space", "shadow"]:
                if key in edge_data:
                    element.set(qn('w:{}'.format(key)), str(edge_data[key]))

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def main():
    os.makedirs('blue_book', exist_ok=True)

    with open('Blue_Book_Report.md', 'r', encoding='utf-8') as f:
        full_text = f.read()

    # Step 1: Extract All Figures and Prompts
    lines = full_text.splitlines()
    figures = []
    current_fig = None
    state = None

    for i, line in enumerate(lines):
        if "DIAGRAM PLACEHOLDER: Figure" in line:
            m = re.search(r"Figure\s+[0-9.]+", line)
            fig_num = m.group(0) if m else "Figure"
            raw_title = lines[i+1].strip() if i+1 < len(lines) else ""
            title = re.sub(r"^Figure\s+[0-9.]+:\s*", "", raw_title)
            current_fig = {"num": fig_num, "title": title, "prompt": "", "mermaid": ""}
            figures.append(current_fig)
        elif "> **IMAGE GENERATION PROMPT" in line:
            state = "prompt"
        elif "> **MERMAID DIAGRAM SPECIFICATION" in line:
            state = "mermaid"
        elif state == "prompt" and line.startswith(">"):
            clean = line.lstrip("> *").rstrip("*").strip()
            if clean and current_fig:
                if current_fig["prompt"]:
                    current_fig["prompt"] += " " + clean
                else:
                    current_fig["prompt"] = clean
        elif state == "mermaid" and line.startswith(">"):
            if current_fig:
                current_fig["mermaid"] += line.lstrip("> ") + "\n"
        elif line.startswith("---") or line.startswith("<h"):
            state = None

    print(f"Extracted {len(figures)} figure prompts.")

    # Step 2: Build blue_book/image_prompts.md
    p_out = [
        "# SAMVADA: Complete Image Generation Prompts & Diagram Specifications",
        "",
        "This standalone reference catalog contains all text-to-image prompts (for DALL-E 3, Midjourney v6, Flux/Stable Diffusion) and exact Mermaid diagram specifications for all figures in the Final Year Blue Book Project Report.",
        "",
        "---",
        "",
        "## Institutional Emblems",
        "",
        "### Institutional Emblem Prompt",
        "- **Target Document Locations**: Title Page, Certificate Page, Project Approval Certificate Page",
        "- **Recommended Tool**: DALL-E 3 / Midjourney v6 / Institutional Vector Asset",
        "- **Image Generation Prompt**:",
        "> *Official Emblem and Seal of Thakur College of Engineering and Technology (TCET), Mumbai, depicting the academic crest, heraldic eagle/insignia, and college motto, high-resolution vector format, transparent or pure white background.*",
        "",
        "---",
        "",
        "## Master Table of Figures & Prompt Mapping",
        "",
        "| Prompt # | Figure ID | Figure Caption / Description | Recommended Generation Tool |",
        "|---|---|---|---|"
    ]

    for idx, fig in enumerate(figures):
        p_num = f"Prompt #{idx+1}"
        f_num = fig["num"]
        f_title = fig["title"]
        tool = "Mermaid Live / Draw.io + AI Image" if fig["mermaid"].strip() else "Text-to-Image (DALL-E 3 / Flux)"
        p_out.append(f"| **{p_num}** | **{f_num}** | {f_title} | {tool} |")

    p_out.extend(["", "---", ""])

    for idx, fig in enumerate(figures):
        p_num = f"Prompt #{idx+1}"
        f_num = fig["num"]
        f_title = fig["title"]
        clean_p = fig["prompt"].strip().strip("\"*")

        p_out.append(f"## {p_num}: {f_num} — {f_title}")
        p_out.append("")
        p_out.append(f"- **Figure Identifier**: `{f_num}`")
        p_out.append(f"- **Official Caption**: *{f_title}*")
        p_out.append("")
        p_out.append("### 1. Text-to-Image Prompt (For AI Image Generators)")
        p_out.append("Copy and paste this prompt into DALL-E 3, Midjourney v6, or Flux:")
        p_out.append("")
        p_out.append(f"> \"{clean_p}\"")
        p_out.append("")

        if fig["mermaid"].strip():
            p_out.append("### 2. Mermaid Diagram Specification (For Mermaid Live / Draw.io)")
            p_out.append("Copy and paste this into [Mermaid Live](https://mermaid.live) or draw.io to export high-res vector graphics:")
            p_out.append("")
            p_out.append("```mermaid")
            m_code = fig["mermaid"].strip()
            m_code = re.sub(r"^```mermaid\s*", "", m_code)
            m_code = re.sub(r"```$", "", m_code).strip()
            p_out.append(m_code)
            p_out.append("```")
            p_out.append("")

        p_out.extend(["---", ""])

    prompts_text = "\n".join(p_out)
    with open("blue_book/image_prompts.md", "w", encoding="utf-8") as f:
        f.write(prompts_text)
    with open("blue_book/image_prompts.txt", "w", encoding="utf-8") as f:
        f.write(prompts_text)
    print("Saved blue_book/image_prompts.md and image_prompts.txt")

    # Step 3: Transform Report Content to reference image prompts
    # Build a lookup for fig_num -> prompt_idx
    fig_to_prompt = {fig["num"]: idx + 1 for idx, fig in enumerate(figures)}

    # Replace the multi-line figure blocks
    # A figure block in Blue_Book_Report.md starts with ```\n[DIAGRAM PLACEHOLDER: Figure X.X]\nFigure X.X: ...\n``` and ends before the next --- or <h
    def replace_figure_block(match):
        block = match.group(0)
        m_fig = re.search(r'Figure\s+[0-9.]+', block)
        if not m_fig:
            return block
        fig_num = m_fig.group(0)
        prompt_idx = fig_to_prompt.get(fig_num, 1)

        m_caption = re.search(r'Figure\s+[0-9.]+:[^\n]+', block)
        caption = m_caption.group(0) if m_caption else f"{fig_num}: Architectural Diagram"

        clean_caption = re.sub(r'^Figure\s+[0-9.]+:\s*', '', caption)

        box = (
            f"\n\n```\n"
            f"[FIGURE INSERTION PLACEHOLDER: {fig_num}]\n"
            f"{fig_num}: {clean_caption}\n"
            f"[Refer to Image Generation Prompt #{prompt_idx} in image_prompts.md to generate and paste image here]\n"
            f"```\n\n"
        )
        return box

    # Pattern for figure blocks
    fig_block_re = re.compile(
        r'```\s*\n\[DIAGRAM PLACEHOLDER:\s*Figure\s+[0-9.]+\]\s*\nFigure\s+[0-9.]+:[^\n]+\s*\n```.*?(?=\n---|\n<h|\n## |\Z)',
        re.DOTALL
    )

    transformed_md = fig_block_re.sub(replace_figure_block, full_text)

    # Replace Institutional logo prompts on title page / certificates
    transformed_md = re.sub(
        r'\[IMAGE PROMPT: Official Emblem and Seal of Thakur College of Engineering and Technology.*?\]',
        '[TCET Institutional Logo / Crest Placeholder — Refer to Institutional Emblem Prompt in image_prompts.md]',
        transformed_md
    )

    # Save transformed markdown and txt
    with open("blue_book/Blue_Book_Report.md", "w", encoding="utf-8") as f:
        f.write(transformed_md)

    # Create plain text version
    clean_txt = transformed_md
    clean_txt = re.sub(r'<div style=\"page-break-before:\s*always;\"></div>', '\n\n' + '='*80 + '\n\n', clean_txt)

    def table_repl(match):
        table_html = match.group(0)
        rows = re.findall(r'<tr>(.*?)</tr>', table_html, re.DOTALL)
        out = []
        for r in rows:
            tds = re.findall(r'<td[^>]*>(.*?)</td>', r, re.DOTALL)
            clean_tds = [re.sub(r'<[^>]+>', ' ', td).strip() for td in tds]
            if len(clean_tds) == 2:
                out.append(f"{clean_tds[0]:<45} {clean_tds[1]}")
            else:
                out.append("   ".join(clean_tds))
        return '\n' + '\n'.join(out) + '\n'

    clean_txt = re.sub(r'<table.*?>.*?</table>', table_repl, clean_txt, flags=re.DOTALL)

    def h1_repl(m):
        txt = re.sub(r'<[^>]+>', '', m.group(1)).strip()
        return f"\n\n{'='*80}\n{txt.upper()}\n{'='*80}\n"
    def h2_repl(m):
        txt = re.sub(r'<[^>]+>', '', m.group(1)).strip()
        return f"\n\n{'-'*80}\n{txt}\n{'-'*80}\n"
    def h3_repl(m):
        txt = re.sub(r'<[^>]+>', '', m.group(1)).strip()
        return f"\n\n### {txt}\n"

    clean_txt = re.sub(r'<h1[^>]*>(.*?)</h1>', h1_repl, clean_txt, flags=re.DOTALL)
    clean_txt = re.sub(r'<h2[^>]*>(.*?)</h2>', h2_repl, clean_txt, flags=re.DOTALL)
    clean_txt = re.sub(r'<h3[^>]*>(.*?)</h3>', h3_repl, clean_txt, flags=re.DOTALL)
    clean_txt = re.sub(r'<br\s*/?>', '\n', clean_txt)
    clean_txt = re.sub(r'</?(?:p|div|span|b|i|strong|em)(?:\s+[^>]*)?>', '', clean_txt)
    clean_txt = re.sub(r'\n{4,}', '\n\n\n', clean_txt)

    with open("blue_book/Blue_Book_Report.txt", "w", encoding="utf-8") as f:
        f.write(clean_txt)
    print("Saved blue_book/Blue_Book_Report.md and Blue_Book_Report.txt")

    # Step 4: Build DOCX File Calibrated to 70–80 Pages
    print("Building blue_book/Blue_Book_Report.docx...")
    doc = docx.Document()

    # Configure Margins for A4 Page (Left 1.25" for binding, Top/Bottom/Right 1.0")
    for s in doc.sections:
        s.page_width = Inches(8.27)
        s.page_height = Inches(11.69)
        s.top_margin = Inches(1.0)
        s.bottom_margin = Inches(1.0)
        s.left_margin = Inches(1.25)
        s.right_margin = Inches(1.0)
        s.different_first_page_header_footer = True

    # Configure Normal Style: Times New Roman 12pt, 1.5 line spacing, 4pt space after
    style_normal = doc.styles['Normal']
    style_normal.font.name = 'Times New Roman'
    style_normal.font.size = Pt(12)
    style_normal.paragraph_format.line_spacing = 1.5
    style_normal.paragraph_format.space_after = Pt(4)
    style_normal.paragraph_format.space_before = Pt(0)

    # Process transformed_md into Word Document
    md_lines = transformed_md.splitlines()
    i = 0
    in_code_block = False
    code_lines = []

    while i < len(md_lines):
        line = md_lines[i]

        # Explicit page break
        if 'page-break-before: always' in line:
            doc.add_page_break()
            i += 1
            continue

        # Code block handler
        if line.strip().startswith('```'):
            if not in_code_block:
                in_code_block = True
                code_lines = []
            else:
                in_code_block = False
                code_str = '\n'.join(code_lines).strip()
                if "FIGURE INSERTION PLACEHOLDER" in code_str:
                    # Render as styled Figure Frame Box
                    tbl = doc.add_table(rows=1, cols=1)
                    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
                    cell = tbl.cell(0, 0)
                    cell.width = Inches(5.8)
                    set_cell_background(cell, "F8FAFC")
                    set_cell_border(cell,
                        top=dict(sz=6, val='dashed', color='94A3B8'),
                        bottom=dict(sz=6, val='dashed', color='94A3B8'),
                        left=dict(sz=6, val='dashed', color='94A3B8'),
                        right=dict(sz=6, val='dashed', color='94A3B8')
                    )
                    cp = cell.paragraphs[0]
                    cp.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    cp.paragraph_format.space_before = Pt(8)
                    cp.paragraph_format.space_after = Pt(8)
                    cp.paragraph_format.line_spacing = 1.25

                    r1 = cp.add_run(clean_text_for_word(code_str))
                    r1.font.name = 'Times New Roman'
                    r1.font.size = Pt(10.5)
                    r1.font.color.rgb = RGBColor(71, 85, 105)

                    # Add empty spacing after table
                    sp_p = doc.add_paragraph()
                    sp_p.paragraph_format.space_after = Pt(4)
                    sp_p.paragraph_format.space_before = Pt(0)
                    sp_p.paragraph_format.line_spacing = 1.0
                else:
                    # Regular code block (Algorithm pseudocode)
                    p = doc.add_paragraph()
                    p.paragraph_format.space_before = Pt(4)
                    p.paragraph_format.space_after = Pt(6)
                    p.paragraph_format.line_spacing = 1.15
                    run = p.add_run(clean_text_for_word(code_str))
                    run.font.name = 'Courier New'
                    run.font.size = Pt(9.5)
                    run.font.color.rgb = RGBColor(30, 41, 59)
            i += 1
            continue

        if in_code_block:
            code_lines.append(line)
            i += 1
            continue

        # HTML Headings
        h1_match = re.search(r'<h1[^>]*>(.*?)</h1>', line, re.IGNORECASE)
        if h1_match:
            doc.add_page_break()
            heading_text = clean_text_for_word(re.sub(r'<[^>]+>', '', h1_match.group(1)).strip())
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_before = Pt(18)
            p.paragraph_format.space_after = Pt(14)
            run = p.add_run(heading_text.upper())
            run.font.name = 'Times New Roman'
            run.font.size = Pt(18)
            run.bold = True
            i += 1
            continue

        h2_match = re.search(r'<h2[^>]*>(.*?)</h2>', line, re.IGNORECASE)
        if h2_match:
            heading_text = clean_text_for_word(re.sub(r'<[^>]+>', '', h2_match.group(1)).strip())
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(14)
            p.paragraph_format.space_after = Pt(4)
            run = p.add_run(heading_text)
            run.font.name = 'Times New Roman'
            run.font.size = Pt(16)
            run.bold = True
            i += 1
            continue

        h3_match = re.search(r'<h3[^>]*>(.*?)</h3>', line, re.IGNORECASE)
        if h3_match:
            heading_text = clean_text_for_word(re.sub(r'<[^>]+>', '', h3_match.group(1)).strip())
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(10)
            p.paragraph_format.space_after = Pt(2)
            run = p.add_run(heading_text)
            run.font.name = 'Times New Roman'
            run.font.size = Pt(14)
            run.bold = True
            i += 1
            continue

        if line.startswith('#### '):
            heading_text = clean_text_for_word(line[5:].strip())
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(6)
            p.paragraph_format.space_after = Pt(2)
            run = p.add_run(heading_text)
            run.font.name = 'Times New Roman'
            run.font.size = Pt(12)
            run.bold = True
            i += 1
            continue

        # Markdown Table Handling
        if line.strip().startswith('|') and '|' in line[1:]:
            table_rows = []
            while i < len(md_lines) and md_lines[i].strip().startswith('|'):
                row_str = md_lines[i].strip()
                if not re.match(r'^\|[-: |]+\|$', row_str):
                    cols = [c.strip() for c in row_str.split('|')[1:-1]]
                    table_rows.append(cols)
                i += 1

            if table_rows:
                num_cols = max(len(r) for r in table_rows)
                tbl = doc.add_table(rows=len(table_rows), cols=num_cols)
                tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
                for r_idx, row in enumerate(table_rows):
                    for c_idx, cell_value in enumerate(row):
                        if c_idx < num_cols:
                            cell = tbl.cell(r_idx, c_idx)
                            clean_val = clean_text_for_word(cell_value)
                            cell.text = clean_val
                            cp = cell.paragraphs[0]
                            cp.paragraph_format.line_spacing = 1.15
                            cp.paragraph_format.space_after = Pt(2)
                            cp.paragraph_format.space_before = Pt(2)
                            if r_idx == 0:
                                set_cell_background(cell, "F1F5F9")
                                for r in cp.runs:
                                    r.bold = True
                                    r.font.name = 'Times New Roman'
                                    r.font.size = Pt(10)
                            else:
                                for r in cp.runs:
                                    r.font.name = 'Times New Roman'
                                    r.font.size = Pt(9.5)
                            set_cell_border(cell,
                                top=dict(sz=4, val='single', color='475569'),
                                bottom=dict(sz=4, val='single', color='475569'),
                                left=dict(sz=4, val='single', color='475569'),
                                right=dict(sz=4, val='single', color='475569'))
            continue

        # HTML Signature Table on Certificate
        if line.strip().startswith('<table'):
            table_html = []
            while i < len(md_lines) and '</table>' not in md_lines[i]:
                table_html.append(md_lines[i])
                i += 1
            if i < len(md_lines):
                table_html.append(md_lines[i])
                i += 1
            full_tbl = '\n'.join(table_html)
            rows = re.findall(r'<tr>(.*?)</tr>', full_tbl, re.DOTALL)
            doc_tbl = doc.add_table(rows=len(rows), cols=2)
            doc_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
            for r_idx, r in enumerate(rows):
                tds = re.findall(r'<td[^>]*>(.*?)</td>', r, re.DOTALL)
                for c_idx, td in enumerate(tds[:2]):
                    cell = doc_tbl.cell(r_idx, c_idx)
                    cell.text = re.sub(r'<[^>]+>', '', td).strip()
                    cp = cell.paragraphs[0]
                    cp.paragraph_format.line_spacing = 1.2
                    for r_run in cp.runs:
                        r_run.font.name = 'Times New Roman'
                        r_run.font.size = Pt(11)
            continue

        # Regular prose paragraph
        clean_l = clean_text_for_word(re.sub(r'<[^>]+>', '', line)).strip()
        if clean_l and not clean_l.startswith('---'):
            p = doc.add_paragraph()
            p.paragraph_format.line_spacing = 1.5
            p.paragraph_format.space_after = Pt(4)
            p.paragraph_format.space_before = Pt(0)

            # Check for centered title items
            if ('text-align: center' in line or
                clean_l.startswith('[TCET Institutional') or
                clean_l.startswith('Project Report') or
                clean_l.startswith('SAMVADA:') or
                clean_l == 'on' or
                clean_l == 'CERTIFICATE' or
                clean_l == 'PROJECT APPROVAL CERTIFICATE' or
                clean_l == 'ACKNOWLEDGEMENT' or
                clean_l.startswith('Blue Book Plagiarism')):
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            else:
                p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY

            run = p.add_run(clean_l)
            run.font.name = 'Times New Roman'
            run.font.size = Pt(12)

            if clean_l.startswith('SAMVADA:'):
                run.bold = True
                run.font.size = Pt(18)
            elif clean_l in ['CERTIFICATE', 'PROJECT APPROVAL CERTIFICATE', 'ACKNOWLEDGEMENT', 'INDEX', 'LIST OF FIGURES', 'LIST OF TABLES', 'ABSTRACT']:
                run.bold = True
                run.font.size = Pt(16)
            elif clean_l.startswith('Figure ') or clean_l.startswith('Table '):
                run.bold = True
                run.font.size = Pt(11)

        i += 1

    docx_path = "blue_book/Blue_Book_Report.docx"
    doc.save(docx_path)
    print(f"Saved {docx_path}!")

    # Step 5: Build HTML File
    print("Building blue_book/Blue_Book_Report.html...")
    css = """
    @page {
        size: A4;
        margin: 25mm 20mm 20mm 25mm;
        @bottom-right {
            content: counter(page);
        }
    }
    body {
        font-family: 'Times New Roman', Times, serif;
        font-size: 12pt;
        line-height: 1.5;
        color: #111111;
        background-color: #ffffff;
        margin: 40px auto;
        max-width: 850px;
        padding: 20px;
    }
    h1 {
        font-size: 18pt;
        font-weight: bold;
        text-align: center;
        margin-top: 30px;
        margin-bottom: 20px;
        text-transform: uppercase;
        page-break-before: always;
    }
    h2 {
        font-size: 16pt;
        font-weight: bold;
        margin-top: 24px;
        margin-bottom: 12px;
        color: #000;
        border-bottom: 1px solid #ccc;
        padding-bottom: 4px;
    }
    h3 {
        font-size: 14pt;
        font-weight: bold;
        margin-top: 18px;
        margin-bottom: 8px;
    }
    h4 {
        font-size: 12pt;
        font-weight: bold;
        margin-top: 14px;
        margin-bottom: 6px;
    }
    p {
        text-align: justify;
        margin-bottom: 10px;
    }
    table {
        width: 100%;
        border-collapse: collapse;
        margin: 16px 0;
        font-size: 10pt;
    }
    table, th, td {
        border: 1px solid #475569;
    }
    th {
        background-color: #f1f5f9;
        font-weight: bold;
        padding: 7px;
        text-align: left;
    }
    td {
        padding: 6px 8px;
        vertical-align: top;
    }
    pre, code {
        font-family: 'Courier New', Courier, monospace;
        background-color: #f8fafc;
        font-size: 9.5pt;
    }
    pre {
        padding: 10px;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        overflow-x: auto;
        white-space: pre-wrap;
        line-height: 1.25;
    }
    .figure-frame {
        background-color: #f8fafc;
        border: 2px dashed #94a3b8;
        border-radius: 6px;
        padding: 14px 20px;
        margin: 18px 0;
        text-align: center;
        color: #334155;
    }
    .figure-frame .title {
        font-size: 11pt;
        font-weight: bold;
        margin-bottom: 4px;
        color: #0f172a;
    }
    .figure-frame .ref {
        font-size: 9.5pt;
        color: #64748b;
        font-style: italic;
    }
    """

    html_content = transformed_md

    def md_table_to_html(match):
        table_text = match.group(0).strip()
        lines = [l.strip() for l in table_text.splitlines() if l.strip()]
        if len(lines) < 2:
            return table_text
        header = lines[0].split('|')[1:-1]
        rows = lines[2:]
        out = ['<table>', '  <thead><tr>']
        for h in header:
            out.append(f'    <th>{h.strip()}</th>')
        out.append('  </tr></thead>\n  <tbody>')
        for r in rows:
            cols = r.split('|')[1:-1]
            out.append('  <tr>')
            for c in cols:
                out.append(f'    <td>{c.strip()}</td>')
            out.append('  </tr>')
        out.append('  </tbody>\n</table>')
        return '\n'.join(out)

    table_pattern = re.compile(r'(?:\|[^\n]+\|\n)(?:\|[-: |]+\|\n)(?:\|[^\n]+\|\n?)+')
    html_content = table_pattern.sub(md_table_to_html, html_content)

    def fig_box_html(m):
        code_lines = m.group(1).strip().splitlines()
        f_num = code_lines[0].replace("[FIGURE INSERTION PLACEHOLDER: ", "").replace("]", "").strip()
        f_title = code_lines[1].strip() if len(code_lines) > 1 else ""
        f_ref = code_lines[2].strip("[]") if len(code_lines) > 2 else ""
        return f'<div class="figure-frame"><div class="title">{f_title}</div><div class="ref">{f_ref}</div></div>'

    html_content = re.sub(
        r'```\n(\[FIGURE INSERTION PLACEHOLDER:[^\n]+\]\nFigure [0-9.]+:[^\n]+\n\[Refer to Image Generation Prompt[^\n]+\])\n```',
        fig_box_html,
        html_content
    )

    full_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>SAMVADA Blue Book Report</title>
<style>
{css}
</style>
</head>
<body>
{html_content}
</body>
</html>
"""
    with open("blue_book/Blue_Book_Report.html", "w", encoding="utf-8") as f:
        f.write(full_html)
    print("Saved blue_book/Blue_Book_Report.html!")

if __name__ == "__main__":
    main()

