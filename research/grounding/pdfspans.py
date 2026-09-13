"""Deterministic PDF layout grounding for the Source Grounding Layer v0.8.

Faithful geometry only: no OCR, no interpretation, no LLM. Emits visual rows,
table regions with cell/row/column geometry, and explicit abstention when a
table layout cannot be recovered deterministically. Pinned to PyMuPDF 1.26.5.
"""
import json
import re
import sys

import pymupdf

PARSER_VERSION = "pdf-layout-spans-pymupdf-1.26.5/v1"

INTEGER = r"\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?"
NUMERIC = re.compile(r"^(?:\([-\u2212]?" + INTEGER + r"\)|[-\u2212]?\$?" + INTEGER + r"%?)$")
PLACEHOLDER = re.compile(r"^[*\u2014\u2013-]+$|^N/?A$", re.I)
CURRENCY = re.compile(r"^[$\u20ac\u00a3]$")
CELL_EXTRA = re.compile(r"^(?:[$\u20ac\u00a3]|%|[*\u2014\u2013]+|N/?A)$", re.I)
UNIT_CAPTION = re.compile(
    r"\((?:in|\$\s?in|dollars\s+in)\s+(thousands|millions|billions)[^)]*\)", re.I
)
PERIOD_PHRASE = re.compile(
    r"\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b"
    r"|\bended\b|\bas\s+of\b|\bquarter\b|\byear\b|\bmonths?\b|\bQ[1-4]\b|^\d{4}$",
    re.I,
)
COLUMN_TOLERANCE = 4.0
ROW_GAP = 20.0
PHRASE_GAP = 12.0
HEADER_WINDOW = 60.0
CAPTION_WINDOW = 100.0
MAX_HEADER_ROWS = 3


def numeric_token(word):
    return bool(NUMERIC.match(word)) and any(c.isdigit() for c in word)


def words_of(page):
    out = []
    for x0, y0, x1, y1, text, block, line, word in page.get_text("words", sort=True):
        out.append(
            {
                "x0": round(x0, 1),
                "y0": round(y0, 1),
                "x1": round(x1, 1),
                "y1": round(y1, 1),
                "text": text,
                "block": int(block),
                "line": int(line),
                "index": int(word),
            }
        )
    return out


def fragments(words):
    groups = {}
    for word in words:
        groups.setdefault((word["block"], word["line"]), []).append(word)
    out = []
    for key, members in groups.items():
        members = sorted(members, key=lambda w: w["x0"])
        out.append(
            {
                "block": key[0],
                "line": key[1],
                "y0": min(w["y0"] for w in members),
                "y1": max(w["y1"] for w in members),
                "x0": min(w["x0"] for w in members),
                "x1": max(w["x1"] for w in members),
                "words": members,
            }
        )
    return out


def visual_rows(parts):
    """Merge fragments sharing a visual baseline into left-to-right rows."""
    rows = []
    for part in sorted(parts, key=lambda p: (p["y0"], p["x0"])):
        merged = False
        for row in rows:
            overlap = min(row["y1"], part["y1"]) - max(row["y0"], part["y0"])
            height = min(row["y1"] - row["y0"], part["y1"] - part["y0"])
            if height > 0 and overlap >= 0.5 * height:
                row["words"].extend(part["words"])
                row["y0"] = min(row["y0"], part["y0"])
                row["y1"] = max(row["y1"], part["y1"])
                row["x0"] = min(row["x0"], part["x0"])
                row["x1"] = max(row["x1"], part["x1"])
                row["blocks"] = row["blocks"] | {part["block"]}
                merged = True
                break
        if not merged:
            rows.append(
                {
                    "y0": part["y0"],
                    "y1": part["y1"],
                    "x0": part["x0"],
                    "x1": part["x1"],
                    "blocks": {part["block"]},
                    "words": list(part["words"]),
                }
            )
    for row in rows:
        row["words"].sort(key=lambda w: (w["x0"], w["index"]))
        row["text"] = " ".join(w["text"] for w in row["words"])
        row["blocks"] = sorted(row["blocks"])
    return sorted(rows, key=lambda r: (r["y0"], r["x0"]))


