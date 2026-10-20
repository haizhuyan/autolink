from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from ..config import get_settings
from ..deps import DB, CurrentUser, audit
from ..models import User
from ..schemas import LoginIn, LoginOut, UserOut
from ..security import aware, hash_password, issue_token, needs_rehash, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

INVALID = "邮箱或密码错误"


@router.post("/login", response_model=LoginOut)
def login(body: LoginIn, db: DB) -> LoginOut:
    s = get_settings()
    now = datetime.now(UTC)
    user = db.scalar(select(User).where(User.email == body.email.strip().lower()))

    locked = user is not None and (aware(user.locked_until) or now) > now
    ok = verify_password(user.password_hash if user else None, body.password)

    if user is None or user.status != "active":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID)
    if locked:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "尝试次数过多，请稍后再试")
    if not ok:
        user.failed_logins += 1
        if user.failed_logins >= s.max_failed_logins:
            user.locked_until = now + timedelta(minutes=s.lock_minutes)
            user.failed_logins = 0
            audit(db, None, "user.locked", "user", user.id)
        db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID)

    user.failed_logins = 0
    user.locked_until = None
    user.last_login_at = now
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(body.password)
    db.commit()

    token, exp = issue_token(user.id, user.token_version)
    return LoginOut(token=token, expires_at=exp, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> User:
    return user
