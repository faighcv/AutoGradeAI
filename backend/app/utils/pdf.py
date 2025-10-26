# AUTOGRADEAI/backend/app/utils/pdf.py
from __future__ import annotations
from typing import Any, BinaryIO
from pypdf import PdfReader
from pdf2image import convert_from_bytes
import pytesseract
from PIL import Image
import io
import os

def _clean_join(lines: list[str]) -> str:
    return "\n".join(" ".join((line or "").split()) for line in lines).strip()

def _extract_pypdf(stream: BinaryIO) -> str:
    reader = PdfReader(stream)
    out: list[str] = []
    for page in reader.pages:
        txt = page.extract_text() or ""
        out.append(txt)
    return _clean_join(out)

def _extract_ocr(raw_bytes: bytes, dpi: int = 300) -> str:
    images = convert_from_bytes(raw_bytes, dpi=dpi)  # requires poppler
    texts: list[str] = []
    for img in images:
        if not isinstance(img, Image.Image):
            img = Image.fromarray(img)
        # grayscale improves OCR
        gray = img.convert("L")
        txt = pytesseract.image_to_string(gray)  # requires tesseract
        texts.append(txt or "")
    return _clean_join(texts)

def extract_pdf_text(src: Any) -> str:
    """
    Extract text from a PDF using pypdf first, then OCR fallback for scanned PDFs.
    src can be UploadFile, bytes, file-like object, or a path.
    """
    should_close = False
    stream: BinaryIO

    if hasattr(src, "file"):  # FastAPI UploadFile
        stream = src.file  # type: ignore[attr-defined]
        stream.seek(0)
        raw = stream.read()
        stream.seek(0)
    elif isinstance(src, (bytes, bytearray)):
        raw = bytes(src)
        stream = io.BytesIO(raw)
        should_close = True
    elif hasattr(src, "read"):
        stream = src  # type: ignore[assignment]
        try:
            stream.seek(0)
        except Exception:
            pass
        raw = stream.read()
        try:
            stream.seek(0)
        except Exception:
            pass
    elif isinstance(src, (str, os.PathLike)):
        with open(src, "rb") as f:
            raw = f.read()
        stream = io.BytesIO(raw)
        should_close = True
    else:
        raise TypeError("Unsupported input type for extract_pdf_text()")

    try:
        # 1) Try native text
        try:
            text = _extract_pypdf(stream)
        except Exception:
            text = ""

        # If almost nothing came out, try OCR
        if not text or len(text) < 40:
            text = _extract_ocr(raw)

        return text.strip()
    finally:
        if should_close:
            try:
                stream.close()
            except Exception:
                pass
