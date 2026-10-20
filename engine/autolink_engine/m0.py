"""M0 技术验证：抽样站点 → 找提交页 → 识别表单 → dry-run 填表（绝不提交）→ 统计。

用法（在仓库根目录）：
    python -m engine.autolink_engine.m0 sample [--n 25] [--seed 7]
    python -m engine.autolink_engine.m0 run [--product <id|path>] [--limit N] [--domain a.com,b.com] [--headed] [--concurrency 3] [--no-llm] [--channel msedge] [--session google]
    python -m engine.autolink_engine.m0 report <run 目录>

--product 读取 web 端保存的 data/private/products/<id>/product.json 及其 Logo / 截图；
省略时使用 engine/fixtures/product.json 和纯色占位图。
submit_mode=manual 的头部平台（Product Hunt 等）不自动处理，结果记为 manual_only。

输出：
    data/m0/sample.csv                       抽样站点（来自公开种子库，可提交）
    data/private/m0/<时间>/results.jsonl     每站点详细结果（字段、映射、填充、成本）
    data/private/m0/<时间>/summary.csv       汇总表
    data/private/m0/<时间>/screens/*.png     填表后的整页截图
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import json
import random
import re
import sys
import time
from collections import Counter
from datetime import datetime
from pathlib import Path

import httpx
from dotenv import load_dotenv
from playwright.async_api import BrowserContext, async_playwright

from . import llm
from .fill import fill_field, write_png
from .mapping import map_field, pick_target_form
from .models import FieldMapping, Product, SiteResult
from .perceive import click_submit_button, find_submit_link, scan_page
from .safety import guard_route, url_is_allowed

ROOT = Path(__file__).resolve().parents[2]
ENGINE = ROOT / "engine"
SEED = ROOT / "data" / "seed" / "sites.csv"
SAMPLE = ROOT / "data" / "m0" / "sample.csv"
RUNS = ROOT / "data" / "private" / "m0"
PRODUCTS = ROOT / "data" / "private" / "products"
ASSET_EXTS = (".png", ".jpg", ".jpeg", ".webp")
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
LOGIN_URL = ("login", "signin", "sign-in", "sign_in", "auth", "register", "signup")
LLM_THRESHOLD = 0.7


# ---------- 抽样 ----------


def cmd_sample(n: int, seed: int) -> None:
    rows = [r for r in csv.DictReader(SEED.open(encoding="utf-8-sig")) if r.get("submit_mode") != "manual"]
    rng = random.Random(seed)
    strata = [
        ("google_login", lambda r: r["login_method"] == "google", 4),
        ("email_login", lambda r: r["login_method"] == "email_password", 4),
        ("backlink", lambda r: r["requires_backlink"] == "true", 4),
        ("launch", lambda r: r["supports_launch"] == "true", 4),
        ("needs_review", lambda r: r["status"] == "needs_review", 2),
        ("known_submit_path", lambda r: r["submit_url"].rstrip("/").count("/") > 2, 4),
        ("homepage_only", lambda r: True, max(0, n - 22)),
    ]
    picked: dict[str, tuple[dict, str]] = {}
    for name, pred, k in strata:
        pool = [r for r in rows if pred(r) and r["domain"] not in picked]
        for r in rng.sample(pool, min(k, len(pool))):
            picked[r["domain"]] = (r, name)
    SAMPLE.parent.mkdir(parents=True, exist_ok=True)
    with SAMPLE.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["domain", "submit_url", "stratum", "login_method", "requires_backlink", "supports_launch"])
        for r, name in picked.values():
            w.writerow([r["domain"], r["submit_url"], name, r["login_method"], r["requires_backlink"], r["supports_launch"]])
    print(f"sampled {len(picked)} sites -> {SAMPLE.relative_to(ROOT)}")
    for name, k in Counter(s for _, s in picked.values()).items():
        print(f"  {name:<18} {k}")


# ---------- 单站点探测 ----------


async def settle(page) -> None:
    try:
        await page.wait_for_load_state("networkidle", timeout=6000)
    except Exception:
        pass
    await page.wait_for_timeout(800)


async def probe_site(
    context: BrowserContext,
    domain: str,
    start_url: str,
    product: Product,
    assets: dict[str, Path],
    http: httpx.AsyncClient | None,
    screens: Path,
) -> SiteResult:
    res = SiteResult(domain=domain, start_url=start_url)
    t0 = time.monotonic()
    page = await context.new_page()
    try:
        if not await url_is_allowed(start_url):
            res.outcome, res.error = "blocked", "non-public address"
            return res

        url, visited, target, scan = start_url, set[str](), [], None
        for hop in range(3):
            visited.add(url)
            resp = await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            await settle(page)
            scan = await scan_page(page)
            if scan.challenge:
                res.outcome, res.error = "blocked", "bot challenge"
                break
            if resp is not None and resp.status >= 400:
                home = f"https://{domain.split('/')[0]}"
                if resp.status in (404, 410) and hop == 0 and url.rstrip("/") != home:
                    url = home
                    continue
                blocked = resp.status in (401, 403, 429, 503)
                res.outcome, res.error = ("blocked" if blocked else "unreachable"), f"HTTP {resp.status}"
                break
            target = pick_target_form(scan.fields)
            if target:
                break
            nxt = find_submit_link(scan.links, page.url, visited) or await click_submit_button(page, visited)
            if not nxt:
                break
            url, res.hops = nxt, hop + 1

        res.final_url = page.url
        if scan is not None:
            res.captcha, res.has_password, res.oauth = scan.captcha, scan.has_password, scan.oauth
            res.embedded_form = scan.embedded_form
        if res.outcome in ("blocked", "unreachable"):
            return res
        if not target:
            login_wall = (scan and (scan.has_password or scan.oauth)) or any(k in page.url.lower() for k in LOGIN_URL)
            res.outcome = "login_required" if login_wall else "no_form"
            return res

        res.fields = target
        res.fields_total = len(target)
        res.required_total = sum(f.required for f in target)

        mappings: dict[str, FieldMapping] = {f.key: map_field(f) for f in target}
        if http is not None and any(m.confidence < LLM_THRESHOLD for m in mappings.values()):
            usage = llm.LlmUsage()
            try:
                hint = {
                    "name": product.name,
                    "category": product.category,
                    "keywords": product.keywords[:5],
                    "pricing": product.pricing,
                    "platforms": product.platforms,
                    "country": product.country,
                }
                for m in await llm.map_fields(http, target, hint, page.url, usage):
                    if m.confidence >= mappings[m.key].confidence or mappings[m.key].field == "unknown":
                        mappings[m.key] = m
            except Exception as exc:
                res.error = f"llm: {type(exc).__name__}: {exc}"[:200]
            res.llm_calls, res.llm_tokens, res.llm_cost_usd = usage.calls, usage.tokens, usage.cost_usd
        res.mappings = list(mappings.values())
        res.mapped_rule = sum(m.source == "rule" and m.field != "unknown" for m in res.mappings)
        res.mapped_llm = sum(m.source == "llm" and m.field != "unknown" for m in res.mappings)

        filled_ok: set[str] = set()
        filled_fields: set[str] = set()
        for f in target:
            r = await fill_field(page, f, mappings[f.key], product, assets)
            if r is None:
                continue
            if r.ok:
                filled_ok.add(f.key)
                filled_fields.add(r.field)
            else:
                res.fill_errors.append(f"{r.field}: {r.detail}")
        res.filled = len(filled_ok)
        res.required_unfilled = [
            f"{mappings[f.key].field}({f.label or f.name or f.key})"[:80] for f in target if f.required and f.key not in filled_ok
        ]
        # 只收网址的表单（如 twelve.tools）没有名称字段，此时填好网址即可
        has_name = any(m.field == "name" for m in mappings.values())
        core = "url" in filled_fields and ("name" in filled_fields or not has_name)
        if core and not res.required_unfilled:
            res.outcome = "ready_captcha" if res.captcha else "ready"
        else:
            res.outcome = "partial"

        shot = screens / f"{domain}.png"
        await page.screenshot(path=shot, full_page=True, timeout=15000)
        res.screenshot = str(shot.relative_to(ROOT))
        return res
    except Exception as exc:
        res.outcome = "unreachable" if "net::" in str(exc) or "Timeout" in type(exc).__name__ else "error"
        res.error = f"{type(exc).__name__}: {str(exc).splitlines()[0]}"[:240]
        return res
    finally:
        if not res.screenshot and res.final_url:
            shot = screens / f"{domain.replace('/', '_')}.png"
            try:
                await page.screenshot(path=shot, timeout=10000)
                res.screenshot = str(shot.relative_to(ROOT))
            except Exception:
                pass
        res.seconds = round(time.monotonic() - t0, 1)
        await page.close()


# ---------- 批量运行 ----------


def load_product(ref: str | None, run_dir: Path) -> tuple[Product, dict[str, Path]]:
    """读取产品档案与素材；ref 可以是产品 id、产品目录或 product.json 路径。"""
    if ref is None:
        path = ENGINE / "fixtures" / "product.json"
    else:
        p = Path(ref)
        if p.is_dir():
            path = p / "product.json"
        elif p.suffix == ".json":
            path = p
        elif re.fullmatch(r"[a-z0-9][a-z0-9-]{0,39}", ref):
            path = PRODUCTS / ref / "product.json"
        else:
            sys.exit(f"无效的 --product：{ref}")
    if not path.is_file():
        sys.exit(f"找不到产品档案：{path}（先在控制台 /dashboard/products/new 保存）")
    product = Product.model_validate_json(path.read_text(encoding="utf-8"))

    assets: dict[str, Path] = {}
    for key in ("logo", "screenshot"):
        name = getattr(product, key)
        f = path.parent / name if name else None
        if f and f.suffix.lower() in ASSET_EXTS and f.is_file() and f.resolve().parent == path.parent.resolve():
            assets[key] = f
    if "logo" not in assets:
        assets["logo"] = write_png(run_dir / "logo.png", 256, 256, (37, 99, 235))
    if "screenshot" not in assets:
        assets["screenshot"] = write_png(run_dir / "screenshot.png", 1280, 800, (241, 245, 249))
    return product, assets


def select_rows(domains: str | None, limit: int | None) -> list[dict]:
    seed = {r["domain"]: r for r in csv.DictReader(SEED.open(encoding="utf-8-sig"))}
    if domains:
        rows = []
        for d in (x.strip().lower() for x in domains.split(",")):
            d = re.sub(r"^https?://(www\.)?", "", d).rstrip("/")
            if d:
                rows.append(seed.get(d) or {"domain": d, "submit_url": f"https://{d}"})
    else:
        rows = [seed.get(r["domain"], r) for r in csv.DictReader(SAMPLE.open(encoding="utf-8-sig"))]
    return rows[:limit] if limit else rows


async def cmd_run(
    limit: int | None,
    domain: str | None,
    headed: bool,
    concurrency: int,
    use_llm: bool,
    channel: str | None,
    session: str | None = None,
    product_ref: str | None = None,
) -> Path:
    load_dotenv(ENGINE / ".env")
    rows = select_rows(domain, limit)

    run_dir = RUNS / datetime.now().strftime("%Y%m%d-%H%M%S")
    screens = run_dir / "screens"
    screens.mkdir(parents=True, exist_ok=True)
    product, assets = load_product(product_ref, run_dir)
    llm_on = use_llm and llm.is_configured()
    print(f"product={product.id or product.name} assets={','.join(p.name for p in assets.values())}")
    print(f"sites={len(rows)} llm={llm.describe() if llm_on else 'off'} out={run_dir.relative_to(ROOT)}")
    if session:
        n_states = len(list((ROOT / "data" / "private" / "sessions" / session).glob("*.json")))
        print(f"session={session}: {n_states} site session(s)" + ("（为空，请先运行 google_login sites）" if not n_states else ""))

    sem = asyncio.Semaphore(concurrency)
    results: list[SiteResult] = []
    async with async_playwright() as pw, httpx.AsyncClient() as http:
        browser = await pw.chromium.launch(headless=not headed, channel=channel)

        async def one(row: dict) -> None:
            if row.get("submit_mode") == "manual":
                # 头部平台人工精发，不访问、不填表
                r = SiteResult(domain=row["domain"], start_url=row["submit_url"], outcome="manual_only", error="head platform: submit manually")
                results.append(r)
                print(f"  {r.outcome:<15} {r.domain:<28} {r.error}")
                return
            async with sem:
                state = ROOT / "data" / "private" / "sessions" / (session or "") / f"{row['domain'].replace('/', '_')}.json"
                use_state = bool(session) and state.exists()
                context = await browser.new_context(
                    user_agent=USER_AGENT,
                    viewport={"width": 1366, "height": 900},
                    locale="en-US",
                    storage_state=state if use_state else None,
                )
                await context.route("**/*", guard_route)
                try:
                    r = await asyncio.wait_for(
                        probe_site(context, row["domain"], row["submit_url"], product, assets, http if llm_on else None, screens),
                        timeout=120,
                    )
                except TimeoutError:
                    r = SiteResult(domain=row["domain"], start_url=row["submit_url"], outcome="unreachable", error="site timeout 120s")
                finally:
                    await context.close()
                r.session = use_state
                results.append(r)
                print(f"  {r.outcome:<15} {r.domain:<28} fields={r.fields_total:<3} filled={r.filled:<3} {r.seconds:>5}s {r.error[:60]}")

        await asyncio.gather(*(one(r) for r in rows))
        await browser.close()

    with (run_dir / "results.jsonl").open("w", encoding="utf-8") as fh:
        for r in sorted(results, key=lambda x: x.domain):
            fh.write(r.model_dump_json() + "\n")
    summarize(run_dir)
    return run_dir


# ---------- 汇总 ----------

SUMMARY_COLS = [
    "domain", "outcome", "session", "hops", "final_url", "fields_total", "required_total", "mapped_rule", "mapped_llm",
    "filled", "required_unfilled", "captcha", "oauth", "embedded_form", "llm_cost_usd", "seconds", "error",
]


def summarize(run_dir: Path) -> None:
    results = [SiteResult.model_validate_json(line) for line in (run_dir / "results.jsonl").read_text(encoding="utf-8").splitlines() if line]
    with (run_dir / "summary.csv").open("w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=SUMMARY_COLS)
        w.writeheader()
        for r in results:
            d = r.model_dump(include=set(SUMMARY_COLS))
            d["required_unfilled"] = "; ".join(r.required_unfilled)
            d["oauth"] = ",".join(r.oauth)
            w.writerow(d)

    n = len(results) or 1
    counts = Counter(r.outcome for r in results)
    reached = [r for r in results if r.fields_total]
    auto = counts["ready"] + counts["ready_captcha"]
    n_auto = len(results) - counts["manual_only"]
    print("\n== M0 summary ==")
    for k, v in counts.most_common():
        print(f"  {k:<15} {v:>3}  {v / n:6.1%}")
    print(f"  form reached         {len(reached)}/{n_auto}")
    print(f"  fully fillable       {auto}/{n_auto} ({auto / max(1, n_auto):.1%}); captcha among them: {counts['ready_captcha']}")
    if reached:
        fields = sum(r.fields_total for r in reached)
        print(f"  field mapping        rule {sum(r.mapped_rule for r in reached)}/{fields}, llm {sum(r.mapped_llm for r in reached)}/{fields}")
        print(f"  fill success         {sum(r.filled for r in reached)}/{fields} controls")
    cost = sum(r.llm_cost_usd for r in results)
    calls = sum(r.llm_calls for r in results)
    print(f"  llm                  calls={calls} tokens={sum(r.llm_tokens for r in results)} cost=${cost:.4f} (${cost / max(1, len(reached)):.4f}/form)")
    print(f"  avg time             {sum(r.seconds for r in results) / n:.1f}s/site")
    print(f"  details              {(run_dir / 'summary.csv').relative_to(ROOT)}")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    ap = argparse.ArgumentParser(prog="m0")
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("sample")
    s.add_argument("--n", type=int, default=25)
    s.add_argument("--seed", type=int, default=7)
    r = sub.add_parser("run")
    r.add_argument("--product", help="产品 id（data/private/products/<id>/）或 product.json 路径；默认用测试样例")
    r.add_argument("--limit", type=int)
    r.add_argument("--domain", help="只跑指定站点，逗号分隔；不在抽样中的站点会从种子库查提交地址")
    r.add_argument("--headed", action="store_true")
    r.add_argument("--concurrency", type=int, default=3)
    r.add_argument("--no-llm", action="store_true")
    r.add_argument("--channel", help="使用本机浏览器：msedge / chrome；默认 Playwright 自带 Chromium")
    r.add_argument("--session", help="加载 data/private/sessions/<名称>/ 下的站点会话，如 google")
    p = sub.add_parser("report")
    p.add_argument("run_dir", type=Path)
    args = ap.parse_args()

    if args.cmd == "sample":
        cmd_sample(args.n, args.seed)
    elif args.cmd == "run":
        asyncio.run(
            cmd_run(
                args.limit, args.domain, args.headed, args.concurrency, not args.no_llm, args.channel, args.session, args.product
            )
        )
    else:
        summarize(args.run_dir)


if __name__ == "__main__":
    main()
