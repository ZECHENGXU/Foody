from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_name: str = "Foody MVP API"
    secret_key: str = "replace-this-secret"
    access_token_expire_minutes: int = 60 * 24 * 7
    database_url: str = f"sqlite:///{(BASE_DIR / 'foody.db').as_posix()}"
    cors_origins: str = "http://localhost:5173"
    upload_dir: str = str(BASE_DIR / "uploads")
    demo_user_email: str = "demo@example.com"
    demo_user_password: str = "demo123456"
    ai_provider: str = "auto"
    ai_fallback_to_mock: bool = True
    ai_timeout_seconds: int = 60

    openai_api_key: str = ""
    openai_model: str = "gpt-4.1-mini"
    openai_base_url: str = "https://api.openai.com/v1"

    anthropic_api_key: str = ""
    anthropic_model: str = "claude-3-5-sonnet-latest"
    anthropic_base_url: str = "https://api.anthropic.com"
    anthropic_version: str = "2023-06-01"

    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta"

    compatible_api_key: str = ""
    compatible_model: str = ""
    compatible_base_url: str = ""
    compatible_api_key_header: str = "Authorization"
    compatible_api_key_prefix: str = "Bearer"
    compatible_extra_headers_json: str = "{}"
    compatible_extra_body_json: str = "{}"
    compatible_provider_name: str = "openai-compatible"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


settings = Settings()
