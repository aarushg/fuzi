# FUZI Operations Portal

Flask-powered operations and customer portal for FUZI Classic Elevators. The public website is served from static HTML files, while `/portal` provides a protected staff dashboard and `/customer` provides a separate customer-facing portal for quotes, payment tracking, and project status.

---

## Quick Start

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python app.py
```

| URL | Description |
|---|---|
| `http://127.0.0.1:5000/portal/login` | Staff operations portal |
| `http://127.0.0.1:5000/customer/login` | Customer self-service portal |

**Default admin credentials:**
```
Username: admin
Password: fuzi2026
```

The first run auto-creates technician accounts for the install team and department manager accounts, all with the temporary password `ChangeMe123!`. Reset these from the Team Accounts screen before sharing with your team.

Override defaults with environment variables before `users.json` is created:
```bash
FUZI_PORTAL_USER=your_user FUZI_PORTAL_PASSWORD=your_password FUZI_SECRET_KEY=your_secret .venv/bin/python app.py
```

---

## Main Files

| File | Purpose |
|---|---|
| `app.py` | Flask app, auth, all routes, API endpoints, JSON persistence |
| `templates/login.html` | Staff portal login / password-change page |
| `templates/dashboard.html` | Staff operations dashboard (single-page) |
| `templates/customer_login.html` | Customer portal login / first-use password change |
| `templates/customer_dashboard.html` | Customer self-service dashboard |
| `static/portal.css` | Staff portal styling |
| `static/portal.js` | Staff portal interactivity |
| `static/customer.css` | Customer portal styling |
| `users.json` | Staff portal accounts (hashed passwords) |
| `customers.json` | Customer / building records |
| `customer_users.json` | Customer portal login accounts (hashed passwords) |
| `project_tickets.json` | Project ticket data |
| `install_jobs.json` | Installation job progress |
| `install_team.json` | Install technician roster and assignments |
| `inventory.json` | Parts and materials inventory |
| `estimates.json` | Elevator costing estimates and bid reports |
| `payments.json` | Payment milestones, receipts, and follow-up records |
| `org_chart.json` | Company org chart nodes |
| `attendance.json` | Daily staff attendance records |
| `operations_state.json` | Live fleet, project, renewal, message, and work-order snapshots |

---

## Staff Portal Features

### Authentication & Role-Based Access

- Session-protected login with Werkzeug-hashed passwords.
- Roles: `admin`, `manager`, `technician`.
- Admins and Executive Office users see all 15 dashboard views.
- Department managers land on a focused workspace:
  - `Service Control` → Fleet Monitor, Service Agent, Staff & Attendance
  - `Project Office` → Project Tickets, Projects, Staff & Attendance
  - `Install Operations` → Installations, Install Team, Staff & Attendance
  - `Stores & Procurement` → Inventory, Staff & Attendance
  - `Sales & Renewals` → Customers, Renewals, Costing Estimator, Staff & Attendance
  - `Customer Success` → Customers, Service Agent, Work Orders, Costing Estimator, Staff & Attendance
- First-use accounts are blocked until the user rotates their temporary password.
- Admin can reset any team password from the Team Accounts view.

API: `POST /api/portal/users`, `PATCH /api/portal/users/<id>`

---

### Costing Estimator *(new)*

Build professional elevator quotations and send bid reports directly to customers.

