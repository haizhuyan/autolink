from __future__ import annotations

import os
import tempfile
from collections.abc import Iterator
from pathlib import Path

import pytest

# 必须在导入应用前设置：测试使用临时数据库和临时产品目录
_tmp = Path(tempfile.mkdtemp(prefix="autolink-test-"))
os.environ["API_SECRET"] = "test-secret-" + "x" * 40
os.environ["DATABASE_URL"] = f"sqlite:///{(_tmp / 'test.db').as_posix()}"
os.environ["PRODUCTS_DIR"] = str(_tmp / "products")

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import delete  # noqa: E402

from backend.autolink_api import cli  # noqa: E402
from backend.autolink_api.db import session_factory  # noqa: E402
from backend.autolink_api.main import app  # noqa: E402
from backend.autolink_api.models import AuditLog, Product, Site, User  # noqa: E402
from backend.autolink_api.security import hash_password  # noqa: E402

PASSWORD = "correct-horse-battery"


@pytest.fixture(scope="session", autouse=True)
def _schema() -> None:
    cli.migrate()


@pytest.fixture(autouse=True)
def _clean() -> Iterator[None]:
    yield
    with session_factory()() as db:
        for model in (AuditLog, Product, Site, User):
            db.execute(delete(model))
        db.commit()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def products_dir() -> Path:
    return _tmp / "products"


def make_user(email: str = "user@example.com", role: str = "user", plan: str = "free") -> User:
    with session_factory()() as db:
        user = User(email=email, password_hash=hash_password(PASSWORD), role=role, plan_id=plan)
        db.add(user)
        db.commit()
        return user


def login(client: TestClient, email: str) -> dict[str, str]:
    r = client.post("/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}
