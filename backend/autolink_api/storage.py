"""产品素材与 product.json 镜像：引擎通过 `m0 run --product <id>` 直接读取该目录。"""

from __future__ import annotations

import json
import re
import shutil
import unicodedata
import uuid
from pathlib import Path

from .config import get_settings
from .models import Product
from .schemas import ProductIn

PRODUCT_ID = re.compile(r"^[a-z0-9][a-z0-9-]{0,39}$")

ASSET_LIMITS = {"logo": 1024 * 1024, "screenshot": 3 * 1024 * 1024}


def product_dir(product_id: str) -> Path:
    if not PRODUCT_ID.match(product_id):
        raise ValueError("invalid product id")
    return get_settings().products_dir / product_id


def image_ext(b: bytes) -> str | None:
    """按文件头识别图片类型，不信任客户端给的 MIME 和扩展名。"""
    if b[:4] == b"\x89PNG":
        return "png"
    if b[:3] == b"\xff\xd8\xff":
        return "jpg"
    if b[:4] == b"RIFF" and b[8:12] == b"WEBP":
        return "webp"
    return None


def save_asset(product_id: str, key: str, data: bytes, ext: str) -> str:
    d = product_dir(product_id)
    d.mkdir(parents=True, exist_ok=True)
    for old in d.glob(f"{key}.*"):
        old.unlink()
    name = f"{key}.{ext}"
    (d / name).write_bytes(data)
    return name


def write_mirror(p: Product) -> None:
    d = product_dir(p.id)
    d.mkdir(parents=True, exist_ok=True)
    data = ProductIn.model_validate(p).model_dump(by_alias=True)
    data |= {"id": p.id, "createdAt": p.created_at.isoformat(), "updatedAt": p.updated_at.isoformat()}
    for key in ("logo", "screenshot"):
        if getattr(p, key):
            data[key] = getattr(p, key)
    (d / "product.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def remove_dir(product_id: str) -> None:
    d = product_dir(product_id)
    if d.is_dir():
        shutil.rmtree(d)


def slugify(name: str) -> str:
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:32]
    return s or f"product-{uuid.uuid4().hex[:8]}"
