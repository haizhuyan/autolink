from __future__ import annotations

from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from .config import get_settings

_hasher = PasswordHasher()
# 用户不存在时也做一次校验，避免通过响应时间探测邮箱是否注册
_DUMMY_HASH = _hasher.hash("autolink-dummy-password")

PASSWORD_MIN = 10
PASSWORD_MAX = 128


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    try:
        return _hasher.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
    except (VerificationError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)


def aware(dt: datetime | None) -> datetime | None:
    """SQLite 读出的时间不带时区，统一按 UTC 处理。"""
    if dt is None or dt.tzinfo is not None:
        return dt
    return dt.replace(tzinfo=UTC)


def issue_token(user_id: int, token_version: int) -> tuple[str, datetime]:
    s = get_settings()
    now = datetime.now(UTC)
    exp = now + timedelta(hours=s.token_ttl_hours)
    token = jwt.encode({"sub": str(user_id), "tv": token_version, "iat": now, "exp": exp}, s.api_secret, "HS256")
    return token, exp


def read_token(token: str) -> tuple[int, int] | None:
    try:
        payload = jwt.decode(token, get_settings().api_secret, algorithms=["HS256"], options={"require": ["sub", "exp"]})
        return int(payload["sub"]), int(payload.get("tv", -1))
    except (jwt.PyJWTError, ValueError, TypeError):
        return None
