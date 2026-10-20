from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any, Literal, get_args

from sqlalchemy import JSON, Boolean, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

# 取值与 web/src/lib/site-labels.ts、definitions.ts 保持一致
Role = Literal["user", "admin"]
UserStatus = Literal["active", "disabled"]
Plan = Literal["free", "basic", "pro", "max"]
SitePricing = Literal["free_with_backlink", "paid", "paid_with_free_window", "unknown"]
LoginMethod = Literal["google", "email_password", "none"]
SubmitMode = Literal["auto", "manual"]
SiteStatus = Literal["active", "needs_review", "dead", "blacklisted"]
# needs_manual = 待人工接管（验证码、邮箱验证等引擎无法自动完成的步骤）
ListingStatus = Literal["not_submitted", "needs_manual", "in_review", "listed", "rejected", "timed_out"]
ProductPricing = Literal["Free", "Freemium", "Free Trial", "Paid", "Open Source"]
Platform = Literal["Web", "iOS", "Android", "macOS", "Windows", "Linux", "Browser Extension", "API", "CLI"]

ROLES: tuple[str, ...] = get_args(Role)
PLANS: tuple[str, ...] = get_args(Plan)
SUBMIT_MODES: tuple[str, ...] = get_args(SubmitMode)
SITE_STATUSES: tuple[str, ...] = get_args(SiteStatus)
SITE_PRICING: tuple[str, ...] = get_args(SitePricing)
LOGIN_METHODS: tuple[str, ...] = get_args(LoginMethod)
LISTING_STATUSES: tuple[str, ...] = get_args(ListingStatus)


def utcnow() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    type_annotation_map = {dict[str, Any]: JSON, list[str]: JSON}


class Timestamps:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class User(Timestamps, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(80), default="")
    role: Mapped[str] = mapped_column(String(16), default="user")
    plan_id: Mapped[str] = mapped_column(String(16), default="free")
    status: Mapped[str] = mapped_column(String(16), default="active")
    # 改密码、停用时递增，使已签发的令牌失效
    token_version: Mapped[int] = mapped_column(Integer, default=0)
    failed_logins: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    products: Mapped[list[Product]] = relationship(back_populates="owner", cascade="all, delete-orphan")


class Product(Timestamps, Base):
    __tablename__ = "products"

    # 同时是 data/private/products/<id>/ 的目录名，引擎用 `m0 run --product <id>` 读取
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(60))
    url: Mapped[str] = mapped_column(String(300))
    tagline: Mapped[str] = mapped_column(String(100))
    summary: Mapped[str] = mapped_column(String(500))
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(40))
    keywords: Mapped[list[str]] = mapped_column(default=list)
    audience: Mapped[str] = mapped_column(String(200), default="")
    features: Mapped[list[str]] = mapped_column(default=list)
    alternatives: Mapped[list[str]] = mapped_column(default=list)
    pricing: Mapped[str] = mapped_column(String(20))
    pricing_detail: Mapped[str] = mapped_column(String(80), default="")
    platforms: Mapped[list[str]] = mapped_column(default=list)
    maker_name: Mapped[str] = mapped_column(String(60), default="")
    contact_email: Mapped[str] = mapped_column(String(120))
    country: Mapped[str] = mapped_column(String(40), default="")
    twitter: Mapped[str] = mapped_column(String(300), default="")
    linkedin: Mapped[str] = mapped_column(String(300), default="")
    github: Mapped[str] = mapped_column(String(300), default="")
    discord: Mapped[str] = mapped_column(String(300), default="")
    video: Mapped[str] = mapped_column(String(300), default="")
    note: Mapped[str] = mapped_column(Text, default="")
    logo: Mapped[str | None] = mapped_column(String(40))
    screenshot: Mapped[str | None] = mapped_column(String(40))
    credits_used: Mapped[int] = mapped_column(Integer, default=0)

    owner: Mapped[User] = relationship(back_populates="products")
    submissions: Mapped[list[Submission]] = relationship(back_populates="product", cascade="all, delete-orphan")


class Site(Timestamps, Base):
    __tablename__ = "sites"

    id: Mapped[int] = mapped_column(primary_key=True)
    domain: Mapped[str] = mapped_column(String(253), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120), default="")
    submit_url: Mapped[str] = mapped_column(String(500))
    category: Mapped[str] = mapped_column(String(60), default="")
    pricing: Mapped[str] = mapped_column(String(32), default="unknown")
    login_method: Mapped[str] = mapped_column(String(32), default="none")
    requires_backlink: Mapped[bool] = mapped_column(Boolean, default=False)
    requires_verification: Mapped[bool] = mapped_column(Boolean, default=False)
    supports_launch: Mapped[bool] = mapped_column(Boolean, default=False)
    review_time_hint: Mapped[str] = mapped_column(String(60), default="")
    submit_mode: Mapped[str] = mapped_column(String(16), default="auto")
    status: Mapped[str] = mapped_column(String(16), default="active", index=True)
    problems: Mapped[str] = mapped_column(String(500), default="")
    admin_note: Mapped[str] = mapped_column(Text, default="")
    # 种子数据中的历史提交统计，用于“验证状态”
    submitted: Mapped[int] = mapped_column(Integer, default=0)
    listed: Mapped[int] = mapped_column(Integer, default=0)
    in_review: Mapped[int] = mapped_column(Integer, default=0)

    submissions: Mapped[list[Submission]] = relationship(back_populates="site", cascade="all, delete-orphan")


class Submission(Timestamps, Base):
    __tablename__ = "submissions"
    __table_args__ = (UniqueConstraint("product_id", "site_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(16), default="not_submitted")
    note: Mapped[str] = mapped_column(Text, default="")
    listing_url: Mapped[str] = mapped_column(String(500), default="")
    launch_date: Mapped[date | None] = mapped_column(Date)

    product: Mapped[Product] = relationship(back_populates="submissions")
    site: Mapped[Site] = relationship(back_populates="submissions")

    @property
    def domain(self) -> str:
        return self.site.domain


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    action: Mapped[str] = mapped_column(String(64))
    target_type: Mapped[str] = mapped_column(String(32))
    target_id: Mapped[str] = mapped_column(String(64))
    detail: Mapped[dict[str, Any]] = mapped_column(default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    actor: Mapped[User | None] = relationship()
