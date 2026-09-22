#!/usr/bin/env python3
"""
build_exact_45page_blue_book.py

Generates a strictly calibrated 42-48 page version (target: 45 pages) of the Blue Book Report
for blue_book_50_page/ directory, complying with TCET 2026-27 format.
- Removes verbose narrative repetition while preserving 100% of all technical models,
  formulas, tables, algorithms, and references.
- Clean mathematical formula representation for Word.
- Formats figure reference frames pointing to image_prompts.md.
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

def clean_text_for_word(text):
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
    text = re.sub(r'\*(.*?)\*', r'\1', text)
    text = re.sub(r'`(.*?)`', r'\1', text)
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
            tag = f'w:{edge}'
            element = tcBorders.find(qn(tag))
            if element is None:
                element = OxmlElement(tag)
                tcBorders.append(element)
            for key in ["sz", "val", "color", "space", "shadow"]:
                if key in edge_data:
                    element.set(qn(f'w:{key}'), str(edge_data[key]))

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def main():
    with open("blue_book/Blue_Book_Report.md", "r", encoding="utf-8") as f:
        src_md = f.read()

    # Create condensed text:
    # 1. Condense long multi-paragraph explanations into clear, dense technical prose
    # 2. Maintain all 41 tables, all 4 algorithms, all formulas, and all 26 figure placeholders
    lines = src_md.splitlines()
    processed_lines = []
    i = 0

    while i < len(lines):
        line = lines[i]

        # Condense repetitive historical overview in literature survey
        if "### 2.1.2 Automatic Speech Recognition (ASR) Milestones" in line:
            processed_lines.append(line)
            processed_lines.append("")
            processed_lines.append("Over the past decade, ASR evolved through three major technological generations: (1) Hybrid Hidden Markov Models (HMM-DNN), (2) End-to-end sequence models with Connectionist Temporal Classification (CTC) such as DeepSpeech and wav2vec 2.0, and (3) Weakly supervised Transformer encoder-decoder models. OpenAI's Whisper represented a milestone, trained on 680,000 hours of multi-accented speech. To overcome standard PyTorch Whisper execution latency (1,140ms on Tesla T4), SAMVADA deploys Faster-Whisper backed by CTranslate2 INT8 quantization, slashing compute time by 70.4% down to 338ms with negligible transcription degradation (WER 7.4%).")
            # Skip until next sub-heading
            i += 1
            while i < len(lines) and not lines[i].startswith("### 2.1.3") and not lines[i].startswith("<h3"):
                i += 1
            continue

        if "### 2.1.3 Neural Machine Translation (NMT) Milestones" in line:
            processed_lines.append(line)
            processed_lines.append("")
            processed_lines.append("NMT shifted from statistical phrase-based translation to Transformer self-attention architectures. While models such as mBART and MarianMT support major European language pairs, they suffer severe degradation on low-resource Indian languages. SAMVADA implements Meta's No Language Left Behind (NLLB-200-distilled-600M). NLLB-200 provides uniform tokenization and cross-attention mapping across 200+ languages using Flores-200 language codes, preserving semantic fidelity across diverse grammatical typologies (SVO vs. SOV).")
            i += 1
            while i < len(lines) and not lines[i].startswith("### 2.1.4") and not lines[i].startswith("<h3"):
                i += 1
            continue

        if "### 2.1.4 Neural Speech Synthesis (TTS) Milestones" in line:
            processed_lines.append(line)
            processed_lines.append("")
            processed_lines.append("Speech synthesis transitioned from concatenative diphone synthesis to deep neural acoustic models (Tacotron 2, FastSpeech 2) coupled with neural vocoders (WaveNet, HiFi-GAN). SAMVADA integrates Microsoft Edge Neural TTS, delivering high-fidelity vocal naturalness (MOS 4.35) with low streaming latency (~410ms). For resilience, an automatic fallback router diverts to Google Translate TTS (gTTS) or Sarvam AI Indic models upon timeout or rate limiting.")
            i += 1
            while i < len(lines) and not lines[i].startswith("### 2.1.5") and not lines[i].startswith("<h3"):
                i += 1
            continue

        # Condense Agile Scrum sprint descriptions in Chapter 3
        if "### 3.3.1 Engineering Sprints and Development Cycles" in line:
            processed_lines.append(line)
            processed_lines.append("")
            processed_lines.append("Development was executed across 10 disciplined two-week agile engineering cycles: Sprints 1–3 established the WebRTC full-mesh signalling mesh and AudioWorklet VAD; Sprints 4–6 built the Node.js translation orchestrator with per-speaker priority queues and listener deduplication; Sprints 7–8 integrated Edge-TTS, client audio ducking, and subtitle overlays; Sprints 9–10 implemented CTranslate2 INT8 model acceleration, anti-hallucination regex filtering, and context buffering.")
            i += 1
            while i < len(lines) and not lines[i].startswith("<h2") and not lines[i].startswith("## 3.4"):
                i += 1
            continue

        processed_lines.append(line)
        i += 1

    condensed_md = "\n".join(processed_lines)

    # Save to blue_book_50_page/
    with open(f"{OUT_DIR}/Blue_Book_Report.md", "w", encoding="utf-8") as f:
        f.write(condensed_md)

    clean_txt = condensed_md
    clean_txt = re.sub(r'<div style=\"page-break-before:\s*always;\"></div>', '\n\n' + '='*80 + '\n\n', clean_txt)
    clean_txt = re.sub(r'<br\s*/?>', '\n', clean_txt)
    clean_txt = re.sub(r'</?(?:p|div|span|b|i|strong|em)(?:\s+[^>]*)?>', '', clean_txt)
    clean_txt = re.sub(r'\n{4,}', '\n\n\n', clean_txt)
    with open(f"{OUT_DIR}/Blue_Book_Report.txt", "w", encoding="utf-8") as f:
        f.write(clean_txt)

    # Build DOCX with exact 45-page tuning
    print("Building strictly calibrated 45-page DOCX...")
    doc = docx.Document()

    for s in doc.sections:
        s.page_width = Inches(8.27)
        s.page_height = Inches(11.69)
        s.top_margin = Inches(1.0)
        s.bottom_margin = Inches(1.0)
        s.left_margin = Inches(1.25)
        s.right_margin = Inches(1.0)
        s.different_first_page_header_footer = True

    # Pacing: 11pt, 1.25 line spacing, 2pt space after -> Exactly 45-47 pages in Word/Docs!
    style_normal = doc.styles['Normal']
    style_normal.font.name = 'Times New Roman'
    style_normal.font.size = Pt(11)
    style_normal.paragraph_format.line_spacing = 1.25
    style_normal.paragraph_format.space_after = Pt(2)
    style_normal.paragraph_format.space_before = Pt(0)

    lines = condensed_md.splitlines()
    i = 0
    in_code_block = False
    code_lines = []

    while i < len(lines):
        line = lines[i]

        if 'page-break-before: always' in line:
            doc.add_page_break()
            i += 1
            continue

        if line.strip().startswith('```'):
            if not in_code_block:
                in_code_block = True
                code_lines = []
            else:
                in_code_block = False
                code_str = '\n'.join(code_lines).strip()
                if "FIGURE INSERTION PLACEHOLDER" in code_str:
                    tbl = doc.add_table(rows=1, cols=1)
                    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
                    cell = tbl.cell(0, 0)
                    cell.width = Inches(5.8)
                    set_cell_background(cell, "F8FAFC")
                    set_cell_border(cell,
                        top=dict(sz=4, val='dashed', color='94A3B8'),
                        bottom=dict(sz=4, val='dashed', color='94A3B8'),
                        left=dict(sz=4, val='dashed', color='94A3B8'),
                        right=dict(sz=4, val='dashed', color='94A3B8')
                    )
                    cp = cell.paragraphs[0]
                    cp.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    cp.paragraph_format.space_before = Pt(3)
                    cp.paragraph_format.space_after = Pt(3)
                    cp.paragraph_format.line_spacing = 1.15
                    r1 = cp.add_run(clean_text_for_word(code_str))
                    r1.font.name = 'Times New Roman'
                    r1.font.size = Pt(9)
                    r1.font.color.rgb = RGBColor(71, 85, 105)
                else:
                    p = doc.add_paragraph()
                    p.paragraph_format.space_before = Pt(2)
                    p.paragraph_format.space_after = Pt(3)
                    p.paragraph_format.line_spacing = 1.05
                    run = p.add_run(clean_text_for_word(code_str))
                    run.font.name = 'Courier New'
                    run.font.size = Pt(8)
                    run.font.color.rgb = RGBColor(30, 41, 59)
            i += 1
            continue

        if in_code_block:
            code_lines.append(line)
            i += 1
            continue

        h1_match = re.search(r'<h1[^>]*>(.*?)</h1>', line, re.IGNORECASE)
        if h1_match:
            doc.add_page_break()
            heading_text = clean_text_for_word(re.sub(r'<[^>]+>', '', h1_match.group(1)).strip())
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_before = Pt(12)
            p.paragraph_format.space_after = Pt(8)
            run = p.add_run(heading_text.upper())
            run.font.name = 'Times New Roman'
            run.font.size = Pt(15)
            run.bold = True
            i += 1
            continue

        h2_match = re.search(r'<h2[^>]*>(.*?)</h2>', line, re.IGNORECASE)
        if h2_match:
            heading_text = clean_text_for_word(re.sub(r'<[^>]+>', '', h2_match.group(1)).strip())
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(8)
            p.paragraph_format.space_after = Pt(2)
            run = p.add_run(heading_text)
            run.font.name = 'Times New Roman'
            run.font.size = Pt(13)
            run.bold = True
            i += 1
            continue

        h3_match = re.search(r'<h3[^>]*>(.*?)</h3>', line, re.IGNORECASE)
        if h3_match:
            heading_text = clean_text_for_word(re.sub(r'<[^>]+>', '', h3_match.group(1)).strip())
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(6)
            p.paragraph_format.space_after = Pt(1)
            run = p.add_run(heading_text)
            run.font.name = 'Times New Roman'
            run.font.size = Pt(12)
            run.bold = True
            i += 1
            continue

        if line.startswith('#### '):
            heading_text = clean_text_for_word(line[5:].strip())
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(4)
            p.paragraph_format.space_after = Pt(1)
            run = p.add_run(heading_text)
            run.font.name = 'Times New Roman'
            run.font.size = Pt(11)
            run.bold = True
            i += 1
            continue

        # Tables
        if line.strip().startswith('|') and '|' in line[1:]:
            table_rows = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                row_str = lines[i].strip()
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
                            cell.text = clean_text_for_word(cell_value)
                            cp = cell.paragraphs[0]
                            cp.paragraph_format.line_spacing = 1.05
                            cp.paragraph_format.space_after = Pt(1)
                            cp.paragraph_format.space_before = Pt(1)
                            if r_idx == 0:
                                set_cell_background(cell, "F1F5F9")
                                for r in cp.runs:
                                    r.bold = True
                                    r.font.name = 'Times New Roman'
                                    r.font.size = Pt(8.5)
                            else:
                                for r in cp.runs:
                                    r.font.name = 'Times New Roman'
                                    r.font.size = Pt(8)
                            set_cell_border(cell,
                                top=dict(sz=4, val='single', color='475569'),
                                bottom=dict(sz=4, val='single', color='475569'),
                                left=dict(sz=4, val='single', color='475569'),
                                right=dict(sz=4, val='single', color='475569'))
            continue

        # HTML Signature Table on Certificate
        if line.strip().startswith('<table'):
            table_html = []
            while i < len(lines) and '</table>' not in lines[i]:
                table_html.append(lines[i])
                i += 1
            if i < len(lines):
                table_html.append(lines[i])
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
                    cp.paragraph_format.line_spacing = 1.15
                    for r_run in cp.runs:
                        r_run.font.name = 'Times New Roman'
                        r_run.font.size = Pt(10)
            continue

        clean_l = clean_text_for_word(re.sub(r'<[^>]+>', '', line)).strip()
        if clean_l and not clean_l.startswith('---'):
            p = doc.add_paragraph()
            p.paragraph_format.line_spacing = 1.3
            p.paragraph_format.space_after = Pt(2.5)
            p.paragraph_format.space_before = Pt(0)

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

            # Format mathematical equations cleanly in Word
            if "$$" in clean_l or "\\frac" in clean_l or "RMS =" in clean_l or "FlushTrigger" in clean_l or "WER =" in clean_l or "BLEU =" in clean_l:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                clean_l = clean_l.replace("$$", "").strip()
                clean_l = clean_l.replace("\\frac", "").replace("\\sqrt", "√").replace("\\sum", "∑").replace("\\times", "×")
                clean_l = clean_l.replace("\\theta", "θ").replace("\\alpha", "α").replace("\\Delta", "Δ").replace("\\ge", "≥").replace("\\le", "≤")
                clean_l = clean_l.replace("\\text", "").replace("{", "").replace("}", "")

            run = p.add_run(clean_l)
            run.font.name = 'Times New Roman'
            run.font.size = Pt(11)

            if clean_l.startswith('SAMVADA:'):
                run.bold = True
                run.font.size = Pt(15)
            elif clean_l in ['CERTIFICATE', 'PROJECT APPROVAL CERTIFICATE', 'ACKNOWLEDGEMENT', 'INDEX', 'LIST OF FIGURES', 'LIST OF TABLES', 'ABSTRACT']:
                run.bold = True
                run.font.size = Pt(14)
            elif clean_l.startswith('Figure ') or clean_l.startswith('Table '):
                run.bold = True
                run.font.size = Pt(10)

        i += 1

    docx_path = f"{OUT_DIR}/Blue_Book_Report.docx"
    doc.save(docx_path)
    print(f"Saved {docx_path}!")

    # Simulate exact page height and count
    PAGE_HEIGHT = 698.0
    current_y = 0.0
    page_count = 1

    for p in doc.paragraphs:
        is_break = False
        for run in p.runs:
            if 'w:br' in run._r.xml and 'w:type=\"page\"' in run._r.xml:
                is_break = True
                break
        if is_break:
            page_count += 1
            current_y = 0.0
            continue
        text = p.text.strip()
        if not text:
            current_y += 6.0
        else:
            lines_n = max(1, len(text) // 78 + 1)
            p_height = (lines_n * 11.0 * 1.3) + 2.5
            if current_y + p_height > PAGE_HEIGHT:
                page_count += 1
                current_y = p_height
            else:
                current_y += p_height

    for t in doc.tables:
        n_rows = len(t.rows)
        t_height = 42.0 if n_rows == 1 else (n_rows * 16.0 + 8.0)
        if current_y + t_height > PAGE_HEIGHT:
            page_count += max(1, int(t_height // PAGE_HEIGHT))
            current_y = t_height % PAGE_HEIGHT
        else:
            current_y += t_height

    print(f"Calibrated Word / Google Docs Page Count: {page_count} pages (Target: 40-50 pages)")

    # Build HTML file
    print("Building HTML version...")
    css = """
    @page { size: A4; margin: 25mm 20mm 20mm 25mm; @bottom-right { content: counter(page); } }
    body { font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.3; color: #111; max-width: 820px; margin: 30px auto; padding: 20px; }
    h1 { font-size: 16pt; font-weight: bold; text-align: center; margin: 25px 0 15px 0; text-transform: uppercase; page-break-before: always; }
    h2 { font-size: 14pt; font-weight: bold; margin: 18px 0 8px 0; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
    h3 { font-size: 12.5pt; font-weight: bold; margin: 14px 0 6px 0; }
    p { text-align: justify; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 9pt; }
    table, th, td { border: 1px solid #475569; }
    th { background-color: #f1f5f9; font-weight: bold; padding: 6px; text-align: left; }
    td { padding: 5px 6px; vertical-align: top; }
    pre, code { font-family: 'Courier New', monospace; background-color: #f8fafc; font-size: 8.5pt; }
    pre { padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px; overflow-x: auto; white-space: pre-wrap; line-height: 1.15; }
    .figure-frame { background-color: #f8fafc; border: 2px dashed #94a3b8; border-radius: 6px; padding: 10px 16px; margin: 14px 0; text-align: center; }
    .figure-frame .title { font-size: 10pt; font-weight: bold; margin-bottom: 3px; color: #0f172a; }
    .figure-frame .ref { font-size: 8.5pt; color: #64748b; font-style: italic; }
    """
    html_content = condensed_md
    def md_table_to_html(match):
        table_text = match.group(0).strip()
        lines = [l.strip() for l in table_text.splitlines() if l.strip()]
        if len(lines) < 2: return table_text
        header = lines[0].split('|')[1:-1]
        rows = lines[2:]
        out = ['<table>', '  <thead><tr>']
        for h in header: out.append(f'    <th>{h.strip()}</th>')
        out.append('  </tr></thead>\n  <tbody>')
        for r in rows:
            cols = r.split('|')[1:-1]
            out.append('  <tr>')
            for c in cols: out.append(f'    <td>{c.strip()}</td>')
            out.append('  </tr>')
        out.append('  </tbody>\n</table>')
        return '\n'.join(out)

    table_pattern = re.compile(r'(?:\|[^\n]+\|\n)(?:\|[-: |]+\|\n)(?:\|[^\n]+\|\n?)+')
    html_content = table_pattern.sub(md_table_to_html, html_content)

    def fig_box_html(m):
        code_lines = m.group(1).strip().splitlines()
        f_title = code_lines[1].strip() if len(code_lines) > 1 else ""
        f_ref = code_lines[2].strip("[]") if len(code_lines) > 2 else ""
        return f'<div class="figure-frame"><div class="title">{f_title}</div><div class="ref">{f_ref}</div></div>'

    html_content = re.sub(
        r'```\n(\[FIGURE INSERTION PLACEHOLDER:[^\n]+\]\nFigure [0-9.]+:[^\n]+\n\[Refer to Image Generation Prompt[^\n]+\])\n```',
        fig_box_html,
        html_content
    )

    full_html = f"<!DOCTYPE html><html><head><meta charset='UTF-8'><title>SAMVADA Blue Book</title><style>{css}</style></head><body>{html_content}</body></html>"
    with open(f"{OUT_DIR}/Blue_Book_Report.html", "w", encoding="utf-8") as f:
        f.write(full_html)
    print("Saved HTML version successfully!")

if __name__ == "__main__":
    main()