**Elevator costing module fields:**
- Elevator type: `Passenger` (default), `Goods`, `Dumbwaiter`
- Passenger capacity: `1`, `2`, `3`, `6` (default), `8`, `10`, `13`, `15`, `16`, `20`, `26` passengers
- Goods / dumbwaiter capacity: `500 kg`, `1000 kg`, `1500 kg`, `2000 kg`, `2500 kg`, `3000 kg`, `4000 kg`, `5000 kg`
- Speed: `0.65 mps`, `1 mps` (default), `1.25 mps`, `1.5 mps`, `1.75 mps`, `2 mps`
- Motor: `Geared`, `Gearless` (default), `Hydraulic`, `Vacuum`
- Number of stops: `2` to `20`
- Floor-to-floor height: `2400` to `5000` mm
- Pit depth: `300` to `2000` mm
- Overhead: `2800` to `5000` mm
- Cabin construction: `Mild Steel`, `Stainless Steel` (default), `Golden`, `Rose Gold`
- Door type: `Automatic` (default), `Manual`
- Door construction: `Mild Steel`, `Stainless Steel` (default), `Golden`, `Rose Gold`
- Door panels: `1`, `2` (default), `3`, `4`
- Door opening type: `Center` (default), `Side`
- Door vision: `Non Vision`, `Small Vision` (default), `Big Vision`, `Full Vision`
- Door width: `700` (default), `800`, `900`, `1000`, `1100`, `1200`, `1300`, `1400` mm
- Door height: `2000` (default), `2100`, `2200`, `2300`, `2400` mm
- Door opening arrangement: `All Are Same Side` (default), `One Floor Reverse Opening`, `One Floor Both Side Opening`
- Make: `Fuzi` (default), `Wittur German Kit`, `PVE`, `Fuzi IS 17900`, `Fuzi PWD BSR 2025`
- Remarks / accessories: `Remark 1`, `Remark 2`, `Remark 3`

**Estimator behaviour:**
- Passenger mode uses passenger-capacity options, while Goods and Dumbwaiter switch to the load-capacity options automatically.
- Margin % still recalculates price live.
- Recipient email, valid-until date, free-text notes, and add-ons remain available.

**Live pricing:** Cost engine applies base + per-floor rates, capacity multipliers, and percentage uplifts for finish, door, drive, and control — all recalculated in real time as you change inputs.

**Actions:**
- **Save Estimate** — persists to `estimates.json` with status `Draft`
- **View Report** — opens a printable/shareable HTML quotation page
- **Send** — marks as `Sent`; if SMTP is configured sends the HTML report by email; otherwise opens your email client via `mailto:`
- Customers can **Accept** or **Decline** quotes from their portal

**Estimate statuses:** Draft → Sent → Accepted / Rejected

SMTP (optional): set `FUZI_SMTP_HOST`, `FUZI_SMTP_PORT`, `FUZI_SMTP_USER`, `FUZI_SMTP_PASS`, `FUZI_SMTP_FROM` to enable server-side delivery.

API: `GET /api/portal/estimates`, `POST /api/portal/estimates`, `PATCH /api/portal/estimates/<id>`, `GET /api/portal/estimates/<id>/report`, `POST /api/portal/estimates/<id>/send`, `POST /api/portal/estimates/calculate`

---

### Payment Tracking *(new)*

Track cashflow per estimate from advance to final sign-off. Open the **Payment Ledger** tab inside the Costing Estimator view.

**Staff workflow:**
1. Select a saved estimate from the dropdown — the ledger loads all milestones for that estimate.
2. **Auto-schedule** generates the standard 30 / 30 / 30 / 10 milestone split (Advance → Civil Work → Pre-Delivery → Sign-Off) with due dates at 0 / 30 / 60 / 90 days from a start date you choose. Returns a conflict warning if milestones already exist.
3. **Add Payment** manually creates a single milestone with any amount, due date, and description.
4. Mark individual rows **Paid** (sets paid date to today) or open **Edit** to update amount, method, reference number, notes, or status.
5. Delete rows as needed — no cascade effects.

**Summary cards (per estimate):**
- Total Contract Value, Amount Invoiced, Amount Received, Balance Outstanding, Overdue amount

**Payment statuses:** `Due` → `Paid` / `Overdue` / `Partial` / `Waived`

**Payment methods:** NEFT, UPI, Cheque, Cash, DD, Credit Card, Other

**Customer view:** Customers see a **Payments** tab on their portal with:
- Three headline cards: Total Contract Value / Amount Received / Balance Outstanding
- Per-estimate grouped table: Milestone · Amount · Due Date · Status · Paid Date · Method & Reference
- Overdue rows highlighted with a red left border; paid rows with green; due rows with amber
- Outstanding balance banner on the dashboard header when any amount is due

API: `GET /api/portal/payments`, `POST /api/portal/payments`, `PATCH /api/portal/payments/<id>`, `DELETE /api/portal/payments/<id>`, `POST /api/portal/payments/auto-schedule`

---

### Sales Admin Panel *(new)*

