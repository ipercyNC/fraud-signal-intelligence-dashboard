from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

from .models import CaseRecord, CaseStatus, Note


ROOT = Path(__file__).resolve().parents[2]
LEGACY_DATA_DIR = ROOT / "data"
LOCAL_DB_DIR = ROOT / "backend" / "localdb"
APPLICATIONS_DB_PATH = LOCAL_DB_DIR / "applications.json"
RULES_DB_PATH = LOCAL_DB_DIR / "rules.json"
CASES_DB_PATH = LOCAL_DB_DIR / "cases.json"

INVESTIGATORS = ["A. Cruz", "N. Patel", "D. Carter", "J. Kim", "S. Walker"]


def _hash_code(value: str) -> int:
    hashed = 0
    for character in value:
        hashed = ((hashed << 5) - hashed + ord(character)) & 0xFFFFFFFF
    return abs(hashed)


def _default_disposition(application: dict[str, Any]) -> CaseStatus:
    tags = application.get("patternTags", [])
    has_pattern = isinstance(tags, list) and len(tags) > 0
    hash_value = _hash_code(application["id"])
    if has_pattern and hash_value % 4 == 0:
        return "Declined"
    if has_pattern and hash_value % 3 == 0:
        return "Escalated"
    if hash_value % 5 == 0:
        return "In Review"
    return "Cleared"


def _read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _seed_from_legacy_if_missing(target_path: Path, legacy_name: str) -> None:
    if target_path.exists():
        return
    legacy_path = LEGACY_DATA_DIR / legacy_name
    if not legacy_path.exists():
        raise FileNotFoundError(
            f"Missing local DB file {target_path}. Expected to seed from {legacy_path}, but it was not found."
        )
    payload = _read_json(legacy_path)
    _safe_write_json(target_path, payload)


def load_applications() -> list[dict[str, Any]]:
    _seed_from_legacy_if_missing(APPLICATIONS_DB_PATH, "applications.json")
    data = _read_json(APPLICATIONS_DB_PATH)
    return data if isinstance(data, list) else []


def load_rules() -> list[dict[str, Any]]:
    _seed_from_legacy_if_missing(RULES_DB_PATH, "rules.json")
    data = _read_json(RULES_DB_PATH)
    return data if isinstance(data, list) else []


def _seed_cases(applications: list[dict[str, Any]]) -> list[CaseRecord]:
    rows: list[CaseRecord] = []
    for application in applications:
        hash_value = _hash_code(application["id"])
        investigator = INVESTIGATORS[hash_value % len(INVESTIGATORS)]
        disposition = _default_disposition(application)
        hours = 2 + (hash_value % 96)
        submitted_at = datetime.fromisoformat(application["timestamps"]["submittedAt"].replace("Z", "+00:00"))
        rows.append(
            CaseRecord(
                applicationId=application["id"],
                finalDisposition=disposition,
                investigator=investigator,
                closedAt=submitted_at + timedelta(hours=hours),
                timeToDispositionHours=hours,
                notes=[],
            )
        )
    return rows


def _safe_write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as temp_handle:
        json.dump(payload, temp_handle, indent=2)
        temp_handle.write("\n")
        temp_name = temp_handle.name
    Path(temp_name).replace(path)


def load_cases() -> list[CaseRecord]:
    applications = load_applications()
    if not CASES_DB_PATH.exists():
        seeded = _seed_cases(applications)
        save_cases(seeded)
        return seeded

    with CASES_DB_PATH.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    return [CaseRecord.model_validate(item) for item in data]


def save_cases(rows: list[CaseRecord]) -> None:
    payload = [row.model_dump(by_alias=True, mode="json") for row in rows]
    _safe_write_json(CASES_DB_PATH, payload)


def update_case_disposition(application_id: str, status: CaseStatus) -> CaseRecord | None:
    rows = load_cases()
    target: CaseRecord | None = None
    for index, row in enumerate(rows):
        if row.application_id != application_id:
            continue
        updated = row.model_copy(update={"final_disposition": status})
        if status in {"Cleared", "Declined"}:
            updated = updated.model_copy(
                update={
                    "closed_at": datetime.now(timezone.utc),
                    "time_to_disposition_hours": max(updated.time_to_disposition_hours, 1),
                }
            )
        rows[index] = updated
        target = updated
        break

    if not target:
        return None
    save_cases(rows)
    return target


def add_case_note(application_id: str, author: str, text: str) -> CaseRecord | None:
    rows = load_cases()
    target: CaseRecord | None = None
    for index, row in enumerate(rows):
        if row.application_id != application_id:
            continue
        note = Note(
            id=f"{application_id}-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
            author=author.strip(),
            text=text.strip(),
            timestamp=datetime.now(timezone.utc),
        )
        updated = row.model_copy(update={"notes": [note, *row.notes]})
        rows[index] = updated
        target = updated
        break

    if not target:
        return None
    save_cases(rows)
    return target
