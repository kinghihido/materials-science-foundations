# -*- coding: utf-8 -*-
"""Re-extract the full text of every slide and patch data/slides.json (no re-rendering)."""
import json
import os
import sys

import pymupdf

sys.path.insert(0, os.path.dirname(__file__))
import build_slides as b

LIMIT = 2000


def main():
    with open(os.path.join(b.OUT, "data", "slides.json"), encoding="utf-8") as f:
        data = json.load(f)

    for ch in b.CHAPTERS:
        hits = next(c for c in data["chapters"] if c["id"] == ch["id"])
        texts = []
        prev_tail = None
        for pdf_name in ch["pdfs"]:
            doc = pymupdf.open(os.path.join(b.SRC, pdf_name))
            for idx in range(len(doc)):
                lines = b.lines_of(doc[idx])
                body = " ".join(lines)
                if prev_tail is not None and body[:300] == prev_tail[:300]:
                    prev_tail = body
                    continue
                texts.append(body[:LIMIT])
                prev_tail = body
            doc.close()
        assert len(texts) == len(hits["slides"]), (ch["id"], len(texts), len(hits["slides"]))
        for slide, text in zip(hits["slides"], texts):
            slide["text"] = text
        print(ch["id"], "patched", len(texts))

    with open(os.path.join(b.OUT, "data", "slides.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main()
