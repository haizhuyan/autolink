from __future__ import annotations

from fastapi import FastAPI

from .config import get_settings
from .routers import admin, auth, products, sites

get_settings()  # 启动时校验配置（缺少 API_SECRET 直接报错）

app = FastAPI(title="AutoLink API", version="0.1.0", docs_url="/docs", redoc_url=None)

for r in (auth.router, sites.router, products.router, admin.router):
    app.include_router(r)


@app.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok"}
