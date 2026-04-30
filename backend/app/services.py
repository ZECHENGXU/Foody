from __future__ import annotations

import base64
import json
import mimetypes
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from time import perf_counter
import shutil
from typing import Any
from urllib import error, parse, request
import uuid

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import delete, desc, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.models import Dish, Store, StoreProfile, SuggestionRecord, User
from app.schemas import (
    CopywritingBlock,
    DishInput,
    GenerateSuggestionRequest,
    GenerateSuggestionResponse,
    SuggestionRecordResponse,
    SuggestionResult,
    StoreCreate,
    StoreProfileUpsertRequest,
    StoreUpdate,
)


STORE_PROFILE_SCHEMA = {
    "type": "object",
    "properties": {
        "style_keywords": {"type": "array", "items": {"type": "string"}},
        "plating_direction": {"type": "string"},
        "tone_of_voice": {"type": "string"},
        "overall_style_summary": {"type": "string"},
    },
    "required": ["style_keywords", "plating_direction", "tone_of_voice", "overall_style_summary"],
}

SUGGESTION_SCHEMA = {
    "type": "object",
    "properties": {
        "plating_suggestions": {
            "type": "object",
            "properties": {
                "main_placement": {"type": "string"},
                "garnish": {"type": "string"},
                "spacing": {"type": "string"},
                "plateware": {"type": "string"},
            },
            "required": ["main_placement", "garnish", "spacing", "plateware"],
        },
        "visual_suggestions": {
            "type": "object",
            "properties": {
                "color": {"type": "string"},
                "background": {"type": "string"},
                "angle": {"type": "string"},
                "lighting": {"type": "string"},
            },
            "required": ["color", "background", "angle", "lighting"],
        },
        "copywriting": {
            "type": "object",
            "properties": {
                "story": {"type": "string"},
                "menu_description": {"type": "string"},
                "marketing_line": {"type": "string"},
            },
            "required": ["story", "menu_description", "marketing_line"],
        },
        "service_lines": {"type": "array", "items": {"type": "string"}},
        "notes": {
            "type": "object",
            "properties": {
                "used_store_profile": {"type": "boolean"},
                "image_mode": {"type": "boolean"},
                "extra_goal": {"type": "string"},
            },
            "required": ["used_store_profile", "image_mode", "extra_goal"],
        },
    },
    "required": ["plating_suggestions", "visual_suggestions", "copywriting", "service_lines", "notes"],
}


