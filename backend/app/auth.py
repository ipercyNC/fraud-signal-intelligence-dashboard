from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

from .models import AuthUser, LoginResponse


ROOT = Path(__file__).resolve().parents[2]
LOCAL_DB_DIR = ROOT / "backend" / "localdb"
USERS_DB_PATH = LOCAL_DB_DIR / "users.json"


def _is_demo_mode() -> bool:
    return os.getenv("DEMO_MODE", "true").strip().lower() in {"1", "true", "yes", "on"}


def _safe_write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as temp_handle:
        json.dump(payload, temp_handle, indent=2)
        temp_handle.write("\n")
        temp_name = temp_handle.name
    Path(temp_name).replace(path)


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64url_decode(raw: str) -> bytes:
    padding = "=" * ((4 - len(raw) % 4) % 4)
    return base64.urlsafe_b64decode((raw + padding).encode("ascii"))


def _jwt_secret() -> str:
    configured = os.getenv("JWT_SECRET", "").strip()
    if configured:
        return configured
    if _is_demo_mode():
        return "demo-jwt-secret-change-me"
    raise RuntimeError("JWT_SECRET must be set when DEMO_MODE is false")


def _jwt_lifetime_seconds() -> int:
    value = os.getenv("JWT_EXPIRES_SECONDS", "28800")
    try:
        parsed = int(value)
    except ValueError:
        parsed = 28800
    return max(300, parsed)


def _hash_password(password: str, salt_hex: str, iterations: int = 200_000) -> str:
    salt = bytes.fromhex(salt_hex)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return hashed.hex()


def _verify_password(password: str, expected_hash_hex: str, salt_hex: str, iterations: int) -> bool:
    computed = _hash_password(password, salt_hex, iterations)
    return hmac.compare_digest(computed, expected_hash_hex)


def _default_user_record() -> dict[str, Any]:
    if _is_demo_mode():
        email = os.getenv("DEMO_USER_EMAIL", "investigator@local.test").strip().lower()
        password = os.getenv("DEMO_USER_PASSWORD", "change-me-demo-password")
    else:
        email = os.getenv("DEMO_USER_EMAIL", "").strip().lower()
        password = os.getenv("DEMO_USER_PASSWORD", "")
        if not email or not password:
            raise RuntimeError("DEMO_USER_EMAIL and DEMO_USER_PASSWORD must be set when DEMO_MODE is false")
    display_name = os.getenv("DEMO_USER_NAME", "Demo Investigator").strip() or "Demo Investigator"

    salt_hex = hashlib.sha256(f"{email}:seed".encode("utf-8")).hexdigest()[:32]
    iterations = 200_000
    password_hash = _hash_password(password, salt_hex, iterations)

    return {
        "email": email,
        "displayName": display_name,
        "salt": salt_hex,
        "passwordHash": password_hash,
        "iterations": iterations,
    }


def _load_users() -> list[dict[str, Any]]:
    if not USERS_DB_PATH.exists():
        users = [_default_user_record()]
        _safe_write_json(USERS_DB_PATH, users)
        return users
    with USERS_DB_PATH.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    return data if isinstance(data, list) else []


def authenticate_user(email: str, password: str) -> AuthUser | None:
    lookup = email.strip().lower()
    for row in _load_users():
        if str(row.get("email", "")).strip().lower() != lookup:
            continue
        expected_hash = str(row.get("passwordHash", ""))
        salt = str(row.get("salt", ""))
        iterations = int(row.get("iterations", 200_000))
        if not expected_hash or not salt:
            return None
        if _verify_password(password, expected_hash, salt, iterations):
            return AuthUser(email=lookup, displayName=str(row.get("displayName", "Investigator")))
        return None
    return None


def issue_access_token(user: AuthUser) -> LoginResponse:
    now = datetime.now(timezone.utc)
    expires_in = _jwt_lifetime_seconds()
    payload = {
        "sub": user.email,
        "name": user.display_name,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=expires_in)).timestamp()),
    }
    header = {"alg": "HS256", "typ": "JWT"}

    header_segment = _b64url_encode(json.dumps(header, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    payload_segment = _b64url_encode(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    signing_input = f"{header_segment}.{payload_segment}".encode("ascii")
    signature = hmac.new(_jwt_secret().encode("utf-8"), signing_input, hashlib.sha256).digest()
    token = f"{header_segment}.{payload_segment}.{_b64url_encode(signature)}"

    return LoginResponse(
        accessToken=token,
        tokenType="Bearer",
        expiresIn=expires_in,
        user=user,
    )


def validate_access_token(token: str) -> AuthUser:
    try:
        header_segment, payload_segment, signature_segment = token.split(".", 2)
    except ValueError as exc:
        raise ValueError("Malformed token") from exc

    signing_input = f"{header_segment}.{payload_segment}".encode("ascii")
    expected_signature = hmac.new(_jwt_secret().encode("utf-8"), signing_input, hashlib.sha256).digest()
    provided_signature = _b64url_decode(signature_segment)
    if not hmac.compare_digest(provided_signature, expected_signature):
        raise ValueError("Invalid token signature")

    payload = json.loads(_b64url_decode(payload_segment).decode("utf-8"))
    exp = int(payload.get("exp", 0))
    if exp <= int(datetime.now(timezone.utc).timestamp()):
        raise ValueError("Token expired")

    email = str(payload.get("sub", "")).strip().lower()
    if not email:
        raise ValueError("Token subject missing")

    display_name = str(payload.get("name", "Investigator"))
    return AuthUser(email=email, displayName=display_name)
