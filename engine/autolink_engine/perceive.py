"""页面感知（E-6）：抽取精简表单结构、登录/验证码信号，并寻找提交页入口。"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from urllib.parse import urlsplit

from playwright.async_api import Frame, Page

from .models import FormField

EXTRACT_JS = r"""
() => {
  const clean = (t) => (t || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const labelOf = (el) => {
    const parts = [];
    if (el.labels) for (const l of el.labels) parts.push(l.innerText);
    const al = el.getAttribute('aria-label');
    if (al) parts.push(al);
    const lb = el.getAttribute('aria-labelledby');
    if (lb) for (const id of lb.split(/\s+/)) { const n = document.getElementById(id); if (n) parts.push(n.innerText); }
    let p = el.parentElement;
    for (let i = 0; i < 3 && p && !parts.length; i++, p = p.parentElement) {
      const t = clean(p.innerText);
      if (t && t.length <= 120) parts.push(t);
    }
    return clean(parts.join(' '));
  };
  const groupLabel = (el) => {
    const g = el.closest('fieldset,[role=radiogroup]');
    if (!g) return '';
    const lg = g.querySelector('legend');
    return clean((lg && lg.innerText) || g.getAttribute('aria-label') || '');
  };
  const forms = Array.from(document.forms);
  const formOf = (el) => { const f = el.form || el.closest('form'); return f ? forms.indexOf(f) : -1; };
  const out = [];
  const radios = new Map();
  let idx = 0;
  const els = document.querySelectorAll('input, textarea, select, [contenteditable="true"], [contenteditable=""]');
  for (const el of els) {
    if (out.length >= 80) break;
    const tag = el.tagName.toLowerCase();
    const type = tag === 'input' ? (el.getAttribute('type') || 'text').toLowerCase()
      : tag === 'textarea' ? 'textarea' : tag === 'select' ? 'select' : 'richtext';
    if (['hidden', 'submit', 'button', 'image', 'reset', 'search', 'range', 'color'].includes(type)) continue;
    if (el.disabled || el.readOnly) continue;
    if (!['file', 'checkbox', 'radio'].includes(type) && !visible(el)) continue;
    const form = formOf(el);
    if (type === 'radio') {
      const key = (el.name || '') + '|' + form;
      const optLabel = labelOf(el) || el.value;
      if (radios.has(key)) {
        const f = radios.get(key);
        el.setAttribute('data-al-idx', f.idx + ':' + f.options.length);
        f.options.push(optLabel);
        continue;
      }
      const f = { idx, tag, type, name: el.name || '', id: el.id || '', label: groupLabel(el) || el.name || '',
        placeholder: '', required: el.required, options: [optLabel], form, accept: '', maxlength: null };
      el.setAttribute('data-al-idx', idx + ':0');
      radios.set(key, f); out.push(f); idx++;
      continue;
    }
    el.setAttribute('data-al-idx', String(idx));
    const f = { idx, tag, type, name: el.getAttribute('name') || '', id: el.id || '', label: labelOf(el),
      placeholder: clean(el.getAttribute('placeholder')),
      required: !!(el.required || el.getAttribute('aria-required') === 'true'),
      options: tag === 'select' ? Array.from(el.options).map(o => clean(o.text)).slice(0, 60) : [],
      form, accept: el.getAttribute('accept') || '', maxlength: el.maxLength > 0 ? el.maxLength : null };
    out.push(f); idx++;
  }
  const text = document.body ? document.body.innerText.slice(0, 3000).toLowerCase() : '';
  const clickable = Array.from(document.querySelectorAll('a,button,[role=button]'));
  const oauth = new Set();
  for (const e of clickable) {
    const t = clean(e.innerText || e.getAttribute('aria-label')).toLowerCase();
    const m = t.match(/(?:sign in|log in|login|continue|sign up|register)\s+(?:with|using|via)\s+(google|github|twitter|x|linkedin|apple|microsoft)/);
    if (m) oauth.add(m[1]);
  }
  const links = Array.from(document.querySelectorAll('a[href]')).slice(0, 600)
    .map(a => ({ text: clean(a.innerText || a.getAttribute('aria-label')), href: a.href }))
    .filter(l => /^https?:/.test(l.href));
  return {
    fields: out,
    captcha: !!document.querySelector('iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="challenges.cloudflare.com"], .g-recaptcha, .h-captcha, .cf-turnstile, [data-sitekey]'),
    hasPassword: !!document.querySelector('input[type=password]'),
    oauth: Array.from(oauth),
    links,
    challenge: /just a moment|checking your browser|verify you are human|attention required/.test(text.slice(0, 600)),
  };
}
"""

EMBED_PROVIDERS = {
    "tally.so": "tally",
    "typeform.com": "typeform",
    "docs.google.com": "google_forms",
    "forms.gle": "google_forms",
    "airtable.com": "airtable",
    "fillout.com": "fillout",
    "jotform.com": "jotform",
    "notion.so": "notion",
}

SUBMIT_TEXT = re.compile(
    r"\bsubmit\b|add (?:your |a |new )?(?:tool|product|startup|site|app|listing|project|ai|saas|business)"
    r"|list (?:your|my)|get listed|get featured|post (?:a |your )?(?:tool|startup|product|project)"
    r"|suggest (?:a )?(?:tool|site|product)|launch (?:your|a)|add listing|提交|收录",
    re.I,
)
SUBMIT_HREF = re.compile(r"/(submit|add|suggest|launch|list|get-listed|new)[-_/]?", re.I)
AVOID_HREF = re.compile(r"login|signin|sign-in|auth|privacy|terms|blog/|mailto:|/tag/|/category/", re.I)


@dataclass
class PageScan:
    fields: list[FormField] = field(default_factory=list)
    captcha: bool = False
    has_password: bool = False
    oauth: list[str] = field(default_factory=list)
    links: list[dict] = field(default_factory=list)
    challenge: bool = False
    embedded_form: str = ""


def provider_of(url: str) -> str:
    host = (urlsplit(url).hostname or "").lower()
    for suffix, name in EMBED_PROVIDERS.items():
        if host == suffix or host.endswith("." + suffix):
            return name
    return ""


async def scan_page(page: Page) -> PageScan:
    scan = PageScan()
    for fi, frame in enumerate(page.frames):
        if fi > 0 and not frame.url.startswith("http"):
            continue
        data = await _evaluate(frame)
        if data is None:
            continue
        scan.fields += [FormField(frame=fi, **f) for f in data["fields"]]
        scan.captcha |= data["captcha"]
        scan.has_password |= data["hasPassword"]
        scan.oauth = sorted(set(scan.oauth) | set(data["oauth"]))
        if fi == 0:
            scan.links = data["links"]
            scan.challenge = data["challenge"]
        elif not scan.embedded_form:
            scan.embedded_form = provider_of(frame.url)
    return scan


async def _evaluate(frame: Frame) -> dict | None:
    try:
        return await frame.evaluate(EXTRACT_JS)
    except Exception:  # 跨域 iframe 已分离或脚本被拦截
        return None


def _same_site(a: str, b: str) -> bool:
    ha = (urlsplit(a).hostname or "").removeprefix("www.")
    hb = (urlsplit(b).hostname or "").removeprefix("www.")
    return ha == hb or ha.endswith("." + hb) or hb.endswith("." + ha)


async def click_submit_button(page: Page, visited: set[str]) -> str | None:
    """提交入口是 <button>（无 href）时：点击表单外的提交按钮，若跳转到新的同站页面则返回新 URL。"""
    before = page.url
    buttons = page.locator("button:not(form button)").filter(has_text=SUBMIT_TEXT)
    for i in range(min(await buttons.count(), 4)):
        btn = buttons.nth(i)
        try:
            if not await btn.is_visible():
                continue
            await btn.click(timeout=5000)
            await page.wait_for_url(lambda u: u != before, timeout=5000)
        except Exception:
            continue
        new = page.url.split("#")[0]
        if new not in visited and _same_site(new, before) and not AVOID_HREF.search(new):
            return new
        return None
    return None


def find_submit_link(links: list[dict], current_url: str, visited: set[str]) -> str | None:
    """按链接文字与路径打分，返回最可能的提交页。允许跳到常见表单托管服务。"""
    best: tuple[int, str] | None = None
    for link in links:
        href = link["href"].split("#")[0]
        if not href or href in visited or AVOID_HREF.search(href):
            continue
        if not (_same_site(href, current_url) or provider_of(href)):
            continue
        score = 0
        if SUBMIT_TEXT.search(link["text"]):
            score += 3
        if SUBMIT_HREF.search(urlsplit(href).path):
            score += 2
        if provider_of(href):
            score += 1
        if score >= 2 and (best is None or score > best[0]):
            best = (score, href)
    return best[1] if best else None
