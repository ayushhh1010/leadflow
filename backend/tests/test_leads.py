from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient

MakeLead = Callable[..., dict[str, Any]]


def in_days(days: float) -> str:
    return (datetime.now(UTC) + timedelta(days=days)).isoformat()


class TestCreateLead:
    def test_creates_new_lead_with_creation_event(self, client: TestClient) -> None:
        response = client.post(
            "/api/leads",
            json={"name": "  Sarah Connor ", "company": "Acme Corp", "phone": "555-0199"},
        )

        assert response.status_code == 201
        lead = response.json()
        assert response.headers["location"] == f"/api/leads/{lead['id']}"
        assert lead["name"] == "Sarah Connor"
        assert lead["company"] == "Acme Corp"
        assert lead["phone"] == "555-0199"
        assert lead["status"] == "new"
        assert lead["follow_up_at"] is None
        assert lead["last_note"] is None
        assert [(d["kind"], d["body"]) for d in lead["discussions"]] == [("event", "Lead created")]

    def test_blank_optional_fields_are_stored_as_null(self, client: TestClient) -> None:
        response = client.post("/api/leads", json={"name": "Ada", "company": "  ", "phone": ""})

        assert response.status_code == 201
        assert response.json()["company"] is None
        assert response.json()["phone"] is None

    @pytest.mark.parametrize(
        "payload",
        [
            {},
            {"name": ""},
            {"name": "   "},
            {"name": "x" * 121},
            {"name": "Ada", "company": "x" * 121},
            {"name": "Ada", "phone": "call me maybe"},
            {"name": "Ada", "phone": "12"},
            {"name": "Ada", "status": "won"},
        ],
    )
    def test_rejects_invalid_payloads(self, client: TestClient, payload: dict[str, Any]) -> None:
        response = client.post("/api/leads", json=payload)

        assert response.status_code == 422
        assert isinstance(response.json()["detail"], list)

    def test_rejects_non_json_body(self, client: TestClient) -> None:
        response = client.post("/api/leads", content="name=Ada")

        assert response.status_code == 422


class TestListLeads:
    def test_lists_most_recently_discussed_first(
        self, client: TestClient, make_lead: MakeLead
    ) -> None:
        older = make_lead(name="Older")
        make_lead(name="Newer")
        client.post(f"/api/leads/{older['id']}/discussions", json={"body": "Called back"})

        response = client.get("/api/leads")

        assert response.status_code == 200
        leads = response.json()
        assert [lead["name"] for lead in leads] == ["Older", "Newer"]
        assert leads[0]["last_note"] == "Called back"
        assert leads[0]["last_note_at"] is not None
        assert "discussions" not in leads[0]

    def test_system_events_do_not_count_as_last_note(
        self, client: TestClient, make_lead: MakeLead
    ) -> None:
        lead = make_lead()
        client.patch(f"/api/leads/{lead['id']}", json={"status": "contacted"})

        [listed] = client.get("/api/leads").json()

        assert listed["last_note"] is None
        assert listed["last_note_at"] is None

    def test_filters_by_status(self, client: TestClient, make_lead: MakeLead) -> None:
        won = make_lead(name="Closed deal")
        make_lead(name="Fresh lead")
        client.patch(f"/api/leads/{won['id']}", json={"status": "won"})

        response = client.get("/api/leads", params={"status": "won"})

        assert [lead["name"] for lead in response.json()] == ["Closed deal"]

    def test_search_matches_name_or_company_ignoring_case(
        self, client: TestClient, make_lead: MakeLead
    ) -> None:
        make_lead(name="Sarah Connor", company="Acme Corp")
        make_lead(name="Hank Scorpio", company="Globex")
        make_lead(name="Bill Lumbergh", company="Initech")

        by_name = client.get("/api/leads", params={"q": "  sarah "}).json()
        by_company = client.get("/api/leads", params={"q": "GLOBEX"}).json()

        assert [lead["name"] for lead in by_name] == ["Sarah Connor"]
        assert [lead["name"] for lead in by_company] == ["Hank Scorpio"]

    def test_search_treats_like_wildcards_literally(
        self, client: TestClient, make_lead: MakeLead
    ) -> None:
        make_lead(name="100% Organic")
        make_lead(name="Plain Name")

        assert [lead["name"] for lead in client.get("/api/leads?q=%25").json()] == ["100% Organic"]
        assert client.get("/api/leads", params={"q": "_"}).json() == []

    def test_combines_status_and_search(self, client: TestClient, make_lead: MakeLead) -> None:
        make_lead(name="Sarah New")
        contacted = make_lead(name="Sarah Contacted")
        client.patch(f"/api/leads/{contacted['id']}", json={"status": "contacted"})

        response = client.get("/api/leads", params={"q": "sarah", "status": "contacted"})

        assert [lead["name"] for lead in response.json()] == ["Sarah Contacted"]

    @pytest.mark.parametrize("params", [{"status": "archived"}, {"q": "x" * 101}])
    def test_rejects_invalid_query_params(self, client: TestClient, params: dict[str, str]) -> None:
        assert client.get("/api/leads", params=params).status_code == 422


