from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(ORMModel):
    id: int
    name: str | None = None
    email: EmailStr


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class StoreBase(BaseModel):
    name: str
    restaurant_type: str
    cuisine_type: str | None = None
    average_price: Decimal | None = None


class StoreCreate(StoreBase):
    pass


class StoreUpdate(BaseModel):
    name: str | None = None
    restaurant_type: str | None = None
    cuisine_type: str | None = None
    average_price: Decimal | None = None
    status: str | None = None


class StoreResponse(ORMModel):
    id: int
    name: str
    restaurant_type: str
    cuisine_type: str | None = None
    average_price: Decimal | None = None
    status: str
    created_at: datetime
    updated_at: datetime


class StoreProfileUpsertRequest(BaseModel):
    answers: dict[str, str] = Field(default_factory=dict)


class StoreProfileResponse(ORMModel):
    id: int
    store_id: int
    onboarding_status: str
    answers_json: dict[str, str]
    style_keywords: list[str]
    plating_direction: str | None = None
    tone_of_voice: str | None = None
    overall_style_summary: str | None = None
    created_at: datetime
    updated_at: datetime


class DishInput(BaseModel):
    name: str
    description: str | None = None
    ingredients_method: str | None = None
    price: Decimal | None = None
    image_url: str | None = None


class DishUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    ingredients_method: str | None = None
    price: Decimal | None = None
    image_url: str | None = None


class DishResponse(ORMModel):
    id: int
    store_id: int
    name: str
    description: str | None = None
    ingredients_method: str | None = None
    price: Decimal | None = None
    has_image: bool
    image_url: str | None = None
    created_at: datetime
    updated_at: datetime


class CopywritingBlock(BaseModel):
    story: str
    menu_description: str
    marketing_line: str


class SuggestionResult(BaseModel):
    plating_suggestions: dict[str, str]
    visual_suggestions: dict[str, str]
    copywriting: CopywritingBlock
    service_lines: list[str]
    notes: dict[str, bool | str]


class GenerateSuggestionRequest(BaseModel):
    store_id: int
    dish_id: int | None = None
    dish: DishInput
    use_store_profile: bool = True
    extra_goal: str | None = None


class SuggestionRecordResponse(BaseModel):
    id: int
    based_on_store_profile: bool
    input_snapshot_json: dict
    plating_suggestions: dict[str, str]
    visual_suggestions: dict[str, str]
    copywriting: CopywritingBlock
    service_lines: list[str]
    model_info: dict | None = None
    created_at: datetime


class GenerateSuggestionResponse(BaseModel):
    dish: DishResponse
    suggestion_record: SuggestionRecordResponse


class SuggestionListResponse(BaseModel):
    items: list[SuggestionRecordResponse]


class UploadResponse(BaseModel):
    url: str
    filename: str


class AIStatusResponse(BaseModel):
    configured_provider: str
    resolved_provider: str
    provider_label: str
    model: str | None = None
    configured: bool
    supports_image_input: bool
    fallback_to_mock: bool
    using_mock: bool
    message: str


class AIConnectionTestResponse(BaseModel):
    success: bool
    configured_provider: str
    resolved_provider: str
    provider_label: str
    model: str | None = None
    fallback_used: bool
    latency_ms: int
    message: str
    details: dict | None = None
