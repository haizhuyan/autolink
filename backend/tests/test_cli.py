from __future__ import annotations

from pathlib import Path

from sqlalchemy import select

from backend.autolink_api import cli
from backend.autolink_api.db import session_factory
from backend.autolink_api.models import Site

HEADER = "domain,name,submit_url,category,pricing,login_method,requires_backlink,requires_verification,supports_launch,review_time_hint,submit_mode,status,problems,sources,submitted,listed,in_review\n"


def test_seed_sites_upsert_keeps_admin_fields(tmp_path: Path) -> None:
    csv = tmp_path / "sites.csv"
    csv.write_text(
        HEADER
        + "a.com,A,https://a.com/submit,,paid,google,true,false,true,,auto,active,,x,3,2,0\n"
        + "b.com,,not-a-url,,bogus,bogus,false,false,false,,manual,needs_review,,x,0,0,0\n"
        + "c.com,,,,,email_code,false,false,false,,auto,active,,x,0,0,0\n",
        encoding="utf-8",
    )
    cli.seed_sites(csv)
    with session_factory()() as db:
        sites = {s.domain: s for s in db.scalars(select(Site))}
        assert sites["a.com"].pricing == "paid" and sites["a.com"].listed == 2
        assert sites["b.com"].submit_url == "https://b.com" and sites["b.com"].pricing == "unknown"
        assert sites["b.com"].submit_mode == "manual" and sites["b.com"].login_method == "none"
        assert sites["c.com"].login_method == "email_password"
        sites["a.com"].status = "blacklisted"
        db.commit()

    cli.seed_sites(csv)
    with session_factory()() as db:
        assert db.scalar(select(Site).where(Site.domain == "a.com")).status == "blacklisted"  # type: ignore[union-attr]
        assert len(db.scalars(select(Site)).all()) == 3
