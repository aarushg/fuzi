from __future__ import annotations

from datetime import date, datetime
from functools import wraps
import hashlib
import json
import math
import os
from pathlib import Path
import re
import socket
import subprocess
import threading
from typing import Any, Callable
from urllib import error as urllib_error
from urllib import parse as urllib_parse
from urllib import request as urllib_request
import zipfile
from xml.sax.saxutils import escape as xml_escape

from flask import Flask, jsonify, redirect, render_template, request, send_file, send_from_directory, session, url_for
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
INVENTORY_FILE = BASE_DIR / "inventory.json"
OPERATIONS_STATE_FILE = BASE_DIR / "operations_state.json"
ORG_CHART_FILE = BASE_DIR / "org_chart.json"
ATTENDANCE_FILE = BASE_DIR / "attendance.json"
ESTIMATES_FILE = BASE_DIR / "estimates.json"
OFFER_TEMPLATE_FILE = BASE_DIR / "docs" / "offer" / "13683-DeepakKhanna.doc"
GENERATED_OFFERS_DIR = BASE_DIR / "docs" / "generated_offers"
CUSTOMER_USERS_FILE = BASE_DIR / "customer_users.json"
PAYMENTS_FILE = BASE_DIR / "payments.json"
SALES_INQUIRIES_FILE = BASE_DIR / "sales_inquiries.json"
SALES_ADMIN_PANEL_FILE = BASE_DIR / "sales_admin_panel.json"
BREAKDOWNS_FILE = BASE_DIR / "breakdowns.json"
BREAKDOWN_DISPATCH_CLAIMS_DIR = BASE_DIR / ".runtime" / "breakdown-dispatch-claims"
SERVICE_RECORDS_FILE = BASE_DIR / "service_records.json"
GAD_RECORDS_FILE = BASE_DIR / "gad_records.json"
COMMISSIONINGS_FILE = BASE_DIR / "commissionings.json"
FACTORY_JOBS_FILE = BASE_DIR / "factory_jobs.json"
TENDERS_FILE = BASE_DIR / "tenders.json"
DEPT_COMMS_FILE = BASE_DIR / "dept_comms.json"
SMTP_HOST = os.environ.get("FUZI_SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("FUZI_SMTP_PORT", "587"))
SMTP_USER = os.environ.get("FUZI_SMTP_USER", "")
SMTP_PASS = os.environ.get("FUZI_SMTP_PASS", "")
SMTP_FROM = os.environ.get("FUZI_SMTP_FROM", SMTP_USER)
CEO_EMAIL = os.environ.get("FUZI_CEO_EMAIL", "")
OPENCLAW_URL = os.environ.get("FUZI_OPENCLAW_URL", "http://127.0.0.1:18789/")
OPENCLAW_TIMEOUT = float(os.environ.get("FUZI_OPENCLAW_TIMEOUT", "4"))
OPENCLAW_CONFIG_FILE = Path.home() / ".openclaw" / "openclaw.json"
OPENCLAW_ENV_FILE = Path.home() / ".openclaw" / ".env"
OPENCLAW_DEFAULT_CHANNEL = os.environ.get("FUZI_OPENCLAW_CHANNEL", "whatsapp")
OPENCLAW_OPS_TARGET = os.environ.get("FUZI_OPENCLAW_OPS_TARGET", "")
OPENCLAW_AGENT_ID = os.environ.get("FUZI_OPENCLAW_AGENT_ID", "main")
OPENCLAW_WHATSAPP_BACKEND_CHANNEL = os.environ.get("FUZI_OPENCLAW_WHATSAPP_BACKEND_CHANNEL", "")
OPENCLAW_WHATSAPP_BACKEND_TARGET = os.environ.get("FUZI_OPENCLAW_WHATSAPP_BACKEND_TARGET", "")
OPENCLAW_MORNING_BRIEF_PHONE = os.environ.get("FUZI_OPENCLAW_MORNING_BRIEF_PHONE", "")
OPENCLAW_ALLOWED_COMMAND = ("openclaw", "dashboard", "--no-open")
MONITOR_INTERVAL_SECONDS = max(int(os.environ.get("FUZI_MONITOR_INTERVAL", "300")), 15)
DISCORD_POLL_INTERVAL_SECONDS = max(int(os.environ.get("FUZI_DISCORD_POLL_INTERVAL", "15")), 15)
DISCORD_LISTENER_LOCK_PORT = int(os.environ.get("FUZI_DISCORD_LISTENER_LOCK_PORT", "15377"))
DISCORD_OUTBOUND_DEDUPE_RETENTION_MINUTES = max(int(os.environ.get("FUZI_DISCORD_OUTBOUND_DEDUPE_RETENTION_MINUTES", "120")), 1)
REFRESH_INTERVAL_MINUTES = max(math.ceil(MONITOR_INTERVAL_SECONDS / 60), 1)
STATE_LOCK = threading.Lock()
DISCORD_LISTENER_LOCK_SOCKET: socket.socket | None = None
AGENT_TARGET_ENV_KEYS = {
    "Self-Healing Fleet Monitor": "FUZI_OPENCLAW_TARGET_FLEET_MONITOR",
    "Modernization Project Coordinator": "FUZI_OPENCLAW_TARGET_MODERNIZATION_COORDINATOR",
    "24/7 Customer Service Agent": "FUZI_OPENCLAW_TARGET_CUSTOMER_SERVICE",
    "Morning Operations Brief": "FUZI_OPENCLAW_TARGET_MORNING_BRIEF",
    "Live Operations Dashboard": "FUZI_OPENCLAW_TARGET_LIVE_DASHBOARD",
    "Contract Renewal CRM Agent": "FUZI_OPENCLAW_TARGET_RENEWALS",
    "CRM Query Agent": "FUZI_OPENCLAW_TARGET_CRM_QUERY",
    "Site Walkthrough to Work Order": "FUZI_OPENCLAW_TARGET_WORK_ORDERS",
    "Field Installation Manager": "FUZI_OPENCLAW_TARGET_INSTALLATIONS",
}
RUNTIME_MANAGED_OPENCLAW_ENV_KEYS = {
    "FUZI_OPENCLAW_MORNING_BRIEF_PHONE",
    "FUZI_OPENCLAW_OPS_TARGET",
    "FUZI_OPENCLAW_WHATSAPP_BACKEND_CHANNEL",
    "FUZI_OPENCLAW_WHATSAPP_BACKEND_TARGET",
    "FUZI_DISCORD_GUILD_ID",
    "FUZI_DISCORD_AGENT_CATEGORY_ID",
    *AGENT_TARGET_ENV_KEYS.values(),
}
DISCORD_AGENT_CHANNEL_CATEGORY_NAME = "FUZI Operations Agents"
DISCORD_AGENT_CHANNEL_SPECS = [
    {
        "agent": "Self-Healing Fleet Monitor",
        "env_key": "FUZI_OPENCLAW_TARGET_FLEET_MONITOR",
        "name": "fleet-monitor",
        "topic": "Auto-created fleet alerts, threshold breaches, and on-call dispatch escalations.",
    },
    {
        "agent": "Modernization Project Coordinator",
        "env_key": "FUZI_OPENCLAW_TARGET_MODERNIZATION_COORDINATOR",
        "name": "modernization-coordinator",
        "topic": "Blocked or at-risk modernization work, permits, parts, inspections, and morning flags.",
    },
    {
        "agent": "24/7 Customer Service Agent",
        "env_key": "FUZI_OPENCLAW_TARGET_CUSTOMER_SERVICE",
        "name": "customer-service",
        "topic": "Inbound building-manager messages, emergency escalations, and routine service replies.",
    },
    {
        "agent": "Morning Operations Brief",
        "env_key": "FUZI_OPENCLAW_TARGET_MORNING_BRIEF",
        "name": "morning-brief",
        "topic": "Daily 6:30 AM operations brief covering faults, coverage gaps, SLA risks, and blocked parts.",
    },
    {
        "agent": "Live Operations Dashboard",
        "env_key": "FUZI_OPENCLAW_TARGET_LIVE_DASHBOARD",
        "name": "live-operations",
        "topic": "Five-minute dashboard snapshots for fleet health, tickets, stockouts, and renewals.",
    },
    {
        "agent": "Contract Renewal CRM Agent",
        "env_key": "FUZI_OPENCLAW_TARGET_RENEWALS",
        "name": "renewals-crm",
        "topic": "Contract renewal outreach, uncontacted buildings, and draft email generation.",
    },
    {
        "agent": "CRM Query Agent",
        "env_key": "FUZI_OPENCLAW_TARGET_CRM_QUERY",
        "name": "crm-query",
        "topic": "Ad hoc CRM renewal questions and concise answers sent directly to chat.",
    },
    {
        "agent": "Site Walkthrough to Work Order",
        "env_key": "FUZI_OPENCLAW_TARGET_WORK_ORDERS",
        "name": "site-work-orders",
        "topic": "Structured walkthrough notes, deficiencies, parts, permits, and FSM-ready work orders.",
    },
    {
        "agent": "Field Installation Manager",
        "env_key": "FUZI_OPENCLAW_TARGET_INSTALLATIONS",
        "name": "field-installations",
        "topic": "Live install progress, overdue stages, final inspection notices, handovers, and warranty registration.",
    },
]
BUSINESS_DISCORD_CHANNEL_SPECS = [
    {
        "agent": "FUZI Breakdown",
        "env_key": "FUZI_OPENCLAW_TARGET_BREAKDOWN_CHANNEL",
        "name": "fuzi-breakdown",
        "topic": "Live breakdown calls, trapped-passenger escalations, dispatch updates, and closeout status.",
    },
    {
        "agent": "FUZI Breakdown Report PDF",
        "env_key": "FUZI_OPENCLAW_TARGET_BREAKDOWN_REPORT_PDF",
        "name": "fuzi-breakdown-report-pdf",
        "topic": "Resolved breakdown summaries and report-ready updates for PDF or customer documentation workflows.",
    },
    {
        "agent": "FUZI Service 2 Month",
        "env_key": "FUZI_OPENCLAW_TARGET_SERVICE_TWO_MONTH",
        "name": "fuzi-service-2-month",
        "topic": "Bi-monthly preventive service scheduling, next-visit reminders, and service queue updates.",
    },
    {
        "agent": "FUZI Service Report",
        "env_key": "FUZI_OPENCLAW_TARGET_SERVICE_REPORT",
        "name": "fuzi-service-report",
        "topic": "Completed service findings, follow-up actions, and technician service report summaries.",
    },
    {
        "agent": "New Site Visit Offer",
        "env_key": "FUZI_OPENCLAW_TARGET_NEW_SITE_VISIT_OFFER",
        "name": "new-site-visit-offer",
        "topic": "New site visits, offer discussions, quotation follow-up, and linked proposal activity.",
    },
    {
        "agent": "Modernization Site Visit",
        "env_key": "FUZI_OPENCLAW_TARGET_MOD_SITE_VISIT",
        "name": "mod-site-visit",
        "topic": "Modernization visit findings, blockers, project-office follow-up, and site review notes.",
    },
    {
        "agent": "FUZI Metrics",
        "env_key": "FUZI_OPENCLAW_TARGET_METRICS_CHANNEL",
        "name": "fuzi-metrics",
        "topic": "Marketing and ops metrics such as flyers, ads, appointments, and active staff coverage.",
    },
    {
        "agent": "Engineer Attendance",
        "env_key": "FUZI_OPENCLAW_TARGET_ENGINEER_ATTENDANCE",
        "name": "engineer-attendance",
        "topic": "Engineer attendance, check-ins, late starts, site presence, and proof-of-work activity.",
    },
    {
        "agent": "Install Locations Customers",
        "env_key": "FUZI_OPENCLAW_TARGET_INSTALL_LOCATION_CUSTOMERS",
        "name": "install-locations-customers",
        "topic": "Installation destinations, customer site details, install progress locations, and address handoff notes.",
    },
    {
        "agent": "FUZI Elevator Catalog",
        "env_key": "FUZI_OPENCLAW_TARGET_ELEVATOR_CATALOG",
        "name": "fuzi-elevator-catalog",
        "topic": "Elevator catalog references, product page pointers, material options, and offer-linked catalog guidance.",
    },
]
RUNTIME_MANAGED_OPENCLAW_ENV_KEYS.update(spec["env_key"] for spec in BUSINESS_DISCORD_CHANNEL_SPECS)
RUNTIME_STATE = {
    "scheduler_started": False,
    "discord_listener_started": False,
    "openclaw_dashboard_lookup_attempted": False,
    "openclaw_dashboard_url": "",
}

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

DEFAULT_MODERNIZATION_PROJECTS: list[dict[str, Any]] = [
    {
        "name": "Raja Park Modernization",
        "stage": "Permit review",
        "risk": "At risk",
        "owner": "A. Singhal",
        "due": "Today",
        "assigned_techs": ["A. Singhal"],
        "permit_status": "Pending fire department sign-off",
        "parts_status": "No blocker",
        "inspection_date": "Pending permit clearance",
    },
    {
        "name": "Mansarovar Residency",
        "stage": "Parts order",
        "risk": "Blocked",
        "owner": "N. Khan",
        "due": "Tomorrow",
        "assigned_techs": ["N. Khan"],
        "permit_status": "Cleared",
        "parts_status": "ARD battery kit supplier confirmation pending",
        "inspection_date": "Awaiting parts ETA",
    },
    {
        "name": "City Mall AMC Upgrade",
        "stage": "Inspection booked",
        "risk": "On track",
        "owner": "R. Sharma",
        "due": "May 21",
        "assigned_techs": ["R. Sharma"],
        "permit_status": "Cleared",
        "parts_status": "Comb plate test photos under review",
        "inspection_date": "May 21",
    },
    {
        "name": "Ajmer Trade Center",
        "stage": "Rigging",
        "risk": "At risk",
        "owner": "P. Meena",
        "due": "May 22",
        "assigned_techs": ["P. Meena"],
        "permit_status": "Cleared",
        "parts_status": "Rigging crew support required",
        "inspection_date": "Pending rigging completion",
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
        "checkpoint": "Set the installation date once site readiness, materials, and crew availability are aligned.",
        "checks": ["Install date confirmed", "Materials reserved", "Crew assigned"],
    },
    {
        "id": "install",
        "name": "Stage 5 - Installation & Commissioning",
        "checkpoint": "Rails, cab, doors, machine, controller, and safety systems are installed and energized.",
        "checks": ["Rails installed", "Cab assembled", "Controller powered and commissioned"],
    },
    {
        "id": "quality",
        "name": "Stage 6 - Quality & Safety Testing",
        "checkpoint": "Ride quality, leveling, door operation, and safety circuits pass final QA.",
        "checks": ["Ride quality tested", "Door safety devices verified", "Final punch list cleared"],
    },
    {
        "id": "care",
        "name": "Stage 7 - Handover & Customer Care",
        "checkpoint": "Owner training, warranty packet, and handover documents are completed.",
        "checks": ["Owner orientation complete", "Warranty packet issued", "Handover signed"],
    },
]

DEPARTMENT_OPTIONS: list[str] = [
    "Executive Office",
    "Sales",
    "Installation",
    "Breakdown",
    "Service",
    "GAD",
    "Accounts",
    "Commissioning",
    "Back Office",
    "Tender",
    "Factory",
]

DEPARTMENT_MANAGER_SEEDS: list[dict[str, str]] = [
    {"department": "Sales", "username": "sales.manager", "display_name": "Sales Manager"},
    {"department": "Installation", "username": "installation.manager", "display_name": "Installation Manager"},
    {"department": "Breakdown", "username": "breakdown.manager", "display_name": "Breakdown Manager"},
    {"department": "Service", "username": "service.manager", "display_name": "Service Manager"},
    {"department": "GAD", "username": "gad.manager", "display_name": "GAD Manager"},
    {"department": "Accounts", "username": "accounts.manager", "display_name": "Accounts Manager"},
    {"department": "Commissioning", "username": "commissioning.manager", "display_name": "Commissioning Manager"},
    {"department": "Back Office", "username": "backoffice.manager", "display_name": "Back Office Manager"},
    {"department": "Tender", "username": "tender.manager", "display_name": "Tender Manager"},
    {"department": "Factory", "username": "factory.manager", "display_name": "Factory Manager"},
]

DASHBOARD_VIEW_ORDER: list[str] = [
    "overview",
    "modules",
    "customers",
    "fleet",
    "tickets",
    "projects",
    "installations",
    "team",
    "accounts",
    "messages",
    "renewals",
    "workorders",
    "inventory",
    "estimator",
    "orgchart",
    # Department-specific views
    "sales",
    "installation_dept",
    "breakdown",
    "service",
    "gad",
    "finance",
    "commissioning",
    "backoffice",
    "tender",
    "factory",
    "comms",
]


def default_customer_service_messages() -> list[dict[str, Any]]:
    return [
        {
            "channel": "WhatsApp",
            "from": "Arihant Towers",
            "state": "New",
            "text": "Please confirm the next AMC visit window for Monday morning.",
            "reply": "",
            "triaged_at": "",
        },
        {
            "channel": "Web chat",
            "from": "City Mall",
            "state": "New",
            "text": "Escalator 3 has stopped with passengers stuck at the landing. This looks like an emergency.",
            "reply": "",
            "triaged_at": "",
        },
        {
            "channel": "Email",
            "from": "Pearl Heights",
            "state": "New",
            "text": "Can you share the latest ticket update and expected technician arrival time for Tower B?",
            "reply": "",
            "triaged_at": "",
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


def default_operations_state() -> dict[str, Any]:
    return json.loads(
        json.dumps(
            {
                "fleet": [
                    {
                        "unit": "FE-JP-204",
                        "site": "Pearl Heights, Tower B",
                        "status": "Fault",
                        "severity": "critical",
                        "telemetry": "Motor 88 C, door cycles +32%",
                        "ticket": "T-4182",
                        "owner": "R. Sharma",
                        "fault_code": "MTR-88",
                        "motor_temp_c": 88,
                        "door_cycles_delta": 32,
                        "on_call_phone": "+91 90000 1301",
                        "last_alerted_at": "",
                        "last_notified_at": "",
                        "last_notified_ticket": "",
                    },
                    {
                        "unit": "FE-JP-117",
                        "site": "City Mall, Escalator 3",
                        "status": "Watch",
                        "severity": "warning",
                        "telemetry": "Drive temp rising, E31 intermittent",
                        "ticket": "T-4179",
                        "owner": "N. Khan",
                        "fault_code": "E31",
                        "motor_temp_c": 76,
                        "door_cycles_delta": 18,
                        "on_call_phone": "+91 90000 1302",
                        "last_alerted_at": "",
                        "last_notified_at": "",
                        "last_notified_ticket": "",
                    },
                    {
                        "unit": "FE-JP-309",
                        "site": "Sunrise Hospital",
                        "status": "Healthy",
                        "severity": "healthy",
                        "telemetry": "Normal load, 18 sec avg trip",
                        "ticket": "-",
                        "owner": "AMC Team 2",
                        "fault_code": "",
                        "motor_temp_c": 61,
                        "door_cycles_delta": 4,
                        "on_call_phone": "+91 90000 1302",
                        "last_alerted_at": "",
                        "last_notified_at": "",
                        "last_notified_ticket": "",
                    },
                    {
                        "unit": "FE-AJ-052",
                        "site": "Ajmer Residency",
                        "status": "Fault",
                        "severity": "critical",
                        "telemetry": "Door lock circuit, D14",
                        "ticket": "T-4184",
                        "owner": "P. Meena",
                        "fault_code": "D14",
                        "motor_temp_c": 71,
                        "door_cycles_delta": 28,
                        "on_call_phone": "+91 90000 1303",
                        "last_alerted_at": "",
                        "last_notified_at": "",
                        "last_notified_ticket": "",
                    },
                    {
                        "unit": "FE-JP-411",
                        "site": "Vaishali Plaza, Lift 2",
                        "status": "Healthy",
                        "severity": "healthy",
                        "telemetry": "Final inspection passed",
                        "ticket": "-",
                        "owner": "Install Team 1",
                        "fault_code": "",
                        "motor_temp_c": 57,
                        "door_cycles_delta": 6,
                        "on_call_phone": "+91 90000 1301",
                        "last_alerted_at": "",
                        "last_notified_at": "",
                        "last_notified_ticket": "",
                    },
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
                "messages": default_customer_service_messages(),
                "renewals": [
                    {"building": "Pearl Heights", "days": 12, "contacted": False, "value": "High", "contact_email": "manager@pearlheights.example", "last_draft": ""},
                    {"building": "Arihant Towers", "days": 21, "contacted": True, "value": "Medium", "contact_email": "ops@arihanttowers.example", "last_draft": ""},
                    {"building": "City Mall", "days": 38, "contacted": False, "value": "High", "contact_email": "facilities@citymall.example", "last_draft": ""},
                    {"building": "Sunrise Hospital", "days": 58, "contacted": False, "value": "High", "contact_email": "engineering@sunrisehospital.example", "last_draft": ""},
                ],
                "work_orders": [
                    {
                        "id": "WO-701",
                        "title": "Pearl Heights Tower B",
                        "urgency": "Urgent",
                        "walkthrough_notes": "After the visit, the technician reported that the landing door lock circuit is intermittent, the sill is out of line, and passengers could get delayed if the fault repeats. Replace the D14 contact kit and roller set today. No permit is needed.",
                        "body": "",
                        "status": "Ready",
                        "pushed_at": "",
                    },
                    {
                        "id": "WO-702",
                        "title": "City Mall Escalator 3",
                        "urgency": "Medium",
                        "walkthrough_notes": "Tech voice note: comb plate sensors need cleaning, drive cooling fans are noisy, and the recurrence should be monitored this week. Order a fan assembly and sensor harness. Night-access permit from mall facilities is required before work starts.",
                        "body": "",
                        "status": "Draft",
                        "pushed_at": "",
                    },
                ],
                "brief_history": [],
                "last_scheduled_morning_brief_date": "",
                "last_scheduled_modernization_flag_date": "",
                "discord_cursors": {"crm_query_last_message_id": "", "breakdown_last_message_id": ""},
                "discord_sent_messages": [],
                "activity_log": [],
                "connector_status": {"state": "idle", "last_attempt": "", "last_error": "", "last_response": ""},
            }
        )
    )


def merge_default_state(default_value: Any, current_value: Any) -> Any:
    if isinstance(default_value, dict):
        merged: dict[str, Any] = {}
        current_dict = current_value if isinstance(current_value, dict) else {}
        for key, nested_default in default_value.items():
            merged[key] = merge_default_state(nested_default, current_dict.get(key))
        for key, value in current_dict.items():
            if key not in merged:
                merged[key] = value
        return merged
    if isinstance(default_value, list):
        return current_value if isinstance(current_value, list) else default_value
    return default_value if current_value is None else current_value


def load_operations_state() -> dict[str, Any]:
    default_state = default_operations_state()
    if not OPERATIONS_STATE_FILE.exists():
        OPERATIONS_STATE_FILE.write_text(json.dumps(default_state, indent=2))
        return default_state
    try:
        data = json.loads(OPERATIONS_STATE_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        return default_state
    if not isinstance(data, dict):
        return default_state
    merged_state = merge_default_state(default_state, data)
    OPERATIONS_STATE_FILE.write_text(json.dumps(merged_state, indent=2))
    return merged_state


def save_operations_state() -> None:
    OPERATIONS_STATE_FILE.write_text(json.dumps(OPERATIONS_STATE, indent=2))


OPERATIONS_STATE = load_operations_state()


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
            "department": "Executive Office",
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
                "department": "Install Operations",
                "linked_team_member": member.get("id", ""),
                "active": True,
                "must_change_password": True,
                "password_hash": generate_password_hash("ChangeMe123!"),
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
            }
        )
    return users


def default_department_for_user(role: str, linked_team_member: str = "") -> str:
    normalized_role = str(role).strip().lower() or "technician"
    if normalized_role == "admin":
        return "Executive Office"
    if linked_team_member or normalized_role == "technician":
        return "Install Operations"
    if normalized_role == "manager":
        return "Project Office"
    return "Customer Success"


def normalize_department(value: str, role: str, linked_team_member: str = "") -> str:
    department = str(value).strip()
    if department in DEPARTMENT_OPTIONS:
        return department
    return default_department_for_user(role, linked_team_member)


def normalize_user_record(user: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(user)
    role = str(normalized.get("role", "technician")).strip().lower() or "technician"
    if role not in {"admin", "manager", "technician"}:
        role = "technician"
    linked_team_member = str(normalized.get("linked_team_member", "")).strip()
    normalized["role"] = role
    normalized["linked_team_member"] = linked_team_member
    normalized["department"] = normalize_department(str(normalized.get("department", "")), role, linked_team_member)
    normalized["active"] = bool(normalized.get("active", True))
    normalized["must_change_password"] = bool(normalized.get("must_change_password", role != "admin"))
    return normalized


def next_user_id_for(users: list[dict[str, Any]]) -> str:
    numbers = []
    for user in users:
        try:
            numbers.append(int(str(user["id"]).split("-")[1]))
        except (KeyError, IndexError, ValueError, TypeError):
            continue
    return f"USR-{max(numbers, default=0) + 1:03d}"


def ensure_department_manager_accounts(users: list[dict[str, Any]]) -> list[dict[str, Any]]:
    updated_users = [dict(user) for user in users]
    existing_usernames = {str(user.get("username", "")).lower() for user in updated_users}
    existing_manager_departments = {
        str(user.get("department", ""))
        for user in updated_users
        if user.get("role") == "manager"
    }
    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    for seed in DEPARTMENT_MANAGER_SEEDS:
        if seed["department"] in existing_manager_departments:
            continue

        username = seed["username"]
        if username.lower() in existing_usernames:
            continue

        updated_users.append(
            normalize_user_record(
                {
                    "id": next_user_id_for(updated_users),
                    "username": username,
                    "display_name": seed["display_name"],
                    "role": "manager",
                    "department": seed["department"],
                    "linked_team_member": "",
                    "active": True,
                    "must_change_password": True,
                    "password_hash": generate_password_hash("ChangeMe123!"),
                    "created_at": now,
                }
            )
        )
        existing_usernames.add(username.lower())
        existing_manager_departments.add(seed["department"])

    return updated_users


def access_profile_for_user(user: dict[str, Any]) -> dict[str, Any]:
    normalized_user = normalize_user_record(user)
    role = normalized_user.get("role", "technician")
    department = normalized_user.get("department", "")

    if role == "admin" or department in ("Executive Office", ""):
        allowed_views = list(DASHBOARD_VIEW_ORDER)
        default_view = "overview"
    else:
        department_views: dict[str, list[str]] = {
            # ── New operational departments ───────────────────────────────────
            "Sales": ["overview", "sales", "estimator", "customers", "comms"],
            "Installation": ["overview", "installation_dept", "comms"],
            "Breakdown": ["overview", "breakdown", "fleet", "comms"],
            "Service": ["overview", "service", "fleet", "comms"],
            "GAD": ["overview", "gad", "customers", "comms"],
            "Accounts": ["overview", "finance", "estimator", "customers", "comms"],
            "Commissioning": ["overview", "commissioning", "installation_dept", "comms"],
            "Back Office": ["overview", "backoffice", "customers", "orgchart", "comms"],
            "Tender": ["overview", "tender", "estimator", "comms"],
            "Factory": ["overview", "factory", "inventory", "comms"],
            # ── Legacy department names kept for backwards compat ─────────────
            "Service Control": ["overview", "service", "fleet", "comms"],
            "Project Office": ["overview", "tickets", "projects", "comms"],
            "Install Operations": ["overview", "installation_dept", "comms"],
            "Stores & Procurement": ["overview", "inventory", "factory", "comms"],
            "Sales & Renewals": ["overview", "sales", "customers", "estimator", "comms"],
            "Customer Success": ["overview", "customers", "backoffice", "comms"],
        }
        allowed_views = list(department_views.get(department, ["overview", "comms"]))
        default_view = allowed_views[0]

    requested_view = request.args.get("view", "").strip()
    selected_view = requested_view if requested_view in allowed_views else default_view
    return {
        "department": department,
        "allowed_views": allowed_views,
        "default_view": default_view,
        "selected_view": selected_view,
        "is_restricted": role != "admin" and department != "Executive Office",
    }


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
    normalized_data = [normalize_user_record(item) for item in data if isinstance(item, dict)]
    seeded_data = ensure_department_manager_accounts(normalized_data)
    if seeded_data != data:
        USERS_FILE.write_text(json.dumps(seeded_data, indent=2))
    return seeded_data


def save_users() -> None:
    USERS_FILE.write_text(json.dumps(USERS, indent=2))


USERS = load_users()


def login_account_shortcuts() -> list[dict[str, str]]:
    shortcuts: list[dict[str, str]] = []
    active_users = [user for user in USERS if user.get("active", True)]
    active_users.sort(
        key=lambda user: (
            0 if str(user.get("username", "")).lower() == PORTAL_USER.lower() else 1,
            str(user.get("department", "")),
            str(user.get("display_name", user.get("username", ""))),
        )
    )
    for user in active_users:
        username = str(user.get("username", "")).strip()
        if not username:
            continue
        demo_password = ""
        if username.lower() == PORTAL_USER.lower():
            demo_password = PORTAL_PASSWORD
        elif user.get("must_change_password"):
            demo_password = "ChangeMe123!"
        shortcuts.append(
            {
                "username": username,
                "display_name": str(user.get("display_name", username)),
                "department": str(user.get("department", "")),
                "role": str(user.get("role", "technician")).title(),
                "demo_password": demo_password,
            }
        )
    return shortcuts


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


LIFT_MATERIAL_CATALOG: list[tuple] = [
    # (item_no, name, category, qty_on_hand, reorder_point, unit, lead_time_days)
    (1,  "Rack Bolt",                     "Rails & Hardware",   50,  10, "pcs",    2),
    (2,  "Fastener",                      "Rails & Hardware",  120,  20, "pcs",    1),
    (3,  "Bracket Car",                   "Rails & Hardware",    8,   2, "pcs",    7),
    (4,  "Bracket Cwt.",                  "Rails & Hardware",    6,   2, "pcs",    7),
    (5,  "Car Rail Clip",                 "Rails & Hardware",   40,  10, "pcs",    3),
    (6,  "Cwt. Rail Clip",               "Rails & Hardware",   35,  10, "pcs",    3),
    (7,  "Joint Plate Car",               "Rails & Hardware",   12,   4, "pcs",    5),
    (8,  "Joint Plate Cwt.",              "Rails & Hardware",   10,   4, "pcs",    5),
    (9,  '"E" Packing',                  "Rails & Hardware",   20,   5, "pcs",    3),
    (10, "Nut/Bolt/Washer 12mm",          "Rails & Hardware",  200,  50, "pcs",    2),
    (11, "Nut/Bolt/Washer 8mm",           "Rails & Hardware",  300,  75, "pcs",    1),
    (12, "Car Rail",                      "Rails & Hardware",    4,   2, "set",   10),
    (13, "Cwt. Rail",                     "Rails & Hardware",    3,   2, "set",   10),
    (14, "Combination Bracket",           "Rails & Hardware",    5,   2, "pcs",    7),
    (15, "Motor as per Drawing",          "Mechanical",          1,   1, "unit",  21),
    (16, "Safety Complete",               "Mechanical",          3,   1, "set",   14),
    (17, "Cwt. Frame",                    "Mechanical",          4,   1, "unit",  10),
    (18, "Thimble",                       "Mechanical",         15,   4, "pcs",    5),
    (19, "Bull Dog Clip",                 "Mechanical",         30,   8, "pcs",    3),
    (20, "Bull Dog Clip (Heavy)",         "Mechanical",         25,   8, "pcs",    3),
    (21, "Rope",                          "Mechanical",          5,   2, "set",   14),
    (22, "Roping Rubber Set",             "Mechanical",          8,   2, "set",    7),
    (23, "Motor Rubber Set",              "Mechanical",          6,   2, "set",    7),
    (24, "Fitter Weight",                 "Mechanical",          4,   1, "unit",  10),
    (25, "Diverter Pulley",               "Mechanical",          3,   1, "unit",  14),
    (26, "O.S.G. Set",                    "Mechanical",          1,   1, "set",   21),
    (27, "Pit Pulley Weight",             "Mechanical",          4,   1, "unit",  10),
    (28, "Governor Rope",                 "Mechanical",          4,   2, "pcs",    7),
    (29, "S.O.S.",                        "Mechanical",          5,   2, "set",   14),
    (30, "Buffer Spring",                 "Mechanical",          6,   2, "pcs",   10),
    (31, "Limit Cam With Bracket",        "Mechanical",          5,   2, "set",   10),
    (32, "S.I. Frame With STDR",          "Cabin & Structural",  3,   1, "set",   14),
    (33, "Cabin Complete",                "Cabin & Structural",  1,   1, "unit",  28),
    (34, "Brace Rod",                     "Cabin & Structural",  8,   2, "pcs",    7),
    (35, "COP As Required",               "Cabin & Structural",  4,   1, "unit",  14),
    (36, "LOP As Required",               "Cabin & Structural",  6,   2, "unit",  10),
    (37, "Fan Blower",                    "Controls",            5,   2, "unit",  10),
    (38, "TOCI",                          "Controls",            4,   2, "unit",  14),
    (39, "Junction Box",                  "Controls",            8,   2, "pcs",    7),
    (40, "Pencil",                        "Controls",           20,   5, "pcs",    3),
    (41, "Pencil Fixing Arrangement",     "Controls",           15,   4, "set",    5),
    (42, "Door Sensor",                   "Doors",               8,   3, "unit",  10),
    (43, "Car Door",                      "Doors",               3,   1, "unit",  21),
    (44, "Car Header",                    "Doors",               4,   1, "unit",  14),
    (45, "Load Switch",                   "Doors",               6,   2, "unit",  10),
    (46, "Oil as Required",               "Mechanical",         10,   3, "liters",  5),
    (47, "Landing Doors",                 "Doors",               0,   1, "set",   21),
    (48, "Dash Fastener",                "Doors",              40,  10, "pcs",    3),
    (49, "T Cable Flat 12 Core",          "Cables",              1,   1, "roll",  14),
    (50, "Ribbon Cable Rd. 12 Core",      "Cables",              4,   1, "roll",  14),
    (51, "Limit Switch Cable Rd. 6 Core", "Cables",              5,   2, "roll",  10),
    (52, "2 Core / 3 Core Cable",         "Cables",              6,   2, "roll",   7),
    (53, "Cable Hanger",                  "Cables",             15,   4, "pcs",    5),
    (54, "Bottom Cable Hanger / Angle",   "Cables",             12,   4, "pcs",    5),
    (55, "Controller / Drive / DBR",      "Controller",          1,   1, "unit",  28),
    (56, "ARD / Battery",                 "Controller",          0,   1, "unit",  21),
    (57, "Limit Switch",                  "Safety & Switches",   8,   3, "unit",  10),
    (58, "Limit Switch Bar With J Bolt",  "Safety & Switches",   6,   2, "set",   10),
    (59, 'Vans Bar With "J" Bolt',        "Safety & Switches",   5,   2, "set",   10),
    (60, "Vans Patti",                    "Safety & Switches",   6,   2, "pcs",    7),
    (61, "Alarm Set / Pit Switch",        "Safety & Switches",   4,   2, "set",   14),
    (62, "Magnet",                        "Safety & Switches",   8,   3, "pcs",    7),
    (63, "Wire 2.5mm / 0.75mm",           "Safety & Switches",   5,   2, "roll",   7),
    (64, "Flexible Pipe",                 "Safety & Switches",   8,   3, "roll",   5),
    (65, "Saddle Packet",                 "Safety & Switches",  20,   5, "pcs",    3),
    (66, "Hitch Plate",                   "Safety & Switches",   5,   2, "pcs",    7),
]

INSTALL_STAGE_CRITICAL_PARTS: dict[str, list[str]] = {
    "hoistway": ["Car Rail", "Cwt. Rail", "Bracket Car", "Bracket Cwt.", "Rack Bolt", "Combination Bracket"],
    "inspection": ["Car Rail", "Cwt. Rail", "Car Rail Clip", "Cwt. Rail Clip"],
    "install": [
        "Motor as per Drawing", "Rope", "Cabin Complete", "Landing Doors",
        "Controller / Drive / DBR", "ARD / Battery", "T Cable Flat 12 Core",
        "S.I. Frame With STDR", "Safety Complete", "O.S.G. Set",
    ],
    "quality": ["Limit Switch", "Alarm Set / Pit Switch", "Door Sensor", "Safety Complete", "Limit Switch Bar With J Bolt"],
}


def build_default_inventory() -> list[dict[str, Any]]:
    items = []
    for idx, (item_no, name, category, qty, reorder, unit, lead_time) in enumerate(LIFT_MATERIAL_CATALOG, start=1):
        status = "Out of Stock" if qty == 0 else "Low Stock" if qty <= reorder else "In Stock"
        items.append({
            "id": f"INV-{idx:03d}",
            "item_no": item_no,
            "name": name,
            "category": category,
            "qty_on_hand": qty,
            "qty_reserved": 0,
            "reorder_point": reorder,
            "unit": unit,
            "vendor": "",
            "lead_time_days": lead_time,
            "unit_cost": 0,
            "status": status,
            "notes": "",
            "po_number": "",
            "last_updated": "",
        })
    return items


def inventory_item_status(item: dict[str, Any]) -> str:
    if item.get("status") == "Ordered":
        return "Ordered"
    qty = int(item.get("qty_on_hand", 0))
    reorder = int(item.get("reorder_point", 0))
    if qty == 0:
        return "Out of Stock"
    if qty <= reorder:
        return "Low Stock"
    return "In Stock"


def load_inventory() -> list[dict[str, Any]]:
    defaults = build_default_inventory()
    if not INVENTORY_FILE.exists():
        INVENTORY_FILE.write_text(json.dumps(defaults, indent=2))
        return defaults
    try:
        data = json.loads(INVENTORY_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        return defaults
    if not isinstance(data, list):
        return defaults
    return data


def save_inventory() -> None:
    INVENTORY_FILE.write_text(json.dumps(INVENTORY, indent=2))


INVENTORY = load_inventory()


def load_org_chart() -> list[dict[str, Any]]:
    if not ORG_CHART_FILE.exists():
        ORG_CHART_FILE.write_text(json.dumps([], indent=2))
        return []
    try:
        data = json.loads(ORG_CHART_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        return []
    if not isinstance(data, list):
        return []
    return data


def save_org_chart() -> None:
    ORG_CHART_FILE.write_text(json.dumps(ORG_CHART, indent=2))


def next_org_node_id() -> str:
    existing = [n.get("id", "") for n in ORG_CHART]
    nums = [int(i.split("-")[1]) for i in existing if i.startswith("OC-") and i.split("-")[1].isdigit()]
    return f"OC-{(max(nums) + 1):03d}" if nums else "OC-001"


ORG_CHART: list[dict[str, Any]] = load_org_chart()


def refresh_org_chart() -> list[dict[str, Any]]:
    global ORG_CHART
    ORG_CHART = load_org_chart()
    return ORG_CHART


def load_attendance() -> list[dict[str, Any]]:
    if not ATTENDANCE_FILE.exists():
        ATTENDANCE_FILE.write_text(json.dumps([], indent=2))
        return []
    try:
        data = json.loads(ATTENDANCE_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        return []
    if not isinstance(data, list):
        return []
    return data


def save_attendance() -> None:
    ATTENDANCE_FILE.write_text(json.dumps(ATTENDANCE, indent=2))


def next_attendance_id() -> str:
    existing = [r.get("id", "") for r in ATTENDANCE]
    nums = [int(i.split("-")[1]) for i in existing if i.startswith("ATT-") and i.split("-")[1].isdigit()]
    return f"ATT-{(max(nums) + 1):04d}" if nums else "ATT-0001"


ATTENDANCE: list[dict[str, Any]] = load_attendance()


# ── Estimates ──────────────────────────────────────────────────────────────────

# ── Component-level costing data (sourced from docs/costing/*NewCostingMay2026.xlsx) ──
# All values are exact unit costs from the Excel sheets.
# Keyed by capacity string ("6","8",...) → config key → component dict.
# Fixed items: qty=1 unless noted.
# Variable items: guide_rail_rate (per section), bracket_rate (per unit, qty=11),
#   rope_base_4stops (total metres at 4 stops), rope_rate (per metre),
#   rope_num_ropes (used for per-stop scaling), landing_door_rate (per door/stop).
# Wiring: list of 5 fixed totals (already rate×qty from Excel).
# LOP/COP: looked up by num_stops in LOPCOP_BY_STOPS.

FLOOR_HEIGHT_MM: int = 3800  # standard floor-to-floor height in mm

# LOP/COP cost lookup — same across all sheets
LOPCOP_BY_STOPS: dict[int, int] = {
    2: 14000, 3: 16450, 4: 18900, 5: 21350,
    6: 23800, 7: 26250, 8: 28700, 9: 31150, 10: 33600,
}

COMPONENT_DATA: dict[str, dict] = {
    "6": {
        "MS Auto Door": {
            "car_cabin": 45000, "overload": 4000, "cabin_packing": 2500,
            "cabin_freight": 6000, "controller": 39000, "ard_battery": 13000,
            "safety": 28000, "osg_rope": 7910.6, "weight_counter": 10307.5,
            "sensor_door": 4500, "motor": 66500, "motor_hosting": 2500,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 43245, "other": 25000, "freight": 5000,
            "loading_unloading": 5000, "scaffolding": 7500,
            "guide_rail_rate": 5000, "bracket_rate": 950,
            "rope_base_4stops": 59.699999999999996, "rope_rate": 113, "rope_num_ropes": 3,
            "landing_door_rate": 17880,
        },
        "SS Auto Door": {
            "car_cabin": 85000, "overload": 4000, "cabin_packing": 2500,
            "cabin_freight": 6000, "controller": 39000, "ard_battery": 13000,
            "safety": 28000, "osg_rope": 7910.6, "weight_counter": 10307.5,
            "sensor_door": 4500, "motor": 66500, "motor_hosting": 2500,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 57016, "other": 25000, "freight": 5000,
            "loading_unloading": 5000, "scaffolding": 7500,
            "guide_rail_rate": 5000, "bracket_rate": 950,
            "rope_base_4stops": 59.699999999999996, "rope_rate": 113, "rope_num_ropes": 3,
            "landing_door_rate": 40191,
        },
        "MS Manual Door": {
            "car_cabin": 45000, "overload": 4000, "cabin_packing": 2500,
            "cabin_freight": 6000, "controller": 0, "ard_battery": 0,
            "safety": 0, "osg_rope": 7910.6, "weight_counter": 0,
            "sensor_door": 0, "motor": 0, "motor_hosting": 2500,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 8500, "other": 10000, "freight": 10000,
            "loading_unloading": 5000, "scaffolding": 7500,
            "guide_rail_rate": 5000, "bracket_rate": 7200,
            "rope_base_4stops": 59.699999999999996, "rope_rate": 113, "rope_num_ropes": 3,
            "landing_door_rate": 12300,
        },
        "SS Manual Door": {
            "car_cabin": 85000, "overload": 4000, "cabin_packing": 2500,
            "cabin_freight": 6000, "controller": 0, "ard_battery": 0,
            "safety": 0, "osg_rope": 7910.6, "weight_counter": 0,
            "sensor_door": 0, "motor": 66500, "motor_hosting": 2500,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 26500, "other": 10000, "freight": 10000,
            "loading_unloading": 5000, "scaffolding": 7500,
            "guide_rail_rate": 5000, "bracket_rate": 7200,
            "rope_base_4stops": 59.699999999999996, "rope_rate": 113, "rope_num_ropes": 3,
            "landing_door_rate": 40300,
        },
        "MS Gearless Auto Door": {
            "car_cabin": 45000, "overload": 4000, "cabin_packing": 2500,
            "cabin_freight": 6000, "controller": 68000, "ard_battery": 13000,
            "safety": 40000, "osg_rope": 7910.6, "weight_counter": 10307.5,
            "sensor_door": 4500, "motor": 79600, "motor_hosting": 2500,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 43245, "other": 25000, "freight": 5000,
            "loading_unloading": 5000, "scaffolding": 7500,
            "guide_rail_rate": 5000, "bracket_rate": 1350,
            "rope_base_4stops": 151.2, "rope_rate": 77, "rope_num_ropes": 4,
            "landing_door_rate": 17880,
        },
        "SS Gearless Auto Door": {
            "car_cabin": 85000, "overload": 4000, "cabin_packing": 2500,
            "cabin_freight": 6000, "controller": 68000, "ard_battery": 13000,
            "safety": 40000, "osg_rope": 7910.6, "weight_counter": 10307.5,
            "sensor_door": 4500, "motor": 79600, "motor_hosting": 2500,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 57016, "other": 25000, "freight": 5000,
            "loading_unloading": 5000, "scaffolding": 7500,
            "guide_rail_rate": 5000, "bracket_rate": 1350,
            "rope_base_4stops": 151.2, "rope_rate": 77, "rope_num_ropes": 4,
            "landing_door_rate": 40191,
        },
    },
    "8": {
        "MS Auto Door": {
            "car_cabin": 50000, "overload": 4000, "cabin_packing": 2500,
            "cabin_freight": 6000, "controller": 46000, "ard_battery": 17000,
            "safety": 28000, "osg_rope": 7910.6, "weight_counter": 10307.5,
            "sensor_door": 4500, "motor": 66500, "motor_hosting": 2500,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 43245, "other": 25000, "freight": 5000,
            "loading_unloading": 5000, "scaffolding": 7500,
            "guide_rail_rate": 5000, "bracket_rate": 950,
            "rope_base_4stops": 59.699999999999996, "rope_rate": 113, "rope_num_ropes": 4,
            "landing_door_rate": 17880,
        },
        "SS Auto Door": {
            "car_cabin": 90000, "overload": 4000, "cabin_packing": 2500,
            "cabin_freight": 6000, "controller": 46000, "ard_battery": 17000,
            "safety": 28000, "osg_rope": 7910.6, "weight_counter": 10307.5,
            "sensor_door": 4500, "motor": 66500, "motor_hosting": 2500,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 57016, "other": 25000, "freight": 5000,
            "loading_unloading": 5000, "scaffolding": 7500,
            "guide_rail_rate": 5000, "bracket_rate": 950,
            "rope_base_4stops": 59.699999999999996, "rope_rate": 113, "rope_num_ropes": 4,
            "landing_door_rate": 40191,
        },
        "MS Manual Door": {
            "car_cabin": 50000, "overload": 4000, "cabin_packing": 2500,
            "cabin_freight": 6000, "controller": 0, "ard_battery": 0,
            "safety": 0, "osg_rope": 7910.6, "weight_counter": 0,
            "sensor_door": 0, "motor": 0, "motor_hosting": 2500,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 8500, "other": 25000, "freight": 5000,
            "loading_unloading": 5000, "scaffolding": 7500,
            "guide_rail_rate": 5000, "bracket_rate": 7200,
            "rope_base_4stops": 59.699999999999996, "rope_rate": 113, "rope_num_ropes": 4,
            "landing_door_rate": 12300,
        },
        "SS Manual Door": {
            "car_cabin": 90000, "overload": 4000, "cabin_packing": 2500,
            "cabin_freight": 6000, "controller": 0, "ard_battery": 0,
            "safety": 0, "osg_rope": 7910.6, "weight_counter": 0,
            "sensor_door": 0, "motor": 66500, "motor_hosting": 2500,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 26500, "other": 25000, "freight": 5000,
            "loading_unloading": 5000, "scaffolding": 7500,
            "guide_rail_rate": 5000, "bracket_rate": 7200,
            "rope_base_4stops": 59.699999999999996, "rope_rate": 113, "rope_num_ropes": 4,
            "landing_door_rate": 36500,
        },
        "MS Gearless Auto Door": {
            "car_cabin": 50000, "overload": 4000, "cabin_packing": 2500,
            "cabin_freight": 6000, "controller": 71000, "ard_battery": 17000,
            "safety": 40000, "osg_rope": 7910.6, "weight_counter": 10307.5,
            "sensor_door": 4500, "motor": 86200, "motor_hosting": 2500,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 43245, "other": 25000, "freight": 5000,
            "loading_unloading": 5000, "scaffolding": 7500,
            "guide_rail_rate": 5000, "bracket_rate": 1350,
            "rope_base_4stops": 151.2, "rope_rate": 77, "rope_num_ropes": 4,
            "landing_door_rate": 17880,
        },
        "SS Gearless Auto Door": {
            "car_cabin": 90000, "overload": 4000, "cabin_packing": 2500,
            "cabin_freight": 6000, "controller": 71000, "ard_battery": 17000,
            "safety": 40000, "osg_rope": 7910.6, "weight_counter": 10307.5,
            "sensor_door": 4500, "motor": 86200, "motor_hosting": 2500,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 57016, "other": 25000, "freight": 5000,
            "loading_unloading": 5000, "scaffolding": 7500,
            "guide_rail_rate": 5000, "bracket_rate": 1350,
            "rope_base_4stops": 151.2, "rope_rate": 77, "rope_num_ropes": 4,
            "landing_door_rate": 40191,
        },
    },
    "10": {
        "MS Auto Door": {
            "car_cabin": 60000, "overload": 4000, "cabin_packing": 3500,
            "cabin_freight": 6000, "controller": 54000, "ard_battery": 22000,
            "safety": 35000, "osg_rope": 8638.25, "weight_counter": 15314,
            "sensor_door": 4500, "motor": 66500, "motor_hosting": 2500,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 43245, "other": 25000, "freight": 5000,
            "loading_unloading": 5000, "scaffolding": 7500,
            "guide_rail_rate": 6700, "bracket_rate": 950,
            "rope_base_4stops": 79.6, "rope_rate": 113, "rope_num_ropes": 4,
            "landing_door_rate": 17880,
        },
        "SS Auto Door": {
            "car_cabin": 100000, "overload": 4000, "cabin_packing": 3500,
            "cabin_freight": 6000, "controller": 54000, "ard_battery": 22000,
            "safety": 35000, "osg_rope": 8638.25, "weight_counter": 15314,
            "sensor_door": 4500, "motor": 66500, "motor_hosting": 2500,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 57016, "other": 25000, "freight": 5000,
            "loading_unloading": 5000, "scaffolding": 7500,
            "guide_rail_rate": 6700, "bracket_rate": 950,
            "rope_base_4stops": 79.6, "rope_rate": 113, "rope_num_ropes": 4,
            "landing_door_rate": 40191,
        },
        "MS Manual Door": {
            "car_cabin": 60000, "overload": 4000, "cabin_packing": 2500,
            "cabin_freight": 6000, "controller": 0, "ard_battery": 0,
            "safety": 0, "osg_rope": 8638.25, "weight_counter": 0,
            "sensor_door": 0, "motor": 0, "motor_hosting": 2500,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 8500, "other": 25000, "freight": 5000,
            "loading_unloading": 5000, "scaffolding": 7500,
            "guide_rail_rate": 6700, "bracket_rate": 7200,
            "rope_base_4stops": 79.6, "rope_rate": 113, "rope_num_ropes": 4,
            "landing_door_rate": 12300,
        },
        "SS Manual Door": {
            "car_cabin": 100000, "overload": 4000, "cabin_packing": 2500,
            "cabin_freight": 6000, "controller": 0, "ard_battery": 0,
            "safety": 0, "osg_rope": 8638.25, "weight_counter": 0,
            "sensor_door": 0, "motor": 66500, "motor_hosting": 2500,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 26500, "other": 25000, "freight": 5000,
            "loading_unloading": 5000, "scaffolding": 7500,
            "guide_rail_rate": 6700, "bracket_rate": 7200,
            "rope_base_4stops": 79.6, "rope_rate": 113, "rope_num_ropes": 4,
            "landing_door_rate": 36500,
        },
        "MS Gearless Auto Door": {
            "car_cabin": 60000, "overload": 4000, "cabin_packing": 3500,
            "cabin_freight": 6000, "controller": 71000, "ard_battery": 17000,
            "safety": 50000, "osg_rope": 8638.25, "weight_counter": 15314,
            "sensor_door": 4500, "motor": 94000, "motor_hosting": 2500,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 43245, "other": 25000, "freight": 5000,
            "loading_unloading": 5000, "scaffolding": 7500,
            "guide_rail_rate": 6700, "bracket_rate": 1550,
            "rope_base_4stops": 189.0, "rope_rate": 77, "rope_num_ropes": 5,
            "landing_door_rate": 17880,
        },
        "SS Gearless Auto Door": {
            "car_cabin": 100000, "overload": 4000, "cabin_packing": 3500,
            "cabin_freight": 6000, "controller": 71000, "ard_battery": 22000,
            "safety": 50000, "osg_rope": 8638.25, "weight_counter": 15314,
            "sensor_door": 4500, "motor": 94000, "motor_hosting": 2500,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 57016, "other": 25000, "freight": 5000,
            "loading_unloading": 5000, "scaffolding": 7500,
            "guide_rail_rate": 6700, "bracket_rate": 1550,
            "rope_base_4stops": 189.0, "rope_rate": 77, "rope_num_ropes": 5,
            "landing_door_rate": 40191,
        },
    },
    "13": {
        "MS Auto Door": {
            "car_cabin": 85000, "overload": 13000, "cabin_packing": 3500,
            "cabin_freight": 6000, "controller": 64000, "ard_battery": 26500,
            "safety": 80000, "osg_rope": 9365.9, "weight_counter": 18755,
            "sensor_door": 4500, "motor": 66500, "motor_hosting": 10000,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 44864, "other": 25000, "freight": 7000,
            "loading_unloading": 7000, "scaffolding": 10000,
            "guide_rail_rate": 8200, "bracket_rate": 1950,
            "rope_base_4stops": 79.6, "rope_rate": 113, "rope_num_ropes": 4,
            "landing_door_rate": 18754,
        },
        "SS Auto Door": {
            "car_cabin": 120000, "overload": 4000, "cabin_packing": 3500,
            "cabin_freight": 6000, "controller": 64000, "ard_battery": 26500,
            "safety": 80000, "osg_rope": 9365.9, "weight_counter": 18755,
            "sensor_door": 4500, "motor": 66500, "motor_hosting": 10000,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 60994, "other": 25000, "freight": 7000,
            "loading_unloading": 7000, "scaffolding": 7500,
            "guide_rail_rate": 8200, "bracket_rate": 1950,
            "rope_base_4stops": 79.6, "rope_rate": 113, "rope_num_ropes": 4,
            "landing_door_rate": 41731,
        },
        "MS Manual Door": {
            "car_cabin": 85000, "overload": 4000, "cabin_packing": 2500,
            "cabin_freight": 6000, "controller": 0, "ard_battery": 0,
            "safety": 0, "osg_rope": 9365.9, "weight_counter": 0,
            "sensor_door": 0, "motor": 0, "motor_hosting": 2500,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 8500, "other": 25000, "freight": 5000,
            "loading_unloading": 7000, "scaffolding": 7500,
            "guide_rail_rate": 8200, "bracket_rate": 7200,
            "rope_base_4stops": 79.6, "rope_rate": 113, "rope_num_ropes": 4,
            "landing_door_rate": 12300,
        },
        "SS Manual Door": {
            "car_cabin": 120000, "overload": 4000, "cabin_packing": 2500,
            "cabin_freight": 6000, "controller": 0, "ard_battery": 0,
            "safety": 0, "osg_rope": 9365.9, "weight_counter": 0,
            "sensor_door": 0, "motor": 66500, "motor_hosting": 2500,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 26500, "other": 25000, "freight": 5000,
            "loading_unloading": 7000, "scaffolding": 7500,
            "guide_rail_rate": 8200, "bracket_rate": 7200,
            "rope_base_4stops": 79.6, "rope_rate": 113, "rope_num_ropes": 4,
            "landing_door_rate": 36500,
        },
        "MS Gearless Auto Door": {
            "car_cabin": 85000, "overload": 4000, "cabin_packing": 3500,
            "cabin_freight": 6000, "controller": 85000, "ard_battery": 17000,
            "safety": 80000, "osg_rope": 9365.9, "weight_counter": 18755,
            "sensor_door": 4500, "motor": 120000, "motor_hosting": 5000,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 44864, "other": 25000, "freight": 7000,
            "loading_unloading": 7000, "scaffolding": 7500,
            "guide_rail_rate": 8200, "bracket_rate": 1350,
            "rope_base_4stops": 226.79999999999998, "rope_rate": 77, "rope_num_ropes": 5,
            "landing_door_rate": 18754,
        },
        "SS Gearless Auto Door": {
            "car_cabin": 120000, "overload": 4000, "cabin_packing": 3500,
            "cabin_freight": 6000, "controller": 85000, "ard_battery": 26500,
            "safety": 80000, "osg_rope": 9365.9, "weight_counter": 18755,
            "sensor_door": 4500, "motor": 120000, "motor_hosting": 5000,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 60994, "other": 25000, "freight": 7000,
            "loading_unloading": 7000, "scaffolding": 7500,
            "guide_rail_rate": 8200, "bracket_rate": 1350,
            "rope_base_4stops": 226.79999999999998, "rope_rate": 77, "rope_num_ropes": 5,
            "landing_door_rate": 43731,
        },
    },
    "15": {
        "MS Auto Door": {
            "car_cabin": 85000, "overload": 13000, "cabin_packing": 3500,
            "cabin_freight": 6000, "controller": 64000, "ard_battery": 26500,
            "safety": 80000, "osg_rope": 10093.55, "weight_counter": 23017.5,
            "sensor_door": 4500, "motor": 66500, "motor_hosting": 10000,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 44864, "other": 25000, "freight": 7000,
            "loading_unloading": 7000, "scaffolding": 10000,
            "guide_rail_rate": 8200, "bracket_rate": 1950,
            "rope_base_4stops": 79.6, "rope_rate": 113, "rope_num_ropes": 4,
            "landing_door_rate": 18754,
        },
        "SS Auto Door": {
            "car_cabin": 130000, "overload": 4000, "cabin_packing": 3500,
            "cabin_freight": 6000, "controller": 64000, "ard_battery": 26500,
            "safety": 80000, "osg_rope": 10093.55, "weight_counter": 23017.5,
            "sensor_door": 4500, "motor": 66500, "motor_hosting": 10000,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 60995, "other": 25000, "freight": 7000,
            "loading_unloading": 7000, "scaffolding": 7500,
            "guide_rail_rate": 8200, "bracket_rate": 1950,
            "rope_base_4stops": 79.6, "rope_rate": 113, "rope_num_ropes": 4,
            "landing_door_rate": 41731,
        },
        "MS Manual Door": {
            "car_cabin": 85000, "overload": 4000, "cabin_packing": 2500,
            "cabin_freight": 6000, "controller": 0, "ard_battery": 0,
            "safety": 0, "osg_rope": 10093.55, "weight_counter": 0,
            "sensor_door": 0, "motor": 0, "motor_hosting": 2500,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 8500, "other": 25000, "freight": 5000,
            "loading_unloading": 7000, "scaffolding": 7500,
            "guide_rail_rate": 8200, "bracket_rate": 7200,
            "rope_base_4stops": 79.6, "rope_rate": 113, "rope_num_ropes": 4,
            "landing_door_rate": 12300,
        },
        "SS Manual Door": {
            "car_cabin": 130000, "overload": 4000, "cabin_packing": 2500,
            "cabin_freight": 6000, "controller": 0, "ard_battery": 0,
            "safety": 0, "osg_rope": 10093.55, "weight_counter": 0,
            "sensor_door": 0, "motor": 66500, "motor_hosting": 2500,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 26500, "other": 25000, "freight": 5000,
            "loading_unloading": 7000, "scaffolding": 7500,
            "guide_rail_rate": 8200, "bracket_rate": 7200,
            "rope_base_4stops": 79.6, "rope_rate": 113, "rope_num_ropes": 4,
            "landing_door_rate": 36500,
        },
        "MS Gearless Auto Door": {
            "car_cabin": 85000, "overload": 4000, "cabin_packing": 3500,
            "cabin_freight": 6000, "controller": 85000, "ard_battery": 17000,
            "safety": 80000, "osg_rope": 10093.55, "weight_counter": 23017.5,
            "sensor_door": 4500, "motor": 120000, "motor_hosting": 5000,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 44864, "other": 25000, "freight": 7000,
            "loading_unloading": 7000, "scaffolding": 7500,
            "guide_rail_rate": 8200, "bracket_rate": 1350,
            "rope_base_4stops": 264.59999999999997, "rope_rate": 77, "rope_num_ropes": 5,
            "landing_door_rate": 18754,
        },
        "SS Gearless Auto Door": {
            "car_cabin": 130000, "overload": 4000, "cabin_packing": 3500,
            "cabin_freight": 6000, "controller": 85000, "ard_battery": 26500,
            "safety": 80000, "osg_rope": 10093.55, "weight_counter": 23017.5,
            "sensor_door": 4500, "motor": 120000, "motor_hosting": 5000,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 60995, "other": 25000, "freight": 7000,
            "loading_unloading": 7000, "scaffolding": 7500,
            "guide_rail_rate": 8200, "bracket_rate": 1350,
            "rope_base_4stops": 264.59999999999997, "rope_rate": 77, "rope_num_ropes": 5,
            "landing_door_rate": 41731,
        },
    },
    "20": {
        "MS Auto Door": {
            "car_cabin": 95000, "overload": 13000, "cabin_packing": 3500,
            "cabin_freight": 6000, "controller": 64000, "ard_battery": 33000,
            "safety": 90000, "osg_rope": 12257.6, "weight_counter": 29062.5,
            "sensor_door": 4500, "motor": 66500, "motor_hosting": 10000,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 55737, "other": 30000, "freight": 10000,
            "loading_unloading": 10000, "scaffolding": 10000,
            "guide_rail_rate": 9200, "bracket_rate": 1950,
            "rope_base_4stops": 99.5, "rope_rate": 113, "rope_num_ropes": 5,
            "landing_door_rate": 25045,
        },
        "SS Auto Door": {
            "car_cabin": 130000, "overload": 4000, "cabin_packing": 3500,
            "cabin_freight": 6000, "controller": 64000, "ard_battery": 33000,
            "safety": 90000, "osg_rope": 12257.6, "weight_counter": 29062.5,
            "sensor_door": 4500, "motor": 66500, "motor_hosting": 10000,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 60406, "other": 30000, "freight": 10000,
            "loading_unloading": 10000, "scaffolding": 7500,
            "guide_rail_rate": 9200, "bracket_rate": 1950,
            "rope_base_4stops": 99.5, "rope_rate": 113, "rope_num_ropes": 5,
            "landing_door_rate": 33700,
        },
        "MS Manual Door": {
            "car_cabin": 95000, "overload": 4000, "cabin_packing": 2500,
            "cabin_freight": 6000, "controller": 0, "ard_battery": 0,
            "safety": 0, "osg_rope": 12257.6, "weight_counter": 0,
            "sensor_door": 0, "motor": 0, "motor_hosting": 2500,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 8500, "other": 25000, "freight": 5000,
            "loading_unloading": 10000, "scaffolding": 7500,
            "guide_rail_rate": 9200, "bracket_rate": 7200,
            "rope_base_4stops": 99.5, "rope_rate": 113, "rope_num_ropes": 5,
            "landing_door_rate": 12300,
        },
        "SS Manual Door": {
            "car_cabin": 130000, "overload": 4000, "cabin_packing": 2500,
            "cabin_freight": 6000, "controller": 0, "ard_battery": 0,
            "safety": 0, "osg_rope": 12257.6, "weight_counter": 0,
            "sensor_door": 0, "motor": 66500, "motor_hosting": 2500,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 26500, "other": 25000, "freight": 5000,
            "loading_unloading": 10000, "scaffolding": 7500,
            "guide_rail_rate": 9200, "bracket_rate": 7200,
            "rope_base_4stops": 99.5, "rope_rate": 113, "rope_num_ropes": 5,
            "landing_door_rate": 36500,
        },
        "MS Gearless Auto Door": {
            "car_cabin": 95000, "overload": 4000, "cabin_packing": 3500,
            "cabin_freight": 6000, "controller": 107000, "ard_battery": 26500,
            "safety": 90000, "osg_rope": 12257.6, "weight_counter": 29062.5,
            "sensor_door": 4500, "motor": 148000, "motor_hosting": 5000,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 55737, "other": 30000, "freight": 10000,
            "loading_unloading": 10000, "scaffolding": 7500,
            "guide_rail_rate": 9200, "bracket_rate": 1350,
            "rope_base_4stops": 302.4, "rope_rate": 96, "rope_num_ropes": 8,
            "landing_door_rate": 25045,
        },
        "SS Gearless Auto Door": {
            "car_cabin": 130000, "overload": 4000, "cabin_packing": 3500,
            "cabin_freight": 6000, "controller": 107000, "ard_battery": 33000,
            "safety": 90000, "osg_rope": 12257.6, "weight_counter": 29062.5,
            "sensor_door": 4500, "motor": 148000, "motor_hosting": 5000,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 60406, "other": 30000, "freight": 10000,
            "loading_unloading": 10000, "scaffolding": 7500,
            "guide_rail_rate": 9200, "bracket_rate": 1350,
            "rope_base_4stops": 302.4, "rope_rate": 96, "rope_num_ropes": 8,
            "landing_door_rate": 33700,
        },
    },
    "26": {
        "MS Auto Door": {
            "car_cabin": 115000, "overload": 13000, "cabin_packing": 3500,
            "cabin_freight": 6000, "controller": 64000, "ard_battery": 33000,
            "safety": 115000, "osg_rope": 12257.6, "weight_counter": 34875,
            "sensor_door": 4500, "motor": 66500, "motor_hosting": 10000,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 55737, "other": 30000, "freight": 10000,
            "loading_unloading": 10000, "scaffolding": 10000,
            "guide_rail_rate": 9200, "bracket_rate": 2350,
            "rope_base_4stops": 99.5, "rope_rate": 113, "rope_num_ropes": 5,
            "landing_door_rate": 25045,
        },
        "SS Auto Door": {
            "car_cabin": 150000, "overload": 4000, "cabin_packing": 3500,
            "cabin_freight": 6000, "controller": 64000, "ard_battery": 33000,
            "safety": 115000, "osg_rope": 12257.6, "weight_counter": 34875,
            "sensor_door": 4500, "motor": 66500, "motor_hosting": 10000,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 60406, "other": 30000, "freight": 10000,
            "loading_unloading": 10000, "scaffolding": 7500,
            "guide_rail_rate": 9200, "bracket_rate": 2350,
            "rope_base_4stops": 99.5, "rope_rate": 113, "rope_num_ropes": 5,
            "landing_door_rate": 33700,
        },
        "MS Manual Door": {
            "car_cabin": 115000, "overload": 4000, "cabin_packing": 2500,
            "cabin_freight": 6000, "controller": 0, "ard_battery": 0,
            "safety": 0, "osg_rope": 12257.6, "weight_counter": 0,
            "sensor_door": 0, "motor": 0, "motor_hosting": 2500,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 8500, "other": 25000, "freight": 5000,
            "loading_unloading": 10000, "scaffolding": 7500,
            "guide_rail_rate": 9200, "bracket_rate": 7200,
            "rope_base_4stops": 99.5, "rope_rate": 113, "rope_num_ropes": 5,
            "landing_door_rate": 12300,
        },
        "SS Manual Door": {
            "car_cabin": 150000, "overload": 4000, "cabin_packing": 2500,
            "cabin_freight": 6000, "controller": 0, "ard_battery": 0,
            "safety": 0, "osg_rope": 12257.6, "weight_counter": 0,
            "sensor_door": 0, "motor": 66500, "motor_hosting": 2500,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 26500, "other": 25000, "freight": 5000,
            "loading_unloading": 10000, "scaffolding": 7500,
            "guide_rail_rate": 9200, "bracket_rate": 7200,
            "rope_base_4stops": 99.5, "rope_rate": 113, "rope_num_ropes": 5,
            "landing_door_rate": 36500,
        },
        "MS Gearless Auto Door": {
            "car_cabin": 115000, "overload": 4000, "cabin_packing": 3500,
            "cabin_freight": 6000, "controller": 129000, "ard_battery": 33000,
            "safety": 115000, "osg_rope": 12257.6, "weight_counter": 34875,
            "sensor_door": 4500, "motor": 148000, "motor_hosting": 5000,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 55737, "other": 30000, "freight": 10000,
            "loading_unloading": 10000, "scaffolding": 7500,
            "guide_rail_rate": 9200, "bracket_rate": 1350,
            "rope_base_4stops": 302.4, "rope_rate": 96, "rope_num_ropes": 8,
            "landing_door_rate": 25045,
        },
        "SS Gearless Auto Door": {
            "car_cabin": 150000, "overload": 4000, "cabin_packing": 3500,
            "cabin_freight": 6000, "controller": 129000, "ard_battery": 33000,
            "safety": 115000, "osg_rope": 12257.6, "weight_counter": 34875,
            "sensor_door": 4500, "motor": 148000, "motor_hosting": 5000,
            "cable": 12236.8,
            "wiring_totals": [1976, 2967, 4025, 1860, 1350],
            "car_door": 60406, "other": 30000, "freight": 10000,
            "loading_unloading": 10000, "scaffolding": 7500,
            "guide_rail_rate": 9200, "bracket_rate": 1350,
            "rope_base_4stops": 302.4, "rope_rate": 96, "rope_num_ropes": 8,
            "landing_door_rate": 33700,
        },
    },
}
EXCEL_CAPACITY_ORDER: list[int] = [6, 8, 10, 13, 15, 20, 26]

ELEVATOR_TYPES: list[str] = ["Passenger", "Goods", "Dumbwaiter"]
PASSENGER_CAPACITY_OPTIONS: list[str] = [
    "1 Passenger", "2 Passengers", "3 Passengers",
    "6 Passengers", "8 Passengers", "10 Passengers",
    "13 Passengers", "15 Passengers", "16 Passengers",
    "20 Passengers", "26 Passengers",
]
GOODS_CAPACITY_OPTIONS: list[str] = [
    "500 kg", "1000 kg", "1500 kg", "2000 kg",
    "2500 kg", "3000 kg", "4000 kg", "5000 kg",
]
CAPACITY_OPTIONS: list[str] = PASSENGER_CAPACITY_OPTIONS  # backwards compat alias
SPEED_OPTIONS: list[str] = ["0.65 mps", "1 mps", "1.25 mps", "1.5 mps", "1.75 mps", "2 mps"]
MOTOR_OPTIONS: list[str] = ["Gearless", "Geared", "Hydraulic", "Vacuum"]
DRIVE_OPTIONS: list[str] = MOTOR_OPTIONS  # backwards compat alias
FINISH_OPTIONS: list[str] = ["Mild Steel", "Stainless Steel", "Golden", "Rose Gold"]
DOOR_OPTIONS: list[str] = ["Automatic", "Manual"]
DOOR_CONSTRUCTION_OPTIONS: list[str] = ["Mild Steel", "Stainless Steel", "Golden", "Rose Gold"]
DOOR_PANEL_OPTIONS: list[int] = [1, 2, 3, 4]
DOOR_OPENING_TYPE_OPTIONS: list[str] = ["Center", "Side"]
DOOR_VISION_OPTIONS: list[str] = ["Non Vision", "Small Vision", "Big Vision", "Full Vision"]
DOOR_WIDTH_OPTIONS: list[int] = [700, 800, 900, 1000, 1100, 1200, 1300, 1400]
DOOR_HEIGHT_OPTIONS: list[int] = [2000, 2100, 2200, 2300, 2400]
DOOR_ARRANGEMENT_OPTIONS: list[str] = [
    "All Are Same Side", "One Floor Reverse Opening", "One Floor Both Side Opening",
]
MAKE_OPTIONS: list[str] = ["Fuzi", "Wittur German Kit", "PVE", "Fuzi IS 17900", "Fuzi PWD BSR 2025"]
CONTROL_OPTIONS: list[str] = ["Basic Relay", "Collective Control", "Microprocessor", "Smart IoT"]
CONTROL_SURCHARGE: dict[str, int] = {
    "Basic Relay": 0, "Collective Control": 0, "Microprocessor": 35000, "Smart IoT": 75000,
}
ADDON_COSTS: dict[str, int] = {
    "ARD / Rescue Device": 25000, "Load Weighing Sensor": 12000, "Cabin CCTV": 15000,
    "Intercom / Phone": 8000, "Remote Monitoring": 20000, "UPS Backup Power": 18000,
    "AMC 1 Year": 22000, "AMC 3 Year": 55000, "Modernisation Package": 75000,
}


def _excel_config_key(drive: str, finish: str, door: str) -> str:
    """Map form field values to one of the 6 Excel configuration keys."""
    gearless = drive in ("Gearless", "Gearless MRL", "VFD Traction")
    cabin_ss = finish in ("Stainless Steel", "Golden", "Rose Gold", "Premium (SS)", "Custom / Bespoke (SS)") or (
        finish not in ("Mild Steel", "Basic (MS)", "Standard (MS)") and "SS" in finish
    )
    door_auto = door in ("Automatic", "Automatic SS", "Automatic Glass")
    mat = "SS" if cabin_ss else "MS"
    if gearless:
        return f"{mat} Gearless Auto Door"
    return f"{mat} {'Auto' if door_auto else 'Manual'} Door"


def _li(label: str, qty: float, unit: str, rate: float) -> dict:
    """Build a single line-item dict."""
    total = round(qty * rate, 2)
    return {"label": label, "qty": qty, "unit": unit, "rate": round(rate, 2), "total": total}


def calculate_full_breakdown(data: dict) -> dict:
    """Compute a full component-level cost breakdown mirroring the Excel worksheets."""
    import re as _re

    # ── 1. Resolve capacity and config ────────────────────────────────────────
    raw = str(data.get("capacity", "6 Passengers"))
    m_pax = _re.match(r"(\d+)[- ]person", raw)
    m_kg = _re.match(r"(\d+)\s*kg", raw.strip())
    if m_pax:
        raw_cap = int(m_pax.group(1))
    elif m_kg:
        raw_cap = math.ceil(int(m_kg.group(1)) / 75)
    else:
        m_any = _re.match(r"(\d+)", raw)
        raw_cap = int(m_any.group(1)) if m_any else 8
    excel_cap = next((c for c in EXCEL_CAPACITY_ORDER if raw_cap <= c), 26)

    motor = data.get("motor_type") or data.get("drive_type", "Gearless")
    config_key = _excel_config_key(
        motor,
        data.get("cabin_finish", "Stainless Steel"),
        data.get("door_type", "Automatic"),
    )
    cd = COMPONENT_DATA[str(excel_cap)][config_key]
    num_stops = max(2, min(int(data.get("num_floors", 4)), 20))

    # ── 2. Build material line items ──────────────────────────────────────────
    items: list[dict] = []

    # Fixed items (qty=1)
    items.append(_li("Car Cabin", 1, "set", cd["car_cabin"]))
    items.append(_li("Motor / Drive Unit", 1, "set", cd["motor"]))
    items.append(_li("Motor Hosting", 1, "set", cd["motor_hosting"]))
    items.append(_li("Controller with Drive + DBR", 1, "set", cd["controller"]))
    items.append(_li("ARD (UPS) with Battery", 1, "set", cd["ard_battery"]))
    items.append(_li("Geared/Gearless Safety", 1, "set", cd["safety"]))
    items.append(_li("OSG with Rope", 1, "set", cd["osg_rope"]))
    items.append(_li("Weight Counter with Granite Floor", 1, "set", cd["weight_counter"]))
    items.append(_li("Overload Device", 1, "set", cd["overload"]))
    items.append(_li("Cabin Packing Charges", 1, "set", cd["cabin_packing"]))
    items.append(_li("Cabin Inward Transport & Freight", 1, "set", cd["cabin_freight"]))
    if cd["sensor_door"] > 0:
        items.append(_li("Sensor Door", 1, "set", cd["sensor_door"]))
    items.append(_li("Car Door", 1, "set", cd["car_door"]))
    items.append(_li("Cable (travelling)", 1, "lot", cd["cable"]))

    # 5 Wiring lines (fixed totals from Excel)
    for idx, w_total in enumerate(cd["wiring_totals"], start=1):
        items.append(_li(f"Wiring Line {idx}", 1, "lot", w_total))

    items.append(_li("Other (& Channel)", 1, "lot", cd["other"]))
    items.append(_li("Freight", 1, "lot", cd["freight"]))
    items.append(_li("Loading & Unloading", 1, "lot", cd["loading_unloading"]))
    items.append(_li("Scaffolding", 1, "lot", cd["scaffolding"]))

    # ── 3. Variable items ─────────────────────────────────────────────────────
    # Guide Rail: qty = stops * 2 sections
    gr_qty = num_stops * 2
    items.append(_li("Guide Rail", gr_qty, "sections", cd["guide_rail_rate"]))

    # Bracket: fixed qty=11
    items.append(_li("Bracket", 11, "nos", cd["bracket_rate"]))

    # LOP/COP: lookup by stops, extrapolate at +₹2450/stop beyond 10
    lopcop_cost = LOPCOP_BY_STOPS.get(
        num_stops,
        LOPCOP_BY_STOPS[10] + (num_stops - 10) * 2450 if num_stops > 10 else LOPCOP_BY_STOPS[2]
    )
    items.append(_li("LOP / COP Panel", 1, "set", lopcop_cost))

    # Rope: base metres at 4 stops, scaled linearly for other stop counts
    # Formula: total_m = base_4stops + (stops - 4) * (floor_height_m * num_ropes)
    floor_h_m = max(2.4, min(int(data.get("floor_height_mm", FLOOR_HEIGHT_MM)), 5000)) / 1000.0
    extra_stops = num_stops - 4
    rope_total_m = cd["rope_base_4stops"] + extra_stops * floor_h_m * cd["rope_num_ropes"]
    rope_total_m = max(rope_total_m, cd["rope_base_4stops"] * (num_stops / 4))  # safety floor
    items.append(_li("Rope", round(rope_total_m, 2), "metres", cd["rope_rate"]))

    # Landing Door: one per stop
    items.append(_li("Landing Door", num_stops, "nos", cd["landing_door_rate"]))

    # ── 4. Installation & Commissioning ──────────────────────────────────────
    installation_total = 12000 * num_stops
    commissioning_total = 12000

    # ── 5. Compute subtotals ──────────────────────────────────────────────────
    materials_subtotal = sum(i["total"] for i in items)
    pre_warranty_subtotal = materials_subtotal + installation_total + commissioning_total

    # Warranty = 5% of pre-warranty subtotal
    warranty_total = round(pre_warranty_subtotal * 0.05, 2)

    # ── 6. Grand subtotal (before control surcharge, addons, margin) ──────────
    base_subtotal = pre_warranty_subtotal + warranty_total

    # ── 7. Control type surcharge ─────────────────────────────────────────────
    control_surcharge = CONTROL_SURCHARGE.get(data.get("control_type", "Collective Control"), 0)
    base_cost = round(base_subtotal + control_surcharge)

    # ── 8. Add-ons ────────────────────────────────────────────────────────────
    addons_list: list[str] = data.get("addons", [])
    addons_cost = sum(ADDON_COSTS.get(a, 0) for a in addons_list)

    subtotal_for_margin = base_cost + addons_cost

    # ── 9. Margin ─────────────────────────────────────────────────────────────
    margin = max(0.0, min(float(data.get("margin_percent", 20)), 100.0))
    total_cost = round(subtotal_for_margin * (1 + margin / 100))

    # ── 10. Assemble full breakdown list ──────────────────────────────────────
    breakdown: list[dict] = list(items)
    breakdown.append({
        "label": "Installation", "qty": num_stops, "unit": "stops",
        "rate": 12000, "total": installation_total,
    })
    breakdown.append({
        "label": "Commissioning", "qty": 1, "unit": "lot",
        "rate": 12000, "total": commissioning_total,
    })
    breakdown.append({
        "label": "Warranty (5%)", "qty": 1, "unit": "lot",
        "rate": round(warranty_total, 2), "total": round(warranty_total, 2),
    })
    if control_surcharge > 0:
        breakdown.append({
            "label": f"Control Surcharge ({data.get('control_type','')})",
            "qty": 1, "unit": "lot",
            "rate": control_surcharge, "total": control_surcharge,
        })

    return {
        "breakdown": breakdown,
        "materials_subtotal": round(materials_subtotal),
        "installation": installation_total,
        "commissioning": commissioning_total,
        "warranty": round(warranty_total),
        "base_cost": base_cost,
        "addons_cost": addons_cost,
        "subtotal": round(subtotal_for_margin),
        "margin_percent": margin,
        "total_cost": total_cost,
        "excel_capacity": excel_cap,
        "config_used": config_key,
        "num_stops": num_stops,
    }


def calculate_estimate(data: dict) -> dict:
    """Thin wrapper around calculate_full_breakdown — preserves existing API contract."""
    return calculate_full_breakdown(data)


def load_estimates() -> list[dict[str, Any]]:
    if not ESTIMATES_FILE.exists():
        ESTIMATES_FILE.write_text(json.dumps([], indent=2))
        return []
    try:
        data = json.loads(ESTIMATES_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        return []
    return data if isinstance(data, list) else []


def save_estimates() -> None:
    ESTIMATES_FILE.write_text(json.dumps(ESTIMATES, indent=2))


def next_estimate_id() -> str:
    existing = [e.get("id", "") for e in ESTIMATES]
    nums = [int(i.split("-")[1]) for i in existing if i.startswith("EST-") and i.split("-")[1].isdigit()]
    return f"EST-{(max(nums) + 1):03d}" if nums else "EST-001"


ESTIMATES: list[dict[str, Any]] = load_estimates()


# ── Customer Portal Users ───────────────────────────────────────────────────────

def load_customer_users() -> list[dict[str, Any]]:
    if not CUSTOMER_USERS_FILE.exists():
        CUSTOMER_USERS_FILE.write_text(json.dumps([], indent=2))
        return []
    try:
        data = json.loads(CUSTOMER_USERS_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        return []
    return data if isinstance(data, list) else []


def save_customer_users() -> None:
    CUSTOMER_USERS_FILE.write_text(json.dumps(CUSTOMER_USERS, indent=2))


def next_customer_user_id() -> str:
    existing = [u.get("id", "") for u in CUSTOMER_USERS]
    nums = [int(i.split("-")[1]) for i in existing if i.startswith("CU-") and i.split("-")[1].isdigit()]
    return f"CU-{(max(nums) + 1):03d}" if nums else "CU-001"


def find_customer_user(username: str) -> dict[str, Any] | None:
    username_lower = username.lower().strip()
    return next((u for u in CUSTOMER_USERS if u.get("username", "").lower() == username_lower), None)


def current_customer_user() -> dict[str, Any] | None:
    cu = session.get("customer_user")
    if not cu:
        return None
    return find_customer_user(cu)


CUSTOMER_USERS: list[dict[str, Any]] = load_customer_users()


# ── Payments ───────────────────────────────────────────────────────────────────

PAYMENT_STATUSES = ("Due", "Overdue", "Paid", "Partial", "Waived")
PAYMENT_METHODS = ("NEFT", "UPI", "Cheque", "Cash", "DD", "Credit Card", "Other")
PAYMENT_MILESTONES = [
    ("Advance (30%)", 0.30),
    ("Civil Work Completion (30%)", 0.30),
    ("Pre-Delivery (30%)", 0.30),
    ("Installation Sign-Off (10%)", 0.10),
]


def load_payments() -> list[dict[str, Any]]:
    if not PAYMENTS_FILE.exists():
        PAYMENTS_FILE.write_text(json.dumps([], indent=2))
        return []
    try:
        data = json.loads(PAYMENTS_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        return []
    return data if isinstance(data, list) else []


def save_payments() -> None:
    PAYMENTS_FILE.write_text(json.dumps(PAYMENTS, indent=2))


# ── Department module data stores ─────────────────────────────────────────────

def _load_module(path: Path, default: list) -> list:
    if not path.exists():
        path.write_text(json.dumps(default, indent=2))
        return list(default)
    try:
        return json.loads(path.read_text()) or []
    except (json.JSONDecodeError, OSError):
        return []


def _save_module(path: Path, data: list) -> None:
    path.write_text(json.dumps(data, indent=2))


def _next_id(data: list, prefix: str) -> str:
    nums = [int(r["id"].split("-")[1]) for r in data if r.get("id", "").startswith(prefix + "-") and r["id"].split("-")[1].isdigit()]
    return f"{prefix}-{(max(nums) + 1):04d}" if nums else f"{prefix}-0001"


SALES_INQUIRIES: list = _load_module(SALES_INQUIRIES_FILE, [])
BREAKDOWNS: list = _load_module(BREAKDOWNS_FILE, [])
SERVICE_RECORDS: list = _load_module(SERVICE_RECORDS_FILE, [])
GAD_RECORDS: list = _load_module(GAD_RECORDS_FILE, [])
COMMISSIONINGS: list = _load_module(COMMISSIONINGS_FILE, [])
FACTORY_JOBS: list = _load_module(FACTORY_JOBS_FILE, [])
TENDERS: list = _load_module(TENDERS_FILE, [])
DEPT_COMMS: list = _load_module(DEPT_COMMS_FILE, [])
SALES_ADMIN_PANEL: list = _load_module(SALES_ADMIN_PANEL_FILE, [])

SALES_ADMIN_NUMERIC_FIELDS = (
    "site_visited_count",
    "units_received_wip_count",
    "inquiries_lost_count",
    "orders_lost_count",
    "units_lost_warranty_count",
    "units_lost_amc_count",
    "orders_completed_in_loss_count",
    "maintenance_completed_in_loss_count",
)

SALES_ADMIN_AMOUNT_FIELDS = (
    "amc_payment_next_10_year",
)


def parse_iso_date(value: Any) -> date | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if "T" in text:
        text = text.split("T", 1)[0]
    try:
        return date.fromisoformat(text)
    except ValueError:
        return None


def fiscal_year_bounds(reference: date) -> tuple[date, date, str]:
    start_year = reference.year if reference.month >= 4 else reference.year - 1
    fy_start = date(start_year, 4, 1)
    fy_end = date(start_year + 1, 3, 31)
    label = f"FY {start_year}-{str(start_year + 1)[-2:]}"
    return fy_start, fy_end, label


def _to_float(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _to_non_negative_int(value: Any) -> int:
    try:
        return max(int(float(value or 0)), 0)
    except (TypeError, ValueError):
        return 0


def _date_in_window(value: date | None, start: date, end: date) -> bool:
    return bool(value and start <= value <= end)


def _record_date(record: dict[str, Any], *keys: str) -> date | None:
    for key in keys:
        parsed = parse_iso_date(record.get(key))
        if parsed:
            return parsed
    return None


def _contract_type(record: dict[str, Any]) -> str:
    merged = " ".join(str(record.get(k, "")) for k in ("contract_type", "service_type", "contract", "notes")).lower()
    if "amc" in merged:
        return "AMC"
    if "warranty" in merged or "warrenty" in merged:
        return "Warranty"
    return ""


def _payment_is_amc(payment: dict[str, Any]) -> bool:
    merged = " ".join(str(payment.get(k, "")) for k in ("milestone", "notes", "reference")).lower()
    return "amc" in merged or "maintenance" in merged


def _estimate_is_loss(estimate: dict[str, Any]) -> bool:
    if estimate.get("loss_order"):
        return True
    quoted = _to_float(estimate.get("total_cost"))
    actual = _to_float(estimate.get("actual_cost") or estimate.get("final_cost") or estimate.get("delivered_cost"))
    return quoted > 0 and actual > quoted


def _service_is_loss(record: dict[str, Any]) -> bool:
    if record.get("maintenance_loss"):
        return True
    amc_amount = _to_float(record.get("amc_amount") or record.get("contract_amount"))
    man_hours = _to_float(record.get("man_hours_cost") or record.get("labour_cost"))
    spares = _to_float(record.get("spare_parts_cost") or record.get("bill_total"))
    return amc_amount > 0 and (man_hours + spares) > amc_amount


def _normalize_sales_admin_entry(payload: dict[str, Any], actor: str) -> dict[str, Any]:
    normalized: dict[str, Any] = {
        "date": str(payload.get("date", "")).strip(),
        "major_competitor": str(payload.get("major_competitor", "")).strip(),
        "notes": str(payload.get("notes", "")).strip(),
        "updated_by": actor,
        "updated_at": now_stamp(),
    }
    for field in SALES_ADMIN_NUMERIC_FIELDS:
        normalized[field] = _to_non_negative_int(payload.get(field))
    for field in SALES_ADMIN_AMOUNT_FIELDS:
        normalized[field] = round(max(_to_float(payload.get(field)), 0.0), 2)
    return normalized


def _manual_sales_adjustments(start: date, end: date) -> dict[str, Any]:
    entries = [entry for entry in SALES_ADMIN_PANEL if _date_in_window(parse_iso_date(entry.get("date")), start, end)]
    totals = {field: 0 for field in SALES_ADMIN_NUMERIC_FIELDS}
    totals.update({field: 0.0 for field in SALES_ADMIN_AMOUNT_FIELDS})
    competitor_counts: dict[str, int] = {}
    for entry in entries:
        for field in SALES_ADMIN_NUMERIC_FIELDS:
            totals[field] += _to_non_negative_int(entry.get(field))
        for field in SALES_ADMIN_AMOUNT_FIELDS:
            totals[field] += max(_to_float(entry.get(field)), 0.0)
        competitor = str(entry.get("major_competitor", "")).strip()
        if competitor:
            competitor_counts[competitor] = competitor_counts.get(competitor, 0) + 1
    top_competitor = ""
    if competitor_counts:
        top_competitor = max(competitor_counts.items(), key=lambda item: item[1])[0]
    totals["major_competitor"] = top_competitor
    return totals


def _sales_metrics_window(start: date, end: date, today: date) -> dict[str, Any]:
    inquiry_rows = [
        row for row in SALES_INQUIRIES
        if _date_in_window(_record_date(row, "received_date", "created_at", "last_followup"), start, end)
    ]
    offers_submitted = [
        row for row in ESTIMATES
        if row.get("status") in {"Sent", "Accepted", "Draft"}
        and _date_in_window(_record_date(row, "sent_at", "created_at"), start, end)
    ]
    units_wip = [
        row for row in INSTALL_JOBS
        if str(row.get("status", "")).lower() not in {"completed", "closed", "delivered"}
        and _date_in_window(_record_date(row, "start_date", "created_at", "target_date"), start, end)
    ]

    inquiry_lost_statuses = {"lost", "lost inquiry", "lost before offer", "inquiry lost"}
    order_lost_statuses = {"order lost", "lost after offer", "bid lost"}

    site_visited_count = 0
    inquiry_lost_count = 0
    order_lost_count = 0
    competitor_counter: dict[str, int] = {}
    for row in inquiry_rows:
        status = str(row.get("status", "")).strip().lower()
        if status in {"follow-up", "order received", "closed", "site visited"}:
            site_visited_count += 1
        if status in inquiry_lost_statuses:
            inquiry_lost_count += 1
        if status in order_lost_statuses or ("lost" in status and str(row.get("linked_estimate", "")).strip()):
            order_lost_count += 1
        if "lost" in status:
            competitor = str(row.get("major_competitor") or row.get("competitor") or row.get("lost_to") or "").strip()
            if competitor:
                competitor_counter[competitor] = competitor_counter.get(competitor, 0) + 1

    warranty_units: set[str] = set()
    amc_units: set[str] = set()
    units_lost_warranty_count = 0
    units_lost_amc_count = 0
    for row in BREAKDOWNS + SERVICE_RECORDS:
        row_date = _record_date(row, "completed_date", "service_date", "reported_at", "created_at")
        if not _date_in_window(row_date, start, end):
            continue
        contract = _contract_type(row)
        unit = str(row.get("unit") or row.get("elevator_ref") or row.get("id") or "").strip()
        status_text = " ".join(str(row.get(k, "")) for k in ("status", "resolution", "notes")).lower()
        if contract == "Warranty" and unit:
            warranty_units.add(unit)
        if contract == "AMC" and unit:
            amc_units.add(unit)
        if contract == "Warranty" and "lost" in status_text:
            units_lost_warranty_count += 1
        if contract == "AMC" and "lost" in status_text:
            units_lost_amc_count += 1

    amc_payment_received_till_now = 0.0
    amc_payment_to_be_received_year = 0.0
    new_elevator_payment_received = 0.0
    new_elevator_payment_pending = 0.0
    for payment in PAYMENTS:
        amount = max(_to_float(payment.get("amount")), 0.0)
        status = str(payment.get("status", "")).strip().lower()
        due_date = parse_iso_date(payment.get("due_date"))
        paid_date = parse_iso_date(payment.get("paid_date"))
        in_due_window = _date_in_window(due_date, start, end)
        is_paid = status == "paid"
        if _payment_is_amc(payment):
            if is_paid and paid_date and paid_date <= today and _date_in_window(paid_date, start, end):
                amc_payment_received_till_now += amount
            if in_due_window and not is_paid:
                amc_payment_to_be_received_year += amount
        else:
            if is_paid and _date_in_window(paid_date, start, end):
                new_elevator_payment_received += amount
            if in_due_window and not is_paid:
                new_elevator_payment_pending += amount

    order_loss_count = len(
        [
            row for row in ESTIMATES
            if _date_in_window(_record_date(row, "created_at", "sent_at"), start, end)
            and _estimate_is_loss(row)
        ]
    )
    maintenance_loss_count = len(
        [
            row for row in SERVICE_RECORDS
            if str(row.get("status", "")).lower() == "completed"
            and _date_in_window(_record_date(row, "completed_date", "service_date", "completed_at"), start, end)
            and _service_is_loss(row)
        ]
    )

    top_competitor = max(competitor_counter.items(), key=lambda item: item[1])[0] if competitor_counter else ""

    return {
        "inquiries_received": len(inquiry_rows),
        "site_visited": site_visited_count,
        "offers_submitted": len(offers_submitted),
        "units_received_wip": len(units_wip),
        "elevators_in_warranty": len(warranty_units),
        "elevators_in_amc": len(amc_units),
        "total_elevators_in_service": len(warranty_units | amc_units),
        "inquiries_lost": inquiry_lost_count,
        "orders_lost": order_lost_count,
        "major_competitor": top_competitor,
        "units_lost_warranty": units_lost_warranty_count,
        "units_lost_amc": units_lost_amc_count,
        "amc_payment_received_till_now": round(amc_payment_received_till_now, 2),
        "amc_payment_to_be_received_year": round(amc_payment_to_be_received_year, 2),
        "new_elevator_payment_received": round(new_elevator_payment_received, 2),
        "new_elevator_payment_pending": round(new_elevator_payment_pending, 2),
        "amc_payment_next_10_year": round((amc_payment_received_till_now + amc_payment_to_be_received_year) * 10, 2),
        "orders_completed_in_loss": order_loss_count,
        "maintenance_completed_in_loss": maintenance_loss_count,
    }


def build_sales_admin_panel(selected_date_text: str | None = None) -> dict[str, Any]:
    today = datetime.now().date()
    selected_date = parse_iso_date(selected_date_text) or today
    fy_start, fy_end, fy_label = fiscal_year_bounds(selected_date)

    fy_metrics = _sales_metrics_window(fy_start, fy_end, today)
    day_metrics = _sales_metrics_window(selected_date, selected_date, today)

    fy_manual = _manual_sales_adjustments(fy_start, fy_end)
    day_manual = _manual_sales_adjustments(selected_date, selected_date)

    for source, manual in ((fy_metrics, fy_manual), (day_metrics, day_manual)):
        source["site_visited"] += manual["site_visited_count"]
        source["units_received_wip"] += manual["units_received_wip_count"]
        source["inquiries_lost"] += manual["inquiries_lost_count"]
        source["orders_lost"] += manual["orders_lost_count"]
        source["units_lost_warranty"] += manual["units_lost_warranty_count"]
        source["units_lost_amc"] += manual["units_lost_amc_count"]
        source["orders_completed_in_loss"] += manual["orders_completed_in_loss_count"]
        source["maintenance_completed_in_loss"] += manual["maintenance_completed_in_loss_count"]
        if manual["amc_payment_next_10_year"] > 0:
            source["amc_payment_next_10_year"] = round(manual["amc_payment_next_10_year"], 2)
        if not source["major_competitor"]:
            source["major_competitor"] = manual.get("major_competitor", "")

    selected_entry = next(
        (entry for entry in SALES_ADMIN_PANEL if parse_iso_date(entry.get("date")) == selected_date),
        {
            "date": selected_date.isoformat(),
            **{field: 0 for field in SALES_ADMIN_NUMERIC_FIELDS},
            **{field: 0.0 for field in SALES_ADMIN_AMOUNT_FIELDS},
            "major_competitor": "",
            "notes": "",
        },
    )

    return {
        "selected_date": selected_date.isoformat(),
        "fiscal_year": {
            "start": fy_start.isoformat(),
            "end": fy_end.isoformat(),
            "label": fy_label,
        },
        "metrics": {
            "financial_year": fy_metrics,
            "selected_date": day_metrics,
        },
        "entry": selected_entry,
    }


def next_payment_id() -> str:
    existing = [p.get("id", "") for p in PAYMENTS]
    nums = [int(i.split("-")[1]) for i in existing if i.startswith("PAY-") and i.split("-")[1].isdigit()]
    return f"PAY-{(max(nums) + 1):04d}" if nums else "PAY-0001"


def payment_summary(estimate_id: str) -> dict[str, Any]:
    rows = [p for p in PAYMENTS if p.get("estimate_id") == estimate_id]
    est = next((e for e in ESTIMATES if e.get("id") == estimate_id), {})
    contract_value = est.get("total_cost", 0)
    invoiced = sum(p.get("amount", 0) for p in rows)
    received = sum(p.get("amount", 0) for p in rows if p.get("status") == "Paid")
    partial = sum(p.get("paid_amount", p.get("amount", 0)) for p in rows if p.get("status") == "Partial")
    received += partial
    overdue = sum(p.get("amount", 0) for p in rows if p.get("status") == "Overdue")
    outstanding = invoiced - received
    return {
        "contract_value": contract_value,
        "invoiced": invoiced,
        "received": received,
        "outstanding": outstanding,
        "overdue": overdue,
        "payments": rows,
    }


PAYMENTS: list[dict[str, Any]] = load_payments()


def send_plain_email(to_email: str, subject: str, body: str) -> dict[str, Any]:
    if not to_email:
        return {"ok": False, "message": "No recipient configured."}
    if not SMTP_HOST:
        return {"ok": True, "method": "pending", "to": to_email, "subject": subject}
    import smtplib
    from email.mime.text import MIMEText
    try:
        msg = MIMEText(body, "plain")
        msg["Subject"] = subject
        msg["From"] = SMTP_FROM
        msg["To"] = to_email
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as srv:
            srv.starttls()
            if SMTP_USER:
                srv.login(SMTP_USER, SMTP_PASS)
            srv.sendmail(SMTP_FROM, [to_email], msg.as_string())
        return {"ok": True, "method": "smtp", "to": to_email}
    except Exception as exc:
        return {"ok": False, "message": str(exc)}


def estimate_customer_record(estimate: dict[str, Any]) -> dict[str, Any]:
    customer_id = str(estimate.get("customer_id", "")).strip()
    if customer_id:
        found = find_customer(customer_id)
        if found:
            return found
    name = str(estimate.get("customer_name", "")).strip().lower()
    if name:
        found = next((customer for customer in CUSTOMERS if str(customer.get("name", "")).strip().lower() == name), None)
        if found:
            return found
    return {}


def fiscal_year_label(today: date | None = None) -> str:
    today = today or date.today()
    start = today.year if today.month >= 4 else today.year - 1
    return f"{start}-{str(start + 1)[-2:]}"


def estimate_ref_no(estimate: dict[str, Any]) -> str:
    suffix = str(estimate.get("id", "")).replace("EST-", "")
    return f"FUZI/Classic/{fiscal_year_label()}/{suffix}"


def offer_docx_path(estimate: dict[str, Any]) -> Path:
    GENERATED_OFFERS_DIR.mkdir(parents=True, exist_ok=True)
    safe_id = re.sub(r"[^A-Za-z0-9_-]+", "-", str(estimate.get("id", "offer"))).strip("-") or "offer"
    return GENERATED_OFFERS_DIR / f"{safe_id}-offer.docx"


def offer_pdf_path(estimate: dict[str, Any]) -> Path:
    GENERATED_OFFERS_DIR.mkdir(parents=True, exist_ok=True)
    safe_id = re.sub(r"[^A-Za-z0-9_-]+", "-", str(estimate.get("id", "offer"))).strip("-") or "offer"
    return GENERATED_OFFERS_DIR / f"{safe_id}-offer.pdf"


def offer_lines(estimate: dict[str, Any]) -> list[str]:
    customer = estimate_customer_record(estimate)
    customer_name = estimate.get("customer_name") or customer.get("name", "")
    site = estimate.get("site") or customer.get("address", "")
    phone = customer.get("phone", "")
    capacity = estimate.get("capacity", "")
    stops = estimate.get("num_floors", "")
    total_cost = _to_float(estimate.get("total_cost", 0))
    valid_until = estimate.get("valid_until") or "30 days from issue"
    addons = ", ".join(estimate.get("addons", [])) or "As per standard FUZI specification"
    remarks = [estimate.get("remark_1", ""), estimate.get("remark_2", ""), estimate.get("remark_3", "")]
    remarks = ", ".join(str(item).strip() for item in remarks if str(item).strip()) or estimate.get("notes", "")
    return [
        "FUZI Classic Elevators Pvt. Ltd.",
        f"Ref. No. {estimate_ref_no(estimate)}",
        f"Dated: {date.today().strftime('%B %d, %Y')}",
        "",
        customer_name,
        site,
        f"# {phone}" if phone else "",
        "",
        f"Subject: Supply, Installation, Testing, Commissioning and complete handing over of 01 nos. Elevator for your site at {site}.",
        "Reference: Personal discussions and site visit reference.",
        "",
        "Dear Sir,",
        "This refers to aforementioned subject in line to SITC of one no. elevator. Further, we thank you for extending your valued enquiry to us. We have pleasure to submit our offer for supply, installation, testing and commissioning and complete handing over of FUZI brand Elevator in the building at the above address.",
        "",
        "ANNEXURE- I",
        "TECHNICAL SPECIFICATIONS SHEET",
        f"Service: {estimate.get('elevator_type', 'Passenger')}",
        "No. of Elevators: One (01) no.",
        f"Capacity: {capacity}",
        f"Speed: {estimate.get('speed', '1.0 Meter Per Second')}",
        f"Control: {estimate.get('control_type', '')}",
        f"Motor: {estimate.get('drive_type', '')}",
        f"Floors & Opening: {stops} stops / openings",
        f"Door Opening Type: {estimate.get('door_type', '')}",
        f"Door Opening Size: {estimate.get('door_width_mm', '')}mm x {estimate.get('door_height_mm', '')}mm",
        f"Hoist-way Size: Pit {estimate.get('pit_depth_mm', '')}mm, overhead {estimate.get('overhead_mm', '')}mm",
        f"Elevator Car: {estimate.get('cabin_finish', '')}",
        f"Hoist-way Entrance: {estimate.get('door_construction', '')}",
        f"Other Features: {addons}",
        f"Remarks / Accessories: {remarks}",
        "",
        "Price:",
        f"Our price for One number {capacity} {estimate.get('drive_type', '')} Elevator for {stops} stops as per Annexure-I will be @ Rs. {total_cost:,.2f}.",
        "",
        "The above offer is Inclusive of:",
        "Installation charges along with 12 months warranty from the date of handing over.",
        "Freight up to the site.",
        "",
        "The above offer is Exclusive of:",
        "Architrave work at all floors. Separating channel work, if applicable. GST @18%.",
        "",
        "Payment Terms:",
        "40% of the contract value advance along with the order.",
        "50% of the contract value on intimation of material readiness at factory.",
        "10% of the contract value along with all taxes at the time of handing over of lift.",
        "",
        "Delivery & Installation Schedule:",
        "GAD will be submitted within ten days from receipt of confirmed written order along with advance payment. Material and installation schedule will proceed as per payment clearance and site readiness.",
        "",
        "Maintenance:",
        "Our offer includes 12 months free maintenance at site including all parts excluding consumables parts such as fan, blower, bulb, tube light, battery and PVC flooring etc.",
        "",
        "Customer Scope of Work:",
        "Lift pit, shaft lighting, shaft whitewash, load hook, power supply, earthing, store space, and all civil work shall be in customer scope as per GAD.",
        "",
        f"Offer Validity: {valid_until}",
        "",
        "Thanking you with warm regards,",
        "Yours Truly,",
        "For FUZI Classic Elevators Pvt Ltd",
        "(Authorized Signatory)",
        "",
        "360, Guru Nanak Pura, Raja Park, Jaipur, Rajasthan, India-302004 | Toll Free-18001028421 | Mobile-09928019671 | atulsinghal@fuzielevators.com",
    ]


def word_para(text: str, style: str = "Normal") -> str:
    text = xml_escape(str(text or ""))
    return f'<w:p><w:pPr><w:pStyle w:val="{style}"/></w:pPr><w:r><w:t xml:space="preserve">{text}</w:t></w:r></w:p>'


def word_table(rows: list[tuple[str, str]]) -> str:
    cells = []
    for label, value in rows:
        cells.append(
            "<w:tr>"
            f"<w:tc><w:tcPr><w:tcW w:w=\"2800\" w:type=\"dxa\"/></w:tcPr>{word_para(label)}</w:tc>"
            f"<w:tc><w:tcPr><w:tcW w:w=\"6000\" w:type=\"dxa\"/></w:tcPr>{word_para(value)}</w:tc>"
            "</w:tr>"
        )
    return (
        '<w:tbl><w:tblPr><w:tblW w:w="8800" w:type="dxa"/>'
        '<w:tblBorders><w:top w:val="single" w:sz="4" w:color="CCCCCC"/>'
        '<w:left w:val="single" w:sz="4" w:color="CCCCCC"/>'
        '<w:bottom w:val="single" w:sz="4" w:color="CCCCCC"/>'
        '<w:right w:val="single" w:sz="4" w:color="CCCCCC"/>'
        '<w:insideH w:val="single" w:sz="4" w:color="CCCCCC"/>'
        '<w:insideV w:val="single" w:sz="4" w:color="CCCCCC"/></w:tblBorders></w:tblPr>'
        '<w:tblGrid><w:gridCol w:w="2800"/><w:gridCol w:w="6000"/></w:tblGrid>'
        + "".join(cells)
        + "</w:tbl>"
    )


def generate_offer_docx(estimate: dict[str, Any]) -> Path:
    customer = estimate_customer_record(estimate)
    customer_name = estimate.get("customer_name") or customer.get("name", "")
    site = estimate.get("site") or customer.get("address", "")
    phone = customer.get("phone", "")
    capacity = estimate.get("capacity", "")
    stops = estimate.get("num_floors", "")
    total_cost = _to_float(estimate.get("total_cost", 0))
    valid_until = estimate.get("valid_until") or "30 days from issue"
    addons = ", ".join(estimate.get("addons", [])) or "As per standard FUZI specification"
    remarks = [estimate.get("remark_1", ""), estimate.get("remark_2", ""), estimate.get("remark_3", "")]
    remarks = ", ".join(str(item).strip() for item in remarks if str(item).strip()) or estimate.get("notes", "")
    path = offer_docx_path(estimate)

    body = [
        word_para("FUZI Classic Elevators Pvt. Ltd.", "Title"),
        word_para(f"Ref. No. {estimate_ref_no(estimate)}"),
        word_para(f"Dated: {date.today().strftime('%B %d, %Y')}"),
        word_para(customer_name),
        word_para(site),
        word_para(f"# {phone}" if phone else ""),
        word_para(
            f"Subject: Supply, Installation, Testing, Commissioning and complete handing over of 01 nos. Elevator for your site at {site}."
        ),
        word_para("Reference: Personal discussions and site visit reference."),
        word_para("Dear Sir,"),
        word_para(
            "This refers to aforementioned subject in line to SITC of one no. elevator. Further, we thank you for extending your valued enquiry to us. We have pleasure to submit our offer for supply, installation, testing and commissioning and complete handing over of FUZI brand Elevator in the building at the above address."
        ),
        word_para("ANNEXURE- I", "Heading1"),
        word_para("TECHNICAL SPECIFICATIONS SHEET", "Heading1"),
        word_table(
            [
                ("Service", estimate.get("elevator_type", "Passenger")),
                ("No. of Elevators", "One (01) no."),
                ("Capacity", capacity),
                ("Speed", estimate.get("speed", "1.0 Meter Per Second")),
                ("Control", estimate.get("control_type", "")),
                ("Motor", estimate.get("drive_type", "")),
                ("Floors & Opening", f"{stops} stops / openings"),
                ("Door Opening Type", estimate.get("door_type", "")),
                ("Door Opening Size", f"{estimate.get('door_width_mm', '')}mm (width) x {estimate.get('door_height_mm', '')}mm (height)"),
                ("Hoist-way Size Available", f"Pit {estimate.get('pit_depth_mm', '')}mm, overhead {estimate.get('overhead_mm', '')}mm"),
                ("Elevator Car", estimate.get("cabin_finish", "")),
                ("Hoist-way Entrance", estimate.get("door_construction", "")),
                ("Other Features", addons),
                ("Remarks / Accessories", remarks),
            ]
        ),
        word_para("Price:", "Heading1"),
        word_para(
            f"Our price for One number {capacity} {estimate.get('drive_type', '')} Elevator for {stops} stops as per Annexure-I will be @ Rs. {total_cost:,.2f}."
        ),
        word_para("The above offer is Inclusive of:", "Heading2"),
        word_para("Installation charges along with 12 months warranty from the date of handing over."),
        word_para("Freight up to the site."),
        word_para("The above offer is Exclusive of:", "Heading2"),
        word_para("Architrave work at all floors. Separating channel work, if applicable. GST @18%."),
        word_para("Payment Terms:", "Heading2"),
        word_para("40% of the contract value advance along with the order."),
        word_para("50% of the contract value on intimation of material readiness at factory."),
        word_para("10% of the contract value along with all taxes at the time of handing over of lift."),
        word_para("Delivery & Installation Schedule:", "Heading2"),
        word_para("GAD will be submitted within ten days from receipt of confirmed written order along with advance payment. Material and installation schedule will proceed as per payment clearance and site readiness."),
        word_para("Maintenance:", "Heading2"),
        word_para("Our offer includes 12 months free maintenance at site including all parts excluding consumables parts such as fan, blower, bulb, tube light, battery and PVC flooring etc."),
        word_para("Customer Scope of Work:", "Heading2"),
        word_para("Lift pit, shaft lighting, shaft whitewash, load hook, power supply, earthing, store space, and all civil work shall be in customer scope as per GAD."),
        word_para(f"Offer Validity: {valid_until}"),
        word_para("Thanking you with warm regards,"),
        word_para("Yours Truly,"),
        word_para("For FUZI Classic Elevators Pvt Ltd"),
        word_para("(Authorized Signatory)"),
        word_para("360, Guru Nanak Pura, Raja Park, Jaipur, Rajasthan, India-302004 | Toll Free-18001028421 | Mobile-09928019671 | atulsinghal@fuzielevators.com"),
    ]

    document_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        "<w:body>"
        + "".join(body)
        + '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>'
        + "</w:body></w:document>"
    )
    styles_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="22"/></w:rPr></w:style>'
        '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>'
        '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style>'
        '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>'
        "</w:styles>"
    )
    content_types = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
        "</Types>"
    )
    rels = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        "</Relationships>"
    )
    doc_rels = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        "</Relationships>"
    )
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as docx:
        docx.writestr("[Content_Types].xml", content_types)
        docx.writestr("_rels/.rels", rels)
        docx.writestr("word/_rels/document.xml.rels", doc_rels)
        docx.writestr("word/document.xml", document_xml)
        docx.writestr("word/styles.xml", styles_xml)
    estimate["offer_docx"] = str(path.relative_to(BASE_DIR))
    estimate["offer_template"] = str(OFFER_TEMPLATE_FILE.relative_to(BASE_DIR))
    return path


def pdf_escape(text: str) -> str:
    return str(text).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def wrap_pdf_line(text: str, width: int = 95) -> list[str]:
    words = str(text or "").split()
    if not words:
        return [""]
    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        if len(current) + len(word) + 1 <= width:
            current += " " + word
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def generate_offer_pdf(estimate: dict[str, Any]) -> Path:
    path = offer_pdf_path(estimate)
    wrapped: list[str] = []
    for line in offer_lines(estimate):
        wrapped.extend(wrap_pdf_line(line))

    pages: list[list[str]] = []
    current: list[str] = []
    max_lines = 54
    for line in wrapped:
        if len(current) >= max_lines:
            pages.append(current)
            current = []
        current.append(line)
    if current:
        pages.append(current)

    objects: list[str] = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "",
    ]
    page_refs: list[str] = []
    next_obj = 3
    for page in pages:
        page_obj = next_obj
        content_obj = next_obj + 1
        next_obj += 2
        page_refs.append(f"{page_obj} 0 R")
        stream_lines = ["BT", "/F1 10 Tf", "50 760 Td", "14 TL"]
        for index, line in enumerate(page):
            if index:
                stream_lines.append("T*")
            stream_lines.append(f"({pdf_escape(line)}) Tj")
        stream_lines.append("ET")
        stream = "\n".join(stream_lines)
        objects.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 {next_obj} 0 R >> >> /Contents {content_obj} 0 R >>")
        objects.append(f"<< /Length {len(stream.encode('latin-1', errors='replace'))} >>\nstream\n{stream}\nendstream")
    font_obj = next_obj
    objects[1] = f"<< /Type /Pages /Kids [{' '.join(page_refs)}] /Count {len(page_refs)} >>"
    objects.append("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for idx, obj in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf.extend(f"{idx} 0 obj\n{obj}\nendobj\n".encode("latin-1", errors="replace"))
    xref_pos = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode("ascii"))
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    pdf.extend(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode("ascii"))
    path.write_bytes(bytes(pdf))
    estimate["offer_pdf"] = str(path.relative_to(BASE_DIR))
    estimate["offer_template"] = str(OFFER_TEMPLATE_FILE.relative_to(BASE_DIR))
    return path


def send_estimate_email(estimate: dict) -> dict[str, Any]:
    """Send estimate report via SMTP if configured, otherwise return mailto info."""
    import smtplib
    from email.mime.base import MIMEBase
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from email import encoders
    to_email = estimate.get("sent_to_email", "")
    if not to_email:
        return {"ok": False, "message": "No recipient email on estimate."}
    if not estimate.get("offer_approved"):
        return {"ok": False, "message": "Approve the offer PDF before sending it."}
    html_body = _estimate_html_report(estimate)
    subject = f"FUZI Elevators — Quotation {estimate['id']} for {estimate.get('site', estimate.get('customer_name', ''))}"
    offer_path = generate_offer_pdf(estimate)
    if SMTP_HOST:
        try:
            msg = MIMEMultipart("mixed")
            msg["Subject"] = subject
            msg["From"] = SMTP_FROM
            msg["To"] = to_email
            msg.attach(MIMEText(html_body, "html"))
            attachment = MIMEBase("application", "pdf")
            attachment.set_payload(offer_path.read_bytes())
            encoders.encode_base64(attachment)
            attachment.add_header("Content-Disposition", "attachment", filename=offer_path.name)
            msg.attach(attachment)
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as srv:
                srv.starttls()
                if SMTP_USER:
                    srv.login(SMTP_USER, SMTP_PASS)
                srv.sendmail(SMTP_FROM, [to_email], msg.as_string())
            return {"ok": True, "method": "smtp", "to": to_email, "offer_pdf": f"/api/portal/estimates/{estimate['id']}/offer.pdf"}
        except Exception as exc:
            return {"ok": False, "message": str(exc)}
    return {"ok": True, "method": "mailto", "to": to_email, "subject": subject, "offer_pdf": f"/api/portal/estimates/{estimate['id']}/offer.pdf"}


def _bom_section(estimate: dict) -> str:
    """Return an HTML Bill of Materials table if breakdown data is present, else empty string."""
    breakdown = estimate.get("breakdown")
    if not breakdown:
        return ""
    rows = ""
    for item in breakdown:
        label = item.get("label", "")
        qty = item.get("qty", 1)
        unit = item.get("unit", "")
        rate = item.get("rate", 0)
        total = item.get("total", 0)
        rows += (
            f"<tr><td>{label}</td><td style='text-align:center'>{qty}</td>"
            f"<td style='text-align:center'>{unit}</td>"
            f"<td style='text-align:right'>₹{rate:,.0f}</td>"
            f"<td style='text-align:right'>₹{total:,.0f}</td></tr>"
        )
    return f"""
<h2>Bill of Materials</h2>
<table>
<tr style='background:#f3f5f8;font-weight:600'>
  <td>Component</td><td style='text-align:center'>Qty</td>
  <td style='text-align:center'>Unit</td>
  <td style='text-align:right'>Rate (₹)</td>
  <td style='text-align:right'>Total (₹)</td>
</tr>
{rows}
</table>"""


def _estimate_html_report(estimate: dict) -> str:
    addons = ", ".join(estimate.get("addons", [])) or "None"
    valid = estimate.get("valid_until", "30 days from issue")
    return f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
body{{font-family:Inter,Arial,sans-serif;color:#2d3240;background:#f3f5f8;padding:32px}}
.card{{background:#fff;border-radius:16px;padding:32px;max-width:680px;margin:0 auto;box-shadow:0 4px 24px rgba(0,0,0,.08)}}
h1{{color:#e02020;font-size:1.4rem}}h2{{font-size:1rem;color:#747b8d;font-weight:600;margin:24px 0 8px}}
table{{width:100%;border-collapse:collapse}}td{{padding:8px 12px;border-bottom:1px solid #e4e7ee;font-size:.9rem}}
td:first-child{{color:#747b8d;width:46%}}.total{{font-size:1.2rem;font-weight:700;color:#e02020}}
.footer{{font-size:.78rem;color:#747b8d;margin-top:24px}}
</style></head>
<body><div class="card">
<h1>FUZI Classic Elevators — Quotation</h1>
<p><strong>{estimate.get('id','')}</strong> &nbsp;·&nbsp; Prepared {estimate.get('created_at','')}</p>
<h2>Customer & Site</h2>
<table>
<tr><td>Customer</td><td>{estimate.get('customer_name','')}</td></tr>
<tr><td>Site / Project</td><td>{estimate.get('site','')}</td></tr>
<tr><td>Valid Until</td><td>{valid}</td></tr>
</table>
<h2>Specification</h2>
<table>
<tr><td>Elevator Type</td><td>{estimate.get('elevator_type','')}</td></tr>
<tr><td>Capacity</td><td>{estimate.get('capacity','')}</td></tr>
<tr><td>Number of Floors / Stops</td><td>{estimate.get('num_floors','')}</td></tr>
<tr><td>Drive</td><td>{estimate.get('drive_type','')}</td></tr>
<tr><td>Cabin Finish</td><td>{estimate.get('cabin_finish','')}</td></tr>
<tr><td>Door Type</td><td>{estimate.get('door_type','')}</td></tr>
<tr><td>Control System</td><td>{estimate.get('control_type','')}</td></tr>
<tr><td>Add-ons</td><td>{addons}</td></tr>
</table>
<h2>Pricing</h2>
<table>
<tr><td>Base Equipment Cost</td><td>₹{estimate.get('base_cost',0):,.0f}</td></tr>
<tr><td>Add-ons</td><td>₹{estimate.get('addons_cost',0):,.0f}</td></tr>
<tr><td>Subtotal</td><td>₹{estimate.get('subtotal',0):,.0f}</td></tr>
<tr><td>Margin ({estimate.get('margin_percent',20):.0f}%)</td><td>₹{estimate.get('total_cost',0) - estimate.get('subtotal',0):,.0f}</td></tr>
<tr><td><strong>Total Quote</strong></td><td class="total">₹{estimate.get('total_cost',0):,.0f}</td></tr>
</table>
{_bom_section(estimate)}
{f"<h2>Notes</h2><p>{estimate.get('notes','')}</p>" if estimate.get('notes') else ''}
<div class="footer">This quotation is prepared by FUZI Classic Elevators and is valid until {valid}.
Prices are indicative and subject to site survey. GST and civil work charges are not included.</div>
</div></body></html>"""


def customer_login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not session.get("customer_user"):
            return redirect(url_for("customer_login"))
        return view(*args, **kwargs)
    return wrapped


def inventory_item_by_name(name: str) -> dict[str, Any] | None:
    normalized = name.lower().strip()
    return next((item for item in INVENTORY if item.get("name", "").lower().strip() == normalized), None)


def predict_job_material_shortages() -> list[dict[str, Any]]:
    shortages = []
    for job in INSTALL_JOBS:
        if job.get("status") == "Complete":
            continue
        active_stage = current_install_stage(job)
        stage_id = str(active_stage.get("id", ""))
        for part_name in INSTALL_STAGE_CRITICAL_PARTS.get(stage_id, []):
            item = inventory_item_by_name(part_name)
            if item is None:
                continue
            available = int(item.get("qty_on_hand", 0)) - int(item.get("qty_reserved", 0))
            status = inventory_item_status(item)
            if status in {"Out of Stock", "Low Stock"}:
                shortages.append({
                    "job": job.get("id"),
                    "site": job.get("site"),
                    "stage": stage_id,
                    "part": part_name,
                    "item_id": item.get("id"),
                    "qty_available": max(available, 0),
                    "status": status,
                    "lead_time_days": item.get("lead_time_days", 0),
                })
    return shortages


def suggest_purchase_orders() -> list[dict[str, Any]]:
    suggestions = []
    for item in INVENTORY:
        status = inventory_item_status(item)
        if status in {"Out of Stock", "Low Stock"} and item.get("status") != "Ordered":
            qty = int(item.get("qty_on_hand", 0))
            reorder = int(item.get("reorder_point", 0))
            suggest_qty = max(reorder * 3 - qty, reorder)
            suggestions.append({
                "item_id": item.get("id"),
                "name": item.get("name"),
                "category": item.get("category"),
                "qty_on_hand": qty,
                "reorder_point": reorder,
                "suggest_qty": suggest_qty,
                "unit": item.get("unit"),
                "lead_time_days": item.get("lead_time_days", 0),
                "status": status,
            })
    return suggestions


def inventory_health_summary() -> dict[str, Any]:
    total = len(INVENTORY)
    out_of_stock = sum(1 for item in INVENTORY if inventory_item_status(item) == "Out of Stock")
    low_stock = sum(1 for item in INVENTORY if inventory_item_status(item) == "Low Stock")
    ordered = sum(1 for item in INVENTORY if item.get("status") == "Ordered")
    in_stock = max(total - out_of_stock - low_stock - ordered, 0)
    return {
        "total": total,
        "in_stock": in_stock,
        "low_stock": low_stock,
        "out_of_stock": out_of_stock,
        "ordered": ordered,
    }


def inventory_ai_insights() -> dict[str, Any]:
    health = inventory_health_summary()
    shortages = predict_job_material_shortages()
    po_suggestions = suggest_purchase_orders()
    critical_shortages = [s for s in shortages if s["status"] == "Out of Stock"]
    risk_level = "critical" if critical_shortages else "warning" if shortages or po_suggestions else "healthy"
    priority_actions: list[dict[str, Any]] = []
    if critical_shortages:
        jobs_affected = list({s["job"] for s in critical_shortages})
        priority_actions.append({
            "priority": "critical",
            "action": f"Emergency restock: {len(critical_shortages)} part(s) out of stock, blocking {len(jobs_affected)} active job(s).",
            "items": list({s["part"] for s in critical_shortages}),
        })
    low_stock_pos = [s for s in po_suggestions if s["status"] == "Low Stock"]
    if low_stock_pos:
        priority_actions.append({
            "priority": "warning",
            "action": f"Raise PO for {len(low_stock_pos)} item(s) at or below reorder threshold.",
            "items": [s["name"] for s in low_stock_pos[:5]],
        })
    if not priority_actions:
        priority_actions.append({
            "priority": "healthy",
            "action": "Inventory is well-stocked. No immediate restocking action required.",
            "items": [],
        })
    return {
        "health": health,
        "shortages": shortages,
        "po_suggestions": po_suggestions,
        "risk_level": risk_level,
        "priority_actions": priority_actions,
    }


def now_stamp() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def parse_now_stamp(value: str) -> datetime | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return datetime.strptime(text, "%Y-%m-%d %H:%M")
    except ValueError:
        return None


def append_activity(agent: str, summary: str) -> None:
    OPERATIONS_STATE["activity_log"].insert(0, {"agent": agent, "summary": summary, "timestamp": now_stamp()})
    del OPERATIONS_STATE["activity_log"][40:]


def record_message(channel: str, source: str, state: str, text: str) -> None:
    OPERATIONS_STATE["messages"].insert(0, {"channel": channel, "from": source, "state": state, "text": text})
    retained_messages: list[dict[str, Any]] = []
    inbound_kept = 0
    system_kept = 0
    for message in OPERATIONS_STATE["messages"]:
        if customer_message_is_inbound(message):
            if inbound_kept >= 8:
                continue
            inbound_kept += 1
            retained_messages.append(message)
            continue
        if system_kept >= 16:
            continue
        system_kept += 1
        retained_messages.append(message)
    OPERATIONS_STATE["messages"] = retained_messages
    ensure_customer_service_inbox_messages()


def default_customer_service_messages() -> list[dict[str, Any]]:
    return [
        {
            "channel": "WhatsApp",
            "from": "Arihant Towers",
            "state": "New",
            "text": "Please confirm the next AMC visit window for Monday morning.",
            "reply": "",
            "triaged_at": "",
        },
        {
            "channel": "Web chat",
            "from": "City Mall",
            "state": "New",
            "text": "Escalator 3 has stopped with passengers stuck at the landing. This looks like an emergency.",
            "reply": "",
            "triaged_at": "",
        },
        {
            "channel": "Email",
            "from": "Pearl Heights",
            "state": "New",
            "text": "Can you share the latest ticket update and expected technician arrival time for Tower B?",
            "reply": "",
            "triaged_at": "",
        },
    ]


def ensure_customer_service_inbox_messages() -> None:
    inbound_exists = any(customer_message_is_inbound(message) for message in OPERATIONS_STATE.get("messages", []))
    if inbound_exists:
        return
    OPERATIONS_STATE.setdefault("messages", [])
    OPERATIONS_STATE["messages"] = default_customer_service_messages() + OPERATIONS_STATE["messages"][:16]


def customer_message_is_inbound(message: dict[str, Any]) -> bool:
    channel = str(message.get("channel", "")).strip().lower()
    source = str(message.get("from", "")).strip()
    inbound_channels = {"whatsapp", "web chat", "email"}
    return channel in inbound_channels and source not in {"Service Agent", "Operations Bot", "Inbound triage", "Blocked jobs"}


def customer_message_is_emergency(message: dict[str, Any]) -> bool:
    body = str(message.get("text", "")).lower()
    emergency_keywords = ("entrapment", "trapped", "stuck", "emergency", "fault", "not moving")
    return any(keyword in body for keyword in emergency_keywords)


def customer_message_needs_triage(message: dict[str, Any]) -> bool:
    if not customer_message_is_inbound(message):
        return False
    return not str(message.get("triaged_at", "")).strip()


def build_routine_customer_reply(message: dict[str, Any]) -> str:
    channel = str(message.get("channel", "Customer channel")).strip() or "Customer channel"
    source = str(message.get("from", "Building manager")).strip() or "Building manager"
    body = str(message.get("text", "")).lower()
    if "amc" in body or "maintenance" in body or "schedule" in body:
        return f"Routine update sent to {source} via {channel}: the next AMC visit is confirmed and the coordinator will share the ETA shortly."
    if "ticket" in body or "update" in body or "status" in body:
        return f"Routine update sent to {source} via {channel}: the active service status has been acknowledged and a progress note was shared instantly."
    return f"Routine update sent to {source} via {channel}: your message was received and a coordinator reply was sent with the next action and contact window."


def build_customer_emergency_alert(urgent_messages: list[dict[str, Any]]) -> str:
    if not urgent_messages:
        return ""
    urgent_summary = "; ".join(
        f"{message.get('from', 'Building manager')} via {message.get('channel', 'inbox')}: {str(message.get('text', '')).strip()}"
        for message in urgent_messages[:3]
    )
    return f"Customer emergency escalation: {urgent_summary}"


def fleet_alert_reason(item: dict[str, Any]) -> str:
    reasons = []
    if str(item.get("fault_code", "")).strip():
        reasons.append(f"fault {item['fault_code']}")
    if int(item.get("motor_temp_c", 0)) >= 80:
        reasons.append(f"motor {item['motor_temp_c']} C")
    if int(item.get("door_cycles_delta", 0)) >= 25:
        reasons.append(f"door cycles +{item['door_cycles_delta']}%")
    if not reasons:
        reasons.append(str(item.get("telemetry", "monitor threshold crossed")))
    return ", ".join(reasons)


def fleet_item_needs_attention(item: dict[str, Any]) -> bool:
    return (
        item.get("status") == "Fault"
        or int(item.get("motor_temp_c", 0)) >= 80
        or int(item.get("door_cycles_delta", 0)) >= 25
        or bool(str(item.get("fault_code", "")).strip())
    )


def fleet_attention_priority(item: dict[str, Any]) -> tuple[int, int, int, int]:
    active_ticket = open_ticket_for(str(item.get("ticket", ""))) is not None
    severity_score = 2 if item.get("status") == "Fault" else 1
    fault_score = 1 if str(item.get("fault_code", "")).strip() else 0
    return (
        0 if not active_ticket else 1,
        -severity_score,
        -int(item.get("motor_temp_c", 0)),
        -int(item.get("door_cycles_delta", 0)),
    )


def select_fleet_alert_unit() -> str:
    candidates = [item for item in OPERATIONS_STATE["fleet"] if fleet_item_needs_attention(item)]
    if not candidates:
        return ""
    selected = min(candidates, key=fleet_attention_priority)
    return str(selected.get("unit", "")).strip()


def open_ticket_for(ticket_id: str) -> dict[str, Any] | None:
    if not ticket_id or ticket_id == "-":
        return None
    return next((ticket for ticket in PROJECT_TICKETS if ticket.get("id") == ticket_id and ticket.get("status") != "Closed"), None)


def find_fleet_item(unit: str) -> dict[str, Any] | None:
    return next((item for item in OPERATIONS_STATE["fleet"] if item.get("unit") == unit), None)


def build_openclaw_url() -> str:
    discovered_url = str(RUNTIME_STATE.get("openclaw_dashboard_url", "")).strip()
    if discovered_url:
        parsed = urllib_parse.urlsplit(discovered_url)
        if parsed.scheme and parsed.netloc:
            base_url = urllib_parse.urlunsplit((parsed.scheme, parsed.netloc, "/", "", ""))
            return base_url if base_url.endswith("/") else f"{base_url}/"
    return OPENCLAW_URL if OPENCLAW_URL.endswith("/") else f"{OPENCLAW_URL}/"


def build_openclaw_endpoint(path: str) -> str:
    return urllib_parse.urljoin(build_openclaw_url(), path.lstrip("/"))


def load_openclaw_config_text() -> str:
    try:
        return OPENCLAW_CONFIG_FILE.read_text(encoding="utf-8")
    except OSError:
        return ""


def load_openclaw_config_json() -> dict[str, Any]:
    config_text = load_openclaw_config_text()
    if not config_text:
        return {}
    try:
        parsed = json.loads(config_text)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def load_openclaw_env_values() -> dict[str, str]:
    try:
        lines = OPENCLAW_ENV_FILE.read_text(encoding="utf-8").splitlines()
    except OSError:
        return {}

    values: dict[str, str] = {}
    for raw_line in lines:
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env_key = key.strip()
        env_value = value.strip().strip('"').strip("'")
        if env_key:
            values[env_key] = env_value
    return values


def save_openclaw_env_values(updates: dict[str, str]) -> None:
    existing_lines: list[str] = []
    if OPENCLAW_ENV_FILE.exists():
        try:
            existing_lines = OPENCLAW_ENV_FILE.read_text(encoding="utf-8").splitlines()
        except OSError:
            existing_lines = []

    updated_keys = set(updates)
    output_lines: list[str] = []
    seen_keys: set[str] = set()
    for raw_line in existing_lines:
        stripped = raw_line.strip()
        if not stripped or stripped.startswith("#") or "=" not in raw_line:
            output_lines.append(raw_line)
            continue
        key, _sep, _value = raw_line.partition("=")
        env_key = key.strip()
        if env_key in updates:
            output_lines.append(f"{env_key}={updates[env_key]}")
            seen_keys.add(env_key)
        else:
            output_lines.append(raw_line)

    for env_key in updated_keys - seen_keys:
        output_lines.append(f"{env_key}={updates[env_key]}")

    OPENCLAW_ENV_FILE.parent.mkdir(parents=True, exist_ok=True)
    OPENCLAW_ENV_FILE.write_text("\n".join(output_lines).rstrip() + "\n", encoding="utf-8")
    for env_key, env_value in updates.items():
        os.environ[env_key] = env_value


def extract_openclaw_config_secret(field_name: str) -> str:
    config_text = load_openclaw_config_text()
    if not config_text:
        return ""

    parsed_config = load_openclaw_config_json()

    if isinstance(parsed_config, dict):
        gateway = parsed_config.get("gateway")
        auth = gateway.get("auth") if isinstance(gateway, dict) else None
        value = auth.get(field_name) if isinstance(auth, dict) else None
        if isinstance(value, str) and value.strip():
            resolved = value.strip()
            if resolved.startswith("${") and resolved.endswith("}"):
                env_key = resolved[2:-1]
                env_values = load_openclaw_env_values()
                return os.environ.get(env_key, "") or env_values.get(env_key, "")
            return resolved

    match = re.search(rf"(?:^|[\s{{,])(?:['\"]?{field_name}['\"]?)\s*:\s*(['\"])([^'\"]+)\1", config_text, re.MULTILINE)
    if not match:
        return ""
    value = match.group(2).strip()
    if value.startswith("${") and value.endswith("}"):
        env_key = value[2:-1]
        env_values = load_openclaw_env_values()
        return os.environ.get(env_key, "") or env_values.get(env_key, "")
    return value


def load_openclaw_discord_token() -> str:
    parsed_config = load_openclaw_config_json()
    channels = parsed_config.get("channels") if isinstance(parsed_config, dict) else None
    discord = channels.get("discord") if isinstance(channels, dict) else None
    accounts = discord.get("accounts") if isinstance(discord, dict) else None
    if isinstance(accounts, dict):
        for account_name in ("default", *accounts.keys()):
            account = accounts.get(account_name)
            token = account.get("token") if isinstance(account, dict) else None
            if isinstance(token, str) and token.strip():
                return token.strip()
    return ""


def build_openclaw_message_read_payload(target: str, limit: int) -> dict[str, Any]:
    return {
        "tool": "message",
        "action": "read",
        "agentId": OPENCLAW_AGENT_ID,
        "agent_id": OPENCLAW_AGENT_ID,
        "args": {
            "channel": "discord",
            "target": target,
            "limit": max(int(limit or 1), 1),
        },
        "sessionKey": "fuzi-operations",
    }


def extract_openclaw_messages(result: dict[str, Any]) -> list[dict[str, Any]]:
    payload = result.get("json") if isinstance(result, dict) else None
    outer_result = payload.get("result") if isinstance(payload, dict) else None
    details = outer_result.get("details") if isinstance(outer_result, dict) else None
    messages = details.get("messages") if isinstance(details, dict) else None
    if isinstance(messages, list):
        return [message for message in messages if isinstance(message, dict)]

    content_items = outer_result.get("content") if isinstance(outer_result, dict) else None
    if not isinstance(content_items, list):
        return []
    for item in content_items:
        text = item.get("text") if isinstance(item, dict) else None
        if not isinstance(text, str) or not text.strip():
            continue
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict) and isinstance(parsed.get("messages"), list):
            return [message for message in parsed["messages"] if isinstance(message, dict)]
    return []


def openclaw_read_discord_messages(target: str, limit: int = 10) -> list[dict[str, Any]]:
    return resolve_injected_discord_gateway().read_messages(target, limit)


def discord_api_json(method: str, path: str, payload: dict[str, Any] | None = None, reason: str = "") -> dict[str, Any]:
    return resolve_injected_discord_gateway().api_json(method, path, payload, reason)


def discord_channel_id_from_target(target: str) -> str:
    value = str(target).strip()
    if value.startswith("channel:"):
        return value.removeprefix("channel:").strip()
    return value


def discord_message_sort_key(message: dict[str, Any]) -> int:
    try:
        return int(str(message.get("id", "0")).strip() or "0")
    except ValueError:
        return 0


def discord_message_is_human(message: dict[str, Any]) -> bool:
    author = message.get("author") if isinstance(message, dict) else None
    if not isinstance(author, dict):
        return False
    if author.get("bot") or message.get("webhook_id"):
        return False
    return bool(str(message.get("content", "")).strip())


def acquire_discord_listener_lock() -> bool:
    global DISCORD_LISTENER_LOCK_SOCKET
    if DISCORD_LISTENER_LOCK_SOCKET is not None:
        return True

    mutex_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            mutex_socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        mutex_socket.bind(("127.0.0.1", DISCORD_LISTENER_LOCK_PORT))
        mutex_socket.listen(1)
    except OSError:
        mutex_socket.close()
        return False

    DISCORD_LISTENER_LOCK_SOCKET = mutex_socket
    return True


def poll_crm_query_discord_channel() -> None:
    target = resolve_openclaw_runtime_value("FUZI_OPENCLAW_TARGET_CRM_QUERY", "")
    if not str(target).strip():
        return

    gateway = resolve_injected_discord_gateway()
    messages = gateway.read_messages(target, limit=10)
    if not isinstance(messages, list):
        return

    with STATE_LOCK:
        cursors = OPERATIONS_STATE.setdefault("discord_cursors", {})
        last_message_id = str(cursors.get("crm_query_last_message_id", "")).strip()

    new_messages = [
        message
        for message in sorted(messages, key=discord_message_sort_key)
        if discord_message_is_human(message)
        and (not last_message_id or discord_message_sort_key(message) > int(last_message_id))
    ]

    if not new_messages:
        return

    newest_seen_id = last_message_id
    for message in new_messages:
        newest_seen_id = str(message.get("id", newest_seen_id)).strip() or newest_seen_id
        question = str(message.get("content", "")).strip()
        if not question:
            continue
        send_crm_query_result(question)

    with STATE_LOCK:
        OPERATIONS_STATE.setdefault("discord_cursors", {})["crm_query_last_message_id"] = newest_seen_id
        save_operations_state()


def parse_breakdown_dispatch_message(content: str) -> dict[str, str] | None:
    text = re.sub(r"\s+", " ", str(content or "")).strip()
    if not text:
        return None

    # Typical inbound format from field teams: "981 Place Exists Location Name".
    unit_match = re.search(r"\b(?:unit|lift|elevator|ref|id)?\s*[:#-]?\s*([A-Za-z0-9-]{2,})\b", text, re.IGNORECASE)
    if not unit_match:
        return None

    unit = unit_match.group(1).strip()
    remainder = text[unit_match.end():].strip(" -:,")
    if not remainder and unit_match.start() == 0:
        parts = text.split(" ", 1)
        remainder = parts[1].strip() if len(parts) > 1 else ""

    location = re.sub(r"(?i)^(place exists|location name|location|place|site)\s*[:\-]*\s*", "", remainder).strip()
    if not location:
        return None

    return {
        "unit": unit,
        "location": location,
        "raw": text,
    }


def next_available_breakdown_engineer() -> dict[str, Any] | None:
    def availability_rank(member: dict[str, Any]) -> tuple[int, str]:
        availability = str(member.get("availability", "")).strip().lower()
        if availability == "available":
            return (0, str(member.get("name", "")))
        if "available" in availability:
            return (1, str(member.get("name", "")))
        if availability == "on site":
            return (3, str(member.get("name", "")))
        if availability in {"off duty", "leave"}:
            return (9, str(member.get("name", "")))
        return (4, str(member.get("name", "")))

    candidates = [member for member in INSTALL_TEAM if availability_rank(member)[0] < 9]
    if not candidates:
        return None
    candidates.sort(key=availability_rank)
    return candidates[0]


def post_breakdown_assignment_message(
    summary: str,
    details: list[str] | None = None,
    event_type: str = "breakdown-dispatch",
    metadata: dict[str, Any] | None = None,
) -> None:
    message_summary = str(summary or "").strip()
    if not message_summary:
        return
    send_business_channel_update(
        "FUZI_OPENCLAW_TARGET_BREAKDOWN_CHANNEL",
        message_summary,
        details or [],
        event_type=event_type,
        metadata=metadata,
    )


def breakdown_exists_for_source_message(source_message_id: str) -> bool:
    normalized = str(source_message_id or "").strip()
    if not normalized:
        return False
    return any(str(item.get("source_message_id", "")).strip() == normalized for item in BREAKDOWNS)


def claim_breakdown_source_message(source_message_id: str) -> bool:
    normalized = str(source_message_id or "").strip()
    if not normalized:
        return False
    BREAKDOWN_DISPATCH_CLAIMS_DIR.mkdir(parents=True, exist_ok=True)
    claim_path = BREAKDOWN_DISPATCH_CLAIMS_DIR / f"{normalized}.claim"
    try:
        file_descriptor = os.open(str(claim_path), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        return False

    with os.fdopen(file_descriptor, "w", encoding="utf-8") as handle:
        handle.write(now_stamp())
    return True


def _largest_discord_message_id(*values: Any) -> str:
    message_ids = [str(value or "").strip() for value in values]
    numeric_ids = [message_id for message_id in message_ids if message_id.isdigit()]
    if not numeric_ids:
        return ""
    return max(numeric_ids, key=int)


def highest_breakdown_source_message_id() -> str:
    return _largest_discord_message_id(
        *[
            item.get("source_message_id", "")
            for item in BREAKDOWNS
            if str(item.get("source_channel", "")).strip().lower() == "discord"
        ]
    )


def synchronize_breakdown_cursor() -> str:
    persisted_cursor = highest_breakdown_source_message_id()
    with STATE_LOCK:
        cursors = OPERATIONS_STATE.setdefault("discord_cursors", {})
        current_cursor = str(cursors.get("breakdown_last_message_id", "")).strip()
        effective_cursor = _largest_discord_message_id(current_cursor, persisted_cursor)
        if effective_cursor and effective_cursor != current_cursor:
            cursors["breakdown_last_message_id"] = effective_cursor
            save_operations_state()
        return effective_cursor or current_cursor


def process_breakdown_discord_message(message: dict[str, Any]) -> None:
    parsed = parse_breakdown_dispatch_message(str(message.get("content", "")))
    if parsed is None:
        return

    source_message_id = str(message.get("id", "")).strip()
    if breakdown_exists_for_source_message(source_message_id):
        return
    if not claim_breakdown_source_message(source_message_id):
        return

    engineer = next_available_breakdown_engineer()
    if engineer is None:
        post_breakdown_assignment_message(
            f"Breakdown message {message.get('id', '')} could not be assigned.",
            [
                f"Unit: {parsed['unit']}.",
                f"Site: {parsed['location']}.",
                "Scheduled engineer: Unassigned (No available engineer).",
            ],
        )
        return

    now = datetime.now().isoformat()
    assigned_engineer_id = str(engineer.get("id", "")).strip()
    assigned_engineer_name = str(engineer.get("name", "")).strip()
    assigned_engineer_shift = str(engineer.get("shift", "")).strip()
    assigned_engineer_availability = "On Site"
    record = {
        "id": _next_id(BREAKDOWNS, "BRK"),
        "unit": parsed["unit"],
        "elevator_ref": parsed["unit"],
        "customer": "Discord Breakdown",
        "site": parsed["location"],
        "reported_at": now,
        "attended_at": None,
        "resolved_at": None,
        "closed_at": None,
        "technician": assigned_engineer_name,
        "scheduled_engineer_id": assigned_engineer_id,
        "scheduled_engineer_name": assigned_engineer_name,
        "engineer_availability": assigned_engineer_availability,
        "engineer_shift": assigned_engineer_shift,
        "engineer_current_job": "",
        "scheduled_visit_at": "",
        "fault": f"Inbound Discord report for unit {parsed['unit']} at {parsed['location']}.",
        "contract_type": "Unknown",
        "resolution": "",
        "priority": "High",
        "status": "Open",
        "source_channel": "discord",
        "source_message_id": source_message_id,
        "source_message": parsed["raw"],
        "source_author": str(message.get("author", {}).get("username", "")).strip(),
        "created_at": now,
    }

    engineer["current_job"] = record["id"]
    engineer["availability"] = assigned_engineer_availability
    save_install_team()

    record["engineer_current_job"] = str(engineer.get("current_job", "")).strip()
    BREAKDOWNS.append(record)
    _save_module(BREAKDOWNS_FILE, BREAKDOWNS)

    post_breakdown_assignment_message(
        f"Breakdown {record['id']} assigned from Discord message {source_message_id or 'unknown'}.",
        [
            f"Unit: {parsed['unit']}.",
            f"Site: {parsed['location']}.",
            f"Fault: {record.get('fault', 'Not specified') or 'Not specified'}.",
            f"Priority: {record.get('priority', 'High')}.",
            f"Scheduled engineer: {assigned_engineer_name or 'Unassigned'} ({assigned_engineer_availability}).",
            f"Technician: {record.get('technician', 'Unassigned') or 'Unassigned'}.",
        ],
        metadata={"breakdown_id": record.get("id", "")},
    )


def poll_breakdown_discord_channel() -> None:
    target = resolve_openclaw_runtime_value("FUZI_OPENCLAW_TARGET_BREAKDOWN_CHANNEL", "")
    if not str(target).strip():
        return

    gateway = resolve_injected_discord_gateway()
    messages = gateway.read_messages(target, limit=15)
    if not isinstance(messages, list):
        return

    last_message_id = synchronize_breakdown_cursor()

    new_messages = [
        message
        for message in sorted(messages, key=discord_message_sort_key)
        if discord_message_is_human(message)
        and (not last_message_id or discord_message_sort_key(message) > int(last_message_id))
    ]

    if not new_messages:
        return

    newest_seen_id = last_message_id
    for message in new_messages:
        newest_seen_id = str(message.get("id", newest_seen_id)).strip() or newest_seen_id
        process_breakdown_discord_message(message)

    with STATE_LOCK:
        OPERATIONS_STATE.setdefault("discord_cursors", {})["breakdown_last_message_id"] = newest_seen_id
        save_operations_state()


def ensure_discord_agent_channels(guild_id: str) -> dict[str, Any]:
    if not guild_id.strip():
        raise RuntimeError("Set FUZI_DISCORD_GUILD_ID to the Discord server ID before provisioning agent channels.")

    reason = "Provision FUZI operational agent channels"
    gateway = resolve_injected_discord_gateway()
    channels = gateway.api_json("GET", f"/guilds/{guild_id}/channels")
    if not isinstance(channels, list):
        raise RuntimeError("Discord did not return a channel list for the target guild.")

    env_values = load_openclaw_env_values()
    category_id = env_values.get("FUZI_DISCORD_AGENT_CATEGORY_ID", "").strip()
    category = next((item for item in channels if str(item.get("id", "")) == category_id), None) if category_id else None
    if category is None:
        category = next(
            (
                item
                for item in channels
                if item.get("type") == 4 and str(item.get("name", "")).strip().lower() == DISCORD_AGENT_CHANNEL_CATEGORY_NAME.lower()
            ),
            None,
        )
    if category is None:
        category = gateway.api_json(
            "POST",
            f"/guilds/{guild_id}/channels",
            {
                "name": DISCORD_AGENT_CHANNEL_CATEGORY_NAME,
                "type": 4,
            },
            reason=reason,
        )
        channels.append(category)

    created: list[dict[str, str]] = []
    updated_env = {
        "FUZI_DISCORD_GUILD_ID": guild_id.strip(),
        "FUZI_DISCORD_AGENT_CATEGORY_ID": str(category.get("id", "")).strip(),
    }
    all_specs = [*DISCORD_AGENT_CHANNEL_SPECS, *BUSINESS_DISCORD_CHANNEL_SPECS]
    for spec in all_specs:
        existing_target = env_values.get(spec["env_key"], "").strip()
        existing_id = existing_target.removeprefix("channel:") if existing_target.startswith("channel:") else existing_target
        channel = None
        if existing_id:
            matched_channel = next((item for item in channels if str(item.get("id", "")) == existing_id), None)
            if matched_channel and str(matched_channel.get("name", "")).strip().lower() == spec["name"]:
                channel = matched_channel
        if channel is None:
            channel = next(
                (
                    item
                    for item in channels
                    if item.get("type") == 0
                    and str(item.get("parent_id", "")).strip() == str(category.get("id", "")).strip()
                    and str(item.get("name", "")).strip().lower() == spec["name"]
                ),
                None,
            )
        if channel is None:
            channel = gateway.api_json(
                "POST",
                f"/guilds/{guild_id}/channels",
                {
                    "name": spec["name"],
                    "type": 0,
                    "parent_id": str(category.get("id", "")).strip(),
                    "topic": spec["topic"],
                },
                reason=reason,
            )
            channels.append(channel)
            created.append({"agent": spec["agent"], "channel": spec["name"], "id": str(channel.get("id", "")).strip()})
        updated_env[spec["env_key"]] = f"channel:{str(channel.get('id', '')).strip()}"

    save_openclaw_env_values(updated_env)
    return {
        "category": {
            "id": str(category.get("id", "")).strip(),
            "name": str(category.get("name", DISCORD_AGENT_CHANNEL_CATEGORY_NAME)).strip(),
        },
        "created": created,
        "channels": [
            {
                "agent": spec["agent"],
                "env_key": spec["env_key"],
                "name": spec["name"],
                "target": updated_env[spec["env_key"]],
            }
            for spec in all_specs
        ],
    }


def extract_openclaw_dashboard_url_from_output(output: str) -> str:
    for raw_url in re.findall(r"https?://\S+", output):
        cleaned_url = raw_url.rstrip(")].,;'")
        parsed = urllib_parse.urlsplit(cleaned_url)
        if parsed.scheme and parsed.netloc and (parsed.path.startswith("/chat") or parsed.netloc.endswith(":18789")):
            return cleaned_url
    return ""


def extract_openclaw_token_from_dashboard_url(dashboard_url: str) -> str:
    if not dashboard_url:
        return ""
    parsed = urllib_parse.urlsplit(dashboard_url)
    for source in (parsed.fragment, parsed.query):
        values = urllib_parse.parse_qs(source)
        for key in ("token", "gatewayToken", "gateway_token", "authToken", "auth_token"):
            token_values = values.get(key, [])
            if token_values and token_values[0].strip():
                return token_values[0].strip()
    return ""


def discover_openclaw_dashboard_url() -> str:
    with STATE_LOCK:
        if RUNTIME_STATE["openclaw_dashboard_lookup_attempted"]:
            return str(RUNTIME_STATE.get("openclaw_dashboard_url", "")).strip()
        RUNTIME_STATE["openclaw_dashboard_lookup_attempted"] = True

    try:
        completed = subprocess.run(
            list(OPENCLAW_ALLOWED_COMMAND),
            capture_output=True,
            check=False,
            shell=False,
            text=True,
            timeout=max(int(OPENCLAW_TIMEOUT), 5),
        )
    except (OSError, ValueError, subprocess.SubprocessError):
        return ""

    output = "\n".join(part.strip() for part in (completed.stdout, completed.stderr) if part and part.strip())
    dashboard_url = extract_openclaw_dashboard_url_from_output(output)

    with STATE_LOCK:
        RUNTIME_STATE["openclaw_dashboard_url"] = dashboard_url
    return dashboard_url


def resolve_openclaw_auth_secret() -> str:
    env_values = load_openclaw_env_values()
    dashboard_token = extract_openclaw_token_from_dashboard_url(discover_openclaw_dashboard_url())
    for candidate in (
        os.environ.get("FUZI_OPENCLAW_TOKEN", "").strip(),
        os.environ.get("OPENCLAW_GATEWAY_TOKEN", "").strip(),
        env_values.get("FUZI_OPENCLAW_TOKEN", "").strip(),
        env_values.get("OPENCLAW_GATEWAY_TOKEN", "").strip(),
        extract_openclaw_config_secret("token"),
        os.environ.get("FUZI_OPENCLAW_PASSWORD", "").strip(),
        os.environ.get("OPENCLAW_GATEWAY_PASSWORD", "").strip(),
        env_values.get("FUZI_OPENCLAW_PASSWORD", "").strip(),
        env_values.get("OPENCLAW_GATEWAY_PASSWORD", "").strip(),
        extract_openclaw_config_secret("password"),
        dashboard_token,
    ):
        if candidate:
            return candidate
    return ""


def default_on_call_phone() -> str:
    for item in OPERATIONS_STATE["fleet"]:
        phone = str(item.get("on_call_phone", "")).strip()
        if phone and fleet_item_needs_attention(item):
            return phone
    for member in INSTALL_TEAM:
        phone = str(member.get("phone", "")).strip()
        if phone and member.get("availability") in {"Available", "On Site"}:
            return phone
    return ""


def resolve_morning_brief_phone() -> str:
    return resolve_openclaw_runtime_value(
        "FUZI_OPENCLAW_MORNING_BRIEF_PHONE",
        OPENCLAW_MORNING_BRIEF_PHONE.strip(),
    ) or default_on_call_phone()


def resolve_openclaw_runtime_value(env_key: str, default: str = "") -> str:
    env_values = load_openclaw_env_values()
    if env_key in RUNTIME_MANAGED_OPENCLAW_ENV_KEYS:
        managed_value = env_values.get(env_key, "").strip()
        if managed_value:
            return managed_value

    value = os.environ.get(env_key, "").strip()
    if value:
        return value
    return env_values.get(env_key, "").strip() or default


def resolve_agent_target_env_key(payload: dict[str, Any]) -> str:
    agent_name = str(payload.get("agent", "")).strip()
    return AGENT_TARGET_ENV_KEYS.get(agent_name, "")


def resolve_openclaw_target_for_payload(event_type: str, payload: dict[str, Any]) -> str:
    agent_target_key = resolve_agent_target_env_key(payload)
    if agent_target_key:
        agent_target = resolve_openclaw_runtime_value(agent_target_key, "")
        if agent_target:
            return agent_target
    if event_type == "morning-brief":
        return resolve_morning_brief_phone()
    return resolve_openclaw_runtime_value("FUZI_OPENCLAW_OPS_TARGET", OPENCLAW_OPS_TARGET.strip())


def openclaw_delivery_target(event_type: str, payload: dict[str, Any]) -> str:
    explicit_phone = str(payload.get("target_phone", "")).strip()
    if explicit_phone:
        return explicit_phone
    return resolve_openclaw_target_for_payload(event_type, payload)


def configured_openclaw_channels() -> list[str]:
    parsed_config = load_openclaw_config_json()
    channels = parsed_config.get("channels") if isinstance(parsed_config, dict) else None
    if not isinstance(channels, dict):
        return []

    configured: list[str] = []
    for channel_name, channel_config in channels.items():
        if not isinstance(channel_name, str) or not isinstance(channel_config, dict):
            continue
        if channel_config.get("enabled", True):
            configured.append(channel_name)
            continue
        accounts = channel_config.get("accounts")
        if isinstance(accounts, dict) and any(isinstance(account_config, dict) and account_config.get("enabled", False) for account_config in accounts.values()):
            configured.append(channel_name)
    return configured


def normalize_phone_delivery_target(target: str) -> str:
    cleaned = re.sub(r"[\s().-]+", "", target.strip())
    if cleaned.startswith("00"):
        cleaned = f"+{cleaned[2:]}"
    return cleaned


def is_phone_delivery_target(target: str) -> bool:
    return bool(re.fullmatch(r"\+[1-9]\d{6,14}", normalize_phone_delivery_target(target)))


def resolve_openclaw_delivery_channel(payload: dict[str, Any]) -> str:
    explicit_channel = str(payload.get("channel", "")).strip()
    if explicit_channel:
        return explicit_channel

    configured = configured_openclaw_channels()
    if OPENCLAW_DEFAULT_CHANNEL in configured or not configured:
        return OPENCLAW_DEFAULT_CHANNEL

    for candidate in ("whatsapp", "telegram", "signal", "discord", "slack"):
        if candidate in configured:
            return candidate
    return configured[0]


def resolve_whatsapp_backend_channel() -> str:
    configured = configured_openclaw_channels()
    explicit_channel = resolve_openclaw_runtime_value(
        "FUZI_OPENCLAW_WHATSAPP_BACKEND_CHANNEL",
        OPENCLAW_WHATSAPP_BACKEND_CHANNEL.strip(),
    )
    if explicit_channel:
        return explicit_channel
    if "discord" in configured:
        return "discord"
    if "whatsapp" in configured:
        return "whatsapp"
    if configured:
        return configured[0]
    return OPENCLAW_DEFAULT_CHANNEL


def resolve_whatsapp_backend_target() -> str:
    return resolve_openclaw_runtime_value(
        "FUZI_OPENCLAW_WHATSAPP_BACKEND_TARGET",
        OPENCLAW_WHATSAPP_BACKEND_TARGET.strip(),
    ) or resolve_openclaw_runtime_value("FUZI_OPENCLAW_OPS_TARGET", OPENCLAW_OPS_TARGET.strip())


def resolve_whatsapp_backend_target_for_payload(request_payload: dict[str, Any]) -> str:
    agent_target_key = resolve_agent_target_env_key(request_payload)
    if agent_target_key:
        agent_target = resolve_openclaw_runtime_value(agent_target_key, "")
        if agent_target:
            return agent_target
    return resolve_whatsapp_backend_target()


def build_openclaw_message_payload(channel: str, target: str, message: str, request_payload: dict[str, Any]) -> dict[str, Any]:
    metadata = {
        "source": request_payload.get("source", "fuzi-operations-portal"),
        "event_type": request_payload.get("event_type", ""),
        "timestamp": request_payload.get("timestamp", ""),
    }
    for key, value in request_payload.items():
        if key in {"source", "event_type", "timestamp"}:
            continue
        metadata[key] = value

    return {
        "tool": "message",
        "action": "send",
        "agentId": OPENCLAW_AGENT_ID,
        "agent_id": OPENCLAW_AGENT_ID,
        "args": {
            "channel": channel,
            "target": target,
            "message": message,
        },
        "sessionKey": "fuzi-operations",
        "metadata": metadata,
    }


def build_openclaw_discord_send_payload(target: str, message: str, request_payload: dict[str, Any]) -> dict[str, Any]:
    payload = build_openclaw_message_payload("discord", target, message, request_payload)
    payload.pop("sessionKey", None)
    return payload


class OpenClawMessageBackend:
    def send_message(self, channel: str, target: str, message: str, request_payload: dict[str, Any]) -> dict[str, Any]:
        return annotate_openclaw_result(
            post_openclaw_json(
                "/tools/invoke",
                build_openclaw_message_payload(channel, target, message, request_payload),
            )
        )


class InjectedDiscordGateway:
    def __init__(self, invoke_json: Callable[[str, dict[str, Any]], dict[str, Any]], token_loader: Callable[[], str]):
        self.invoke_json = invoke_json
        self.token_loader = token_loader

    def send_message(self, target: str, message: str, request_payload: dict[str, Any]) -> dict[str, Any]:
        normalized_target = str(target or "").strip()
        if not normalized_target:
            return {
                "ok": False,
                "status": None,
                "error": "Discord target is required.",
                "url": build_openclaw_endpoint("/tools/invoke"),
            }
        return annotate_openclaw_result(
            self.invoke_json(
                "/tools/invoke",
                build_openclaw_discord_send_payload(normalized_target, message, request_payload),
            )
        )

    def read_messages(self, target: str, limit: int = 10) -> list[dict[str, Any]]:
        normalized_target = str(target or "").strip()
        if not normalized_target:
            return []

        result = annotate_openclaw_result(
            self.invoke_json(
                "/tools/invoke",
                build_openclaw_message_read_payload(normalized_target, limit),
            )
        )
        if not result.get("ok"):
            return []
        return extract_openclaw_messages(result)

    def api_json(self, method: str, path: str, payload: dict[str, Any] | None = None, reason: str = "") -> dict[str, Any]:
        token = self.token_loader()
        if not token:
            raise RuntimeError("Discord token is not configured in ~/.openclaw/openclaw.json.")

        endpoint = f"https://discord.com/api/v10{path}"
        headers = {
            "Authorization": f"Bot {token}",
            "Content-Type": "application/json",
            "User-Agent": "FUZI/1.0",
        }
        if reason:
            headers["X-Audit-Log-Reason"] = reason

        data = None if payload is None else json.dumps(payload).encode("utf-8")
        request_obj = urllib_request.Request(endpoint, data=data, headers=headers, method=method)
        try:
            with urllib_request.urlopen(request_obj, timeout=20) as response:
                body = response.read().decode("utf-8", errors="replace")
                return json.loads(body) if body else {}
        except urllib_error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            detail = body or exc.reason
            raise RuntimeError(f"Discord API {method} {path} failed with {exc.code}: {detail}") from exc
        except urllib_error.URLError as exc:
            raise RuntimeError(f"Discord API {method} {path} failed: {getattr(exc, 'reason', exc)}") from exc


class InjectedWhatsAppTransport:
    def __init__(self, backend: OpenClawMessageBackend, backend_channel: str, backend_target: str):
        self.backend = backend
        self.backend_channel = backend_channel
        self.backend_target = backend_target

    def send(self, target_phone: str, message: str, request_payload: dict[str, Any]) -> dict[str, Any]:
        if self.backend_channel == "whatsapp":
            return self.backend.send_message("whatsapp", target_phone, message, request_payload)

        backend_target = resolve_whatsapp_backend_target_for_payload(request_payload) or self.backend_target

        if not backend_target:
            return {
                "ok": False,
                "status": None,
                "error": (
                    f"Injected WhatsApp backend '{self.backend_channel}' requires an agent target env such as "
                    "FUZI_OPENCLAW_TARGET_FLEET_MONITOR, FUZI_OPENCLAW_WHATSAPP_BACKEND_TARGET, or FUZI_OPENCLAW_OPS_TARGET "
                    "so phone alerts have a real backend destination."
                ),
                "url": build_openclaw_endpoint("/tools/invoke"),
            }

        bridged_message = f"[Injected WhatsApp via {self.backend_channel} for {target_phone}] {message}"
        return self.backend.send_message(self.backend_channel, backend_target, bridged_message, request_payload)


def resolve_injected_whatsapp_transport() -> InjectedWhatsAppTransport:
    return InjectedWhatsAppTransport(
        backend=OpenClawMessageBackend(),
        backend_channel=resolve_whatsapp_backend_channel(),
        backend_target=resolve_whatsapp_backend_target(),
    )


def resolve_injected_discord_gateway() -> InjectedDiscordGateway:
    return InjectedDiscordGateway(
        invoke_json=post_openclaw_json,
        token_loader=load_openclaw_discord_token,
    )


def format_openclaw_message(event_type: str, payload: dict[str, Any]) -> str:
    if event_type == "technician-alert":
        return str(payload.get("message", "Technician alert from FUZI operations.")).strip()
    if event_type == "morning-brief":
        details = payload.get("details", [])
        detail_block = "\n".join(f"- {item}" for item in details[:4])
        return f"{payload.get('summary', 'Morning operations brief.')}\n{detail_block}".strip()
    if event_type == "modernization-flag":
        details = payload.get("details", [])
        detail_block = "\n".join(f"- {item}" for item in details[:4])
        return f"{payload.get('summary', 'Modernization project flag.')}\n{detail_block}".strip()
    if event_type == "work-order":
        work_order = payload.get("work_order", {})
        return f"Work order {work_order.get('id', '')}: {work_order.get('title', '')}. {work_order.get('body', '')}".strip()
    if event_type == "installation-complete":
        return str(payload.get("message", "Installation completed and handover is ready.")).strip()
    if event_type == "customer-service":
        summary = payload.get("summary", {})
        return f"Customer service triage: {summary.get('urgent', 0)} urgent and {summary.get('routine', 0)} routine messages processed.".strip()
    if event_type == "crm-query":
        details = payload.get("details", [])
        detail_block = "\n".join(f"- {item}" for item in details[:5])
        return f"{payload.get('summary', 'CRM query result.')}\n{detail_block}".strip()
    return json.dumps(payload, ensure_ascii=True)


def event_requires_openclaw_delivery(event_type: str) -> bool:
    return event_type in {"technician-alert", "morning-brief", "modernization-flag", "work-order", "installation-complete"}


def openclaw_auth_header_sets() -> list[dict[str, str]]:
    auth_secret = resolve_openclaw_auth_secret()
    if not auth_secret:
        return [{}]
    return [{"Authorization": f"Bearer {auth_secret}"}]


def openclaw_manual_dashboard_hint() -> str:
    return (
        "Python is allowed to run only 'openclaw dashboard --no-open' to discover the dashboard URL and any '#token=' fragment it prints. "
        "If that still does not authenticate, provide gateway auth through OPENCLAW_GATEWAY_TOKEN, OPENCLAW_GATEWAY_PASSWORD, ~/.openclaw/.env, or ~/.openclaw/openclaw.json."
    )


def log_openclaw_http_event(stage: str, details: dict[str, Any]) -> None:
    app.logger.warning("OpenClaw %s: %s", stage, json.dumps(details, ensure_ascii=True, default=str))


def log_openclaw_invoke_response(endpoint_url: str, status: int | None, body: str, error: str = "") -> None:
    if not endpoint_url.rstrip("/").endswith("/tools/invoke"):
        return
    app.logger.warning(
        "OpenClaw exact /tools/invoke response: %s",
        json.dumps(
            {
                "url": endpoint_url,
                "status": status,
                "body": body,
                "error": error,
            },
            ensure_ascii=True,
            default=str,
        ),
    )


def post_openclaw_json(path: str, request_payload: dict[str, Any]) -> dict[str, Any]:
    discover_openclaw_dashboard_url()
    encoded_payload = json.dumps(request_payload).encode("utf-8")
    last_error: dict[str, Any] | None = None
    endpoint_url = build_openclaw_endpoint(path)

    for auth_headers in openclaw_auth_header_sets():
        headers = {"Content-Type": "application/json", **auth_headers}
        auth_preview = ""
        if "Authorization" in headers:
            auth_preview = f"Bearer({max(len(headers['Authorization']) - 7, 0)} chars)"
        log_openclaw_http_event(
            "request",
            {
                "url": endpoint_url,
                "auth": auth_preview,
                "payload": request_payload,
            },
        )
        http_request = urllib_request.Request(
            endpoint_url,
            data=encoded_payload,
            headers=headers,
            method="POST",
        )
        try:
            with urllib_request.urlopen(http_request, timeout=OPENCLAW_TIMEOUT) as response:
                body = response.read().decode("utf-8", errors="replace")
                parsed = json.loads(body) if body else {}
                log_openclaw_http_event(
                    "response",
                    {
                        "url": endpoint_url,
                        "status": getattr(response, "status", 200),
                        "body": body,
                    },
                )
                log_openclaw_invoke_response(endpoint_url, getattr(response, "status", 200), body)
                return {
                    "ok": getattr(response, "status", 200) < 400 and (not isinstance(parsed, dict) or parsed.get("ok", True)),
                    "status": getattr(response, "status", 200),
                    "body": body[:400],
                    "json": parsed if isinstance(parsed, dict) else {},
                    "url": endpoint_url,
                }
        except urllib_error.HTTPError as exc:
            error_body = exc.read(4096).decode("utf-8", errors="replace")
            log_openclaw_http_event(
                "http-error",
                {
                    "url": endpoint_url,
                    "status": exc.code,
                    "body": error_body,
                },
            )
            log_openclaw_invoke_response(endpoint_url, exc.code, error_body)
            last_error = {
                "ok": False,
                "status": exc.code,
                "error": error_body[:400] or exc.reason,
                "url": endpoint_url,
            }
            if exc.code not in {401, 403}:
                return last_error
        except (TimeoutError, socket.timeout) as exc:
            invoke_error = str(exc) or "The OpenClaw request timed out."
            log_openclaw_http_event(
                "timeout",
                {
                    "url": endpoint_url,
                    "error": invoke_error,
                },
            )
            log_openclaw_invoke_response(endpoint_url, None, "", invoke_error)
            return {
                "ok": False,
                "status": None,
                "error": invoke_error,
                "url": endpoint_url,
            }
        except urllib_error.URLError as exc:
            invoke_error = str(getattr(exc, "reason", exc))
            log_openclaw_http_event(
                "url-error",
                {
                    "url": endpoint_url,
                    "error": invoke_error,
                },
            )
            log_openclaw_invoke_response(endpoint_url, None, "", invoke_error)
            return {
                "ok": False,
                "status": None,
                "error": invoke_error,
                "url": endpoint_url,
            }

    return last_error or {
        "ok": False,
        "status": None,
        "error": "OpenClaw request failed before the gateway returned a response.",
        "url": build_openclaw_endpoint(path),
    }


def annotate_openclaw_result(result: dict[str, Any]) -> dict[str, Any]:
    if result.get("ok"):
        return result

    status = result.get("status")
    error_text = str(result.get("error", "")).strip()
    if status in {401, 403} or "gateway token" in error_text.lower() or "unauthorized" in error_text.lower():
        result["hint"] = openclaw_manual_dashboard_hint()
    return result


def build_discord_outbound_dedupe_key(
    env_key: str,
    target: str,
    event_type: str,
    message: str,
    metadata: dict[str, Any] | None = None,
) -> str:
    metadata = metadata or {}
    stable_fields = [
        field
        for field in (
            "breakdown_id",
            "source_message_id",
            "work_order_id",
            "attendance_id",
            "record_id",
            "ticket_id",
        )
        if str(metadata.get(field, "")).strip()
    ]
    basis: dict[str, Any] = {
        "env_key": env_key,
        "target": target,
        "event_type": event_type,
    }
    if stable_fields:
        basis["metadata"] = {field: str(metadata.get(field, "")).strip() for field in stable_fields}
    else:
        basis["message"] = message
    encoded = json.dumps(basis, sort_keys=True, ensure_ascii=True)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def prune_recent_discord_sent_messages(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cutoff = datetime.now().timestamp() - (DISCORD_OUTBOUND_DEDUPE_RETENTION_MINUTES * 60)
    retained: list[dict[str, Any]] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        sent_at = parse_now_stamp(str(entry.get("sent_at", "")))
        if sent_at is None or sent_at.timestamp() >= cutoff:
            retained.append(entry)
    return retained[:200]


def send_openclaw_event(event_type: str, payload: dict[str, Any]) -> dict[str, Any]:
    request_payload = {
        "source": "fuzi-operations-portal",
        "event_type": event_type,
        "timestamp": now_stamp(),
        **payload,
    }
    target = openclaw_delivery_target(event_type, payload)
    channel = resolve_openclaw_delivery_channel(payload)
    configured_channels = configured_openclaw_channels()
    message_text = format_openclaw_message(event_type, request_payload)
    if target:
        if payload.get("target_phone") or is_phone_delivery_target(target):
            result = resolve_injected_whatsapp_transport().send(normalize_phone_delivery_target(target), message_text, request_payload)
        elif configured_channels and channel not in configured_channels:
            result = {
                "ok": False,
                "status": None,
                "error": f"OpenClaw channel '{channel}' is not configured. Available channels: {', '.join(configured_channels)}.",
                "url": build_openclaw_endpoint("/tools/invoke"),
            }
        elif channel == "discord":
            result = resolve_injected_discord_gateway().send_message(target, message_text, request_payload)
        else:
            result = OpenClawMessageBackend().send_message(channel, target, message_text, request_payload)
    elif event_requires_openclaw_delivery(event_type):
        result = {
            "ok": False,
            "status": None,
            "error": "No OpenClaw delivery target is configured for this event.",
            "url": build_openclaw_endpoint("/tools/invoke"),
        }
    else:
        result = {
            "ok": True,
            "status": 204,
            "body": "OpenClaw delivery suppressed because no outbound target is configured.",
            "url": build_openclaw_endpoint("/tools/invoke"),
        }

    with STATE_LOCK:
        OPERATIONS_STATE["connector_status"] = {
            "state": "online" if result["ok"] else "error",
            "last_attempt": now_stamp(),
            "last_error": result.get("error", ""),
            "last_response": result.get("body", "") or str(result.get("status", "")),
        }
        save_operations_state()
    return result


def send_business_channel_update(
    env_key: str,
    summary: str,
    details: list[str] | None = None,
    event_type: str = "business-update",
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    target = resolve_openclaw_runtime_value(env_key, "")
    if not target:
        return {
            "ok": True,
            "status": 204,
            "body": f"No target configured for {env_key}.",
            "url": build_openclaw_endpoint("/tools/invoke"),
        }

    lines = [summary.strip()]
    for detail in (details or [])[:6]:
        cleaned = str(detail).strip()
        if cleaned:
            lines.append(f"- {cleaned}")
    message = "\n".join(line for line in lines if line)
    metadata_payload = dict(metadata or {})
    request_payload = {
        "source": "fuzi-operations-portal",
        "event_type": event_type,
        "timestamp": now_stamp(),
        **metadata_payload,
    }
    dedupe_key = build_discord_outbound_dedupe_key(env_key, target, event_type, message, metadata_payload)
    with STATE_LOCK:
        sent_messages = prune_recent_discord_sent_messages(OPERATIONS_STATE.setdefault("discord_sent_messages", []))
        duplicate = next((item for item in sent_messages if str(item.get("key", "")) == dedupe_key), None)
        if duplicate is not None:
            result = {
                "ok": True,
                "status": 208,
                "body": f"Duplicate Discord message suppressed for {env_key}.",
                "url": build_openclaw_endpoint("/tools/invoke"),
                "deduplicated": True,
            }
            OPERATIONS_STATE["discord_sent_messages"] = sent_messages
            OPERATIONS_STATE["connector_status"] = {
                "state": "online",
                "last_attempt": now_stamp(),
                "last_error": "",
                "last_response": result.get("body", ""),
            }
            save_operations_state()
            return result

        sent_messages.insert(
            0,
            {
                "key": dedupe_key,
                "target": target,
                "env_key": env_key,
                "event_type": event_type,
                "sent_at": now_stamp(),
                "state": "pending",
            },
        )
        OPERATIONS_STATE["discord_sent_messages"] = sent_messages
        save_operations_state()

    result = resolve_injected_discord_gateway().send_message(target, message, request_payload)
    with STATE_LOCK:
        sent_messages = prune_recent_discord_sent_messages(OPERATIONS_STATE.setdefault("discord_sent_messages", []))
        pending = next((item for item in sent_messages if str(item.get("key", "")) == dedupe_key), None)
        if result.get("ok"):
            if pending is None:
                sent_messages.insert(
                    0,
                    {
                        "key": dedupe_key,
                        "target": target,
                        "env_key": env_key,
                        "event_type": event_type,
                        "sent_at": now_stamp(),
                        "state": "sent",
                    },
                )
            else:
                pending["state"] = "sent"
                pending["sent_at"] = now_stamp()
        else:
            sent_messages = [item for item in sent_messages if str(item.get("key", "")) != dedupe_key]

        OPERATIONS_STATE["discord_sent_messages"] = sent_messages
        OPERATIONS_STATE["connector_status"] = {
            "state": "online" if result["ok"] else "error",
            "last_attempt": now_stamp(),
            "last_error": result.get("error", ""),
            "last_response": result.get("body", "") or str(result.get("status", "")),
        }
        save_operations_state()
    return result


def send_metrics_channel_snapshot(reason: str) -> dict[str, Any]:
    open_inquiries = [item for item in SALES_INQUIRIES if item.get("status") not in {"Order Received", "Closed"}]
    offers_sent = [item for item in ESTIMATES if item.get("status") in {"Sent", "Accepted"}]
    scheduled_appointments = [item for item in SALES_INQUIRIES if item.get("next_followup")]
    active_staff = [user for user in USERS if user.get("active", True)]
    summary = f"FUZI metrics update: {len(open_inquiries)} active lead{'s' if len(open_inquiries) != 1 else ''}, {len(offers_sent)} offer{'s' if len(offers_sent) != 1 else ''} sent, and {len(scheduled_appointments)} scheduled appointment{'s' if len(scheduled_appointments) != 1 else ''}."
    details = [
        f"Reason: {reason}",
        f"Flyer and ad pipeline: {len(open_inquiries)} leads are still open for follow-up.",
        f"Appointments queued: {len(scheduled_appointments)} with follow-up dates assigned.",
        f"Active staff coverage: {len(active_staff)} enabled portal user{'s' if len(active_staff) != 1 else ''}.",
    ]
    return send_business_channel_update("FUZI_OPENCLAW_TARGET_METRICS_CHANNEL", summary, details, event_type="metrics-update")


def send_catalog_channel_snapshot(context: str, estimate: dict[str, Any] | None = None) -> dict[str, Any]:
    catalog_pages = [
        "catalog.html",
        "residential-elevators.html",
        "commercial-elevators.html",
        "hospital-elevators.html",
        "hotel-elevators.html",
        "industrial-elevators.html",
        "parallel-escalator.html",
        "step-type-escalator.html",
        "crisscross-escalator.html",
        "capsule-elevators.html",
    ]
    summary = "FUZI elevator catalog is ready with the main catalog, product pages, and elevator options for offer follow-up."
    details = [f"Context: {context}"]
    if estimate:
        details.append(f"Offer: {estimate.get('customer_name', 'Customer')} - {estimate.get('elevator_type', 'Elevator')} at {estimate.get('site', 'site pending')}.")
        details.append(f"Spec: {estimate.get('capacity', '')}, {estimate.get('drive_type', '')}, {estimate.get('door_type', '')}.".strip())
    details.append("Catalog pages: " + ", ".join(catalog_pages[:6]))
    details.append("Material catalog is available in the portal estimator and inventory sections.")
    return send_business_channel_update("FUZI_OPENCLAW_TARGET_ELEVATOR_CATALOG", summary, details, event_type="catalog-update")


def create_auto_ticket(project: str, title: str, owner: str, priority: str, due: str, notes: str) -> dict[str, Any]:
    ticket = {
        "id": next_ticket_id(),
        "project": project,
        "title": title,
        "owner": owner,
        "status": "Open",
        "priority": priority,
        "due": due,
        "notes": notes,
        "created_at": now_stamp(),
    }
    PROJECT_TICKETS.insert(0, ticket)
    save_project_tickets()
    return ticket


def sync_projects_from_tickets() -> None:
    tracked_projects: dict[str, dict[str, Any]] = {}
    for baseline in DEFAULT_MODERNIZATION_PROJECTS:
        existing = next((item for item in OPERATIONS_STATE["projects"] if item.get("name") == baseline["name"]), None)
        tracked_projects[baseline["name"]] = {
            **baseline,
            **(existing or {}),
        }

    for ticket in PROJECT_TICKETS:
        project_name = ticket.get("project", "Unassigned project")
        if project_name not in tracked_projects:
            continue
        risk = "Blocked" if ticket.get("status") == "Blocked" else "At risk" if ticket.get("priority") == "High" and ticket.get("status") != "Closed" else "On track"
        existing = tracked_projects.get(project_name)
        if risk == "Blocked" or existing.get("risk") != "Blocked":
            existing["risk"] = risk
            existing["stage"] = ticket.get("title", existing.get("stage", "Follow-up"))
            existing["owner"] = ticket.get("owner", existing.get("owner", "Unassigned"))
            existing["due"] = ticket.get("due", existing.get("due", "TBD"))
            owner_name = str(ticket.get("owner", existing.get("owner", "Unassigned"))).strip()
            if owner_name and owner_name != "Unassigned":
                existing["assigned_techs"] = [owner_name]

            ticket_text = " ".join(
                str(part).strip()
                for part in (
                    ticket.get("title", ""),
                    ticket.get("notes", ""),
                    existing.get("stage", ""),
                )
                if str(part).strip()
            ).lower()
            if "permit" in ticket_text:
                existing["permit_status"] = ticket.get("title", existing.get("permit_status", "Pending review"))
            if any(token in ticket_text for token in ("supplier", "stock", "battery", "dispatch eta", "parts order")) or re.search(r"\bparts?\b", ticket_text):
                existing["parts_status"] = ticket.get("title", existing.get("parts_status", "Pending review"))
            if "inspection" in ticket_text:
                existing["inspection_date"] = ticket.get("due", existing.get("inspection_date", "TBD"))
    OPERATIONS_STATE["projects"] = list(tracked_projects.values())[:8]


def parse_job_target_date(target: str) -> datetime | None:
    text = str(target).strip()
    if not text:
        return None
    current_year = datetime.now().year
    for fmt in ("%b %d", "%B %d"):
        try:
            parsed = datetime.strptime(f"{text} {current_year}", f"{fmt} %Y")
            return parsed
        except ValueError:
            continue
    return None


def current_install_stage(job: dict[str, Any]) -> dict[str, Any]:
    return next(
        (stage for stage in job.get("stages", []) if stage.get("status") in {"In Progress", "Blocked"}),
        next((stage for stage in job.get("stages", []) if stage.get("status") == "Open"), job.get("stages", [{}])[-1]),
    )


def install_stage_guidance(stage_id: str) -> dict[str, Any]:
    stage = next((item for item in INSTALL_STAGES if item.get("id") == stage_id), None)
    if stage is None:
        return {"name": stage_id or "Next stage", "checkpoint": "", "checks": []}
    return {
        "name": stage.get("name", stage_id),
        "checkpoint": stage.get("checkpoint", ""),
        "checks": list(stage.get("checks", [])),
    }


def install_stage_flag(job: dict[str, Any], active_stage: dict[str, Any]) -> str:
    if active_stage.get("status") == "Blocked":
        return f"Crew is stuck at {install_stage_guidance(active_stage.get('id', '')).get('name', 'current stage')}"
    target_date = parse_job_target_date(str(job.get("target", "")))
    if job.get("status") != "Complete" and target_date and target_date.date() < datetime.now().date():
        return f"Stage overdue for target {job.get('target', '')}"
    return ""


def generate_handover_report(job: dict[str, Any]) -> str:
    return (
        f"Handover report for {job.get('site', job.get('id', 'installation'))}\n"
        f"Crew: {job.get('crew', 'Unassigned')}\n"
        f"Installed unit: {job.get('type', 'Lift')}\n"
        "Status: Final inspection passed\n"
        "Customer orientation, site handover, and punch-list closure completed."
    )


def generate_warranty_registration(job: dict[str, Any]) -> str:
    return (
        f"Warranty registration for {job.get('site', job.get('id', 'installation'))}\n"
        f"Unit type: {job.get('type', 'Lift')}\n"
        f"Commissioned by: {job.get('crew', 'FUZI Install Team')}\n"
        f"Registered on: {now_stamp()}"
    )


def build_install_job_view(job: dict[str, Any]) -> dict[str, Any]:
    stage_count = len(job.get("stages", [])) or 1
    done_count = sum(1 for stage in job.get("stages", []) if stage.get("status") == "Done")
    active_stage = current_install_stage(job)
    guidance = install_stage_guidance(str(active_stage.get("id", "")))
    progress = round(done_count / stage_count * 100)
    stage_flag = install_stage_flag(job, active_stage)
    return {
        **job,
        "progress": progress,
        "current_stage": guidance["name"],
        "current_stage_checkpoint": guidance["checkpoint"],
        "current_stage_checks": guidance["checks"],
        "stage_flag": stage_flag,
        "handover_report": str(job.get("handover_report", "")),
        "warranty_registration": str(job.get("warranty_registration", "")),
    }


def sync_installation_snapshot(job: dict[str, Any]) -> None:
    job_view = build_install_job_view(job)
    progress = job_view["progress"]
    tone = "healthy" if job.get("status") == "Complete" else "critical" if job.get("status") == "Blocked" else "warning" if progress < 100 else "healthy"
    note = "Handover report and warranty registration generated" if job.get("status") == "Complete" else (job_view["stage_flag"] or f"Current stage: {job_view['current_stage']}")
    label = f"{job.get('site', 'Unknown site')} - {job.get('type', 'Installation')}"
    snapshot = next((item for item in OPERATIONS_STATE["installations"] if item.get("job") == label), None)
    payload = {"job": label, "stage": job_view["current_stage"] if job.get("status") != "Complete" else "Final inspection passed", "progress": progress, "tone": tone, "note": note}
    if snapshot is None:
        OPERATIONS_STATE["installations"].insert(0, payload)
    else:
        snapshot.update(payload)
    del OPERATIONS_STATE["installations"][8:]


def build_morning_brief() -> dict[str, Any]:
    fault_units = [item for item in OPERATIONS_STATE["fleet"] if fleet_item_needs_attention(item)]
    coverage_gaps = [member for member in INSTALL_TEAM if member.get("availability") in {"Off Duty", "Blocked"}]
    sla_risks = [ticket for ticket in PROJECT_TICKETS if ticket.get("priority") == "High" and ticket.get("status") in {"Open", "Blocked", "In Progress"}]
    blocked_parts_orders = [
        project
        for project in OPERATIONS_STATE["projects"]
        if project.get("stage") == "Parts order" and project.get("risk") in {"Blocked", "At risk"}
    ]
    summary = (
        f"FUZI brief: {len(fault_units)} units in fault/watch, {len(coverage_gaps)} coverage gaps, "
        f"{len(sla_risks)} SLA risks, {len(blocked_parts_orders)} blocked parts orders."
    )
    details = [
        f"Fault units: {', '.join(item['unit'] for item in fault_units[:4]) or 'None'}",
        f"Coverage gaps: {', '.join(member['name'] for member in coverage_gaps[:4]) or 'None'}",
        f"SLA risks: {', '.join(ticket['id'] for ticket in sla_risks[:4]) or 'None'}",
        "Blocked parts: " + (
            ", ".join(
                f"{project['name']} ({project['risk']})"
                for project in blocked_parts_orders[:4]
            )
            or "None"
        ),
    ]
    return {"summary": summary, "details": details, "created_at": now_stamp()}


def build_modernization_flag() -> dict[str, Any]:
    flagged_projects = [project for project in OPERATIONS_STATE["projects"] if project.get("risk") in {"Blocked", "At risk"}]
    summary = (
        "No modernization blockers are active."
        if not flagged_projects
        else f"Modernization flag: {len(flagged_projects)} job{'s' if len(flagged_projects) != 1 else ''} blocked or at risk."
    )
    details = [
        f"{project['name']}: {project['stage']} ({project['risk']}) - owner {project['owner']}, due {project['due']}"
        for project in flagged_projects[:4]
    ]
    return {"summary": summary, "details": details, "flagged_projects": flagged_projects, "created_at": now_stamp()}


def send_modernization_flag(trigger: str) -> dict[str, Any]:
    flag = build_modernization_flag()
    delivery = send_openclaw_event(
        "modernization-flag",
        {
            "agent": "Modernization Project Coordinator",
            "trigger": trigger,
            "summary": flag["summary"],
            "details": flag["details"],
        },
    )
    send_business_channel_update(
        "FUZI_OPENCLAW_TARGET_MOD_SITE_VISIT",
        flag["summary"],
        [f"Trigger: {trigger}", *flag["details"]],
        event_type="modernization-site-visit",
    )
    with STATE_LOCK:
        if trigger == "scheduled" and delivery["ok"] and flag["flagged_projects"]:
            OPERATIONS_STATE["last_scheduled_modernization_flag_date"] = datetime.now().strftime("%Y-%m-%d")
        append_activity("Modernization Project Coordinator", flag["summary"])
        record_message(
            "Modernization Coordinator",
            "Blocked jobs",
            "Sent" if delivery["ok"] else "Delivery failed",
            flag["summary"],
        )
        save_operations_state()
    return {"flag": flag, "delivery": delivery}


def send_morning_brief(trigger: str) -> dict[str, Any]:
    brief = build_morning_brief()
    target_phone = resolve_morning_brief_phone()
    delivery = send_openclaw_event(
        "morning-brief",
        {
            "agent": "Morning Operations Brief",
            "trigger": trigger,
            "target": "daily operations recipient",
            "target_phone": target_phone,
            "summary": brief["summary"],
            "details": brief["details"],
        },
    )
    with STATE_LOCK:
        OPERATIONS_STATE["brief_history"].insert(0, brief)
        del OPERATIONS_STATE["brief_history"][10:]
        if trigger == "scheduled" and delivery["ok"]:
            OPERATIONS_STATE["last_scheduled_morning_brief_date"] = datetime.now().strftime("%Y-%m-%d")
        append_activity("Morning Operations Brief", brief["summary"])
        record_message("SMS", "Operations Bot", "Sent" if delivery["ok"] else "Delivery failed", brief["summary"])
        save_operations_state()
    return {"brief": brief, "delivery": delivery}


def ensure_fleet_ticket(unit: str, trigger: str) -> dict[str, Any] | None:
    with STATE_LOCK:
        item = find_fleet_item(unit)
        if item is None or not fleet_item_needs_attention(item):
            return None
        current_ticket = open_ticket_for(str(item.get("ticket", "")))
        if current_ticket is not None:
            return current_ticket
        reason = fleet_alert_reason(item)
        ticket = create_auto_ticket(
            item.get("site", unit),
            f"{unit} auto-monitor alert",
            item.get("owner", "On-call tech"),
            "High",
            "Now",
            f"Self-healing fleet monitor detected {reason}. Trigger: {trigger}.",
        )
        item["ticket"] = ticket["id"]
        item["status"] = "Fault"
        item["severity"] = "critical"
        item["last_alerted_at"] = now_stamp()
        record_message("System", unit, "Escalated", f"Ticket {ticket['id']} created for {reason}.")
        append_activity("Self-Healing Fleet Monitor", f"{ticket['id']} opened for {unit}: {reason}")
        sync_projects_from_tickets()
        save_operations_state()
        return ticket


def should_send_fleet_notification(item: dict[str, Any], ticket_id: str, trigger: str, force: bool = False) -> bool:
    if force or trigger == "manual":
        return True
    return str(item.get("last_notified_ticket", "")).strip() != ticket_id


def notify_on_call(unit: str, trigger: str, force: bool = False) -> dict[str, Any]:
    item = find_fleet_item(unit)
    if item is None:
        return {"ok": False, "message": f"{unit} was not found in the fleet monitor."}
    ticket = ensure_fleet_ticket(unit, trigger)
    ticket_id = ticket.get("id") if ticket else str(item.get("ticket", "")).strip()
    if not ticket_id or ticket_id == "-":
        return {"ok": False, "message": f"{unit} does not have an active ticket yet."}
    if not should_send_fleet_notification(item, ticket_id, trigger, force=force):
        return {"ok": True, "delivery": None, "ticket": ticket or open_ticket_for(ticket_id), "skipped": True}
    payload = {
        "agent": "Self-Healing Fleet Monitor",
        "trigger": trigger,
        "unit": unit,
        "site": item.get("site"),
        "ticket": ticket_id,
        "target_phone": item.get("on_call_phone"),
        "message": f"{unit} at {item.get('site')} needs attention: {fleet_alert_reason(item)}.",
    }
    delivery = send_openclaw_event("technician-alert", payload)
    with STATE_LOCK:
        item["last_notified_at"] = now_stamp()
        item["last_notified_ticket"] = ticket_id
        append_activity("Self-Healing Fleet Monitor", f"Tech alert sent for {unit}")
        record_message("SMS", unit, "Sent" if delivery["ok"] else "Delivery failed", f"On-call tech notified for {ticket_id}.")
        save_operations_state()
    return {"ok": True, "delivery": delivery, "ticket": ticket or open_ticket_for(ticket_id)}


def draft_renewal_outreach() -> dict[str, Any]:
    candidates = []
    drafts = []
    with STATE_LOCK:
        for renewal in OPERATIONS_STATE["renewals"]:
            if int(renewal.get("days", 999)) > 60 or renewal.get("contacted"):
                continue
            candidates.append(renewal)
            draft = (
                f"Subject: FUZI maintenance renewal for {renewal['building']}\n\n"
                f"Your contract renews in {renewal['days']} days. We can review uptime, parts coverage, and SLA options this week."
            )
            renewal["last_draft"] = draft
            drafts.append({"building": renewal["building"], "email": renewal.get("contact_email", ""), "draft": draft})
        if drafts:
            append_activity("Contract Renewal CRM Agent", f"Prepared {len(drafts)} outreach drafts")
            record_message("Email", "CRM Agent", "Drafted", f"Prepared renewal outreach for {', '.join(item['building'] for item in drafts[:3])}.")
            save_operations_state()
    delivery = send_openclaw_event("renewal-outreach", {"agent": "Contract Renewal CRM Agent", "drafts": drafts}) if drafts else {"ok": True, "status": 204, "body": "No renewals due.", "url": build_openclaw_url()}
    return {"candidates": candidates, "drafts": drafts, "delivery": delivery}


def answer_crm_query(question: str) -> dict[str, Any]:
    normalized = re.sub(r"\s+", " ", question.strip().lower())
    renewals = sorted(
        [renewal for renewal in OPERATIONS_STATE["renewals"] if int(renewal.get("days", 999)) <= 60],
        key=lambda renewal: int(renewal.get("days", 999)),
    )
    uncontacted = [renewal for renewal in renewals if not renewal.get("contacted")]

    if any(token in normalized for token in ("not contacted", "haven't been contacted", "have not been contacted", "uncontacted")):
        summary = f"{len(uncontacted)} building{'s' if len(uncontacted) != 1 else ''} renew in the next 60 days and still need outreach."
        details = [
            f"{renewal['building']} renews in {renewal['days']} days and has not been contacted yet ({renewal.get('contact_email', 'no email on file')})."
            for renewal in uncontacted[:5]
        ] or ["No buildings renew in the next 60 days without outreach."]
        return {"summary": summary, "details": details}

    if "next 60 days" in normalized or "renew" in normalized:
        summary = f"{len(renewals)} building{'s' if len(renewals) != 1 else ''} renew in the next 60 days."
        details = [
            f"{renewal['building']} renews in {renewal['days']} days ({'contacted' if renewal.get('contacted') else 'not contacted'})."
            for renewal in renewals[:5]
        ] or ["No buildings renew in the next 60 days."]
        return {"summary": summary, "details": details}

    return {
        "summary": "CRM Query Agent currently supports renewal questions about the next 60 days and contact status.",
        "details": [
            "Try: Which buildings renew in the next 60 days and haven't been contacted?",
        ],
    }


def send_crm_query_result(question: str) -> dict[str, Any]:
    answer = answer_crm_query(question)
    delivery = send_openclaw_event(
        "crm-query",
        {
            "agent": "CRM Query Agent",
            "question": question,
            "summary": answer["summary"],
            "details": answer["details"],
        },
    )
    with STATE_LOCK:
        append_activity("CRM Query Agent", answer["summary"])
        record_message("CRM Query", "Renewals", "Sent" if delivery.get("ok") else "Delivery failed", answer["summary"])
        save_operations_state()
    return {"answer": answer, "delivery": delivery}


def infer_walkthrough_urgency(notes: str) -> str:
    normalized = notes.lower()
    if any(token in normalized for token in ("passenger", "unsafe", "trapped", "today", "immediate", "urgent", "fault repeats")):
        return "Urgent"
    if any(token in normalized for token in ("this week", "monitor", "noisy", "warning", "soon")):
        return "Medium"
    return "Low"


def split_walkthrough_sentences(notes: str) -> list[str]:
    return [segment.strip(" .") for segment in re.split(r"(?<=[.!?])\s+", notes.strip()) if segment.strip()]


def extract_parts_needed(notes: str) -> list[str]:
    known_parts = [
        "D14 contact kit",
        "roller set",
        "fan assembly",
        "sensor harness",
        "comb plate sensor",
        "door lock contact",
    ]
    found = [part for part in known_parts if part.lower() in notes.lower()]
    if found:
        return found
    match = re.search(r"order ([^.]+)", notes, flags=re.IGNORECASE)
    if not match:
        return []
    return [item.strip(" .") for item in re.split(r",| and ", match.group(1)) if item.strip()]


def extract_permits_needed(notes: str) -> list[str]:
    permits = []
    for sentence in split_walkthrough_sentences(notes):
        if "permit" in sentence.lower() or "inspection" in sentence.lower():
            permits.append(sentence)
    return permits


def structure_work_order(work_order: dict[str, Any]) -> dict[str, Any]:
    notes = str(work_order.get("walkthrough_notes") or work_order.get("body") or "").strip()
    sentences = split_walkthrough_sentences(notes)
    deficiencies: list[dict[str, str]] = []
    for sentence in sentences:
        lowered = sentence.lower()
        if any(token in lowered for token in ("replace", "intermittent", "out of line", "cleaning", "noisy", "monitor", "fault", "sensor", "cooling", "lock circuit")):
            deficiency_urgency = "Urgent" if any(token in lowered for token in ("passenger", "unsafe", "today", "immediate", "fault repeats")) else str(work_order.get("urgency") or infer_walkthrough_urgency(notes))
            deficiencies.append({"summary": sentence, "urgency": deficiency_urgency})

    if not deficiencies and notes:
        deficiencies.append({"summary": notes, "urgency": str(work_order.get("urgency") or infer_walkthrough_urgency(notes))})

    parts_needed = extract_parts_needed(notes)
    permits_needed = extract_permits_needed(notes)
    urgency = str(work_order.get("urgency") or infer_walkthrough_urgency(notes))
    body_sections = [
        "Deficiencies:",
        *[f"- [{item['urgency']}] {item['summary']}" for item in deficiencies[:4]],
        f"Parts needed: {', '.join(parts_needed) if parts_needed else 'None'}",
        f"Permits needed: {'; '.join(permits_needed) if permits_needed else 'None'}",
    ]

    structured = dict(work_order)
    structured["urgency"] = urgency
    structured["deficiencies"] = deficiencies
    structured["parts_needed"] = parts_needed
    structured["permits_needed"] = permits_needed
    structured["body"] = "\n".join(body_sections)
    return structured


def ensure_work_order_defaults() -> None:
    default_notes = {
        "WO-701": "After the visit, the technician reported that the landing door lock circuit is intermittent, the sill is out of line, and passengers could get delayed if the fault repeats. Replace the D14 contact kit and roller set today. No permit is needed.",
        "WO-702": "Tech voice note: comb plate sensors need cleaning, drive cooling fans are noisy, and the recurrence should be monitored this week. Order a fan assembly and sensor harness. Night-access permit from mall facilities is required before work starts.",
    }
    for order in OPERATIONS_STATE.get("work_orders", []):
        if not order.get("walkthrough_notes") and order.get("id") in default_notes:
            order["walkthrough_notes"] = default_notes[order["id"]]


def push_work_order() -> dict[str, Any]:
    with STATE_LOCK:
        ensure_work_order_defaults()
        work_order = next((item for item in OPERATIONS_STATE["work_orders"] if item.get("status") != "Pushed"), None)
        if work_order is None:
            return {"ok": False, "message": "No work order is ready to push."}
        work_order.update(structure_work_order(work_order))
        work_order["status"] = "Pushed"
        work_order["pushed_at"] = now_stamp()
        append_activity("Site Walkthrough to Work Order", f"{work_order['id']} pushed to FSM")
        record_message("FSM", work_order["title"], "Pushed", f"{work_order['id']} sent to dispatch queue.")
        save_operations_state()
    delivery = send_openclaw_event("work-order", {"agent": "Site Walkthrough to Work Order", "work_order": work_order})
    return {"ok": True, "work_order": work_order, "delivery": delivery}


def dashboard_parts_stockout_items() -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    seen: set[str] = set()

    for project in OPERATIONS_STATE["projects"]:
        if project.get("stage") != "Parts order" or project.get("risk") not in {"Blocked", "At risk"}:
            continue
        name = str(project.get("name", "")).strip()
        if not name or name in seen:
            continue
        seen.add(name)
        items.append(
            {
                "name": name,
                "status": str(project.get("risk", "Blocked")),
                "detail": f"{project.get('stage', 'Parts order')} - owner {project.get('owner', 'Unassigned')}, due {project.get('due', 'TBD')}",
                "source": "ERP",
            }
        )

    for ticket in PROJECT_TICKETS:
        context = f"{ticket.get('title', '')} {ticket.get('notes', '')}".lower()
        if "stock is zero" not in context and "stockout" not in context:
            continue
        name = str(ticket.get("project", ticket.get("title", ""))).strip()
        if not name or name in seen:
            continue
        seen.add(name)
        items.append(
            {
                "name": name,
                "status": str(ticket.get("status", "Open")),
                "detail": f"{ticket.get('id', 'Ticket')} - {ticket.get('title', 'ERP stock issue')}",
                "source": "ERP",
            }
        )

    return items


def build_live_operations_overview() -> dict[str, Any]:
    fault_units = [item for item in OPERATIONS_STATE["fleet"] if fleet_item_needs_attention(item)]
    open_tickets = [ticket for ticket in PROJECT_TICKETS if ticket.get("status") != "Closed"]
    sla_risks = [ticket for ticket in open_tickets if ticket.get("priority") == "High" and ticket.get("status") in {"Open", "Blocked", "In Progress"}]
    parts_stockouts = dashboard_parts_stockout_items()
    upcoming_renewals = sorted(
        [renewal for renewal in OPERATIONS_STATE["renewals"] if int(renewal.get("days", 999)) <= 60],
        key=lambda renewal: int(renewal.get("days", 999)),
    )
    total_units = len(OPERATIONS_STATE["fleet"])
    healthy_units = total_units - len(fault_units)
    fleet_health_percent = round((healthy_units / total_units) * 100) if total_units else 100
    renewals_next_30 = sum(1 for renewal in upcoming_renewals if int(renewal.get("days", 999)) <= 30)
    renewals_needing_outreach = [renewal for renewal in upcoming_renewals if not renewal.get("contacted")]

    return {
        "fleet_health_percent": fleet_health_percent,
        "fault_units": fault_units,
        "open_tickets": open_tickets,
        "sla_risks": sla_risks,
        "parts_stockouts": parts_stockouts,
        "upcoming_renewals": upcoming_renewals,
        "renewals_next_30": renewals_next_30,
        "renewals_needing_outreach": renewals_needing_outreach,
        "sources": ["FSM", "ERP", "CRM"],
    }


def build_dashboard_snapshot() -> dict[str, Any]:
    overview = build_live_operations_overview()
    blocked_projects = [project for project in OPERATIONS_STATE["projects"] if project.get("risk") in {"Blocked", "At risk"}]
    return {
        "fleet_alerts": len(overview["fault_units"]),
        "open_tickets": len(overview["open_tickets"]),
        "parts_stockouts": len(overview["parts_stockouts"]),
        "blocked_projects": len(blocked_projects),
        "renewals_due": len(overview["upcoming_renewals"]),
        "coverage_gaps": sum(1 for member in INSTALL_TEAM if member.get("availability") in {"Off Duty", "Blocked"}),
    }


def send_dashboard_snapshot(trigger: str) -> dict[str, Any]:
    snapshot = build_dashboard_snapshot()
    delivery = send_openclaw_event(
        "dashboard-snapshot",
        {
            "agent": "Live Operations Dashboard",
            "trigger": trigger,
            "snapshot": snapshot,
        },
    )
    with STATE_LOCK:
        append_activity("Live Operations Dashboard", f"Snapshot sent with {snapshot['fleet_alerts']} fleet alerts and {snapshot['open_tickets']} open tickets")
        save_operations_state()
    return {"snapshot": snapshot, "delivery": delivery}


def route_customer_service_messages(trigger: str) -> dict[str, Any]:
    urgent_messages: list[dict[str, Any]] = []
    routine_messages: list[dict[str, Any]] = []
    already_triaged = 0

    with STATE_LOCK:
        ensure_customer_service_inbox_messages()
        for message in OPERATIONS_STATE["messages"]:
            if not customer_message_is_inbound(message):
                continue
            if customer_message_needs_triage(message):
                if customer_message_is_emergency(message):
                    message["state"] = "Escalated"
                    message["reply"] = "Emergency received. The on-call team has been notified and a supervisor will contact the building immediately."
                    urgent_messages.append(message)
                else:
                    message["state"] = "Auto-answered"
                    message["reply"] = build_routine_customer_reply(message)
                    routine_messages.append(message)
                message["triaged_at"] = now_stamp()
            else:
                already_triaged += 1

        save_operations_state()

    emergency_delivery = {"ok": True, "status": 204, "body": "No emergency escalation needed.", "url": build_openclaw_endpoint("/tools/invoke")}
    if urgent_messages:
        emergency_delivery = send_openclaw_event(
            "technician-alert",
            {
                "agent": "24/7 Customer Service Agent",
                "trigger": trigger,
                "target_phone": default_on_call_phone(),
                "message": build_customer_emergency_alert(urgent_messages),
            },
        )

    payload = {
        "agent": "24/7 Customer Service Agent",
        "trigger": trigger,
        "urgent_messages": urgent_messages,
        "routine_messages": routine_messages[:3],
        "summary": {
            "urgent": len(urgent_messages),
            "routine": len(routine_messages),
        },
    }
    delivery = send_openclaw_event("customer-service", payload)
    with STATE_LOCK:
        summary_bits = []
        if urgent_messages:
            summary_bits.append(f"Escalated {len(urgent_messages)} emergency customer message{'s' if len(urgent_messages) != 1 else ''}")
        if routine_messages:
            summary_bits.append(f"auto-answered {len(routine_messages)} routine message{'s' if len(routine_messages) != 1 else ''}")
        if not summary_bits:
            summary = f"Inbox already covered; {already_triaged} message{'s' if already_triaged != 1 else ''} were already triaged."
            record_message("Service Agent", "Inbound triage", "Reviewed", summary)
        else:
            summary = "; ".join(summary_bits).capitalize() + "."
            record_message("Service Agent", "Inbound triage", "Escalated" if urgent_messages else "Auto-answered", summary)
        append_activity("24/7 Customer Service Agent", summary)
        save_operations_state()
    combined_delivery = emergency_delivery if urgent_messages else delivery
    if delivery.get("ok") is False:
        combined_delivery = delivery
    return {"summary": summary, "delivery": combined_delivery, "summary_delivery": delivery, "emergency_delivery": emergency_delivery}


def agent_label_for(action: str, target: str) -> str:
    module_map = {
        "Elevator Modernization Management": "Modernization Project Coordinator",
        "Elevator Project Tracking": "Field Installation Manager",
        "Elevator MIS Reporting Dashboard": "Live Operations Dashboard",
        "selected fleet alert": "Self-Healing Fleet Monitor",
        "uncontacted renewals": "Contract Renewal CRM Agent",
        "FSM": "Site Walkthrough to Work Order",
    }
    action_map = {
        "Send SMS brief": "Morning Operations Brief",
        "Create ticket": "Self-Healing Fleet Monitor",
        "Text technician": "Self-Healing Fleet Monitor",
        "Flag blockers": "Modernization Project Coordinator",
        "Process inbox": "24/7 Customer Service Agent",
        "Draft outreach": "Contract Renewal CRM Agent",
        "Push work order": "Site Walkthrough to Work Order",
        "Escalate emergencies": "24/7 Customer Service Agent",
    }
    return action_map.get(action) or module_map.get(target) or "Live Operations Dashboard"


def handle_generic_action(action: str, target: str) -> dict[str, Any]:
    summary = f"{action} executed for {target}."
    agent = agent_label_for(action, target)
    delivery = send_openclaw_event("portal-action", {"agent": agent, "action": action, "target": target})
    with STATE_LOCK:
        append_activity(agent, summary)
        save_operations_state()
    return {"ok": True, "message": summary, "delivery": delivery}


def run_agent_cycle(trigger: str) -> None:
    with STATE_LOCK:
        sync_projects_from_tickets()
        for job in INSTALL_JOBS:
            sync_installation_snapshot(job)
        save_operations_state()

    alert_units = [
        str(item.get("unit", "")).strip()
        for item in sorted(
            (item for item in OPERATIONS_STATE["fleet"] if fleet_item_needs_attention(item)),
            key=fleet_attention_priority,
        )
    ]
    for unit in alert_units:
        notify_on_call(unit, trigger)

    now = datetime.now()
    today = now.strftime("%Y-%m-%d")
    if now.hour == 6 and now.minute >= 30:
        with STATE_LOCK:
            already_sent_today = OPERATIONS_STATE.get("last_scheduled_morning_brief_date", "") == today
            modernization_flag_sent_today = OPERATIONS_STATE.get("last_scheduled_modernization_flag_date", "") == today
        if not already_sent_today:
            send_morning_brief("scheduled")
        if not modernization_flag_sent_today and build_modernization_flag()["flagged_projects"]:
            send_modernization_flag("scheduled")


def background_monitor_loop() -> None:
    while True:
        try:
            run_agent_cycle("background")
        except Exception:
            pass
        threading.Event().wait(MONITOR_INTERVAL_SECONDS)


def discord_listener_loop() -> None:
    while True:
        try:
            poll_crm_query_discord_channel()
        except Exception:
            pass
        try:
            poll_breakdown_discord_channel()
        except Exception:
            pass
        threading.Event().wait(DISCORD_POLL_INTERVAL_SECONDS)


def ensure_background_monitor() -> None:
    with STATE_LOCK:
        start_scheduler = not RUNTIME_STATE["scheduler_started"]
        start_discord_listener = not RUNTIME_STATE["discord_listener_started"] and acquire_discord_listener_lock()
        if start_scheduler:
            RUNTIME_STATE["scheduler_started"] = True
        if start_discord_listener:
            RUNTIME_STATE["discord_listener_started"] = True
    if start_scheduler:
        thread = threading.Thread(target=background_monitor_loop, name="fuzi-agent-monitor", daemon=True)
        thread.start()
    if start_discord_listener:
        synchronize_breakdown_cursor()
        thread = threading.Thread(target=discord_listener_loop, name="fuzi-discord-listener", daemon=True)
        thread.start()


def public_user(user: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in user.items() if key != "password_hash"}


def current_user() -> dict[str, Any] | None:
    username = session.get("portal_user", "")
    return next((user for user in USERS if user.get("username") == username), None)


def department_lead_name(department: str) -> str:
    active_users = [user for user in USERS if user.get("active", True) and user.get("department") == department]
    for role in ("manager", "admin", "technician"):
        owner = next((user for user in active_users if user.get("role") == role), None)
        if owner is not None:
            return str(owner.get("display_name", owner.get("username", "Unassigned")))
    return "Unassigned"


def build_executive_summary(overview: dict[str, Any], install_jobs_view: list[dict[str, Any]], inventory_insights: dict[str, Any]) -> dict[str, Any]:
    at_risk_projects = [project for project in OPERATIONS_STATE["projects"] if project.get("risk") in {"Blocked", "At risk"}]
    blocked_installs = [job for job in install_jobs_view if job.get("status") == "Blocked"]
    overdue_installs = [job for job in install_jobs_view if "overdue" in str(job.get("stage_flag", "")).lower()]
    inbox_needing_triage = [message for message in OPERATIONS_STATE["messages"] if customer_message_needs_triage(message)]
    critical_shortages = [item for item in inventory_insights.get("shortages", []) if item.get("status") == "Out of Stock"]
    departments = [
        {
            "name": "Service Control",
            "lead": department_lead_name("Service Control"),
            "tone": "critical" if overview["fault_units"] else "healthy",
            "status": "Critical Watch" if overview["fault_units"] else "Healthy",
            "detail": f"{len(overview['fault_units'])} fault/watch units and {len(overview['sla_risks'])} SLA risks need dispatch oversight.",
            "next_step": "Prioritize trapped or faulted units and close the oldest SLA risks first.",
        },
        {
            "name": "Project Office",
            "lead": department_lead_name("Project Office"),
            "tone": "warning" if at_risk_projects or overview["open_tickets"] else "healthy",
            "status": "Owner review" if at_risk_projects else "Healthy",
            "detail": f"{len(at_risk_projects)} at-risk or blocked projects and {len(overview['open_tickets'])} open tickets are in flight.",
            "next_step": "Clear permit, supplier, and inspection blockers before they age into SLA misses.",
        },
        {
            "name": "Install Operations",
            "lead": department_lead_name("Install Operations"),
            "tone": "critical" if blocked_installs else "warning" if overdue_installs else "healthy",
            "status": "Crew blocked" if blocked_installs else "Schedule slip" if overdue_installs else "Healthy",
            "detail": f"{len(blocked_installs)} blocked installs and {len(overdue_installs)} overdue stage targets across {sum(1 for job in install_jobs_view if job.get('status') != 'Complete')} active jobs.",
            "next_step": "Escalate blocked sites immediately and reassign labor where overdue stages are compounding.",
        },
        {
            "name": "Stores & Procurement",
            "lead": department_lead_name("Stores & Procurement"),
            "tone": "critical" if inventory_insights["health"]["out_of_stock"] else "warning" if inventory_insights["health"]["low_stock"] else "healthy",
            "status": "Restock now" if inventory_insights["health"]["out_of_stock"] else "Stock watch" if inventory_insights["health"]["low_stock"] else "Healthy",
            "detail": f"{inventory_insights['health']['out_of_stock']} stockouts, {inventory_insights['health']['low_stock']} low-stock items, and {len(critical_shortages)} active-job shortages.",
            "next_step": "Raise purchase orders for constrained parts before install and service jobs slip.",
        },
        {
            "name": "Sales & Renewals",
            "lead": department_lead_name("Sales & Renewals"),
            "tone": "warning" if overview["renewals_needing_outreach"] else "healthy",
            "status": "Outreach due" if overview["renewals_needing_outreach"] else "Healthy",
            "detail": f"{len(overview['renewals_needing_outreach'])} renewals in the next 60 days still need outreach.",
            "next_step": "Call high-value buildings first and convert drafts into owner-approved outreach today.",
        },
        {
            "name": "Customer Success",
            "lead": department_lead_name("Customer Success"),
            "tone": "warning" if inbox_needing_triage else "healthy",
            "status": "Inbox backlog" if inbox_needing_triage else "Healthy",
            "detail": f"{len(inbox_needing_triage)} inbound customer messages still need triage or a routed reply.",
            "next_step": "Answer inbound updates quickly so service and renewal issues do not escalate into churn risk.",
        },
    ]
    attention_count = sum(1 for item in departments if item["tone"] != "healthy")
    watchlist = [
        {
            "title": "Operational pressure",
            "detail": f"{len(overview['fault_units'])} fleet alerts, {len(at_risk_projects)} project blockers, and {len(overdue_installs)} overdue install stages need leadership follow-through.",
            "tone": "critical" if overview["fault_units"] or blocked_installs else "warning",
        },
        {
            "title": "Revenue protection",
            "detail": f"{len(overview['renewals_needing_outreach'])} uncontacted renewals and {inventory_insights['health']['out_of_stock']} stockouts can delay revenue and renewals if left unattended.",
            "tone": "warning" if overview["renewals_needing_outreach"] or inventory_insights["health"]["out_of_stock"] else "healthy",
        },
        {
            "title": "Department ownership",
            "detail": f"Managers can now be assigned by department so the owner sees who is accountable for service, projects, installs, stores, renewals, and customer success.",
            "tone": "info",
        },
    ]
    return {
        "headline": f"{attention_count} department{'s' if attention_count != 1 else ''} need owner attention today.",
        "subheadline": "Use this control tower to see who owns each department and what action should happen next.",
        "departments": departments,
        "watchlist": watchlist,
    }


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not session.get("portal_user"):
            return redirect(url_for("login", next=request.path))
        user = current_user()
        if user is None:
            session.clear()
            return redirect(url_for("login", next=request.path))
        if user.get("must_change_password") and request.endpoint not in {"force_password_change", "logout"}:
            if request.path.startswith("/api/"):
                return jsonify({"ok": False, "message": "Password change required before using the portal."}), 403
            return redirect(url_for("force_password_change"))
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
    run_agent_cycle("portal-data")
    org_chart = refresh_org_chart()
    with STATE_LOCK:
        ensure_customer_service_inbox_messages()
        ensure_work_order_defaults()
        save_operations_state()
    overview = build_live_operations_overview()
    open_ticket_count = len(overview["open_tickets"])
    blocked_ticket_count = sum(1 for ticket in overview["open_tickets"] if ticket["status"] == "Blocked")
    install_jobs_view = [build_install_job_view(job) for job in INSTALL_JOBS]
    inventory_insights = inventory_ai_insights()
    viewer = current_user() or {"role": session.get("portal_role", "technician"), "department": "", "display_name": session.get("portal_name", "")}
    access = access_profile_for_user(viewer)
    return {
        "metrics": [
            {"label": "Fleet Health", "value": str(overview["fleet_health_percent"]), "delta": f"{len(overview['fault_units'])} units in fault/watch", "tone": "good" if not overview["fault_units"] else "warn", "detail": "FSM health rollup from live unit faults, temperatures, and cycle alerts"},
            {"label": "Open Tickets", "value": str(open_ticket_count), "delta": f"{len(overview['sla_risks'])} SLA risks", "tone": "warn" if overview["sla_risks"] else "good", "detail": "FSM and project-office queue for open, blocked, and in-progress tickets"},
            {"label": "Parts Stockouts", "value": str(len(overview["parts_stockouts"])), "delta": f"{blocked_ticket_count} blocked follow-ups", "tone": "warn" if overview["parts_stockouts"] else "good", "detail": "ERP zero-stock signals and blocked parts-order jobs"},
            {"label": "Upcoming Renewals", "value": str(len(overview["upcoming_renewals"])), "delta": f"{overview['renewals_next_30']} due in 30 days", "tone": "warn" if overview["renewals_next_30"] else "info", "detail": "CRM contract renewals due within the next 60 days"},
        ],
        "dashboard_overview": overview,
        "refresh_interval_minutes": REFRESH_INTERVAL_MINUTES,
        "fleet": OPERATIONS_STATE["fleet"],
        "projects": OPERATIONS_STATE["projects"],
        "installations": OPERATIONS_STATE["installations"],
        "messages": OPERATIONS_STATE["messages"],
        "renewals": OPERATIONS_STATE["renewals"],
        "work_orders": OPERATIONS_STATE["work_orders"],
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
        "connector_status": OPERATIONS_STATE["connector_status"],
        "activity_log": OPERATIONS_STATE["activity_log"],
        "inventory": INVENTORY,
        "inventory_insights": inventory_insights,
        "executive_summary": build_executive_summary(overview, install_jobs_view, inventory_insights),
        "viewer": public_user(normalize_user_record(viewer)),
        "access": access,
        "department_options": DEPARTMENT_OPTIONS,
        "org_chart": org_chart,
        "attendance_today": [r for r in ATTENDANCE if r.get("date") == datetime.now().strftime("%Y-%m-%d")],
        "estimates": ESTIMATES,
        "payments": PAYMENTS,
        "payment_statuses": list(PAYMENT_STATUSES),
        "payment_methods": list(PAYMENT_METHODS),
        "elevator_types": ELEVATOR_TYPES,
        "capacity_options": PASSENGER_CAPACITY_OPTIONS,
        "goods_capacity_options": GOODS_CAPACITY_OPTIONS,
        "speed_options": SPEED_OPTIONS,
        "motor_options": MOTOR_OPTIONS,
        "finish_options": FINISH_OPTIONS,
        "door_options": DOOR_OPTIONS,
        "door_construction_options": DOOR_CONSTRUCTION_OPTIONS,
        "door_panel_options": DOOR_PANEL_OPTIONS,
        "door_opening_type_options": DOOR_OPENING_TYPE_OPTIONS,
        "door_vision_options": DOOR_VISION_OPTIONS,
        "door_width_options": DOOR_WIDTH_OPTIONS,
        "door_height_options": DOOR_HEIGHT_OPTIONS,
        "door_arrangement_options": DOOR_ARRANGEMENT_OPTIONS,
        "make_options": MAKE_OPTIONS,
        "control_options": CONTROL_OPTIONS,
        "addon_options": list(ADDON_COSTS.keys()),
        "customer_users": [_public_customer_user(u) for u in CUSTOMER_USERS],
        "sales_inquiries": SALES_INQUIRIES,
        "sales_admin_panel": build_sales_admin_panel(),
        "breakdowns": BREAKDOWNS,
        "service_records": SERVICE_RECORDS,
        "gad_records": GAD_RECORDS,
        "commissionings": COMMISSIONINGS,
        "factory_jobs": FACTORY_JOBS,
        "tenders": TENDERS,
        "dept_comms": DEPT_COMMS,
        "user_dept": session.get("portal_department", ""),
    }


@app.before_request
def start_background_agents() -> None:
    ensure_background_monitor()


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
    return next_user_id_for(USERS)


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
            access = access_profile_for_user(user)
            session["portal_user"] = user["username"]
            session["portal_role"] = user.get("role", "technician")
            session["portal_name"] = user.get("display_name", user["username"])
            session["portal_department"] = user.get("department", "")
            session["post_password_change_view"] = access["default_view"]
            if user.get("must_change_password"):
                return redirect(url_for("force_password_change"))
            next_url = request.args.get("next")
            if next_url:
                return redirect(next_url)
            return redirect(url_for("dashboard", view=access["default_view"]))
        error = "Invalid username or password."
    return render_template("login.html", error=error, login_accounts=login_account_shortcuts())


@app.route("/portal/force-password-change", methods=["GET", "POST"])
@login_required
def force_password_change():
    user = current_user()
    if user is None:
        session.clear()
        return redirect(url_for("login"))
    if not user.get("must_change_password"):
        return redirect(url_for("dashboard", view=session.get("post_password_change_view", "overview")))

    error = None
    if request.method == "POST":
        current_password = request.form.get("current_password", "")
        new_password = request.form.get("new_password", "")
        confirm_password = request.form.get("confirm_password", "")

        if not check_password_hash(user.get("password_hash", ""), current_password):
            error = "Current password is incorrect."
        elif len(new_password) < 10:
            error = "New password must be at least 10 characters long."
        elif new_password != confirm_password:
            error = "New password and confirmation do not match."
        elif new_password == current_password:
            error = "Choose a different password for operational use."
        else:
            user["password_hash"] = generate_password_hash(new_password)
            user["must_change_password"] = False
            save_users()
            session["portal_name"] = user.get("display_name", user["username"])
            session["portal_role"] = user.get("role", "technician")
            session["portal_department"] = user.get("department", "")
            return redirect(url_for("dashboard", view=session.get("post_password_change_view", "overview")))

    return render_template(
        "login.html",
        error=error,
        password_change_required=True,
        user_display_name=user.get("display_name", user.get("username", "Portal user")),
        username=user.get("username", ""),
    )


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
    dashboard_delivery = send_dashboard_snapshot("refresh")
    data["synced_at"] = datetime.now().strftime("%I:%M:%S %p")
    data["dashboard_delivery"] = dashboard_delivery["delivery"]
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
    job["last_stage_update"] = now_stamp()
    done_count = sum(1 for item in job["stages"] if item["status"] == "Done")
    blocked_count = sum(1 for item in job["stages"] if item["status"] == "Blocked")
    if done_count == len(job["stages"]):
        job["status"] = "Complete"
        job["handover_report"] = generate_handover_report(job)
        job["warranty_registration"] = generate_warranty_registration(job)
    elif blocked_count:
        job["status"] = "Blocked"
    else:
        job["status"] = "In Progress"

    save_install_jobs()
    with STATE_LOCK:
        sync_installation_snapshot(job)
        save_operations_state()

    send_business_channel_update(
        "FUZI_OPENCLAW_TARGET_INSTALL_LOCATION_CUSTOMERS",
        f"Install location update for {job.get('site', job_id)}.",
        [
            f"Job {job_id} is now {job.get('status', 'In Progress')}.",
            f"Stage: {install_stage_guidance(stage_id).get('name', stage_id)} marked {status}.",
            f"Crew: {job.get('crew', 'Unassigned')}.",
            f"Target date: {job.get('target', 'TBD')}.",
        ],
        event_type="install-location-update",
    )

    if job["status"] == "Complete":
        delivery = send_openclaw_event(
            "installation-complete",
            {
                "agent": "Field Installation Manager",
                "job_id": job_id,
                "site": job.get("site"),
                "crew": job.get("crew"),
                "message": f"{job.get('site')} passed final inspection. Handover report and warranty registration are ready.",
            },
        )
        with STATE_LOCK:
            append_activity("Field Installation Manager", f"{job_id} completed and handover sent")
            record_message("Install Ops", job.get("site", job_id), "Completed", "Final inspection signed off and office notified.")
            save_operations_state()
        message = f"{job_id} completed. Final inspection notice sent."
        return jsonify({"ok": True, "job": job, "message": message, "delivery": delivery, "refresh": True})

    stage_view = install_stage_guidance(stage_id)
    stage_message = f"{job_id} {stage_view['name']} marked {status}."
    if job["status"] == "Blocked":
        stage_message = f"{job_id} crew is stuck at {stage_view['name']}."
    elif install_stage_flag(job, stage):
        stage_message = f"{job_id} updated; {install_stage_flag(job, stage).lower()}."
    return jsonify({"ok": True, "job": job, "message": stage_message, "refresh": True})


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
    linked_team_member = payload.get("linked_team_member", "").strip()
    department = normalize_department(payload.get("department", ""), role, linked_team_member)

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
        "department": department,
        "linked_team_member": linked_team_member,
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
    if "department" in payload or "role" in payload or "linked_team_member" in payload:
        user["department"] = normalize_department(payload.get("department", user.get("department", "")), user.get("role", "technician"), user.get("linked_team_member", ""))
    if "active" in payload:
        user["active"] = bool(payload["active"])
    if "must_change_password" in payload:
        user["must_change_password"] = bool(payload["must_change_password"])
    if payload.get("password"):
        user["password_hash"] = generate_password_hash(str(payload["password"]))
        user["must_change_password"] = bool(payload.get("must_change_password", True))

    if session.get("portal_user") == user.get("username"):
        session["portal_role"] = user.get("role", session.get("portal_role", "technician"))
        session["portal_name"] = user.get("display_name", session.get("portal_name", user.get("username", "")))
        session["portal_department"] = user.get("department", session.get("portal_department", ""))

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
    send_business_channel_update(
        "FUZI_OPENCLAW_TARGET_INSTALL_LOCATION_CUSTOMERS",
        f"Customer site added for {customer['name']}.",
        [
            f"Address: {customer.get('address', 'Not provided') or 'Not provided'}.",
            f"Contact: {customer.get('contact_person', 'Not provided') or 'Not provided'}.",
            f"Segment: {customer.get('segment', 'Not specified') or 'Not specified'}.",
        ],
        event_type="customer-location-update",
    )
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
    send_business_channel_update(
        "FUZI_OPENCLAW_TARGET_INSTALL_LOCATION_CUSTOMERS",
        f"Customer site updated for {customer['name']}.",
        [
            f"Address: {customer.get('address', 'Not provided') or 'Not provided'}.",
            f"Status: {customer.get('status', 'Active') or 'Active'}.",
            f"Renewal date: {customer.get('renewal_date', 'Not set') or 'Not set'}.",
        ],
        event_type="customer-location-update",
    )
    return jsonify({"ok": True, "customer": customer, "message": f"{customer['name']} updated."})


@app.post("/api/portal/action")
@login_required
def api_action():
    payload = request.get_json(silent=True) or {}
    action = str(payload.get("action", "Action")).strip() or "Action"
    target = str(payload.get("target", "selected item")).strip() or "selected item"

    if action == "Send SMS brief":
        result = send_morning_brief("manual")
        return jsonify(
            {
                "ok": True,
                "message": result["brief"]["summary"],
                "timestamp": datetime.now().strftime("%I:%M:%S %p"),
                "delivery": result["delivery"],
                "refresh": True,
            }
        )

    if action == "Create ticket":
        unit = select_fleet_alert_unit()
        if not unit:
            return jsonify({"ok": False, "message": "No active fleet alert is waiting."}), 400
        fleet_item = find_fleet_item(unit)
        existing_ticket = open_ticket_for(str(fleet_item.get("ticket", ""))) if fleet_item else None
        ticket = ensure_fleet_ticket(unit, "manual")
        notify = notify_on_call(unit, "manual", force=True)
        created_new_ticket = existing_ticket is None and ticket is not None
        message = f"{ticket['id']} created for {unit}; on-call tech notified." if created_new_ticket else f"{ticket['id']} is already active for {unit}; on-call tech notified again."
        return jsonify(
            {
                "ok": True,
                "message": message,
                "timestamp": datetime.now().strftime("%I:%M:%S %p"),
                "ticket": ticket,
                "delivery": notify.get("delivery"),
                "refresh": True,
            }
        )

    if action == "Flag blockers":
        result = send_modernization_flag("manual")
        return jsonify(
            {
                "ok": True,
                "message": result["flag"]["summary"],
                "timestamp": datetime.now().strftime("%I:%M:%S %p"),
                "delivery": result["delivery"],
                "refresh": True,
            }
        )

    if action == "Text technician":
        result = notify_on_call(target, "manual")
        if not result.get("ok"):
            return jsonify(result), 404
        ticket = result.get("ticket")
        message = f"Technician alert sent for {target}"
        if ticket:
            message = f"Technician alert sent for {target} on {ticket['id']}."
        return jsonify({"ok": True, "message": message, "timestamp": datetime.now().strftime("%I:%M:%S %p"), "delivery": result.get("delivery"), "refresh": True})

    if action == "Draft outreach":
        result = draft_renewal_outreach()
        candidates = result.get("candidates", [])
        count = len(result.get("drafts", []))
        if count == 0:
            message = "No renewal outreach drafts were needed."
        else:
            buildings = ", ".join(item.get("building", "") for item in candidates[:3] if item.get("building"))
            suffix = "." if not buildings else f" for {buildings}."
            message = f"Prepared {count} renewal outreach draft{'s' if count != 1 else ''}{suffix}"
        return jsonify({"ok": True, "message": message, "timestamp": datetime.now().strftime("%I:%M:%S %p"), "delivery": result.get("delivery"), "refresh": True})

    if action in {"Process inbox", "Escalate emergencies"}:
        result = route_customer_service_messages("manual")
        return jsonify({"ok": True, "message": result["summary"], "timestamp": datetime.now().strftime("%I:%M:%S %p"), "delivery": result.get("delivery"), "refresh": True})

    if action == "Push work order":
        result = push_work_order()
        if not result.get("ok"):
            return jsonify(result), 400
        return jsonify({"ok": True, "message": f"{result['work_order']['id']} pushed to FSM.", "timestamp": datetime.now().strftime("%I:%M:%S %p"), "delivery": result.get("delivery"), "refresh": True})

    if action == "Provision Discord channels":
        guild_id = resolve_openclaw_runtime_value("FUZI_DISCORD_GUILD_ID", "")
        try:
            result = ensure_discord_agent_channels(guild_id)
        except RuntimeError as exc:
            return jsonify({"ok": False, "message": str(exc)}), 400
        created_count = len(result["created"])
        message = (
            f"Provisioned {created_count} new Discord channel{'s' if created_count != 1 else ''} under {result['category']['name']}."
            if created_count
            else f"Discord agent channels are already configured under {result['category']['name']}."
        )
        return jsonify({"ok": True, "message": message, "timestamp": datetime.now().strftime("%I:%M:%S %p"), "refresh": False, "channels": result["channels"]})

    result = handle_generic_action(action, target)
    return jsonify(
        {
            "ok": result["ok"],
            "message": result["message"],
            "timestamp": datetime.now().strftime("%I:%M:%S %p"),
            "delivery": result.get("delivery"),
        }
    )


@app.post("/api/portal/crm-query")
@login_required
def api_crm_query():
    payload = request.get_json(silent=True) or {}
    question = str(payload.get("question", "")).strip()
    if not question:
        return jsonify({"ok": False, "message": "A CRM question is required."}), 400

    result = send_crm_query_result(question)
    return jsonify(
        {
            "ok": True,
            "message": result["answer"]["summary"],
            "details": result["answer"]["details"],
            "timestamp": datetime.now().strftime("%I:%M:%S %p"),
            "delivery": result.get("delivery"),
        }
    )


@app.get("/api/portal/inventory")
@login_required
def get_inventory():
    return jsonify({"ok": True, "inventory": INVENTORY, "insights": inventory_ai_insights()})


def next_inventory_id() -> str:
    numbers = []
    for item in INVENTORY:
        try:
            numbers.append(int(item["id"].split("-")[1]))
        except (KeyError, IndexError, ValueError):
            continue
    return f"INV-{max(numbers, default=0) + 1:03d}"


@app.post("/api/portal/inventory")
@login_required
def create_inventory_item():
    payload = request.get_json(silent=True) or {}
    name = payload.get("name", "").strip()
    if not name:
        return jsonify({"ok": False, "message": "Part name is required."}), 400
    qty = max(int(payload.get("qty_on_hand", 0)), 0)
    reorder = max(int(payload.get("reorder_point", 5)), 0)
    item: dict[str, Any] = {
        "id": next_inventory_id(),
        "item_no": max((i.get("item_no", 0) for i in INVENTORY), default=0) + 1,
        "name": name,
        "category": payload.get("category", "Other").strip() or "Other",
        "qty_on_hand": qty,
        "qty_reserved": 0,
        "reorder_point": reorder,
        "unit": payload.get("unit", "pcs").strip() or "pcs",
        "vendor": payload.get("vendor", "").strip(),
        "lead_time_days": max(int(payload.get("lead_time_days", 7)), 0),
        "unit_cost": max(float(payload.get("unit_cost", 0)), 0),
        "status": "Out of Stock" if qty == 0 else "Low Stock" if qty <= reorder else "In Stock",
        "notes": payload.get("notes", "").strip(),
        "po_number": "",
        "last_updated": now_stamp(),
    }
    INVENTORY.append(item)
    save_inventory()
    return jsonify({"ok": True, "item": item, "message": f"{name} added to inventory."})


@app.patch("/api/portal/inventory/<item_id>")
@login_required
def update_inventory_item(item_id: str):
    payload = request.get_json(silent=True) or {}
    item = next((i for i in INVENTORY if i.get("id") == item_id), None)
    if item is None:
        return jsonify({"ok": False, "message": "Inventory item not found."}), 404
    for field in ("name", "category", "unit", "vendor", "notes", "po_number"):
        if field in payload:
            item[field] = str(payload[field]).strip()
    for field in ("qty_on_hand", "qty_reserved", "reorder_point", "lead_time_days"):
        if field in payload:
            item[field] = max(0, int(payload[field]))
    if "unit_cost" in payload:
        item["unit_cost"] = max(0.0, float(payload["unit_cost"]))
    if payload.get("status") in {"In Stock", "Low Stock", "Out of Stock", "Ordered"}:
        item["status"] = payload["status"]
    else:
        item["status"] = inventory_item_status(item)
    item["last_updated"] = now_stamp()
    save_inventory()
    return jsonify({"ok": True, "item": item, "message": f"{item['name']} updated."})


@app.post("/api/portal/inventory/<item_id>/adjust")
@login_required
def adjust_inventory_qty(item_id: str):
    payload = request.get_json(silent=True) or {}
    item = next((i for i in INVENTORY if i.get("id") == item_id), None)
    if item is None:
        return jsonify({"ok": False, "message": "Inventory item not found."}), 404
    delta = int(payload.get("delta", 0))
    reason = str(payload.get("reason", "Manual adjustment")).strip() or "Manual adjustment"
    new_qty = max(0, int(item.get("qty_on_hand", 0)) + delta)
    item["qty_on_hand"] = new_qty
    item["status"] = inventory_item_status(item)
    item["last_updated"] = now_stamp()
    save_inventory()
    with STATE_LOCK:
        append_activity("Inventory Manager", f"{item['name']} qty {'+' if delta >= 0 else ''}{delta}: {reason}")
        save_operations_state()
    return jsonify({"ok": True, "item": item, "message": f"{item['name']} adjusted to {new_qty} {item.get('unit', 'units')}."})


@app.post("/api/portal/inventory/raise-po")
@login_required
def raise_inventory_po():
    payload = request.get_json(silent=True) or {}
    item_ids: list[str] = payload if isinstance(payload, list) else payload.get("item_ids", [])
    updated = []
    po_ref = f"PO-{now_stamp().replace('-', '').replace(':', '').replace(' ', '-')}"
    for item_id in item_ids:
        item = next((i for i in INVENTORY if i.get("id") == item_id), None)
        if item is None:
            continue
        item["status"] = "Ordered"
        item["po_number"] = po_ref
        item["last_updated"] = now_stamp()
        updated.append(item)
    if updated:
        save_inventory()
        with STATE_LOCK:
            append_activity(
                "Inventory Manager",
                f"PO {po_ref} raised for {len(updated)} item(s): {', '.join(i['name'] for i in updated[:3])}",
            )
            save_operations_state()
    return jsonify({"ok": True, "updated": updated, "message": f"PO raised for {len(updated)} item(s).", "po_ref": po_ref})


@app.get("/api/portal/inventory/ai-insights")
@login_required
def get_inventory_ai_insights():
    return jsonify({"ok": True, **inventory_ai_insights()})


# ── Estimates (Costing Estimator) ──────────────────────────────────────────────

def _public_customer_user(u: dict) -> dict:
    return {k: v for k, v in u.items() if k != "password_hash"}


@app.get("/api/portal/estimates")
@login_required
def get_estimates():
    return jsonify({"ok": True, "estimates": ESTIMATES})


@app.post("/api/portal/estimates/calculate")
@login_required
def calculate_estimate_api():
    payload = request.get_json(silent=True) or {}
    result = calculate_estimate(payload)
    return jsonify({"ok": True, **result})


@app.post("/api/portal/estimates")
@login_required
def create_estimate():
    payload = request.get_json(silent=True) or {}
    linked_customer = find_customer(str(payload.get("customer_id", "")).strip()) if payload.get("customer_id") else None
    if linked_customer:
        if not payload.get("customer_name"):
            payload["customer_name"] = linked_customer.get("name", "")
        if not payload.get("site"):
            payload["site"] = linked_customer.get("address", "")
        if not payload.get("sent_to_email"):
            payload["sent_to_email"] = linked_customer.get("email", "")
    costs = calculate_estimate(payload)
    viewer = current_user() or {}
    estimate = {
        "id": next_estimate_id(),
        "customer_id": payload.get("customer_id", ""),
        "customer_name": payload.get("customer_name", "").strip(),
        "site": payload.get("site", "").strip(),
        "elevator_type": payload.get("elevator_type", "Passenger"),
        "capacity": payload.get("capacity", "6 Passengers"),
        "num_floors": int(payload.get("num_floors", 2)),
        "drive_type": payload.get("drive_type", payload.get("motor_type", "Gearless")),
        "cabin_finish": payload.get("cabin_finish", "Stainless Steel"),
        "door_type": payload.get("door_type", "Automatic"),
        "door_construction": payload.get("door_construction", ""),
        "door_panels": payload.get("door_panels", ""),
        "door_opening_type": payload.get("door_opening_type", ""),
        "door_vision": payload.get("door_vision", ""),
        "door_width_mm": payload.get("door_width_mm", ""),
        "door_height_mm": payload.get("door_height_mm", ""),
        "door_arrangement": payload.get("door_arrangement", ""),
        "floor_height_mm": payload.get("floor_height_mm", ""),
        "pit_depth_mm": payload.get("pit_depth_mm", ""),
        "overhead_mm": payload.get("overhead_mm", ""),
        "speed": payload.get("speed", ""),
        "make": payload.get("make", "Fuzi"),
        "control_type": payload.get("control_type", "Collective Control"),
        "remark_1": payload.get("remark_1", ""),
        "remark_2": payload.get("remark_2", ""),
        "remark_3": payload.get("remark_3", ""),
        "addons": payload.get("addons", []),
        "base_cost": costs["base_cost"],
        "addons_cost": costs["addons_cost"],
        "subtotal": costs["subtotal"],
        "margin_percent": costs["margin_percent"],
        "total_cost": costs["total_cost"],
        "notes": payload.get("notes", "").strip(),
        "status": "Draft",
        "sent_to_email": payload.get("sent_to_email", "").strip(),
        "sent_at": "",
        "valid_until": payload.get("valid_until", ""),
        "offer_approved": False,
        "offer_approved_at": "",
        "offer_approved_by": "",
        "created_by": viewer.get("id", ""),
        "created_at": now_stamp(),
    }
    ESTIMATES.append(estimate)
    save_estimates()
    send_business_channel_update(
        "FUZI_OPENCLAW_TARGET_NEW_SITE_VISIT_OFFER",
        f"Draft offer prepared for {estimate.get('customer_name', 'customer')}.",
        [
            f"Estimate {estimate.get('id', 'Draft')} for {estimate.get('elevator_type', 'elevator')} at {estimate.get('site', 'site pending')}.",
            f"Draft value: {estimate.get('total_cost', 0)}.",
            f"Capacity and drive: {estimate.get('capacity', '')}, {estimate.get('drive_type', '')}.".strip(),
        ],
        event_type="estimate-draft",
    )
    send_metrics_channel_snapshot("estimate-created")
    send_catalog_channel_snapshot("estimate-created", estimate)
    return jsonify({"ok": True, "estimate": estimate})


@app.patch("/api/portal/estimates/<est_id>")
@login_required
def update_estimate(est_id: str):
    est = next((e for e in ESTIMATES if e.get("id") == est_id), None)
    if est is None:
        return jsonify({"ok": False, "message": "Estimate not found."}), 404
    payload = request.get_json(silent=True) or {}
    for field in ("status", "notes", "sent_to_email", "valid_until", "margin_percent"):
        if field in payload:
            est[field] = payload[field]
            if field != "status":
                est["offer_approved"] = False
                est["offer_approved_at"] = ""
                est["offer_approved_by"] = ""
    if "margin_percent" in payload:
        costs = calculate_estimate({**est, "margin_percent": payload["margin_percent"]})
        est.update(costs)
    save_estimates()
    return jsonify({"ok": True, "estimate": est})


@app.get("/api/portal/estimates/<est_id>/report")
@login_required
def estimate_html_report(est_id: str):
    est = next((e for e in ESTIMATES if e.get("id") == est_id), None)
    if est is None:
        return "Estimate not found.", 404
    return _estimate_html_report(est), 200, {"Content-Type": "text/html"}


@app.get("/api/portal/estimates/<est_id>/offer.docx")
@login_required
def estimate_offer_docx(est_id: str):
    est = next((e for e in ESTIMATES if e.get("id") == est_id), None)
    if est is None:
        return "Estimate not found.", 404
    path = generate_offer_docx(est)
    save_estimates()
    return send_file(
        path,
        as_attachment=True,
        download_name=path.name,
        mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


@app.get("/api/portal/estimates/<est_id>/offer.pdf")
@login_required
def estimate_offer_pdf(est_id: str):
    est = next((e for e in ESTIMATES if e.get("id") == est_id), None)
    if est is None:
        return "Estimate not found.", 404
    path = generate_offer_pdf(est)
    save_estimates()
    return send_file(
        path,
        as_attachment=False,
        download_name=path.name,
        mimetype="application/pdf",
    )


@app.post("/api/portal/estimates/<est_id>/approve-offer")
@login_required
def approve_estimate_offer(est_id: str):
    est = next((e for e in ESTIMATES if e.get("id") == est_id), None)
    if est is None:
        return jsonify({"ok": False, "message": "Estimate not found."}), 404
    generate_offer_docx(est)
    generate_offer_pdf(est)
    est["offer_approved"] = True
    est["offer_approved_at"] = now_stamp()
    est["offer_approved_by"] = session.get("portal_user", "")
    save_estimates()
    return jsonify({
        "ok": True,
        "message": "Offer PDF approved. It is ready to send.",
        "offer_pdf": f"/api/portal/estimates/{est_id}/offer.pdf",
        "estimate": est,
    })


@app.post("/api/portal/estimates/<est_id>/send")
@login_required
def send_estimate(est_id: str):
    est = next((e for e in ESTIMATES if e.get("id") == est_id), None)
    if est is None:
        return jsonify({"ok": False, "message": "Estimate not found."}), 404
    payload = request.get_json(silent=True) or {}
    if payload.get("email"):
        est["sent_to_email"] = payload["email"]
    if payload.get("customer_id"):
        customer = find_customer(str(payload["customer_id"]).strip())
        if customer:
            est["customer_id"] = customer.get("id", "")
            est["customer_name"] = est.get("customer_name") or customer.get("name", "")
            est["site"] = est.get("site") or customer.get("address", "")
            est["sent_to_email"] = est.get("sent_to_email") or customer.get("email", "")
    result = send_estimate_email(est)
    if result.get("ok"):
        est["status"] = "Sent"
        est["sent_at"] = now_stamp()
        save_estimates()
        send_business_channel_update(
            "FUZI_OPENCLAW_TARGET_NEW_SITE_VISIT_OFFER",
            f"Offer sent for {est.get('customer_name', 'customer')}.",
            [
                f"Estimate {est.get('id', est_id)} for {est.get('elevator_type', 'elevator')} at {est.get('site', 'site pending')}.",
                f"Total value: {est.get('total_cost', 0)}.",
                f"Sent to: {est.get('sent_to_email', 'email pending')}.",
            ],
            event_type="new-site-offer",
        )
        send_metrics_channel_snapshot("estimate-sent")
        send_catalog_channel_snapshot("offer-sent", est)
    return jsonify({**result, "estimate": est})


# ── Customer Portal Users ───────────────────────────────────────────────────────

@app.post("/api/portal/customer-users")
@login_required
@admin_required
def create_customer_user():
    payload = request.get_json(silent=True) or {}
    customer_id = payload.get("customer_id", "").strip()
    email = payload.get("email", "").strip()
    username = payload.get("username", "").strip()
    if not username:
        return jsonify({"ok": False, "message": "Username is required."}), 400
    if find_customer_user(username):
        return jsonify({"ok": False, "message": "Username already exists."}), 409
    temp_password = payload.get("temp_password", "ChangeMe123!")
    cu = {
        "id": next_customer_user_id(),
        "customer_id": customer_id,
        "username": username,
        "display_name": payload.get("display_name", username),
        "email": email,
        "password_hash": generate_password_hash(temp_password),
        "active": True,
        "must_change_password": True,
        "created_at": now_stamp(),
        "onboarded": False,
    }
    CUSTOMER_USERS.append(cu)
    save_customer_users()
    return jsonify({"ok": True, "customer_user": _public_customer_user(cu), "temp_password": temp_password})


@app.patch("/api/portal/customer-users/<cu_id>")
@login_required
@admin_required
def update_customer_user(cu_id: str):
    cu = next((u for u in CUSTOMER_USERS if u.get("id") == cu_id), None)
    if cu is None:
        return jsonify({"ok": False, "message": "Customer user not found."}), 404
    payload = request.get_json(silent=True) or {}
    for field in ("display_name", "email", "active"):
        if field in payload:
            cu[field] = payload[field]
    if payload.get("reset_password"):
        new_temp = payload.get("new_password", "ChangeMe123!")
        cu["password_hash"] = generate_password_hash(new_temp)
        cu["must_change_password"] = True
        save_customer_users()
        return jsonify({"ok": True, "customer_user": _public_customer_user(cu), "temp_password": new_temp})
    save_customer_users()
    return jsonify({"ok": True, "customer_user": _public_customer_user(cu)})


# ── Department Module Routes ────────────────────────────────────────────────────
#
# Generic pattern: each module stores records in a JSON list.
# Routes: GET list, POST create, PATCH update, DELETE remove.
# Breakdown has extra status-transition routes.

def _dept_payload() -> tuple[dict, str, str]:
    """Return (payload, dept, username) for the current session."""
    return (
        request.get_json(silent=True) or {},
        session.get("portal_department", ""),
        session.get("portal_user", ""),
    )


# ── Sales Inquiries ───────────────────────────────────────────────────────────

@app.get("/api/portal/sales/inquiries")
@login_required
def list_sales_inquiries():
    return jsonify({"ok": True, "inquiries": SALES_INQUIRIES})


@app.get("/api/portal/sales/admin-panel")
@login_required
def get_sales_admin_panel():
    selected_date = request.args.get("date", "")
    return jsonify({"ok": True, "panel": build_sales_admin_panel(selected_date)})


@app.post("/api/portal/sales/admin-panel")
@login_required
def save_sales_admin_panel():
    payload = request.get_json(silent=True) or {}
    selected_date = parse_iso_date(payload.get("date"))
    if not selected_date:
        return jsonify({"ok": False, "message": "A valid date (YYYY-MM-DD) is required."}), 400

    actor = session.get("portal_user", "system")
    normalized = _normalize_sales_admin_entry(payload, actor)
    normalized["date"] = selected_date.isoformat()

    existing = next((row for row in SALES_ADMIN_PANEL if parse_iso_date(row.get("date")) == selected_date), None)
    if existing is None:
        normalized["id"] = _next_id(SALES_ADMIN_PANEL, "SAP")
        SALES_ADMIN_PANEL.append(normalized)
        saved = normalized
    else:
        existing.update(normalized)
        saved = existing

    _save_module(SALES_ADMIN_PANEL_FILE, SALES_ADMIN_PANEL)
    return jsonify({"ok": True, "entry": saved, "panel": build_sales_admin_panel(saved.get("date"))})


@app.post("/api/portal/sales/inquiries")
@login_required
def create_sales_inquiry():
    p, _, user = _dept_payload()
    now = datetime.utcnow().isoformat()
    record = {
        "id": _next_id(SALES_INQUIRIES, "INQ"),
        "customer": p.get("customer", ""),
        "contact_name": p.get("contact_name", ""),
        "phone": p.get("phone", ""),
        "site": p.get("site", ""),
        "elevator_type": p.get("elevator_type", ""),
        "requirement": p.get("requirement", p.get("notes", "")),
        "received_date": p.get("received_date", now[:10]),
        "last_followup": None,
        "next_followup": p.get("next_followup", ""),
        "linked_estimate": p.get("linked_estimate", ""),
        "status": p.get("status", "New"),
        "assigned_to": p.get("assigned_to", user),
        "notes": p.get("notes", ""),
        "created_at": now,
    }
    SALES_INQUIRIES.append(record)
    _save_module(SALES_INQUIRIES_FILE, SALES_INQUIRIES)
    send_business_channel_update(
        "FUZI_OPENCLAW_TARGET_NEW_SITE_VISIT_OFFER",
        f"New site visit lead captured for {record.get('customer', 'customer')}.",
        [
            f"Site: {record.get('site', 'Not provided') or 'Not provided'}.",
            f"Requirement: {record.get('requirement', 'Not provided') or 'Not provided'}.",
            f"Next follow-up: {record.get('next_followup', 'Not scheduled') or 'Not scheduled'}.",
        ],
        event_type="new-site-visit",
    )
    send_metrics_channel_snapshot("sales-inquiry-created")
    return jsonify({"ok": True, "item": record, "data": SALES_INQUIRIES}), 201


@app.patch("/api/portal/sales/inquiries/<inquiry_id>")
@login_required
def update_sales_inquiry(inquiry_id: str):
    p, _, _ = _dept_payload()
    rec = next((r for r in SALES_INQUIRIES if r["id"] == inquiry_id), None)
    if not rec:
        return jsonify({"ok": False, "message": "Not found"}), 404
    action = p.get("action", "")
    if action == "followup":
        rec["status"] = "Follow-up"
        rec["last_followup"] = datetime.utcnow().isoformat()[:10]
    elif action == "order_received":
        rec["status"] = "Order Received"
        rec["last_followup"] = datetime.utcnow().isoformat()[:10]
    else:
        for k in ("customer", "contact_name", "phone", "site", "requirement",
                  "next_followup", "linked_estimate", "status", "assigned_to", "notes"):
            if k in p:
                rec[k] = p[k]
        if "status" in p or "notes" in p:
            rec["last_followup"] = datetime.utcnow().isoformat()[:10]
    _save_module(SALES_INQUIRIES_FILE, SALES_INQUIRIES)
    send_business_channel_update(
        "FUZI_OPENCLAW_TARGET_NEW_SITE_VISIT_OFFER",
        f"Site visit follow-up updated for {rec.get('customer', 'customer')}.",
        [
            f"Status: {rec.get('status', 'Updated')}.",
            f"Next follow-up: {rec.get('next_followup', 'Not scheduled') or 'Not scheduled'}.",
            f"Linked estimate: {rec.get('linked_estimate', 'None') or 'None'}.",
        ],
        event_type="new-site-followup",
    )
    send_metrics_channel_snapshot("sales-inquiry-updated")
    return jsonify({"ok": True, "item": rec, "data": SALES_INQUIRIES})


# ── Breakdown ─────────────────────────────────────────────────────────────────

@app.get("/api/portal/breakdown")
@login_required
def list_breakdowns():
    return jsonify({"ok": True, "breakdowns": BREAKDOWNS})


@app.get("/api/portal/install-team")
@login_required
def list_install_team():
    return jsonify({"ok": True, "members": INSTALL_TEAM})


def _install_member(member_id: str) -> dict[str, Any] | None:
    normalized = str(member_id or "").strip()
    if not normalized:
        return None
    return next((member for member in INSTALL_TEAM if str(member.get("id", "")).strip() == normalized), None)


@app.post("/api/portal/breakdown")
@login_required
def create_breakdown():
    p, _, user = _dept_payload()
    now = datetime.utcnow().isoformat()
    scheduled_engineer_id = str(p.get("scheduled_engineer_id", "")).strip()
    engineer = _install_member(scheduled_engineer_id)
    scheduled_engineer_name = str(p.get("scheduled_engineer_name", "")).strip() or (engineer.get("name", "") if engineer else "")
    engineer_availability = str(p.get("engineer_availability", "")).strip() or (engineer.get("availability", "") if engineer else "")
    engineer_shift = str(p.get("engineer_shift", "")).strip() or (engineer.get("shift", "") if engineer else "")
    engineer_current_job = str(p.get("engineer_current_job", "")).strip() or (engineer.get("current_job", "") if engineer else "")
    scheduled_visit_at = str(p.get("scheduled_visit_at", "")).strip()
    record = {
        "id": _next_id(BREAKDOWNS, "BRK"),
        "unit": p.get("unit", p.get("elevator_ref", "")),
        "elevator_ref": p.get("elevator_ref", p.get("unit", "")),
        "customer": p.get("customer", ""),
        "site": p.get("site", ""),
        "reported_at": p.get("reported_at", now),
        "attended_at": None,
        "resolved_at": None,
        "closed_at": None,
        "technician": p.get("technician", scheduled_engineer_name or user),
        "scheduled_engineer_id": scheduled_engineer_id,
        "scheduled_engineer_name": scheduled_engineer_name,
        "engineer_availability": engineer_availability,
        "engineer_shift": engineer_shift,
        "engineer_current_job": engineer_current_job,
        "scheduled_visit_at": scheduled_visit_at,
        "fault": p.get("fault", ""),
        "contract_type": p.get("contract_type", "Warranty"),
        "resolution": "",
        "priority": p.get("priority", "High"),
        "status": "Open",
        "created_at": now,
    }
    BREAKDOWNS.append(record)
    _save_module(BREAKDOWNS_FILE, BREAKDOWNS)
    send_business_channel_update(
        "FUZI_OPENCLAW_TARGET_BREAKDOWN_CHANNEL",
        f"Breakdown {record['id']} opened for {record.get('customer', record.get('unit', 'site'))}.",
        [
            f"Unit: {record.get('unit', 'Unknown')}.",
            f"Fault: {record.get('fault', 'Not specified') or 'Not specified'}.",
            f"Priority: {record.get('priority', 'High')}.",
            f"Scheduled engineer: {record.get('scheduled_engineer_name', 'Unassigned') or 'Unassigned'} ({record.get('engineer_availability', 'Unknown') or 'Unknown'}).",
            f"Technician: {record.get('technician', 'Unassigned') or 'Unassigned'}.",
        ],
        event_type="breakdown-opened",
    )
    return jsonify({"ok": True, "item": record, "data": BREAKDOWNS}), 201


@app.patch("/api/portal/breakdown/<brk_id>")
@login_required
def update_breakdown(brk_id: str):
    p, _, _ = _dept_payload()
    rec = next((r for r in BREAKDOWNS if r["id"] == brk_id), None)
    if not rec:
        return jsonify({"ok": False, "message": "Not found"}), 404
    now = datetime.utcnow().isoformat()
    action = p.get("action", "")
    if action == "attend":
        rec["status"] = "Attended"
        rec["attended_at"] = rec["attended_at"] or now
        if p.get("technician"):
            rec["technician"] = p["technician"]
        elif rec.get("scheduled_engineer_name"):
            rec["technician"] = rec.get("scheduled_engineer_name")
        if p.get("engineer_availability"):
            rec["engineer_availability"] = p.get("engineer_availability")
    elif action == "resolve":
        rec["status"] = "Resolved"
        rec["resolved_at"] = rec["resolved_at"] or now
        rec["resolution"] = p.get("resolution", rec.get("resolution", ""))
    elif action == "close":
        rec["status"] = "Closed"
        rec["closed_at"] = rec["closed_at"] or now
    else:
        for k in (
            "fault",
            "resolution",
            "technician",
            "priority",
            "notes",
            "scheduled_engineer_id",
            "scheduled_engineer_name",
            "engineer_availability",
            "engineer_shift",
            "engineer_current_job",
            "scheduled_visit_at",
        ):
            if k in p:
                rec[k] = p[k]
    _save_module(BREAKDOWNS_FILE, BREAKDOWNS)
    send_business_channel_update(
        "FUZI_OPENCLAW_TARGET_BREAKDOWN_CHANNEL",
        f"Breakdown {rec['id']} is now {rec.get('status', 'Updated')}.",
        [
            f"Unit: {rec.get('unit', 'Unknown')}.",
            f"Technician: {rec.get('technician', 'Unassigned') or 'Unassigned'}.",
            f"Resolution: {rec.get('resolution', 'Pending') or 'Pending'}.",
        ],
        event_type="breakdown-status",
    )
    if rec.get("status") in {"Resolved", "Closed"}:
        send_business_channel_update(
            "FUZI_OPENCLAW_TARGET_BREAKDOWN_REPORT_PDF",
            f"Breakdown report ready for {rec['id']}.",
            [
                f"Customer: {rec.get('customer', 'Unknown')} at {rec.get('site', 'Unknown site')}.",
                f"Fault: {rec.get('fault', 'Not specified') or 'Not specified'}.",
                f"Resolution: {rec.get('resolution', 'Pending') or 'Pending'}.",
                f"Closed status: {rec.get('status', 'Open')}.",
            ],
            event_type="breakdown-report",
        )
    return jsonify({"ok": True, "item": rec, "data": BREAKDOWNS})


# ── Service ───────────────────────────────────────────────────────────────────

@app.get("/api/portal/service")
@login_required
def list_service_records():
    return jsonify({"ok": True, "records": SERVICE_RECORDS})


def parse_service_parts(parts: Any) -> list[dict[str, Any]]:
    if isinstance(parts, list):
        rows = [part for part in parts if isinstance(part, dict)]
    elif isinstance(parts, str):
        rows = []
        for line in parts.splitlines():
            cols = [col.strip() for col in line.split("|")]
            if not any(cols):
                continue
            rows.append(
                {
                    "part_number": cols[0] if len(cols) > 0 else "",
                    "description": cols[1] if len(cols) > 1 else "",
                    "quantity": cols[2] if len(cols) > 2 else "",
                    "bill_amount": cols[3] if len(cols) > 3 else "",
                }
            )
    else:
        rows = []

    normalized: list[dict[str, Any]] = []
    for row in rows:
        try:
            qty: Any = float(row.get("quantity", 0) or 0)
            qty = int(qty) if qty.is_integer() else qty
        except (TypeError, ValueError, AttributeError):
            qty = row.get("quantity", "")
        try:
            bill_amount: Any = float(row.get("bill_amount", 0) or 0)
        except (TypeError, ValueError):
            bill_amount = 0
        normalized.append(
            {
                "part_number": str(row.get("part_number", "")).strip(),
                "description": str(row.get("description", "")).strip(),
                "quantity": qty,
                "bill_amount": bill_amount,
            }
        )
    return normalized


def service_bill_total(parts: list[dict[str, Any]]) -> float:
    total = 0.0
    for part in parts:
        try:
            total += float(part.get("bill_amount", 0) or 0)
        except (TypeError, ValueError):
            continue
    return total


def find_or_create_service_customer(record: dict[str, Any]) -> dict[str, Any] | None:
    customer_id = str(record.get("customer_id", "")).strip()
    if customer_id:
        found = find_customer(customer_id)
        if found:
            return found

    customer_name = str(record.get("customer", "")).strip()
    if not customer_name:
        return None
    normalized = customer_name.lower()
    found = next((customer for customer in CUSTOMERS if str(customer.get("name", "")).strip().lower() == normalized), None)
    if found:
        record["customer_id"] = found.get("id", "")
        return found

    customer = {
        "id": next_customer_id(),
        "name": customer_name,
        "contact_person": "",
        "phone": "",
        "email": "",
        "address": record.get("location", record.get("site", "")),
        "segment": "Service",
        "status": "Active",
        "renewal_date": "",
        "notes": "Created from service report.",
        "service_history": [],
        "created_at": now_stamp(),
    }
    CUSTOMERS.append(customer)
    record["customer_id"] = customer["id"]
    return customer


def sync_service_report_to_customer(record: dict[str, Any]) -> None:
    customer = find_or_create_service_customer(record)
    if not customer:
        return
    history = customer.setdefault("service_history", [])
    summary = {
        "id": record.get("id", ""),
        "job_number": record.get("job_number", record.get("id", "")),
        "contract_type": record.get("contract_type", ""),
        "date": record.get("service_date", record.get("completed_date", "")),
        "start_time": record.get("start_time", ""),
        "finish_time": record.get("finish_time", ""),
        "technician": record.get("technician", ""),
        "location": record.get("location", record.get("site", "")),
        "action_taken": record.get("action_taken", ""),
        "required_actions": record.get("required_actions", ""),
        "customer_comments": record.get("customer_comments", ""),
        "parts_used": record.get("parts_used", []),
        "bill_total": record.get("bill_total", 0),
        "status": record.get("status", ""),
        "recorded_at": record.get("completed_at", now_stamp()),
    }
    existing_index = next((idx for idx, item in enumerate(history) if item.get("id") == summary["id"]), None)
    if existing_index is None:
        history.insert(0, summary)
    else:
        history[existing_index] = summary
    save_customers()


def service_report_text(record: dict[str, Any]) -> str:
    part_lines = []
    for part in record.get("parts_used", []):
        part_lines.append(
            f"- {part.get('part_number', '')} | {part.get('description', '')} | Qty {part.get('quantity', '')} | Bill {part.get('bill_amount', 0)}"
        )
    return "\n".join(
        [
            f"Service Report: {record.get('job_number', record.get('id', ''))}",
            f"Record ID: {record.get('id', '')}",
            f"Contract Type: {record.get('contract_type', '')}",
            f"Customer: {record.get('customer', '')}",
            f"Location: {record.get('location', record.get('site', ''))}",
            f"Unit: {record.get('unit', '')}",
            f"Date: {record.get('service_date', record.get('completed_date', ''))}",
            f"Start Time: {record.get('start_time', '')}",
            f"Finish Time: {record.get('finish_time', '')}",
            f"Technician Assigned: {record.get('technician', '')}",
            f"Breakdown Comments: {record.get('breakdown_comments', '')}",
            f"Action Taken: {record.get('action_taken', '')}",
            f"Required Actions: {record.get('required_actions', '')}",
            f"Customer Comments: {record.get('customer_comments', '')}",
            "Parts Used:",
            *(part_lines or ["- None"]),
            f"Bill Total: {record.get('bill_total', 0)}",
        ]
    )


def notify_ceo_service_report(record: dict[str, Any]) -> dict[str, Any]:
    subject = f"FUZI Service Report {record.get('job_number', record.get('id', ''))} - {record.get('customer', '')}"
    delivery = send_plain_email(CEO_EMAIL, subject, service_report_text(record))
    record["ceo_delivery"] = delivery
    return delivery


@app.post("/api/portal/service")
@login_required
def create_service_record():
    p, _, user = _dept_payload()
    from datetime import timedelta
    sched = p.get("scheduled_date", "")
    try:
        next_date = (datetime.fromisoformat(sched) + timedelta(days=60)).strftime("%Y-%m-%d") if sched else ""
    except ValueError:
        next_date = ""
    parts_used = parse_service_parts(p.get("parts_used", []))
    contract_type = p.get("contract_type", p.get("service_type", "AMC"))
    record = {
        "id": _next_id(SERVICE_RECORDS, "SVC"),
        "job_number": p.get("job_number", ""),
        "customer_id": p.get("customer_id", ""),
        "unit": p.get("unit", p.get("elevator_ref", "")),
        "elevator_ref": p.get("elevator_ref", p.get("unit", "")),
        "customer": p.get("customer", ""),
        "site": p.get("site", p.get("location", "")),
        "location": p.get("location", p.get("site", "")),
        "contract_type": contract_type,
        "scheduled_date": sched,
        "service_date": p.get("service_date", sched),
        "start_time": p.get("start_time", ""),
        "finish_time": p.get("finish_time", ""),
        "completed_date": None,
        "completed_at": None,
        "technician": p.get("technician", user),
        "service_type": contract_type,
        "breakdown_comments": p.get("breakdown_comments", ""),
        "action_taken": p.get("action_taken", ""),
        "required_actions": p.get("required_actions", ""),
        "customer_comments": p.get("customer_comments", ""),
        "parts_used": parts_used,
        "bill_total": service_bill_total(parts_used),
        "findings": p.get("notes", ""),
        "next_service_date": next_date,
        "status": "Scheduled",
        "created_at": datetime.utcnow().isoformat(),
    }
    SERVICE_RECORDS.append(record)
    _save_module(SERVICE_RECORDS_FILE, SERVICE_RECORDS)
    send_business_channel_update(
        "FUZI_OPENCLAW_TARGET_SERVICE_TWO_MONTH",
        f"Bi-monthly service scheduled for {record.get('customer', record.get('unit', 'site'))}.",
        [
            f"Scheduled date: {record.get('scheduled_date', 'Not set') or 'Not set'}.",
            f"Next service date: {record.get('next_service_date', 'Not set') or 'Not set'}.",
            f"Technician: {record.get('technician', 'Unassigned') or 'Unassigned'}.",
        ],
        event_type="service-scheduled",
    )
    return jsonify({"ok": True, "item": record, "data": SERVICE_RECORDS}), 201


@app.patch("/api/portal/service/<svc_id>")
@login_required
def update_service_record(svc_id: str):
    p, _, _ = _dept_payload()
    rec = next((r for r in SERVICE_RECORDS if r["id"] == svc_id), None)
    if not rec:
        return jsonify({"ok": False, "message": "Not found"}), 404
    from datetime import timedelta
    report_fields = (
        "job_number",
        "customer_id",
        "unit",
        "elevator_ref",
        "customer",
        "site",
        "location",
        "contract_type",
        "service_date",
        "start_time",
        "finish_time",
        "scheduled_date",
        "technician",
        "breakdown_comments",
        "action_taken",
        "required_actions",
        "customer_comments",
        "findings",
        "status",
    )
    for key in report_fields:
        if key in p:
            rec[key] = p[key]
    if "contract_type" in p:
        rec["service_type"] = p["contract_type"]
    if "parts_used" in p:
        rec["parts_used"] = parse_service_parts(p.get("parts_used", []))
        rec["bill_total"] = service_bill_total(rec["parts_used"])
    if p.get("action") == "complete":
        rec["status"] = "Completed"
        rec["completed_date"] = p.get("service_date") or datetime.utcnow().isoformat()[:10]
        rec["completed_at"] = datetime.utcnow().isoformat()
        rec["findings"] = p.get("notes", p.get("findings", rec.get("findings", "")))
        rec["job_number"] = rec.get("job_number") or rec.get("id", "")
        rec["location"] = rec.get("location") or rec.get("site", "")
        rec["service_date"] = rec.get("service_date") or rec["completed_date"]
        try:
            rec["next_service_date"] = (datetime.utcnow() + timedelta(days=60)).strftime("%Y-%m-%d")
        except Exception:
            pass
    else:
        rec["bill_total"] = service_bill_total(rec.get("parts_used", []))
    if rec.get("status") == "Completed":
        sync_service_report_to_customer(rec)
        notify_ceo_service_report(rec)
    _save_module(SERVICE_RECORDS_FILE, SERVICE_RECORDS)
    send_business_channel_update(
        "FUZI_OPENCLAW_TARGET_SERVICE_TWO_MONTH",
        f"Service schedule update for {rec.get('customer', rec.get('unit', 'site'))}.",
        [
            f"Status: {rec.get('status', 'Updated')}.",
            f"Next service date: {rec.get('next_service_date', 'Not set') or 'Not set'}.",
            f"Technician: {rec.get('technician', 'Unassigned') or 'Unassigned'}.",
        ],
        event_type="service-schedule-update",
    )
    if rec.get("status") == "Completed":
        send_business_channel_update(
            "FUZI_OPENCLAW_TARGET_SERVICE_REPORT",
            f"Service report completed for {rec.get('customer', rec.get('unit', 'site'))}.",
            [
                f"Job number: {rec.get('job_number', rec.get('id', ''))}.",
                f"Contract type: {rec.get('contract_type', 'AMC')}.",
                f"Completed date: {rec.get('completed_date', 'Today') or 'Today'}.",
                f"Technician: {rec.get('technician', 'Unassigned') or 'Unassigned'}.",
                f"Action taken: {rec.get('action_taken', rec.get('findings', 'No action recorded')) or 'No action recorded'}.",
                f"Bill total: {rec.get('bill_total', 0)}.",
            ],
            event_type="service-report",
        )
    return jsonify({"ok": True, "item": rec, "data": SERVICE_RECORDS})


# ── GAD ───────────────────────────────────────────────────────────────────────

@app.get("/api/portal/gad")
@login_required
def list_gad_records():
    return jsonify({"ok": True, "records": GAD_RECORDS})


@app.post("/api/portal/gad")
@login_required
def create_gad_record():
    p, _, _ = _dept_payload()
    record = {
        "id": _next_id(GAD_RECORDS, "GAD"),
        "ref_type": p.get("ref_type", "Order"),
        "ref_no": p.get("ref_no", p.get("ref_id", "")),
        "ref_id": p.get("ref_id", p.get("ref_no", "")),
        "customer": p.get("customer", ""),
        "site": p.get("site", ""),
        "drawing_no": p.get("drawing_no", ""),
        "elevator_spec": p.get("elevator_spec", ""),
        "requested_date": p.get("requested_date", datetime.utcnow().isoformat()[:10]),
        "submitted_at": None,
        "submitted_date": None,
        "revision": 0,
        "status": "Pending",
        "notes": p.get("notes", ""),
        "created_at": datetime.utcnow().isoformat(),
    }
    GAD_RECORDS.append(record)
    _save_module(GAD_RECORDS_FILE, GAD_RECORDS)
    return jsonify({"ok": True, "item": record, "data": GAD_RECORDS}), 201


@app.patch("/api/portal/gad/<gad_id>")
@login_required
def update_gad_record(gad_id: str):
    p, _, _ = _dept_payload()
    rec = next((r for r in GAD_RECORDS if r["id"] == gad_id), None)
    if not rec:
        return jsonify({"ok": False, "message": "Not found"}), 404
    for k in ("status", "notes", "elevator_spec", "ref_id", "ref_type"):
        if k in p:
            rec[k] = p[k]
    if p.get("action") == "submit":
        rec["status"] = "Submitted"
        rec["submitted_date"] = datetime.utcnow().isoformat()[:10]
        rec["submitted_at"] = datetime.utcnow().isoformat()
    elif p.get("action") == "revise":
        rec["status"] = "In Progress"
        rec["revision"] = rec.get("revision", 0) + 1
        rec["notes"] = p.get("notes", rec.get("notes", ""))
    else:
        for k in ("status", "notes", "elevator_spec", "ref_id", "ref_no", "ref_type", "drawing_no"):
            if k in p:
                rec[k] = p[k]
    _save_module(GAD_RECORDS_FILE, GAD_RECORDS)
    return jsonify({"ok": True, "item": rec, "data": GAD_RECORDS})


# ── Commissioning ─────────────────────────────────────────────────────────────

@app.get("/api/portal/commissioning")
@login_required
def list_commissionings():
    return jsonify({"ok": True, "records": COMMISSIONINGS})


@app.post("/api/portal/commissioning")
@login_required
def create_commissioning():
    p, _, _ = _dept_payload()
    record = {
        "id": _next_id(COMMISSIONINGS, "COM"),
        "unit": p.get("unit", ""),
        "job_ref": p.get("job_ref", p.get("installation_ref", "")),
        "installation_ref": p.get("installation_ref", p.get("job_ref", "")),
        "customer": p.get("customer", ""),
        "site": p.get("site", ""),
        "install_complete_date": p.get("install_complete_date", ""),
        "payment_cleared": p.get("payment_cleared", False),
        "start_date": p.get("start_date") or None,
        "handover_date": None,
        "status": "Pending",
        "notes": p.get("notes", ""),
        "created_at": datetime.utcnow().isoformat(),
    }
    COMMISSIONINGS.append(record)
    _save_module(COMMISSIONINGS_FILE, COMMISSIONINGS)
    return jsonify({"ok": True, "item": record, "data": COMMISSIONINGS}), 201


@app.patch("/api/portal/commissioning/<com_id>")
@login_required
def update_commissioning(com_id: str):
    p, _, _ = _dept_payload()
    rec = next((r for r in COMMISSIONINGS if r["id"] == com_id), None)
    if not rec:
        return jsonify({"ok": False, "message": "Not found"}), 404
    for k in ("status", "notes", "payment_cleared", "install_complete_date"):
        if k in p:
            rec[k] = p[k]
    now = datetime.utcnow().isoformat()[:10]
    if p.get("action") == "start":
        rec["status"] = "In Progress"
        rec["start_date"] = rec["start_date"] or now
    elif p.get("action") == "handover":
        rec["status"] = "Handed Over"
        rec["handover_date"] = rec["handover_date"] or now
    _save_module(COMMISSIONINGS_FILE, COMMISSIONINGS)
    return jsonify({"ok": True, "item": rec, "data": COMMISSIONINGS})


# ── Factory Jobs ──────────────────────────────────────────────────────────────

@app.get("/api/portal/factory")
@login_required
def list_factory_jobs():
    return jsonify({"ok": True, "jobs": FACTORY_JOBS})


@app.post("/api/portal/factory")
@login_required
def create_factory_job():
    p, _, _ = _dept_payload()
    record = {
        "id": _next_id(FACTORY_JOBS, "FAC"),
        "order_ref": p.get("order_ref", ""),
        "customer": p.get("customer", ""),
        "materials": p.get("materials", p.get("components", "")),
        "components": p.get("components", p.get("materials", "")),
        "stage": p.get("stage", p.get("production_status", "Material Procurement")),
        "production_status": p.get("production_status", p.get("stage", "Material Procurement")),
        "target_date": p.get("target_date", ""),
        "dispatched_at": None,
        "dispatched_date": None,
        "notes": p.get("notes", ""),
        "created_at": datetime.utcnow().isoformat(),
    }
    FACTORY_JOBS.append(record)
    _save_module(FACTORY_JOBS_FILE, FACTORY_JOBS)
    return jsonify({"ok": True, "item": record, "data": FACTORY_JOBS}), 201


@app.patch("/api/portal/factory/<job_id>")
@login_required
def update_factory_job(job_id: str):
    p, _, _ = _dept_payload()
    rec = next((r for r in FACTORY_JOBS if r["id"] == job_id), None)
    if not rec:
        return jsonify({"ok": False, "message": "Not found"}), 404
    if p.get("action") == "dispatch":
        rec["stage"] = "Dispatched"
        rec["production_status"] = "Dispatched"
        rec["dispatched_date"] = datetime.utcnow().isoformat()[:10]
        rec["dispatched_at"] = datetime.utcnow().isoformat()
    else:
        for k in ("stage", "production_status", "materials", "components", "target_date", "notes"):
            if k in p:
                rec[k] = p[k]
        if "stage" in p:
            rec["production_status"] = p["stage"]
        if "production_status" in p:
            rec["stage"] = p["production_status"]
    _save_module(FACTORY_JOBS_FILE, FACTORY_JOBS)
    return jsonify({"ok": True, "item": rec, "data": FACTORY_JOBS})


# ── Tenders ───────────────────────────────────────────────────────────────────

@app.get("/api/portal/tender")
@login_required
def list_tenders():
    return jsonify({"ok": True, "tenders": TENDERS})


@app.post("/api/portal/tender")
@login_required
def create_tender():
    p, _, _ = _dept_payload()
    record = {
        "id": _next_id(TENDERS, "TDR"),
        "name": p.get("name", p.get("title", "")),
        "title": p.get("title", p.get("name", "")),
        "source": p.get("source", ""),
        "keywords": p.get("keywords", ""),
        "published_date": p.get("published_date", ""),
        "submitted_date": p.get("submitted_date", p.get("submission_date", "")),
        "submission_date": p.get("submission_date", p.get("submitted_date", "")),
        "value": p.get("value", p.get("value_estimate", 0)),
        "value_estimate": p.get("value_estimate", p.get("value", 0)),
        "qty": p.get("qty", 1),
        "party": p.get("party", ""),
        "status": "Tracking",
        "result": "Submitted",
        "notes": p.get("notes", ""),
        "created_at": datetime.utcnow().isoformat(),
    }
    TENDERS.append(record)
    _save_module(TENDERS_FILE, TENDERS)
    return jsonify({"ok": True, "item": record, "data": TENDERS}), 201


@app.patch("/api/portal/tender/<tdr_id>")
@login_required
def update_tender(tdr_id: str):
    p, _, _ = _dept_payload()
    rec = next((r for r in TENDERS if r["id"] == tdr_id), None)
    if not rec:
        return jsonify({"ok": False, "message": "Not found"}), 404
    for k in ("name", "title", "source", "keywords", "submitted_date", "submission_date",
              "value", "value_estimate", "qty", "party", "status", "result", "notes"):
        if k in p:
            rec[k] = p[k]
    if "result" in p:
        rec["status"] = "Closed"
    _save_module(TENDERS_FILE, TENDERS)
    return jsonify({"ok": True, "item": rec, "data": TENDERS})


# ── Inter-Department Communications ──────────────────────────────────────────

@app.get("/api/portal/comms")
@login_required
def list_comms():
    dept = session.get("portal_department", "")
    role = session.get("portal_role", "technician")
    if role == "admin" or not dept:
        msgs = DEPT_COMMS
    else:
        msgs = [m for m in DEPT_COMMS if dept in m.get("to_depts", []) or m.get("from_dept") == dept]
    return jsonify({"ok": True, "data": msgs, "messages": msgs, "my_dept": dept})


@app.post("/api/portal/comms")
@login_required
def send_comms():
    p, dept, user = _dept_payload()
    name = session.get("portal_name", user)
    now = datetime.utcnow().isoformat()
    to_depts = p.get("to_depts", [])
    if isinstance(to_depts, str):
        to_depts = [d.strip() for d in to_depts.split(",") if d.strip()]
    record = {
        "id": _next_id(DEPT_COMMS, "MSG"),
        "from_dept": dept or "Executive Office",
        "from_user": user,
        "from_name": name,
        "to_depts": to_depts,
        "subject": p.get("subject", ""),
        "body": p.get("body", ""),
        "priority": p.get("priority", "Normal"),
        "timestamp": now,
        "read_by": [],
    }
    DEPT_COMMS.append(record)
    _save_module(DEPT_COMMS_FILE, DEPT_COMMS)
    dept_view = [m for m in DEPT_COMMS if dept in m.get("to_depts", []) or m.get("from_dept") == dept] if dept else DEPT_COMMS
    return jsonify({"ok": True, "item": record, "data": dept_view}), 201


@app.post("/api/portal/comms/<msg_id>/read")
@login_required
def mark_comms_read(msg_id: str):
    user = session.get("portal_user", "")
    rec = next((m for m in DEPT_COMMS if m["id"] == msg_id), None)
    if not rec:
        return jsonify({"ok": False, "message": "Not found"}), 404
    if user not in rec.get("read_by", []):
        rec.setdefault("read_by", []).append(user)
    _save_module(DEPT_COMMS_FILE, DEPT_COMMS)
    return jsonify({"ok": True})


# ── Customer Portal Routes ──────────────────────────────────────────────────────

@app.route("/customer/login", methods=["GET", "POST"])
def customer_login():
    if session.get("customer_user"):
        return redirect(url_for("customer_dashboard"))
    error = None
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        cu = find_customer_user(username)
        if cu and cu.get("active", True) and check_password_hash(cu.get("password_hash", ""), password):
            if cu.get("must_change_password"):
                session["customer_user"] = cu["username"]
                return redirect(url_for("customer_force_password_change"))
            session["customer_user"] = cu["username"]
            cu["onboarded"] = True
            save_customer_users()
            return redirect(url_for("customer_dashboard"))
        error = "Invalid username or password."
    return render_template("customer_login.html", error=error, password_change_required=False)


@app.route("/customer/change-password", methods=["GET", "POST"])
@customer_login_required
def customer_force_password_change():
    cu = current_customer_user()
    if cu is None:
        return redirect(url_for("customer_login"))
    error = None
    if request.method == "POST":
        current_pw = request.form.get("current_password", "")
        new_pw = request.form.get("new_password", "")
        confirm_pw = request.form.get("confirm_password", "")
        if not check_password_hash(cu.get("password_hash", ""), current_pw):
            error = "Current password is incorrect."
        elif len(new_pw) < 8:
            error = "New password must be at least 8 characters."
        elif new_pw != confirm_pw:
            error = "Passwords do not match."
        else:
            cu["password_hash"] = generate_password_hash(new_pw)
            cu["must_change_password"] = False
            cu["onboarded"] = True
            save_customer_users()
            return redirect(url_for("customer_dashboard"))
    return render_template("customer_login.html", error=error, password_change_required=True,
                           username=cu.get("username", ""), user_display_name=cu.get("display_name", ""))


@app.get("/customer/dashboard")
@customer_login_required
def customer_dashboard():
    cu = current_customer_user()
    customer_id = cu.get("customer_id", "") if cu else ""
    my_estimates = [e for e in ESTIMATES if e.get("customer_id") == customer_id and e.get("status") in ("Sent", "Accepted", "Rejected")]
    my_tickets = [t for t in PROJECT_TICKETS if customer_id and customer_id in t.get("notes", "")]
    customer_rec = next((c for c in CUSTOMERS if c.get("id") == customer_id), {})
    my_payments = [p for p in PAYMENTS if p.get("customer_id") == customer_id]
    customer_name = str(customer_rec.get("name", "")).strip().lower()
    my_service_records = [
        s for s in SERVICE_RECORDS
        if s.get("status") == "Completed"
        and (
            (customer_id and s.get("customer_id") == customer_id)
            or (customer_name and str(s.get("customer", "")).strip().lower() == customer_name)
        )
    ]
    if customer_rec.get("service_history"):
        known_ids = {s.get("id") for s in my_service_records}
        for item in customer_rec.get("service_history", []):
            if item.get("id") not in known_ids:
                my_service_records.append(item)
    est_ids = {e["id"] for e in my_estimates}
    my_payment_summaries = {eid: payment_summary(eid) for eid in est_ids}
    total_contract = sum(e.get("total_cost", 0) for e in my_estimates)
    total_received = sum(p.get("amount", 0) for p in my_payments if p.get("status") == "Paid")
    total_outstanding = sum(p.get("amount", 0) for p in my_payments if p.get("status") in ("Due", "Overdue", "Partial"))
    return render_template("customer_dashboard.html",
                           customer_user=cu,
                           customer=customer_rec,
                           estimates=my_estimates,
                           tickets=my_tickets,
                           service_records=my_service_records,
                           payments=my_payments,
                           payment_summaries=my_payment_summaries,
                           total_contract=total_contract,
                           total_received=total_received,
                           total_outstanding=total_outstanding)


@app.get("/customer/quote/<est_id>")
@customer_login_required
def customer_view_quote(est_id: str):
    cu = current_customer_user()
    est = next((e for e in ESTIMATES if e.get("id") == est_id), None)
    if est is None or est.get("customer_id") != cu.get("customer_id"):
        return redirect(url_for("customer_dashboard"))
    return _estimate_html_report(est), 200, {"Content-Type": "text/html"}


@app.post("/customer/quote/<est_id>/respond")
@customer_login_required
def customer_respond_quote(est_id: str):
    cu = current_customer_user()
    est = next((e for e in ESTIMATES if e.get("id") == est_id), None)
    if est is None or est.get("customer_id") != cu.get("customer_id"):
        return jsonify({"ok": False, "message": "Not found."}), 404
    action = request.form.get("action", "")
    if action in ("accept", "reject"):
        est["status"] = "Accepted" if action == "accept" else "Rejected"
        save_estimates()
    return redirect(url_for("customer_dashboard"))


@app.get("/api/portal/payments")
@login_required
def get_payments():
    estimate_id = request.args.get("estimate_id", "")
    customer_id = request.args.get("customer_id", "")
    rows = PAYMENTS
    if estimate_id:
        rows = [p for p in rows if p.get("estimate_id") == estimate_id]
    if customer_id:
        rows = [p for p in rows if p.get("customer_id") == customer_id]
    return jsonify({"ok": True, "payments": rows})


@app.post("/api/portal/payments")
@login_required
def create_payment():
    payload = request.get_json(silent=True) or {}
    estimate_id = payload.get("estimate_id", "").strip()
    if not estimate_id:
        return jsonify({"ok": False, "message": "estimate_id is required."}), 400
    est = next((e for e in ESTIMATES if e.get("id") == estimate_id), None)
    if est is None:
        return jsonify({"ok": False, "message": "Estimate not found."}), 404
    viewer = current_user() or {}
    payment = {
        "id": next_payment_id(),
        "estimate_id": estimate_id,
        "customer_id": est.get("customer_id", ""),
        "customer_name": est.get("customer_name", ""),
        "milestone": payload.get("milestone", "Payment").strip(),
        "amount": float(payload.get("amount", 0)),
        "due_date": payload.get("due_date", "").strip(),
        "paid_date": payload.get("paid_date", "").strip(),
        "status": payload.get("status", "Due"),
        "payment_method": payload.get("payment_method", "").strip(),
        "reference": payload.get("reference", "").strip(),
        "notes": payload.get("notes", "").strip(),
        "created_by": viewer.get("id", ""),
        "created_at": now_stamp(),
    }
    PAYMENTS.append(payment)
    save_payments()
    return jsonify({"ok": True, "payment": payment, "summary": payment_summary(estimate_id)})


@app.post("/api/portal/payments/auto-schedule")
@login_required
def auto_schedule_payments():
    payload = request.get_json(silent=True) or {}
    estimate_id = payload.get("estimate_id", "").strip()
    est = next((e for e in ESTIMATES if e.get("id") == estimate_id), None)
    if est is None:
        return jsonify({"ok": False, "message": "Estimate not found."}), 404
    existing = [p for p in PAYMENTS if p.get("estimate_id") == estimate_id]
    if existing:
        return jsonify({"ok": False, "message": "Payments already exist for this estimate. Delete them first."}), 409
    total = est.get("total_cost", 0)
    viewer = current_user() or {}
    start_date = payload.get("start_date", datetime.now().strftime("%Y-%m-%d"))
    created = []
    from datetime import date, timedelta
    base = date.fromisoformat(start_date)
    offsets = [0, 30, 60, 90]
    for (label, pct), offset in zip(PAYMENT_MILESTONES, offsets):
        amount = round(total * pct)
        p = {
            "id": next_payment_id(),
            "estimate_id": estimate_id,
            "customer_id": est.get("customer_id", ""),
            "customer_name": est.get("customer_name", ""),
            "milestone": label,
            "amount": amount,
            "due_date": (base + timedelta(days=offset)).isoformat(),
            "paid_date": "",
            "status": "Due",
            "payment_method": "",
            "reference": "",
            "notes": "",
            "created_by": viewer.get("id", ""),
            "created_at": now_stamp(),
        }
        PAYMENTS.append(p)
        created.append(p)
    save_payments()
    return jsonify({"ok": True, "payments": created, "summary": payment_summary(estimate_id)})


@app.patch("/api/portal/payments/<pay_id>")
@login_required
def update_payment(pay_id: str):
    payment = next((p for p in PAYMENTS if p.get("id") == pay_id), None)
    if payment is None:
        return jsonify({"ok": False, "message": "Payment not found."}), 404
    payload = request.get_json(silent=True) or {}
    for field in ("milestone", "amount", "due_date", "paid_date", "status", "payment_method", "reference", "notes"):
        if field in payload:
            payment[field] = payload[field]
    save_payments()
    return jsonify({"ok": True, "payment": payment, "summary": payment_summary(payment["estimate_id"])})


@app.delete("/api/portal/payments/<pay_id>")
@login_required
def delete_payment(pay_id: str):
    global PAYMENTS
    payment = next((p for p in PAYMENTS if p.get("id") == pay_id), None)
    if payment is None:
        return jsonify({"ok": False, "message": "Payment not found."}), 404
    estimate_id = payment["estimate_id"]
    PAYMENTS = [p for p in PAYMENTS if p.get("id") != pay_id]
    save_payments()
    return jsonify({"ok": True, "summary": payment_summary(estimate_id)})


@app.get("/customer/logout")
def customer_logout():
    session.pop("customer_user", None)
    return redirect(url_for("customer_login"))


@app.get("/api/portal/org-chart")
@login_required
def get_org_chart():
    return jsonify({"ok": True, "org_chart": refresh_org_chart()})


@app.post("/api/portal/org-chart")
@login_required
@admin_required
def create_org_node():
    refresh_org_chart()
    payload = request.get_json(silent=True) or {}
    name = payload.get("name", "").strip()
    if not name:
        return jsonify({"ok": False, "message": "Name is required."}), 400
    node = {
        "id": next_org_node_id(),
        "name": name,
        "title": payload.get("title", "").strip(),
        "department": payload.get("department", "").strip(),
        "reports_to": payload.get("reports_to") or None,
        "user_id": payload.get("user_id", "").strip(),
        "phone": payload.get("phone", "").strip(),
        "email": payload.get("email", "").strip(),
    }
    ORG_CHART.append(node)
    save_org_chart()
    return jsonify({"ok": True, "node": node})


@app.patch("/api/portal/org-chart/<node_id>")
@login_required
@admin_required
def update_org_node(node_id: str):
    refresh_org_chart()
    node = next((n for n in ORG_CHART if n.get("id") == node_id), None)
    if node is None:
        return jsonify({"ok": False, "message": "Node not found."}), 404
    payload = request.get_json(silent=True) or {}
    for field in ("name", "title", "department", "phone", "email", "user_id"):
        if field in payload:
            node[field] = payload[field]
    if "reports_to" in payload:
        node["reports_to"] = payload["reports_to"] or None
    save_org_chart()
    return jsonify({"ok": True, "node": node})


@app.delete("/api/portal/org-chart/<node_id>")
@login_required
@admin_required
def delete_org_node(node_id: str):
    global ORG_CHART
    refresh_org_chart()
    node = next((n for n in ORG_CHART if n.get("id") == node_id), None)
    if node is None:
        return jsonify({"ok": False, "message": "Node not found."}), 404
    # Re-parent direct reports to this node's parent
    parent_id = node.get("reports_to")
    for n in ORG_CHART:
        if n.get("reports_to") == node_id:
            n["reports_to"] = parent_id
    ORG_CHART = [n for n in ORG_CHART if n.get("id") != node_id]
    save_org_chart()
    return jsonify({"ok": True})


@app.get("/api/portal/attendance")
@login_required
def get_attendance():
    date_filter = request.args.get("date", datetime.now().strftime("%Y-%m-%d"))
    person_filter = request.args.get("person_id", "")
    records = [r for r in ATTENDANCE if r.get("date") == date_filter]
    if person_filter:
        records = [r for r in records if r.get("person_id") == person_filter]
    return jsonify({"ok": True, "records": records, "date": date_filter})


@app.post("/api/portal/attendance")
@login_required
def mark_attendance():
    payload = request.get_json(silent=True) or {}
    person_id = payload.get("person_id", "").strip()
    date = payload.get("date", datetime.now().strftime("%Y-%m-%d"))
    if not person_id:
        return jsonify({"ok": False, "message": "person_id is required."}), 400
    node = next((n for n in ORG_CHART if n.get("id") == person_id), None)
    if node is None:
        return jsonify({"ok": False, "message": "Person not found in org chart."}), 404
    viewer = current_user() or {}
    viewer_role = viewer.get("role", "technician")
    viewer_dept = viewer.get("department", "")
    if viewer_role != "admin" and viewer_dept != node.get("department"):
        return jsonify({"ok": False, "message": "You can only mark attendance for your own department."}), 403
    existing = next((r for r in ATTENDANCE if r.get("person_id") == person_id and r.get("date") == date), None)
    if existing:
        for field in ("status", "check_in", "check_out", "notes"):
            if field in payload:
                existing[field] = payload[field]
        existing["marked_by"] = viewer.get("id", "")
        existing["marked_at"] = now_stamp()
        save_attendance()
        send_business_channel_update(
            "FUZI_OPENCLAW_TARGET_ENGINEER_ATTENDANCE",
            f"Attendance updated for {existing.get('person_name', 'engineer')}.",
            [
                f"Date: {existing.get('date', date)}.",
                f"Status: {existing.get('status', 'present')}.",
                f"Check-in/out: {existing.get('check_in', '-') or '-'} to {existing.get('check_out', '-') or '-'}.",
            ],
            event_type="attendance-update",
        )
        send_metrics_channel_snapshot("attendance-updated")
        return jsonify({"ok": True, "record": existing})
    record = {
        "id": next_attendance_id(),
        "date": date,
        "person_id": person_id,
        "person_name": node.get("name", ""),
        "department": node.get("department", ""),
        "status": payload.get("status", "present"),
        "check_in": payload.get("check_in", ""),
        "check_out": payload.get("check_out", ""),
        "notes": payload.get("notes", ""),
        "marked_by": viewer.get("id", ""),
        "marked_at": now_stamp(),
    }
    ATTENDANCE.append(record)
    save_attendance()
    send_business_channel_update(
        "FUZI_OPENCLAW_TARGET_ENGINEER_ATTENDANCE",
        f"Attendance marked for {record.get('person_name', 'engineer')}.",
        [
            f"Date: {record.get('date', date)}.",
            f"Status: {record.get('status', 'present')}.",
            f"Department: {record.get('department', 'Unknown')}.",
        ],
        event_type="attendance-update",
    )
    send_metrics_channel_snapshot("attendance-marked")
    return jsonify({"ok": True, "record": record})


@app.patch("/api/portal/attendance/<record_id>")
@login_required
def update_attendance(record_id: str):
    record = next((r for r in ATTENDANCE if r.get("id") == record_id), None)
    if record is None:
        return jsonify({"ok": False, "message": "Record not found."}), 404
    viewer = current_user() or {}
    viewer_role = viewer.get("role", "technician")
    viewer_dept = viewer.get("department", "")
    if viewer_role != "admin" and viewer_dept != record.get("department"):
        return jsonify({"ok": False, "message": "You can only edit attendance for your own department."}), 403
    payload = request.get_json(silent=True) or {}
    for field in ("status", "check_in", "check_out", "notes"):
        if field in payload:
            record[field] = payload[field]
    record["marked_by"] = viewer.get("id", "")
    record["marked_at"] = now_stamp()
    save_attendance()
    send_business_channel_update(
        "FUZI_OPENCLAW_TARGET_ENGINEER_ATTENDANCE",
        f"Attendance updated for {record.get('person_name', 'engineer')}.",
        [
            f"Date: {record.get('date', 'Today')}.",
            f"Status: {record.get('status', 'present')}.",
            f"Check-in/out: {record.get('check_in', '-') or '-'} to {record.get('check_out', '-') or '-'}.",
        ],
        event_type="attendance-update",
    )
    send_metrics_channel_snapshot("attendance-patched")
    return jsonify({"ok": True, "record": record})


if __name__ == "__main__":
    app.run(debug=True, port=5000, use_reloader=False)
