# FUZI Operations Portal

React/Expo operations and customer portal for FUZI Classic Elevators, backed by a lightweight Node/Express API. The public website, staff portal, and mobile portal run from the Expo app for web and Android.

---

## Quick Start

Install the Node API dependencies and Expo dependencies:

```bash
npm install
cd expo-app
npm install
```

Start the Node API from the repository root:

```bash
npm run api
```

Start the React/Expo web app:

```bash
npm run web
```

This starts the latest development UI on port `8082`. In dev, the `8082` UI sends API calls to `http://127.0.0.1:5000`.

Start the Android app from the Expo project:

```bash
cd expo-app
npm run android
```

| URL | Description |
|---|---|
| `http://127.0.0.1:5000` | Node API plus the stable exported single-page app when `expo-app/dist/index.html` exists |
| `http://127.0.0.1:8082` | Latest development UI served by Expo; API calls still go to port `5000` |
| `http://127.0.0.1:5000/api/portal/data` | Authenticated portal data parts index |
| `http://127.0.0.1:5000/api/portal/data/<workspace>/<part>` | Authenticated portal data part API, returning the first profile-sized chunk for array/list parts |
| `http://127.0.0.1:5000/api/portal/data/<workspace>/<part>/chunks/<index>` | Specific profile-sized chunk of a portal data list |
| `http://127.0.0.1:5000/api/portal/offer-manager/offers` | Compact authenticated summary of every saved offer for complete Offer Manager counts, CRM histories, and filters without bulk-loading costing details |
| `http://127.0.0.1:5000/api/app` | App/export status API |

**Default admin credentials:**
```
Username: admin
Password: stored as a hash in `fuzi.sqlite3`
```

Seeded staff accounts are stored in `fuzi.sqlite3`. Staff portal accounts use the shared portal password hash stored in the SQLite `app_secrets` table.

---

## Installable Apps

The Windows and Android apps are clients for the FUZI server. Login, CRM, offers, inventory, site visits, and reports stay synced through the Node API.

The Windows app also keeps local desktop data in the app data folder:

- `portal-data-cache.json` stores the last synced full portal snapshot so the app opens quickly and can show records if the network is unavailable.
- `local-data/` stores the same synced server data split into per-section JSON files, such as customers, estimates, inventory, site visits, service records, payments, users, and other portal collections.
- `offline-write-queue.json` stores saves made while the server is unreachable. When the network comes back, the desktop app replays those writes to the server in order, then refreshes from the server.

The desktop local data is a mirror and offline working copy. The server remains the source of truth after sync completes.

### Windows

The Windows desktop app uses Electron as a shell around the same Expo web export that the browser version uses. The website stays available through `npm run web`, `npm run web:export`, and the Node API static server; Electron only adds the desktop window, preload bridge, local cache, and offline write queue.

1. Set the server URL in `fuzi-desktop.config.json` beside the app, or set `FUZI_API_URL`.
2. Run `npm install` after pulling packaging dependencies.
3. Run `npm run desktop` for local desktop testing.
4. Run `npm run desktop:build` or `npm run windows:build` to create the Windows NSIS installer.
   Use `npm run desktop:package` only when `expo-app/dist` is already current.
5. Share the generated installer from `release/`.

For local testing, copy `fuzi-desktop.config.example.json` to `fuzi-desktop.config.json` and set:

```json
{
  "apiUrl": "https://your-fuzi-server.example.com"
}
```

### Android

Set `EXPO_PUBLIC_FUZI_API_URL` in `eas.json` to the FUZI server URL, then build:

```powershell
npm run android:build
npm run android:build:production
```

`android:build` creates an APK for direct testing. `android:build:production` creates an Android App Bundle.

---

## Docker

FUZI production runs as one Node service on port `5000`. The production image builds the Expo single-page web bundle and serves it from the same API container, so `http://127.0.0.1:5000` is both the production app and API origin.

| Service | Runtime | Install | Start | Port |
|---|---|---|---|---|
| API + production web | Node 22 | `npm ci` | `npm run api` | `5000` |

The API uses SQLite. In Docker production, SQLite files live in the named Docker volume `fuzi-sqlite-data`, mounted into the container at `/data`; the image does not bundle `fuzi.sqlite3`.

Common environment variables:

| Variable | Default | Used By |
|---|---|---|
| `FUZI_API_PORT` | `5000` | API |
| `FUZI_API_PUBLISHED_PORT` | `5000` | Docker host port for API |
| `FUZI_WEB_DEV_PORT` | `8082` | Local Expo dev UI port |
| `FUZI_WEB_PREVIEW_PORT` | `8083` | Optional local preview port for the exported single-page file |
| `FUZI_DB_PATH` | `/data/fuzi.sqlite3` in Compose | API |
| `EXPO_PUBLIC_FUZI_API_URL` | `http://127.0.0.1:5000` | Web |
| `EXPO_PUBLIC_FUZI_API_PROTOCOL` | `http` | Web |
| `EXPO_PUBLIC_FUZI_API_HOST` | `127.0.0.1` | Web |
| `EXPO_PUBLIC_FUZI_API_PORT` | `FUZI_API_PUBLISHED_PORT` in Compose, otherwise `5000` | Web |
| `FUZI_OPENCLAW_URL` | *(off)* | Full OpenClaw relay URL override |
| `FUZI_OPENCLAW_ADDRESS` | *(off)* | OpenClaw relay `host:port` override |
| `FUZI_OPENCLAW_HOST` | `host.docker.internal` in Compose | OpenClaw relay host |
| `FUZI_OPENCLAW_PORT` | `18789` | OpenClaw relay port |
| `FUZI_DOCKER_INSTANCE` | auto-detected | Force Docker-aware OpenClaw defaults with `true` / `false` |

Build and run the production service:

```bash
docker compose up -d --force-recreate --remove-orphans
```

Equivalent npm scripts are available:

```bash
npm run docker:build
npm run docker:up
npm run docker:down
```

Staff portal and OpenClaw password values are not stored in the app or Compose defaults. Keep them in the SQLite `app_secrets` table inside the `fuzi.sqlite3` file stored in the `fuzi-sqlite-data` volume.

Stop the services:

```bash
docker compose down
```

Windows helpers are also available:

```bat
runondocker.bat
stopondocker.bat
```

After startup, verify:

- Production app/API: `http://127.0.0.1:5000`
- Export/status API: `http://127.0.0.1:5000/api/app`
- SQLite volume: `fuzi-sqlite-data`, mounted at `/data`
- Health checks: `docker compose ps`

Secrets and local database files are excluded by `.dockerignore`; provide production secrets through environment variables or a local `.env` file used by Docker Compose.

---

## Main Files

| File | Purpose |
|---|---|
| `server/index.mjs` | Node/Express API, auth, portal data aggregation, SQLite persistence, static public-file serving |
| `expo-app/` | React/Expo app for Android and web clients |
| `expo-app/src/App.tsx` | Staff/mobile portal screens and full FUZI Ops module navigation |
| `expo-app/src/api.ts` | API base URL and bearer-token fetch wrapper |
| `fuzi.sqlite3` | Primary SQLite database used by the Node API |

