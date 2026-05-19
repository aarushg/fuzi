from __future__ import annotations

from datetime import datetime
from functools import wraps
import json
import os
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, redirect, render_template, request, send_from_directory, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash


BASE_DIR = Path(__file__).resolve().parent

app = Flask(
    __name__,
    template_folder=str(BASE_DIR / "templates"),
    static_folder=str(BASE_DIR / "static"),
)
app.secret_key = os.environ.get("FUZI_SECRET_KEY", "dev-only-fuzi-secret")

PORTAL_USER = os.environ.get("FUZI_PORTAL_USER", "admin")
PORTAL_PASSWORD = os.environ.get("FUZI_PORTAL_PASSWORD", "fuzi2026")
TICKETS_FILE = BASE_DIR / "project_tickets.json"
INSTALL_JOBS_FILE = BASE_DIR / "install_jobs.json"
INSTALL_TEAM_FILE = BASE_DIR / "install_team.json"
USERS_FILE = BASE_DIR / "users.json"
CUSTOMERS_FILE = BASE_DIR / "customers.json"

DEFAULT_PROJECT_TICKETS: list[dict[str, Any]] = [
    {
        "id": "PT-1001",
        "project": "Raja Park Modernization",
        "title": "Permit file pending fire department sign-off",
        "owner": "A. Singhal",
        "status": "Blocked",
        "priority": "High",
        "due": "Today",
        "notes": "Missing stamped drawing set. Follow up with consultant before 4 PM.",
        "created_at": "2026-05-16 09:20",
    },
    {
        "id": "PT-1002",
        "project": "Mansarovar Residency",
        "title": "ARD battery kit supplier confirmation",
        "owner": "N. Khan",
        "status": "Open",
        "priority": "High",
        "due": "Tomorrow",
        "notes": "ERP stock is zero. Vendor promised callback with dispatch ETA.",
        "created_at": "2026-05-16 10:05",
    },
    {
        "id": "PT-1003",
        "project": "City Mall AMC Upgrade",
        "title": "Inspection checklist review",
        "owner": "R. Sharma",
        "status": "In Progress",
        "priority": "Medium",
        "due": "May 21",
        "notes": "Confirm escalator comb plate test photos before final inspection.",
        "created_at": "2026-05-16 11:15",
    },
]

INSTALL_STAGES: list[dict[str, Any]] = [
    {
        "id": "planning",
        "name": "Up-Front Project Planning",
        "checkpoint": "Structural feasibility, budget, finish inspiration, and owner goals confirmed.",
        "checks": ["Joist direction verified", "Shaft location approved", "Budget includes permits/electrical/finishes"],
    },
    {
        "id": "drawings",
        "name": "Stage 1 - Detailed Drawings & Approvals",
        "checkpoint": "Cab, hoistway, pit, overhead, rail, power, door swing, and finish drawings signed off.",
        "checks": ["Cab dimensions and capacity approved", "Pit/overhead/rail locations checked", "Landing door swing and finishes selected"],
    },
    {
        "id": "hoistway",
        "name": "Stage 2 - Preparing the Hoistway",
        "checkpoint": "Site walkthrough verifies framing, rough openings, and dedicated 220-V stub-out.",
        "checks": ["Stud and joist placement verified", "Rough openings measured", "Electrical stub-out scheduled"],
    },
    {
        "id": "inspection",
        "name": "Stage 3 - Final Hoistway Inspection",
        "checkpoint": "Installers re-measure pit depth, bolt patterns, landing heights, and tolerances.",
        "checks": ["Pit depth re-measured", "Rail bolt pattern confirmed", "Landing heights checked"],
    },
    {
        "id": "scheduling",
        "name": "Stage 4 - Scheduling Installation Date",
        "checkpoint": "Materials, factory slot, site readiness, and crew window are locked.",
        "checks": ["Factory slot booked", "Power and hoistway readiness confirmed", "Crew window accepted"],
    },
    {
        "id": "install",
        "name": "Stage 5 - Installing the Elevator",
        "checkpoint": "Rails, cab, drive equipment, landing doors, fixtures, and fine tuning are completed.",
        "checks": ["Rails anchored", "Cab assembled on sling", "Doors/COP installed", "Car leveled and cycle tested"],
    },
    {
        "id": "quality",
        "name": "Stage 6 - Quality Review & Orientation",
        "checkpoint": "Safety audit, emergency lowering, sensors, ride comfort, and homeowner orientation complete.",
        "checks": ["Door interlocks tested", "Emergency lowering tested", "Owner orientation completed"],
    },
    {
        "id": "care",
        "name": "Stage 7 - Post-Installation Care",
        "checkpoint": "Service database entry, first inspection, and maintenance schedule are created.",
        "checks": ["Service record created", "Annual inspection scheduled", "Maintenance cadence confirmed"],
    },
]

