# AUTOGRADEAI/backend/app/utils/pdf.py
from __future__ import annotations
from typing import Any, BinaryIO
from pypdf import PdfReader
from pdf2image import convert_from_bytes
import pytesseract
from PIL import Image
import io
import os
def extract_pdf_text(src: Any) -> str:
    should_close = False
    stream: BinaryIO

    if hasattr(src, "file"):
        stream = src.file  # type: ignore[attr-defined]
        stream.seek(0)
    elif isinstance(src, (bytes, bytearray)):
        stream = io.BytesIO(src)
        should_close = True
    elif hasattr(src, "read"):
        stream = src  # type: ignore[assignment]
        try: stream.seek(0)
        except Exception: pass
    elif isinstance(src, (str, os.PathLike)):
        stream = open(src, "rb")
        should_close = True
    else:
        raise TypeError("Unsupported input type for extract_pdf_text()")

    try:
        reader = PdfReader(stream)
        out: list[str] = []
        for page in reader.pages:
            txt = page.extract_text() or ""
            out.append(" ".join(txt.split()))
        return "\n".join(out).strip()
    finally:
        if should_close:
            try: stream.close()
            except Exception: pass