from logging.config import fileConfig

from alembic import context
from sqlalchemy import Connection

from app import models  # noqa: F401  (registers the tables on Base.metadata)
from app.config import settings
from app.db import Base, make_engine

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def _run(connection: Connection) -> None:
    # Batch mode lets future ALTERs work on SQLite too.
    context.configure(connection=connection, target_metadata=target_metadata, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    # Tests hand over an existing connection; the CLI connects using DATABASE_URL.
    connection = config.attributes.get("connection")
    if connection is not None:
        _run(connection)
        return

    engine = make_engine(settings.database_url)
    with engine.connect() as conn:
        _run(conn)
    engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
