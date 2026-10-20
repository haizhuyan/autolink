from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from ..deps import DB
from ..models import Site
from ..schemas import SiteOut

router = APIRouter(prefix="/sites", tags=["sites"])

HIDDEN = ("dead", "blacklisted")
PRIVATE_FIELDS = {"admin_note", "problems"}


@router.get("", response_model=list[SiteOut], response_model_exclude=PRIVATE_FIELDS)
def list_sites(db: DB) -> list[Site]:
    """公开站点库：不含失效和黑名单站点，也不含后台备注。"""
    return list(db.scalars(select(Site).where(Site.status.not_in(HIDDEN)).order_by(Site.domain)).all())


@router.get("/{domain:path}", response_model=SiteOut, response_model_exclude=PRIVATE_FIELDS)
def get_site(domain: str, db: DB) -> Site:
    site = db.scalar(select(Site).where(Site.domain == domain.lower(), Site.status.not_in(HIDDEN)))
    if site is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "站点不存在")
    return site
