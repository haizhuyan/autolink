from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

# 产品资料中可被填入表单的语义字段；consent=同意条款勾选，skip=明确不填
SEMANTIC_FIELDS = (
    "name",
    "url",
    "tagline",
    "summary",
    "description",
    "category",
    "keywords",
    "audience",
    "features",
    "alternatives",
    "pricing",
    "platforms",
    "email",
    "maker_name",
    "first_name",
    "last_name",
    "country",
    "twitter",
    "linkedin",
    "github",
    "discord",
    "video",
    "logo",
    "screenshot",
    "consent",
)
Semantic = Literal[
    "name",
    "url",
    "tagline",
    "summary",
    "description",
    "category",
    "keywords",
    "audience",
    "features",
    "alternatives",
    "pricing",
    "platforms",
    "email",
    "maker_name",
    "first_name",
    "last_name",
    "country",
    "twitter",
    "linkedin",
    "github",
    "discord",
    "video",
    "logo",
    "screenshot",
    "consent",
    "skip",
    "unknown",
]


class Product(BaseModel):
    """产品档案。字段与 web 端保存的 data/private/products/<id>/product.json 一致（camelCase）。"""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")

    id: str = ""
    name: str
    url: str
    tagline: str
    summary: str = ""
    description: str = ""
    category: str = ""
    keywords: list[str] = []
    audience: str = ""
    features: list[str] = []
    alternatives: list[str] = []
    pricing: str = ""
    pricing_detail: str = ""
    platforms: list[str] = []
    maker_name: str = ""
    contact_email: str = ""
    country: str = ""
    twitter: str = ""
    linkedin: str = ""
    github: str = ""
    discord: str = ""
    video: str = ""
    # 产品目录下的素材文件名
    logo: str = ""
    screenshot: str = ""

    def values_for(self, field: str, multiline: bool = True) -> list[str]:
        """按优先级返回候选值（长 → 短）；填写时取第一个不超过 maxlength 的。"""
        first, _, last = self.maker_name.partition(" ")
        features = "\n".join(f"- {x}" for x in self.features) if multiline else "; ".join(self.features)
        pricing = f"{self.pricing} ({self.pricing_detail})" if self.pricing and self.pricing_detail else self.pricing
        values: dict[str, list[str]] = {
            "name": [self.name],
            "url": [self.url],
            "tagline": [self.tagline],
            "summary": [self.summary, self.tagline],
            "description": [self.description, self.summary, self.tagline],
            "category": [self.category],
            "keywords": [", ".join(self.keywords)],
            "audience": [self.audience],
            "features": [features],
            "alternatives": [", ".join(self.alternatives)],
            "pricing": [pricing, self.pricing],
            "platforms": [", ".join(self.platforms)],
            "email": [self.contact_email],
            "maker_name": [self.maker_name],
            "first_name": [first],
            "last_name": [last],
            "country": [self.country],
            "twitter": [self.twitter],
            "linkedin": [self.linkedin],
            "github": [self.github],
            "discord": [self.discord],
            "video": [self.video],
        }
        return [v for v in values.get(field, []) if v]

    def value_for(self, field: str) -> str | None:
        return next(iter(self.values_for(field)), None)

    def choices_for(self, field: str) -> list[str]:
        """多选控件（复选框组）可勾选的值。"""
        return {
            "platforms": self.platforms,
            "category": [self.category, *self.keywords],
            "keywords": self.keywords,
            "pricing": [self.pricing],
        }.get(field, [])


class FormField(BaseModel):
    """页面上的一个可填写控件（单选组合并为一个字段）。"""

    frame: int
    idx: int
    tag: str
    type: str
    name: str = ""
    id: str = ""
    label: str = ""
    placeholder: str = ""
    required: bool = False
    options: list[str] = []
    form: int = -1
    accept: str = ""
    maxlength: int | None = None

    @property
    def key(self) -> str:
        return f"{self.frame}:{self.idx}"


class FieldMapping(BaseModel):
    key: str
    field: Semantic
    source: Literal["rule", "llm"]
    confidence: float = Field(ge=0, le=1)
    option: str | None = None


class FillResult(BaseModel):
    key: str
    field: str
    ok: bool
    detail: str = ""


class SiteResult(BaseModel):
    domain: str
    start_url: str
    final_url: str = ""
    outcome: Literal[
        "ready",
        "ready_captcha",
        "partial",
        "login_required",
        "no_form",
        "blocked",
        "unreachable",
        "manual_only",
        "error",
    ] = "error"
    hops: int = 0
    session: bool = False
    captcha: bool = False
    has_password: bool = False
    oauth: list[str] = []
    embedded_form: str = ""
    fields_total: int = 0
    required_total: int = 0
    mapped_rule: int = 0
    mapped_llm: int = 0
    filled: int = 0
    required_unfilled: list[str] = []
    fill_errors: list[str] = []
    llm_calls: int = 0
    llm_tokens: int = 0
    llm_cost_usd: float = 0.0
    seconds: float = 0.0
    screenshot: str = ""
    error: str = ""
    fields: list[FormField] = []
    mappings: list[FieldMapping] = []