class TestGetLead:
    def test_returns_timeline_newest_first(self, client: TestClient, make_lead: MakeLead) -> None:
        lead = make_lead()
        for body in ("first", "second", "third"):
            client.post(f"/api/leads/{lead['id']}/discussions", json={"body": body})

        response = client.get(f"/api/leads/{lead['id']}")

        assert response.status_code == 200
        bodies = [d["body"] for d in response.json()["discussions"]]
        assert bodies == ["third", "second", "first", "Lead created"]

    def test_unknown_lead_is_404(self, client: TestClient) -> None:
        response = client.get("/api/leads/999")

        assert response.status_code == 404
        assert response.json() == {"detail": "Lead not found"}

    def test_non_numeric_id_is_422(self, client: TestClient) -> None:
        assert client.get("/api/leads/abc").status_code == 422


class TestUpdateLead:
    def test_status_change_persists_and_is_logged(
        self, client: TestClient, make_lead: MakeLead
    ) -> None:
        lead = make_lead()

        response = client.patch(f"/api/leads/{lead['id']}", json={"status": "proposal_sent"})

        assert response.status_code == 200
        assert response.json()["status"] == "proposal_sent"
        assert response.json()["discussions"][0]["kind"] == "event"
        assert (
            response.json()["discussions"][0]["body"] == "Status changed from New to Proposal Sent"
        )
        assert client.get(f"/api/leads/{lead['id']}").json()["status"] == "proposal_sent"

    def test_unchanged_status_is_not_logged(self, client: TestClient, make_lead: MakeLead) -> None:
        lead = make_lead()

        response = client.patch(f"/api/leads/{lead['id']}", json={"status": "new"})

        assert response.status_code == 200
        assert len(response.json()["discussions"]) == 1

    def test_sets_and_clears_follow_up(self, client: TestClient, make_lead: MakeLead) -> None:
        lead = make_lead()

        set_response = client.patch(f"/api/leads/{lead['id']}", json={"follow_up_at": in_days(1)})
        clear_response = client.patch(f"/api/leads/{lead['id']}", json={"follow_up_at": None})

        assert set_response.json()["follow_up_at"] is not None
        assert clear_response.status_code == 200
        assert clear_response.json()["follow_up_at"] is None
        assert clear_response.json()["discussions"][0]["body"] == "Follow-up cleared"

    @pytest.mark.parametrize(
        "payload",
        [
            {},
            {"status": None},
            {"status": "archived"},
            {"follow_up_at": in_days(-1)},
            {"follow_up_at": "2099-01-01T10:00:00"},
            {"name": "Renamed"},
        ],
    )
    def test_rejects_invalid_updates(
        self, client: TestClient, make_lead: MakeLead, payload: dict[str, Any]
    ) -> None:
        lead = make_lead()

        response = client.patch(f"/api/leads/{lead['id']}", json=payload)

        assert response.status_code == 422

    def test_unknown_lead_is_404(self, client: TestClient) -> None:
        response = client.patch("/api/leads/999", json={"status": "won"})

        assert response.status_code == 404
