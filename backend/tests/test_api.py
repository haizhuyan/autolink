from __future__ import annotations

import json

from conftest import PASSWORD, login, make_user
from fastapi.testclient import TestClient

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64

PRODUCT = {
    "name": "Test Product",
    "url": "https://example.com",
    "tagline": "A tagline",
    "summary": "A summary",
    "category": "Productivity",
    "keywords": ["a", "b"],
    "features": ["one", "two"],
    "pricing": "Freemium",
    "platforms": ["Web", "Web", "API"],
    "contactEmail": "Founder@Example.com",
    "twitter": "",
}


# ---------- 认证 ----------


def test_login_and_me(client: TestClient) -> None:
    make_user()
    headers = login(client, "USER@example.com ")
    r = client.get("/auth/me", headers=headers)
    assert r.status_code == 200
    assert r.json()["email"] == "user@example.com"
    assert r.json()["planId"] == "free"


def test_login_failure_is_generic(client: TestClient) -> None:
    make_user()
    a = client.post("/auth/login", json={"email": "user@example.com", "password": "wrong-password"})
    b = client.post("/auth/login", json={"email": "nobody@example.com", "password": "wrong-password"})
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json()


def test_lockout_after_failures(client: TestClient) -> None:
    make_user()
    for _ in range(5):
        client.post("/auth/login", json={"email": "user@example.com", "password": "wrong-password"})
    r = client.post("/auth/login", json={"email": "user@example.com", "password": PASSWORD})
    assert r.status_code == 429


def test_bad_token_rejected(client: TestClient) -> None:
    assert client.get("/auth/me").status_code == 401
    assert client.get("/auth/me", headers={"Authorization": "Bearer nope"}).status_code == 401


# ---------- 产品 ----------


def _create(client: TestClient, headers: dict[str, str], body: dict | None = None, **files: bytes):
    return client.post(
        "/products",
        headers=headers,
        data={"data": json.dumps(body or PRODUCT)},
        files={k: (f"{k}.bin", v, "application/octet-stream") for k, v in files.items()},
    )


def test_product_crud_and_mirror(client: TestClient, products_dir) -> None:
    make_user()
    headers = login(client, "user@example.com")
    r = _create(client, headers, logo=PNG)
    assert r.status_code == 201, r.text
    p = r.json()
    assert p["id"] == "test-product"
    assert p["platforms"] == ["Web", "API"]
    assert p["contactEmail"] == "founder@example.com"
    assert p["logo"] == "logo.png"

    mirror = json.loads((products_dir / "test-product" / "product.json").read_text("utf-8"))
    assert mirror["name"] == "Test Product" and mirror["logo"] == "logo.png" and "createdAt" in mirror
    assert (products_dir / "test-product" / "logo.png").read_bytes() == PNG

    r = client.put("/products/test-product", headers=headers, data={"data": json.dumps(PRODUCT | {"name": "Renamed"})})
    assert r.status_code == 200
    assert r.json()["name"] == "Renamed" and r.json()["logo"] == "logo.png"
    assert [x["id"] for x in client.get("/products", headers=headers).json()] == ["test-product"]


def test_product_validation(client: TestClient) -> None:
    make_user(plan="pro")
    headers = login(client, "user@example.com")
    assert _create(client, headers, PRODUCT | {"url": "javascript:alert(1)"}).status_code == 422
    assert _create(client, headers, PRODUCT | {"pricing": "Gratis"}).status_code == 422
    assert _create(client, headers, PRODUCT | {"keywords": ["k"] * 11}).status_code == 422
    assert _create(client, headers, logo=b"GIF89a....").status_code == 422
    assert _create(client, headers, screenshot=PNG + b"\x00" * (3 * 1024 * 1024)).status_code == 422


def test_plan_limit(client: TestClient) -> None:
    make_user(plan="free")
    headers = login(client, "user@example.com")
    assert _create(client, headers).status_code == 201
    assert _create(client, headers).status_code == 409


def test_products_are_private(client: TestClient) -> None:
    make_user("a@example.com")
    make_user("b@example.com")
    pid = _create(client, login(client, "a@example.com")).json()["id"]
    other = login(client, "b@example.com")
    assert client.get(f"/products/{pid}", headers=other).status_code == 404
    assert client.put(f"/products/{pid}", headers=other, data={"data": json.dumps(PRODUCT)}).status_code == 404
    assert client.get("/products", headers=other).json() == []


def test_product_submissions_listed(client: TestClient) -> None:
    from backend.autolink_api.db import session_factory
    from backend.autolink_api.models import Site, Submission

    make_user()
    headers = login(client, "user@example.com")
    pid = _create(client, headers).json()["id"]
    with session_factory()() as db:
        site = Site(domain="b-dir.com", submit_url="https://b-dir.com")
        other = Site(domain="a-dir.com", submit_url="https://a-dir.com")
        db.add_all([site, other])
        db.flush()
        db.add_all([
            Submission(product_id=pid, site_id=site.id, status="needs_manual", note="captcha"),
            Submission(product_id=pid, site_id=other.id, status="listed"),
        ])
        db.commit()
    r = client.get("/products", headers=headers)
    assert r.status_code == 200, r.text
    subs = r.json()[0]["submissions"]
    assert [(s["domain"], s["status"]) for s in subs] == [("a-dir.com", "listed"), ("b-dir.com", "needs_manual")]
    assert client.get(f"/products/{pid}", headers=headers).json()["submissions"][1]["note"] == "captcha"


