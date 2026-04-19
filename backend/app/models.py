from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import JSON, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    stores: Mapped[list["Store"]] = relationship(back_populates="user")


class Store(TimestampMixin, Base):
    __tablename__ = "stores"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    restaurant_type: Mapped[str] = mapped_column(String(100), nullable=False)
    cuisine_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    average_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)

    user: Mapped[User] = relationship(back_populates="stores")
    profile: Mapped["StoreProfile | None"] = relationship(back_populates="store", uselist=False)
    dishes: Mapped[list["Dish"]] = relationship(back_populates="store")
    suggestions: Mapped[list["SuggestionRecord"]] = relationship(back_populates="store")


class StoreProfile(TimestampMixin, Base):
    __tablename__ = "store_profiles"
    __table_args__ = (UniqueConstraint("store_id", name="uq_store_profile_store_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id"), nullable=False, index=True)
    onboarding_status: Mapped[str] = mapped_column(String(50), default="not_started", nullable=False)
    answers_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    style_keywords: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    plating_direction: Mapped[str | None] = mapped_column(Text, nullable=True)
    tone_of_voice: Mapped[str | None] = mapped_column(Text, nullable=True)
    overall_style_summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    store: Mapped[Store] = relationship(back_populates="profile")


class Dish(TimestampMixin, Base):
    __tablename__ = "dishes"

    id: Mapped[int] = mapped_column(primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    ingredients_method: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    has_image: Mapped[bool] = mapped_column(default=False, nullable=False)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    store: Mapped[Store] = relationship(back_populates="dishes")
    suggestions: Mapped[list["SuggestionRecord"]] = relationship(back_populates="dish")


class SuggestionRecord(Base):
    __tablename__ = "suggestion_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    dish_id: Mapped[int] = mapped_column(ForeignKey("dishes.id"), nullable=False, index=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id"), nullable=False, index=True)
    based_on_store_profile: Mapped[bool] = mapped_column(default=False, nullable=False)
    input_snapshot_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    plating_suggestions: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    visual_suggestions: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    story_copy: Mapped[str | None] = mapped_column(Text, nullable=True)
    menu_copy: Mapped[str | None] = mapped_column(Text, nullable=True)
    marketing_copy: Mapped[str | None] = mapped_column(Text, nullable=True)
    service_lines: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    model_info: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    dish: Mapped[Dish] = relationship(back_populates="suggestions")
    store: Mapped[Store] = relationship(back_populates="suggestions")
