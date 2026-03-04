from __future__ import annotations

import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

from backend.app import ai_service
from backend.app.models import CaseRecord


def _sample_app(app_id: str) -> dict:
    return {
        "id": app_id,
        "applicant": {"maskedName": "A***", "maskedSSN": "***", "address": {"state": "TX"}, "ipState": "TX"},
        "product": "Term Life",
        "channel": "Direct",
        "financial": {"coverageAmount": 250000, "coverageIncomeRatio": 2.8},
        "timestamps": {"submittedAt": "2026-03-01T10:00:00.000Z", "completionDurationSec": 120, "restartCount": 0},
        "beneficiary": {"relation": "Spouse", "isImmediateFamily": True},
        "agent": {"id": "AGT-0001"},
        "patternTags": [],
    }


def _sample_case(app_id: str) -> CaseRecord:
    return CaseRecord(
        applicationId=app_id,
        finalDisposition="In Review",
        investigator="QA",
        closedAt=datetime.now(timezone.utc),
        timeToDispositionHours=3,
        notes=[],
    )


class AIServiceTests(unittest.TestCase):
    def test_demo_mode_and_cache(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            fixtures = root / "ai_briefs.json"
            fixtures.write_text(
                json.dumps(
                    {
                        "APP-0001": {
                            "summaryBullets": ["a", "b", "c", "d", "e"],
                            "recommendedAction": "Refer to Underwriter",
                        }
                    }
                ),
                encoding="utf-8",
            )

            with patch.object(ai_service, "FIXTURES_PATH", fixtures), patch.object(
                ai_service, "AI_CACHE_PATH", root / "ai_cache.json"
            ), patch.object(ai_service, "AI_USAGE_PATH", root / "ai_usage.json"), patch.dict(
                "os.environ",
                {"AI_MODE": "demo", "AI_DAILY_CALL_CAP": "20", "AI_DAILY_TOKEN_CAP": "50000"},
                clear=False,
            ), patch.object(ai_service, "_app_and_case", return_value=(_sample_app("APP-0001"), _sample_case("APP-0001"))):
                first = ai_service.generate_ai_brief("APP-0001", force_refresh=False)
                second = ai_service.generate_ai_brief("APP-0001", force_refresh=False)

                self.assertEqual(first.mode, "demo")
                self.assertFalse(first.cached)
                self.assertEqual(len(first.summary_bullets), 5)
                self.assertTrue(second.cached)

    def test_budget_limit_fallback(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            with patch.object(ai_service, "AI_CACHE_PATH", root / "ai_cache.json"), patch.object(
                ai_service, "AI_USAGE_PATH", root / "ai_usage.json"
            ), patch.dict(
                "os.environ",
                {"AI_MODE": "demo", "AI_DAILY_CALL_CAP": "0"},
                clear=False,
            ), patch.object(ai_service, "_app_and_case", return_value=(_sample_app("APP-0002"), _sample_case("APP-0002"))):
                result = ai_service.generate_ai_brief("APP-0002", force_refresh=True)
                self.assertEqual(result.mode, "fallback")
                self.assertTrue(result.limited)
                self.assertTrue(result.fallback)


if __name__ == "__main__":
    unittest.main()
