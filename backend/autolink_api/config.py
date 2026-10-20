"""运行配置：读取环境变量（可放在 backend/.env）。"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

BACKEND = Path(__file__).resolve().parent.parent
ROOT = BACKEND.parent

load_dotenv(BACKEND / ".env")


@dataclass(frozen=True)
class Settings:
    database_url: str
    api_secret: str
    products_dir: Path
    seed_sites: Path
    token_ttl_hours: int
    max_failed_logins: int
    lock_minutes: int


@lru_cache
def get_settings() -> Settings:
    secret = os.environ.get("API_SECRET", "")
    if len(secret) < 32:
        raise RuntimeError("API_SECRET 未配置或长度不足 32 个字符（见 backend/.env.example）")
    default_db = ROOT / "data" / "private" / "autolink.db"
    return Settings(
        database_url=os.environ.get("DATABASE_URL") or f"sqlite:///{default_db.as_posix()}",
        api_secret=secret,
        products_dir=Path(os.environ.get("PRODUCTS_DIR") or ROOT / "data" / "private" / "products"),
        seed_sites=ROOT / "data" / "seed" / "sites.csv",
        token_ttl_hours=int(os.environ.get("TOKEN_TTL_HOURS", "168")),
        max_failed_logins=5,
        lock_minutes=15,
    )


# 套餐允许的产品数，与 web/src/lib/plans.ts 一致（PRD 第 5 章）
PLAN_PRODUCTS = {"free": 1, "basic": 1, "pro": 3, "max": 5}