class AuthService:
    def ensure_demo_user(self, db: Session) -> User:
        user = db.scalar(select(User).where(User.email == settings.demo_user_email))
        if user:
            return user
        user = User(
            name="演示用户",
            email=settings.demo_user_email,
            password_hash=hash_password(settings.demo_user_password),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    def login(self, db: Session, email: str, password: str) -> tuple[str, User]:
        user = db.scalar(select(User).where(User.email == email))
        if not user or not verify_password(password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="账号或密码错误")
        user.last_login_at = datetime.now(UTC)
        db.commit()
        token = create_access_token(str(user.id))
        return token, user


class StoreService:
    def list_stores(self, db: Session, user_id: int) -> list[Store]:
        return list(db.scalars(select(Store).where(Store.user_id == user_id).order_by(desc(Store.updated_at))))

    def get_store_or_404(self, db: Session, user_id: int, store_id: int) -> Store:
        store = db.scalar(select(Store).where(Store.user_id == user_id, Store.id == store_id))
        if not store:
            raise HTTPException(status_code=404, detail="店铺不存在")
        return store

    def create(self, db: Session, user_id: int, payload: StoreCreate) -> Store:
        store = Store(user_id=user_id, **payload.model_dump())
        db.add(store)
        db.commit()
        db.refresh(store)
        return store

    def update(self, db: Session, store: Store, payload: StoreUpdate) -> Store:
        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(store, key, value)
        db.commit()
        db.refresh(store)
        return store

    def delete(self, db: Session, store: Store) -> None:
        db.execute(delete(SuggestionRecord).where(SuggestionRecord.store_id == store.id))
        db.execute(delete(Dish).where(Dish.store_id == store.id))
        db.execute(delete(StoreProfile).where(StoreProfile.store_id == store.id))
        db.delete(store)
        db.commit()


class StoreProfileService:
    def upsert(self, db: Session, store: Store, payload: StoreProfileUpsertRequest) -> StoreProfile:
        profile = store.profile or StoreProfile(store_id=store.id)
        if profile.id is None:
            db.add(profile)
        summary = ai_service.generate_store_profile_summary(payload.answers)
        profile.onboarding_status = "completed"
        profile.answers_json = payload.answers
        profile.style_keywords = summary["style_keywords"]
        profile.plating_direction = summary["plating_direction"]
        profile.tone_of_voice = summary["tone_of_voice"]
        profile.overall_style_summary = summary["overall_style_summary"]
        db.commit()
        db.refresh(profile)
        return profile

    def skip(self, db: Session, store: Store) -> StoreProfile:
        profile = store.profile or StoreProfile(store_id=store.id)
        if profile.id is None:
            db.add(profile)
        profile.onboarding_status = "skipped"
        profile.answers_json = profile.answers_json or {}
        profile.style_keywords = profile.style_keywords or []
        db.commit()
        db.refresh(profile)
        return profile


class DishService:
    def list(self, db: Session, store: Store, keyword: str | None = None) -> list[Dish]:
        stmt = select(Dish).where(Dish.store_id == store.id).order_by(desc(Dish.updated_at))
        if keyword:
            stmt = stmt.where(Dish.name.ilike(f"%{keyword}%"))
        return list(db.scalars(stmt))

    def get_or_404(self, db: Session, store: Store, dish_id: int) -> Dish:
        dish = db.scalar(select(Dish).where(Dish.store_id == store.id, Dish.id == dish_id))
        if not dish:
            raise HTTPException(status_code=404, detail="菜品不存在")
        return dish

    def create(self, db: Session, store: Store, payload: DishInput) -> Dish:
        dish = Dish(store_id=store.id, has_image=bool(payload.image_url), **payload.model_dump())
        db.add(dish)
        db.commit()
        db.refresh(dish)
        return dish

    def update(self, db: Session, dish: Dish, payload: DishInput | dict) -> Dish:
        data = payload.model_dump(exclude_unset=True) if isinstance(payload, DishInput) else payload
        for key, value in data.items():
            setattr(dish, key, value)
        if "image_url" in data:
            dish.has_image = bool(dish.image_url)
        db.commit()
        db.refresh(dish)
        return dish


class AIService:
    PROVIDER_LABELS = {
        "mock": "Mock AI",
        "openai": "OpenAI",
        "anthropic": "Anthropic",
        "gemini": "Google Gemini",
        "openai_compatible": "OpenAI-Compatible",
    }

    PROFILE_FIELD_LABELS = {
        "customer_groups": "客群",
        "price_range": "客单价",
        "consumption_scenarios": "消费场景",
        "store_styles": "店铺风格",
        "desired_feelings": "最想传递的感觉",
        "differentiators": "顾客选择本店的原因",
        "customer_descriptions": "希望顾客如何描述本店",
        "photogenic_level": "是否适合拍照",
        "emotion_tags": "店铺情绪标签",
        "fit_scenarios": "更适合的场景",
        "restaurant_style": "餐厅风格",
        "signature_focus": "突出卖点",
        "target_customers": "目标顾客",
        "desired_feeling": "希望顾客感受到的感觉",
        "tone_preference": "文案与服务表达偏好",
    }

    def generate_store_profile_summary(self, answers: dict[str, Any]) -> dict:
        prompt_answers = self._format_store_profile_answers(answers)
        prompt = (
            "你是餐厅品牌与菜单表达顾问。"
            "请根据店铺问答，总结一份轻量店铺风格档案。"
            "你必须返回 JSON，字段严格符合给定 schema。"
            "JSON 键名必须严格使用英文，所有值的内容必须用中文输出。"
            "style_keywords 控制在 3 到 6 个短词，必须为中文词汇。"
            f"\n店铺回答：{json.dumps(self._json_ready(prompt_answers), ensure_ascii=False)}"
        )
        result = self._generate_json(
            system_prompt=(
                "请只输出 JSON，不要输出 markdown，不要解释。"
                "JSON 键名必须严格使用英文，不得翻译。所有值的内容必须为中文。"
            ),
            user_prompt=prompt,
            schema=STORE_PROFILE_SCHEMA,
            image_url=None,
        )
        result = self._ensure_response_chinese(result)
        if not isinstance(result.get("style_keywords"), list):
            if settings.ai_fallback_to_mock:
                result = self._mock_response(prompt, None, STORE_PROFILE_SCHEMA)
            else:
                raise ValueError("Invalid store profile response")
        return {
            "style_keywords": [str(item) for item in result["style_keywords"]][:6],
            "plating_direction": str(result.get("plating_direction", "")),
            "tone_of_voice": str(result.get("tone_of_voice", "")),
            "overall_style_summary": str(result.get("overall_style_summary", "")),
        }

    def _format_store_profile_answers(self, answers: dict[str, Any]) -> dict[str, Any]:
        formatted: dict[str, Any] = {}
        for key, value in answers.items():
            normalized = self._normalize_profile_answer_value(value)
            if normalized in (None, "", [], {}):
                continue
            label = self.PROFILE_FIELD_LABELS.get(key, key)
            formatted[label] = normalized
        return formatted or {"说明": "暂无已填写的店铺风格信息"}

    def _normalize_profile_answer_value(self, value: Any) -> Any:
        if isinstance(value, str):
            return value.strip()
        if isinstance(value, list):
            items = [str(item).strip() for item in value if str(item).strip()]
            return items
        if isinstance(value, dict):
            selected = value.get("selected")
            custom = value.get("custom")
            if isinstance(selected, list):
                items = [str(item).strip() for item in selected if str(item).strip()]
                if isinstance(custom, list):
                    items.extend(str(item).strip() for item in custom if str(item).strip())
                elif isinstance(custom, str) and custom.strip():
                    items.append(custom.strip())
                return items
            if isinstance(selected, str):
                selected_text = selected.strip()
                custom_items: list[str] = []
                if isinstance(custom, list):
                    custom_items = [str(item).strip() for item in custom if str(item).strip()]
                elif isinstance(custom, str) and custom.strip():
                    custom_items = [custom.strip()]
                if selected_text and selected_text != "其他":
                    return [selected_text, *custom_items] if custom_items else selected_text
                if len(custom_items) == 1:
                    return custom_items[0]
                return custom_items
            normalized: dict[str, Any] = {}
            for nested_key, nested_value in value.items():
                nested_normalized = self._normalize_profile_answer_value(nested_value)
                if nested_normalized not in (None, "", [], {}):
                    normalized[str(nested_key)] = nested_normalized
            return normalized
        return value

    def generate_dish_suggestions(
        self,
        store: Store,
        dish: dict,
        profile: StoreProfile | None,
        extra_goal: str | None,
    ) -> tuple[SuggestionResult, dict[str, Any]]:
        style = {
            "keywords": profile.style_keywords if profile else [],
            "plating_direction": profile.plating_direction if profile else None,
            "tone_of_voice": profile.tone_of_voice if profile else None,
            "overall_style_summary": profile.overall_style_summary if profile else None,
        }
        dish_json = self._json_ready(dish)
        prompt = (
            "你是专业餐饮品牌包装与菜品视觉顾问。"
            "请根据店铺信息、店铺风格档案、菜品信息，输出结构化 JSON 建议。"
            "JSON 键名必须严格使用英文，所有值的内容必须用中文输出。"
            "建议必须可执行、简洁、适合中小餐厅使用。"
            "service_lines 输出 1 到 3 条简洁直接型中文话术。"
            f"\n店铺信息：{json.dumps(self._json_ready({'name': store.name, 'restaurant_type': store.restaurant_type, 'cuisine_type': store.cuisine_type, 'average_price': store.average_price}), ensure_ascii=False)}"
            f"\n店铺风格档案：{json.dumps(self._json_ready(style), ensure_ascii=False)}"
            f"\n菜品信息：{json.dumps(dish_json, ensure_ascii=False)}"
            f"\n额外目标：{extra_goal or ''}"
        )
        schema_json = json.dumps(SUGGESTION_SCHEMA, ensure_ascii=False)
        result, model_info = self._generate_json_with_meta(
            system_prompt=(
                "请只输出 JSON，不要输出 markdown，不要解释。"
                "JSON 键名必须严格使用英文，不得翻译。所有值的内容必须为中文。"
                f"\n必须遵守的 JSON schema：{schema_json}"
            ),
            user_prompt=prompt,
            schema=SUGGESTION_SCHEMA,
            image_url=dish_json.get("image_url"),
        )
        result = self._ensure_response_chinese(result)
        try:
            suggestion = SuggestionResult.model_validate(result)
        except Exception as exc:
            if not settings.ai_fallback_to_mock:
                raise HTTPException(status_code=502, detail=f"AI 返回格式异常：{exc}") from exc
            result = self._mock_response(prompt, dish_json.get("image_url"), SUGGESTION_SCHEMA)
            result = self._ensure_response_chinese(result)
            suggestion = SuggestionResult.model_validate(result)
            model_info = {"provider": "mock", "fallback_used": True, "fallback_reason": f"Schema validation: {exc}"}
        return suggestion, model_info

    def _generate_json(self, system_prompt: str, user_prompt: str, schema: dict[str, Any], image_url: str | None) -> dict[str, Any]:
        result, _ = self._generate_json_with_meta(system_prompt, user_prompt, schema, image_url)
        return result

    def _generate_json_with_meta(
        self,
        system_prompt: str,
        user_prompt: str,
        schema: dict[str, Any],
        image_url: str | None,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        provider = self._resolve_provider()
        if provider == "mock":
            return self._mock_response(user_prompt, image_url, schema), {"provider": "mock", "fallback_used": False}

        try:
            if provider == "openai":
                return self._call_openai(system_prompt, user_prompt, schema, image_url)
            if provider == "anthropic":
                return self._call_anthropic(system_prompt, user_prompt, schema, image_url)
            if provider == "gemini":
                return self._call_gemini(system_prompt, user_prompt, schema, image_url)
            if provider == "openai_compatible":
                return self._call_compatible(system_prompt, user_prompt, schema, image_url)
            raise ValueError(f"Unsupported provider: {provider}")
        except Exception as exc:
            if not settings.ai_fallback_to_mock:
                raise HTTPException(status_code=502, detail=f"AI 调用失败：{exc}") from exc
            fallback = self._mock_response(user_prompt, image_url, schema)
            return fallback, {
                "provider": provider,
                "fallback_used": True,
                "fallback_reason": str(exc),
            }

    def get_status(self) -> dict[str, Any]:
        info = self._provider_info()
        provider = info["resolved_provider"]
        using_mock = provider == "mock"
        if using_mock and info["configured"]:
            message = "已配置真实 provider，但当前可能会在失败时回退到 mock。"
        elif using_mock:
            message = "当前未启用真实模型，将使用 mock 生成。"
        else:
            message = "已配置真实 AI provider，可进行连通性测试。"
        return {
            **info,
            "using_mock": using_mock,
            "message": message,
        }

    def test_connection(self) -> dict[str, Any]:
        info = self._provider_info()
        start = perf_counter()
        provider = info["resolved_provider"]
        if provider == "mock":
            latency_ms = int((perf_counter() - start) * 1000)
            return {
                **info,
                "success": True,
                "fallback_used": False,
                "latency_ms": latency_ms,
                "message": "当前处于 mock 模式，应用可运行，但未验证真实模型连通性。",
                "details": {"mode": "mock"},
            }

        try:
            result, meta = self._call_provider_direct(
                provider=provider,
                system_prompt="请只输出 JSON。",
                user_prompt="返回一个 JSON 对象，包含字段 ok=true 与 provider。",
                schema={
                    "type": "object",
                    "properties": {
                        "ok": {"type": "boolean"},
                        "provider": {"type": "string"},
                    },
                    "required": ["ok", "provider"],
                },
                image_url=None,
            )
            latency_ms = int((perf_counter() - start) * 1000)
            return {
                **info,
                "success": True,
                "fallback_used": False,
                "latency_ms": latency_ms,
                "message": "真实 AI provider 连通性测试成功。",
                "details": {"response": result, **meta},
            }
        except Exception as exc:
            latency_ms = int((perf_counter() - start) * 1000)
            return {
                **info,
                "success": False,
                "fallback_used": False,
                "latency_ms": latency_ms,
                "message": f"真实 AI provider 连通性测试失败：{exc}",
                "details": {"error": str(exc)},
            }

    def _resolve_provider(self) -> str:
        provider = settings.ai_provider.strip().lower()
        if provider != "auto":
            return provider
        if settings.compatible_api_key and settings.compatible_base_url and settings.compatible_model:
            return "openai_compatible"
        if settings.openai_api_key:
            return "openai"
        if settings.anthropic_api_key:
            return "anthropic"
        if settings.gemini_api_key:
            return "gemini"
        return "mock"

    def _provider_info(self) -> dict[str, Any]:
        configured_provider = settings.ai_provider.strip().lower()
        resolved_provider = self._resolve_provider()
        model = self._model_for_provider(resolved_provider)
        configured = self._is_provider_configured(resolved_provider)
        if resolved_provider == "mock" and configured_provider == "auto":
            configured = any(
                [
                    bool(settings.compatible_api_key and settings.compatible_model and settings.compatible_base_url),
                    bool(settings.openai_api_key and settings.openai_model),
                    bool(settings.anthropic_api_key and settings.anthropic_model),
                    bool(settings.gemini_api_key and settings.gemini_model),
                ]
            )
        provider_label = self.PROVIDER_LABELS.get(resolved_provider, resolved_provider)
        if resolved_provider == "openai_compatible" and settings.compatible_provider_name.strip():
            provider_label = settings.compatible_provider_name.strip()
        return {
            "configured_provider": configured_provider,
            "resolved_provider": resolved_provider,
            "provider_label": provider_label,
            "model": model,
            "configured": configured,
            "supports_image_input": resolved_provider in {"openai", "anthropic", "gemini", "openai_compatible"},
            "fallback_to_mock": settings.ai_fallback_to_mock,
        }

    def _model_for_provider(self, provider: str) -> str | None:
        if provider == "openai":
            return settings.openai_model
        if provider == "anthropic":
            return settings.anthropic_model
        if provider == "gemini":
            return settings.gemini_model
        if provider == "openai_compatible":
            return settings.compatible_model or None
        return None

    def _is_provider_configured(self, provider: str) -> bool:
        if provider == "openai":
            return bool(settings.openai_api_key and settings.openai_model)
        if provider == "anthropic":
            return bool(settings.anthropic_api_key and settings.anthropic_model)
        if provider == "gemini":
            return bool(settings.gemini_api_key and settings.gemini_model)
        if provider == "openai_compatible":
            return bool(settings.compatible_api_key and settings.compatible_model and settings.compatible_base_url)
        return True

    def _call_provider_direct(
        self,
        provider: str,
        system_prompt: str,
        user_prompt: str,
        schema: dict[str, Any],
        image_url: str | None,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        if provider == "openai":
            return self._call_openai(system_prompt, user_prompt, schema, image_url)
        if provider == "anthropic":
            return self._call_anthropic(system_prompt, user_prompt, schema, image_url)
        if provider == "gemini":
            return self._call_gemini(system_prompt, user_prompt, schema, image_url)
        if provider == "openai_compatible":
            return self._call_compatible(system_prompt, user_prompt, schema, image_url)
        if provider == "mock":
            return self._mock_response(user_prompt, image_url, schema), {"provider": "mock", "fallback_used": False}
        raise RuntimeError(f"Unsupported provider: {provider}")

    def _call_openai(
        self,
        system_prompt: str,
        user_prompt: str,
        schema: dict[str, Any],
        image_url: str | None,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        url = f"{settings.openai_base_url.rstrip('/')}/chat/completions"
        payload = {
            "model": settings.openai_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": self._build_openai_content(user_prompt, image_url),
                },
            ],
            "response_format": {"type": "json_object"},
        }
        data = self._post_json(
            url=url,
            headers={
                "Authorization": f"Bearer {settings.openai_api_key}",
                "Content-Type": "application/json",
            },
            payload=payload,
        )
        text = data["choices"][0]["message"]["content"]
        return json.loads(text), {"provider": "openai", "model": settings.openai_model, "fallback_used": False}

    def _call_compatible(
        self,
        system_prompt: str,
        user_prompt: str,
        schema: dict[str, Any],
        image_url: str | None,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        url = f"{settings.compatible_base_url.rstrip('/')}/chat/completions"
        headers = {
            "Content-Type": "application/json",
            **self._safe_json_dict(settings.compatible_extra_headers_json),
        }
        key_header = settings.compatible_api_key_header.strip() or "Authorization"
        prefix = settings.compatible_api_key_prefix.strip()
        headers[key_header] = f"{prefix} {settings.compatible_api_key}".strip()
        payload = {
            "model": settings.compatible_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": self._build_openai_content(user_prompt, image_url)},
            ],
            "response_format": {"type": "json_object"},
            **self._safe_json_dict(settings.compatible_extra_body_json),
        }
        data = self._post_json(url=url, headers=headers, payload=payload)
        text = data["choices"][0]["message"]["content"]
        return json.loads(text), {
            "provider": settings.compatible_provider_name or "openai-compatible",
            "model": settings.compatible_model,
            "fallback_used": False,
        }

    def _call_anthropic(
        self,
        system_prompt: str,
        user_prompt: str,
        schema: dict[str, Any],
        image_url: str | None,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        url = f"{settings.anthropic_base_url.rstrip('/')}/v1/messages"
        content: list[dict[str, Any]] = []
        image_block = self._build_anthropic_image_block(image_url)
        if image_block:
            content.append(image_block)
        content.append({"type": "text", "text": user_prompt})
        payload = {
            "model": settings.anthropic_model,
            "max_tokens": 1600,
            "system": f"{system_prompt}\nJSON schema:\n{json.dumps(schema, ensure_ascii=False)}",
            "messages": [{"role": "user", "content": content}],
        }
        data = self._post_json(
            url=url,
            headers={
                "x-api-key": settings.anthropic_api_key,
                "anthropic-version": settings.anthropic_version,
                "content-type": "application/json",
            },
            payload=payload,
        )
        text_parts = [block.get("text", "") for block in data.get("content", []) if block.get("type") == "text"]
        return json.loads("".join(text_parts)), {
            "provider": "anthropic",
            "model": settings.anthropic_model,
            "fallback_used": False,
        }

    def _call_gemini(
        self,
        system_prompt: str,
        user_prompt: str,
        schema: dict[str, Any],
        image_url: str | None,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        model = parse.quote(settings.gemini_model, safe="")
        url = f"{settings.gemini_base_url.rstrip('/')}/models/{model}:generateContent"
        parts: list[dict[str, Any]] = [{"text": f"{system_prompt}\n{user_prompt}"}]
        image_part = self._build_gemini_image_part(image_url)
        if image_part:
            parts.insert(0, image_part)
        payload = {
            "contents": [{"parts": parts}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseJsonSchema": schema,
            },
        }
        data = self._post_json(
            url=url,
            headers={
                "x-goog-api-key": settings.gemini_api_key,
                "Content-Type": "application/json",
            },
            payload=payload,
        )
        candidate_parts = data["candidates"][0]["content"]["parts"]
        text = "".join(part.get("text", "") for part in candidate_parts if part.get("text"))
        return json.loads(text), {"provider": "gemini", "model": settings.gemini_model, "fallback_used": False}

    def _build_openai_content(self, user_prompt: str, image_url: str | None) -> list[dict[str, Any]]:
        content: list[dict[str, Any]] = [{"type": "text", "text": user_prompt}]
        image_data_url = self._build_data_url(image_url)
        if image_data_url:
            content.append(
                {
                    "type": "image_url",
                    "image_url": {
                        "url": image_data_url,
                        "detail": "auto",
                    },
                }
            )
        return content

    def _build_anthropic_image_block(self, image_url: str | None) -> dict[str, Any] | None:
        image = self._read_local_image(image_url)
        if not image:
            return None
        return {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": image["mime_type"],
                "data": image["base64"],
            },
        }

    def _build_gemini_image_part(self, image_url: str | None) -> dict[str, Any] | None:
        image = self._read_local_image(image_url)
        if not image:
            return None
        return {
            "inline_data": {
                "mime_type": image["mime_type"],
                "data": image["base64"],
            }
        }

    def _build_data_url(self, image_url: str | None) -> str | None:
        image = self._read_local_image(image_url)
        if not image:
            return None
        return f"data:{image['mime_type']};base64,{image['base64']}"

    def _read_local_image(self, image_url: str | None) -> dict[str, str] | None:
        if not image_url:
            return None
        parsed = parse.urlparse(image_url)
        image_path = parsed.path if parsed.scheme else image_url
        if not image_path:
            return None
        relative = image_path.lstrip("/").replace("/", "\\")
        candidate = Path(settings.upload_dir).parent / relative
        if not candidate.exists() or not candidate.is_file():
            return None
        mime_type = mimetypes.guess_type(candidate.name)[0] or "image/jpeg"
        data = base64.b64encode(candidate.read_bytes()).decode("utf-8")
        return {"mime_type": mime_type, "base64": data}

    def _build_opener(self):
        proxy_url = settings.ai_proxy_url.strip()
        if proxy_url:
            proxy_handler = request.ProxyHandler({
                "http": proxy_url,
                "https": proxy_url,
            })
            return request.build_opener(proxy_handler)
        return request.build_opener()

    def _post_json(self, url: str, headers: dict[str, str], payload: dict[str, Any]) -> dict[str, Any]:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        req = request.Request(url=url, data=body, headers=headers, method="POST")
        opener = self._build_opener()
        try:
            with opener.open(req, timeout=settings.ai_timeout_seconds) as response:
                return json.loads(response.read().decode("utf-8"))
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"HTTP {exc.code}: {detail}") from exc
        except error.URLError as exc:
            raise RuntimeError(f"Network error: {exc.reason}") from exc

    def _safe_json_dict(self, value: str) -> dict[str, Any]:
        if not value.strip():
            return {}
        parsed = json.loads(value)
        if not isinstance(parsed, dict):
            raise ValueError("Configured JSON value must be an object")
        return parsed

    def _json_ready(self, value: Any) -> Any:
        if isinstance(value, Decimal):
            return float(value)
        if isinstance(value, dict):
            return {str(key): self._json_ready(item) for key, item in value.items()}
        if isinstance(value, (list, tuple)):
            return [self._json_ready(item) for item in value]
        return value

    def _mock_response(self, user_prompt: str, image_url: str | None, schema: dict[str, Any]) -> dict[str, Any]:
        if schema is STORE_PROFILE_SCHEMA:
            return {
                "style_keywords": ["温暖", "实用", "适合分享"],
                "plating_direction": "保持菜品清晰、有食欲，便于日常出餐时稳定复现。",
                "tone_of_voice": "直接、温暖、有食欲，不过于正式。",
                "overall_style_summary": user_prompt[:220] or "一份实用的店铺风格档案，帮助提升日常菜品展示效果。",
            }
        return {
            "plating_suggestions": {
                "main_placement": "主料居中摆放，适当增加高度层次，让菜品第一眼就清晰可辨。",
                "garnish": "用与食材相关的点缀代替纯装饰性摆件，保持简洁。",
                "spacing": "保留约 20% 留白空间，让手机拍照时画面更干净。",
                "plateware": "选用简洁餐具，衬托店铺风格，不喧宾夺主。",
            },
            "visual_suggestions": {
                "color": "保持食材本身的色彩对比，避免混合光源让食物颜色失真。",
                "background": "使用干净的桌面背景，移除画面中无关的物品。",
                "angle": "45 度特写" if image_url else "稍微俯拍的角度，适合菜单展示和社交分享",
                "lighting": "优先使用柔和的侧光，避免顶部强光直射产生眩光。",
            },
            "copywriting": {
                "story": "这道菜应该给人可靠、值得推荐的感觉，让人吃了就记住。",
                "menu_description": "更清爽、更有食欲的呈现方式，让顾客一眼就能理解菜品的亮点。",
                "marketing_line": "摆盘更清爽，卖得更快，随手一拍就能分享。",
            },
            "service_lines": [
                "这道菜趁热上桌效果最好，摆盘完整度很高，推荐优先介绍。",
                "口味容易接受，适合向第一次来的客人推荐，基本不会出错。",
                "有需要的话，我们可以针对社交平台的传播再微调这一版的呈现方式。",
            ],
            "notes": {
                "used_store_profile": "店铺风格档案" in user_prompt,
                "image_mode": bool(image_url),
                "extra_goal": "",
            },
        }

    def _collect_string_values(self, data: Any) -> list[str]:
        result: list[str] = []
        if isinstance(data, str):
            result.append(data)
        elif isinstance(data, dict):
            for v in data.values():
                result.extend(self._collect_string_values(v))
        elif isinstance(data, list):
            for item in data:
                result.extend(self._collect_string_values(item))
        return result

    def _is_mostly_english(self, text: str) -> bool:
        cjk = sum(1 for c in text if "一" <= c <= "鿿")
        alpha = sum(1 for c in text if c.isascii() and c.isalpha())
        total = cjk + alpha
        if total == 0:
            return False
        return (cjk / total) < 0.2

    def _ensure_response_chinese(self, result: dict[str, Any]) -> dict[str, Any]:
        strings = self._collect_string_values(result)
        combined = " ".join(strings)
        if not combined or not self._is_mostly_english(combined):
            return result

        try:
            translate_prompt = (
                "请将以下 JSON 中所有英文字符串值翻译为中文。"
                "保持 JSON 结构完全不变，只翻译字符串 value 的内容，key 不要动。"
                "翻译结果必须仍然是合法 JSON。"
                f"\n{json.dumps(result, ensure_ascii=False)}"
            )
            translated = self._generate_json(
                system_prompt="你是翻译助手，请将输入中的所有英文翻译为中文。只输出翻译后的 JSON，不要解释。",
                user_prompt=translate_prompt,
                schema={"type": "object"},
                image_url=None,
            )
            return self._merge_translations(result, translated)
        except Exception:
            return result

    def _merge_translations(self, original: dict[str, Any], translated: dict[str, Any]) -> dict[str, Any]:
        merged: dict[str, Any] = {}
        for key, value in original.items():
            tv = translated.get(key)
            if isinstance(value, str) and isinstance(tv, str):
                merged[key] = tv
            elif isinstance(value, dict) and isinstance(tv, dict):
                merged[key] = self._merge_translations(value, tv)
            elif isinstance(value, list) and isinstance(tv, list):
                merged[key] = [
                    self._merge_translations(item, titem) if isinstance(item, dict) and isinstance(titem, dict)
                    else titem if isinstance(item, str) and isinstance(titem, str)
                    else item
                    for i, (item, titem) in enumerate(zip(value, tv))
                ]
            else:
                merged[key] = value
        return merged


class SuggestionService:
    def generate(self, db: Session, store: Store, payload: GenerateSuggestionRequest) -> GenerateSuggestionResponse:
        dish_payload = ai_service._json_ready(payload.dish.model_dump())
        if payload.dish_id:
            dish = dish_service.get_or_404(db, store, payload.dish_id)
            dish = dish_service.update(db, dish, payload.dish)
        else:
            dish = dish_service.create(db, store, payload.dish)
        profile = store.profile if payload.use_store_profile else None
        result, model_info = ai_service.generate_dish_suggestions(store, dish_payload, profile, payload.extra_goal)
        suggestion = SuggestionRecord(
            dish_id=dish.id,
            store_id=store.id,
            based_on_store_profile=bool(profile and profile.onboarding_status == "completed"),
            input_snapshot_json={
                "store_id": store.id,
                "dish_id": dish.id,
                "dish": dish_payload,
                "use_store_profile": payload.use_store_profile,
                "extra_goal": payload.extra_goal,
            },
            plating_suggestions=result.plating_suggestions,
            visual_suggestions=result.visual_suggestions,
            story_copy=result.copywriting.story,
            menu_copy=result.copywriting.menu_description,
            marketing_copy=result.copywriting.marketing_line,
            service_lines=result.service_lines,
            model_info=model_info,
        )
        db.add(suggestion)
        db.commit()
        db.refresh(suggestion)
        return GenerateSuggestionResponse(dish=dish, suggestion_record=self.to_response(suggestion))

    def list_for_dish(self, db: Session, store: Store, dish_id: int) -> list[SuggestionRecordResponse]:
        stmt = (
            select(SuggestionRecord)
            .where(SuggestionRecord.store_id == store.id, SuggestionRecord.dish_id == dish_id)
            .order_by(desc(SuggestionRecord.created_at))
        )
        return [self.to_response(item) for item in db.scalars(stmt)]

    def get_by_id(self, db: Session, user_id: int, suggestion_id: int) -> SuggestionRecordResponse:
        stmt = (
            select(SuggestionRecord)
            .join(Store, Store.id == SuggestionRecord.store_id)
            .where(SuggestionRecord.id == suggestion_id, Store.user_id == user_id)
        )
        suggestion = db.scalar(stmt)
        if not suggestion:
            raise HTTPException(status_code=404, detail="建议记录不存在")
        return self.to_response(suggestion)

    def to_response(self, suggestion: SuggestionRecord) -> SuggestionRecordResponse:
        return SuggestionRecordResponse(
            id=suggestion.id,
            based_on_store_profile=suggestion.based_on_store_profile,
            input_snapshot_json=suggestion.input_snapshot_json,
            plating_suggestions=suggestion.plating_suggestions,
            visual_suggestions=suggestion.visual_suggestions,
            copywriting=CopywritingBlock(
                story=suggestion.story_copy or "",
                menu_description=suggestion.menu_copy or "",
                marketing_line=suggestion.marketing_copy or "",
            ),
            service_lines=suggestion.service_lines,
            model_info=suggestion.model_info,
            created_at=suggestion.created_at,
        )


class UploadService:
    allowed_types = {"image/jpeg", "image/png", "image/webp"}

    def save_image(self, upload: UploadFile) -> tuple[str, str]:
        if upload.content_type not in self.allowed_types:
            raise HTTPException(status_code=400, detail="不支持的图片格式")
        root = Path(settings.upload_dir)
        now = datetime.now()
        target_dir = root / f"{now.year:04d}" / f"{now.month:02d}"
        target_dir.mkdir(parents=True, exist_ok=True)
        extension = Path(upload.filename or "upload.jpg").suffix or ".jpg"
        filename = f"{uuid.uuid4().hex}{extension}"
        destination = target_dir / filename
        with destination.open("wb") as buffer:
            shutil.copyfileobj(upload.file, buffer)
        return "/" + destination.relative_to(root.parent).as_posix(), filename


auth_service = AuthService()
store_service = StoreService()
store_profile_service = StoreProfileService()
dish_service = DishService()
ai_service = AIService()
suggestion_service = SuggestionService()
upload_service = UploadService()