DEFAULT_INSTALL_JOBS: list[dict[str, Any]] = [
    {
        "id": "IJ-201",
        "site": "Mansarovar Residency",
        "type": "Residential elevator",
        "crew": "Install Team 1",
        "target": "May 24",
        "status": "In Progress",
        "stages": [
            {"id": "planning", "status": "Done"},
            {"id": "drawings", "status": "Done"},
            {"id": "hoistway", "status": "Done"},
            {"id": "inspection", "status": "In Progress"},
            {"id": "scheduling", "status": "Open"},
            {"id": "install", "status": "Open"},
            {"id": "quality", "status": "Open"},
            {"id": "care", "status": "Open"},
        ],
    },
    {
        "id": "IJ-202",
        "site": "Vaishali Plaza Lift 2",
        "type": "Passenger elevator",
        "crew": "Install Team 2",
        "target": "May 19",
        "status": "Final QA",
        "stages": [
            {"id": "planning", "status": "Done"},
            {"id": "drawings", "status": "Done"},
            {"id": "hoistway", "status": "Done"},
            {"id": "inspection", "status": "Done"},
            {"id": "scheduling", "status": "Done"},
            {"id": "install", "status": "Done"},
            {"id": "quality", "status": "In Progress"},
            {"id": "care", "status": "Open"},
        ],
    },
]

DEFAULT_INSTALL_TEAM: list[dict[str, Any]] = [
    {
        "id": "TM-301",
        "name": "Ravi Sharma",
        "role": "Lead Installer",
        "phone": "+91 90000 1301",
        "skills": ["Rails", "Cab assembly", "Final leveling"],
        "availability": "On Site",
        "current_job": "IJ-201",
        "shift": "9:00 AM - 6:00 PM",
        "notes": "Owns final hoistway inspection and install-day readiness.",
    },
    {
        "id": "TM-302",
        "name": "Nadeem Khan",
        "role": "Electrical Technician",
        "phone": "+91 90000 1302",
        "skills": ["220-V hookup", "COP wiring", "Drive commissioning"],
        "availability": "Available",
        "current_job": "",
        "shift": "10:00 AM - 7:00 PM",
        "notes": "Best fit for commissioning and power-readiness checks.",
    },
    {
        "id": "TM-303",
        "name": "Pawan Meena",
        "role": "Door & Safety Specialist",
        "phone": "+91 90000 1303",
        "skills": ["Landing doors", "Interlocks", "Light curtains"],
        "availability": "On Site",
        "current_job": "IJ-202",
        "shift": "9:00 AM - 6:00 PM",
        "notes": "Assigned to final QA and homeowner orientation support.",
    },
    {
        "id": "TM-304",
        "name": "Suresh Yadav",
        "role": "Helper",
        "phone": "+91 90000 1304",
        "skills": ["Material staging", "Hoistway prep", "Site cleanup"],
        "availability": "Off Duty",
        "current_job": "",
        "shift": "Off today",
        "notes": "Use for material movement and site readiness when active.",
    },
]

