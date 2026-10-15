from pathlib import Path

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import Connection, Engine, inspect, text
from sqlalchemy.exc import IntegrityError

from app.db import Base

ALEMBIC_INI = Path(__file__).resolve().parents[1] / "alembic.ini"


def alembic_config(connection: Connection) -> Config:
    config = Config(ALEMBIC_INI)
    config.attributes["connection"] = connection
    return config


def test_migrations_match_models_and_downgrade_cleanly(engine: Engine) -> None:
    with engine.begin() as conn:
        command.upgrade(alembic_config(conn), "head")
        assert compare_metadata(MigrationContext.configure(conn), Base.metadata) == []

        command.downgrade(alembic_config(conn), "base")
        assert set(inspect(conn).get_table_names()) == {"alembic_version"}


def test_migrated_schema_rejects_unknown_status(engine: Engine) -> None:
    with engine.begin() as conn:
        command.upgrade(alembic_config(conn), "head")

    with pytest.raises(IntegrityError), engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO leads (name, status, created_at, updated_at) "
                "VALUES ('Ada', 'archived', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
            )
        )
