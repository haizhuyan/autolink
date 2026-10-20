"""Google 一键登录：用户在独立浏览器 Profile 中手动登录一次 Google，
引擎复用该会话点击各站点的 “Continue with Google”，完成 OAuth 后保存站点会话。

安全约束：
- 引擎从不接触 Google 密码；遇到密码 / 二次验证 / 未登录页面即停止，交给用户。
- 授权页若请求姓名、邮箱、头像以外的权限，或应用未经 Google 验证，停止并标记 consent_review。
- Profile 与站点会话都在 data/private/（gitignored）；会话文件只保留目标站点自己的 cookie 和 localStorage。

用法（仓库根目录）：
    python -m engine.autolink_engine.google_login setup               # 打开浏览器 → 手动登录 Google → 关闭窗口
    python -m engine.autolink_engine.google_login status
    python -m engine.autolink_engine.google_login sites [--domain x.com ...] [--from-run <m0 目录>] [--account you@gmail.com]
    之后：python -m engine.autolink_engine.m0 run --session google     # m0 带着站点会话重跑
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import json
import os
import re
import socket
import subprocess
import sys
import time
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from urllib.parse import urlsplit

from playwright.async_api import Browser, Locator, Page, async_playwright

from .m0 import ROOT, RUNS, SEED, settle
from .perceive import _same_site, find_submit_link, scan_page
from .safety import guard_hosts, url_is_allowed

PROFILES = ROOT / "data" / "private" / "profiles"
SESSIONS = ROOT / "data" / "private" / "sessions"

GOOGLE_BTN = re.compile(
    r"(continue|sign\s?in|log\s?in|login|sign\s?up|register|connect|join)\s+(with|using|via|through)\s+google"
    r"|^\s*google\s*$|使用\s*google|google\s*(账号)?登录",
    re.I,
)
LOGIN_TEXT = re.compile(r"^\s*(log\s?in|sign\s?in|sign\s?up|login|register|get started|account|登录|注册)\s*$", re.I)
LOGIN_HREF = re.compile(r"login|signin|sign-in|sign_in|/auth\b|register|signup|sign-up", re.I)
CONSENT_BTN = re.compile(r"^\s*(continue|allow|confirm|继续|允许|确认)\s*$", re.I)
# 超出基础资料（姓名 / 邮箱 / 头像 / 语言）的授权，一律交给用户判断
SENSITIVE = re.compile(
    r"google drive|gmail|calendar|contacts|youtube|google photos|see, edit|edit, create|delete|send email|manage your"
    r"|hasn.t verified|unverified|云端硬盘|日历|通讯录|删除|未经.{0,4}验证",
    re.I,
)
EMAIL = re.compile(r"[\w.+-]+@[\w-]+(\.[\w-]+)+")


# ---------- 浏览器 ----------


def find_browser(override: str | None) -> Path:
    if override:
        return Path(override)
    pf = os.environ.get("ProgramFiles", r"C:\Program Files")
    pf86 = os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")
    local = os.environ.get("LOCALAPPDATA", "")
    for p in (
        Path(pf) / "Google/Chrome/Application/chrome.exe",
        Path(pf86) / "Google/Chrome/Application/chrome.exe",
        Path(local) / "Google/Chrome/Application/chrome.exe",
        Path(pf86) / "Microsoft/Edge/Application/msedge.exe",
        Path(pf) / "Microsoft/Edge/Application/msedge.exe",
    ):
        if p.exists():
            return p
    sys.exit("未找到 Chrome / Edge，请用 --browser 指定可执行文件路径")


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@asynccontextmanager
async def open_profile(pw, exe: Path, profile_dir: Path, headless: bool):
    """以普通进程启动真实浏览器（非自动化启动，Google 不会拒绝），再通过本地 CDP 端口接管。"""
    port = _free_port()
    args = [
        str(exe),
        f"--user-data-dir={profile_dir}",
        f"--remote-debugging-port={port}",
        "--no-first-run",
        "--no-default-browser-check",
        "about:blank",
    ]
    if headless:
        args.insert(1, "--headless=new")
    proc = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    browser: Browser | None = None
    try:
        for _ in range(40):
            try:
                browser = await pw.chromium.connect_over_cdp(f"http://127.0.0.1:{port}")
                break
            except Exception:
                if proc.poll() is not None:
                    break
                await asyncio.sleep(0.5)
        if browser is None:
            sys.exit("无法连接浏览器：请先关闭用这个 Profile 打开的浏览器窗口后重试")
        yield browser
    finally:
        if browser is not None:
            try:  # 正常关闭，让 Google cookie 轮换结果落盘
                cdp = await browser.new_browser_cdp_session()
                await cdp.send("Browser.close")
            except Exception:
                pass
        try:
            proc.wait(timeout=15)
        except subprocess.TimeoutExpired:
            proc.terminate()


async def google_signed_in(browser: Browser) -> bool:
    cookies = await browser.contexts[0].cookies("https://accounts.google.com")
    return any(c["name"] in ("SID", "__Secure-1PSID") for c in cookies)


# ---------- setup / status ----------


def cmd_setup(profile: str, exe: Path) -> None:
    pdir = PROFILES / profile
    pdir.mkdir(parents=True, exist_ok=True)
    print(f"浏览器：{exe}\nProfile：{pdir.relative_to(ROOT)}")
    print("请在打开的窗口中登录你的 Google 账号（含二次验证），完成后关闭整个浏览器窗口。")
    subprocess.Popen(
        [str(exe), f"--user-data-dir={pdir}", "--no-first-run", "--no-default-browser-check", "https://accounts.google.com/"]
    ).wait()
    asyncio.run(cmd_status(profile, exe))


async def cmd_status(profile: str, exe: Path) -> None:
    pdir = PROFILES / profile
    if not pdir.exists():
        sys.exit(f"Profile {profile} 不存在，先运行 setup")
    async with async_playwright() as pw, open_profile(pw, exe, pdir, headless=True) as browser:
        ok = await google_signed_in(browser)
    sessions = sorted(p.stem for p in (SESSIONS / profile).glob("*.json"))
    print(f"Google 登录：{'已登录' if ok else '未登录（重新运行 setup）'}")
    print(f"站点会话：{len(sessions)} 个 {', '.join(sessions)}")


# ---------- 站点登录 ----------


async def _visible_first(loc: Locator, limit: int = 6) -> Locator | None:
    for i in range(min(await loc.count(), limit)):
        el = loc.nth(i)
        try:
            if await el.is_visible():
                return el
        except Exception:
            continue
    return None


async def find_google_button(page: Page) -> Locator | None:
    for role in ("button", "link"):
        el = await _visible_first(page.get_by_role(role, name=GOOGLE_BTN))  # type: ignore[arg-type]
        if el:
            return el
    for frame in page.frames:  # Google Identity Services 渲染在 iframe 里的按钮
        if "accounts.google.com/gsi/button" in frame.url:
            el = await _visible_first(frame.locator("div[role=button]"))
            if el:
                return el
    return None


def _login_link(links: list[dict], current: str, visited: set[str]) -> str | None:
    for link in links:
        href = link["href"].split("#")[0]
        if href in visited or not _same_site(href, current):
            continue
        if LOGIN_TEXT.search(link["text"]) or LOGIN_HREF.search(urlsplit(href).path):
            return href
    return None


async def reach_google_button(page: Page, start_url: str) -> Locator | None:
    """首页 → 提交页 / 登录页（最多 4 跳），找到 Google 登录按钮。"""
    url, visited = start_url, set[str]()
    for _ in range(4):
        visited.add(url)
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await settle(page)
        if btn := await find_google_button(page):
            return btn
        # 登录入口可能是弹窗按钮
        opener = await _visible_first(page.get_by_role("button", name=LOGIN_TEXT))
        if opener:
            try:
                await opener.click(timeout=5000)
                await page.wait_for_timeout(1500)
            except Exception:
                pass
            if _is_google(page.url):
                return None
            if btn := await find_google_button(page):
                return btn
        scan = await scan_page(page)
        nxt = find_submit_link(scan.links, page.url, visited) or _login_link(scan.links, page.url, visited)
        if not nxt:
            return None
        url = nxt
    return None


def _is_google(url: str) -> bool:
    host = (urlsplit(url).hostname or "").lower()
    return host == "accounts.google.com" or host.endswith(".accounts.google.com")


async def _visible(loc: Locator) -> bool:
    try:
        return await loc.count() > 0 and await loc.first.is_visible()
    except Exception:
        return False


async def run_oauth(page: Page, account: str | None) -> str:
    """点击后处理 Google 页面：选择账号 → 同意基础授权。返回空串表示流程走完。"""
    context = page.context
    gpage: Page | None = None
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline and gpage is None:
        gpage = next((p for p in context.pages if _is_google(p.url)), None)
        if gpage is None:
            await asyncio.sleep(0.5)
    if gpage is None:
        return ""  # 之前授权过，或 One Tap 直接完成

    for _ in range(10):
        if gpage.is_closed() or not _is_google(gpage.url):
            return ""
        try:
            await gpage.wait_for_load_state("domcontentloaded", timeout=10000)
        except Exception:
            pass
        await gpage.wait_for_timeout(1500)
        if gpage.is_closed() or not _is_google(gpage.url):
            return ""
        if "/challenge/" in gpage.url or await _visible(gpage.locator("input[type=password]")):
            return "google_reauth"
        if "/signin/identifier" in gpage.url or await _visible(gpage.locator("input[type=email]")):
            return "google_signed_out"
        # 同意页左上角也有账号切换控件，所以先看是否有“继续/允许”按钮
        btn = await _visible_first(gpage.get_by_role("button", name=CONSENT_BTN))
        if btn:
            body = EMAIL.sub(" ", await gpage.locator("body").inner_text())  # 邮箱里的 gmail 不算敏感授权
            if SENSITIVE.search(body) or await _visible(gpage.locator("input[type=checkbox]")):
                return "consent_review"
            await btn.click(timeout=5000)
            continue
        sel = f'[data-identifier="{account}"]' if account else "[data-identifier], [data-email]"
        if await _visible(gpage.locator(sel)):
            await gpage.locator(sel).first.click(timeout=5000)
            continue
    return "google_stuck"


async def save_session(page: Page, domain: str, out: Path) -> int:
    state = await page.context.storage_state()
    site = f"https://{domain.split('/')[0]}"
    cookies = [c for c in state["cookies"] if _same_site(f"https://{c['domain'].lstrip('.')}", site)]
    origins = [o for o in state["origins"] if _same_site(o["origin"], site)]
    out.write_text(json.dumps({"cookies": cookies, "origins": origins}, ensure_ascii=False), encoding="utf-8")
    return len(cookies)


async def login_site(browser: Browser, domain: str, start_url: str, account: str | None, out_dir: Path) -> dict:
    res = {"domain": domain, "start_url": start_url, "outcome": "error", "final_url": "", "detail": "", "seconds": 0.0}
    t0 = time.monotonic()
    page = await browser.contexts[0].new_page()
    try:
        if not await url_is_allowed(start_url):
            res["outcome"], res["detail"] = "blocked", "non-public address"
            return res
        btn = await reach_google_button(page, start_url)
        if btn is None and not _is_google(page.url):  # 部分站点的 “Sign in” 直接跳转 Google
            res["outcome"] = "no_google_button"
            return res
        if btn is not None:
            try:
                await btn.click(timeout=5000)
            except Exception:  # 被遮罩层挡住时退回 JS 点击
                await btn.evaluate("el => el.click()")
        stop = await run_oauth(page, account)
        if stop:
            res["outcome"] = stop
            return res
        # 等待回到站点（弹窗关闭后原页面通常会刷新或跳转）
        for _ in range(30):
            if not _is_google(page.url):
                break
            await page.wait_for_timeout(500)
        await settle(page)
        still = await find_google_button(page)
        if still or _is_google(page.url) or await _visible(page.locator("input[type=password]")):
            res["outcome"] = "not_confirmed"
            return res
        n = await save_session(page, domain, out_dir / f"{domain.replace('/', '_')}.json")
        res["outcome"], res["detail"] = "logged_in", f"{n} cookies"
        return res
    except Exception as exc:
        res["detail"] = f"{type(exc).__name__}: {str(exc).splitlines()[0]}"[:200]
        return res
    finally:
        res["final_url"] = page.url
        shot = out_dir / "screens" / f"{domain.replace('/', '_')}.png"
        try:
            await page.screenshot(path=shot, timeout=10000)
        except Exception:
            pass
        res["seconds"] = round(time.monotonic() - t0, 1)
        await page.close()


def pick_targets(domains: list[str] | None, from_run: Path | None) -> list[tuple[str, str]]:
    """默认目标：汇总所有 m0 运行（同一站点以最近一次为准），取需要登录 / 出现 Google 按钮的站点。"""
    seed = {r["domain"]: r["submit_url"] for r in csv.DictReader(SEED.open(encoding="utf-8-sig"))}
    if domains:
        return [(d, seed.get(d, f"https://{d}")) for d in domains]
    runs = [from_run] if from_run else sorted(p for p in RUNS.iterdir() if (p / "results.jsonl").exists())
    latest: dict[str, dict] = {}
    for run in runs:
        for line in (run / "results.jsonl").read_text(encoding="utf-8").splitlines():
            if line:
                r = json.loads(line)
                latest[r["domain"]] = r
    targets = {
        d: r["start_url"] for d, r in sorted(latest.items()) if "google" in r["oauth"] or r["outcome"] == "login_required"
    }
    print(f"targets from {len(runs)} run(s): {len(targets)}")
    return list(targets.items())


async def cmd_sites(profile: str, exe: Path, targets: list[tuple[str, str]], account: str | None, headless: bool) -> None:
    pdir = PROFILES / profile
    if not pdir.exists():
        sys.exit(f"Profile {profile} 不存在，先运行 setup")
    out_dir = SESSIONS / profile
    (out_dir / "screens").mkdir(parents=True, exist_ok=True)
    results = []
    async with async_playwright() as pw, open_profile(pw, exe, pdir, headless) as browser:
        if not await google_signed_in(browser):
            sys.exit("Profile 中未登录 Google，先运行 setup")
        await browser.contexts[0].route("**/*", guard_hosts)
        for domain, url in targets:
            try:
                r = await asyncio.wait_for(login_site(browser, domain, url, account, out_dir), timeout=120)
            except TimeoutError:
                r = {"domain": domain, "start_url": url, "outcome": "timeout", "final_url": "", "detail": "", "seconds": 120}
            results.append(r)
            print(f"  {r['outcome']:<18} {domain:<26} {r['seconds']:>5}s {r['detail'][:70]}", flush=True)

    stamp = datetime.now().isoformat(timespec="seconds")
    with (out_dir / "results.jsonl").open("a", encoding="utf-8") as fh:
        for r in results:
            fh.write(json.dumps({**r, "at": stamp}, ensure_ascii=False) + "\n")
    ok = sum(r["outcome"] == "logged_in" for r in results)
    print(f"\nlogged in {ok}/{len(results)}；会话保存在 {out_dir.relative_to(ROOT)}")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    ap = argparse.ArgumentParser(prog="google_login")
    ap.add_argument("--profile", default="google")
    ap.add_argument("--browser", help="Chrome / Edge 可执行文件路径，默认自动查找")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("setup")
    sub.add_parser("status")
    s = sub.add_parser("sites")
    s.add_argument("--domain", action="append")
    s.add_argument("--from-run", type=Path)
    s.add_argument("--account", help="Google 账号邮箱；Profile 里有多个账号时用于选择")
    s.add_argument("--headless", action="store_true")
    args = ap.parse_args()

    exe = find_browser(args.browser)
    if args.cmd == "setup":
        cmd_setup(args.profile, exe)
    elif args.cmd == "status":
        asyncio.run(cmd_status(args.profile, exe))
    else:
        targets = pick_targets(args.domain, args.from_run)
        asyncio.run(cmd_sites(args.profile, exe, targets, args.account, args.headless))


if __name__ == "__main__":
    main()
