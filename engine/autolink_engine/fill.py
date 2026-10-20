"""字段填充（E-8）。只填写，不点击提交按钮、不按回车。"""

from __future__ import annotations

import difflib
import re
import struct
import zlib
from pathlib import Path

from playwright.async_api import Locator, Page

from .models import FieldMapping, FillResult, FormField, Product

TIMEOUT_MS = 4000

# 平台复选框的常见写法
PLATFORM_ALIASES = {
    "web": ("web", "web app", "website", "online", "browser-based"),
    "ios": ("ios", "iphone", "ipad", "app store"),
    "android": ("android", "google play"),
    "macos": ("macos", "mac", "osx", "os x"),
    "windows": ("windows",),
    "linux": ("linux",),
    "browser extension": ("browser extension", "extension", "chrome extension", "chrome", "firefox", "add-on", "plugin"),
    "api": ("api",),
    "cli": ("cli", "command line", "terminal"),
}


def write_png(path: Path, width: int, height: int, rgb: tuple[int, int, int]) -> Path:
    """生成纯色 PNG，用作 Logo / 截图上传测试素材。"""

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    row = b"\x00" + bytes(rgb) * width
    raw = zlib.compress(row * height, 9)
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", raw) + chunk(b"IEND", b""))
    return path


def best_option(options: list[str], wanted: str | None, hint: str | None) -> int | None:
    """返回最匹配的选项下标；跳过“请选择”类占位项。"""
    real = [(i, o) for i, o in enumerate(options) if o and not o.lower().startswith(("select", "choose", "--", "pick", "请选择"))]
    if not real:
        return None
    lowered = {o.lower(): i for i, o in real}
    for target in (wanted, hint):
        if not target:
            continue
        t = target.lower()
        if t in lowered:
            return lowered[t]
        for o, i in lowered.items():
            if t in o or o in t:
                return i
        close = difflib.get_close_matches(t, list(lowered), n=1, cutoff=0.6)
        if close:
            return lowered[close[0]]
    other = next((i for i, o in real if o.lower() in ("other", "others", "misc", "其他")), None)
    return other


def label_matches(label: str, wanted: list[str], field: str) -> bool:
    """复选框标签是否对应产品的某个取值（按整词匹配，避免 AI 命中 Email）。"""
    text = label.lower().strip()
    if not text:
        return False
    for w in wanted:
        terms = PLATFORM_ALIASES.get(w.lower(), (w.lower(),)) if field == "platforms" else (w.lower(),)
        for t in terms:
            if t and re.search(rf"(?<![a-z0-9]){re.escape(t)}(?![a-z0-9])", text):
                return True
    return False


def fit(candidates: list[str], maxlength: int | None) -> str:
    """取第一个不超长的候选；都超长时把最短的一个在句子或单词边界处截断。"""
    if not maxlength:
        return candidates[0]
    for c in candidates:
        if len(c) <= maxlength:
            return c
    text = candidates[-1][:maxlength]
    cut = max(text.rfind(". "), text.rfind("。"))
    if cut >= maxlength * 0.5:
        return text[: cut + 1]
    space = text.rfind(" ")
    return text[:space] if space >= maxlength * 0.6 else text


def twitter_handle(url: str) -> str:
    m = re.search(r"(?:twitter\.com|x\.com)/@?([A-Za-z0-9_]{1,15})", url)
    return f"@{m.group(1)}" if m else url


async def fill_field(
    page: Page,
    f: FormField,
    m: FieldMapping,
    product: Product,
    assets: dict[str, Path],
) -> FillResult | None:
    if m.field in ("skip", "unknown"):
        return None
    frame = page.frames[f.frame]
    loc: Locator = frame.locator(f'[data-al-idx="{f.idx}"]').first
    try:
        if f.type == "file":
            path = assets.get(m.field) or assets["logo"]
            await loc.set_input_files(path, timeout=TIMEOUT_MS)
            return FillResult(key=f.key, field=m.field, ok=True, detail=path.name)

        if f.type == "checkbox":
            if m.field != "consent":
                # 多选组（平台、分类标签等）：只勾选与产品匹配的项
                if not label_matches(f.label, product.choices_for(m.field), m.field):
                    return None
            try:
                await loc.check(timeout=TIMEOUT_MS)
            except Exception:
                await loc.evaluate("el => { if (!el.checked) el.click(); }")
            return FillResult(key=f.key, field=m.field, ok=True, detail=f.label[:40])

        if f.type in ("select", "radio"):
            hint = next(iter(product.choices_for(m.field)), None) or product.value_for(m.field)
            i = best_option(f.options, m.option, hint)
            if i is None:
                return FillResult(key=f.key, field=m.field, ok=False, detail="no matching option")
            if f.type == "select":
                await loc.select_option(index=i, timeout=TIMEOUT_MS)
            else:
                radio = frame.locator(f'[data-al-idx="{f.idx}:{i}"]').first
                try:
                    await radio.check(timeout=TIMEOUT_MS)
                except Exception:
                    await radio.evaluate("el => el.click()")
            return FillResult(key=f.key, field=m.field, ok=True, detail=f.options[i])

        candidates = product.values_for(m.field, multiline=f.type in ("textarea", "richtext"))
        if not candidates:
            return FillResult(key=f.key, field=m.field, ok=False, detail="no product value")
        hint = " ".join([f.label, f.name, f.placeholder]).lower()
        if m.field == "twitter" and f.type != "url" and (f.placeholder.startswith("@") or re.search(r"handle|username", hint)):
            candidates = [twitter_handle(candidates[0])]
        value = fit(candidates, f.maxlength)
        await loc.fill(value, timeout=TIMEOUT_MS)
        return FillResult(key=f.key, field=m.field, ok=True, detail=f"{len(value)} chars")
    except Exception as exc:  # 单个字段失败不影响其他字段
        return FillResult(key=f.key, field=m.field, ok=False, detail=type(exc).__name__ + ": " + str(exc).splitlines()[0][:160])
