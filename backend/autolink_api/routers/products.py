from __future__ import annotations

import json
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ..config import PLAN_PRODUCTS
from ..deps import DB, CurrentUser, audit
from ..models import Product, Submission, User
from ..schemas import ProductIn, ProductOut, SubmissionOut
from ..storage import ASSET_LIMITS, PRODUCT_ID, image_ext, product_dir, save_asset, slugify, write_mirror

router = APIRouter(prefix="/products", tags=["products"])

ASSET_LABELS = {"logo": "Logo", "screenshot": "产品截图"}


def to_out(p: Product) -> ProductOut:
    out = ProductOut.model_validate(p)
    out.submissions = [
        SubmissionOut(
            domain=s.site.domain,
            status=s.status,  # type: ignore[arg-type]
            note=s.note,
            listing_url=s.listing_url,
            launch_date=s.launch_date,
            updated_at=s.updated_at,
        )
        for s in sorted(p.submissions, key=lambda s: s.site.domain)
    ]
    return out


def _owned(db: Session, user: User, product_id: str) -> Product:
    p = db.get(Product, product_id, options=[selectinload(Product.submissions).selectinload(Submission.site)])
    # 不区分“不存在”和“不是你的”，避免探测他人产品 id
    if p is None or p.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "产品不存在")
    return p


def _parse(data: str) -> ProductIn:
    try:
        return ProductIn.model_validate(json.loads(data))
    except json.JSONDecodeError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "data 不是有效的 JSON") from None
    except ValidationError as e:
        raise RequestValidationError(e.errors(include_url=False, include_context=False)) from None


def _read_assets(files: dict[str, UploadFile | None]) -> dict[str, tuple[bytes, str]]:
    assets: dict[str, tuple[bytes, str]] = {}
    errors = []
    for key, f in files.items():
        if f is None or not f.filename:
            continue
        limit = ASSET_LIMITS[key]
        data = f.file.read(limit + 1)
        if not data:
            continue
        if len(data) > limit:
            errors.append({"loc": ["body", key], "msg": f"{ASSET_LABELS[key]}不超过 {limit // 1024 // 1024} MB", "type": "too_large"})
            continue
        ext = image_ext(data)
        if ext is None:
            errors.append({"loc": ["body", key], "msg": f"{ASSET_LABELS[key]}仅支持 PNG、JPG、WebP 图片", "type": "bad_image"})
            continue
        assets[key] = (data, ext)
    if errors:
        raise RequestValidationError(errors)
    return assets


def _new_id(db: Session, name: str) -> str:
    base = slugify(name)
    pid, i = base, 2
    while db.get(Product, pid) is not None or product_dir(pid).exists():
        pid = f"{base}-{i}"
        i += 1
    return pid


def _apply(db: Session, p: Product, body: ProductIn, assets: dict[str, tuple[bytes, str]]) -> None:
    for k, v in body.model_dump().items():
        setattr(p, k, v)
    for key, (data, ext) in assets.items():
        setattr(p, key, save_asset(p.id, key, data, ext))
    db.flush()
    db.refresh(p)
    write_mirror(p)


Data = Annotated[str, Form(max_length=40_000)]
Logo = Annotated[UploadFile | None, File()]
Screenshot = Annotated[UploadFile | None, File()]


@router.get("", response_model=list[ProductOut])
def list_products(user: CurrentUser, db: DB) -> list[ProductOut]:
    rows = db.scalars(
        select(Product)
        .where(Product.owner_id == user.id)
        .options(selectinload(Product.submissions).selectinload(Submission.site))
        .order_by(Product.created_at)
    ).all()
    return [to_out(p) for p in rows]


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: str, user: CurrentUser, db: DB) -> ProductOut:
    return to_out(_owned(db, user, product_id))


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(user: CurrentUser, db: DB, data: Data, logo: Logo = None, screenshot: Screenshot = None) -> ProductOut:
    body = _parse(data)
    assets = _read_assets({"logo": logo, "screenshot": screenshot})
    limit = PLAN_PRODUCTS.get(user.plan_id, 1)
    count = db.scalar(select(func.count()).select_from(Product).where(Product.owner_id == user.id)) or 0
    if count >= limit:
        raise HTTPException(status.HTTP_409_CONFLICT, f"已达到当前套餐的产品上限（{limit} 个）")

    p = Product(id=_new_id(db, body.name), owner_id=user.id)
    db.add(p)
    _apply(db, p, body, assets)
    audit(db, user, "product.create", "product", p.id, name=p.name)
    db.commit()
    return to_out(_owned(db, user, p.id))


@router.put("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: str, user: CurrentUser, db: DB, data: Data, logo: Logo = None, screenshot: Screenshot = None
) -> ProductOut:
    if not PRODUCT_ID.match(product_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "产品不存在")
    p = _owned(db, user, product_id)
    body = _parse(data)
    assets = _read_assets({"logo": logo, "screenshot": screenshot})
    _apply(db, p, body, assets)
    audit(db, user, "product.update", "product", p.id, assets=sorted(assets))
    db.commit()
    return to_out(_owned(db, user, p.id))
