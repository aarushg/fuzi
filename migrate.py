"""
One-time migration: import all existing JSON data files into fuzi.db (SQLite).

Run this ONCE before starting the app for the first time after switching to SQLite:
    python migrate.py

It is safe to run again — records are upserted (insert or replace), so
re-running will refresh any records that changed in the JSON files but will not
create duplicates.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).parent

# ── Bootstrap db without importing app ─────────────────────────────────────
sys.path.insert(0, str(ROOT))
import db

db.init_db()

# ── List collections: JSON file stem → table name ───────────────────────────
LIST_FILES = [
    "project_tickets",
    "install_jobs",
    "install_team",
    "users",
    "customers",
    "inventory",
    "org_chart",
    "attendance",
    "estimates",
    "customer_users",
    "payments",
    "sales_inquiries",
    "sales_admin_panel",
    "breakdowns",
    "service_records",
    "gad_records",
    "commissionings",
    "factory_jobs",
    "tenders",
    "dept_comms",
]

# ── KV collections: JSON file stem → kv key ─────────────────────────────────
KV_FILES = [
    "operations_state",
]

total_records = 0

for stem in LIST_FILES:
    path = ROOT / f"{stem}.json"
    if not path.exists():
        print(f"  SKIP  {stem}.json  (not found)")
        continue
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        print(f"  ERROR {stem}.json  ({exc})")
        continue
    if not isinstance(data, list):
        print(f"  SKIP  {stem}.json  (not a list)")
        continue
    db.save_collection(stem, data)
    print(f"  OK    {stem:30s}  {len(data):5d} records")
    total_records += len(data)

for stem in KV_FILES:
    path = ROOT / f"{stem}.json"
    if not path.exists():
        print(f"  SKIP  {stem}.json  (not found)")
        continue
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        print(f"  ERROR {stem}.json  ({exc})")
        continue
    if not isinstance(data, dict):
        print(f"  SKIP  {stem}.json  (not a dict)")
        continue
    db.save_kv(stem, data)
    print(f"  OK    {stem:30s}  (kv entry)")

print(f"\nMigration complete. {total_records} records written to {db.DB_PATH}")
print("You can now start the app with:  python app.py")