---

## React / Expo App

The website home and portal are now React/Expo first on the same web port. It uses the Node API with bearer-token login and no Flask/Jinja runtime.

Development URLs:
- API plus the stable exported app: `http://127.0.0.1:5000`
- Latest Expo development UI: `http://127.0.0.1:8082`
- Optional exported single-page preview: `http://127.0.0.1:8083`

Development scripts:
- `npm run api` starts the API and stable static HTML server on port `5000`.
- `npm run web` starts the latest Expo development UI on port `8082`.
- `npm run web:dev` is an explicit alias for the same live Expo dev server.
- `npm run web:export` refreshes `expo-app/dist/index.html`, which production serves from port `5000`.
- `npm run web:preview` exports and previews the single-page production file on port `8083`.
- `npm run desktop` refreshes the Expo web export and opens it inside the Electron desktop shell.
- `npm run desktop:build` refreshes the Expo web export and packages the Windows desktop app with electron-builder.
- `npm run desktop:package` packages the current `expo-app/dist` desktop bundle without re-exporting it.

API base URL:
- Web and local development default to `http://127.0.0.1:5000`, so the latest UI on `8082` sends API calls to `5000`.
- `EXPO_PUBLIC_FUZI_API_URL` can override the full API origin.
- To configure only the `host:port` part, set `EXPO_PUBLIC_FUZI_API_HOST` and `EXPO_PUBLIC_FUZI_API_PORT`, for example `a` and `b` builds `http://a:b`.
- In Docker Compose, `EXPO_PUBLIC_FUZI_API_PORT` defaults to `FUZI_API_PUBLISHED_PORT`, so changing the published API port also changes the web app API origin.
- Android emulator automatically maps that to `http://10.0.2.2:5000`.
- For a real Android phone, start the Node API on your LAN interface and run Expo with:

```powershell
$env:EXPO_PUBLIC_FUZI_API_URL="http://YOUR_COMPUTER_IP:5000"
npm run android
```

The Expo app includes login, live metrics, saved estimates, customer lifecycle tracking, `.xlsx` costing source review, site visit reports inside Customer CRM, Daily Action Queue, Command Intelligence, and an in-app Operations Backlog. Its navigation mirrors the staff portal modules: Today, Command Intelligence, Operations Backlog, Overview, Platform Modules, Customers, Project Tickets, Projects, Installations, Install Team, Team Accounts, Renewals, Work Orders, Inventory, Staff & Attendance, Installation Dept, Breakdown Portal, Service, GAD Drawings, Accounts, Commissioning, Back Office, Tender, Factory, International Vendor, Approvals, Documents, Engineer Jobs, and Dept Comms.

Most module pages include shared add/update controls backed by the Node compatibility API, so the React/Expo portal can create and update the same SQLite-backed operational records that the legacy portal used: project tickets, install jobs, install team, users, inventory, estimates, payments, sales inquiries, breakdowns, service records, GAD drawings, commissioning, factory jobs, tenders, department comms, org chart, and attendance.

Customer/Site Visit rule:
- Select a CRM customer or imported enquiry/customer row first.
- Site Visit Reports are saved in `fuzi.sqlite3` from inside Customer CRM.
- A Site Visit Report must include an existing CRM `customer_id`; the API rejects reports that are not tied to a CRM customer.
- The Site Visit form asks "How many stops?" and creates one opening row per stop/opening for floor, floor-to-floor height, and lintel height.

API: `POST /api/portal/auth/login`, `GET /api/portal/auth/session`, `POST /api/portal/auth/logout`, `GET /api/portal/data`, `GET /api/portal/data/<workspace>/<part>`, `GET /api/portal/data/<workspace>/<part>/chunks/<index>`, `POST /api/portal/customers`, `POST /api/portal/site-visits`, `GET /api/portal/costing-source-data`, plus legacy-compatible collection routes like `GET/POST/PATCH /api/portal/inventory`, `GET/POST/PATCH /api/portal/tender`, and `GET/POST/PATCH /api/portal/sales/inquiries`.

---

### Daily Action Queue & Command Intelligence

The `Today` page is a live action queue. It prioritizes overdue follow-ups, pending site visits, open breakdowns, low stock, tender deadlines, payment reminders, stalled installs, renewals, and pending approvals from existing portal records.

The `Command Intelligence` page is a data-backed operations cockpit. It combines live calculations with saved records:

- Role-based home dashboards from live department queues.
- Escalation rules saved through `POST /api/portal/escalation-rules` into `escalation_rules`.
- Customer 360 health scores calculated from open payments, breakdowns, service records, and renewals.
- Engineer route planner from open breakdown, service, and site-visit records.
- WhatsApp/Discord conversation inbox saved through `POST /api/portal/conversations` into `conversations`.
- WhatsApp follow-up templates for enquiry follow-up, offer sent, payment reminder, breakdown update, and AMC renewal; selecting a template loads the saved conversation composer.
- Smart assignment suggestions from engineer availability, current task, and open workload.
- Offer versioning from `estimates` plus `audit_logs`.
- Inventory purchase planning from stock, reserved quantity, reorder point, and target stock.
- Install project Gantt view from active installation job status.
- Installation milestone tracker calculated from active install job status, showing completed milestone count and next milestone.
- Audit trail in `audit_logs`, automatically written by generic portal create/update/delete routes and key custom CRM flows, with before/after summaries shown in Command Intelligence.
- Warranty tracker saved through `POST /api/portal/warranty-records` into `warranty_records`.
- Material dispatch board saved through `POST /api/portal/dispatch-records` into `dispatch_records`.
- Site readiness checklist saved through `POST /api/portal/readiness-checklists` into `readiness_checklists`.
- Engineer skill matrix saved through `POST /api/portal/skill-matrix` into `skill_matrix`.
- Complaint repeat analysis calculated from breakdown history.
- AMC visit calendar calculated from renewal records.
- Customer portal access review from `customers` and `customer_users`.
- Customer portal action queue for customers missing portal users, customers with open service/payment items, and customers with vault documents.
- Profitability dashboard from estimates, offer costs, and payment collection.
- Vendor performance scorecard from inventory vendor, value, and low-stock data.
- Digital handover packs saved through `POST /api/portal/handover-packs` into `handover_packs`.
- Lift asset registry saved through `POST /api/portal/lift-assets` into `lift_assets`, with controller, motor, door, warranty, AMC, and site details.
- Spare parts usage ledger saved through `POST /api/portal/parts-usage` into `parts_usage`, linked to job, unit, engineer, and inventory item IDs.
- Spare parts consumption forecast calculated from service records, breakdown repair notes, and saved parts usage entries.
- QR service lookup values generated from registered lift assets, with optional stored QR overrides.
- Service report generator saved through `POST /api/portal/service-reports` into `service_reports`, with checklist, parts used, next visit, notes, voice note URL/transcript, and customer signature fields.
- Engineer voice-note view showing saved audio references or transcripts from service reports.
- Payment collection forecast calculated from open payment records, reminder dates, due dates, and outstanding totals.
- Engineer performance dashboard calculated from engineer-linked breakdown, service, and installation records.
- Safety incident register saved through `POST /api/portal/safety-incidents` into `safety_incidents`.
- Tender document checklist saved through `POST /api/portal/tender-checklists` into `tender_checklists`.
- AMC contract builder saved through `POST /api/portal/amc-contracts` into `amc_contracts`.
- Management daily brief saved through `POST /api/portal/daily-briefs` into `daily_briefs`, with browser print support for saving the brief as a PDF.