# ---------- 后台 ----------


def test_admin_requires_admin(client: TestClient) -> None:
    make_user()
    headers = login(client, "user@example.com")
    for path in ("/admin/stats", "/admin/users", "/admin/sites", "/admin/products", "/admin/audit"):
        assert client.get(path, headers=headers).status_code == 403
    assert client.get("/admin/stats").status_code == 401


def test_admin_sites(client: TestClient) -> None:
    make_user("admin@example.com", role="admin")
    headers = login(client, "admin@example.com")
    body = {"domain": "https://www.Example-Dir.com/", "submitUrl": "https://example-dir.com/submit"}
    r = client.post("/admin/sites", headers=headers, json=body)
    assert r.status_code == 201, r.text
    site = r.json()
    assert site["domain"] == "example-dir.com"
    assert client.post("/admin/sites", headers=headers, json=body).status_code == 409

    public = client.get("/sites/example-dir.com")
    assert public.status_code == 200 and "adminNote" not in public.json()
    r = client.patch(f"/admin/sites/{site['id']}", headers=headers, json={"status": "blacklisted", "adminNote": "spam"})
    assert r.json()["status"] == "blacklisted"
    # 黑名单站点从公开站点库消失
    assert client.get("/sites/example-dir.com").status_code == 404
    assert all(s["domain"] != "example-dir.com" for s in client.get("/sites").json())

    page = client.get("/admin/sites", headers=headers, params={"status": "blacklisted"}).json()
    assert page["total"] == 1
    actions = [a["action"] for a in client.get("/admin/audit", headers=headers).json()["items"]]
    assert {"site.create", "site.update"} <= set(actions)


def test_admin_site_edit_and_delete(client: TestClient) -> None:
    make_user("admin@example.com", role="admin")
    headers = login(client, "admin@example.com")
    # 提交页地址留空时使用 https://域名
    a = client.post("/admin/sites", headers=headers, json={"domain": "a-dir.com", "loginMethod": "google"}).json()
    assert a["submitUrl"] == "https://a-dir.com" and a["loginMethod"] == "google"
    b = client.post("/admin/sites", headers=headers, json={"domain": "b-dir.com"}).json()
    assert b["loginMethod"] == "none"
    assert client.post("/admin/sites", headers=headers, json={"domain": "c.com", "loginMethod": "email_code"}).status_code == 422

    # 可以修改域名，但不能与已有站点重复
    assert client.patch(f"/admin/sites/{b['id']}", headers=headers, json={"domain": "a-dir.com"}).status_code == 409
    r = client.patch(f"/admin/sites/{b['id']}", headers=headers, json={"domain": "www.b2-dir.com", "submitUrl": ""})
    assert r.status_code == 200
    assert r.json()["domain"] == "b2-dir.com" and r.json()["submitUrl"] == "https://b2-dir.com"

    assert client.delete(f"/admin/sites/{b['id']}", headers=headers).status_code == 204
    assert client.get(f"/admin/sites/{b['id']}", headers=headers).status_code == 404
    assert client.delete(f"/admin/sites/{b['id']}", headers=headers).status_code == 404
    assert [s["domain"] for s in client.get("/admin/sites", headers=headers).json()["items"]] == ["a-dir.com"]
    actions = [a["action"] for a in client.get("/admin/audit", headers=headers).json()["items"]]
    assert "site.delete" in actions

    make_user()
    assert client.delete(f"/admin/sites/{a['id']}", headers=login(client, "user@example.com")).status_code == 403


def test_admin_users(client: TestClient) -> None:
    admin = make_user("admin@example.com", role="admin")
    headers = login(client, "admin@example.com")
    r = client.post("/admin/users", headers=headers, json={"email": "New@Example.com", "password": "short"})
    assert r.status_code == 422
    r = client.post("/admin/users", headers=headers, json={"email": "New@Example.com", "password": PASSWORD, "planId": "pro"})
    assert r.status_code == 201
    uid = r.json()["id"]
    user_headers = login(client, "new@example.com")

    r = client.patch(f"/admin/users/{uid}", headers=headers, json={"status": "disabled"})
    assert r.json()["status"] == "disabled"
    # 停用后旧令牌立即失效
    assert client.get("/auth/me", headers=user_headers).status_code == 401

    assert client.patch(f"/admin/users/{admin.id}", headers=headers, json={"role": "user"}).status_code == 400
    page = client.get("/admin/users", headers=headers, params={"q": "new@"}).json()
    assert page["total"] == 1 and page["items"][0]["planId"] == "pro"
    assert client.get("/admin/stats", headers=headers).json()["users"] == {"active": 1, "disabled": 1}
