"""表单识别第②层：纯文本 LLM（DeepSeek 或 OpenRouter）。只发送表单结构，不发送任何用户凭证。"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass

import httpx
from pydantic import BaseModel, ValidationError

from .models import SEMANTIC_FIELDS, FieldMapping, FormField, Semantic

# 名称: (Key 变量, 接口地址, 模型变量, 默认模型)；按顺序取第一个配置了 Key 的
PROVIDERS = {
    "deepseek": ("DEEPSEEK_API_KEY", "https://api.deepseek.com/chat/completions", "DEEPSEEK_MODEL", "deepseek-flash"),
    "openrouter": (
        "OPENROUTER_API_KEY",
        "https://openrouter.ai/api/v1/chat/completions",
        "OPENROUTER_MODEL",
        "openai/gpt-4.1-mini",
    ),
}

SYSTEM = (
    "You map web form controls of a product/startup directory submission page to semantic fields. "
    f"Allowed fields: {', '.join(SEMANTIC_FIELDS)}, skip, unknown. "
    "name=product name, tagline=one-line pitch (~60 chars), summary=short description (2-3 sentences), "
    "description=long description, features=key features list, alternatives=competitors/similar products, "
    "audience=target users, platforms=supported platforms (Web/iOS/macOS...), country=founder or company country, "
    "url=product website, maker_name=submitter full name, video=demo video URL, "
    "consent=terms/privacy checkbox, skip=must stay empty (password, honeypot, search, newsletter opt-in, paid upsell). "
    "Checkboxes in a multi-choice group (platforms, categories, tags) map to platforms/category/keywords. "
    "For select/radio controls also return `option` copied verbatim from the given options that best fits the product, or null. "
    'Reply with JSON only: {"mappings":[{"key":"<key>","field":"<field>","confidence":0..1,"option":null}]}'
)


class _Item(BaseModel):
    key: str
    field: Semantic
    confidence: float = 0.7
    option: str | None = None


class _Reply(BaseModel):
    mappings: list[_Item]


@dataclass
class LlmUsage:
    calls: int = 0
    tokens: int = 0
    cost_usd: float = 0.0


def provider() -> str | None:
    return next((name for name, (key, *_) in PROVIDERS.items() if os.getenv(key)), None)


def is_configured() -> bool:
    return provider() is not None


def describe() -> str:
    name = provider()
    if not name:
        return "off"
    _, _, model_var, default = PROVIDERS[name]
    return f"{name}:{os.getenv(model_var, default)}"


def _deepseek_cost(u: dict) -> float:
    """DeepSeek 不返回费用，按每百万 token 单价估算。默认 deepseek-flash 高峰价（闲时半价），可在 .env 覆盖。"""
    hit = int(u.get("prompt_cache_hit_tokens") or 0)
    miss = int(u.get("prompt_cache_miss_tokens") or (int(u.get("prompt_tokens") or 0) - hit))
    out = int(u.get("completion_tokens") or 0)
    price = lambda var, default: float(os.getenv(var) or default)  # noqa: E731
    return (
        hit * price("DEEPSEEK_PRICE_IN_CACHED", 0.006)
        + miss * price("DEEPSEEK_PRICE_IN", 0.3)
        + out * price("DEEPSEEK_PRICE_OUT", 1.2)
    ) / 1_000_000


def _compact(f: FormField) -> dict:
    d: dict = {"key": f.key, "type": f.type}
    for attr in ("label", "name", "id", "placeholder"):
        if v := getattr(f, attr):
            d[attr] = v
    if f.required:
        d["required"] = True
    if f.options:
        d["options"] = f.options[:25]
    return d


async def map_fields(
    client: httpx.AsyncClient,
    fields: list[FormField],
    product_hint: dict,
    page_url: str,
    usage: LlmUsage,
) -> list[FieldMapping]:
    payload = {
        "page": page_url,
        "product": product_hint,
        "controls": [_compact(f) for f in fields],
    }
    name = provider()
    if name is None:
        return []
    key_var, endpoint, model_var, default_model = PROVIDERS[name]
    headers = {"Authorization": f"Bearer {os.environ[key_var]}"}
    body_json: dict = {
        "model": os.getenv(model_var, default_model),
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
        ],
    }
    if name == "openrouter":
        headers["X-Title"] = "AutoLink M0"
        body_json["usage"] = {"include": True}
    elif os.getenv("DEEPSEEK_THINKING", "disabled") != "enabled":  # 字段映射不需要推理链：更快、更省
        body_json["thinking"] = {"type": "disabled"}
    resp = await client.post(endpoint, headers=headers, json=body_json, timeout=60)
    resp.raise_for_status()
    body = resp.json()
    usage.calls += 1
    u = body.get("usage") or {}
    usage.tokens += int(u.get("total_tokens") or 0)
    usage.cost_usd += _deepseek_cost(u) if name == "deepseek" else float(u.get("cost") or 0)

    content = body["choices"][0]["message"]["content"] or ""
    content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip())
    try:
        reply = _Reply.model_validate_json(content)
    except ValidationError:
        return []
    valid = {f.key for f in fields}
    return [
        FieldMapping(key=i.key, field=i.field, source="llm", confidence=max(0.0, min(1.0, i.confidence)), option=i.option)
        for i in reply.mappings
        if i.key in valid
    ]
