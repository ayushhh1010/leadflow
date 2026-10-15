from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from .models import Discussion, DiscussionKind, Lead, LeadStatus
from .schemas import DiscussionCreate, LeadCreate, LeadDetailOut, LeadOut, LeadUpdate


class NotFoundError(LookupError):
    """A requested record does not exist (served as HTTP 404)."""


def _get_lead(db: Session, lead_id: int) -> Lead:
    lead = db.get(Lead, lead_id)
    if lead is None:
        raise NotFoundError("Lead not found")
    return lead


def _log_event(db: Session, lead: Lead, text: str) -> None:
    db.add(Discussion(lead_id=lead.id, kind=DiscussionKind.EVENT, body=text))


def _escape_like(text: str) -> str:
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def list_leads(
    db: Session, status: LeadStatus | None = None, search: str | None = None
) -> list[LeadOut]:
    # shortcut: returns every matching lead in one response; add cursor pagination
    # once a single rep's book grows past a few thousand leads.
    stmt = select(Lead)
    if status is not None:
        stmt = stmt.where(Lead.status == status)
    if search and (term := search.strip()):
        pattern = f"%{_escape_like(term)}%"
        stmt = stmt.where(
            or_(Lead.name.ilike(pattern, escape="\\"), Lead.company.ilike(pattern, escape="\\"))
        )
    stmt = stmt.order_by(func.coalesce(Lead.last_note_at, Lead.created_at).desc(), Lead.id.desc())
    return [LeadOut.model_validate(lead) for lead in db.scalars(stmt)]


def get_lead(db: Session, lead_id: int) -> LeadDetailOut:
    return LeadDetailOut.model_validate(_get_lead(db, lead_id))


def create_lead(db: Session, data: LeadCreate) -> LeadDetailOut:
    lead = Lead(name=data.name, company=data.company, phone=data.phone)
    lead.discussions.append(Discussion(kind=DiscussionKind.EVENT, body="Lead created"))
    db.add(lead)
    db.commit()
    return LeadDetailOut.model_validate(lead)


def update_lead(db: Session, lead_id: int, data: LeadUpdate) -> LeadDetailOut:
    lead = _get_lead(db, lead_id)
    changes = data.model_fields_set

    if data.status is not None and data.status != lead.status:
        _log_event(db, lead, f"Status changed from {lead.status.label} to {data.status.label}")
        lead.status = data.status

    if "follow_up_at" in changes:
        if data.follow_up_at is None and lead.follow_up_at is not None:
            _log_event(db, lead, "Follow-up cleared")
        lead.follow_up_at = data.follow_up_at

    db.commit()
    return LeadDetailOut.model_validate(lead)


def add_discussion(db: Session, lead_id: int, data: DiscussionCreate) -> LeadDetailOut:
    lead = _get_lead(db, lead_id)
    db.add(Discussion(lead_id=lead.id, body=data.body, follow_up_at=data.follow_up_at))
    if data.follow_up_at is not None:
        lead.follow_up_at = data.follow_up_at
    db.commit()
    return LeadDetailOut.model_validate(lead)
