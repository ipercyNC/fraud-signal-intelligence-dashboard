from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend.app import auth, repository
from backend.app.main import add_note, login, require_auth, set_disposition
from backend.app.models import DispositionRequest, LoginRequest, NoteCreateRequest


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


class CaseWorkflowIntegrationTests(unittest.TestCase):
    def test_note_to_disposition_persists_after_reload(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            localdb = root / "localdb"
            localdb.mkdir(parents=True, exist_ok=True)

            (localdb / "applications.json").write_text(json.dumps([_sample_application()]), encoding="utf-8")
            (localdb / "rules.json").write_text(json.dumps([]), encoding="utf-8")

            users_path = localdb / "users.json"
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

            with patch.object(repository, "LOCAL_DB_DIR", localdb), patch.object(
                repository, "APPLICATIONS_DB_PATH", localdb / "applications.json"
            ), patch.object(repository, "RULES_DB_PATH", localdb / "rules.json"), patch.object(
                repository, "CASES_DB_PATH", localdb / "cases.json"
            ), patch.object(auth, "USERS_DB_PATH", users_path), patch.dict(
                "os.environ",
                {"JWT_SECRET": "integration-test-secret"},
                clear=False,
            ):
                token = login(LoginRequest(email="demo@local.test", password="demo-password")).access_token
                user = require_auth(f"Bearer {token}")

                note_result = add_note(
                    "APP-0001",
                    NoteCreateRequest(text="integration test note"),
                    user,
                )
                self.assertEqual(len(note_result.notes), 1)
                self.assertEqual(note_result.notes[0].text, "integration test note")
                self.assertEqual(note_result.notes[0].author, "Demo User")

                disposition_result = set_disposition(
                    "APP-0001",
                    DispositionRequest(status="Escalated"),
                    user,
                )
                self.assertEqual(disposition_result.final_disposition, "Escalated")

                reloaded = repository.load_cases()
                self.assertEqual(len(reloaded), 1)
                self.assertEqual(reloaded[0].final_disposition, "Escalated")
                self.assertEqual(len(reloaded[0].notes), 1)
                self.assertEqual(reloaded[0].notes[0].text, "integration test note")


if __name__ == "__main__":
    unittest.main()
