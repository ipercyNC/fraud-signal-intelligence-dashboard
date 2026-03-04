from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.app import ai_service, auth, repository
from backend.app.main import app


def _sample_application() -> dict:
    return {
        "id": "APP-0001",
        "carrier": "NorthRiver",
        "product": "Term Life",
        "channel": "Direct",
        "timestamps": {
            "startedAt": "2026-03-01T10:00:00.000Z",
            "submittedAt": "2026-03-01T10:03:00.000Z",
            "completionDurationSec": 180,
            "restartCount": 0,
        },
        "applicant": {
            "firstName": "Alex",
            "lastName": "Smith",
            "maskedName": "A*** S***",
            "dob": "1989-01-01",
            "maskedSSN": "***-**-1111",
            "phone": "+1-555-200-1000",
            "email": "alex@mail.test",
            "address": {"line1": "1 Oak", "city": "Dallas", "state": "TX", "zip": "75001"},
            "ipState": "TX",
        },
        "deviceSession": {
            "deviceFingerprint": "dfp-111111",
            "userAgentFamily": "Chrome",
            "pasteInKeyFields": False,
            "questionnaireDurationSec": 120,
            "submittedLocalHour": 11,
        },
        "financial": {
            "annualIncome": 90000,
            "coverageAmount": 250000,
            "existingPolicies": 1,
            "coverageIncomeRatio": 2.78,
        },
        "beneficiary": {
            "name": "Pat Smith",
            "relation": "Spouse",
            "sameAddress": True,
            "isImmediateFamily": True,
        },
        "agent": {"id": "AGT-0001", "name": "Jordan Lee", "state": "TX"},
        "patternTags": [],
    }


class ApiHttpIntegrationTests(unittest.TestCase):
    def test_login_and_case_mutations_over_http(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            localdb = root / "localdb"
            localdb.mkdir(parents=True, exist_ok=True)

            (localdb / "applications.json").write_text(json.dumps([_sample_application()]), encoding="utf-8")
            (localdb / "rules.json").write_text(json.dumps([]), encoding="utf-8")
            (localdb / "users.json").write_text(
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

            with patch.object(repository, "LOCAL_DB_DIR", localdb), patch.object(
                repository, "APPLICATIONS_DB_PATH", localdb / "applications.json"
            ), patch.object(repository, "RULES_DB_PATH", localdb / "rules.json"), patch.object(
                repository, "CASES_DB_PATH", localdb / "cases.json"
            ), patch.object(auth, "USERS_DB_PATH", localdb / "users.json"), patch.object(
                ai_service, "AI_CACHE_PATH", localdb / "ai_cache.json"
            ), patch.object(
                ai_service, "AI_USAGE_PATH", localdb / "ai_usage.json"
            ), patch.dict(
                "os.environ", {"JWT_SECRET": "integration-test-secret", "AI_MODE": "demo"}, clear=False
            ):
                client = TestClient(app)

                unauthorized = client.get("/api/applications")
                self.assertEqual(unauthorized.status_code, 401)

                login_res = client.post(
                    "/api/auth/login",
                    json={"email": "demo@local.test", "password": "demo-password"},
                )
                self.assertEqual(login_res.status_code, 200)
                token = login_res.json()["accessToken"]
                headers = {"Authorization": f"Bearer {token}"}

                applications_res = client.get("/api/applications", headers=headers)
                self.assertEqual(applications_res.status_code, 200)
                self.assertEqual(len(applications_res.json()), 1)

                invalid_note_res = client.post(
                    "/api/cases/APP-0001/notes",
                    json={"text": "   "},
                    headers=headers,
                )
                self.assertEqual(invalid_note_res.status_code, 422)

                note_res = client.post(
                    "/api/cases/APP-0001/notes",
                    json={"text": "HTTP integration note"},
                    headers=headers,
                )
                self.assertEqual(note_res.status_code, 200)
                self.assertEqual(note_res.json()["notes"][0]["text"], "HTTP integration note")

                disposition_res = client.post(
                    "/api/cases/APP-0001/disposition",
                    json={"status": "Escalated"},
                    headers=headers,
                )
                self.assertEqual(disposition_res.status_code, 200)
                self.assertEqual(disposition_res.json()["finalDisposition"], "Escalated")

                persisted_cases = repository.load_cases()
                self.assertEqual(len(persisted_cases), 1)
                self.assertEqual(persisted_cases[0].final_disposition, "Escalated")
                self.assertEqual(len(persisted_cases[0].notes), 1)


if __name__ == "__main__":
    unittest.main()