def attach_currency(words, index):
    """Attach a currency sign that belongs to this value cell.

    The sign must be the closest preceding non-numeric token and the gap must
    stay inside one column width. Values without a nearby sign stay value-only.
    """
    cell = [words[index]]
    for previous in reversed(words[:index]):
        if numeric_token(previous["text"]):
            break
        if CURRENCY.match(previous["text"]):
            if words[index]["x0"] - previous["x1"] < 80:
                cell = [previous, words[index]]
            break
        if not CELL_EXTRA.match(previous["text"]):
            break
    return cell


def attach_percent(words, cell):
    """A trailing percent sign that is its own word belongs to this value."""
    last = cell[-1]
    position = words.index(last)
    if position + 1 < len(words):
        following = words[position + 1]
        if following["text"] == "%" and following["x0"] - last["x1"] < COLUMN_TOLERANCE:
            return cell + [following]
    return cell


def table_line_cells(row):
    """Cell words of a table row, or None when the row is not a table row."""
    words = row["words"]
    candidates = [
        index
        for index, word in enumerate(words)
        if numeric_token(word["text"]) or PLACEHOLDER.match(word["text"])
    ]
    if len(candidates) < 2 or candidates[0] == 0:
        return None
    for position, word in enumerate(words):
        if position < candidates[0]:
            continue
        if numeric_token(word["text"]) or CELL_EXTRA.match(word["text"]):
            continue
        return None
    cells = []
    for index in candidates:
        if numeric_token(words[index]["text"]):
            cells.append(attach_percent(words, attach_currency(words, index)))
        else:
            cells.append([words[index]])
    return cells


def cluster_columns(cells):
    columns = []
    for cell in sorted(cells, key=lambda c: c["x1"]):
        if columns and abs(cell["x1"] - columns[-1]["x1"]) <= COLUMN_TOLERANCE:
            columns[-1]["x0"] = min(columns[-1]["x0"], cell["x0"])
            columns[-1]["x1"] = max(columns[-1]["x1"], cell["x1"])
            columns[-1]["count"] += 1
        else:
            columns.append({"x0": cell["x0"], "x1": cell["x1"], "count": 1})
    for position, column in enumerate(columns):
        column["columnIndex"] = position
        column["center"] = round((column["x0"] + column["x1"]) / 2, 1)
    for position, column in enumerate(columns):
        previous = columns[position - 1]["x1"] if position > 0 else column["x0"] - 30
        following = columns[position + 1]["x1"] if position + 1 < len(columns) else column["x1"] + 30
        column["band"] = [round((previous + column["x1"]) / 2, 1), round((column["x1"] + following) / 2, 1)]
    return columns


def assign_column(cells, columns):
    assignment = []
    for cell in cells:
        center = (cell["x0"] + cell["x1"]) / 2
        best = min(columns, key=lambda c: abs(c["center"] - center))
        if PLACEHOLDER.match(cell["text"]):
            assignment.append(best["columnIndex"])
            continue
        if abs(best["center"] - center) > COLUMN_TOLERANCE + 8:
            return None
        assignment.append(best["columnIndex"])
    return assignment


def phrases_of(row):
    """Split a header row into x-contiguous phrases."""
    phrases, current = [], []
    for word in row["words"]:
        if current and word["x0"] - current[-1]["x1"] > PHRASE_GAP:
            phrases.append(current)
            current = []
        current.append(word)
    if current:
        phrases.append(current)
    return phrases


def caption_for(rows, run_start, run_y0):
    for row in reversed(rows[:run_start]):
        if run_y0 - row["y1"] > CAPTION_WINDOW:
            break
        match = UNIT_CAPTION.search(row["text"])
        if match:
            return {
                "text": row["text"],
                "match": match.group(0),
                "scale": match.group(1).lower(),
                "bbox": [row["x0"], row["y0"], row["x1"], row["y1"]],
            }
    return None


