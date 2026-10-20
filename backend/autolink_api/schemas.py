from __future__ import annotations

import re
from datetime import date, datetime
from typing import Annotated, Any, get_args

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints, field_validator
from pydantic.alias_generators import to_camel

from .models import (
    ListingStatus,
    LoginMethod,
    Plan,
    Platform,
    ProductPricing,
    Role,
    SitePricing,
    SiteStatus,
    SubmitMode,
    UserStatus,
)
from .security import PASSWORD_MAX, PASSWORD_MIN

EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$")
URL_RE = re.compile(r"^https?://[^\s/$.?#][^\s]*$", re.I)
DOMAIN_RE = re.compile(r"^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(/[\w\-./]*)?$")


def _email(v: str) -> str:
    v = v.strip().lower()
    if not EMAIL_RE.match(v):
        raise ValueError("invalid email")
    return v


def _url(v: str) -> str:
    v = v.strip()
    if not URL_RE.match(v):
        raise ValueError("must be an http(s) URL")
    return v


def _optional_url(v: str) -> str:
    v = v.strip()
    return _url(v) if v else ""


def normalize_domain(v: str) -> str:
    v = re.sub(r"^https?://", "", v.strip().lower())
    v = re.sub(r"^www\.", "", v).rstrip("/")
    if not DOMAIN_RE.match(v):
        raise ValueError("invalid domain")
    return v


def _items(max_items: int, item_max: int) -> AfterValidator:
    def check(v: list[str]) -> list[str]:
        v = [s.strip() for s in v if s and s.strip()]
        if len(v) > max_items:
            raise ValueError(f"at most {max_items} items")
        if any(len(s) > item_max for s in v):
            raise ValueError(f"each item at most {item_max} characters")
        return v

    return AfterValidator(check)


Str = Annotated[str, StringConstraints(strip_whitespace=True)]
Email = Annotated[str, Field(max_length=254), AfterValidator(_email)]
Url = Annotated[str, Field(max_length=500), AfterValidator(_url)]
OptionalUrl = Annotated[str, Field(max_length=300), AfterValidator(_optional_url)]
SiteUrl = Annotated[str, Field(max_length=500), AfterValidator(_optional_url)]
Domain = Annotated[str, Field(max_length=253), AfterValidator(normalize_domain)]
Password = Annotated[str, Field(min_length=PASSWORD_MIN, max_length=PASSWORD_MAX)]


class Schema(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class Page[T](Schema):
    items: list[T]
    total: int
    page: int
    page_size: int


# ---------- 用户与认证 ----------


class LoginIn(Schema):
    email: str = Field(max_length=254)
    password: str = Field(max_length=PASSWORD_MAX)


class UserOut(Schema):
    id: int
    email: str
    name: str
    role: Role
    plan_id: Plan
    status: UserStatus
    created_at: datetime
    last_login_at: datetime | None


class LoginOut(Schema):
    token: str
    expires_at: datetime
    user: UserOut


class AdminUserOut(UserOut):
    product_count: int = 0
    locked_until: datetime | None = None


class UserCreate(Schema):
    email: Email
    password: Password
    name: Str = Field(default="", max_length=80)
    role: Role = "user"
    plan_id: Plan = "free"


class UserUpdate(Schema):
    name: Str | None = Field(default=None, max_length=80)
    role: Role | None = None
    plan_id: Plan | None = None
    status: UserStatus | None = None
    password: Password | None = None
    unlock: bool = False


# ---------- 产品（校验规则与 web/src/lib/definitions.ts 的 zod 一致） ----------


class ProductIn(Schema):
    name: Str = Field(min_length=1, max_length=60)
    url: Annotated[str, Field(max_length=300), AfterValidator(_url)]
    tagline: Str = Field(min_length=1, max_length=100)
    summary: Str = Field(min_length=1, max_length=500)
    description: Str = Field(default="", max_length=5000)
    category: Str = Field(min_length=1, max_length=40)
    keywords: Annotated[list[str], _items(10, 30)] = []
    audience: Str = Field(default="", max_length=200)
    features: Annotated[list[str], _items(8, 150)] = []
    alternatives: Annotated[list[str], _items(5, 40)] = []
    pricing: ProductPricing
    pricing_detail: Str = Field(default="", max_length=80)
    platforms: list[Platform] = Field(default=[], max_length=len(get_args(Platform)))
    maker_name: Str = Field(default="", max_length=60)
    contact_email: Annotated[str, Field(max_length=120), AfterValidator(_email)]
    country: Str = Field(default="", max_length=40)
    twitter: OptionalUrl = ""
    linkedin: OptionalUrl = ""
    github: OptionalUrl = ""
    discord: OptionalUrl = ""
    video: OptionalUrl = ""
    note: Str = Field(default="", max_length=2000)

    @field_validator("platforms")
    @classmethod
    def _dedupe(cls, v: list[Platform]) -> list[Platform]:
        return list(dict.fromkeys(v))


class SubmissionOut(Schema):
    domain: str
    status: ListingStatus
    note: str
    listing_url: str
    launch_date: date | None
    updated_at: datetime


class ProductOut(ProductIn):
    id: str
    logo: str | None = None
    screenshot: str | None = None
    credits_used: int
    created_at: datetime
    updated_at: datetime
    submissions: list[SubmissionOut] = []


class AdminProductOut(Schema):
    id: str
    name: str
    url: str
    category: str
    owner_id: int
    owner_email: str
    submission_count: int
    created_at: datetime
    updated_at: datetime


# ---------- 站点 ----------


class SiteFields(Schema):
    name: Str = Field(default="", max_length=120)
    # 留空时由接口填为 https://{domain}
    submit_url: SiteUrl = ""
    category: Str = Field(default="", max_length=60)
    pricing: SitePricing = "unknown"
    login_method: LoginMethod = "none"
    requires_backlink: bool = False
    requires_verification: bool = False
    supports_launch: bool = False
    review_time_hint: Str = Field(default="", max_length=60)
    submit_mode: SubmitMode = "auto"
    status: SiteStatus = "active"
    problems: Str = Field(default="", max_length=500)
    admin_note: Str = Field(default="", max_length=2000)


class SiteCreate(SiteFields):
    domain: Domain


class SiteUpdate(Schema):
    domain: Domain | None = None
    name: Str | None = Field(default=None, max_length=120)
    submit_url: SiteUrl | None = None
    category: Str | None = Field(default=None, max_length=60)
    pricing: SitePricing | None = None
    login_method: LoginMethod | None = None
    requires_backlink: bool | None = None
    requires_verification: bool | None = None
    supports_launch: bool | None = None
    review_time_hint: Str | None = Field(default=None, max_length=60)
    submit_mode: SubmitMode | None = None
    status: SiteStatus | None = None
    problems: Str | None = Field(default=None, max_length=500)
    admin_note: Str | None = Field(default=None, max_length=2000)


class SiteOut(SiteFields):
    id: int
    domain: str
    submitted: int
    listed: int
    in_review: int
    created_at: datetime
    updated_at: datetime


# ---------- 后台 ----------


class AuditOut(Schema):
    id: int
    actor_email: str | None
    action: str
    target_type: str
    target_id: str
    detail: dict[str, Any]
    created_at: datetime


class StatsOut(Schema):
    users: dict[str, int]
    plans: dict[str, int]
    products: int
    sites: dict[str, int]
    site_modes: dict[str, int]
    submissions: dict[str, int]
    recent: list[AuditOut]