Generic collection routes also support `GET`, `PATCH`, and `DELETE` for these saved intelligence collections, subject to portal authentication.

---

## Staff Portal Features

### Authentication & Role-Based Access

- Bearer-token login with migrated Werkzeug-compatible password hashes.
- Roles: `admin`, `manager`, `staff`, `technician`.
- Logged-in users can switch the portal language between English and Hindi; the choice is saved in the browser and applied to shared navigation, actions, labels, and placeholders.
- Admins and Executive Office users see the full Expo module navigation.
- Staff login accounts are synced from the org chart for every staff member, with department heads/supervisors created as managers and other staff created as staff users.
- Department heads see only the portal views needed for their department.
- Admin Team Accounts can sync all staff logins, link accounts to staff profile IDs, create accounts, change usernames/passwords, reset passwords, and activate/deactivate staff logins when staff changes.
- Department managers land on a focused workspace:
  - `Service Control` → Service, Work Orders, Staff & Attendance
  - `Project Office` → Project Tickets, Projects, Staff & Attendance
  - `Install Operations` → Installations, Install Team, Staff & Attendance
  - `Stores & Procurement` → Inventory, Staff & Attendance
  - `CRM & Renewals` → Customers, Renewals, Staff & Attendance
  - `Customer Success` → Customers, Service, Work Orders, Staff & Attendance
- Staff accounts use the configured staff portal password unless admin sets a user-specific password.
- Admin can reset any team password from the Team Accounts view.

API: `POST /api/portal/users/sync-staff`, `POST /api/portal/users`, `PATCH /api/portal/users/<id>`

---

### Customer / Site Visit Records

- Every new customer is saved with a unique random 4-digit customer ID, persisted as the primary key in `fuzi.sqlite3`, and reused by estimator/customer-portal links.
- Older saved customer IDs are migrated to 4-digit IDs on portal load, with linked `customer_id` references updated across the local collections.
- Customer records capture the visible `sitevisit.pdf` form fields: address, main mobile phone, site person name/mobile, reference given by/mobile, pit size in mm, machine room available (`Y`/`N`), visit date, offer/enquiry numbers, offer type, motor/finish/door requirement, openings/stops, opening type, door size, car size, capacity, shaft size, brick wall, civil door height, and visited-by.
- Site visit opening details are structured instead of one free-text line: enter the number of stops/openings, then fill each opening's floor, floor-to-floor height in mm, and lintel height in mm. The app saves this as `opening_schedule` and also keeps a generated `floor_height_profile` summary.
- The Customers portal view shows the site-visit details beside the customer contact record so follow-up, quotation, and portal access all stay tied to the same customer ID.

API: `POST /api/portal/customers`, `PATCH /api/portal/customers/<id>`

---

### India-Ready CRM Feature Roadmap *(started)*

The CRM roadmap is shaped for an Indian elevator sales, installation, AMC, warranty, and service business. Compliance notes are an operational baseline, not legal advice; final templates and retention rules should be reviewed with the company accountant/legal advisor.

**India compliance baseline:**
- DPDP Act, 2023: record customer consent, purpose, source, withdrawal notes, owner, and follow-up history for digital personal data.
- TRAI/TCCCPR: keep marketing consent and DLT/reference IDs before commercial SMS/telemarketing campaigns.
- GST operations: capture GSTIN, PAN, state/place of supply, invoice references, payment references, and e-invoice readiness where applicable.
- Audit readiness: keep created/updated timestamps, user ownership, quote approval trail, service reports, and customer-visible history.

**Top 100 CRM features to build and track:**
1. Customer account database [Built]
2. Contact person tracking [Built]
3. Phone and email storage [Built]
4. Building/site address tracking [Built]
5. Customer segment tagging [Built]
6. Customer status pipeline [Built]
7. Renewal date tracking [Built]
8. Customer notes [Built]
9. Customer portal access [Built]
10. Customer-visible quotes [Built]
11. GSTIN capture [Started]
12. PAN capture [Started]
13. State/place-of-supply capture [Started]
14. DPDP consent flag [Started]
15. DPDP consent timestamp [Started]
16. Marketing/DLT consent flag [Started]
17. DLT consent reference [Started]
18. Preferred contact channel [Started]
19. Lead source tracking [Started]
20. Account owner assignment [Started]
21. Next follow-up date [Started]
22. Consent/compliance notes [Started]
23. Lead capture form [Roadmap]
24. Lead qualification scoring [Roadmap]
25. Lead-to-customer conversion [Roadmap]
26. Duplicate customer detection [Roadmap]
27. Sales opportunity pipeline [Roadmap]
28. Deal stage tracking [Roadmap]
29. Probability and weighted forecast [Roadmap]
30. Site visit scheduling [Started]
31. Site visit checklist [Started]
32. Competitor lost-reason tracking [Roadmap]
33. Offer/quotation generation [Built]
34. Editable offer approval before sending [Built]
35. Offer PDF generation [Built]
36. Customer-to-offer linking [Built]
37. Offer validity tracking [Built]
38. Quote acceptance/decline [Built]
39. Saved estimate edit [Built]
40. Saved estimate delete [Built]
41. Payment milestone ledger [Built]
42. UPI/NEFT/cheque reference tracking [Built]
43. Outstanding balance tracking [Built]
44. Overdue payment alerts [Built]
45. GST tax invoice export [Roadmap]
46. E-invoice/IRN field tracking [Roadmap]
47. AMC contract records [Built]
48. CAMC contract records [Roadmap]
49. Warranty records [Built]
50. Contract renewal reminders [Built]
51. Preventive maintenance schedule [Built]
52. Breakdown ticket logging [Built]
53. Technician assignment [Built]
54. Service report generation [Built]
55. Service report CEO copy [Built]
56. Service report customer file record [Built]
57. Parts used tracking [Built]
58. Part number and quantity tracking [Built]
59. Service billing item tracking [Built]
60. Customer service history [Built]
61. Customer comments capture [Built]
62. Required action tracking [Built]
63. Work order management [Built]
64. Field technician mobile readiness [Started]
65. Staff and attendance [Built]
66. Editable org chart [Built]
67. Staff mobile number directory [Built]
68. Role-based dashboard access [Built]
69. Password reset and forced rotation [Built]
70. Admin user management [Built]
71. Inventory item master [Built]
72. Inventory reorder alerts [Built]
73. Part warranty tracking [Roadmap]
74. Vendor records [Roadmap]
75. Purchase request workflow [Roadmap]
76. Installation project tracker [Built]
77. Installation stage tracking [Built]
78. Handover report [Built]
79. Warranty registration output [Built]
80. Customer success dashboard [Roadmap]
81. Sales KPI dashboard [Built]
82. Financial-year reporting [Built]
83. Daily sales admin entries [Built]
84. AMC revenue forecast [Built]
85. Inquiry tracking [Built]
86. Site visit count [Built]
87. Offer submitted count [Built]
88. Lost inquiry/order tracking [Built]
89. Search and status filters [Built]
90. Mobile responsive portal [Started]
91. Email delivery configuration [Built]
92. PDF/document export [Built]
93. Internal activity feed [Built]
94. Audit log per customer [Built]
95. Data retention policy fields [Roadmap]
96. Consent withdrawal workflow [Roadmap]
97. Customer complaint/escalation SLA [Built]
98. WhatsApp/SMS template registry [Built]
99. CEO/MIS summary reports [Built]
100. Backup and restore controls [Roadmap]