def header_rows(rows, run_start, columns, run_y0):
    headers = []
    for row in reversed(rows[:run_start]):
        if run_y0 - row["y1"] > HEADER_WINDOW or len(headers) >= MAX_HEADER_ROWS:
            break
        if UNIT_CAPTION.search(row["text"]):
            continue
        if table_line_cells(row) is not None:
            continue
        # Header phrases are short column captions; prose sentences are not.
        if len(row["words"]) > 14:
            continue
        if row["text"].rstrip().endswith(":"):
            continue
        letters = [c for c in row["text"] if c.isalpha()]
        if letters and sum(1 for c in letters if c.isupper()) / len(letters) > 0.8:
            continue
        parts = []
        for phrase in phrases_of(row):
            parts.append(
                {
                    "text": " ".join(w["text"] for w in phrase),
                    "x0": min(w["x0"] for w in phrase),
                    "x1": max(w["x1"] for w in phrase),
                }
            )
        captioned = any(PERIOD_PHRASE.search(part["text"]) for part in parts)
        if parts and (captioned or len(parts) >= 2):
            headers.append({"text": row["text"], "parts": parts})
    headers.reverse()
    return headers


def bind_headers(headers, columns):
    """Bind header phrases to columns, bottom row first.

    The row closest to the table maps one phrase per column. A higher row maps
    each of its phrases onto the columns covered by the lower phrases it spans,
    which is how grouped headers such as "Three Months Ended June 30," work.
    """
    bindings = [[] for _ in headers]
    for position in range(len(headers) - 1, -1, -1):
        single = len(headers[position]["parts"]) == 1
        for part in headers[position]["parts"]:
            covered = set()
            for lower in range(position + 1, len(headers)):
                for index, other in enumerate(headers[lower]["parts"]):
                    if other["x0"] < part["x1"] and other["x1"] > part["x0"]:
                        covered |= bindings[lower][index]
            if single and position + 1 < len(headers):
                # A lone phrase above the column captions qualifies every column.
                covered = set(range(len(columns)))
            if not covered:
                center = (part["x0"] + part["x1"]) / 2
                overlapping = [
                    column
                    for column in columns
                    if part["x0"] < column["band"][1] + COLUMN_TOLERANCE
                    and part["x1"] > column["band"][0] - COLUMN_TOLERANCE
                ]
                if not overlapping:
                    bindings[position].append(set())
                    continue
                best = min(overlapping, key=lambda c: abs(center - c["center"]))
                covered = {best["columnIndex"]}
            bindings[position].append(covered)
    return bindings


def build_table(page_number, rows, run):
    table_rows, cells = [], []
    for row in run:
        row_cells = table_line_cells(row)
        if row_cells is None or len(row_cells) < 2:
            return None
        first = row_cells[0][0]
        prefix = row["words"][: row["words"].index(first)] if first in row["words"] else []
        table_rows.append(
            {
                "y0": row["y0"],
                "y1": row["y1"],
                "cells": row_cells,
                "label": " ".join(w["text"] for w in prefix),
            }
        )
        cells.extend(cell[-1] for cell in row_cells)
    columns = cluster_columns([cell for cell in cells if not PLACEHOLDER.match(cell["text"])])
    if len(columns) < 2:
        return None
    matrix = []
    for row in table_rows:
        assignment = assign_column([cell[-1] for cell in row["cells"]], columns)
        if assignment is None or len(set(assignment)) != len(assignment):
            return None
        matrix.append(assignment)
    if len({len(row) for row in matrix}) != 1:
        return None
    run_start = rows.index(run[0])
    headers = header_rows(rows, run_start, columns, run[0]["y0"])
    if not headers:
        return None
    bindings = bind_headers(headers, columns)
    header_by_column = {column["columnIndex"]: [] for column in columns}
    for position, header in enumerate(headers):
        for index, part in enumerate(header["parts"]):
            for column_index in sorted(bindings[position][index]):
                header_by_column[column_index].append(part["text"])
    if any(not header_by_column[column["columnIndex"]] for column in columns):
        return None
    caption = caption_for(rows, run_start, run[0]["y0"])
    table_cells = []
    for row_index, (row, assignment) in enumerate(zip(table_rows, matrix)):
        for cell, column_index in zip(row["cells"], assignment):
            table_cells.append(
                {
                    "rowIndex": row_index,
                    "columnIndex": column_index,
                    "rowLabel": row["label"],
                    "text": " ".join(w["text"] for w in cell),
                    "words": [
                        {"text": w["text"], "x0": w["x0"], "y0": w["y0"], "x1": w["x1"], "y1": w["y1"]}
                        for w in cell
                    ],
                    "bbox": [
                        min(w["x0"] for w in cell),
                        min(w["y0"] for w in cell),
                        max(w["x1"] for w in cell),
                        max(w["y1"] for w in cell),
                    ],
                    "headerPath": header_by_column[column_index],
                }
            )
    region = [
        min(row["x0"] for row in run),
        min(row["y0"] for row in run),
        max(row["x1"] for row in run),
        max(row["y1"] for row in run),
    ]
    return {
        "page": page_number,
        "status": "ok",
        "caption": caption,
        "columns": [
            {
                "columnIndex": column["columnIndex"],
                "x0": column["x0"],
                "x1": column["x1"],
                "headerPath": header_by_column[column["columnIndex"]],
            }
            for column in columns
        ],
        "rows": [
            {"rowIndex": index, "label": row["label"], "y0": row["y0"], "y1": row["y1"]}
            for index, row in enumerate(table_rows)
        ],
        "cells": table_cells,
        "region": [round(value, 1) for value in region],
        "headerText": [header["text"] for header in headers],
    }


