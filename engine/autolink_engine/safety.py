"""SSRF 防护：Worker 只允许访问公网地址（PRD 4.5）。"""

from __future__ import annotations

import asyncio
import ipaddress
import socket
from urllib.parse import urlsplit

from playwright.async_api import Request, Route

_cache: dict[str, bool] = {}


def _ip_is_public(ip: str) -> bool:
    addr = ipaddress.ip_address(ip)
    return addr.is_global and not addr.is_multicast


async def host_is_public(host: str) -> bool:
    host = host.strip("[]").lower()
    if host in _cache:
        return _cache[host]
    if host == "localhost" or host.endswith((".localhost", ".local", ".internal")):
        _cache[host] = False
        return False
    try:
        ok = _ip_is_public(host)
    except ValueError:
        try:
            infos = await asyncio.get_running_loop().getaddrinfo(host, None, type=socket.SOCK_STREAM)
        except OSError:
            infos = []
        # 任一解析结果指向内网即拒绝，防止 DNS 混合解析绕过
        ok = bool(infos) and all(_ip_is_public(str(info[4][0])) for info in infos)
    _cache[host] = ok
    return ok


async def url_is_allowed(url: str) -> bool:
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https") or not parts.hostname:
        return False
    return await host_is_public(parts.hostname)


async def guard_hosts(route: Route, request: Request) -> None:
    """只拦截内网地址；用于需要真实 POST 回调的登录流程。"""
    if request.url.startswith(("data:", "blob:")) or await url_is_allowed(request.url):
        await route.continue_()
    else:
        await route.abort("blockedbyclient")


async def guard_route(route: Route, request: Request) -> None:
    """拦截内网请求；dry-run 下拦截原生表单 POST 导航（即真实提交）。"""
    url = request.url
    if url.startswith(("data:", "blob:")):
        await route.continue_()
        return
    if not await url_is_allowed(url):
        await route.abort("blockedbyclient")
        return
    if request.resource_type in ("media", "font"):
        await route.abort("blockedbyclient")
        return
    if request.is_navigation_request() and request.method != "GET":
        await route.abort("blockedbyclient")
        return
    await route.continue_()
