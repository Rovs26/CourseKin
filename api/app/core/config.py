from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "ReviewFlow API"
    APP_ENV: str = "development"
    DATABASE_URL: str = "sqlite:///./data/reviewflow.db"
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    FRONTEND_URL: str = ""  # e.g. "https://reviewflow.example.com" — added to CORS in production

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()