The **Sales** view now includes an FY-aware admin panel for April 1 to March 31 reporting.

**How it works:**
- All KPI totals are shown for the selected financial year.
- A date picker lets you view same KPIs for one specific date.
- The panel displays both columns together: **Financial Year** and **Selected Date**.
- Admin entry fields let you capture manual values for metrics that are not always auto-derived from inquiries/payments/service records.

**KPIs included:**
- Number of inquiry received
- Number of site visited
- Number of offer submitted
- Number of elevator units received (work in progress)
- Number of elevators in warranty
- Number of elevators in AMC
- Total number of elevators in service (warranty + AMC)
- Number of inquiry lost
- Number of order lost
- Major competitor by whom bid was lost
- Number of units lost from warranty
- Number of units lost from AMC
- AMC payment received till now
- AMC payment to be received by this year
- New elevator payment received
- New elevator payment yet to be received
- AMC payment for next 10 years
- New orders completed in loss
- Maintenance completed in loss

**Admin-entry fields (date based):**
- Site visited count (manual)
- Units received WIP (manual)
- Inquiry lost count (manual)
- Order lost count (manual)
- Major competitor
- Units lost from warranty (manual)
- Units lost from AMC (manual)
- AMC payment next 10 years (manual override)
- New orders completed in loss (manual)
- Maintenance completed in loss (manual)
- Notes

API: `GET /api/portal/sales/admin-panel?date=YYYY-MM-DD`, `POST /api/portal/sales/admin-panel`, `GET /api/portal/sales/inquiries`, `POST /api/portal/sales/inquiries`, `PATCH /api/portal/sales/inquiries/<id>`

---

### Customer Management

Add and manage building/customer records:

- Name, contact person, phone, email, address, segment, renewal date, notes.
- Status tracking: `Active`, `At Risk`, `Renewal Due`, `Paused`, `Closed`.
- **Grant Portal Access** (admin): create a customer portal login directly from the customer row — generates username, temporary password, and portal URL to share with the customer.

API: `POST /api/portal/customers`, `PATCH /api/portal/customers/<id>`, `POST /api/portal/customer-users`, `PATCH /api/portal/customer-users/<id>`

---

### Project Ticketing

- Create and update tickets with project, title, owner, due date, priority, status, and notes.
- Statuses: `Open`, `In Progress`, `Blocked`, `Closed`.
- Global search and status filtering.

API: `POST /api/portal/project-tickets`, `PATCH /api/portal/project-tickets/<id>`

---

### Install Team Process Tracker

Track each installation job through 8 stages:

1. Up-Front Project Planning
2. Detailed Drawings & Approvals
3. Preparing the Hoistway
4. Final Hoistway Inspection
5. Scheduling Installation Date
6. Installing the Elevator
7. Quality Review & Homeowner Orientation
8. Post-Installation Care

Each job tracks: site, type, crew, target date, progress %, current stage, per-stage status (`Open`, `In Progress`, `Done`, `Blocked`).

API: `PATCH /api/portal/install-jobs/<id>/stages/<stage_id>`

---

### Install Team Management

Manage the installer and technician roster:

- Add team members with name, role, phone, shift, skills, notes, availability.
- Assign technicians to active jobs.
- Availability: `Available`, `On Site`, `Off Duty`, `Blocked`.
- Link technicians to portal login accounts.

API: `POST /api/portal/install-team`, `PATCH /api/portal/install-team/<id>`

---

### Inventory Management

Smart parts and materials inventory with AI insights:

- 66 parts pre-loaded from the FUZI lift material list.
- Track quantity on hand, reserved, reorder point, unit cost, vendor, lead time.
- Statuses: `In Stock`, `Low Stock`, `Out of Stock`, `Ordered`.
- AI-driven PO suggestions and job-stage shortage predictions.
- Raise purchase orders for flagged items.
- Manual stock adjustments with reason notes.

API: `GET /api/portal/inventory`, `POST /api/portal/inventory`, `PATCH /api/portal/inventory/<id>`, `POST /api/portal/inventory/<id>/adjust`, `POST /api/portal/inventory/raise-po`, `GET /api/portal/inventory/ai-insights`

---

