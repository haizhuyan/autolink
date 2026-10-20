"""login methods: google / email_password / none

Revision ID: 3b7c1e2a9f10
Revises: dd03dc609b77
Create Date: 2026-10-21 10:00:00

"""
from typing import Sequence, Union

from alembic import op


revision: str = '3b7c1e2a9f10'
down_revision: Union[str, Sequence[str], None] = 'dd03dc609b77'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE sites SET login_method = 'email_password' WHERE login_method = 'email_code'")
    op.execute("UPDATE sites SET login_method = 'none' WHERE login_method NOT IN ('google', 'email_password')")


def downgrade() -> None:
    op.execute("UPDATE sites SET login_method = 'unknown' WHERE login_method = 'none'")
