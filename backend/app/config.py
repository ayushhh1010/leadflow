from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration from environment variables.

    For local runs the repo-root `.env` (and an optional `backend/.env`) are read too;
    real environment variables always win.
    """

    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")

    database_url: str = "sqlite:///./leadflow.db"
    log_level: str = "INFO"


settings = Settings()
