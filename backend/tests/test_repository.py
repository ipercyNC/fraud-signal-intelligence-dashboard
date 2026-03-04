from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend.app import repository


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


class RepositoryTests(unittest.TestCase):
    def test_repository_seeds_and_persists(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            localdb = root / "localdb"
            localdb.mkdir(parents=True, exist_ok=True)

            (localdb / "applications.json").write_text(json.dumps([_sample_application()]), encoding="utf-8")
            (localdb / "rules.json").write_text(
                json.dumps(
                    [
                        {
                            "id": "SIG_ID_01",
                            "name": "Address mismatch",
                            "category": "Identity",
                            "weight": 12,
                            "status": "Active",
                            "defaultWeight": 12,
                        }
                    ]
                ),
                encoding="utf-8",
            )

            with patch.object(repository, "LOCAL_DB_DIR", localdb), patch.object(
                repository, "APPLICATIONS_DB_PATH", localdb / "applications.json"
            ), patch.object(repository, "RULES_DB_PATH", localdb / "rules.json"), patch.object(
                repository, "CASES_DB_PATH", localdb / "cases.json"
            ):
                cases = repository.load_cases()
                self.assertEqual(len(cases), 1)
                self.assertEqual(cases[0].application_id, "APP-0001")

                updated_note = repository.add_case_note("APP-0001", "QA", "First test note")
                self.assertIsNotNone(updated_note)
                assert updated_note is not None
                self.assertEqual(len(updated_note.notes), 1)

                updated_disp = repository.update_case_disposition("APP-0001", "Escalated")
                self.assertIsNotNone(updated_disp)
                assert updated_disp is not None
                self.assertEqual(updated_disp.final_disposition, "Escalated")

                reloaded = repository.load_cases()
                self.assertEqual(reloaded[0].final_disposition, "Escalated")
                self.assertEqual(len(reloaded[0].notes), 1)


if __name__ == "__main__":
    unittest.main()
