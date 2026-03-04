from __future__ import annotations

import logging
import os
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from .ai_service import generate_ai_brief
from .auth import authenticate_user, issue_access_token, validate_access_token
from .models import (
    AIBriefRequest,
    AIBriefResponse,
    AuthUser,
    CaseRecord,
    DispositionRequest,
    LoginRequest,
    LoginResponse,
    NoteCreateRequest,
)
from .repository import (
    add_case_note,
    load_applications,
    load_cases,
    load_rules,
    update_case_disposition,
)

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")

logger = logging.getLogger("fraud-api")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
if os.getenv("DEMO_MODE", "true").strip().lower() in {"1", "true", "yes", "on"}:
    logger.warning("DEMO_MODE enabled. Demo credentials and secrets are for prototype use only.")


class SecureHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response


class RequestLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable):
        started = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - started) * 1000
        logger.info("%s %s %s %.1fms", request.method, request.url.path, response.status_code, elapsed_ms)
        return response


class WriteRateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: FastAPI, requests_per_minute: int = 60) -> None:
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.ip_hits: dict[str, deque[float]] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next: Callable):
        if request.method not in {"POST", "PUT", "PATCH", "DELETE"}:
            return await call_next(request)

        now = time.time()
        client = request.client.host if request.client else "unknown"
        hits = self.ip_hits[client]
        while hits and now - hits[0] > 60:
            hits.popleft()
        if len(hits) >= self.requests_per_minute:
            return JSONResponse(status_code=429, content={"detail": "Write rate limit exceeded"})
        hits.append(now)
        return await call_next(request)


def _origins() -> list[str]:
    raw = os.getenv("FRONTEND_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173")
    return [entry.strip() for entry in raw.split(",") if entry.strip()]


def require_auth(authorization: str | None = Header(default=None)) -> AuthUser:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid Authorization header")
    token = parts[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Bearer token missing")
    try:
        return validate_access_token(token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


app = FastAPI(title="Fraud Ops API", version="0.1.0")
app.add_middleware(RequestLogMiddleware)
app.add_middleware(WriteRateLimitMiddleware)
app.add_middleware(SecureHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/api/health")
def api_health() -> dict[str, str]:
    return health()


@app.post("/api/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest) -> LoginResponse:
    try:
        user = authenticate_user(payload.email, payload.password)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    try:
        response = issue_access_token(user)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    logger.info("auth_login_success email=%s", user.email)
    return response


@app.get("/api/applications")
def applications(_: AuthUser = Depends(require_auth)) -> list[dict]:
    return load_applications()


@app.get("/api/rules")
def rules(_: AuthUser = Depends(require_auth)) -> list[dict]:
    return load_rules()


@app.get("/api/cases", response_model=list[CaseRecord])
def cases(_: AuthUser = Depends(require_auth)) -> list[CaseRecord]:
    return load_cases()


@app.post("/api/cases/{application_id}/notes", response_model=CaseRecord)
def add_note(application_id: str, payload: NoteCreateRequest, user: AuthUser = Depends(require_auth)) -> CaseRecord:
    updated = add_case_note(application_id, user.display_name, payload.text)
    if not updated:
        raise HTTPException(status_code=404, detail="Case not found")
    logger.info("case_note_added application_id=%s actor=%s author=%s", application_id, user.email, user.display_name)
    return updated


@app.post("/api/cases/{application_id}/disposition", response_model=CaseRecord)
def set_disposition(
    application_id: str,
    payload: DispositionRequest,
    user: AuthUser = Depends(require_auth),
) -> CaseRecord:
    updated = update_case_disposition(application_id, payload.status)
    if not updated:
        raise HTTPException(status_code=404, detail="Case not found")
    logger.info("case_disposition_updated application_id=%s actor=%s status=%s", application_id, user.email, payload.status)
    return updated


@app.post("/api/cases/{application_id}/ai-brief", response_model=AIBriefResponse)
def ai_brief(
    application_id: str,
    payload: AIBriefRequest,
    user: AuthUser = Depends(require_auth),
) -> AIBriefResponse:
    try:
        result = generate_ai_brief(application_id, payload.force_refresh)
    except KeyError:
        raise HTTPException(status_code=404, detail="Case not found")
    logger.info(
        "case_ai_brief_generated application_id=%s actor=%s mode=%s cached=%s",
        application_id,
        user.email,
        result.mode,
        result.cached,
    )
    return result
