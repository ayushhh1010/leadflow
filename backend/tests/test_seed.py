from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from app import seed as seed_module
from app.models import Discussion, DiscussionKind, Lead, LeadStatus
from app.seed import seed


def follow_ups(db: Session) -> list[datetime]:
    return [lead.follow_up_at for lead in db.scalars(select(Lead)) if lead.follow_up_at]


def test_seed_covers_every_status_with_discussions(db: Session) -> None:
    count = seed(db, datetime(2026, 5, 6, 12, 0, tzinfo=UTC))

    leads = db.scalars(select(Lead)).all()
    assert count == len(leads) >= 5
    assert {lead.status for lead in leads} == set(LeadStatus)
    with_notes = [
        lead for lead in leads if any(d.kind == DiscussionKind.NOTE for d in lead.discussions)
    ]
    assert len(with_notes) >= 5


@pytest.mark.parametrize("hour, minute", [(0, 1), (12, 0), (23, 59)])
def test_seed_always_has_today_overdue_and_upcoming_follow_ups(
    db: Session, hour: int, minute: int
) -> None:
    now = datetime(2026, 5, 6, hour, minute, tzinfo=UTC)

    seed(db, now)

    dates = follow_ups(db)
    assert sum(at.date() == now.date() for at in dates) == 2
    assert any(at < now - timedelta(days=1) for at in dates)
    assert any(at > now + timedelta(days=1) for at in dates)


def test_cli_seeds_only_an_empty_database(
    session_factory: sessionmaker[Session], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(seed_module, "SessionLocal", session_factory)

    seed_module.main([])
    seed_module.main([])

    with session_factory() as db:
        assert db.scalar(select(func.count(Lead.id))) == len(
            seed_module.demo_leads(datetime.now(UTC))
        )


def test_cli_reset_replaces_existing_leads(
    session_factory: sessionmaker[Session], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(seed_module, "SessionLocal", session_factory)
    with session_factory() as db:
        db.add(Lead(name="Keep me?", discussions=[Discussion(body="old note")]))
        db.commit()

    seed_module.main(["--reset"])

    with session_factory() as db:
        names = db.scalars(select(Lead.name)).all()
        assert "Keep me?" not in names
        old_notes = select(func.count(Discussion.id)).where(Discussion.body == "old note")
        assert db.scalar(old_notes) == 0
