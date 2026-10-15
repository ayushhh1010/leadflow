import enum
from datetime import UTC, datetime

from sqlalchemy import (
    DateTime,
    Dialect,
    Enum,
    ForeignKey,
    Index,
    ScalarSelect,
    String,
    Text,
    select,
)
from sqlalchemy.orm import (
    InstrumentedAttribute,
    Mapped,
    column_property,
    mapped_column,
    relationship,
)
from sqlalchemy.types import TypeDecorator

from .db import Base


def utcnow() -> datetime:
    return datetime.now(UTC)


class UTCDateTime(TypeDecorator[datetime]):
    """Timezone-aware timestamp stored in UTC.

    SQLite drops tzinfo, so it is re-attached on read; naive values are rejected outright
    because their meaning would depend on the server's clock.
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("Naive datetimes are not allowed; pass a timezone-aware value")
        return value.astimezone(UTC)

    def process_result_value(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        if value is None:
            return None
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


class LeadStatus(enum.StrEnum):
    NEW = "new"
    CONTACTED = "contacted"
    QUALIFIED = "qualified"
    PROPOSAL_SENT = "proposal_sent"
    WON = "won"
    LOST = "lost"

    @property
    def label(self) -> str:
        return self.value.replace("_", " ").title()


class DiscussionKind(enum.StrEnum):
    NOTE = "note"  # written by the sales rep
    EVENT = "event"  # recorded by the system: lead created, status changed, follow-up cleared


def _string_enum(enum_cls: type[enum.StrEnum], name: str) -> Enum:
    # VARCHAR + CHECK constraint (portable across SQLite/PostgreSQL), storing the enum values.
    return Enum(
        enum_cls,
        name=name,
        native_enum=False,
        create_constraint=True,
        length=20,
        values_callable=lambda members: [member.value for member in members],
        validate_strings=True,
    )


class Discussion(Base):
    __tablename__ = "discussions"
    __table_args__ = (Index("ix_discussions_lead_id_created_at", "lead_id", "created_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id", ondelete="CASCADE"))
    kind: Mapped[DiscussionKind] = mapped_column(
        _string_enum(DiscussionKind, "discussion_kind"), default=DiscussionKind.NOTE
    )
    body: Mapped[str] = mapped_column(Text)
    follow_up_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    lead: Mapped["Lead"] = relationship(back_populates="discussions")


def _latest_note[T](column: InstrumentedAttribute[T], lead_id: Mapped[int]) -> ScalarSelect[T]:
    return (
        select(column)
        .where(Discussion.lead_id == lead_id, Discussion.kind == DiscussionKind.NOTE)
        .order_by(Discussion.created_at.desc(), Discussion.id.desc())
        .limit(1)
        .correlate_except(Discussion)
        .scalar_subquery()
    )


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    company: Mapped[str | None] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(40))
    status: Mapped[LeadStatus] = mapped_column(
        _string_enum(LeadStatus, "lead_status"), default=LeadStatus.NEW, index=True
    )
    follow_up_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    # Loaded in the same SELECT as the lead, so listing leads stays a single query.
    last_note: Mapped[str | None] = column_property(_latest_note(Discussion.body, id))
    last_note_at: Mapped[datetime | None] = column_property(_latest_note(Discussion.created_at, id))

    discussions: Mapped[list[Discussion]] = relationship(
        back_populates="lead",
        cascade="all, delete-orphan",
        order_by=(Discussion.created_at.desc(), Discussion.id.desc()),
    )