### Staff & Attendance *(new)*

**Org chart:**
- Visual tree of 11 pre-seeded nodes across all 7 departments.
- Department-coloured avatar cards with name, title, department, phone.
- Admin can add, edit, or remove people; reports-to hierarchy is maintained automatically when a node is removed.

**Attendance register:**
- Daily register for every person in the org chart.
- Mark status: Present, Late, Absent, WFH, Leave, Holiday.
- Check-in and check-out time inputs.
- Optional notes per person.
- Live summary badges (x Present, y Absent, etc.).
- Managers can mark attendance only for their own department; admin can mark for all.

API: `GET /api/portal/org-chart`, `POST /api/portal/org-chart`, `PATCH /api/portal/org-chart/<id>`, `DELETE /api/portal/org-chart/<id>`, `GET /api/portal/attendance`, `POST /api/portal/attendance`, `PATCH /api/portal/attendance/<id>`

---

### Fleet Monitor

Live fleet health overview from `operations_state.json`:

- Fault severity badges, motor temperatures, door cycle deltas.
- On-call phone number and open ticket links per unit.

---

### Owner Control Tower

Rolls up all department data into a single leadership view:

- Headline: how many departments need attention today.
- Watchlist for operational pressure, revenue protection, and ownership.
- Department scorecards with accountable lead, status, and concrete next action.

---

### Service Agent & Work Orders

- Inbound customer messages from WhatsApp, web chat, and email.
- Site walkthrough to work-order conversion.
- Work order status tracking.

---

### Contract Renewals

- Renewal pipeline with days-to-expiry, contacted flag, contact email, and draft generation.
- CRM query agent answers renewal-status questions and posts results to Discord.

---

### Platform Modules

10 operating areas with owner, status, KPIs, and quick actions:

1. Lift Quotation Management
2. AMC & Preventive Maintenance
3. Elevator Breakdown Management
4. Field Service Management
5. Attendance Management
6. Elevator Inventory Management
7. Elevator CRM & Lead Management
8. Elevator Modernization Management
9. Elevator Project Tracking
10. Elevator MIS Reporting Dashboard

---

## Customer Portal *(new)*

A separate self-service portal for customers at `/customer/login`.

### Onboarding a Customer

1. Open the **Customers** view in the staff portal.
2. Click the **key icon** (`🔑`) on any customer row (admin only).
3. Confirm username, display name, email, and temporary password.
4. Share the credentials and the URL `http://your-host/customer/login` with the customer.
5. On first login the customer is prompted to set a private password.

### Customer Dashboard

- **My Quotes** — all estimates sent to this customer. Cards show type, floors, total price, drive/finish/door spec, valid-until date. Customers can **Accept** or **Decline** quotes from here.
- **Payments** — outstanding balance banner when any amount is due; summary cards (Total Contract / Received / Outstanding); per-estimate grouped tables with milestone, amount, due date, status, paid date, and payment reference. Overdue rows highlighted in red.
- **My Projects** — project tickets linked to this customer.
- **Support** — call, email, WhatsApp, and document download contacts.

### Customer Routes

| Route | Description |
|---|---|
| `GET /customer/login` | Customer login page |
| `POST /customer/login` | Authenticate |
| `GET /customer/change-password` | First-use password change |
| `GET /customer/dashboard` | Customer home |
| `GET /customer/quote/<id>` | Printable HTML quote report |
| `POST /customer/quote/<id>/respond` | Accept or decline a quote |
| `GET /customer/logout` | Sign out |

---

## Department-Based Login Accounts

Auto-seeded manager accounts (temporary password `ChangeMe123!`):

- `service.control.manager`
- `project.office.manager`
- `install.ops.manager`
- `stores.procurement.manager`
- `sales.renewals.manager`
- `customer.success.manager`

---

## Data Model

All data persists to JSON files. Production would replace these with a database and real FSM/ERP/CRM integrations.