**Operations platform backlog - next 100 feature ideas:**

These items are also available inside the staff portal under `Operations Backlog`, with category filters, search, priority bands, and department summary counts.

1. Lead scoring for sales enquiries [Backlog]
2. Auto follow-up reminders by customer stage [Backlog]
3. Lost enquiry reason analytics [Backlog]
4. Quotation win/loss dashboard [Backlog]
5. Duplicate customer detection [Backlog]
6. Customer merge tool [Backlog]
7. Customer priority rating [Backlog]
8. Customer branch/site hierarchy [Backlog]
9. Contact person directory per customer [Backlog]
10. Customer blacklist / credit hold flag [Backlog]
11. Auto quotation number generation [Backlog]
12. Offer revision comparison [Backlog]
13. Discount approval limits by role [Backlog]
14. Offer expiry alerts [Backlog]
15. Offer PDF template selector [Backlog]
16. GST-ready invoice draft generator [Backlog]
17. Payment milestone templates [Backlog]
18. Payment receipt upload [Backlog]
19. Outstanding balance aging report [Backlog]
20. Collection promise tracking [Backlog]
21. Site visit route planner [Backlog]
22. Site visit photo capture [Backlog]
23. Site measurement validation [Backlog]
24. Shaft readiness photo checklist [Backlog]
25. Auto convert site visit to offer [Backlog]
26. Site visit reschedule tracking [Backlog]
27. Geo-tagged site visit check-in [Backlog]
28. Civil work pending tracker [Backlog]
29. Customer signature on site visit [Backlog]
30. Site visit quality review [Backlog]
31. Installation stage checklist [Backlog]
32. Material readiness tracker [Backlog]
33. Installation delay reason log [Backlog]
34. Contractor assignment calendar [Backlog]
35. Installation handover approval [Backlog]
36. Commissioning certificate generator [Backlog]
37. Installation photo timeline [Backlog]
38. Daily installation progress notes [Backlog]
39. Lift-wise installation dashboard [Backlog]
40. Project risk score [Backlog]
41. Breakdown SLA timer [Backlog]
42. Trapped passenger priority mode [Backlog]
43. Auto escalation to manager [Built]
44. Engineer nearest-location assignment [Backlog]
45. Breakdown repeat-fault detection [Built]
46. Breakdown root-cause tagging [Backlog]
47. Breakdown customer notification log [Built]
48. Breakdown spare-part suggestion [Built]
49. Breakdown closure approval [Backlog]
50. Breakdown cost tracking [Backlog]
51. Preventive maintenance calendar [Built]
52. AMC renewal pipeline [Built]
53. AMC visit auto-scheduler [Built]
54. Service checklist by lift type [Backlog]
55. Service report PDF [Built]
56. Customer digital signature for service [Built]
57. Service photo attachments [Backlog]
58. Missed service alert [Backlog]
59. AMC profitability dashboard [Backlog]
60. Contract coverage rules [Backlog]
61. Lift asset registry [Built]
62. QR code per lift [Built]
63. Lift technical history [Backlog]
64. Controller/password vault with restricted access [Backlog]
65. Warranty expiry alerts [Built]
66. Parts replacement history [Built]
67. Modernization opportunity alerts [Backlog]
68. Lift health score [Built]
69. Lift downtime report [Backlog]
70. Lift document pack [Backlog]
71. Inventory reorder automation [Backlog]
72. Vendor price comparison [Backlog]
73. Purchase request workflow [Backlog]
74. Stock reservation for jobs [Backlog]
75. Bin/location scanner [Backlog]
76. Inventory audit count mode [Backlog]
77. Low-stock WhatsApp/email alert [Built]
78. Spare consumption forecast [Built]
79. Material dispatch challan [Backlog]
80. Returned material tracking [Backlog]
81. Staff attendance geofencing [Backlog]
82. Engineer daily job app [Backlog]
83. Leave approval workflow [Backlog]
84. Department workload dashboard [Backlog]
85. Skill matrix by engineer [Built]
86. Performance scorecards [Built]
87. Training/certification tracker [Backlog]
88. Staff document vault [Backlog]
89. Overtime approval tracking [Backlog]
90. Payroll export summary [Backlog]
91. In-app notification center [Backlog]
92. Global search across all records [Backlog]
93. Advanced filters saved per user [Backlog]
94. Audit trail viewer [Backlog]
95. Role permission editor [Backlog]
96. Data import/export wizard [Backlog]
97. Scheduled management email report [Backlog]
98. Offline mobile mode [Backlog]
99. Multi-branch/company support [Backlog]
100. AI daily operations brief [Backlog]

---

### Costing Estimator *(inside Customer CRM)*

Build professional customer-linked elevator costing records and send bid reports directly from the Customers CRM page.

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
- Costing design details: selected costing configuration, car and door construction, door operation/opening/vision, flooring, compliance standard, controller, motor, cabin, safety, rope, editable travel-segment labels and millimetres, and derived pit, overhead, total travel, and travel profile
- Evaluated cost breakdown: material, local installation, commissioning, warranty, margin, discount, and GST
- Inventory line details: S.No., item, description, specification, costing basis, costing notes, unit, quantity, actual quantity, base price, current price, amount basis, and exact line amount

