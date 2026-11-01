# -*- coding: utf-8 -*-
"""Render every slide of the 材料科学基础 courseware PDFs to WebP + build data files."""
import io
import json
import os
import re
import shutil
import sys

import pymupdf
from PIL import Image

SRC = r"D:\WPS Cloud\WPSDrive\1806525843\WPS企业云盘\北京大学\我的企业文档\26-27秋\2_材料科学基础"
OUT = r"D:\materials-science-foundations"

FULL_W = 1728
THUMB_W = 432
QUALITY = 80
THUMB_Q = 72

CHAPTERS = [
    {
        "id": "00",
        "num": "00",
        "title": "绪论",
        "en": "Introduction",
        "desc": "课程信息、材料分类、材料科学与工程四要素",
        "pdfs": ["第00章 绪论-2026.pdf"],
        "pdfOut": "ch00.pdf",
    },
    {
        "id": "01",
        "num": "01",
        "title": "晶体学",
        "en": "Crystallography",
        "desc": "点阵与晶胞、对称性、晶系、晶向晶面指数、倒易点阵、极射投影",
        "pdfs": ["第01章 晶体学-2026-Part 1 P1-114.pdf", "第01章 晶体学-2026-Part 2.pdf"],
        "pdfOut": "ch01.pdf",
    },
    {
        "id": "02",
        "num": "02",
        "title": "晶体结构",
        "en": "Crystal Structure",
        "desc": "原子堆垛、半径、单质与化合物结构、固溶体、同素异构、准晶",
        "pdfs": [
            "第02章 晶体结构-2026-Part 1 P1-36.pdf",
            "第02章 晶体结构-2026-Part 1 P36-100.pdf",
            "第02章 晶体结构-2026-PArt 3.pdf",
        ],
        "pdfOut": "ch02.pdf",
    },
    {
        "id": "03",
        "num": "03",
        "title": "半晶态与非晶态",
        "en": "Semicrystalline & Amorphous",
        "desc": "聚合物的半晶态、非晶态结构与转变",
        "pdfs": ["第03章 半晶态与非晶态-2026.pdf"],
        "pdfOut": "ch03.pdf",
    },
]

BAD = re.compile(r"[\u0000-\u001f\u007f\ue000-\uf8ff\U000f0000-\U000ffffd]")
PAGE_NO = re.compile(r"^[第]?\s*\d{1,3}\s*[页]?$")


def clean(text: str) -> str:
    text = BAD.sub("", text)
    text = text.replace("\u00a0", " ").replace("\uf0b7", "·")
    return text


def lines_of(page):
    raw = clean(page.get_text("text", sort=True))
    out = []
    for ln in raw.split("\n"):
        ln = re.sub(r"\s+", " ", ln).strip()
        if ln:
            out.append(ln)
    return out


def pick_title(lines):
    skip = ("材料科学基础（上）", "材料科学基础(上)", "北京大学", "材料科学与工程")
    for ln in lines[:8]:
        if PAGE_NO.match(ln) or len(ln) < 2:
            continue
        if any(s in ln for s in skip) and len(ln) < 30:
            continue
        if len(ln) <= 46:
            return ln
        return ln[:44] + "…"
    return ""


def render_page(page, dest, width):
    zoom = width / page.rect.width
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
    img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    img.save(dest, "WEBP", quality=QUALITY if width > 600 else THUMB_Q, method=4)


def main():
    data = {"chapters": []}
    for ch in CHAPTERS:
        cdir = os.path.join(OUT, "slides", ch["id"])
        tdir = os.path.join(OUT, "thumbs", ch["id"])
        os.makedirs(cdir, exist_ok=True)
        os.makedirs(tdir, exist_ok=True)
        slides = []
        prev_tail = None
        for pdf_name in ch["pdfs"]:
            path = os.path.join(SRC, pdf_name)
            doc = pymupdf.open(path)
            for idx in range(len(doc)):
                page = doc[idx]
                lines = lines_of(page)
                body = " ".join(lines)
                if prev_tail is not None and body[:300] == prev_tail[:300]:
                    prev_tail = body
                    continue
                n = len(slides) + 1
                full = os.path.join(cdir, f"{n:04d}.webp")
                thumb = os.path.join(tdir, f"{n:04d}.webp")
                render_page(page, full, FULL_W)
                render_page(page, thumb, THUMB_W)
                slides.append(
                    {
                        "n": n,
                        "img": f"slides/{ch['id']}/{n:04d}.webp",
                        "thumb": f"thumbs/{ch['id']}/{n:04d}.webp",
                        "title": pick_title(lines),
                        "text": body[:2000],
                    }
                )
                prev_tail = body
            doc.close()
        # full PDF for download
        if len(ch["pdfs"]) == 1:
            shutil.copyfile(os.path.join(SRC, ch["pdfs"][0]), os.path.join(OUT, "pdf", ch["pdfOut"]))
        else:
            merged = pymupdf.open()
            prev_last = None
            for pdf_name in ch["pdfs"]:
                src = pymupdf.open(os.path.join(SRC, pdf_name))
                start = 0
                if prev_last is not None:
                    first = " ".join(lines_of(src[0]))[:300]
                    if first == prev_last:
                        start = 1
                merged.insert_pdf(src, from_page=start)
                prev_last = " ".join(lines_of(src[-1]))[:300]
                src.close()
            merged.save(os.path.join(OUT, "pdf", ch["pdfOut"]), garbage=3, deflate=True)
            merged.close()

        data["chapters"].append(
            {
                "id": ch["id"],
                "num": ch["num"],
                "title": ch["title"],
                "en": ch["en"],
                "desc": ch["desc"],
                "count": len(slides),
                "cover": f"thumbs/{ch['id']}/0001.webp",
                "pdf": f"pdf/{ch['pdfOut']}",
                "slides": slides,
            }
        )
        print(f"chapter {ch['id']}: {len(slides)} slides", flush=True)

    with open(os.path.join(OUT, "data", "slides.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    manifest = {
        "course": "材料科学基础",
        "term": "2026 秋",
        "total": sum(c["count"] for c in data["chapters"]),
        "chapters": [
            {k: c[k] for k in ("id", "num", "title", "en", "desc", "count", "cover", "pdf")}
            for c in data["chapters"]
        ],
    }
    with open(os.path.join(OUT, "data", "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print("total", manifest["total"])


if __name__ == "__main__":
    sys.exit(main())
