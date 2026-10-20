"""后端管理命令。在仓库根目录运行：python -m backend.autolink_api.cli <命令>

  migrate                                  建表 / 升级数据库到最新结构
  create-user --email E [--admin] [--plan P] [--name N]
                                           创建账号；密码交互输入，留空则随机生成并只显示一次
  set-password --email E                   重置密码
  seed-sites [--csv PATH]                  从 data/seed/sites.csv 导入或更新站点（按域名）
  import-products --email E                把 data/private/products/*/product.json 导入到该账号名下
"""

from __future__ import annotations

import argparse
import csv
import getpass
import json
import secrets
import sys
from datetime import datetime
from pathlib import Path

from alembic import command
from alembic.config import Config
from pydantic import ValidationError
from sqlalchemy import select

from .config import BACKEND, get_settings
from .db import session_factory
from .deps import audit
from .models import LOGIN_METHODS, PLANS, SITE_PRICING, SITE_STATUSES, SUBMIT_MODES, Product, Site, User
from .schemas import EMAIL_RE, ProductIn
from .security import PASSWORD_MAX, PASSWORD_MIN, hash_password
from .storage import PRODUCT_ID, write_mirror


def migrate() -> None:
    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.attributes["configure_logger"] = False
    command.upgrade(cfg, "head")
    print("数据库已是最新结构")


def _ask_password() -> tuple[str, bool]:
    if not sys.stdin.isatty():
        return secrets.token_urlsafe(18), True
    pw = getpass.getpass(f"密码（{PASSWORD_MIN}-{PASSWORD_MAX} 位，留空自动生成）：")
    if not pw:
        return secrets.token_urlsafe(18), True
    if not PASSWORD_MIN <= len(pw) <= PASSWORD_MAX:
        sys.exit(f"密码长度需在 {PASSWORD_MIN}-{PASSWORD_MAX} 之间")
    if getpass.getpass("再输入一次：") != pw:
        sys.exit("两次输入不一致")
    return pw, False


def _email(value: str) -> str:
    email = value.strip().lower()
    if not EMAIL_RE.match(email):
        sys.exit("邮箱格式不正确")
    return email


def create_user(email: str, admin: bool, plan: str, name: str) -> None:
    email = _email(email)
    with session_factory()() as db:
        if db.scalar(select(User).where(User.email == email)):
            sys.exit("该邮箱已存在；如需重置密码用 set-password")
        pw, generated = _ask_password()
        user = User(email=email, password_hash=hash_password(pw), name=name, role="admin" if admin else "user", plan_id=plan)
        db.add(user)
        db.flush()
        audit(db, None, "user.create", "user", user.id, email=email, role=user.role, via="cli")
        db.commit()
    print(f"已创建{'管理员' if admin else '用户'} {email}（套餐 {plan}）")
    if generated:
        print(f"初始密码（只显示这一次，请登录后修改）：{pw}")


def set_password(email: str) -> None:
    email = _email(email)
    with session_factory()() as db:
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            sys.exit("用户不存在")
        pw, generated = _ask_password()
        user.password_hash = hash_password(pw)
        user.token_version += 1
        user.failed_logins = 0
        user.locked_until = None
        audit(db, None, "user.update", "user", user.id, password="reset", via="cli")
        db.commit()
    print(f"已重置 {email} 的密码，旧登录全部失效")
    if generated:
        print(f"新密码（只显示这一次）：{pw}")


# 旧 CSV 中的登录方式取值
LEGACY_LOGIN = {"email_code": "email_password"}


def _pick(value: str, allowed: tuple[str, ...], fallback: str) -> str:
    return value if value in allowed else fallback


