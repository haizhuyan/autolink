from __future__ import annotations

from logging.config import fileConfig

from alembic import context

from backend.autolink_api.db import get_engine
from backend.autolink_api.models import Base

config = context.config
if config.config_file_name is not None and config.attributes.get("configure_logger", True):
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=str(get_engine().url),
        target_metadata=target_metadata,
        literal_binds=True,
        render_as_batch=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def _online() -> None:
    connection = config.attributes.get("connection")
    if connection is None:
        with get_engine().connect() as connection:
            _run(connection)
    else:
        _run(connection)


def _run(connection) -> None:  # type: ignore[no-untyped-def]
    # SQLite 不支持大多数 ALTER，用 batch 模式生成迁移
    context.configure(connection=connection, target_metadata=target_metadata, render_as_batch=True, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    _online()
