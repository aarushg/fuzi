from __future__ import annotations

from datetime import datetime
from functools import wraps
import json
import math
import os
from pathlib import Path
import re
import socket
import subprocess
import threading
from typing import Any
from urllib import error as urllib_error
from urllib import parse as urllib_parse
from urllib import request as urllib_request

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
INVENTORY_FILE = BASE_DIR / "inventory.json"
OPERATIONS_STATE_FILE = BASE_DIR / "operations_state.json"
ORG_CHART_FILE = BASE_DIR / "org_chart.json"
ATTENDANCE_FILE = BASE_DIR / "attendance.json"
ESTIMATES_FILE = BASE_DIR / "estimates.json"
CUSTOMER_USERS_FILE = BASE_DIR / "customer_users.json"
PAYMENTS_FILE = BASE_DIR / "payments.json"
SMTP_HOST = os.environ.get("FUZI_SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("FUZI_SMTP_PORT", "587"))
SMTP_USER = os.environ.get("FUZI_SMTP_USER", "")
SMTP_PASS = os.environ.get("FUZI_SMTP_PASS", "")
SMTP_FROM = os.environ.get("FUZI_SMTP_FROM", SMTP_USER)
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
REFRESH_INTERVAL_MINUTES = max(math.ceil(MONITOR_INTERVAL_SECONDS / 60), 1)
STATE_LOCK = threading.Lock()
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
    "Service Control",
    "Project Office",
    "Install Operations",
    "Stores & Procurement",
    "Sales & Renewals",
    "Customer Success",
]

