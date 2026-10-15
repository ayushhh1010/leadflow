import re
from datetime import UTC, datetime
from typing import Annotated, Self

from pydantic import (
    AfterValidator,
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)
from pydantic_core import PydanticCustomError

from .models import DiscussionKind, LeadStatus

_PHONE_CHARS = re.compile(r"[0-9+()\-.\s]+")


def _in_future(value: datetime) -> datetime:
    if value <= datetime.now(UTC):
        raise PydanticCustomError("follow_up_in_past", "Follow-up must be in the future")
    return value


def _valid_phone(value: str) -> str:
    if not _PHONE_CHARS.fullmatch(value) or sum(ch.isdigit() for ch in value) < 3:
        raise PydanticCustomError(
            "phone_format", "Phone may contain only digits, spaces and + ( ) - . characters"
        )
    return value


# Timestamps must carry an offset (e.g. `2026-05-06T14:00:00+05:30`); they are stored as UTC.
FollowUpAt = Annotated[AwareDatetime, AfterValidator(_in_future)]
Phone = Annotated[str, Field(max_length=40), AfterValidator(_valid_phone)]


class _Input(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class LeadCreate(_Input):
    name: str = Field(min_length=1, max_length=120)
    company: str | None = Field(default=None, max_length=120)
    phone: Phone | None = None

    @field_validator("company", "phone", mode="before")
    @classmethod
    def _blank_is_none(cls, value: object) -> object:
        return None if isinstance(value, str) and not value.strip() else value


class LeadUpdate(_Input):
    status: LeadStatus | None = None
    follow_up_at: FollowUpAt | None = Field(
        default=None, description="New follow-up time, or `null` to clear it"
    )

    @model_validator(mode="after")
    def _has_valid_changes(self) -> Self:
        if not self.model_fields_set:
            raise PydanticCustomError("no_changes", "Provide at least one field to update")
        if "status" in self.model_fields_set and self.status is None:
            raise PydanticCustomError("status_null", "Status cannot be null")
        return self


class DiscussionCreate(_Input):
    body: str = Field(min_length=1, max_length=5000)
    follow_up_at: FollowUpAt | None = None


class DiscussionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: DiscussionKind
    body: str
    follow_up_at: datetime | None
    created_at: datetime


class LeadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    company: str | None
    phone: str | None
    status: LeadStatus
    follow_up_at: datetime | None
    last_note: str | None
    last_note_at: datetime | None
    created_at: datetime
    updated_at: datetime


class LeadDetailOut(LeadOut):
    discussions: list[DiscussionOut] = Field(description="Full timeline, newest first")
