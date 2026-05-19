# FUZI Operations Portal

Flask-powered operations portal for FUZI Classic Elevators. The public website remains available, and the `/portal` route adds a protected internal dashboard for operations, project ticketing, and installation tracking.

## Current System

- Public marketing/product pages are served from the existing HTML files.
- The operations portal is built with Flask templates, CSS, and JavaScript.
- Login is session-protected with JSON-backed user accounts and hashed passwords.
- Customer records persist to `customers.json` and start empty so the portal stores only customer data you enter.
- Team login accounts persist to `users.json`.
- Project tickets persist to `project_tickets.json`.
- Install-team progress persists to `install_jobs.json`.
- Install-team roster and assignments persist to `install_team.json`.

## Run Locally

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python app.py
```

Open:

```text
http://127.0.0.1:5000/portal
```

Initial admin credentials:

```text
Username: admin
Password: fuzi2026
```

The first run also creates starter technician accounts from the current install-team roster with the temporary password `ChangeMe123!`. Replace those passwords from the Team Accounts screen before giving access to the team.

The initial admin credentials can be overridden with environment variables before `users.json` is created:

```bash
FUZI_PORTAL_USER=your_user FUZI_PORTAL_PASSWORD=your_password FUZI_SECRET_KEY=your_secret .venv/bin/python app.py
```

## Main Files

- `app.py` - Flask app, auth, routes, API endpoints, and JSON persistence.
- `templates/login.html` - portal login page.
- `templates/dashboard.html` - operations dashboard UI.
- `static/portal.css` - portal styling.
- `static/portal.js` - interactive filters, ticket actions, install-stage updates.
- `users.json` - saved portal login accounts with hashed passwords.
- `customers.json` - saved customer/building records entered through the portal.
- `project_tickets.json` - saved project ticket data.
- `install_jobs.json` - saved installation job progress, created after the first install-stage update.
- `install_team.json` - saved install technician roster, created after the first team update.

## Portal Features

### Authentication

- `/portal` redirects to login if the user is not authenticated.
- `/portal/dashboard` is protected by `login_required`.
- `/portal/logout` clears the session.
- Passwords are stored with Werkzeug password hashes in `users.json`.
- Admin users can create or disable team accounts from Team Accounts.
- Roles supported today: `admin`, `manager`, and `technician`.

API routes:

- `POST /api/portal/users`
- `PATCH /api/portal/users/<user_id>`

### Customer Management

The Customers view is the main place to manage real customer records:

- Add customer/building name, contact person, phone, email, address, segment, renewal date, and notes.
- Update customer status and notes from the table.
- Track statuses: `Active`, `At Risk`, `Renewal Due`, `Paused`, `Closed`.
- Search customers through the global toolbar.
- Persist customer records to `customers.json`.

API routes:

- `POST /api/portal/customers`
- `PATCH /api/portal/customers/<customer_id>`

### Project Ticketing

The Project Tickets view lets the team manage current project work:

- Create tickets with project, title, owner, due date, priority, status, and notes.
- Update ticket status from the table.
- Track statuses: `Open`, `In Progress`, `Blocked`, `Closed`.
- Filter and search tickets through the global toolbar.
- Persist tickets to `project_tickets.json`.

API routes:

- `POST /api/portal/project-tickets`
- `PATCH /api/portal/project-tickets/<ticket_id>`

### Install Team Process Tracker

The Installations view tracks each installation job through a residential elevator workflow adapted for field operations:

1. Up-Front Project Planning
2. Detailed Drawings & Approvals
3. Preparing the Hoistway
4. Final Hoistway Inspection
5. Scheduling Installation Date
6. Installing the Elevator
7. Quality Review & Homeowner Orientation
8. Post-Installation Care

Each job includes:

- Site name, elevator type, crew, target date, and overall status.
- Progress percentage.
- Current stage.
- Stage-level checklist guidance.
- Stage status controls: `Open`, `In Progress`, `Done`, `Blocked`.
- Saved progress in `install_jobs.json`.

The install view also includes:

- Permit and code compliance checklist.
- Material procurement lead times.
- Common install challenges and prevention strategies.

API route:

- `PATCH /api/portal/install-jobs/<job_id>/stages/<stage_id>`

### Install Team Management

The Install Team view turns the portal into a lightweight crew-management system:

- Add installers and technicians with name, role, phone, shift, skills, notes, and availability.
- Track roles such as lead installer, electrical technician, door/safety specialist, and helper.
- Assign technicians to active installation jobs.
- Update availability: `Available`, `On Site`, `Off Duty`, or `Blocked`.
- Search the team by name, role, skills, job, shift, or availability.
- Persist team roster and assignments to `install_team.json`.
- Link technicians to portal login accounts from Team Accounts.

API routes:

- `POST /api/portal/install-team`
- `PATCH /api/portal/install-team/<member_id>`

### Other Dashboard Areas

- Elevator Business Platform modules
- Self-Healing Fleet Monitor
- Modernization Project Coordinator
- 24/7 Customer Service Agent
- Morning Operations Brief
- Contract Renewal CRM Agent
- Site Walkthrough to Work Order
- Fleet, project, renewal, and work-order search/filtering

### Elevator Business Platform Modules

The Platform Modules view adds the 10 operating areas requested for the business:

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

Each module includes owner, status, description, KPIs, and quick action buttons. The quick actions currently route through the shared `/api/portal/action` endpoint and can later be replaced by module-specific workflows.

## Data Model Notes

This is currently a local Flask system:

- Project tickets, install jobs, install team assignments, users, and customers use JSON files.
- Customer records are not pre-filled with simulated records; add your real customers in the Customers screen.
- Fleet, customer messages, renewals, and work orders still use dashboard placeholder data until they are connected to your real FSM, ERP, CRM, WhatsApp, email, and SMS systems.
- Production would replace the JSON/sample data layer with a database and real FSM, ERP, CRM, WhatsApp, email, and SMS integrations.

## Verification

Useful checks:

```bash
.venv/bin/python -m py_compile app.py
node --check static/portal.js
.venv/bin/python -m json.tool project_tickets.json
.venv/bin/python -m json.tool users.json
.venv/bin/python -m json.tool customers.json
```

After starting Flask, verify:

- Login works at `/portal/login`.
- `/portal/dashboard` redirects to login when logged out.
- Admin users can create team login accounts.
- Team accounts can log in with their username and password.
- Customer records can be created and updated.
- Project tickets can be created and updated.
- Installation stages can be marked `Open`, `In Progress`, `Done`, or `Blocked`.
- Search and status filters affect matching dashboard rows.
