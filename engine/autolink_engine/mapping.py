"""表单识别第①层：启发式规则（E-7）。置信度低的字段交给 LLM。"""

from __future__ import annotations

import re
from collections import defaultdict

from .models import FieldMapping, FormField

STRONG = 0.9
WEAK = 0.5

# (语义字段, 正则, 置信度)，按顺序匹配，先命中先用
RULES: list[tuple[str, re.Pattern[str], float]] = [
    ("skip", re.compile(r"password|passwd|密码|search|coupon|promo", re.I), STRONG),
    ("consent", re.compile(r"agree|terms|privacy|consent|accept|同意", re.I), STRONG),
    # 问卷类问题（“你是怎么知道我们的”）交给 LLM 判断
    ("unknown", re.compile(r"hear about|find us|how did you (?:hear|find|learn)|referr", re.I), 0.0),
    ("twitter", re.compile(r"twitter|x\.com|\bx handle|\bx profile", re.I), STRONG),
    ("linkedin", re.compile(r"linkedin", re.I), STRONG),
    ("github", re.compile(r"github", re.I), STRONG),
    ("discord", re.compile(r"discord", re.I), STRONG),
    ("video", re.compile(r"video|youtube|loom|vimeo|视频", re.I), STRONG),
    ("logo", re.compile(r"logo|icon|avatar|favicon", re.I), STRONG),
    ("screenshot", re.compile(r"screenshot|cover|thumbnail|banner|preview image|gallery|截图", re.I), STRONG),
    ("email", re.compile(r"e-?mail|邮箱", re.I), STRONG),
    ("first_name", re.compile(r"first.?name|given.?name", re.I), STRONG),
    ("last_name", re.compile(r"last.?name|surname|family.?name", re.I), STRONG),
    ("maker_name", re.compile(r"your name|full.?name|maker|founder|contact.?name|submitter|author", re.I), STRONG),
    (
        "name",
        re.compile(r"(product|tool|startup|app|project|company|site|website|business|software)[ _-]?(name|title)|名称", re.I),
        STRONG,
    ),
    ("tagline", re.compile(r"tag.?line|slogan|one.?liner|subtitle|headline|pitch", re.I), STRONG),
    ("summary", re.compile(r"short.?desc|summary|brief|excerpt|简介|简述", re.I), STRONG),
    ("features", re.compile(r"\bfeatures?\b|功能", re.I), STRONG),
    ("alternatives", re.compile(r"alternative|competitor|similar (?:to|products?|tools?)|替代|竞品", re.I), STRONG),
    ("audience", re.compile(r"audience|target (?:users?|customers?|market)|who is it for|ideal customer|受众", re.I), STRONG),
    ("country", re.compile(r"country|based in|made in|headquarter|国家|地区", re.I), STRONG),
    ("keywords", re.compile(r"\btags?\b|keyword|标签|关键词", re.I), STRONG),
    ("category", re.compile(r"categor|topic|industry|分类", re.I), STRONG),
    ("pricing", re.compile(r"pric|pricing model|\bplan\b|free or paid|定价", re.I), STRONG),
    ("description", re.compile(r"descr|about|details|tell us|introduc|描述|介绍", re.I), STRONG),
    ("platforms", re.compile(r"platform|operating system|\bos\b|available on|平台", re.I), STRONG),
    ("url", re.compile(r"\burl\b|website|web site|homepage|\blink\b|domain|官网|网址", re.I), STRONG),
    ("name", re.compile(r"\bname\b|\btitle\b", re.I), WEAK),
]

# 复选框只在这些语义下勾选（多选组，如平台、分类标签）
CHECKBOX_SEMANTICS = {"consent", "platforms", "category", "keywords", "pricing"}


def _blob(f: FormField) -> str:
    return " ".join([f.label, f.name, f.id, f.placeholder]).lower()


def map_field(f: FormField) -> FieldMapping:
    blob = _blob(f)
    if f.type == "password":
        return FieldMapping(key=f.key, field="skip", source="rule", confidence=STRONG)
    if f.type == "email":
        return FieldMapping(key=f.key, field="email", source="rule", confidence=STRONG)
    if f.type == "file":
        is_shot = re.search(r"screenshot|cover|thumbnail|banner|gallery|image", blob)
        return FieldMapping(key=f.key, field="screenshot" if is_shot else "logo", source="rule", confidence=STRONG if is_shot or "logo" in blob or "icon" in blob else WEAK)
    for semantic, pattern, conf in RULES:
        if pattern.search(blob):
            if f.type == "checkbox" and semantic not in CHECKBOX_SEMANTICS:
                break
            if semantic == "consent" and f.type != "checkbox":
                continue
            return FieldMapping(key=f.key, field=semantic, source="rule", confidence=conf)  # type: ignore[arg-type]
    if f.type == "url":
        return FieldMapping(key=f.key, field="url", source="rule", confidence=STRONG)
    if f.type in ("textarea", "richtext"):
        return FieldMapping(key=f.key, field="description", source="rule", confidence=WEAK)
    return FieldMapping(key=f.key, field="unknown", source="rule", confidence=0.0)


def pick_target_form(fields: list[FormField]) -> list[FormField]:
    """在页面多个表单中挑出最像“产品提交”的一组，排除登录、订阅、搜索框。"""
    groups: dict[tuple[int, int], list[FormField]] = defaultdict(list)
    for f in fields:
        groups[(f.frame, f.form)].append(f)
    best: tuple[float, list[FormField]] | None = None
    for group in groups.values():
        maps = [map_field(f) for f in group]
        semantics = {m.field for m in maps}
        fillable = [f for f in group if f.type not in ("checkbox", "radio")]
        if any(f.type == "password" for f in group) and len(fillable) <= 3:
            continue  # 登录表单
        if len(fillable) < 2:
            continue  # 单个邮箱订阅框之类
        score = len(semantics & {"name", "url", "tagline", "description", "category", "logo"}) * 2 + len(fillable) * 0.1
        if best is None or score > best[0]:
            best = (score, group)
    return best[1] if best else []
