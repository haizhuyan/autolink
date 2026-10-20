from __future__ import annotations

from typing import Annotated, Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .db import get_db
from .models import AuditLog, User
from .security import read_token

_bearer = HTTPBearer(auto_error=False)

DB = Annotated[Session, Depends(get_db)]


def get_current_user(
    db: DB, cred: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)]
) -> User:
    unauthorized = HTTPException(status.HTTP_401_UNAUTHORIZED, "未登录或登录已过期", {"WWW-Authenticate": "Bearer"})
    if cred is None:
        raise unauthorized
    parsed = read_token(cred.credentials)
    if parsed is None:
        raise unauthorized
    user = db.get(User, parsed[0])
    if user is None or user.status != "active" or user.token_version != parsed[1]:
        raise unauthorized
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_admin(user: CurrentUser) -> User:
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "需要管理员权限")
    return user


AdminUser = Annotated[User, Depends(require_admin)]


def audit(db: Session, actor: User | None, action: str, target_type: str, target_id: Any, **detail: Any) -> None:
    db.add(
        AuditLog(
            actor_id=actor.id if actor else None,
            action=action,
            target_type=target_type,
            target_id=str(target_id),
            detail=detail,
        )
    )