**Estimator behaviour:**
- Passenger mode uses passenger-capacity options, while Goods and Dumbwaiter switch to the load-capacity options automatically.
- Fixed rupee margin mirrors the Excel costing sheets and recalculates price live.
- Recipient email, valid-until date, free-text notes, and add-ons remain available.
- The **Costing Import** module under CRM & Sales first sends only workbook names and byte sizes to OpenClaw. OpenClaw chooses A1/1A ordering, evaluates every workbook formula, verifies every formula-free value, every inventory input/line amount, and every FUZI total, then uses the normal Offer Manager save path.
- Saved offers retain only normalized, user-editable Offer Manager values. Workbook filenames, formulas, lookup tables, cell coordinates, and converted arrays are not saved on offers.
- Offer Manager loads a compact summary of the complete saved-offer history for its metrics, customer grouping, filters, and list controls. Full costing and inventory details are still fetched only when a user opens one offer.

**Live pricing:** Cost engine reads workbook-style component costs, applies capacity/specification selections, and adds the approved rupee margin in real time.

**Actions:**
- **Save Estimate** — persists to `fuzi.sqlite3` with status `Draft`
- **Edit Saved Estimate** — reopens the selected draft/saved estimate in the estimator for changes
- **Delete Saved Estimate** — removes a saved estimate when it should not be kept
- **View Report** — opens a printable/shareable HTML quotation page
- **Approve Offer PDF** — edits the offer text, approves it, and generates the PDF before sending
- **Send** — marks as `Sent`; if SMTP is configured sends the HTML report by email; otherwise opens your email client via `mailto:`
- Customers can **Accept** or **Decline** quotes from their portal

**Estimate statuses:** Draft → Sent → Accepted / Rejected

SMTP (optional): set `FUZI_SMTP_HOST`, `FUZI_SMTP_PORT`, `FUZI_SMTP_USER`, `FUZI_SMTP_PASS`, `FUZI_SMTP_FROM` to enable server-side delivery.

API: `GET /api/portal/estimates`, `POST /api/portal/estimates`, `PATCH /api/portal/estimates/<id>`, `DELETE /api/portal/estimates/<id>`, `GET /api/portal/estimates/<id>/report`, `GET /api/portal/estimates/<id>/offer.pdf`, `POST /api/portal/estimates/<id>/send`, `POST /api/portal/estimates/calculate`, `GET /api/portal/costing-source-data`

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

The Customer CRM page includes Enquiry Intake based on `docs/Enquiry Report.csv`; there is no separate Sales dashboard page.
It also includes Offer creation and the imported Offer Report from `docs/Offer Report.csv`, tied back into each CRM enquiry/customer row instead of shown as a separate dashboard section.

**Enquiry intake fields:**
- Enquiry number, lead/customer name, enquiry remark, lead status, WhatsApp number, lead type, quantity, phone, created date, referral by, created by, last modified by, assigned owner, and next follow-up.
- Imported report rows keep `source_enquiry_no` so CSV enquiries can be tracked without losing the original report reference.
- Each enquiry/customer row also carries a generated 4-digit `customer_id` so imported leads display a system customer ID even before they become full CRM accounts.
- Costing estimate records are linked to enquiries by source inquiry/customer ID and customer name, so each CRM row shows whether costing exists and the latest costing number/date/value/status.
- Automatic follow-up settings are stored on each CRM enquiry: channel, cadence in days, next follow-up date, status, and last follow-up date.
- The CRM Follow-up Queue shows records due today or overdue and can mark them followed up, close the follow-up, or reschedule by 3/7/14/30 days.
- Enquiry lifecycle statuses are fixed to: `Inquiry Pending`, `Inquiry Lost`, `Site Visit Pending`, `Site Visit Done`, `Site Not Visited, Offer Pending`, `Site Visit Lost`, `Offer Pending`, `Offer Submitted`, `Offer Lost`, `Order Received`, `Order Lost`, `Work In Progress`, `Hand Over`, `Warranty Running`, `Warranty Lost`, `AMC Running`, and `One Time Service`.
- The selected lifecycle status is displayed in the top-right of each enquiry/customer card.
- Lifecycle status can only be changed after clicking **Edit**. Lost statuses require a lost reason before saving.
- Quick follow-up intervals can only be changed after clicking **Edit**. The normal card displays follow-up state but does not show the `+3d`, `+7d`, `+14d`, or `+30d` mutation buttons.
- The report import has been merged into `fuzi.sqlite3`; the CRM now has 2,022 enquiry records available for intake and follow-up, with 20 records per page in the Enquiry Report Records section.
- `docs/Offer Report.csv` has been merged into `fuzi.sqlite3`; imported offer report records plus newly created offers are now managed from the matching CRM enquiry/customer row.

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
- India CRM fields: GSTIN, PAN, state/place of supply, lead source, account owner, preferred channel, next follow-up.
- Consent tracking: DPDP consent, marketing/DLT consent, DLT consent reference, and consent/compliance notes.
- Modern CRM workspace: lead/account pipeline, merged enquiry intake, all imported enquiry report records, editable customer records, search, stage filters, due follow-up badges, consent review badges, edit-only lifecycle status updates, edit-only follow-up scheduling, quick consent capture, and 20-record pagination for both customers and enquiry records.
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

Each job tracks: customer ID, site, type, crew, target date, progress %, current stage, per-stage status (`Open`, `In Progress`, `Done`, `Blocked`).
New installation jobs must be linked to an existing customer ID before they can be created.

API: `POST /api/portal/install-jobs`, `PATCH /api/portal/install-jobs/<id>/stages/<stage_id>`

Install completion handoff:
- Completed install jobs can be sent to the Commissioning board from the Install Team workspace.
- The handoff creates or updates a commissioning record and posts an install-team message for the Commissioning department.

API: `POST /api/portal/install-jobs/<id>/send-commissioning`

### CRM-Linked Installation Management

The Installations tab is now a CRM-first installation dashboard:

- Installation records cannot be created from freeform customer text; every record must be linked to an existing CRM customer ID.
- Selecting a CRM customer pulls read-only name, contact, mobile, email, site address, billing address, assigned salesperson, and CRM notes.
- CRM customer cards show installation history with status, install date, handover date, warranty end date, assigned team, contractor, and engineer.
- Installation records track project, lift, status, assigned team, contractor, engineer, start date, completion date, total days, and delays.
- Approval data is stored with approved by, approval date, remarks, and approval status. Records requested as `Under Installation` stay at `Installation Assigned` until approved.
- Technical detail capture includes motor, door, controller, drive, ARD/UPS, battery, door sensor, LOP/COP, button type, controller login, and protocol fields.
- Upload references can be saved for building photo, motor sticker photo, site photos, and lift video.
- Site readiness records lift-well construction status, expected completion date, and notes.
- Mandatory checklist tests are initialized for floor-to-floor level, overload, ARD, locking system, overspeed, and door sensor, plus 10 configurable custom tests.
- Handover fields store installed by, commissioned by, handed over by, handover date, warranty start/end, and final remarks.
- Panni removal and granite work are tracked with reminder-ready dates/statuses.
- Contractor information, contract value, payment terms, payment history, total paid, total due, and outstanding balance are stored on the installation record.
- Dashboard cards show total installations, pending work, site not ready, under installation, commissioning pending, panni pending, warranty expiring, and contractor dues.
- Lifecycle updates log CRM/WhatsApp-ready communication records for installation assignment, site not ready, installation start, commissioning, handover, warranty activation, and panni reminders.
- Installation reports can be filtered by search, status, and date range, then exported as CSV from the Installation tab.