DEPARTMENT_MANAGER_SEEDS: list[dict[str, str]] = [
    {"department": "Service Control", "username": "service.control.manager", "display_name": "Service Control Manager"},
    {"department": "Project Office", "username": "project.office.manager", "display_name": "Project Office Manager"},
    {"department": "Install Operations", "username": "install.ops.manager", "display_name": "Install Operations Manager"},
    {"department": "Stores & Procurement", "username": "stores.procurement.manager", "display_name": "Stores & Procurement Manager"},
    {"department": "Sales & Renewals", "username": "sales.renewals.manager", "display_name": "Sales & Renewals Manager"},
    {"department": "Customer Success", "username": "customer.success.manager", "display_name": "Customer Success Manager"},
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
                "discord_cursors": {"crm_query_last_message_id": ""},
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

    if role == "admin" or department == "Executive Office":
        allowed_views = list(DASHBOARD_VIEW_ORDER)
        default_view = "overview"
    else:
        department_views = {
            "Service Control": ["fleet", "messages", "orgchart"],
            "Project Office": ["tickets", "projects", "orgchart"],
            "Install Operations": ["installations", "team", "orgchart"],
            "Stores & Procurement": ["inventory", "orgchart"],
            "Sales & Renewals": ["customers", "renewals", "estimator", "orgchart"],
            "Customer Success": ["customers", "messages", "workorders", "estimator", "orgchart"],
        }
        allowed_views = list(department_views.get(department, ["overview"]))
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

ELEVATOR_TYPES: list[str] = [
    "Passenger (Commercial)", "Residential MRL", "Residential Hydraulic",
    "Hospital / Stretcher", "Industrial / Goods", "Panoramic / Glass",
    "Dumbwaiter", "Escalator",
]
CAPACITY_OPTIONS: list[str] = [
    "6-person (480 kg)", "8-person (630 kg)", "10-person (800 kg)",
    "13-person (1000 kg)", "15-person (1200 kg)", "20-person (1600 kg)",
    "26-person (2000 kg)",
]
DRIVE_OPTIONS: list[str] = ["Hydraulic", "Geared Traction", "Gearless MRL", "VFD Traction"]
FINISH_OPTIONS: list[str] = ["Basic (MS)", "Standard (MS)", "Premium (SS)", "Custom / Bespoke (SS)"]
DOOR_OPTIONS: list[str] = ["Manual SS", "Automatic SS", "Automatic Glass", "Fire-Rated"]
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
    gearless = drive in ("Gearless MRL", "VFD Traction")
    cabin_ss = "SS" in finish or finish in ("Premium", "Custom / Bespoke")
    door_auto = door in ("Automatic SS", "Automatic Glass")
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
    raw = str(data.get("capacity", "8-person (630 kg)"))
    m = _re.match(r"(\d+)", raw)
    raw_cap = int(m.group(1)) if m else 8
    excel_cap = next((c for c in EXCEL_CAPACITY_ORDER if raw_cap <= c), 26)

    config_key = _excel_config_key(
        data.get("drive_type", "Geared Traction"),
        data.get("cabin_finish", "Standard (MS)"),
        data.get("door_type", "Automatic SS"),
    )
    cd = COMPONENT_DATA[str(excel_cap)][config_key]
    num_stops = max(2, min(int(data.get("num_floors", 4)), 10))

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

    # LOP/COP: lookup by stops
    lopcop_cost = LOPCOP_BY_STOPS.get(num_stops, LOPCOP_BY_STOPS[10])
    items.append(_li("LOP / COP Panel", 1, "set", lopcop_cost))

    # Rope: base metres at 4 stops, scaled linearly for other stop counts
    # Formula: total_m = base_4stops + (stops - 4) * (floor_height_m * num_ropes)
    floor_h_m = FLOOR_HEIGHT_MM / 1000.0
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


def send_estimate_email(estimate: dict) -> dict[str, Any]:
    """Send estimate report via SMTP if configured, otherwise return mailto info."""
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    to_email = estimate.get("sent_to_email", "")
    if not to_email:
        return {"ok": False, "message": "No recipient email on estimate."}
    html_body = _estimate_html_report(estimate)
    subject = f"FUZI Elevators — Quotation {estimate['id']} for {estimate.get('site', estimate.get('customer_name', ''))}"
    if SMTP_HOST:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = SMTP_FROM
            msg["To"] = to_email
            msg.attach(MIMEText(html_body, "html"))
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as srv:
                srv.starttls()
                if SMTP_USER:
                    srv.login(SMTP_USER, SMTP_PASS)
                srv.sendmail(SMTP_FROM, [to_email], msg.as_string())
            return {"ok": True, "method": "smtp", "to": to_email}
        except Exception as exc:
            return {"ok": False, "message": str(exc)}
    return {"ok": True, "method": "mailto", "to": to_email, "subject": subject}


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


def discord_api_json(method: str, path: str, payload: dict[str, Any] | None = None, reason: str = "") -> dict[str, Any]:
    token = load_openclaw_discord_token()
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


def poll_crm_query_discord_channel() -> None:
    target = resolve_openclaw_runtime_value("FUZI_OPENCLAW_TARGET_CRM_QUERY", "")
    channel_id = discord_channel_id_from_target(target)
    if not channel_id:
        return

    messages = discord_api_json("GET", f"/channels/{channel_id}/messages?limit=10")
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


def ensure_discord_agent_channels(guild_id: str) -> dict[str, Any]:
    if not guild_id.strip():
        raise RuntimeError("Set FUZI_DISCORD_GUILD_ID to the Discord server ID before provisioning agent channels.")

    reason = "Provision FUZI operational agent channels"
    channels = discord_api_json("GET", f"/guilds/{guild_id}/channels")
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
        category = discord_api_json(
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
    for spec in DISCORD_AGENT_CHANNEL_SPECS:
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
            channel = discord_api_json(
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
            for spec in DISCORD_AGENT_CHANNEL_SPECS
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
        "metadata": {
            "source": request_payload.get("source", "fuzi-operations-portal"),
            "event_type": request_payload.get("event_type", ""),
            "timestamp": request_payload.get("timestamp", ""),
        },
    }


class OpenClawMessageBackend:
    def send_message(self, channel: str, target: str, message: str, request_payload: dict[str, Any]) -> dict[str, Any]:
        return annotate_openclaw_result(
            post_openclaw_json(
                "/tools/invoke",
                build_openclaw_message_payload(channel, target, message, request_payload),
            )
        )


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
        threading.Event().wait(DISCORD_POLL_INTERVAL_SECONDS)


def ensure_background_monitor() -> None:
    with STATE_LOCK:
        start_scheduler = not RUNTIME_STATE["scheduler_started"]
        start_discord_listener = not RUNTIME_STATE["discord_listener_started"]
        if start_scheduler:
            RUNTIME_STATE["scheduler_started"] = True
        if start_discord_listener:
            RUNTIME_STATE["discord_listener_started"] = True
    if start_scheduler:
        thread = threading.Thread(target=background_monitor_loop, name="fuzi-agent-monitor", daemon=True)
        thread.start()
    if start_discord_listener:
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
        "org_chart": ORG_CHART,
        "attendance_today": [r for r in ATTENDANCE if r.get("date") == datetime.now().strftime("%Y-%m-%d")],
        "estimates": ESTIMATES,
        "payments": PAYMENTS,
        "payment_statuses": list(PAYMENT_STATUSES),
        "payment_methods": list(PAYMENT_METHODS),
        "elevator_types": ELEVATOR_TYPES,
        "capacity_options": CAPACITY_OPTIONS,
        "finish_options": FINISH_OPTIONS,
        "door_options": DOOR_OPTIONS,
        "drive_options": DRIVE_OPTIONS,
        "control_options": CONTROL_OPTIONS,
        "addon_options": list(ADDON_COSTS.keys()),
        "customer_users": [_public_customer_user(u) for u in CUSTOMER_USERS],
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
    return render_template("login.html", error=error)


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
    costs = calculate_estimate(payload)
    viewer = current_user() or {}
    estimate = {
        "id": next_estimate_id(),
        "customer_id": payload.get("customer_id", ""),
        "customer_name": payload.get("customer_name", "").strip(),
        "site": payload.get("site", "").strip(),
        "elevator_type": payload.get("elevator_type", "Residential MRL"),
        "capacity": payload.get("capacity", "8-person (630 kg)"),
        "num_floors": int(payload.get("num_floors", 2)),
        "drive_type": payload.get("drive_type", "Gearless MRL"),
        "cabin_finish": payload.get("cabin_finish", "Standard"),
        "door_type": payload.get("door_type", "Automatic SS"),
        "control_type": payload.get("control_type", "Microprocessor"),
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
        "created_by": viewer.get("id", ""),
        "created_at": now_stamp(),
    }
    ESTIMATES.append(estimate)
    save_estimates()
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


@app.post("/api/portal/estimates/<est_id>/send")
@login_required
def send_estimate(est_id: str):
    est = next((e for e in ESTIMATES if e.get("id") == est_id), None)
    if est is None:
        return jsonify({"ok": False, "message": "Estimate not found."}), 404
    payload = request.get_json(silent=True) or {}
    if payload.get("email"):
        est["sent_to_email"] = payload["email"]
    result = send_estimate_email(est)
    if result.get("ok"):
        est["status"] = "Sent"
        est["sent_at"] = now_stamp()
        save_estimates()
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
    return jsonify({"ok": True, "org_chart": ORG_CHART})


@app.post("/api/portal/org-chart")
@login_required
@admin_required
def create_org_node():
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
    return jsonify({"ok": True, "record": record})


if __name__ == "__main__":
    ensure_background_monitor()
    app.run(debug=True, port=5000, use_reloader=False)