def seed_sites(path: Path) -> None:
    with path.open(encoding="utf-8-sig", newline="") as f:
        rows = [r for r in csv.DictReader(f) if (r.get("domain") or "").strip()]
    created = updated = 0
    with session_factory()() as db:
        existing = {s.domain: s for s in db.scalars(select(Site))}
        for r in rows:
            domain = r["domain"].strip().lower()
            url = (r.get("submit_url") or "").strip()
            values = {
                "name": (r.get("name") or "").strip()[:120],
                "submit_url": url if url.lower().startswith(("http://", "https://")) else f"https://{domain}",
                "category": (r.get("category") or "").strip()[:60],
                "pricing": _pick(r.get("pricing", ""), SITE_PRICING, "unknown"),
                "login_method": _pick(LEGACY_LOGIN.get(r.get("login_method", ""), r.get("login_method", "")), LOGIN_METHODS, "none"),
                "requires_backlink": r.get("requires_backlink") == "true",
                "requires_verification": r.get("requires_verification") == "true",
                "supports_launch": r.get("supports_launch") == "true",
                "review_time_hint": (r.get("review_time_hint") or "").strip()[:60],
                "problems": (r.get("problems") or "").strip()[:500],
                "submitted": int(r.get("submitted") or 0),
                "listed": int(r.get("listed") or 0),
                "in_review": int(r.get("in_review") or 0),
            }
            site = existing.get(domain)
            if site is None:
                db.add(
                    Site(
                        domain=domain,
                        submit_mode=_pick(r.get("submit_mode", ""), SUBMIT_MODES, "auto"),
                        status=_pick(r.get("status", ""), SITE_STATUSES, "active"),
                        **values,
                    )
                )
                created += 1
            else:
                # 后台可改的字段（状态、提交方式、备注）以数据库为准，不被种子覆盖
                for k, v in values.items():
                    setattr(site, k, v)
                updated += 1
        audit(db, None, "site.seed", "site", "*", created=created, updated=updated, source=path.name)
        db.commit()
    print(f"站点导入完成：新增 {created}，更新 {updated}")


def import_products(email: str) -> None:
    email = _email(email)
    root = get_settings().products_dir
    if not root.is_dir():
        sys.exit(f"目录不存在：{root}")
    imported = skipped = 0
    with session_factory()() as db:
        owner = db.scalar(select(User).where(User.email == email))
        if owner is None:
            sys.exit("用户不存在，先用 create-user 创建")
        for d in sorted(p for p in root.iterdir() if p.is_dir()):
            file = d / "product.json"
            if not PRODUCT_ID.match(d.name) or not file.is_file():
                continue
            existing = db.get(Product, d.name)
            if existing is not None:
                print(f"  跳过 {d.name}：已在数据库中（属于用户 {existing.owner_id}）")
                skipped += 1
                continue
            raw = json.loads(file.read_text(encoding="utf-8"))
            try:
                body = ProductIn.model_validate(raw)
            except ValidationError as e:
                print(f"  跳过 {d.name}：字段校验失败 {e.error_count()} 处")
                skipped += 1
                continue
            p = Product(id=d.name, owner_id=owner.id, **body.model_dump())
            for key in ("logo", "screenshot"):
                name = raw.get(key)
                if isinstance(name, str) and (d / name).is_file() and name.startswith(f"{key}."):
                    setattr(p, key, name)
            for key in ("createdAt", "updatedAt"):
                try:
                    setattr(p, "created_at" if key == "createdAt" else "updated_at", datetime.fromisoformat(raw[key]))
                except (KeyError, TypeError, ValueError):
                    pass
            db.add(p)
            db.flush()
            write_mirror(p)
            audit(db, None, "product.import", "product", p.id, owner=email, via="cli")
            imported += 1
        db.commit()
    print(f"产品导入完成：导入 {imported}，跳过 {skipped}（套餐上限不限制导入，请在后台核对）")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="python -m backend.autolink_api.cli", description="AutoLink 后端管理命令")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("migrate", help="建表 / 升级数据库")
    p = sub.add_parser("create-user", help="创建账号")
    p.add_argument("--email", required=True)
    p.add_argument("--admin", action="store_true", help="创建管理员")
    p.add_argument("--plan", choices=PLANS, default="free")
    p.add_argument("--name", default="")
    p = sub.add_parser("set-password", help="重置密码")
    p.add_argument("--email", required=True)
    p = sub.add_parser("seed-sites", help="导入种子站点")
    p.add_argument("--csv", type=Path, default=None)
    p = sub.add_parser("import-products", help="导入本地产品档案")
    p.add_argument("--email", required=True)
    args = parser.parse_args(argv)

    match args.cmd:
        case "migrate":
            migrate()
        case "create-user":
            create_user(args.email, args.admin, args.plan, args.name.strip()[:80])
        case "set-password":
            set_password(args.email)
        case "seed-sites":
            seed_sites(args.csv or get_settings().seed_sites)
        case "import-products":
            import_products(args.email)


if __name__ == "__main__":
    main()