API: `POST /api/portal/install-jobs`, `PATCH /api/portal/install-jobs/<id>`, `GET /api/portal/install-jobs/report?format=csv`, `GET/POST/PATCH /api/portal/installation-contractors`

---

### Install Team Management

Manage the installer and technician roster:

- Add team members with name, role, phone, shift, skills, notes, availability.
- Assign technicians to active jobs.
- Availability: `Available`, `On Site`, `Off Duty`, `Blocked`.
- Link technicians to portal login accounts.
- Expo Install Team workspace supports roster intake, one-tap job assignment from active install jobs, and quick availability updates.

API: `POST /api/portal/install-team`, `PATCH /api/portal/install-team/<id>`

---

### Inventory Management

Warehouse inventory control for parts and materials:

- 66 parts pre-loaded from the FUZI lift material list.
- Track quantity on hand, reserved quantity, available stock, bin location, unit, vendor, unit cost, and vendor lead time.
- Set a reorder trigger (`reorder_point`) and target stock (`target_stock`) per item.
- Existing stock cards include inline trigger/target inputs with `Save trigger`.
- Items at or below the trigger are shown in the Reorder Watchlist.
- `Order missing` raises a purchase order, records the PO number on the item, and marks the item `On Order`.
- `Receive +1` and `Issue -1` adjust warehouse stock with reason notes.
- Statuses are calculated from available stock and open purchase orders: `In Stock`, `Reorder Needed`, `Out of Stock`, and `On Order`.

API: `GET /api/portal/inventory`, `POST /api/portal/inventory`, `PATCH /api/portal/inventory/<id>`, `POST /api/portal/inventory/<id>/adjust`, `POST /api/portal/inventory/raise-po`, `GET /api/portal/inventory/ai-insights`

---

### Staff & Attendance *(new)*

**Org chart:**
- Visual tree of 11 pre-seeded nodes across all 7 departments.
- Department-coloured avatar cards with name, title, department, phone.
- Admin can add, edit, or remove people; reports-to hierarchy is maintained automatically when a node is removed.

**Attendance register:**
- HR portal dashboard with staff totals, today's attendance, unavailable staff, and pending leave counts.
- Searchable staff directory with department filters, staff phone/title/manager details, and one-click Present/Absent/Half-day/Leave actions.
- Daily register for every person in the org chart with one record per person per date.
- Mark status: Present, Late, Absent, Half-day, WFH, Leave, Holiday.
- Check-in and check-out time inputs.
- Optional notes per person.
- Attendance console for manual edits after selecting a staff member.
- Managers can mark attendance only for their own department; admin can mark for all.
- Staff can apply for leave with leave type, date range, and reason from their own login.
- Leave requests stay `Pending` until the department head/manager or admin approves or rejects them. Admin sees all leave requests; department heads see their department; regular staff see their own requests and history.

API: `GET /api/portal/org-chart`, `POST /api/portal/org-chart`, `PATCH /api/portal/org-chart/<id>`, `DELETE /api/portal/org-chart/<id>`, `GET /api/portal/attendance`, `POST /api/portal/attendance`, `PATCH /api/portal/attendance/<id>`, `GET /api/portal/leave-requests`, `POST /api/portal/leave-requests`, `PATCH /api/portal/leave-requests/<id>`

---

### Owner Control Tower

Rolls up all department data into a single leadership view:

- Headline: how many departments need attention today.
- Watchlist for operational pressure, revenue protection, and ownership.
- Department scorecards with accountable lead, status, and concrete next action.

---

### Service & Work Orders

- Customer-linked service records with job number, building, owner, and notes.
- Service records must be linked to an existing CRM customer before they can be created.
- New service visits capture a system-generated `service_number` and `breakdown_number`, date/time, CRM customer, assigned engineer, common elevator issue category, action taken, parts used, parts quantity, and customer comments.
- The top of the Service module shows the latest engineer check-ins and check-outs, including who is currently on site and the captured location when browser geolocation is granted.
- Service engineers can check in and check out from the Service module; each action stores timestamp and browser geolocation when permission is granted.
- Service managers can extend a customer's service contract by 1, 2, 3, or 5 years from the install/service end date; the new `service_end_date`, `service_contract_end_date`, and purchased service years are written back to Customer CRM.
- Linked CRM customer records store `service_count` / `services_done`, recalculated whenever service records or breakdown calls are created, edited, or deleted.
- Work order status tracking.
- Breakdown Portal dispatch assigns install/service staff from the saved team roster and supports dispatch, reached-site, and close statuses.
- Breakdown calls must be linked to an existing customer ID before they can be logged.
- Breakdown calls now capture a system-generated `breakdown_number`, date/time, CRM customer, assigned engineer, common elevator issue category, action taken, parts used, parts quantity, customer comments, and engineer check-in/check-out timestamps with browser geolocation when permission is granted.
- CRM customer profiles store date of birth and anniversary date for WhatsApp-ready occasion reminders.
- Admins can queue same-day birthday and anniversary reminders from Customer CRM; reminder records are saved in Department Comms and routed through the existing communication service when configured.

API: `GET/POST/PATCH /api/portal/service`, `GET/POST/PATCH /api/portal/work-orders`, `POST /api/portal/customers/occasion-reminders`

---

### Contract Renewals

- Renewal pipeline with days-to-expiry, contacted flag, contact email, and draft generation.
- CRM query agent answers renewal-status questions and posts results through the configured OpenClaw target.
- Maintenance renewals must be linked to an existing customer ID before they can be created.
- Existing maintenance renewal rows are reconciled into CRM customers so legacy renewal records also display a `CUST-###` link instead of remaining standalone building names.

API: `GET /api/portal/renewals`, `POST /api/portal/renewals`, `PATCH /api/portal/renewals/<id>`

---

### Platform Modules

Operating areas with owner, status, KPIs, and quick actions:

1. Lift Quotation Management
2. AMC & Preventive Maintenance
3. Breakdown Control
4. Installation Projects
5. Inventory & Stores
6. Customer CRM
7. Site Visit Reports
8. GAD Drawings
9. Accounts
10. Department Comms
11. Project Tickets
12. Projects
13. Install Team
14. Team Accounts
15. Renewals
16. Work Orders
17. Staff & Attendance
18. Installation Dept
19. Commissioning
20. Back Office
21. Tender
22. Factory
23. International Vendor

---

### International Vendor

Admin-only pipeline for FUZI international sales and shipping to USA and Canada elevator companies.

