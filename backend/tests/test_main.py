from __future__ import annotations

import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from fastapi import HTTPException

from backend.app.main import ai_brief, health
from backend.app.models import AIBriefRequest, AIBriefResponse, AuthUser


class MainFunctionTests(unittest.TestCase):
    def test_health(self) -> None:
        result = health()
        self.assertEqual(result["status"], "ok")
        self.assertIn("timestamp", result)

    def test_ai_brief_success(self) -> None:
        response = AIBriefResponse(
            applicationId="APP-0001",
            mode="demo",
            cached=False,
            limited=False,
            fallback=False,
            summaryBullets=["a", "b", "c", "d", "e"],
            recommendedAction="In Review",
            generatedAt=datetime.now(timezone.utc),
        )
        with patch("backend.app.main.generate_ai_brief", return_value=response):
            result = ai_brief(
                "APP-0001",
                AIBriefRequest(forceRefresh=False),
                AuthUser(email="qa@local.test", displayName="QA"),
            )
        self.assertEqual(result.application_id, "APP-0001")
        self.assertEqual(result.mode, "demo")

    def test_ai_brief_not_found(self) -> None:
        with patch("backend.app.main.generate_ai_brief", side_effect=KeyError("missing")):
            with self.assertRaises(HTTPException) as context:
                ai_brief(
                    "MISSING",
                    AIBriefRequest(forceRefresh=False),
                    AuthUser(email="qa@local.test", displayName="QA"),
                )
        self.assertEqual(context.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
