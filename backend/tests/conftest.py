import os
from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.db import Base, get_db, make_engine
from app.main import app


@pytest.fixture
def engine(tmp_path: Path) -> Iterator[Engine]:
    """An empty database: a throwaway SQLite file, or TEST_DATABASE_URL (e.g. PostgreSQL)."""
    engine = make_engine(os.environ.get("TEST_DATABASE_URL", f"sqlite:///{tmp_path / 'test.db'}"))
    Base.metadata.drop_all(engine)
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS alembic_version"))
    yield engine
    engine.dispose()


@pytest.fixture
def session_factory(engine: Engine) -> sessionmaker[Session]:
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)


@pytest.fixture
def db(session_factory: sessionmaker[Session]) -> Iterator[Session]:
    with session_factory() as session:
        yield session


@pytest.fixture
def client(session_factory: sessionmaker[Session]) -> Iterator[TestClient]:
    def override_get_db() -> Iterator[Session]:
        with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def make_lead(client: TestClient) -> Callable[..., dict[str, Any]]:
    def _make(**fields: Any) -> dict[str, Any]:
        response = client.post("/api/leads", json={"name": "Ada Lovelace", **fields})
        assert response.status_code == 201, response.text
        return response.json()  # type: ignore[no-any-return]

    return _make
