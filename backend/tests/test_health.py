from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app import service
from app.db import get_db, make_engine
from app.main import app


def test_health_reports_ok(client: TestClient) -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_reports_503_when_database_is_unreachable(tmp_path: Path) -> None:
    broken = make_engine(f"sqlite:///{tmp_path / 'missing-dir' / 'leadflow.db'}")

    def broken_db() -> Iterator[Session]:
        with Session(broken) as session:
            yield session

    app.dependency_overrides[get_db] = broken_db
    try:
        response = TestClient(app).get("/api/health")
    finally:
        app.dependency_overrides.clear()
        broken.dispose()

    assert response.status_code == 503
    assert response.json() == {"detail": "Database unavailable"}


def test_unexpected_errors_return_generic_500(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def explode(*_args: object, **_kwargs: object) -> None:
        raise RuntimeError("secret internal detail")

    monkeypatch.setattr(service, "list_leads", explode)

    response = TestClient(app, raise_server_exceptions=False).get("/api/leads")

    assert response.status_code == 500
    assert response.json() == {"detail": "Internal server error"}
    assert "secret" not in response.text
