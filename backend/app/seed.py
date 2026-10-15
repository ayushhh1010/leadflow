"""Load demo leads so a fresh install has something to show.

    python -m app.seed           # only when the database has no leads yet
    python -m app.seed --reset   # delete every lead, then load the demo data

Times are relative to when the script runs, in the machine's local timezone, so
there is always something due today, something overdue and something upcoming.
"""

import argparse
from collections.abc import Sequence
from datetime import datetime, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from .db import SessionLocal
from .models import Discussion, DiscussionKind, Lead, LeadStatus


def _note(at: datetime, body: str, follow_up_at: datetime | None = None) -> Discussion:
    return Discussion(kind=DiscussionKind.NOTE, body=body, created_at=at, follow_up_at=follow_up_at)


def _event(at: datetime, body: str) -> Discussion:
    return Discussion(kind=DiscussionKind.EVENT, body=body, created_at=at)


def demo_leads(now: datetime) -> list[Lead]:
    day = now.replace(hour=0, minute=0, second=0, microsecond=0)

    def ago(days: float = 0, hours: float = 0) -> datetime:
        return now - timedelta(days=days, hours=hours)

    def on(days_from_today: int, hour: int) -> datetime:
        return day + timedelta(days=days_from_today, hours=hour)

    # Clamped to today's date so the "today" demo follow-ups exist at any time of day.
    later_today = min(now + timedelta(hours=2), day + timedelta(hours=23, minutes=55))
    earlier_today = max(now - timedelta(hours=2), day + timedelta(minutes=5))
    overdue = ago(days=1, hours=2)

    return [
        Lead(
            name="Sarah Connor",
            company="Acme Corp",
            phone="555-0199",
            status=LeadStatus.PROPOSAL_SENT,
            follow_up_at=later_today,
            created_at=ago(days=6),
            discussions=[
                _event(ago(days=6), "Lead created via web form."),
                _note(
                    ago(days=5),
                    "Initial discovery call. They need a CRM for 50 reps. Pain points include "
                    "dropping leads and no follow-up tracking.",
                ),
                _event(ago(days=2, hours=0.2), "Status changed from Qualified to Proposal Sent"),
                _note(
                    ago(days=2),
                    "Sent pricing tier PDF. Said she would review with her boss.",
                    later_today,
                ),
            ],
        ),
        Lead(
            name="Ellen Ripley",
            company="Weyland-Yutani",
            phone="555-0426",
            status=LeadStatus.CONTACTED,
            follow_up_at=earlier_today,
            created_at=ago(days=3),
            discussions=[
                _event(ago(days=3), "Lead created from a trade-show badge scan."),
                _note(
                    ago(days=1),
                    "Asked for a quick callback today to go over onboarding for her team of 8.",
                    earlier_today,
                ),
            ],
        ),
        Lead(
            name="Gavin Belson",
            company="Hooli",
            phone="555-0187",
            status=LeadStatus.QUALIFIED,
            follow_up_at=overdue,
            created_at=ago(days=9),
            discussions=[
                _event(ago(days=9), "Lead created via referral from Globex."),
                _note(
                    ago(days=6),
                    "Demo went well. Their security team wants to review SSO and "
                    "data-retention docs before moving forward.",
                ),
                _event(ago(days=6, hours=-0.1), "Status changed from Contacted to Qualified"),
                _note(
                    ago(days=4),
                    "Sent the security questionnaire. Promised to chase for answers.",
                    overdue,
                ),
            ],
        ),
        Lead(
            name="Hank Scorpio",
            company="Globex",
            phone="555-0142",
            status=LeadStatus.NEW,
            created_at=ago(hours=3),
            discussions=[
                _event(ago(hours=3), "Lead created via web form."),
                _note(ago(hours=2), "Inbound lead from website contact form."),
            ],
        ),
        Lead(
            name="Leslie Knope",
            company="Pawnee Parks Dept",
            status=LeadStatus.NEW,
            created_at=ago(hours=0.5),
            discussions=[_event(ago(hours=0.5), "Lead created")],
        ),
        Lead(
            name="Bill Lumbergh",
            company="Initech",
            phone="555-0101",
            status=LeadStatus.CONTACTED,
            follow_up_at=on(3, 10),
            created_at=ago(days=10),
            discussions=[
                _event(ago(days=10), "Lead created from a cold-call list."),
                _note(ago(days=8), "Sent intro email with two customer case studies."),
                _event(ago(days=7, hours=0.1), "Status changed from New to Contacted"),
                _note(ago(days=7), "Left a voicemail with his assistant.", on(3, 10)),
            ],
        ),
        Lead(
            name="Tony Stark",
            company="Stark Industries",
            phone="555-0100",
            status=LeadStatus.QUALIFIED,
            follow_up_at=on(6, 15),
            created_at=ago(days=4),
            discussions=[
                _event(ago(days=4), "Lead created via partner referral."),
                _note(
                    ago(days=3),
                    "Budget approved for Q1. Wants a tailored proposal before the board meeting.",
                    on(6, 15),
                ),
            ],
        ),
        Lead(
            name="Bruce Wayne",
            company="Wayne Ent",
            phone="555-0007",
            status=LeadStatus.WON,
            created_at=ago(days=40),
            discussions=[
                _event(ago(days=40), "Lead created at a business expo."),
                _note(ago(days=30), "Discovery call with procurement. Needs 200 seats."),
                _note(ago(days=22), "Negotiated a three-year term with annual billing."),
                _event(ago(days=21, hours=0.1), "Status changed from Proposal Sent to Won"),
                _note(ago(days=21), "Contract signed! Sending welcome package."),
            ],
        ),
        Lead(
            name="Michael Scott",
            company="Dunder Mifflin",
            phone="555-0110",
            status=LeadStatus.LOST,
            created_at=ago(days=30),
            discussions=[
                _event(ago(days=30), "Lead created via web form."),
                _note(ago(days=20), "Pitched the team plan; loved the demo."),
                _event(ago(days=12, hours=0.1), "Status changed from Proposal Sent to Lost"),
                _note(ago(days=12), "Went with a competitor on price. Revisit next fiscal year."),
            ],
        ),
    ]


def seed(db: Session, now: datetime | None = None) -> int:
    leads = demo_leads(now or datetime.now().astimezone())
    db.add_all(leads)
    db.commit()
    return len(leads)


def main(argv: Sequence[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Load LeadFlow demo data.")
    parser.add_argument(
        "--reset", action="store_true", help="delete every lead first, then load the demo data"
    )
    args = parser.parse_args(argv)

    with SessionLocal() as db:
        if args.reset:
            db.execute(delete(Discussion))
            db.execute(delete(Lead))
        elif db.scalar(select(func.count(Lead.id))):
            print("Leads already exist; nothing seeded (use --reset to replace them).")
            return
        count = seed(db)
    print(f"Seeded {count} demo leads.")


if __name__ == "__main__":
    main()
