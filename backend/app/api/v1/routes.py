from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.schemas import (
    AIConnectionTestResponse,
    AIStatusResponse,
    DishResponse,
    DishUpdate,
    GenerateSuggestionRequest,
    GenerateSuggestionResponse,
    LoginRequest,
    LoginResponse,
    StoreCreate,
    StoreProfileResponse,
    StoreProfileUpsertRequest,
    StoreResponse,
    StoreUpdate,
    SuggestionListResponse,
    SuggestionRecordResponse,
    UploadResponse,
    UserResponse,
)
from app.services import (
    ai_service,
    auth_service,
    dish_service,
    store_profile_service,
    store_service,
    suggestion_service,
    upload_service,
)


router = APIRouter()


@router.post("/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    token, user = auth_service.login(db, payload.email, payload.password)
    return LoginResponse(access_token=token, user=UserResponse.model_validate(user))


@router.get("/auth/me", response_model=UserResponse)
def me(user=Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(user)


@router.get("/ai/status", response_model=AIStatusResponse)
def get_ai_status(user=Depends(get_current_user)) -> AIStatusResponse:
    return AIStatusResponse(**ai_service.get_status())


@router.post("/ai/test", response_model=AIConnectionTestResponse)
def test_ai_connection(user=Depends(get_current_user)) -> AIConnectionTestResponse:
    return AIConnectionTestResponse(**ai_service.test_connection())


@router.get("/stores", response_model=list[StoreResponse])
def list_stores(db: Session = Depends(get_db), user=Depends(get_current_user)) -> list[StoreResponse]:
    return [StoreResponse.model_validate(item) for item in store_service.list_stores(db, user.id)]


@router.post("/stores", response_model=StoreResponse)
def create_store(payload: StoreCreate, db: Session = Depends(get_db), user=Depends(get_current_user)) -> StoreResponse:
    return StoreResponse.model_validate(store_service.create(db, user.id, payload))


@router.get("/stores/{store_id}", response_model=StoreResponse)
def get_store(store_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)) -> StoreResponse:
    return StoreResponse.model_validate(store_service.get_store_or_404(db, user.id, store_id))


@router.patch("/stores/{store_id}", response_model=StoreResponse)
def update_store(store_id: int, payload: StoreUpdate, db: Session = Depends(get_db), user=Depends(get_current_user)) -> StoreResponse:
    store = store_service.get_store_or_404(db, user.id, store_id)
    return StoreResponse.model_validate(store_service.update(db, store, payload))


@router.get("/stores/{store_id}/profile", response_model=StoreProfileResponse)
def get_profile(store_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)) -> StoreProfileResponse:
    store = store_service.get_store_or_404(db, user.id, store_id)
    if not store.profile:
        raise HTTPException(status_code=404, detail="Store profile not found")
    return StoreProfileResponse.model_validate(store.profile)


@router.post("/stores/{store_id}/profile", response_model=StoreProfileResponse)
def upsert_profile(
    store_id: int,
    payload: StoreProfileUpsertRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> StoreProfileResponse:
    store = store_service.get_store_or_404(db, user.id, store_id)
    return StoreProfileResponse.model_validate(store_profile_service.upsert(db, store, payload))


@router.post("/stores/{store_id}/profile/skip", response_model=StoreProfileResponse)
def skip_profile(store_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)) -> StoreProfileResponse:
    store = store_service.get_store_or_404(db, user.id, store_id)
    return StoreProfileResponse.model_validate(store_profile_service.skip(db, store))


@router.get("/stores/{store_id}/dishes", response_model=list[DishResponse])
def list_dishes(
    store_id: int,
    keyword: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> list[DishResponse]:
    store = store_service.get_store_or_404(db, user.id, store_id)
    return [DishResponse.model_validate(item) for item in dish_service.list(db, store, keyword)]


@router.get("/stores/{store_id}/dishes/{dish_id}", response_model=DishResponse)
def get_dish(store_id: int, dish_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)) -> DishResponse:
    store = store_service.get_store_or_404(db, user.id, store_id)
    return DishResponse.model_validate(dish_service.get_or_404(db, store, dish_id))


@router.patch("/stores/{store_id}/dishes/{dish_id}", response_model=DishResponse)
def update_dish(
    store_id: int,
    dish_id: int,
    payload: DishUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> DishResponse:
    store = store_service.get_store_or_404(db, user.id, store_id)
    dish = dish_service.get_or_404(db, store, dish_id)
    return DishResponse.model_validate(dish_service.update(db, dish, payload.model_dump(exclude_unset=True)))


@router.post("/suggestions/generate", response_model=GenerateSuggestionResponse)
def generate_suggestion(
    payload: GenerateSuggestionRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> GenerateSuggestionResponse:
    store = store_service.get_store_or_404(db, user.id, payload.store_id)
    return suggestion_service.generate(db, store, payload)


@router.get("/stores/{store_id}/dishes/{dish_id}/suggestions", response_model=SuggestionListResponse)
def list_suggestions(
    store_id: int,
    dish_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> SuggestionListResponse:
    store = store_service.get_store_or_404(db, user.id, store_id)
    return SuggestionListResponse(items=suggestion_service.list_for_dish(db, store, dish_id))


@router.get("/suggestions/{suggestion_id}", response_model=SuggestionRecordResponse)
def get_suggestion(suggestion_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)) -> SuggestionRecordResponse:
    return suggestion_service.get_by_id(db, user.id, suggestion_id)


@router.post("/uploads/image", response_model=UploadResponse)
def upload_image(file: UploadFile = File(...), user=Depends(get_current_user)) -> UploadResponse:
    url, filename = upload_service.save_image(file)
    return UploadResponse(url=url, filename=filename)