- Tracks partner prospects from `Lead identified` through qualification, catalog/cost-sheet outreach, tender partnership, PO request, production, export documents, freight booking, shipment, delivery, and active partner status.
- Lost partners are saved in CRM-style records but are not shown as active kanban work.
- Calculates vendor cost from FUZI manufacturing cost minus local install cost, shipping/freight, customs duty, import tax, broker and port fees, insurance, and the 2% Canada/USA partner margin.
- Supports both heavy lift kits and smaller smart-parts/sample shipments with freight mode, package count, dimensions, actual weight, CBM, volumetric weight, chargeable units, and destination country/port.
- Stores shipping execution fields: incoterm, export document status, production status, shipment status, tracking or BL/AWB reference, next follow-up, and OpenClaw/email target.
- Email sequence previews include catalog intro, tender partner pitch, cost-sheet follow-up, and smaller sample/smart-parts outreach.
- Outreach posts through the OpenClaw business channel delivery path so email/OpenClaw automation can send or hand off partner messages.

API: `GET /api/portal/international-vendors`, `POST /api/portal/international-vendors`, `PATCH /api/portal/international-vendors/<id>`, `POST /api/portal/international-vendors/<id>/outreach`

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

Auto-seeded manager accounts use the shared staff portal password hash from `fuzi.sqlite3`:

- `service.control.manager`
- `project.office.manager`
- `install.ops.manager`
- `stores.procurement.manager`
- `sales.renewals.manager`
- `customer.success.manager`

---

## Data Model

All portal data persists to the local SQLite database `fuzi.sqlite3`. The Node API stores each operational collection in the SQLite `json_collections` table so existing React/Expo forms can keep using the same collection names while runtime inputs are database writes. The old root-level operational JSON files have been removed after import.

Primary collections include staff portal accounts, customer/building records, customer portal credentials, project tickets, installation jobs, install team roster, inventory, costing estimates, sales/admin records, org chart, attendance, site visits, renewals, work orders, service records, and activity history.

Site visit records keep structured opening data under `opening_schedule`. Sales inquiries keep the selected lifecycle `status`/`lead_status`; lost statuses also store `lost_reason` / `status_lost_reason`.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `FUZI_SECRETS_FILE` | `../mystuffinfo/fuzi/fuzi.env` | Optional private local env file for non-password settings |
| `FUZI_PORTAL_TOKEN_TTL_MINUTES` | `480` | Sliding staff portal token lifetime in minutes |
| `FUZI_LOGIN_WINDOW_MINUTES` | `10` | Login throttling window |
| `FUZI_LOGIN_MAX_ATTEMPTS` | `8` | Failed attempts allowed per username/IP window |
| `FUZI_SMTP_HOST` | *(off)* | SMTP server for estimate emails |
| `FUZI_SMTP_PORT` | `587` | SMTP port |
| `FUZI_SMTP_USER` | *(off)* | SMTP username |
| `FUZI_SMTP_PASS` | *(off)* | SMTP password |
| `FUZI_SMTP_FROM` | *(SMTP_USER)* | From address for outbound emails |
| `FUZI_OPENCLAW_URL` | *(off)* | Full OpenClaw relay URL override |
| `FUZI_OPENCLAW_ADDRESS` | *(off)* | OpenClaw relay `host:port` override, for example `127.0.0.1:18789` |
| `FUZI_OPENCLAW_HOST` | `127.0.0.1`, or `host.docker.internal` inside Docker | OpenClaw relay host |
| `FUZI_OPENCLAW_PORT` | `18789` | OpenClaw relay port |
| `FUZI_DOCKER_INSTANCE` | auto-detected | Force Docker-aware OpenClaw defaults with `true` / `false` |
| `FUZI_OPENCLAW_TIMEOUT` | `4` | Relay request timeout (seconds) |
| `FUZI_OPENCLAW_CHANNEL` | `whatsapp` | Default outbound channel |
| `FUZI_OPENCLAW_OPS_TARGET` | *(off)* | Ops alert recipient |
| `FUZI_MONITOR_INTERVAL` | `300` | Background data-sync interval (seconds) |

---

## OpenClaw Agent Relay

Agent actions route through OpenClaw's authenticated gateway (`/tools/invoke`) and the FUZI API. The integration is intentionally split into two directions:

- Inbound platform/service messages are pushed into FUZI with `POST /api/openclaw/webhook`. FUZI saves them as background operational messages for dispatch/work-order automation.
- Outbound operational updates are emitted through `sendBusinessChannelUpdate()` in [server/index.mjs](server/index.mjs), which chooses a configured free communication channel and sends through OpenClaw `/tools/invoke`.
- Free outbound channels are WhatsApp, Telegram, Signal, Discord, and Slack. Phone-style targets can be routed through an injected backend channel such as Discord when WhatsApp is not the active transport.
- OpenClaw config/env loading, channel selection, and send behavior are provided by dependency injection in `createOpenClawCommunicationService()` and `createDiscordBreakdownSyncService()`.

The main routing targets are:

- `FUZI_OPENCLAW_TARGET_MODERNIZATION_COORDINATOR` → `#modernization-coordinator`
- `FUZI_OPENCLAW_TARGET_MORNING_BRIEF` → `#morning-brief`
- `FUZI_OPENCLAW_TARGET_LIVE_DASHBOARD` → `#live-operations`
- `FUZI_OPENCLAW_TARGET_RENEWALS` → `#renewals-crm`
- `FUZI_OPENCLAW_TARGET_WORK_ORDERS` → `#site-work-orders`
- `FUZI_OPENCLAW_TARGET_INSTALLATIONS` → `#field-installations`

Also set `FUZI_OPENCLAW_TARGET_BREAKDOWN_CHANNEL` for Discord `#fuzi-breakdown`. Use the external OpenClaw command helper to create/use an OpenClaw session named `fuzidiscordchannel` and run a read-only shell tool call to discover the current target without changing the FUZI breakdown target.

### `#fuzi-breakdown` Chat Input And Output

OpenClaw handles `#fuzi-breakdown` as the chat input surface for live breakdown reports. FUZI is the durable source of portal data, while OpenClaw decides the engineer from live FUZI context.

For each actionable breakdown message, OpenClaw should:

1. Parse the raw Discord text and message id.
2. Call `POST /api/openclaw/breakdown/available-context` with `message_id`, `text`, and `sender`.
3. Choose `scheduled_engineer` only from the returned `engineers` list. This list excludes busy engineers and includes `availability_summary`, `shift`, `active_breakdown_load`, and `assignment_score`; shift text such as `Available now - Shift 10:00 AM - 7:00 PM` is part of the assignment calculation.
4. Call `POST /api/openclaw/breakdown/from-discord` with the same message details plus `scheduled_engineer`.
5. If `/from-discord` returns `retry_required: true` or `engineer_busy: true`, do not reply as assigned; call `/api/openclaw/breakdown/available-context` again and choose a different available engineer.
6. Reply in Discord with the returned `reply` field.

Actionable messages include ordinary breakdown text and polite Hinglish temporary operation requests such as `Sir plz temporary hi on krwa dijiye pr plz krwa dijiye it's a humble request`. FUZI stores that as a high-priority temporary switch-on/operation request.