def detect_tables(page_number, rows):
    tables, runs, current = [], [], []
    for row in rows:
        if table_line_cells(row) is not None:
            if current and row["y0"] - current[-1]["y1"] > ROW_GAP:
                runs.append(current)
                current = []
            current.append(row)
        elif current and row["y0"] - current[-1]["y1"] > ROW_GAP:
            runs.append(current)
            current = []
    if current:
        runs.append(current)
    for run in runs:
        if len(run) < 2:
            continue
        table = build_table(page_number, rows, run)
        if table:
            tables.append(table)
        else:
            first = run[0]
            tables.append(
                {
                    "page": page_number,
                    "status": "unsupported_table_layout",
                    "reason": "row/column structure not deterministically recoverable",
                    "region": [first["x0"], first["y0"], first["x1"], first["y1"]],
                    "sample": first["text"][:200],
                }
            )
    return tables


def parse_page(page, page_number):
    rows = visual_rows(fragments(words_of(page)))
    tables = detect_tables(page_number, rows)
    # Only recovered tables own their region: an abstained run keeps its raw
    # text available as ordinary text blocks instead of guessing structure.
    regions = [table["region"] for table in tables if table["status"] != "unsupported_table_layout"]
    text_blocks = []
    for block in page.get_text("blocks", sort=True):
        if block[6] != 0 or not block[4].strip():
            continue
        bbox = [round(value, 1) for value in block[:4]]
        if any(
            bbox[0] < region[2] and bbox[2] > region[0] and bbox[1] < region[3] and bbox[3] > region[1]
            for region in regions
        ):
            continue
        covered = [
            index
            for index, row in enumerate(rows)
            if row["y0"] < bbox[3] and row["y1"] > bbox[1]
        ]
        text_blocks.append(
            {
                "bbox": bbox,
                "text": block[4].strip(),
                "lineStart": covered[0] if covered else None,
                "lineEnd": covered[-1] if covered else None,
            }
        )
    return {"page": page_number, "rows": rows, "tables": tables, "textBlocks": text_blocks}


def main():
    if pymupdf.VersionBind != "1.26.5":
        raise RuntimeError("PDF grounding requires pinned PyMuPDF 1.26.5")
    doc = pymupdf.open(sys.argv[1])
    if doc.needs_pass:
        raise ValueError("Encrypted PDF is unsupported")
    pages = []
    for page in doc:
        record = parse_page(page, page.number + 1)
        if record["rows"]:
            pages.append(record)
    print(json.dumps({"parserVersion": PARSER_VERSION, "pageCount": len(doc), "pages": pages}, ensure_ascii=False))


if __name__ == "__main__":
    main()
