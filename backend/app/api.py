from typing import Annotated, Any

from fastapi import APIRouter, Query, Response

from . import service
from .db import DbSession
from .models import LeadStatus
from .schemas import DiscussionCreate, LeadCreate, LeadDetailOut, LeadOut, LeadUpdate

router = APIRouter(prefix="/api/leads", tags=["leads"])

NOT_FOUND: dict[int | str, dict[str, Any]] = {404: {"description": "Lead not found"}}


@router.get("")
def list_leads(
    db: DbSession,
    status: Annotated[LeadStatus | None, Query(description="Only leads in this status")] = None,
    q: Annotated[
        str | None, Query(max_length=100, description="Case-insensitive match on name or company")
    ] = None,
) -> list[LeadOut]:
    """List leads, most recently discussed first."""
    return service.list_leads(db, status=status, search=q)


@router.post("", status_code=201)
def create_lead(payload: LeadCreate, db: DbSession, response: Response) -> LeadDetailOut:
    """Create a lead. Its status always starts as `new`."""
    lead = service.create_lead(db, payload)
    response.headers["Location"] = f"{router.prefix}/{lead.id}"
    return lead


@router.get("/{lead_id}", responses=NOT_FOUND)
def get_lead(lead_id: int, db: DbSession) -> LeadDetailOut:
    """A lead with its full timeline, newest entry first."""
    return service.get_lead(db, lead_id)


@router.patch("/{lead_id}", responses=NOT_FOUND)
def update_lead(lead_id: int, payload: LeadUpdate, db: DbSession) -> LeadDetailOut:
    """Change the status and/or the next follow-up (`"follow_up_at": null` clears it)."""
    return service.update_lead(db, lead_id, payload)


@router.post("/{lead_id}/discussions", status_code=201, responses=NOT_FOUND)
def add_discussion(lead_id: int, payload: DiscussionCreate, db: DbSession) -> LeadDetailOut:
    """Log a discussion. A `follow_up_at` also becomes the lead's next follow-up.

    Responds with the updated lead so clients refresh the list and timeline from one call.
    """
    return service.add_discussion(db, lead_id, payload)
