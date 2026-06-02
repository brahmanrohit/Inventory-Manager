"""Application configuration loaded from environment variables."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Database connection. Either provide a full DATABASE_URL (used by most
    # hosting platforms like Render/Railway) or the individual POSTGRES_* parts.
    DATABASE_URL: str | None = None
    POSTGRES_USER: str = "inventory"
    POSTGRES_PASSWORD: str = "inventory"
    POSTGRES_DB: str = "inventory"
    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432

    # Comma-separated list of allowed CORS origins, or "*" for all.
    CORS_ORIGINS: str = "*"

    # Threshold below which a product is considered "low stock".
    LOW_STOCK_THRESHOLD: int = 10

    # Seed demo data on startup if the database is empty.
    SEED_ON_STARTUP: bool = True

    # DANGER: drop & recreate ALL tables on startup. Used for a one-time schema
    # rebuild when an existing database predates a schema change (no Alembic yet).
    # Set to true ONCE via env, redeploy, then set back to false.
    RESET_DB_ON_STARTUP: bool = False

    # Authentication. SECRET_KEY MUST be overridden via env in production.
    SECRET_KEY: str = "dev-secret-change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def sqlalchemy_database_uri(self) -> str:
        if self.DATABASE_URL:
            # Normalize the scheme some platforms hand out (postgres://) to the
            # form SQLAlchemy + psycopg2 expects (postgresql://).
            url = self.DATABASE_URL
            if url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql://", 1)
            return url
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def cors_origin_list(self) -> list[str]:
        if self.CORS_ORIGINS.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