OpenClaw may output `NO_REPLY` only when a Discord message is genuinely unrelated to breakdown dispatch, such as casual chatter, thanks, or messages that do not describe a service action. In `#fuzi-breakdown`, do not use `NO_REPLY` for temporary operation phrases that include `temporary`, `on`, and `krwa`/`karwa`/`karva`, even when the text does not contain the word `breakdown`. Those messages must go through the FUZI context and save flow, then Discord should receive the returned `reply`.

The response body from `/api/openclaw/breakdown/from-discord` contains:

- `record`: the saved portal breakdown, including site, unit, fault, selected engineer, status, and source Discord message id.
- `summary`: the full operational summary for dashboards/logs.
- `reply`: the human-facing chat response OpenClaw should type in Discord. It is always one proper sentence that includes dispatch status, the current task id, and phone information when a phone number is available.

OpenClaw dispatch must use `POST /api/openclaw/breakdown/available-context`, which returns only available engineers. The older `/api/openclaw/breakdown/context` path is retired for dispatch and returns HTTP `410 Gone`; callers must switch to `/available-context`. FUZI also rejects a selected engineer at save time if that engineer is busy, unavailable, or missing, returning a retry response instead of writing the assignment.

The chat `reply` is intentionally concise and should sound like normal dispatch handling, for example:

- `Ok, Ravi Sharma is going to Hotel Bisau Palace.`
- `Ok, Pawan Meena is going to Yogesh Ji, B-149 Sitapura near GIT College, unit 10956.`
- `Ok, Shobhit Mudgal is going to current infra lift break down; phone is +91 90000 13010, and current task is BRK-080.`
- `Done, Hotel Star Place is marked Done; current task is BRK-080.`

Every returned `reply` is a single grammatical sentence. If no phone was detected, FUZI omits phone information from the sentence. The current task shows the active breakdown id assigned to the scheduled engineer, so Discord shows the same task id that appears in the Breakdown Portal.

Do not replace the short `reply` with the full `summary` unless someone explicitly asks for details. The detailed data already appears in the Breakdown Portal.

Pure status/acknowledgement words are meaningful in the channel:

- `Ok` acknowledges that the breakdown was logged or accepted.
- `Going to` means an available/scheduled engineer is being sent.
- `Done` means the job has been completed or closed.

### Breakdown Sync And Duplicate Protection

FUZI can also read OpenClaw's stored breakdown session history and import the latest bot confirmation message with `POST /api/portal/breakdown/sync-discord` or the background poller in [server/index.mjs](server/index.mjs). The sync path talks only to the OpenClaw gateway, using existing `sessions_list` / `sessions_history` tools, and preserves existing `assignment_source: "openclaw-judgement"` records so a later confirmation import cannot overwrite the engineer that OpenClaw already selected.

Existing Discord message ids are idempotent. Reprocessing the same `message_id` returns the existing breakdown and does not overwrite saved site, unit, phone, or fault text unless OpenClaw explicitly sends replacement fields.

### OpenClaw Memory Files

OpenClaw injects workspace guidance and can also load local memory from `C:\Users\User\.openclaw\workspace\memory`. These files are outside the repo but are important operational context for Discord behavior.

Current FUZI-related memory files:

- `C:\Users\User\.openclaw\workspace\memory\2026-06-01-breakdown-assignment.md`
- `C:\Users\User\.openclaw\workspace\memory\2026-06-01-breakdown-981.md`

Those files document that old examples repeatedly assigning unit `981` to Nadeem Khan are stale. They also tell OpenClaw to call the FUZI context endpoint, choose from live FUZI engineer data, save the chosen engineer, and reply with the short returned sentence.

If OpenClaw starts repeating old engineer assignments or long `Breakdown BRK-*` messages in Discord, inspect:

- `C:\Users\User\.openclaw\agents\main\sessions\sessions.json`
- the active `#fuzi-breakdown` session JSONL file referenced by `sessionFile`
- the FUZI memory files under `C:\Users\User\.openclaw\workspace\memory`

Reset the specific `#fuzi-breakdown` session after changing OpenClaw instructions so `systemSent` becomes false and the next Discord turn reloads `AGENTS.md` plus corrected memory.

Recommended related settings:

- `FUZI_OPENCLAW_URL` for the full local gateway base URL, or `FUZI_OPENCLAW_ADDRESS` / `FUZI_OPENCLAW_HOST` / `FUZI_OPENCLAW_PORT` for just the `host:port` part.
- `FUZI_OPENCLAW_TIMEOUT` for request timeout control.
- `FUZI_OPENCLAW_CHANNEL` for the default outbound delivery channel.
- `FUZI_OPENCLAW_PUSH_INGEST_ENABLED` to keep the inbound push route enabled.
- `FUZI_OPENCLAW_TARGET_BREAKDOWN_CHANNEL` for the Discord channel id or `channel:<id>` target used by breakdown sync.
- `FUZI_BREAKDOWN_DISCORD_POLL_MS` for the background breakdown sync interval.

---

## Verification

```bash
# Syntax checks
node --check server/index.mjs
npm run typecheck

# Data integrity
node -e "const db=require('better-sqlite3')('fuzi.sqlite3'); console.log(db.prepare('select name, length(payload) bytes from json_collections order by name').all())"
```

**After starting the Node API and Expo app, verify:**

- Staff login works in the Expo app at `http://127.0.0.1:8082`.
- `GET /api/portal/data`, `GET /api/portal/data/core/metrics`, and `GET /api/portal/data/inventory/inventory` return `401` without a bearer token.
- The portal UI loads `/api/portal/data/<workspace>/<part>` routes on demand as each workspace is used. Every array/list part has an explicit server-side transport profile (`rows_per_view`, `pages_per_chunk`, and usage), responses include `chunk` metadata, and "show more" can request later `/chunks/<index>` responses instead of loading the whole list up front.
- Customer CRM and Site Visit Reports work in the Expo app.
- Site Visit Reports create opening rows from stops/openings and save floor, FF height, and lintel height.
- Customer/enquiry status can only be changed after clicking Edit; lost statuses require a reason.
- The normal customer/enquiry card does not show `+3d/+7d/+14d/+30d`; follow-up interval controls appear in edit mode.
- Costing Estimator saved estimates render in the Expo app.
- Costing Estimator exposes the evaluated workbook meaning through editable technical, travel, cost-breakdown, and inventory controls without attaching source files or converted arrays.
- Sales Admin Panel shows FY (Apr-Mar) KPI totals and selected-date KPI drilldown.
- "Send" on a saved estimate triggers the email client (or SMTP if configured).
- Customers can log in and view their quotes.
- Accept / Decline on a quote updates its status in the staff portal.
- "Grant Portal Access" on a customer row creates a customer login.
- Org chart renders the company tree and edits persist.
- Attendance register saves check-in/out times and statuses.
- Search and status filters affect matching dashboard rows.