PLATFORM_MODULES: list[dict[str, Any]] = [
    {
        "id": "quotation",
        "name": "Lift Quotation Management",
        "icon": "fa-file-invoice-dollar",
        "owner": "Sales Desk",
        "status": "Active",
        "summary": "Prepare, price, approve, and follow up on lift quotations from enquiry to customer sign-off.",
        "metrics": [{"label": "Drafts", "value": "12"}, {"label": "Pending approval", "value": "4"}, {"label": "Won this month", "value": "7"}],
        "actions": ["Create quotation", "Send follow-up", "Convert to project"],
    },
    {
        "id": "amc",
        "name": "AMC & Preventive Maintenance",
        "icon": "fa-calendar-check",
        "owner": "AMC Team",
        "status": "Active",
        "summary": "Track AMC contracts, preventive service schedules, technician visits, and renewal readiness.",
        "metrics": [{"label": "Due this week", "value": "18"}, {"label": "Missed visits", "value": "2"}, {"label": "Renewals", "value": "24"}],
        "actions": ["Schedule visit", "Generate checklist", "Flag missed AMC"],
    },
    {
        "id": "breakdown",
        "name": "Elevator Breakdown Management",
        "icon": "fa-triangle-exclamation",
        "owner": "Service Control",
        "status": "Critical Watch",
        "summary": "Log breakdowns, prioritize trapped-passenger cases, dispatch technicians, and monitor SLA timers.",
        "metrics": [{"label": "Open calls", "value": "9"}, {"label": "Critical", "value": "2"}, {"label": "Avg response", "value": "34m"}],
        "actions": ["Dispatch tech", "Escalate SLA", "Close breakdown"],
    },
    {
        "id": "field-service",
        "name": "Field Service Management",
        "icon": "fa-van-shuttle",
        "owner": "Field Ops",
        "status": "Active",
        "summary": "Manage daily technician routes, job cards, site notes, photos, and visit completion.",
        "metrics": [{"label": "Jobs today", "value": "31"}, {"label": "In progress", "value": "11"}, {"label": "Completed", "value": "17"}],
        "actions": ["Assign route", "Push job card", "Review site note"],
    },
    {
        "id": "attendance",
        "name": "Attendance Management",
        "icon": "fa-user-clock",
        "owner": "HR / Ops",
        "status": "Active",
        "summary": "Track technician attendance, shift status, late starts, off-duty crew, and site presence.",
        "metrics": [{"label": "Present", "value": "23"}, {"label": "Late", "value": "3"}, {"label": "Off duty", "value": "4"}],
        "actions": ["Mark attendance", "Review late start", "Export shift sheet"],
    },
    {
        "id": "inventory",
        "name": "Elevator Inventory Management",
        "icon": "fa-boxes-stacked",
        "owner": "Stores",
        "status": "Stock Watch",
        "summary": "Track spares, landing doors, ARD kits, controllers, procurement lead times, and stockouts.",
        "metrics": [{"label": "Stockouts", "value": "3"}, {"label": "Low stock", "value": "14"}, {"label": "PO pending", "value": "8"}],
        "actions": ["Raise PO", "Reserve part", "Flag stockout"],
    },
    {
        "id": "crm",
        "name": "Elevator CRM & Lead Management",
        "icon": "fa-address-book",
        "owner": "Sales",
        "status": "Active",
        "summary": "Capture leads, qualify opportunities, track follow-ups, and convert won deals into install projects.",
        "metrics": [{"label": "New leads", "value": "21"}, {"label": "Hot", "value": "6"}, {"label": "Follow-ups", "value": "13"}],
        "actions": ["Add lead", "Draft email", "Create quotation"],
    },
    {
        "id": "modernization",
        "name": "Elevator Modernization Management",
        "icon": "fa-screwdriver-wrench",
        "owner": "Modernization PM",
        "status": "At Risk",
        "summary": "Coordinate permits, parts, inspection dates, customer approvals, and upgrade milestones.",
        "metrics": [{"label": "Active jobs", "value": "8"}, {"label": "Blocked", "value": "3"}, {"label": "Inspections", "value": "5"}],
        "actions": ["Open blocker", "Update milestone", "Notify customer"],
    },
    {
        "id": "project-tracking",
        "name": "Elevator Project Tracking",
        "icon": "fa-diagram-project",
        "owner": "Project Office",
        "status": "Active",
        "summary": "Track new installations from planning through drawing approvals, hoistway readiness, install, QA, and handover.",
        "metrics": [{"label": "Projects", "value": "18"}, {"label": "On track", "value": "13"}, {"label": "Delayed", "value": "5"}],
        "actions": ["Update stage", "Assign crew", "Generate handover"],
    },
    {
        "id": "mis",
        "name": "Elevator MIS Reporting Dashboard",
        "icon": "fa-chart-pie",
        "owner": "Management",
        "status": "Active",
        "summary": "Monitor executive KPIs across sales, AMC, breakdowns, field service, inventory, modernization, and projects.",
        "metrics": [{"label": "Reports", "value": "10"}, {"label": "SLA risk", "value": "2"}, {"label": "Revenue view", "value": "Live"}],
        "actions": ["Export MIS", "Send morning brief", "Open KPI review"],
    },
]


