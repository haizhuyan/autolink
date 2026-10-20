from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import Select, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from ..deps import DB, AdminUser, audit
from ..models import AuditLog, Product, Site, SiteStatus, Submission, SubmitMode, User
from ..schemas import (
    AdminProductOut,
    AdminUserOut,
    AuditOut,
    Page,
    SiteCreate,
    SiteOut,
    SiteUpdate,
    StatsOut,
    UserCreate,
    UserUpdate,
)
from ..security import hash_password

router = APIRouter(prefix="/admin", tags=["admin"])

PageNo = Annotated[int, Query(ge=1, le=10_000)]
PageSize = Annotated[int, Query(ge=1, le=100, alias="pageSize")]
Search = Annotated[str, Query(max_length=100)]


def _like(q: str) -> str:
    return "%" + q.strip().lower().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


def _paginate(db: Session, stmt: Select[Any], page: int, size: int) -> tuple[list[Any], int]:
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.execute(stmt.limit(size).offset((page - 1) * size)).all()
    return [r[0] if len(r) == 1 else r for r in rows], total


def _counts(db: Session, column: Any) -> dict[str, int]:
    return {k: v for k, v in db.execute(select(column, func.count()).group_by(column)).all()}


def _audit_out(log: AuditLog) -> AuditOut:
    return AuditOut(
        id=log.id,
        actor_email=log.actor.email if log.actor else None,
        action=log.action,
        target_type=log.target_type,
        target_id=log.target_id,
        detail=log.detail,
        created_at=log.created_at,
    )


# ---------- 概览 ----------


@router.get("/stats", response_model=StatsOut)
def stats(_: AdminUser, db: DB) -> StatsOut:
    recent = db.scalars(
        select(AuditLog).options(joinedload(AuditLog.actor)).order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).limit(10)
    ).all()
    return StatsOut(
        users=_counts(db, User.status),
        plans=_counts(db, User.plan_id),
        products=db.scalar(select(func.count()).select_from(Product)) or 0,
        sites=_counts(db, Site.status),
        site_modes=_counts(db, Site.submit_mode),
        submissions=_counts(db, Submission.status),
        recent=[_audit_out(a) for a in recent],
    )


# ---------- 用户 ----------


def _user_out(user: User, product_count: int) -> AdminUserOut:
    out = AdminUserOut.model_validate(user)
    out.product_count = product_count
    return out


def _product_count(db: Session, user_id: int) -> int:
    return db.scalar(select(func.count()).select_from(Product).where(Product.owner_id == user_id)) or 0


@router.get("/users", response_model=Page[AdminUserOut])
def list_users(
    _: AdminUser, db: DB, q: Search = "", role: str = "", status_: Annotated[str, Query(alias="status")] = "",
    page: PageNo = 1, page_size: PageSize = 20,
) -> Page[AdminUserOut]:
    counts = select(Product.owner_id, func.count().label("n")).group_by(Product.owner_id).subquery()
    stmt = select(User, func.coalesce(counts.c.n, 0)).outerjoin(counts, counts.c.owner_id == User.id)
    if q.strip():
        like = _like(q)
        stmt = stmt.where(or_(func.lower(User.email).like(like, escape="\\"), func.lower(User.name).like(like, escape="\\")))
    if role:
        stmt = stmt.where(User.role == role)
    if status_:
        stmt = stmt.where(User.status == status_)
    rows, total = _paginate(db, stmt.order_by(User.created_at.desc(), User.id.desc()), page, page_size)
    return Page(items=[_user_out(u, n) for u, n in rows], total=total, page=page, page_size=page_size)


@router.post("/users", response_model=AdminUserOut, status_code=status.HTTP_201_CREATED)
def create_user(body: UserCreate, admin: AdminUser, db: DB) -> AdminUserOut:
    if db.scalar(select(User.id).where(User.email == body.email)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "该邮箱已注册")
    user = User(
        email=body.email, password_hash=hash_password(body.password), name=body.name, role=body.role, plan_id=body.plan_id
    )
    db.add(user)
    db.flush()
    audit(db, admin, "user.create", "user", user.id, email=user.email, role=user.role, plan=user.plan_id)
    db.commit()
    return _user_out(user, 0)


@router.get("/users/{user_id}", response_model=AdminUserOut)
def get_user(user_id: int, _: AdminUser, db: DB) -> AdminUserOut:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "用户不存在")
    return _user_out(user, _product_count(db, user.id))


@router.patch("/users/{user_id}", response_model=AdminUserOut)
def update_user(user_id: int, body: UserUpdate, admin: AdminUser, db: DB) -> AdminUserOut:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "用户不存在")
    if user.id == admin.id and (body.role not in (None, "admin") or body.status not in (None, "active")):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "不能取消自己的管理员权限或停用自己")

    changes: dict[str, Any] = {}
    for field in ("name", "role", "plan_id", "status"):
        value = getattr(body, field)
        if value is not None and value != getattr(user, field):
            changes[field] = [getattr(user, field), value]
            setattr(user, field, value)
    if body.password is not None:
        user.password_hash = hash_password(body.password)
        changes["password"] = "reset"
    if body.unlock:
        user.failed_logins = 0
        user.locked_until = None
        changes["unlock"] = True
    # 改密码、改角色或停用后，让该用户已有的登录全部失效
    if {"password", "role", "status"} & changes.keys():
        user.token_version += 1
    if changes:
        audit(db, admin, "user.update", "user", user.id, **changes)
    db.commit()
    return _user_out(user, _product_count(db, user.id))


