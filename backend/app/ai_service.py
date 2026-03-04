from __future__ import annotations

import hashlib
import json
import os
import logging
from datetime import date, datetime, timezone
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen

from .models import AIBriefResponse, CaseRecord
from .repository import load_applications, load_cases


ROOT = Path(__file__).resolve().parents[2]
FIXTURES_PATH = ROOT / "backend" / "fixtures" / "ai_briefs.json"
LOCAL_DB_DIR = ROOT / "backend" / "localdb"
AI_CACHE_PATH = LOCAL_DB_DIR / "ai_cache.json"
AI_USAGE_PATH = LOCAL_DB_DIR / "ai_usage.json"
logger = logging.getLogger("fraud-api.ai")


def _read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _safe_write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as temp_handle:
        json.dump(payload, temp_handle, indent=2)
        temp_handle.write("\n")
        temp_name = temp_handle.name
    Path(temp_name).replace(path)


def _estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


def _app_and_case(application_id: str) -> tuple[dict[str, Any], CaseRecord]:
    app_map = {application["id"]: application for application in load_applications()}
    case_map = {case.application_id: case for case in load_cases()}
    app = app_map.get(application_id)
    case = case_map.get(application_id)
    if not app or not case:
        raise KeyError(application_id)
    return app, case


def _normalized_payload(app: dict[str, Any], case: CaseRecord) -> dict[str, Any]:
    return {
        "applicationId": app["id"],
        "maskedName": app["applicant"]["maskedName"],
        "maskedSSN": app["applicant"]["maskedSSN"],
        "product": app["product"],
        "channel": app["channel"],
        "state": app["applicant"]["address"]["state"],
        "ipState": app["applicant"]["ipState"],
        "coverageAmount": app["financial"]["coverageAmount"],
        "coverageIncomeRatio": app["financial"]["coverageIncomeRatio"],
        "submittedAt": app["timestamps"]["submittedAt"],
        "completionDurationSec": app["timestamps"]["completionDurationSec"],
        "restartCount": app["timestamps"]["restartCount"],
        "beneficiaryRelation": app["beneficiary"]["relation"],
        "beneficiaryImmediateFamily": app["beneficiary"]["isImmediateFamily"],
        "agentId": app["agent"]["id"],
        "patternTags": app.get("patternTags", []),
        "disposition": case.final_disposition,
        "noteCount": len(case.notes),
        "latestNote": case.notes[0].text if case.notes else "",
    }


def _payload_hash(payload: dict[str, Any]) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _fallback_from_payload(payload: dict[str, Any], limited: bool) -> tuple[list[str], str]:
    tags = set(payload.get("patternTags", []))
    bullets = [
        f"Case {payload['applicationId']} is in {payload['state']} with {payload['product']} submitted via {payload['channel']}.",
        f"Coverage is ${payload['coverageAmount']:,} with ratio {payload['coverageIncomeRatio']:.2f} and completion in {payload['completionDurationSec']}s.",
        f"Identity context: declared state {payload['state']} vs IP state {payload['ipState']}; beneficiary relation {payload['beneficiaryRelation']}.",
        f"Pattern tags observed: {', '.join(sorted(tags)) if tags else 'none'}; investigator notes: {payload['noteCount']}.",
        "AI output is deterministic fallback because live generation was unavailable or budget-limited."
        if limited
        else "AI output is deterministic fallback because live generation is not configured.",
    ]

    if "agent-beneficiary-conflict" in tags or "stoli-indicator" in tags:
        action = "Escalate to SIU"
    elif "velocity-ring" in tags or payload["coverageIncomeRatio"] >= 15:
        action = "Refer to Underwriter"
    elif payload["coverageIncomeRatio"] < 8 and not tags:
        action = "Clear"
    else:
        action = "In Review"

    return bullets, action


def _load_usage() -> dict[str, int | str]:
    usage = _read_json(AI_USAGE_PATH, {"date": str(date.today()), "calls": 0, "tokens": 0})
    if usage.get("date") != str(date.today()):
        usage = {"date": str(date.today()), "calls": 0, "tokens": 0}
    return usage


def _can_spend(tokens_needed: int) -> tuple[bool, dict[str, int | str]]:
    usage = _load_usage()
    max_calls = int(os.getenv("AI_DAILY_CALL_CAP", "50"))
    max_tokens = int(os.getenv("AI_DAILY_TOKEN_CAP", "50000"))
    calls = int(usage.get("calls", 0))
    tokens = int(usage.get("tokens", 0))
    if calls + 1 > max_calls or tokens + tokens_needed > max_tokens:
        return False, usage
    return True, usage


def _record_spend(usage: dict[str, int | str], tokens_used: int) -> None:
    usage["calls"] = int(usage.get("calls", 0)) + 1
    usage["tokens"] = int(usage.get("tokens", 0)) + max(0, tokens_used)
    usage["date"] = str(date.today())
    _safe_write_json(AI_USAGE_PATH, usage)


