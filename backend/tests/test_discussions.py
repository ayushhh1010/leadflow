from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient

MakeLead = Callable[..., dict[str, Any]]


def in_days(days: float) -> str:
    return (datetime.now(UTC) + timedelta(days=days)).isoformat()


def test_note_is_added_to_timeline_and_list(client: TestClient, make_lead: MakeLead) -> None:
    lead = make_lead()

    response = client.post(
        f"/api/leads/{lead['id']}/discussions", json={"body": "  Discovery call.\nGood fit. "}
    )

    assert response.status_code == 201
    updated = response.json()
    assert updated["discussions"][0]["kind"] == "note"
    assert updated["discussions"][0]["body"] == "Discovery call.\nGood fit."
    assert updated["last_note"] == "Discovery call.\nGood fit."
    [listed] = client.get("/api/leads").json()
    assert listed["last_note"] == "Discovery call.\nGood fit."


def test_follow_up_on_note_becomes_lead_follow_up_in_utc(
    client: TestClient, make_lead: MakeLead
) -> None:
    lead = make_lead()

    response = client.post(
        f"/api/leads/{lead['id']}/discussions",
        json={"body": "Sent pricing.", "follow_up_at": "2099-05-06T14:00:00+05:30"},
    )

    assert response.status_code == 201
    updated = response.json()
    assert updated["follow_up_at"] == "2099-05-06T08:30:00Z"
    assert updated["discussions"][0]["follow_up_at"] == "2099-05-06T08:30:00Z"
    [listed] = client.get("/api/leads").json()
    assert listed["follow_up_at"] == "2099-05-06T08:30:00Z"


def test_note_without_follow_up_keeps_existing_follow_up(
    client: TestClient, make_lead: MakeLead
) -> None:
    lead = make_lead()
    client.post(
        f"/api/leads/{lead['id']}/discussions",
        json={"body": "Booked a call.", "follow_up_at": "2099-01-01T09:00:00Z"},
    )

    response = client.post(f"/api/leads/{lead['id']}/discussions", json={"body": "Quick email."})

    assert response.json()["follow_up_at"] == "2099-01-01T09:00:00Z"


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"body": ""},
        {"body": "   "},
        {"body": "x" * 5001},
        {"body": "Call", "follow_up_at": in_days(-1)},
        {"body": "Call", "follow_up_at": "2099-01-01T10:00:00"},
        {"body": "Call", "follow_up_at": "next tuesday"},
        {"body": "Call", "kind": "event"},
    ],
)
def test_rejects_invalid_discussions(
    client: TestClient, make_lead: MakeLead, payload: dict[str, Any]
) -> None:
    lead = make_lead()

    response = client.post(f"/api/leads/{lead['id']}/discussions", json=payload)

    assert response.status_code == 422
    assert len(client.get(f"/api/leads/{lead['id']}").json()["discussions"]) == 1


def test_unknown_lead_is_404(client: TestClient) -> None:
    response = client.post("/api/leads/999/discussions", json={"body": "Hello"})

    assert response.status_code == 404
    assert response.json() == {"detail": "Lead not found"}