# ---------- 产品 ----------


@router.get("/products", response_model=Page[AdminProductOut])
def list_products(_: AdminUser, db: DB, q: Search = "", page: PageNo = 1, page_size: PageSize = 20) -> Page[AdminProductOut]:
    subs = select(Submission.product_id, func.count().label("n")).group_by(Submission.product_id).subquery()
    stmt = (
        select(Product, User.email, func.coalesce(subs.c.n, 0))
        .join(User, User.id == Product.owner_id)
        .outerjoin(subs, subs.c.product_id == Product.id)
    )
    if q.strip():
        like = _like(q)
        stmt = stmt.where(
            or_(
                func.lower(Product.name).like(like, escape="\\"),
                func.lower(Product.url).like(like, escape="\\"),
                func.lower(User.email).like(like, escape="\\"),
            )
        )
    rows, total = _paginate(db, stmt.order_by(Product.created_at.desc()), page, page_size)
    items = [
        AdminProductOut(
            id=p.id,
            name=p.name,
            url=p.url,
            category=p.category,
            owner_id=p.owner_id,
            owner_email=email,
            submission_count=n,
            created_at=p.created_at,
            updated_at=p.updated_at,
        )
        for p, email, n in rows
    ]
    return Page(items=items, total=total, page=page, page_size=page_size)


# ---------- 站点 ----------


@router.get("/sites", response_model=Page[SiteOut])
def list_sites(
    _: AdminUser, db: DB, q: Search = "", status_: Annotated[SiteStatus | None, Query(alias="status")] = None,
    mode: SubmitMode | None = None, page: PageNo = 1, page_size: PageSize = 20,
) -> Page[SiteOut]:
    stmt = select(Site)
    if q.strip():
        like = _like(q)
        stmt = stmt.where(or_(Site.domain.like(like, escape="\\"), func.lower(Site.name).like(like, escape="\\")))
    if status_:
        stmt = stmt.where(Site.status == status_)
    if mode:
        stmt = stmt.where(Site.submit_mode == mode)
    rows, total = _paginate(db, stmt.order_by(Site.domain), page, page_size)
    return Page(items=[SiteOut.model_validate(s) for s in rows], total=total, page=page, page_size=page_size)


@router.get("/sites/{site_id}", response_model=SiteOut)
def get_site(site_id: int, _: AdminUser, db: DB) -> Site:
    site = db.get(Site, site_id)
    if site is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "站点不存在")
    return site


def _domain_taken(db: Session, domain: str, exclude_id: int | None = None) -> bool:
    stmt = select(Site.id).where(Site.domain == domain)
    if exclude_id is not None:
        stmt = stmt.where(Site.id != exclude_id)
    return db.scalar(stmt) is not None


@router.post("/sites", response_model=SiteOut, status_code=status.HTTP_201_CREATED)
def create_site(body: SiteCreate, admin: AdminUser, db: DB) -> Site:
    if _domain_taken(db, body.domain):
        raise HTTPException(status.HTTP_409_CONFLICT, "该域名已在站点库中")
    site = Site(**body.model_dump())
    site.submit_url = site.submit_url or f"https://{site.domain}"
    db.add(site)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "该域名已在站点库中") from None
    audit(db, admin, "site.create", "site", site.id, domain=site.domain)
    db.commit()
    return site


@router.patch("/sites/{site_id}", response_model=SiteOut)
def update_site(site_id: int, body: SiteUpdate, admin: AdminUser, db: DB) -> Site:
    site = db.get(Site, site_id)
    if site is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "站点不存在")
    if body.domain is not None and _domain_taken(db, body.domain, site.id):
        raise HTTPException(status.HTTP_409_CONFLICT, "该域名已在站点库中")
    values = body.model_dump(exclude_unset=True)
    if values.get("submit_url") == "":
        values["submit_url"] = f"https://{body.domain or site.domain}"
    changes: dict[str, Any] = {}
    for field, value in values.items():
        if value is not None and value != getattr(site, field):
            changes[field] = [getattr(site, field), value]
            setattr(site, field, value)
    if changes:
        audit(db, admin, "site.update", "site", site.id, **({"domain": site.domain} | changes))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "该域名已在站点库中") from None
    return site


@router.delete("/sites/{site_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_site(site_id: int, admin: AdminUser, db: DB) -> None:
    site = db.get(Site, site_id)
    if site is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "站点不存在")
    used = db.scalar(select(func.count()).select_from(Submission).where(Submission.site_id == site.id)) or 0
    if used:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"已有 {used} 条用户提交记录使用该站点，不能删除；可把状态改为“已失效”。"
        )
    audit(db, admin, "site.delete", "site", site.id, domain=site.domain)
    db.delete(site)
    db.commit()


@router.get("/audit", response_model=Page[AuditOut])
def list_audit(
    _: AdminUser, db: DB, action: Annotated[str, Query(max_length=64)] = "", page: PageNo = 1, page_size: PageSize = 50
) -> Page[AuditOut]:
    stmt = select(AuditLog).options(joinedload(AuditLog.actor))
    if action:
        stmt = stmt.where(AuditLog.action.like(_like(action), escape="\\"))
    rows, total = _paginate(db, stmt.order_by(AuditLog.created_at.desc(), AuditLog.id.desc()), page, page_size)
    return Page(items=[_audit_out(a) for a in rows], total=total, page=page, page_size=page_size)
