from __future__ import annotations

import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import app as fuzi_app


PAYLOADS_PATH = Path(r"C:\Users\User\Documents\GitHub\fuzi1spreadsheets\outputs\new_estimate_payloads.json")


def _disable_nonessential_side_effects() -> None:
    def noop(*args, **kwargs):
        return None

    fuzi_app.send_business_channel_update = noop
    fuzi_app.send_metrics_channel_snapshot = noop
    fuzi_app.send_catalog_channel_snapshot = noop


def existing_key(estimate: dict) -> tuple[str, str, str]:
    return (
        str(estimate.get("customer_name", "")).strip(),
        str(estimate.get("remark_1", "")).strip(),
        str(estimate.get("remark_3", "")).strip(),
    )


def payload_key(payload: dict) -> tuple[str, str, str]:
    return (
        str(payload.get("customer_name", "")).strip(),
        str(payload.get("remark_1", "")).strip(),
        str(payload.get("remark_3", "")).strip(),
    )


def main() -> int:
    _disable_nonessential_side_effects()
    records = json.loads(PAYLOADS_PATH.read_text(encoding="utf-8"))
    existing = {existing_key(estimate) for estimate in fuzi_app.ESTIMATES}
    created: list[dict] = []
    skipped: list[dict] = []

    client = fuzi_app.app.test_client()
    with client.session_transaction() as session:
        session["portal_user"] = "admin"
        session["portal_role"] = "admin"
        session["portal_name"] = "Portal Administrator"
        session["portal_department"] = "Management"

    for record in records:
        payload = record["payload"]
        key = payload_key(payload)
        if key in existing:
            skipped.append({"source_file": record["source_file"], "variant": record["variant"], "reason": "already_exists"})
            continue

        response = client.post("/api/portal/estimates", json=payload)
        data = response.get_json(silent=True) or {}
        if response.status_code >= 400 or not data.get("ok"):
            raise RuntimeError(
                f"Failed to save {record['source_file']} / {record['variant']}: "
                f"HTTP {response.status_code} {data}"
            )

        estimate = data["estimate"]
        created.append(
            {
                "id": estimate["id"],
                "source_file": record["source_file"],
                "variant": record["variant"],
                "total_cost": estimate.get("total_cost"),
            }
        )
        existing.add(key)

    print(json.dumps({"created": created, "skipped": skipped}, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