def _demo_fixture(application_id: str) -> tuple[list[str], str]:
    fixtures = _read_json(FIXTURES_PATH, {})
    data = fixtures.get(application_id)
    if data:
        return list(data["summaryBullets"])[:5], str(data["recommendedAction"])
    generic = [
        "Case profile aligns with moderate-risk submission patterns that require investigator confirmation.",
        "Current evidence supports focused review of identity, velocity, and beneficiary context.",
        "No single indicator is fully dispositive without additional investigator notes.",
        "Operationally, this case should stay in prioritized manual queue until disposition confidence improves.",
        "Use signal-level detail and linked entities to determine escalation threshold.",
    ]
    return generic, "In Review"


def _live_openai(payload: dict[str, Any]) -> tuple[list[str], str, int]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY missing")

    model = os.getenv("AI_MODEL", "gpt-4o-mini")
    max_output_tokens = int(os.getenv("AI_MAX_OUTPUT_TOKENS", "220"))
    system_prompt = (
        "You are a fraud-investigation copilot. Return strict JSON with keys "
        "`summaryBullets` (array of exactly 5 short bullets) and `recommendedAction` "
        "(one of: Clear, In Review, Refer to Underwriter, Escalate to SIU, Decline)."
    )
    user_prompt = json.dumps(payload, separators=(",", ":"), sort_keys=True)

    req_body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
        "max_tokens": max_output_tokens,
        "response_format": {"type": "json_object"},
    }

    request = Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(req_body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=20) as response:
            response_payload = json.loads(response.read().decode("utf-8"))
    except URLError as exc:
        raise RuntimeError(f"OpenAI request failed: {exc}") from exc

    content = response_payload["choices"][0]["message"]["content"]
    parsed = json.loads(content)
    bullets = [str(item).strip() for item in parsed.get("summaryBullets", []) if str(item).strip()]
    bullets = (bullets + ["Additional investigation detail required."] * 5)[:5]
    action = str(parsed.get("recommendedAction", "In Review"))

    usage = response_payload.get("usage", {})
    total_tokens = int(usage.get("total_tokens", _estimate_tokens(system_prompt + user_prompt)))
    return bullets, action, total_tokens


def generate_ai_brief(application_id: str, force_refresh: bool = False) -> AIBriefResponse:
    app, case = _app_and_case(application_id)
    payload = _normalized_payload(app, case)
    payload_key = _payload_hash(payload)
    now = datetime.now(timezone.utc)

    cache = _read_json(AI_CACHE_PATH, {})
    if not force_refresh and payload_key in cache:
        cached = cache[payload_key]
        return AIBriefResponse.model_validate(
            {
                "applicationId": application_id,
                "mode": cached["mode"],
                "cached": True,
                "limited": cached.get("limited", False),
                "fallback": cached.get("fallback", False),
                "summaryBullets": cached["summaryBullets"],
                "recommendedAction": cached["recommendedAction"],
                "generatedAt": cached["generatedAt"],
            }
        )

    mode = os.getenv("AI_MODE", "demo").strip().lower()
    prompt_tokens = _estimate_tokens(json.dumps(payload, separators=(",", ":"), sort_keys=True))
    budget_ok, usage = _can_spend(prompt_tokens + int(os.getenv("AI_MAX_OUTPUT_TOKENS", "220")))

    if not budget_ok:
        bullets, action = _fallback_from_payload(payload, limited=True)
        response = AIBriefResponse(
            applicationId=application_id,
            mode="fallback",
            cached=False,
            limited=True,
            fallback=True,
            summaryBullets=bullets,
            recommendedAction=action,
            generatedAt=now,
        )
        cache[payload_key] = response.model_dump(by_alias=True, mode="json")
        _safe_write_json(AI_CACHE_PATH, cache)
        return response

    if mode == "live":
        try:
            bullets, action, total_tokens = _live_openai(payload)
            _record_spend(usage, total_tokens)
            response = AIBriefResponse(
                applicationId=application_id,
                mode="live",
                cached=False,
                limited=False,
                fallback=False,
                summaryBullets=bullets,
                recommendedAction=action,
                generatedAt=now,
            )
        except Exception as exc:
            logger.exception("ai_live_generation_failed application_id=%s reason=%s", application_id, exc)
            bullets, action = _fallback_from_payload(payload, limited=False)
            _record_spend(usage, prompt_tokens)
            response = AIBriefResponse(
                applicationId=application_id,
                mode="fallback",
                cached=False,
                limited=False,
                fallback=True,
                summaryBullets=bullets,
                recommendedAction=action,
                generatedAt=now,
            )
    elif mode == "demo":
        bullets, action = _demo_fixture(application_id)
        _record_spend(usage, prompt_tokens)
        response = AIBriefResponse(
            applicationId=application_id,
            mode="demo",
            cached=False,
            limited=False,
            fallback=False,
            summaryBullets=bullets,
            recommendedAction=action,
            generatedAt=now,
        )
    else:
        bullets, action = _fallback_from_payload(payload, limited=False)
        _record_spend(usage, prompt_tokens)
        response = AIBriefResponse(
            applicationId=application_id,
            mode="fallback",
            cached=False,
            limited=False,
            fallback=True,
            summaryBullets=bullets,
            recommendedAction=action,
            generatedAt=now,
        )

    cache[payload_key] = response.model_dump(by_alias=True, mode="json")
    _safe_write_json(AI_CACHE_PATH, cache)
    return response
