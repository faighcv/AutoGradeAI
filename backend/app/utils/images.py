# backend/app/utils/images.py
from __future__ import annotations
from pdf2image import convert_from_bytes
from pathlib import Path
from typing import List
import io, os

def pdf_to_pngs(pdf_path: str, out_dir: str) -> List[str]:
    """
    Convert a PDF to per-page PNG images. Returns ordered list of image paths.
    """
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    with open(pdf_path, "rb") as f:
        pages = convert_from_bytes(f.read(), dpi=200)  # 200 dpi is a nice balance
    paths: List[str] = []
    for i, img in enumerate(pages, start=1):
        p = out / f"page_{i:03d}.png"
        img.save(p, format="PNG", optimize=True)
        paths.append(str(p))
    return paths