| File | Description |
|---|---|
| `users.json` | Staff portal accounts |
| `customers.json` | Customer / building records |
| `customer_users.json` | Customer portal credentials |
| `project_tickets.json` | Project tickets |
| `install_jobs.json` | Installation job stages and progress |
| `install_team.json` | Installer roster and assignments |
| `inventory.json` | Parts inventory |
| `estimates.json` | Costing estimates and bid records |
| `sales_admin_panel.json` | Sales admin panel date entries and manual KPI adjustments |
| `org_chart.json` | Org chart nodes |
| `attendance.json` | Daily attendance records |
| `operations_state.json` | Live fleet, messages, renewals, work orders, activity log |

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `FUZI_SECRET_KEY` | `dev-only-fuzi-secret` | Flask session key |
| `FUZI_PORTAL_USER` | `admin` | Initial admin username |
| `FUZI_PORTAL_PASSWORD` | `fuzi2026` | Initial admin password |
| `FUZI_SMTP_HOST` | *(off)* | SMTP server for estimate emails |
| `FUZI_SMTP_PORT` | `587` | SMTP port |
| `FUZI_SMTP_USER` | *(off)* | SMTP username |
| `FUZI_SMTP_PASS` | *(off)* | SMTP password |
| `FUZI_SMTP_FROM` | *(SMTP_USER)* | From address for outbound emails |
| `FUZI_OPENCLAW_URL` | `http://127.0.0.1:18789/` | OpenClaw relay URL |
| `FUZI_OPENCLAW_TIMEOUT` | `4` | Relay request timeout (seconds) |
| `FUZI_OPENCLAW_CHANNEL` | `whatsapp` | Default outbound channel |
| `FUZI_OPENCLAW_OPS_TARGET` | *(off)* | Ops alert recipient |
| `FUZI_MONITOR_INTERVAL` | `300` | Background data-sync interval (seconds) |

---

## OpenClaw Agent Relay

Agent actions route through OpenClaw's authenticated gateway (`/tools/invoke`). Supports separate Discord channels per agent:

The transport control points live in [app.py](app.py): `resolve_injected_whatsapp_transport()` handles phone-style delivery, and `resolve_injected_discord_gateway()` now centralizes Discord reads plus Discord REST provisioning so Discord behavior can be removed, replaced, or extended from one place.

- `FUZI_OPENCLAW_TARGET_FLEET_MONITOR` → `#fleet-monitor`
- `FUZI_OPENCLAW_TARGET_MODERNIZATION_COORDINATOR` → `#modernization-coordinator`
- `FUZI_OPENCLAW_TARGET_CUSTOMER_SERVICE` → `#customer-service`
- `FUZI_OPENCLAW_TARGET_MORNING_BRIEF` → `#morning-brief`
- `FUZI_OPENCLAW_TARGET_LIVE_DASHBOARD` → `#live-operations`
- `FUZI_OPENCLAW_TARGET_RENEWALS` → `#renewals-crm`
- `FUZI_OPENCLAW_TARGET_WORK_ORDERS` → `#site-work-orders`
- `FUZI_OPENCLAW_TARGET_INSTALLATIONS` → `#field-installations`

Set `FUZI_DISCORD_GUILD_ID` and grant the bot `MANAGE_CHANNELS` permission to auto-provision these channels from Team Accounts → Provision Discord channels.

---

## Verification

```bash
# Syntax checks
.venv/bin/python -m py_compile app.py
node --check static/portal.js

# Data integrity
.venv/bin/python -m json.tool project_tickets.json
.venv/bin/python -m json.tool users.json
.venv/bin/python -m json.tool customers.json
.venv/bin/python -m json.tool estimates.json
.venv/bin/python -m json.tool org_chart.json
.venv/bin/python -m json.tool attendance.json
```

**After starting Flask, verify:**

- Staff login works at `/portal/login`.
- `/portal/dashboard` redirects to login when logged out.
- Customer login works at `/customer/login`.
- Costing Estimator calculates live prices and saves estimates.
- Sales Admin Panel shows FY (Apr-Mar) KPI totals and selected-date KPI drilldown.
- "Send" on a saved estimate triggers the email client (or SMTP if configured).
- Customers can log in and view their quotes.
- Accept / Decline on a quote updates its status in the staff portal.
- "Grant Portal Access" on a customer row creates a customer login.
- Org chart renders the company tree and edits persist.
- Attendance register saves check-in/out times and statuses.
- Search and status filters affect matching dashboard rows.