def load_project_tickets() -> list[dict[str, Any]]:
    if not TICKETS_FILE.exists():
        return [ticket.copy() for ticket in DEFAULT_PROJECT_TICKETS]
    try:
        data = json.loads(TICKETS_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        return [ticket.copy() for ticket in DEFAULT_PROJECT_TICKETS]
    if not isinstance(data, list):
        return [ticket.copy() for ticket in DEFAULT_PROJECT_TICKETS]
    return data


def save_project_tickets() -> None:
    TICKETS_FILE.write_text(json.dumps(PROJECT_TICKETS, indent=2))


PROJECT_TICKETS = load_project_tickets()


def load_install_jobs() -> list[dict[str, Any]]:
    if not INSTALL_JOBS_FILE.exists():
        return json.loads(json.dumps(DEFAULT_INSTALL_JOBS))
    try:
        data = json.loads(INSTALL_JOBS_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        return json.loads(json.dumps(DEFAULT_INSTALL_JOBS))
    if not isinstance(data, list):
        return json.loads(json.dumps(DEFAULT_INSTALL_JOBS))
    return data


def save_install_jobs() -> None:
    INSTALL_JOBS_FILE.write_text(json.dumps(INSTALL_JOBS, indent=2))


INSTALL_JOBS = load_install_jobs()


def load_install_team() -> list[dict[str, Any]]:
    if not INSTALL_TEAM_FILE.exists():
        return json.loads(json.dumps(DEFAULT_INSTALL_TEAM))
    try:
        data = json.loads(INSTALL_TEAM_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        return json.loads(json.dumps(DEFAULT_INSTALL_TEAM))
    if not isinstance(data, list):
        return json.loads(json.dumps(DEFAULT_INSTALL_TEAM))
    return data


def save_install_team() -> None:
    INSTALL_TEAM_FILE.write_text(json.dumps(INSTALL_TEAM, indent=2))


INSTALL_TEAM = load_install_team()


def username_from_name(name: str) -> str:
    parts = "".join(char.lower() if char.isalnum() else "." for char in name).split(".")
    return ".".join(part for part in parts if part) or "team.member"


def build_default_users() -> list[dict[str, Any]]:
    users = [
        {
            "id": "USR-001",
            "username": PORTAL_USER,
            "display_name": "Portal Administrator",
            "role": "admin",
            "linked_team_member": "",
            "active": True,
            "must_change_password": False,
            "password_hash": generate_password_hash(PORTAL_PASSWORD),
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
        }
    ]
    used_usernames = {PORTAL_USER.lower()}
    for index, member in enumerate(INSTALL_TEAM, start=2):
        base_username = username_from_name(member.get("name", "team.member"))
        username = base_username
        suffix = 2
        while username.lower() in used_usernames:
            username = f"{base_username}{suffix}"
            suffix += 1
        used_usernames.add(username.lower())
        users.append(
            {
                "id": f"USR-{index:03d}",
                "username": username,
                "display_name": member.get("name", username),
                "role": "technician",
                "linked_team_member": member.get("id", ""),
                "active": True,
                "must_change_password": True,
                "password_hash": generate_password_hash("ChangeMe123!"),
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
            }
        )
    return users


def load_users() -> list[dict[str, Any]]:
    if not USERS_FILE.exists():
        users = build_default_users()
        USERS_FILE.write_text(json.dumps(users, indent=2))
        return users
    try:
        data = json.loads(USERS_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        data = build_default_users()
    if not isinstance(data, list):
        data = build_default_users()
    return data


def save_users() -> None:
    USERS_FILE.write_text(json.dumps(USERS, indent=2))


USERS = load_users()


def load_customers() -> list[dict[str, Any]]:
    if not CUSTOMERS_FILE.exists():
        CUSTOMERS_FILE.write_text(json.dumps([], indent=2))
        return []
    try:
        data = json.loads(CUSTOMERS_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        return []
    if not isinstance(data, list):
        return []
    return data


def save_customers() -> None:
    CUSTOMERS_FILE.write_text(json.dumps(CUSTOMERS, indent=2))


CUSTOMERS = load_customers()


def public_user(user: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in user.items() if key != "password_hash"}


def current_user() -> dict[str, Any] | None:
    username = session.get("portal_user", "")
    return next((user for user in USERS if user.get("username") == username), None)


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not session.get("portal_user"):
            return redirect(url_for("login", next=request.path))
        return view(*args, **kwargs)

    return wrapped


def admin_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        user = current_user()
        if user is None or user.get("role") != "admin":
            return jsonify({"ok": False, "message": "Admin access is required."}), 403
        return view(*args, **kwargs)

    return wrapped


def portal_data() -> dict[str, Any]:
    open_ticket_count = sum(1 for ticket in PROJECT_TICKETS if ticket["status"] != "Closed")
    blocked_ticket_count = sum(1 for ticket in PROJECT_TICKETS if ticket["status"] == "Blocked")
    installs_in_progress = sum(1 for job in INSTALL_JOBS if job["status"] != "Complete")
    available_installers = sum(1 for member in INSTALL_TEAM if member["availability"] == "Available")
    install_jobs_view = []
    stage_lookup = {stage["id"]: stage for stage in INSTALL_STAGES}
    for job in INSTALL_JOBS:
        stage_count = len(job["stages"]) or 1
        done_count = sum(1 for stage in job["stages"] if stage["status"] == "Done")
        current_stage = next((stage for stage in job["stages"] if stage["status"] in {"In Progress", "Blocked"}), None)
        if current_stage is None:
            current_stage = next((stage for stage in job["stages"] if stage["status"] == "Open"), job["stages"][-1])
        install_jobs_view.append(
            {
                **job,
                "progress": round(done_count / stage_count * 100),
                "current_stage": stage_lookup.get(current_stage["id"], {"name": current_stage["id"]})["name"],
            }
        )
    return {
        "metrics": [
            {"label": "Fleet Health", "value": "92", "delta": "+3%", "tone": "good", "detail": "128 units online, 4 in fault, 6 under watch"},
            {"label": "Project Tickets", "value": str(open_ticket_count), "delta": f"{blocked_ticket_count} blocked", "tone": "warn" if blocked_ticket_count else "good", "detail": "Current project blockers, follow-ups, and owner actions"},
            {"label": "Install Jobs", "value": str(installs_in_progress), "delta": "stage tracked", "tone": "info", "detail": "Residential install stages, checklists, and crew readiness"},
            {"label": "Install Team", "value": str(len(INSTALL_TEAM)), "delta": f"{available_installers} available", "tone": "good" if available_installers else "warn", "detail": "Crew availability, skills, assignments, and shifts"},
        ],
        "fleet": [
            {"unit": "FE-JP-204", "site": "Pearl Heights, Tower B", "status": "Fault", "severity": "critical", "telemetry": "Motor 88 C, door cycles +32%", "ticket": "T-4182", "owner": "R. Sharma"},
            {"unit": "FE-JP-117", "site": "City Mall, Escalator 3", "status": "Watch", "severity": "warning", "telemetry": "Drive temp rising, E31 intermittent", "ticket": "T-4179", "owner": "N. Khan"},
            {"unit": "FE-JP-309", "site": "Sunrise Hospital", "status": "Healthy", "severity": "healthy", "telemetry": "Normal load, 18 sec avg trip", "ticket": "-", "owner": "AMC Team 2"},
            {"unit": "FE-AJ-052", "site": "Ajmer Residency", "status": "Fault", "severity": "critical", "telemetry": "Door lock circuit, D14", "ticket": "T-4184", "owner": "P. Meena"},
            {"unit": "FE-JP-411", "site": "Vaishali Plaza, Lift 2", "status": "Healthy", "severity": "healthy", "telemetry": "Final inspection passed", "ticket": "-", "owner": "Install Team 1"},
        ],
        "projects": [
            {"name": "Raja Park Modernization", "stage": "Permit review", "risk": "At risk", "owner": "A. Singhal", "due": "Today"},
            {"name": "Mansarovar Residency", "stage": "Parts order", "risk": "Blocked", "owner": "N. Khan", "due": "Tomorrow"},
            {"name": "City Mall AMC Upgrade", "stage": "Inspection booked", "risk": "On track", "owner": "R. Sharma", "due": "May 21"},
            {"name": "Ajmer Trade Center", "stage": "Rigging", "risk": "At risk", "owner": "P. Meena", "due": "May 22"},
        ],
        "installations": [
            {"job": "Vaishali Plaza - Lift 2", "stage": "Final inspection passed", "progress": 100, "tone": "healthy", "note": "Handover report and warranty registration generated"},
            {"job": "Mansarovar Residency - Lift 1", "stage": "Electrical commissioning", "progress": 72, "tone": "warning", "note": "Crew flagged overload relay mismatch"},
            {"job": "Bapu Nagar Clinic - Hospital Lift", "stage": "Shaft alignment", "progress": 46, "tone": "info", "note": "Alignment photos received"},
            {"job": "Ajmer Trade Center - Escalator 1", "stage": "Rigging overdue", "progress": 31, "tone": "warning", "note": "Back-office alert sent"},
        ],
        "messages": [
            {"channel": "WhatsApp", "from": "Arihant Towers", "state": "Auto-answered", "text": "Routine AMC date confirmed for Monday, 10:30 AM"},
            {"channel": "Web chat", "from": "City Mall", "state": "Escalated", "text": "Passenger entrapment keyword detected; emergency team notified"},
            {"channel": "Email", "from": "Pearl Heights", "state": "Drafted", "text": "Ticket #T-4182 update prepared for manager approval"},
        ],
        "renewals": [
            {"building": "Pearl Heights", "days": 12, "contacted": False, "value": "High"},
            {"building": "Arihant Towers", "days": 21, "contacted": True, "value": "Medium"},
            {"building": "City Mall", "days": 38, "contacted": False, "value": "High"},
            {"building": "Sunrise Hospital", "days": 58, "contacted": False, "value": "High"},
        ],
        "work_orders": [
            {"title": "Pearl Heights Tower B", "urgency": "Urgent", "body": "Replace door lock contact and verify landing door alignment. Parts: D14 contact kit, roller set."},
            {"title": "City Mall Escalator 3", "urgency": "Medium", "body": "Inspect drive cooling, clean comb plate sensors, and monitor E31 recurrence."},
        ],
        "project_tickets": PROJECT_TICKETS,
        "install_stage_template": INSTALL_STAGES,
        "install_jobs": install_jobs_view,
        "install_team": INSTALL_TEAM,
        "users": [public_user(user) for user in USERS],
        "customers": CUSTOMERS,
        "install_materials": [
            {"component": "Custom cab panels", "lead_time": "4-6 weeks", "notes": "Veneers, glass, or metal colors can extend lead time."},
            {"component": "Drive equipment", "lead_time": "3-4 weeks", "notes": "Hydraulic power units or traction motors ship after drawing approval."},
            {"component": "Landing doors", "lead_time": "2-3 weeks", "notes": "Fire-rated doors can add one week for certification."},
        ],
        "install_challenges": [
            {"challenge": "Shaft width is off by 1/2 in", "prevention": "Use laser measurement before drywall and adjust framing early."},
            {"challenge": "Power is not live on install day", "prevention": "Schedule electrician to energize circuit 72 hours prior."},
            {"challenge": "Custom finishes are delayed", "prevention": "Approve color swatches during drawing approval, not after."},
        ],
        "platform_modules": PLATFORM_MODULES,
    }


def next_team_member_id() -> str:
    numbers = []
    for member in INSTALL_TEAM:
        try:
            numbers.append(int(member["id"].split("-")[1]))
        except (KeyError, IndexError, ValueError):
            continue
    return f"TM-{max(numbers, default=300) + 1}"


def next_ticket_id() -> str:
    numbers = []
    for ticket in PROJECT_TICKETS:
        try:
            numbers.append(int(ticket["id"].split("-")[1]))
        except (KeyError, IndexError, ValueError):
            continue
    return f"PT-{max(numbers, default=1000) + 1}"


def next_user_id() -> str:
    numbers = []
    for user in USERS:
        try:
            numbers.append(int(user["id"].split("-")[1]))
        except (KeyError, IndexError, ValueError):
            continue
    return f"USR-{max(numbers, default=0) + 1:03d}"


def next_customer_id() -> str:
    numbers = []
    for customer in CUSTOMERS:
        try:
            numbers.append(int(customer["id"].split("-")[1]))
        except (KeyError, IndexError, ValueError):
            continue
    return f"CUST-{max(numbers, default=0) + 1:03d}"


def find_user(username: str) -> dict[str, Any] | None:
    normalized = username.strip().lower()
    return next((user for user in USERS if user.get("username", "").lower() == normalized), None)


def find_customer(customer_id: str) -> dict[str, Any] | None:
    return next((customer for customer in CUSTOMERS if customer.get("id") == customer_id), None)



@app.route("/")
def home():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/<path:filename>")
def static_pages(filename: str):
    allowed = {path.name for path in BASE_DIR.glob("*.html")}
    allowed.add("product.css")
    if filename in allowed:
        return send_from_directory(BASE_DIR, filename)
    return send_from_directory(BASE_DIR, filename)


@app.route("/portal")
def portal():
    if session.get("portal_user"):
        return redirect(url_for("dashboard"))
    return redirect(url_for("login"))


@app.route("/portal/login", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        user = find_user(username)
        if user and user.get("active", True) and check_password_hash(user.get("password_hash", ""), password):
            session["portal_user"] = user["username"]
            session["portal_role"] = user.get("role", "technician")
            session["portal_name"] = user.get("display_name", user["username"])
            return redirect(request.args.get("next") or url_for("dashboard"))
        error = "Invalid username or password."
    return render_template("login.html", error=error)


@app.route("/portal/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/portal/dashboard")
@login_required
def dashboard():
    return render_template(
        "dashboard.html",
        user=session.get("portal_name", session["portal_user"]),
        data=portal_data(),
        synced_at=datetime.now().strftime("%I:%M %p"),
    )


@app.get("/api/portal/data")
@login_required
def api_data():
    data = portal_data()
    data["synced_at"] = datetime.now().strftime("%I:%M:%S %p")
    return jsonify(data)


@app.post("/api/portal/project-tickets")
@login_required
def create_project_ticket():
    payload = request.get_json(silent=True) or {}
    title = payload.get("title", "").strip()
    project = payload.get("project", "").strip()
    owner = payload.get("owner", "").strip() or "Unassigned"

    if not title or not project:
        return jsonify({"ok": False, "message": "Project and title are required."}), 400

    ticket = {
        "id": next_ticket_id(),
        "project": project,
        "title": title,
        "owner": owner,
        "status": payload.get("status", "Open"),
        "priority": payload.get("priority", "Medium"),
        "due": payload.get("due", "").strip() or "Unscheduled",
        "notes": payload.get("notes", "").strip(),
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
    }
    PROJECT_TICKETS.insert(0, ticket)
    save_project_tickets()
    return jsonify({"ok": True, "ticket": ticket, "message": f"{ticket['id']} created."})


@app.patch("/api/portal/project-tickets/<ticket_id>")
@login_required
def update_project_ticket(ticket_id: str):
    payload = request.get_json(silent=True) or {}
    ticket = next((item for item in PROJECT_TICKETS if item["id"] == ticket_id), None)
    if ticket is None:
        return jsonify({"ok": False, "message": "Ticket not found."}), 404

    for field in ("status", "priority", "owner", "due", "notes"):
        if field in payload and str(payload[field]).strip():
            ticket[field] = str(payload[field]).strip()

    save_project_tickets()
    return jsonify({"ok": True, "ticket": ticket, "message": f"{ticket_id} updated."})


@app.patch("/api/portal/install-jobs/<job_id>/stages/<stage_id>")
@login_required
def update_install_stage(job_id: str, stage_id: str):
    payload = request.get_json(silent=True) or {}
    status = payload.get("status", "").strip()
    if status not in {"Open", "In Progress", "Done", "Blocked"}:
        return jsonify({"ok": False, "message": "Invalid install stage status."}), 400

    job = next((item for item in INSTALL_JOBS if item["id"] == job_id), None)
    if job is None:
        return jsonify({"ok": False, "message": "Install job not found."}), 404

    stage = next((item for item in job["stages"] if item["id"] == stage_id), None)
    if stage is None:
        return jsonify({"ok": False, "message": "Install stage not found."}), 404

    stage["status"] = status
    done_count = sum(1 for item in job["stages"] if item["status"] == "Done")
    blocked_count = sum(1 for item in job["stages"] if item["status"] == "Blocked")
    if done_count == len(job["stages"]):
        job["status"] = "Complete"
    elif blocked_count:
        job["status"] = "Blocked"
    else:
        job["status"] = "In Progress"

    save_install_jobs()
    return jsonify({"ok": True, "job": job, "message": f"{job_id} {stage_id} marked {status}."})


@app.post("/api/portal/install-team")
@login_required
def create_install_team_member():
    payload = request.get_json(silent=True) or {}
    name = payload.get("name", "").strip()
    role = payload.get("role", "").strip()
    if not name or not role:
        return jsonify({"ok": False, "message": "Technician name and role are required."}), 400

    skills = [skill.strip() for skill in payload.get("skills", "").split(",") if skill.strip()]
    member = {
        "id": next_team_member_id(),
        "name": name,
        "role": role,
        "phone": payload.get("phone", "").strip(),
        "skills": skills,
        "availability": payload.get("availability", "Available"),
        "current_job": payload.get("current_job", "").strip(),
        "shift": payload.get("shift", "").strip() or "9:00 AM - 6:00 PM",
        "notes": payload.get("notes", "").strip(),
    }
    INSTALL_TEAM.insert(0, member)
    save_install_team()
    return jsonify({"ok": True, "member": member, "message": f"{member['name']} added to install team."})


@app.patch("/api/portal/install-team/<member_id>")
@login_required
def update_install_team_member(member_id: str):
    payload = request.get_json(silent=True) or {}
    member = next((item for item in INSTALL_TEAM if item["id"] == member_id), None)
    if member is None:
        return jsonify({"ok": False, "message": "Install team member not found."}), 404

    for field in ("availability", "current_job", "shift", "notes", "phone", "role"):
        if field in payload:
            member[field] = str(payload[field]).strip()
    if "skills" in payload:
        member["skills"] = [skill.strip() for skill in str(payload["skills"]).split(",") if skill.strip()]

    save_install_team()
    return jsonify({"ok": True, "member": member, "message": f"{member['name']} updated."})


@app.post("/api/portal/users")
@login_required
@admin_required
def create_user():
    payload = request.get_json(silent=True) or {}
    username = payload.get("username", "").strip()
    display_name = payload.get("display_name", "").strip()
    password = payload.get("password", "")
    role = payload.get("role", "technician").strip() or "technician"

    if not username or not display_name or not password:
        return jsonify({"ok": False, "message": "Username, display name, and password are required."}), 400
    if find_user(username):
        return jsonify({"ok": False, "message": "That username already exists."}), 400
    if role not in {"admin", "manager", "technician"}:
        return jsonify({"ok": False, "message": "Invalid user role."}), 400

    user = {
        "id": next_user_id(),
        "username": username,
        "display_name": display_name,
        "role": role,
        "linked_team_member": payload.get("linked_team_member", "").strip(),
        "active": bool(payload.get("active", True)),
        "must_change_password": bool(payload.get("must_change_password", True)),
        "password_hash": generate_password_hash(password),
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
    }
    USERS.append(user)
    save_users()
    return jsonify({"ok": True, "user": public_user(user), "message": f"{username} account created."})


@app.patch("/api/portal/users/<user_id>")
@login_required
@admin_required
def update_user(user_id: str):
    payload = request.get_json(silent=True) or {}
    user = next((item for item in USERS if item.get("id") == user_id), None)
    if user is None:
        return jsonify({"ok": False, "message": "User account not found."}), 404

    if "username" in payload:
        username = str(payload["username"]).strip()
        if not username:
            return jsonify({"ok": False, "message": "Username cannot be blank."}), 400
        duplicate = next((item for item in USERS if item.get("id") != user_id and item.get("username", "").lower() == username.lower()), None)
        if duplicate:
            return jsonify({"ok": False, "message": "That username already exists."}), 400
        user["username"] = username

    for field in ("display_name", "role", "linked_team_member"):
        if field in payload:
            user[field] = str(payload[field]).strip()
    if user.get("role") not in {"admin", "manager", "technician"}:
        return jsonify({"ok": False, "message": "Invalid user role."}), 400
    if "active" in payload:
        user["active"] = bool(payload["active"])
    if "must_change_password" in payload:
        user["must_change_password"] = bool(payload["must_change_password"])
    if payload.get("password"):
        user["password_hash"] = generate_password_hash(str(payload["password"]))
        user["must_change_password"] = bool(payload.get("must_change_password", True))

    save_users()
    return jsonify({"ok": True, "user": public_user(user), "message": f"{user['username']} updated."})


@app.post("/api/portal/customers")
@login_required
def create_customer():
    payload = request.get_json(silent=True) or {}
    name = payload.get("name", "").strip()
    if not name:
        return jsonify({"ok": False, "message": "Customer or building name is required."}), 400

    customer = {
        "id": next_customer_id(),
        "name": name,
        "contact_person": payload.get("contact_person", "").strip(),
        "phone": payload.get("phone", "").strip(),
        "email": payload.get("email", "").strip(),
        "address": payload.get("address", "").strip(),
        "segment": payload.get("segment", "Residential").strip() or "Residential",
        "status": payload.get("status", "Active").strip() or "Active",
        "renewal_date": payload.get("renewal_date", "").strip(),
        "notes": payload.get("notes", "").strip(),
        "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
    }
    CUSTOMERS.insert(0, customer)
    save_customers()
    return jsonify({"ok": True, "customer": customer, "message": f"{name} saved."})


@app.patch("/api/portal/customers/<customer_id>")
@login_required
def update_customer(customer_id: str):
    payload = request.get_json(silent=True) or {}
    customer = find_customer(customer_id)
    if customer is None:
        return jsonify({"ok": False, "message": "Customer not found."}), 404

    for field in ("name", "contact_person", "phone", "email", "address", "segment", "status", "renewal_date", "notes"):
        if field in payload:
            value = str(payload[field]).strip()
            if field == "name" and not value:
                return jsonify({"ok": False, "message": "Customer name cannot be blank."}), 400
            customer[field] = value
    customer["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M")
    save_customers()
    return jsonify({"ok": True, "customer": customer, "message": f"{customer['name']} updated."})


@app.post("/api/portal/action")
@login_required
def api_action():
    payload = request.get_json(silent=True) or {}
    action = payload.get("action", "Action")
    target = payload.get("target", "selected item")
    return jsonify(
        {
            "ok": True,
            "message": f"{action} queued for {target}.",
            "timestamp": datetime.now().strftime("%I:%M:%S %p"),
        }
    )


if __name__ == "__main__":
    app.run(debug=True, port=5000, use_reloader=False)
