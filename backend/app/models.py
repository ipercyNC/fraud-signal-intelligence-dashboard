from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


CaseStatus = Literal["New", "In Review", "Escalated", "Cleared", "Declined"]


class Note(BaseModel):
    id: str
    author: str
    timestamp: datetime
    text: str


class CaseRecord(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    application_id: str = Field(alias="applicationId")
    final_disposition: CaseStatus = Field(alias="finalDisposition")
    investigator: str
    closed_at: datetime = Field(alias="closedAt")
    time_to_disposition_hours: int = Field(alias="timeToDispositionHours")
    notes: list[Note] = Field(default_factory=list)


class NoteCreateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1200)

    @field_validator("text")
    @classmethod
    def validate_text(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Note text must not be empty")
        return stripped


class DispositionRequest(BaseModel):
    status: CaseStatus


class AIBriefRequest(BaseModel):
    force_refresh: bool = Field(default=False, alias="forceRefresh")


class AIBriefResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    application_id: str = Field(alias="applicationId")
    mode: Literal["demo", "live", "fallback"]
    cached: bool
    limited: bool
    fallback: bool
    summary_bullets: list[str] = Field(alias="summaryBullets")
    recommended_action: str = Field(alias="recommendedAction")
    generated_at: datetime = Field(alias="generatedAt")


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=256)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class AuthUser(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    email: str
    display_name: str = Field(alias="displayName")


class LoginResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    access_token: str = Field(alias="accessToken")
    token_type: Literal["Bearer"] = Field(alias="tokenType")
    expires_in: int = Field(alias="expiresIn")
    user: AuthUser
