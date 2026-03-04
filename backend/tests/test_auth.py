from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException

from backend.app import auth
from backend.app.main import login, require_auth
from backend.app.models import LoginRequest


class AuthFlowTests(unittest.TestCase):
    def test_login_issues_token_and_guard_accepts_bearer(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            users_path = root / "users.json"
            users_path.write_text(
                json.dumps(
                    [
                        {
                            "email": "demo@local.test",
                            "displayName": "Demo User",
                            "salt": "00112233445566778899aabbccddeeff",
                            "passwordHash": auth._hash_password("demo-password", "00112233445566778899aabbccddeeff"),
                            "iterations": 200000,
                        }
                    ]
                ),
                encoding="utf-8",
            )

            with patch.object(auth, "USERS_DB_PATH", users_path), patch.dict(
                "os.environ",
                {"JWT_SECRET": "unit-test-secret"},
                clear=False,
            ):
                result = login(LoginRequest(email="demo@local.test", password="demo-password"))
                self.assertTrue(result.access_token)
                self.assertEqual(result.user.email, "demo@local.test")

                user = require_auth(f"Bearer {result.access_token}")
                self.assertEqual(user.email, "demo@local.test")

    def test_login_rejects_bad_password(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            users_path = root / "users.json"
            users_path.write_text(
                json.dumps(
                    [
                        {
                            "email": "demo@local.test",
                            "displayName": "Demo User",
                            "salt": "00112233445566778899aabbccddeeff",
                            "passwordHash": auth._hash_password("demo-password", "00112233445566778899aabbccddeeff"),
                            "iterations": 200000,
                        }
                    ]
                ),
                encoding="utf-8",
            )

            with patch.object(auth, "USERS_DB_PATH", users_path), patch.dict(
                "os.environ",
                {"JWT_SECRET": "unit-test-secret"},
                clear=False,
            ):
                with self.assertRaises(HTTPException) as context:
                    login(LoginRequest(email="demo@local.test", password="wrong-password"))
                self.assertEqual(context.exception.status_code, 401)

    def test_require_auth_rejects_missing_header(self) -> None:
        with self.assertRaises(HTTPException) as context:
            require_auth(None)
        self.assertEqual(context.exception.status_code, 401)


if __name__ == "__main__":
    unittest.main()
