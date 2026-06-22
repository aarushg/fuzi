import crypto from "node:crypto";
import { execFile } from "node:child_process";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import zlib from "node:zlib";
import express from "express";
import cors from "cors";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const defaultSecretsFile = path.resolve(rootDir, "..", "mystuffinfo", "fuzi", "fuzi.env");

function loadEnvFile(filePath) {
  if (!filePath || !fsSync.existsSync(filePath)) return;
  const content = fsSync.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

loadEnvFile(process.env.FUZI_SECRETS_FILE || defaultSecretsFile);

const port = Number(process.env.FUZI_API_PORT || 5000);
const tokens = new Map();
const loginAttempts = new Map();
const tokenTtlMs = Number(process.env.FUZI_PORTAL_TOKEN_TTL_MINUTES || 480) * 60 * 1000;
const loginWindowMs = Number(process.env.FUZI_LOGIN_WINDOW_MINUTES || 10) * 60 * 1000;
const loginMaxAttempts = Number(process.env.FUZI_LOGIN_MAX_ATTEMPTS || 8);
const dbPath = process.env.FUZI_DB_PATH || path.join(rootDir, "fuzi.sqlite3");
fsSync.mkdirSync(path.dirname(dbPath), { recursive: true });

const defaultOpenClawPort = "18789";
const localOpenClawHost = "127.0.0.1";
const dockerOpenClawHost = "host.docker.internal";

function envFlag(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return null;
}

function isDockerInstance(env = process.env) {
  const explicit = envFlag(env.FUZI_DOCKER_INSTANCE || env.FUZI_IS_DOCKER);
  if (explicit !== null) return explicit;
  if (fsSync.existsSync("/.dockerenv")) return true;
  try {
    return /docker|kubepods|containerd/i.test(fsSync.readFileSync("/proc/1/cgroup", "utf8"));
  } catch {
    return false;
  }
}

function openClawUrlFromAddress(address) {
  const value = String(address || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `http://${value}/`;
}

function defaultOpenClawUrl(env = process.env) {
  if (env.FUZI_OPENCLAW_URL) return env.FUZI_OPENCLAW_URL;
  if (env.FUZI_OPENCLAW_ADDRESS) return openClawUrlFromAddress(env.FUZI_OPENCLAW_ADDRESS);
  const host = env.FUZI_OPENCLAW_HOST || (isDockerInstance(env) ? dockerOpenClawHost : localOpenClawHost);
  const port = env.FUZI_OPENCLAW_PUBLISHED_PORT || env.FUZI_OPENCLAW_PORT || defaultOpenClawPort;
  return openClawUrlFromAddress(`${host}:${port}`);
}

function openClawUrlFromParts({ url = "", address = "", host = "", port = "" } = {}) {
  if (String(url || "").trim()) return String(url).trim();
  if (String(address || "").trim()) return openClawUrlFromAddress(address);
  const resolvedHost = String(host || "").trim();
  if (!resolvedHost) return "";
  return openClawUrlFromAddress(`${resolvedHost}:${String(port || defaultOpenClawPort).trim() || defaultOpenClawPort}`);
}

function hostPortFromUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.host;
  } catch {
    return "";
  }
}

function openClawConnectionTriedMessage(url = defaultOpenClawUrl(process.env)) {
  const attempted = String(url || "").trim();
  if (!attempted) return "";
  const hostPort = hostPortFromUrl(attempted);
  return hostPort ? `OpenClaw connection tried ${hostPort}.` : `OpenClaw connection tried ${attempted}.`;
}

function hasExplicitOpenClawConnectionEnv(env = process.env) {
  return Boolean(
    String(env.FUZI_OPENCLAW_URL || "").trim() ||
    String(env.FUZI_OPENCLAW_ADDRESS || "").trim() ||
    String(env.FUZI_OPENCLAW_HOST || "").trim() ||
    String(env.FUZI_OPENCLAW_PORT || "").trim() ||
    String(env.FUZI_OPENCLAW_PUBLISHED_PORT || "").trim()
  );
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS json_collections (
    name TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS app_secrets (
    name TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);
const readCollectionStmt = db.prepare("SELECT payload FROM json_collections WHERE name = ?");
const writeCollectionStmt = db.prepare(`
  INSERT INTO json_collections (name, payload, updated_at)
  VALUES (?, ?, ?)
  ON CONFLICT(name) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
`);
const readAppSecretStmt = db.prepare("SELECT value FROM app_secrets WHERE name = ?");
const writeAppSecretStmt = db.prepare(`
  INSERT INTO app_secrets (name, value, updated_at)
  VALUES (?, ?, ?)
  ON CONFLICT(name) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`);
const collectionCache = new Map();
const portalResponseCache = new Map();
const costingArtifactPasswords = new Map();
let dataVersion = 0;
const portalCacheTtlMs = Number(process.env.FUZI_PORTAL_CACHE_TTL_SECONDS || 20) * 1000;
const portalIntegrityTtlMs = Number(process.env.FUZI_PORTAL_INTEGRITY_TTL_SECONDS || 300) * 1000;
let portalIntegrityCheckedAt = 0;
let portalIntegrityPromise = null;

function invalidateRuntimeCaches(fileName) {
  if (fileName) collectionCache.delete(fileName);
  portalResponseCache.clear();
  dataVersion += 1;
}

const listFiles = {
  users: "users.json",
  customers: "customers.json",
  customer_assignments: "customer_assignments.json",
  department_assignments: "department_assignments.json",
  time_tracking: "time_tracking.json",
  department_history: "department_history.json",
  site_visits: "site_visits.json",
  estimates: "estimates.json",
  inventory: "inventory.json",
  project_tickets: "project_tickets.json",
  install_jobs: "install_jobs.json",
  install_team: "install_team.json",
  installation_contractors: "installation_contractors.json",
  payments: "payments.json",
  customer_users: "customer_users.json",
  sales_inquiries: "sales_inquiries.json",
  sales_admin_panel: "sales_admin_panel.json",
  breakdowns: "breakdowns.json",
  service_records: "service_records.json",
  gad_records: "gad_records.json",
  commissionings: "commissionings.json",
  factory_jobs: "factory_jobs.json",
  tenders: "tenders.json",
  dept_comms: "dept_comms.json",
  international_vendors: "international_vendors.json",
  marketing_assets: "marketing_assets.json",
  attendance: "attendance.json",
  leave_requests: "leave_requests.json",
  approvals: "approvals.json",
  documents: "documents.json",
  escalation_rules: "escalation_rules.json",
  conversations: "conversations.json",
  audit_logs: "audit_logs.json",
  warranty_records: "warranty_records.json",
  dispatch_records: "dispatch_records.json",
  readiness_checklists: "readiness_checklists.json",
  skill_matrix: "skill_matrix.json",
  handover_packs: "handover_packs.json",
  lift_assets: "lift_assets.json",
  parts_usage: "parts_usage.json",
  safety_incidents: "safety_incidents.json",
  tender_checklists: "tender_checklists.json",
  amc_contracts: "amc_contracts.json",
  service_reports: "service_reports.json",
  daily_briefs: "daily_briefs.json",
  org_chart: "org_chart.json"
};

const routeCollections = {
  "project-tickets": { key: "project_tickets", prefix: "PT" },
  "install-jobs": { key: "install_jobs", prefix: "JOB" },
  "install-team": { key: "install_team", prefix: "TM" },
  "installation-contractors": { key: "installation_contractors", prefix: "CON" },
  users: { key: "users", prefix: "USR", public: true },
  customers: { key: "customers", prefix: "CUST" },
  inventory: { key: "inventory", prefix: "INV" },
  estimates: { key: "estimates", prefix: "EST" },
  payments: { key: "payments", prefix: "PAY" },
  "org-chart": { key: "org_chart", prefix: "ORG" },
  attendance: { key: "attendance", prefix: "ATT" },
  "leave-requests": { key: "leave_requests", prefix: "LEAVE" },
  "customer-users": { key: "customer_users", prefix: "CU" },
  breakdown: { key: "breakdowns", prefix: "BRK" },
  service: { key: "service_records", prefix: "SVC" },
  gad: { key: "gad_records", prefix: "GAD" },
  commissioning: { key: "commissionings", prefix: "COM" },
  factory: { key: "factory_jobs", prefix: "FAC" },
  tender: { key: "tenders", prefix: "TDR" },
  comms: { key: "dept_comms", prefix: "MSG" },
  "marketing-assets": { key: "marketing_assets", prefix: "MKT" },
  approvals: { key: "approvals", prefix: "APR" },
  documents: { key: "documents", prefix: "DOC" },
  "escalation-rules": { key: "escalation_rules", prefix: "ESC" },
  conversations: { key: "conversations", prefix: "CNV" },
  "audit-logs": { key: "audit_logs", prefix: "AUD" },
  "warranty-records": { key: "warranty_records", prefix: "WAR" },
  "dispatch-records": { key: "dispatch_records", prefix: "DSP" },
  "readiness-checklists": { key: "readiness_checklists", prefix: "RDY" },
  "skill-matrix": { key: "skill_matrix", prefix: "SKL" },
  "handover-packs": { key: "handover_packs", prefix: "HOV" },
  "lift-assets": { key: "lift_assets", prefix: "LFT" },
  "parts-usage": { key: "parts_usage", prefix: "PRT" },
  "safety-incidents": { key: "safety_incidents", prefix: "SAF" },
  "tender-checklists": { key: "tender_checklists", prefix: "TDC" },
  "amc-contracts": { key: "amc_contracts", prefix: "AMC" },
  "service-reports": { key: "service_reports", prefix: "SRP" },
  "daily-briefs": { key: "daily_briefs", prefix: "BRF" },
  "sales/inquiries": { key: "sales_inquiries", prefix: "SIQ" },
  "sales/admin-panel": { key: "sales_admin_panel", prefix: "SAP", singleton: true }
};

const platformModules = [
  ["Lift Quotation Management", "Sales Desk", "Active", "Prepare, price, approve, and follow up on lift quotations."],
  ["AMC & Preventive Maintenance", "AMC Team", "Active", "Track renewals, service cadence, and maintenance commitments."],
  ["Breakdown Control", "Breakdown Desk", "Active", "Log calls, prioritize trapped-passenger cases, and monitor dispatch."],
  ["Installation Projects", "Installation Dept", "Active", "Track install stages, crew assignments, and handover dates."],
  ["Inventory & Stores", "Stores", "Active", "Watch stock levels, reorder thresholds, and purchase requests."],
  ["Customer CRM", "Customer Success", "Active", "Maintain customer, site, contact, and follow-up records."],
  ["Offer Manager", "Sales Desk", "Active", "Create customer-linked elevator offers from internal costing and prepare client offer letters."],
  ["Marketing Platform", "Marketing", "Active", "Use AI/OpenClaw to generate ad image prompts, campaign copy, and company catalog drafts."],
  ["Site Visit Reports", "Sales Desk", "Active", "Capture site measurements tied to saved customer IDs."],
  ["GAD Drawings", "GAD", "Active", "Track drawing submissions, revisions, and approvals."],
  ["Accounts", "Accounts", "Active", "Follow payment milestones and outstanding balances."],
  ["Department Comms", "Operations", "Active", "Share department messages and read-status updates."],
  ["Project Tickets", "Project Office", "Active", "Create, assign, and close cross-department project tickets."],
  ["Projects", "Installation Dept", "Active", "Keep project records aligned with installation jobs."],
  ["Install Team", "Installation Dept", "Active", "Maintain technicians, roles, availability, and current assignments."],
  ["Team Accounts", "Admin", "Active", "Manage portal users, departments, roles, and access state."],
  ["Renewals", "AMC Team", "Active", "Manage renewal dates, customer outreach, and contract status."],
  ["Work Orders", "Service Desk", "Active", "Capture and update work order execution status."],
  ["Staff & Attendance", "HR", "Active", "Record attendance and staff visibility."],
  ["Installation Dept", "Installation Dept", "Active", "Coordinate department execution and handover."],
  ["Commissioning", "Commissioning", "Active", "Track commissioning checks and final handover readiness."],
  ["Back Office", "Back Office", "Active", "Keep customer records, documents, and operational admin data together."],
  ["Tender", "Tender", "Active", "Track tender opportunities, submissions, revisions, and result."],
  ["Factory", "Factory", "Active", "Track production stages, materials, and dispatch readiness."],
  ["International Vendor", "Admin", "Active", "Track USA/Canada elevator-company partners, landed kit cost, tenders, and outreach."]
  ].map(([name, owner, status, summary]) => ({ name, owner, status, summary }));

const operationsPrefixes = {
  renewals: "REN",
  work_orders: "WO"
};

async function readJson(fileName, fallback = []) {
  if (collectionCache.has(fileName)) return collectionCache.get(fileName);
  const stored = readCollectionStmt.get(fileName);
  if (stored?.payload) {
    try {
      const parsed = JSON.parse(stored.payload) ?? fallback;
      collectionCache.set(fileName, parsed);
      return parsed;
    } catch {
      return fallback;
    }
  }
  try {
    const text = await fs.readFile(path.join(rootDir, fileName), "utf8");
    const parsed = JSON.parse(text);
    writeCollectionStmt.run(fileName, JSON.stringify(parsed ?? fallback), new Date().toISOString());
    const value = parsed ?? fallback;
    collectionCache.set(fileName, value);
    return value;
  } catch {
    writeCollectionStmt.run(fileName, JSON.stringify(fallback), new Date().toISOString());
    collectionCache.set(fileName, fallback);
    return fallback;
  }
}

async function writeJson(fileName, value) {
  writeCollectionStmt.run(fileName, JSON.stringify(value), new Date().toISOString());
  invalidateRuntimeCaches(fileName);
  collectionCache.set(fileName, value);
}

function publicUser(user) {
  const { password_hash, ...safe } = user;
  if (isAtulSinghal(safe)) safe.role = "ceo";
  else safe.role = normalizePortalRole(safe.role || "staff");
  return safe;
}

function isAtulSinghal(user = {}) {
  const text = staffLookupKey(`${user.username || ""} ${user.display_name || ""} ${user.name || ""}`);
  return text.includes("atul singhal") || text.includes("atulsinghal");
}

function isJitendraServiceManager(user = {}) {
  const nameText = staffLookupKey(`${user.username || ""} ${user.display_name || ""} ${user.name || ""}`);
  const department = staffLookupKey(user.department || "");
  const title = staffLookupKey(`${user.title || ""} ${user.position || ""} ${user.role || ""}`);
  const isJitendra = nameText.includes("jitendra choudhary") ||
    nameText.includes("jitendrachoudhary") ||
    nameText.includes("jitendra choudry") ||
    nameText.includes("jitendrachoudry");
  return isJitendra || (department === "service" && /supervisor|manager|head/.test(title));
}

function isRetiredGenericServiceManager(user = {}) {
  const username = staffLookupKey(user.username || "");
  const displayName = staffLookupKey(user.display_name || user.name || "");
  const department = staffLookupKey(user.department || "");
  return username === "service manager" || (displayName === "service manager" && department === "service");
}

function isAdminUser(user = {}) {
  const role = String(user.role || "").trim().toLowerCase();
  return role === "admin" || role === "ceo" || isAtulSinghal(user);
}

function canManageCustomerAssignments(user = {}) {
  const role = String(user.role || "").trim().toLowerCase();
  const title = String(user.title || user.position || "").trim().toLowerCase();
  return isAdminUser(user) || isJitendraServiceManager(user) || role.includes("manager") || role.includes("lead") || title.includes("manager") || title.includes("lead");
}

function canManageServiceRecords(user = {}) {
  return isAdminUser(user) || isJitendraServiceManager(user);
}

function serviceAssignmentKeysForUser(user = {}) {
  return new Set([
    staffLookupKey(user.display_name || user.name || ""),
    staffLookupKey(String(user.username || "").replace(/\./g, " ")),
    staffLookupKey(user.username || ""),
    staffLookupKey(user.linked_org_node || ""),
    staffLookupKey(user.linked_team_member || "")
  ].filter(Boolean));
}

function serviceRecordAssignedToUser(record = {}, user = {}) {
  if (canManageServiceRecords(user)) return true;
  const keys = serviceAssignmentKeysForUser(user);
  if (!keys.size) return false;
  const assignmentFields = [
    record.assigned_engineer,
    record.technician,
    record.engineer,
    record.assigned_to,
    record.service_engineer,
    record.staff_id,
    record.staff_name,
    record.person_id
  ];
  return assignmentFields.some((value) => {
    const text = staffLookupKey(value || "");
    return text && [...keys].some((key) => text === key || text.includes(key) || key.includes(text));
  });
}

function serviceUpdateCapturesVisitPoint(body = {}) {
  return ["check_in_at", "check_out_at", "check_in_location", "check_out_location"].some((key) => Object.prototype.hasOwnProperty.call(body, key));
}

function serviceRecordIsActivelyCheckedIn(record = {}) {
  return Boolean(String(record.check_in_at || "").trim() && !String(record.check_out_at || "").trim());
}

function serviceRecordIsClosed(record = {}) {
  return /closed|resolved|done|completed|cancelled|canceled|rejected/i.test(String(record.status || record.state || record.lead_status || "").trim());
}

function serviceAssignmentName(record = {}) {
  return String(record.assigned_engineer || record.technician || record.engineer || record.assigned_to || record.service_engineer || "").trim();
}

function serviceAssignableName(record = {}) {
  return String(record.name || record.display_name || record.username || "").replace("-", "").trim();
}

function serviceAssignableDepartment(record = {}) {
  return String(record.department || record.team || record.role || record.title || "").replace("-", "").trim();
}

function serviceAssignableBlocked(record = {}) {
  const text = staffLookupKey(`${record.name || ""} ${record.display_name || ""} ${record.username || ""} ${record.department || ""} ${record.team || ""} ${record.title || ""} ${record.position || ""} ${record.role || ""}`);
  const role = staffLookupKey(record.role || "");
  const isManager = /manager|admin|ceo|director|supervisor|head/.test(text) || ["admin", "ceo", "manager"].includes(role);
  const isJitendra = text.includes("jitendra") && /choudh?ary|choudry/.test(text);
  return isManager || isJitendra || /\bbreakdown\b|\binstallation\b|\binstall\b/.test(text);
}

async function readAssignableServiceStaff() {
  const [users, installTeam, orgChart] = await Promise.all([
    readJson(listFiles.users, []),
    readJson(listFiles.install_team, []),
    readJson(listFiles.org_chart, [])
  ]);
  const activeServiceUsers = users
    .filter((item) => item.active !== false && String(item.active || "true") !== "false")
    .filter((item) => isServiceTeamMember(item) && !serviceAssignableBlocked(item));
  const rows = activeServiceUsers.length ? activeServiceUsers : [...installTeam, ...orgChart, ...users]
    .filter((item) => isServiceTeamMember(item) && !serviceAssignableBlocked(item));
  const seen = new Set();
  return rows.map((item) => {
    const name = serviceAssignableName(item);
    return {
      id: String(item.id || item.linked_org_node || name),
      name,
      department: serviceAssignableDepartment(item) || "Service",
      availability: String(item.availability || (item.current_job ? "Scheduled" : "Available")).trim(),
      current_job: String(item.current_job || item.current_task || "").trim(),
      shift: String(item.shift || "").trim()
    };
  }).filter((item) => {
    const key = staffLookupKey(item.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function serviceLoadForEngineer(engineerName, serviceRecords = [], breakdowns = []) {
  const engineerKey = staffLookupKey(engineerName);
  if (!engineerKey) return 0;
  const activeServices = serviceRecords.filter((record) =>
    !serviceRecordIsClosed(record) &&
    staffLookupKey(serviceAssignmentName(record)) === engineerKey
  ).length;
  const activeBreakdowns = breakdowns.filter((record) =>
    !serviceRecordIsClosed(record) &&
    staffLookupKey(serviceAssignmentName(record) || record.scheduled_engineer) === engineerKey
  ).length;
  return activeServices + activeBreakdowns;
}

async function autoAssignServicePayload(payload = {}, existingRecords = []) {
  const requestedEngineer = serviceAssignmentName(payload);
  if (requestedEngineer) {
    return {
      assigned_engineer: requestedEngineer,
      technician: requestedEngineer,
      assignment_source: String(payload.assignment_source || "manual").trim()
    };
  }

  const installJobId = String(payload.install_job_id || payload.job_id || "").trim();
  const customerId = String(payload.customer_id || "").trim();
  const customerName = staffLookupKey(payload.customer || payload.customer_name || "");
  const installJobs = await readJson(listFiles.install_jobs, []);
  const linkedInstallJob = installJobs.find((job) => {
    const jobId = String(job.id || job.job_id || "").trim();
    const jobCustomerId = String(job.customer_id || "").trim();
    return Boolean(
      (installJobId && jobId === installJobId) ||
      (customerId && jobCustomerId === customerId) ||
      (customerName && staffLookupKey(job.customer || job.customer_name || job.project_name || "") === customerName)
    );
  });
  const linkedEngineer = serviceAssignmentName({
    assigned_engineer: linkedInstallJob?.service_engineer || linkedInstallJob?.assigned_engineer,
    technician: linkedInstallJob?.technician,
    engineer: linkedInstallJob?.engineer,
    assigned_to: linkedInstallJob?.assigned_to
  });
  if (linkedEngineer) {
    return {
      assigned_engineer: linkedEngineer,
      technician: linkedEngineer,
      assignment_source: "system-linked-install-job",
      assignment_reason: "Automatically assigned from the linked installation job engineer."
    };
  }

  const serviceStaff = await readAssignableServiceStaff();
  if (!serviceStaff.length) {
    return {
      assignment_source: "system-unassigned",
      assignment_reason: "No active service engineer roster was found; assign manually."
    };
  }
  const breakdowns = await readJson(listFiles.breakdowns, []);
  const selected = serviceStaff
    .map((member, index) => {
      const availability = staffLookupKey(member.availability || "Available");
      const busy = Boolean(member.current_job) || /inactive|off|leave|holiday|unavailable|busy|scheduled|on site|onsite/.test(availability);
      const load = serviceLoadForEngineer(member.name, existingRecords, breakdowns);
      const score = (busy ? 1000 : 0) + (load * 10) + index;
      return { member, load, score };
    })
    .sort((left, right) => left.score - right.score)[0];
  const engineer = selected?.member?.name || "";
  if (!engineer) {
    return {
      assignment_source: "system-unassigned",
      assignment_reason: "No active service engineer could be selected; assign manually."
    };
  }
  return {
    assigned_engineer: engineer,
    technician: engineer,
    assignment_source: "system-auto-least-loaded",
    assignment_reason: `Automatically assigned to the least-loaded service engineer (${selected.load} active job${selected.load === 1 ? "" : "s"}).`
  };
}

function canManageStaffAttendance(user = {}) {
  const role = staffLookupKey(user.role || "");
  const title = staffLookupKey(`${user.title || ""} ${user.position || ""}`);
  const department = staffLookupKey(user.department || "");
  return isAdminUser(user) ||
    isJitendraServiceManager(user) ||
    department === "executive office" ||
    /manager|lead|supervisor|hr|admin/.test(`${role} ${title}`);
}

function isServiceTeamMember(record = {}) {
  const department = staffLookupKey(record.department || "");
  const team = staffLookupKey(record.team || record.department_name || record.group || "");
  const text = staffLookupKey(`${record.name || ""} ${record.display_name || ""} ${record.username || ""} ${record.title || ""} ${record.position || ""}`);
  return department === "service" || team === "service" || /\bservice\b/.test(text);
}

function isServiceManagerScopedUser(user = {}) {
  return isJitendraServiceManager(user) && !isAdminUser(user);
}

function serviceTeamScopeFromOrgChart(orgChart = []) {
  const serviceOrgChart = Array.isArray(orgChart) ? orgChart.filter(isServiceTeamMember) : [];
  return {
    orgChart: serviceOrgChart,
    ids: new Set(serviceOrgChart.map((person) => String(person.id || "").trim()).filter(Boolean)),
    names: new Set(serviceOrgChart.map((person) => staffLookupKey(person.name || person.display_name || "")).filter(Boolean))
  };
}

function recordMatchesServiceTeamScope(record = {}, scope = serviceTeamScopeFromOrgChart([])) {
  return isServiceTeamMember(record) ||
    scope.ids.has(String(record.linked_org_node || record.person_id || record.staff_id || record.id || "").trim()) ||
    scope.names.has(staffLookupKey(record.display_name || record.person_name || record.staff_name || record.name || record.username || ""));
}

async function serviceTeamScopeForUser(user = {}) {
  if (!isServiceManagerScopedUser(user)) return null;
  const orgChart = await readJson(listFiles.org_chart, []);
  return serviceTeamScopeFromOrgChart(orgChart);
}

function applyServiceManagerCollectionScope(collectionKey, records, scope) {
  if (!scope || !Array.isArray(records)) return records;
  if (collectionKey === "org_chart") return scope.orgChart;
  if (["users", "attendance", "leave_requests"].includes(collectionKey)) {
    return records.filter((record) => recordMatchesServiceTeamScope(record, scope));
  }
  return records;
}

function attendanceKeysForUser(user = {}) {
  return new Set([
    staffLookupKey(user.display_name || user.name || ""),
    staffLookupKey(String(user.username || "").replace(/\./g, " ")),
    staffLookupKey(user.username || ""),
    staffLookupKey(user.linked_org_node || ""),
    staffLookupKey(user.linked_team_member || "")
  ].filter(Boolean));
}

function attendanceRecordBelongsToUser(record = {}, user = {}) {
  if (canManageStaffAttendance(user)) return true;
  return attendanceRecordIsSelf(record, user);
}

function attendanceRecordIsSelf(record = {}, user = {}) {
  const keys = attendanceKeysForUser(user);
  if (!keys.size) return false;
  const fields = [
    record.person_id,
    record.staff_id,
    record.id,
    record.person_name,
    record.staff_name,
    record.name,
    record.display_name,
    record.username
  ];
  return fields.some((value) => {
    const text = staffLookupKey(value || "");
    return text && [...keys].some((key) => text === key || (key.length >= 4 && text.includes(key)) || (text.length >= 4 && key.includes(text)));
  });
}

function attendanceEntryFromPayload(payload = {}, existing = {}, now = new Date().toISOString()) {
  const explicitAction = String(payload.attendance_action || payload.action_type || "").trim();
  const checkIn = String(payload.check_in || "").trim();
  const checkOut = String(payload.check_out || "").trim();
  const existingCheckIn = String(existing.check_in || existing.time_in || "").trim();
  const existingCheckOut = String(existing.check_out || existing.time_out || "").trim();
  const action = explicitAction ||
    (checkOut && checkOut !== existingCheckOut ? "check_out" : "") ||
    (checkIn && checkIn !== existingCheckIn ? "check_in" : "");
  if (!["check_in", "check_out"].includes(action)) return null;
  const time = action === "check_out" ? checkOut : checkIn;
  const location = action === "check_out" ? payload.check_out_location : payload.check_in_location;
  return {
    id: `${action}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action,
    label: action === "check_out" ? "Check out" : "Check in",
    date: String(payload.date || existing.date || now.slice(0, 10)).trim(),
    time,
    timestamp: String(payload.marked_at || now),
    location: location || null,
    marked_by: String(payload.marked_by || "").trim(),
    notes: String(payload.notes || "").trim()
  };
}

function makeWerkzeugScryptHash(password) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const N = 32768;
  const r = 8;
  const p = 1;
  const derived = crypto.scryptSync(password, salt, 64, { N, r, p, maxmem: 128 * N * r * 2 });
  return `scrypt:${N}:${r}:${p}$${salt}$${derived.toString("hex")}`;
}

function readAppSecret(name) {
  return String(readAppSecretStmt.get(name)?.value || "");
}

function writeAppSecret(name, value) {
  writeAppSecretStmt.run(name, value, new Date().toISOString());
}

function sharedStaffPortalPasswordHash() {
  const storedHash = readAppSecret("shared_staff_portal_password_hash");
  if (storedHash) return storedHash;
  throw new Error("shared_staff_portal_password_hash is missing from fuzi.sqlite3. Add it to the app_secrets table before starting FUZI.");
}

function slugName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

function staffLookupKey(value = "") {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function isActiveAssignment(record = {}) {
  return record.active_status !== false && String(record.active_status || "true").toLowerCase() !== "false";
}

async function staffDirectory() {
  const [orgChart, users] = await Promise.all([
    readJson(listFiles.org_chart, []),
    readJson(listFiles.users, [])
  ]);
  const usersByOrgNode = new Map(users.map((user) => [String(user.linked_org_node || "").trim(), user]));
  const usersByName = new Map(users.map((user) => [staffLookupKey(user.display_name || user.username), user]));
  const records = [];
  for (const person of orgChart) {
    const name = String(person.name || "").trim();
    if (!name) continue;
    const id = String(person.id || name).trim();
    const linkedUser = usersByOrgNode.get(id) || usersByName.get(staffLookupKey(name));
    records.push({
      id,
      user_id: String(linkedUser?.id || ""),
      username: String(linkedUser?.username || ""),
      name,
      department: String(person.department || linkedUser?.department || "").trim(),
      role: String(person.title || linkedUser?.role || "").trim(),
      avatar_url: String(person.avatar_url || person.photo_url || linkedUser?.avatar_url || ""),
      active: linkedUser?.active !== false
    });
  }
  for (const user of users) {
    const name = String(user.display_name || user.username || "").trim();
    const id = String(user.linked_org_node || user.id || user.username || name).trim();
    if (!name || records.some((record) => record.id === id || staffLookupKey(record.name) === staffLookupKey(name))) continue;
    records.push({
      id,
      user_id: String(user.id || ""),
      username: String(user.username || ""),
      name,
      department: String(user.department || "").trim(),
      role: String(user.role || "").trim(),
      avatar_url: String(user.avatar_url || ""),
      active: user.active !== false
    });
  }
  return records;
}

function isDepartmentHead(person) {
  return /head|supervisor|manager|director|ceo/i.test(`${person.title || ""} ${person.name || ""}`);
}

function portalRoleForStaff(person = {}, managers = new Set()) {
  const title = staffLookupKey(`${person.title || ""} ${person.position || ""} ${person.role || ""}`);
  const department = staffLookupKey(person.department || "");
  if (isAtulSinghal(person) || department === "executive office" || title.includes("ceo") || title.includes("director")) return "ceo";
  if (isJitendraServiceManager(person) || isDepartmentHead(person) || managers.has(person.id)) return "manager";
  return "staff";
}

function normalizePortalRole(value = "staff") {
  const role = staffLookupKey(value);
  if (role === "admin" || role === "ceo" || role === "director" || role === "executive office") return "ceo";
  if (role === "manager" || role === "supervisor" || role === "head" || role === "team lead" || role === "teamlead") return "manager";
  if (role === "technician" || role === "engineer") return "technician";
  return "staff";
}

function accessForUser(user = {}) {
  const allViews = [
    "today", "overview", "modules", "backlog", "customers", "offerManager", "marketing", "tickets", "projects", "installations", "team", "accounts",
    "renewals", "workorders", "inventory", "estimator", "orgchart", "sales", "installation_dept", "breakdown", "service",
    "gad", "finance", "commissioning", "backoffice", "tender", "factory", "internationalVendor", "comms", "siteVisits", "intelligence",
    "approvals", "documents", "engineer"
  ];
  if (isAdminUser(user) || String(user.department || "").toLowerCase() === "executive office") {
    return { allowed_views: allViews, selected_view: "overview", default_view: "overview", is_restricted: false };
  }
  const byDepartment = {
    sales: ["today", "overview", "intelligence", "backlog", "customers", "offerManager", "marketing", "sales", "renewals", "estimator", "siteVisits", "approvals", "documents", "comms"],
    installation: ["today", "overview", "intelligence", "backlog", "customers", "installations", "team", "installation_dept", "commissioning", "siteVisits", "orgchart", "approvals", "documents", "engineer", "comms"],
    "install operations": ["today", "overview", "intelligence", "backlog", "customers", "installations", "team", "installation_dept", "commissioning", "siteVisits", "orgchart", "approvals", "documents", "engineer", "comms"],
    breakdown: ["today", "overview", "intelligence", "backlog", "customers", "breakdown", "workorders", "orgchart", "documents", "engineer", "comms"],
    service: ["today", "overview", "intelligence", "backlog", "customers", "workorders", "service", "orgchart", "approvals", "documents", "engineer", "comms"],
    gad: ["today", "overview", "intelligence", "backlog", "customers", "gad", "projects", "approvals", "documents", "comms"],
    accounts: ["today", "overview", "intelligence", "backlog", "customers", "offerManager", "marketing", "finance", "estimator", "approvals", "documents", "comms"],
    commissioning: ["today", "overview", "intelligence", "backlog", "customers", "commissioning", "installations", "orgchart", "approvals", "documents", "engineer", "comms"],
    tender: ["today", "overview", "intelligence", "backlog", "customers", "offerManager", "tender", "estimator", "approvals", "documents", "comms"],
    factory: ["today", "overview", "intelligence", "backlog", "factory", "inventory", "installations", "approvals", "documents", "comms"],
    "back office": ["today", "overview", "intelligence", "backlog", "customers", "backoffice", "accounts", "orgchart", "siteVisits", "approvals", "documents", "comms"],
    "project office": ["today", "overview", "intelligence", "backlog", "tickets", "projects", "installations", "team", "orgchart", "approvals", "documents", "comms"],
    staff: ["today", "overview", "intelligence", "backlog", "customers", "siteVisits", "orgchart", "documents", "engineer", "comms"],
    "stores & procurement": ["today", "overview", "intelligence", "backlog", "inventory", "factory", "approvals", "documents", "comms"]
  };
  if (isJitendraServiceManager(user)) {
    return { allowed_views: ["customers", "service", "orgchart"], selected_view: "service", default_view: "service", is_restricted: true };
  }
  const key = String(user.department || "").toLowerCase();
  const role = String(user.role || "").toLowerCase();
  if (key === "service" && role !== "manager") {
    const engineerServiceViews = ["service"];
    return { allowed_views: engineerServiceViews, selected_view: "service", default_view: "service", is_restricted: true };
  }
  const allowed = [...(byDepartment[key] || ["today", "overview", "comms"])];
  if (!allowed.includes("orgchart")) allowed.push("orgchart");
  if (!allowed.includes("siteVisits")) allowed.push("siteVisits");
  return { allowed_views: allowed, selected_view: allowed[0], default_view: allowed[0], is_restricted: true };
}

const viewDataKeys = {
  today: ["customers", "sales_inquiries", "site_visits", "breakdowns", "inventory", "payments", "tenders", "install_jobs", "service_records", "renewals", "work_orders", "project_tickets", "dept_comms", "approvals", "documents", "org_chart", "attendance_today"],
  intelligence: ["customers", "customer_users", "sales_inquiries", "site_visits", "breakdowns", "inventory", "payments", "tenders", "install_jobs", "install_team", "service_records", "renewals", "work_orders", "project_tickets", "dept_comms", "approvals", "documents", "org_chart", "attendance_today", "estimates", "escalation_rules", "conversations", "audit_logs", "customer_assignments", "warranty_records", "dispatch_records", "readiness_checklists", "skill_matrix", "handover_packs", "lift_assets", "parts_usage", "safety_incidents", "tender_checklists", "amc_contracts", "service_reports", "daily_briefs"],
  overview: ["customers", "customer_assignments", "department_assignments", "time_tracking", "department_history", "org_chart", "users"],
  modules: ["platform_modules"],
  customers: ["customers", "customer_assignments", "customer_users", "sales_inquiries", "estimates", "payments", "site_visits", "install_jobs", "service_records", "breakdowns", "renewals", "commissionings", "dept_comms", "documents", "org_chart", "users"],
  offerManager: ["customers", "sales_inquiries", "site_visits", "estimates"],
  marketing: ["marketing_assets", "customers", "estimates", "international_vendors"],
  tickets: ["project_tickets"],
  projects: ["projects", "install_jobs", "customers", "customer_assignments", "department_assignments", "time_tracking", "department_history", "org_chart", "users"],
  installations: ["installations", "install_jobs", "customers", "install_team", "installation_contractors", "payments", "project_tickets", "service_records", "commissionings", "dept_comms"],
  team: ["install_team", "install_jobs"],
  accounts: ["users"],
  renewals: ["renewals"],
  workorders: ["work_orders"],
  inventory: ["inventory", "inventory_insights"],
  estimator: ["estimates", "payments", "customers"],
  orgchart: ["org_chart", "attendance_today", "leave_requests"],
  sales: ["sales_inquiries", "sales_admin_panel", "customers", "install_jobs"],
  installation_dept: ["install_jobs", "installations"],
  breakdown: ["breakdowns", "customers", "sales_inquiries", "install_team"],
  service: ["service_records", "customers", "install_jobs", "install_team"],
  gad: ["gad_records", "customers"],
  finance: ["payments", "customers", "estimates"],
  commissioning: ["commissionings", "install_jobs", "dept_comms"],
  backoffice: ["customers", "site_visits"],
  tender: ["tenders", "customers", "estimates"],
  factory: ["factory_jobs", "inventory"],
  internationalVendor: ["international_vendors"],
  comms: ["dept_comms"],
  siteVisits: ["site_visits", "customers", "sales_inquiries", "org_chart"],
  approvals: ["approvals", "estimates", "tenders", "payments", "install_jobs", "inventory", "customers"],
  documents: ["documents", "customers", "site_visits", "tenders", "install_jobs", "service_records", "breakdowns"],
  engineer: ["breakdowns", "service_records", "install_jobs", "install_team", "org_chart", "attendance_today", "customers"]
};

const restrictedPayloadKeys = [
  "projects", "installations", "renewals", "work_orders", "project_tickets", "install_jobs", "install_team", "installation_contractors",
  "users", "customers", "customer_assignments", "department_assignments", "time_tracking", "department_history", "site_visits", "platform_modules", "inventory", "inventory_insights", "org_chart", "attendance_today",
  "leave_requests", "estimates", "payments", "customer_users", "sales_inquiries", "sales_admin_panel", "breakdowns", "service_records",
  "gad_records", "commissionings", "factory_jobs", "tenders", "international_vendors", "marketing_assets", "dept_comms",
  "approvals", "documents", "escalation_rules", "conversations", "audit_logs", "warranty_records", "dispatch_records", "readiness_checklists", "skill_matrix", "handover_packs",
  "lift_assets", "parts_usage", "safety_incidents", "tender_checklists", "amc_contracts", "service_reports", "daily_briefs"
];

const costingImportSessionKey = "agent:main:explicit:fuzi-costing-workbook-import";

function costingWorkbookDir() {
  return path.join(rootDir, "docs", "6-passenger-costing");
}

function normalizeCostingOrderMode(value) {
  return String(value || "").trim().toUpperCase() === "1A" ? "1A" : "A1";
}

async function listCostingWorkbookManifest() {
  const docsDir = costingWorkbookDir();
  const entries = await fs.readdir(docsDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".xlsx") || entry.name.startsWith(".~lock.")) continue;
    const fullPath = path.join(docsDir, entry.name);
    const stats = await fs.stat(fullPath);
    files.push({
      source_file: entry.name,
      bytes: stats.size,
      size_bytes: stats.size,
      size_kb: Number((stats.size / 1024).toFixed(2)),
      modified_at: stats.mtime.toISOString()
    });
  }
  files.sort((a, b) => a.source_file.localeCompare(b.source_file));
  return {
    session_key: costingImportSessionKey,
    workbook_dir: "docs/6-passenger-costing",
    source_count: files.length,
    files
  };
}

function costingOrderDecisionsMap(orderDecisions = {}) {
  if (Array.isArray(orderDecisions)) {
    return Object.fromEntries(orderDecisions.map((item) => [
      String(item?.source_file || item?.file || item?.name || "").trim(),
      normalizeCostingOrderMode(item?.order_mode || item?.order || item?.mode)
    ]).filter(([name]) => name));
  }
  if (!orderDecisions || typeof orderDecisions !== "object") return {};
  return Object.fromEntries(Object.entries(orderDecisions).map(([name, mode]) => [name, normalizeCostingOrderMode(mode)]));
}

function parseCostingWorkbooks({ orderDecisions = {}, defaultOrderMode = "A1" } = {}) {
  const normalizedDefaultOrderMode = normalizeCostingOrderMode(defaultOrderMode);
  const normalizedOrderDecisions = costingOrderDecisionsMap(orderDecisions);
  const script = String.raw`
import json, pathlib, re, sys, zipfile
from xml.etree import ElementTree as ET

root = pathlib.Path(sys.argv[1])
default_order_mode = sys.argv[2] if len(sys.argv) > 2 else "A1"
try:
    order_decisions = json.loads(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[3] else {}
except json.JSONDecodeError:
    order_decisions = {}
ns = {
    "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}

def shared_strings(z):
    if "xl/sharedStrings.xml" not in z.namelist():
        return []
    tree = ET.fromstring(z.read("xl/sharedStrings.xml"))
    return ["".join(t.text or "" for t in si.findall(".//a:t", ns)) for si in tree.findall("a:si", ns)]

def sheet_paths(z):
    workbook = ET.fromstring(z.read("xl/workbook.xml"))
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    relmap = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels}
    out = []
    for sheet in workbook.find("a:sheets", ns).findall("a:sheet", ns):
        target = relmap[sheet.attrib["{%s}id" % ns["r"]]].lstrip("/")
        if not target.startswith("xl/"):
            target = "xl/" + target
        out.append((sheet.attrib.get("name", "Sheet1"), target))
    return out

def cell_value(cell, strings):
    typ = cell.attrib.get("t", "")
    value = cell.find("a:v", ns)
    inline = cell.find("a:is", ns)
    if value is not None:
        raw = value.text or ""
        if typ == "s":
            return strings[int(raw)] if raw.isdigit() and int(raw) < len(strings) else raw
        if typ == "b":
            return raw == "1"
        try:
            num = float(raw)
            return int(num) if num.is_integer() else num
        except ValueError:
            return raw
    if inline is not None:
        return "".join(t.text or "" for t in inline.findall(".//a:t", ns))
    return None

def cell_parts(item):
    match = re.match(r"([A-Z]+)(\d+)$", str(item["cell"]).upper())
    if not match:
        return (10**9, 10**9, str(item["cell"]))
    col, row = match.groups()
    col_num = 0
    for ch in col:
        col_num = col_num * 26 + ord(ch) - 64
    return (col_num, int(row), str(item["cell"]))

def sort_key(item, order_mode):
    col_num, row_num, cell_ref = cell_parts(item)
    if order_mode == "1A":
        return (row_num, col_num, cell_ref)
    return (col_num, row_num, cell_ref)

def variant(name):
    lower = name.lower()
    if "small vision" in lower:
        return "Small Vision MS/SS"
    if "golden" in lower or "rose gold" in lower or "rose golden" in lower:
        return "Big Vision Golden/Rose Gold"
    return "Big Vision MS/SS"

sources = []
for path in sorted(root.glob("*.xlsx")):
    if path.name.startswith(".~lock."):
        continue
    order_mode = str(order_decisions.get(path.name) or default_order_mode or "A1").upper()
    if order_mode != "1A":
        order_mode = "A1"
    with zipfile.ZipFile(path) as z:
        strings = shared_strings(z)
        sheets = []
        sheets_matrix = []
        all_cells = []
        for sheet_name, sheet_path in sheet_paths(z):
            tree = ET.fromstring(z.read(sheet_path))
            cells = []
            for cell in tree.findall(".//a:c", ns):
                ref = cell.attrib.get("r")
                if not ref:
                    continue
                val = cell_value(cell, strings)
                formula = cell.find("a:f", ns)
                formula_text = formula.text if formula is not None else None
                if val not in (None, "") or formula_text:
                    entry = {"sheet": sheet_name, "cell": ref, "value": val}
                    if formula_text:
                        entry["formula"] = formula_text
                    cells.append(entry)
            cells.sort(key=lambda item: sort_key(item, order_mode))
            matrix = []
            for entry in cells:
                value = entry.get("formula")
                if value:
                    value = "=" + str(value)
                else:
                    value = entry.get("value")
                matrix.append([entry["cell"], "" if value is None else str(value)])
            sheets.append({"name": sheet_name, "non_empty_cell_count": len(cells)})
            sheets_matrix.append(matrix)
            all_cells.extend(cells)
        sources.append({
            "source_file": path.name,
            "variant": variant(path.name),
            "order_mode": order_mode,
            "sheets": sheets,
            "sheets_matrix": sheets_matrix,
            "non_empty_cell_count": len(all_cells),
            "cells": all_cells,
        })
print(json.dumps({"sources": sources, "source_count": len(sources)}, ensure_ascii=False))
`;
  const docsDir = costingWorkbookDir();
  return new Promise((resolve, reject) => {
    execFile("python", ["-c", script, docsDir, normalizedDefaultOrderMode, JSON.stringify(normalizedOrderDecisions)], { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr || error.message));
      try {
        resolve(JSON.parse(stdout || "{}"));
      } catch (parseError) {
        reject(parseError);
      }
    });
  });
}

function filterPortalPayload(payload, access) {
  if (!access.is_restricted) return payload;
  const allowedKeys = new Set(["metrics", "dashboard_overview", "refresh_interval_minutes", "viewer", "access", "department_options", "synced_at"]);
  for (const view of access.allowed_views || []) {
    for (const key of viewDataKeys[view] || []) allowedKeys.add(key);
  }
  for (const key of restrictedPayloadKeys) {
    if (allowedKeys.has(key)) continue;
    payload[key] = Array.isArray(payload[key]) ? [] : {};
  }
  return payload;
}

async function ensureStaffPortalUsers() {
  const orgChart = await readJson(listFiles.org_chart, []);
  const users = await readJson(listFiles.users, []);
  const managers = new Set(orgChart.map((person) => person.reports_to).filter(Boolean));
  let changed = false;
  let created = 0;
  let linked = 0;
  for (const user of users) {
    if (isRetiredGenericServiceManager(user) && user.active !== false) {
      user.active = false;
      user.merged_into = user.merged_into || "jitendra.choudhary";
      user.updated_at = new Date().toISOString();
      changed = true;
    }
  }
  for (const person of orgChart) {
    const baseUsername = slugName(person.name);
    if (!baseUsername) continue;
    const linkedUser = users.find((user) =>
      String(user.linked_org_node || "") === String(person.id || "") ||
      staffLookupKey(user.display_name || user.username) === staffLookupKey(person.name)
    );
    if (linkedUser) {
      const nextRole = portalRoleForStaff(person, managers);
      const nextLinkedOrgNode = linkedUser.linked_org_node || person.id || "";
      const nextDepartment = person.department || linkedUser.department || "";
      const nextDisplayName = person.name || linkedUser.display_name || linkedUser.username;
      if (
        linkedUser.linked_org_node !== nextLinkedOrgNode ||
        linkedUser.department !== nextDepartment ||
        linkedUser.display_name !== nextDisplayName ||
        !linkedUser.role ||
        (nextRole === "ceo" && !["ceo", "admin"].includes(String(linkedUser.role || "").toLowerCase())) ||
        (nextRole === "manager" && !["manager", "ceo", "admin"].includes(String(linkedUser.role || "").toLowerCase())) ||
        linkedUser.active === false
      ) {
        linkedUser.linked_org_node = nextLinkedOrgNode;
        linkedUser.department = nextDepartment;
        linkedUser.display_name = nextDisplayName;
        linkedUser.role = nextRole === "ceo" ? "ceo" : (nextRole === "manager" && !["ceo", "admin"].includes(String(linkedUser.role || "").toLowerCase()) ? "manager" : (linkedUser.role || nextRole));
        linkedUser.active = true;
        linkedUser.updated_at = new Date().toISOString();
        changed = true;
        linked += 1;
      }
      continue;
    }
    let username = baseUsername;
    let suffix = 2;
    while (users.some((user) => String(user.username).toLowerCase() === username)) {
      username = `${baseUsername}.${suffix}`;
      suffix += 1;
    }
    users.push({
      id: nextId(users, "USR"),
      username,
      display_name: person.name,
      role: portalRoleForStaff(person, managers),
      department: person.department || "",
      linked_org_node: person.id || "",
      active: true,
      must_change_password: false,
      password_hash: sharedStaffPortalPasswordHash(),
      created_at: new Date().toISOString()
    });
    changed = true;
    created += 1;
  }
  if (changed) await writeJson(listFiles.users, users);
  users.sync_summary = { created, linked };
  return users;
}

function verifyWerkzeugPassword(storedHash = "", password = "") {
  const [method, salt, expectedHex] = String(storedHash).split("$");
  if (!method || !salt || !expectedHex) return false;
  if (method.startsWith("scrypt:")) {
    const [, nText, rText, pText] = method.split(":");
    const N = Number(nText);
    const r = Number(rText);
    const p = Number(pText);
    const keyLength = Buffer.from(expectedHex, "hex").length;
    const derived = crypto.scryptSync(password, salt, keyLength, { N, r, p, maxmem: 128 * N * r * 2 });
    return crypto.timingSafeEqual(derived, Buffer.from(expectedHex, "hex"));
  }
  return false;
}

async function ensureSharedStaffPortalPassword() {
  const users = await ensureStaffPortalUsers();
  const sharedPasswordHash = sharedStaffPortalPasswordHash();
  let changed = false;
  for (const user of users) {
    if (!String(user.password_hash || "")) {
      user.password_hash = sharedPasswordHash;
      user.must_change_password = false;
      user.password_policy = "shared-staff-portal";
      user.password_synced_at = new Date().toISOString();
      changed = true;
    } else if (user.must_change_password) {
      user.must_change_password = false;
      user.password_synced_at = new Date().toISOString();
      changed = true;
    }
  }
  if (changed) {
    await writeJson(listFiles.users, users);
    for (const [token, session] of tokens.entries()) {
      const nextUser = users.find((user) => String(user.id) === String(session.user?.id));
      if (nextUser) tokens.set(token, { ...session, user: nextUser });
    }
  }
  return users;
}

function loginAttemptKey(req, username) {
  return `${req.ip || req.socket?.remoteAddress || "unknown"}:${username}`;
}

function loginAttemptState(req, username) {
  const key = loginAttemptKey(req, username);
  const now = Date.now();
  const state = loginAttempts.get(key);
  if (!state || state.resetAt <= now) {
    const next = { count: 0, resetAt: now + loginWindowMs };
    loginAttempts.set(key, next);
    return { key, state: next };
  }
  return { key, state };
}

function recordFailedLogin(req, username) {
  const { state } = loginAttemptState(req, username);
  state.count += 1;
}

function clearLoginAttempts(req, username) {
  loginAttempts.delete(loginAttemptKey(req, username));
}

function authRequired(req, res, next) {
  const header = req.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : String(req.query?.token || "");
  const session = tokens.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (token) tokens.delete(token);
    return res.status(401).json({ ok: false, message: "Authentication required." });
  }
  session.expiresAt = Date.now() + tokenTtlMs;
  req.user = session.user;
  req.token = token;
  next();
}

function nextId(records, prefix) {
  const max = records.reduce((highest, record) => {
    const raw = String(record.id || "");
    const value = Number(raw.split("-")[1]);
    return Number.isFinite(value) ? Math.max(highest, value) : highest;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

function randomFourDigitCustomerId(records) {
  const used = new Set();
  for (const record of records) {
    const id = String(record.id || "").trim();
    const customerId = String(record.customer_id || "").trim();
    if (/^\d{4}$/.test(id)) used.add(id);
    if (/^\d{4}$/.test(customerId)) used.add(customerId);
  }
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = String(crypto.randomInt(1000, 10000));
    if (!used.has(candidate)) return candidate;
  }
  for (let value = 1000; value <= 9999; value += 1) {
    const candidate = String(value);
    if (!used.has(candidate)) return candidate;
  }
  throw new Error("All 4-digit customer IDs are already in use.");
}

function replaceCustomerIds(value, idMap) {
  if (typeof value === "string") return idMap.get(value) || value;
  if (Array.isArray(value)) return value.map((item) => replaceCustomerIds(item, idMap));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceCustomerIds(item, idMap)]));
  }
  return value;
}

function crmNameKey(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

async function ensureFourDigitCustomerIds() {
  const customers = await readJson(listFiles.customers, []);
  if (!Array.isArray(customers) || !customers.length) return new Map();
  const usedIds = new Set(customers.map((customer) => String(customer.id || "").trim()).filter((id) => /^\d{4}$/.test(id)));
  const idMap = new Map();
  const nextCustomers = customers.map((customer) => {
    const currentId = String(customer.id || "").trim();
    if (/^\d{4}$/.test(currentId)) return customer;
    let nextId = "";
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const candidate = String(crypto.randomInt(1000, 10000));
      if (!usedIds.has(candidate)) {
        nextId = candidate;
        break;
      }
    }
    if (!nextId) {
      for (let value = 1000; value <= 9999; value += 1) {
        const candidate = String(value);
        if (!usedIds.has(candidate)) {
          nextId = candidate;
          break;
        }
      }
    }
    if (!nextId) throw new Error("All 4-digit customer IDs are already in use.");
    usedIds.add(nextId);
    if (currentId) idMap.set(currentId, nextId);
    return { ...customer, id: nextId, updated_at: new Date().toISOString() };
  });
  if (!idMap.size) return idMap;
  await writeJson(listFiles.customers, nextCustomers);
  for (const fileName of Object.values(listFiles).filter((fileName) => fileName !== listFiles.customers)) {
    const payload = await readJson(fileName, []);
    await writeJson(fileName, replaceCustomerIds(payload, idMap));
  }
  const operationsState = await readJson("operations_state.json", {});
  await writeJson("operations_state.json", replaceCustomerIds(operationsState, idMap));
  return idMap;
}

async function ensureSalesInquiryCustomerIds() {
  const records = await readJson(listFiles.sales_inquiries, []);
  if (!Array.isArray(records) || !records.length) return;
  const customers = await readJson(listFiles.customers, []);
  let changed = false;
  const nextRecords = records.map((record) => {
    const currentId = String(record.customer_id || "").trim();
    if (/^\d{4}$/.test(currentId)) return record;
    changed = true;
    return {
      ...record,
      customer_id: randomFourDigitCustomerId([...customers, ...records]),
      updated_at: record.updated_at || new Date().toISOString(),
    };
  });
  if (changed) await writeJson(listFiles.sales_inquiries, nextRecords);
}

async function ensureOfferInquiryLinks() {
  const inquiries = await readJson(listFiles.sales_inquiries, []);
  const estimates = await readJson(listFiles.estimates, []);
  if (!Array.isArray(inquiries) || !Array.isArray(estimates) || !inquiries.length || !estimates.length) return;
  const inquiryById = new Map();
  const inquiriesByName = new Map();
  for (const inquiry of inquiries) {
    const identity = String(inquiry.id || inquiry.enquiry_no || inquiry.source_enquiry_no || "").trim();
    if (identity) inquiryById.set(identity, inquiry);
    const nameKey = crmNameKey(inquiry.customer || inquiry.lead_name || inquiry.name);
    if (nameKey) {
      if (!inquiriesByName.has(nameKey)) inquiriesByName.set(nameKey, []);
      inquiriesByName.get(nameKey).push(inquiry);
    }
  }
  let changed = false;
  const nextEstimates = estimates.map((estimate) => {
    let inquiry = null;
    const currentInquiryId = String(estimate.source_inquiry_id || estimate.enquiry_no || estimate.source_enquiry_no || "").trim();
    if (currentInquiryId) inquiry = inquiryById.get(currentInquiryId) || null;
    if (!inquiry) {
      const nameKey = crmNameKey(estimate.customer_name || estimate.offer_name || estimate.customer);
      const matches = nameKey ? inquiriesByName.get(nameKey) || [] : [];
      inquiry = matches[0] || null;
    }
    if (!inquiry) return estimate;
    const sourceInquiryId = String(inquiry.id || inquiry.enquiry_no || inquiry.source_enquiry_no || "").trim();
    const customerId = String(inquiry.customer_id || "").trim();
    if (estimate.source_inquiry_id === sourceInquiryId && estimate.customer_id === customerId) return estimate;
    changed = true;
    return {
      ...estimate,
      source_inquiry_id: sourceInquiryId,
      source_enquiry_no: inquiry.enquiry_no || inquiry.source_enquiry_no || estimate.source_enquiry_no || "",
      customer_id: customerId || estimate.customer_id || "",
      updated_at: estimate.updated_at || new Date().toISOString(),
    };
  });
  if (changed) await writeJson(listFiles.estimates, nextEstimates);
}

function resolvedSiteVisitCrmLink(body, customers, inquiries) {
  const customerId = String(body?.customer_id || "").trim();
  if (!customerId) return null;
  const customer = customers.find((item) => String(item.id || "") === customerId);
  const inquiry = !customer ? inquiries.find((item) =>
    String(item.customer_id || "") === customerId ||
    String(item.id || "") === customerId ||
    String(item.enquiry_no || item.source_enquiry_no || "") === customerId
  ) : null;
  const record = customer || inquiry;
  if (!record) return null;
  const resolvedCustomerId = String(record.customer_id || record.id || customerId).trim();
  return {
    customer_id: resolvedCustomerId,
    customer_name: String(record.name || record.customer || record.lead_name || record.contact_name || resolvedCustomerId).trim(),
    address: String(record.address || record.site_address || record.site || "").trim(),
    site_person_name: String(body?.site_person_name || record.contact_person || record.customer || record.lead_name || record.name || "").trim(),
    site_person_mobile: String(body?.site_person_mobile || record.phone || record.whatsapp_no || "").trim(),
    site_enquiry_no: String(body?.site_enquiry_no || record.enquiry_no || record.source_enquiry_no || "").trim()
  };
}

async function ensureSiteVisitCustomerLinks() {
  const [siteVisits, customers, inquiries] = await Promise.all([
    readJson(listFiles.site_visits, []),
    readJson(listFiles.customers, []),
    readJson(listFiles.sales_inquiries, [])
  ]);
  let changed = false;
  const nextVisits = siteVisits.map((visit) => {
    const link = resolvedSiteVisitCrmLink(visit, customers, inquiries);
    if (!link) return visit;
    const nextVisit = {
      ...visit,
      customer_id: link.customer_id,
      customer_name: link.customer_name,
      address: link.address || visit.address || "",
      site_person_name: visit.site_person_name || link.site_person_name,
      site_person_mobile: visit.site_person_mobile || link.site_person_mobile,
      site_enquiry_no: visit.site_enquiry_no || link.site_enquiry_no
    };
    if (JSON.stringify(nextVisit) !== JSON.stringify(visit)) changed = true;
    return nextVisit;
  });
  if (changed) await writeJson(listFiles.site_visits, nextVisits);
}

function resolveCollection(routeName) {
  const config = routeCollections[routeName] || (listFiles[routeName] ? { key: routeName, prefix: routeName.toUpperCase() } : null);
  if (!config || !listFiles[config.key]) return null;
  return { ...config, file: listFiles[config.key] };
}

function cleanPayload(body = {}) {
  const cleaned = {};
  for (const [key, value] of Object.entries(body)) {
    if (key === "id" || key === "created_at" || key === "updated_at") continue;
    cleaned[key] = typeof value === "string" ? value.trim() : value;
  }
  return cleaned;
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function moneyInr(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function paymentNumber(value, fallback = 0) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function paymentAddDays(dateValue, daysValue) {
  const base = new Date(String(dateValue || new Date().toISOString().slice(0, 10)));
  if (Number.isNaN(base.getTime())) return "";
  base.setDate(base.getDate() + Math.max(0, paymentNumber(daysValue)));
  return base.toISOString().slice(0, 10);
}

function normalizePaymentPayload(body = {}) {
  const cleaned = cleanPayload(body);
  const contractBasic = paymentNumber(cleaned.contract_basic_value ?? cleaned.basic_contract_value ?? cleaned.contract_value ?? cleaned.amount);
  const basicCheck = paymentNumber(cleaned.basic_check_value ?? cleaned.check_basic_value ?? cleaned.check_value);
  const basicCash = paymentNumber(cleaned.basic_cash_value ?? cleaned.cash_basic_value ?? cleaned.cash_value);
  const basicCard = paymentNumber(cleaned.basic_card_value ?? cleaned.card_basic_value ?? cleaned.credit_card_value);
  const gstPercent = paymentNumber(cleaned.gst_percent, 18);
  const cardChargePercent = paymentNumber(cleaned.credit_card_charge_percent ?? cleaned.card_charge_percent, 2);
  const checkGst = Number(((basicCheck * gstPercent) / 100).toFixed(2));
  const cardCharge = Number(((basicCard * cardChargePercent) / 100).toFixed(2));
  const finalContract = Number((basicCheck + checkGst + basicCash + basicCard + cardCharge).toFixed(2));
  const receivedCheck = paymentNumber(cleaned.amount_received_check ?? cleaned.received_check ?? 0);
  const receivedCash = paymentNumber(cleaned.amount_received_cash ?? cleaned.received_cash ?? 0);
  const receivedCard = paymentNumber(cleaned.amount_received_card ?? cleaned.received_card ?? 0);
  const receivedTotal = Number((receivedCheck + receivedCash + receivedCard).toFixed(2));
  const outstandingCheck = Number(Math.max(0, basicCheck + checkGst - receivedCheck).toFixed(2));
  const outstandingCash = Number(Math.max(0, basicCash - receivedCash).toFixed(2));
  const outstandingCard = Number(Math.max(0, basicCard + cardCharge - receivedCard).toFixed(2));
  const outstandingTotal = Number(Math.max(0, finalContract - receivedTotal).toFixed(2));
  const splitMatches = Math.abs(contractBasic - (basicCheck + basicCash + basicCard)) < 0.01;
  const reminderIntervalDays = paymentNumber(cleaned.reminder_interval_days, 7);
  const outstandingDate = String(cleaned.outstanding_date || cleaned.due_date || "").slice(0, 10);
  const nextReminderDate = String(cleaned.next_reminder_date || paymentAddDays(outstandingDate, reminderIntervalDays)).slice(0, 10);
  const chequeNumber = String(cleaned.cheque_number || cleaned.check_number || "").trim();
  return {
    ...cleaned,
    payment_type: String(cleaned.payment_type || "Contract").trim(),
    cheque_number: chequeNumber,
    check_number: chequeNumber,
    contract_basic_value: contractBasic,
    basic_check_value: basicCheck,
    basic_cash_value: basicCash,
    basic_card_value: basicCard,
    gst_percent: gstPercent,
    credit_card_charge_percent: cardChargePercent,
    check_gst_value: checkGst,
    credit_card_charge_value: cardCharge,
    card_charge_paid_by: "Client",
    final_contract_value: finalContract,
    amount: finalContract,
    amount_received_check: receivedCheck,
    amount_received_cash: receivedCash,
    amount_received_card: receivedCard,
    amount_received_total: receivedTotal,
    outstanding_check: outstandingCheck,
    outstanding_cash: outstandingCash,
    outstanding_card: outstandingCard,
    outstanding_total: outstandingTotal,
    split_matches_contract: splitMatches,
    reminder_interval_days: reminderIntervalDays,
    next_reminder_date: nextReminderDate,
    status: cleaned.status || (outstandingTotal > 0 ? "Outstanding" : "Paid")
  };
}

function numberValue(value, fallback = 0) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function addDaysIso(dateValue, days) {
  const date = new Date(String(dateValue || ""));
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + Math.max(0, Number(days || 0)));
  return date.toISOString().slice(0, 10);
}

function tenderDateDiffDays(dateValue, now = new Date()) {
  const date = new Date(String(dateValue || ""));
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86400000));
}

function normalizeTenderArray(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

function normalizeTenderPayload(body = {}, existing = {}, records = []) {
  const now = new Date();
  const nowIso = now.toISOString();
  const cleaned = cleanPayload(body);
  const items = normalizeTenderArray(cleaned.items || existing.items);
  const participants = normalizeTenderArray(cleaned.participants || existing.participants);
  const bills = normalizeTenderArray(cleaned.bills || existing.bills).map((bill, index) => {
    const amount = numberValue(bill.amount);
    const received = String(bill.payment_received || bill.received || "").toLowerCase() === "yes" || bill.payment_received === true;
    const billDate = String(bill.bill_date || "").slice(0, 10);
    return {
      id: String(bill.id || `BILL-${index + 1}`),
      our_bill_number: String(bill.our_bill_number || bill.bill_number || "").trim(),
      bill_date: billDate,
      amount,
      billing_period: String(bill.billing_period || "").trim(),
      payment_received: received ? "Yes" : "No",
      payment_received_date: received ? String(bill.payment_received_date || "").slice(0, 10) : "",
      due_days: received ? 0 : tenderDateDiffDays(billDate, now)
    };
  });
  const emdRecords = normalizeTenderArray(cleaned.emd_records || existing.emd_records);
  const sdRecords = normalizeTenderArray(cleaned.sd_records || existing.sd_records).map((sd, index) => ({
    id: String(sd.id || `SD-${index + 1}`),
    sd_amount: numberValue(sd.sd_amount || sd.amount),
    deposited_by: String(sd.deposited_by || "").trim(),
    deposit_date: String(sd.deposit_date || "").slice(0, 10),
    amount: numberValue(sd.amount || sd.sd_amount),
    refund_due_date: String(sd.refund_due_date || "").slice(0, 10) || addDaysIso(cleaned.completion_date || existing.completion_date, numberValue(cleaned.dlp_period || existing.dlp_period)),
    status: String(sd.status || "").trim() || "SD Pending"
  }));
  const totalBillAmount = bills.reduce((sum, bill) => sum + numberValue(bill.amount), 0);
  const totalPaymentReceived = bills.filter((bill) => bill.payment_received === "Yes").reduce((sum, bill) => sum + numberValue(bill.amount), 0);
  const totalPaymentDue = Math.max(0, totalBillAmount - totalPaymentReceived);
  const dueDays = bills.filter((bill) => bill.payment_received !== "Yes").reduce((max, bill) => Math.max(max, numberValue(bill.due_days)), 0);
  const dlpPeriod = numberValue(cleaned.dlp_period || existing.dlp_period);
  const completionDate = String(cleaned.completion_date || existing.completion_date || "").slice(0, 10);
  const orderValue = numberValue(cleaned.order_value || existing.order_value);
  const hasSubmission = Boolean(cleaned.submission_date || existing.submission_date || cleaned.submitted_at || existing.submitted_at);
  const hasOpening = participants.length > 0 || Boolean(cleaned.opening_date || existing.opening_date || cleaned.lowest_party_name || existing.lowest_party_name);
  const statusInput = String(cleaned.status || existing.status || "").trim();
  let status = statusInput || "Tender Pending";
  const lowerStatus = status.toLowerCase();
  const defaultPendingStatus = !statusInput || lowerStatus === "tender pending";
  if (defaultPendingStatus && hasSubmission) status = "Tender Submitted";
  if (defaultPendingStatus && hasOpening) status = "Tender Opened";
  if ((defaultPendingStatus || status.toLowerCase() === "tender opened") && (cleaned.order_number || existing.order_number || orderValue > 0)) status = "Order Pending";
  if (lowerStatus.includes("lost")) status = emdRecords.some((record) => String(record.return_status || record.status || "").toLowerCase().includes("return")) ? "EMD Returned" : "EMD Pending";
  if (lowerStatus.includes("won") || lowerStatus.includes("order pending")) status = "Order Pending";
  const start = new Date(String(cleaned.stipulated_work_start_date || existing.stipulated_work_start_date || ""));
  const finish = new Date(String(completionDate || ""));
  if (!Number.isNaN(start.getTime()) && !Number.isNaN(finish.getTime()) && now >= start && now <= finish) status = "Work In Progress";
  if (completionDate && now > finish && !Number.isNaN(finish.getTime())) status = "Completed";
  const nextJobNumber = `TDR-${String(records.length + 1).padStart(4, "0")}`;
  return {
    ...existing,
    ...cleaned,
    title: String(cleaned.title || cleaned.party_name || cleaned.tender_invited_by || existing.title || "").trim(),
    job_number: String(cleaned.job_number || existing.job_number || nextJobNumber).trim(),
    file_number: String(cleaned.file_number || existing.file_number || "").trim(),
    party_name: String(cleaned.party_name || cleaned.tender_invited_by || existing.party_name || "").trim(),
    tender_invited_by: String(cleaned.tender_invited_by || cleaned.party_name || existing.tender_invited_by || "").trim(),
    product_type: String(cleaned.product_type || existing.product_type || "Lift").trim(),
    status,
    dlp_period: dlpPeriod,
    items,
    participants,
    bills,
    emd_records: emdRecords,
    sd_records: sdRecords,
    total_bill_amount: totalBillAmount,
    total_payment_received: totalPaymentReceived,
    total_payment_due: totalPaymentDue,
    payment_due_days: dueDays,
    sd_refund_due_date: completionDate ? addDaysIso(completionDate, dlpPeriod) : "",
    updated_at: nowIso
  };
}

const mandatoryInstallationTests = [
  "Floor to Floor Level",
  "Overload Test",
  "ARD Test",
  "Locking System Test",
  "Overspeed Test",
  "Door Sensor Test"
];

function normalizeInstallationTests(value, existing = []) {
  const incoming = Array.isArray(value) ? value : [];
  const byName = new Map([...existing, ...incoming].map((item) => [String(item.name || item.test_name || "").trim().toLowerCase(), item]));
  const mandatory = mandatoryInstallationTests.map((name) => ({
    name,
    result: String(byName.get(name.toLowerCase())?.result || "Pending"),
    date: String(byName.get(name.toLowerCase())?.date || ""),
    tested_by: String(byName.get(name.toLowerCase())?.tested_by || ""),
    remarks: String(byName.get(name.toLowerCase())?.remarks || "")
  }));
  const custom = Array.from({ length: 10 }, (_, index) => {
    const name = `Test ${index + 1}`;
    const saved = byName.get(name.toLowerCase()) || {};
    return {
      name: String(saved.name || name),
      result: String(saved.result || "Pending"),
      date: String(saved.date || ""),
      tested_by: String(saved.tested_by || ""),
      remarks: String(saved.remarks || "")
    };
  });
  return [...mandatory, ...custom];
}

function normalizeInstallationPayload(body = {}, existing = {}, records = []) {
  const cleaned = cleanPayload(body);
  const now = new Date().toISOString();
  const statusInput = String(cleaned.status || existing.status || "Site Visit Pending").trim();
  const approvedBy = String(cleaned.approved_by || existing.approved_by || "").trim();
  const approvalDate = String(cleaned.approval_date || existing.approval_date || "").trim();
  const approvalStatus = approvedBy && approvalDate ? "Approved" : String(cleaned.approval_status || existing.approval_status || "Pending");
  const blockedUnderInstallation = statusInput === "Under Installation" && approvalStatus !== "Approved";
  const contractorPayments = normalizeTenderArray(cleaned.contractor_payments || existing.contractor_payments).map((payment, index) => ({
    id: String(payment.id || `CPAY-${index + 1}`),
    date: String(payment.date || "").slice(0, 10),
    amount: numberValue(payment.amount),
    method: String(payment.method || "").trim(),
    remarks: String(payment.remarks || "").trim()
  }));
  const contractValue = numberValue(cleaned.contract_value || existing.contract_value);
  const totalPaid = contractorPayments.reduce((sum, payment) => sum + numberValue(payment.amount), 0);
  const warrantyStart = String(cleaned.warranty_start_date || existing.warranty_start_date || "").slice(0, 10);
  const warrantyMonths = numberValue(cleaned.warranty_months || existing.warranty_months, 12);
  const warrantyEnd = String(cleaned.warranty_end_date || existing.warranty_end_date || "").slice(0, 10) || (warrantyStart ? addDaysIso(warrantyStart, warrantyMonths * 30) : "");
  const panniRemoved = String(cleaned.panni_removed || existing.panni_removed || "No").trim();
  const panniRemovalDate = panniRemoved.toLowerCase() === "yes" ? String(cleaned.panni_removal_date || existing.panni_removal_date || now.slice(0, 10)).slice(0, 10) : "";
  return {
    ...existing,
    ...cleaned,
    job_id: String(cleaned.job_id || existing.job_id || `INST-${String(records.length + 1).padStart(4, "0")}`).trim(),
    customer_id: String(cleaned.customer_id || existing.customer_id || "").trim(),
    customer: String(cleaned.customer || existing.customer || "").trim(),
    company_name: String(cleaned.company_name || existing.company_name || cleaned.customer || existing.customer || "").trim(),
    contact_person: String(cleaned.contact_person || existing.contact_person || "").trim(),
    mobile: String(cleaned.mobile || existing.mobile || cleaned.customer_phone || existing.customer_phone || "").trim(),
    whatsapp: String(cleaned.whatsapp || existing.whatsapp || cleaned.mobile || existing.mobile || "").trim(),
    email: String(cleaned.email || existing.email || "").trim(),
    site_address: String(cleaned.site_address || existing.site_address || cleaned.site || existing.site || cleaned.customer_address || existing.customer_address || "").trim(),
    billing_address: String(cleaned.billing_address || existing.billing_address || cleaned.site_address || existing.site_address || "").trim(),
    status: blockedUnderInstallation ? "Installation Assigned" : statusInput,
    approval_status: blockedUnderInstallation ? "Pending" : approvalStatus,
    approval_required: blockedUnderInstallation,
    approved_by: approvedBy,
    approval_date: approvalDate,
    technical_details: {
      motor_sticker_photo: String(cleaned.motor_sticker_photo || existing.technical_details?.motor_sticker_photo || ""),
      motor_make: String(cleaned.motor_make || existing.technical_details?.motor_make || ""),
      motor_model_number: String(cleaned.motor_model_number || existing.technical_details?.motor_model_number || ""),
      door_make: String(cleaned.door_make || existing.technical_details?.door_make || ""),
      controller_make: String(cleaned.controller_make || existing.technical_details?.controller_make || ""),
      controller_type: String(cleaned.controller_type || existing.technical_details?.controller_type || "Closed Loop"),
      controller_communication: String(cleaned.controller_communication || existing.technical_details?.controller_communication || "Full Serial"),
      protocol: String(cleaned.protocol || existing.technical_details?.protocol || "Protocol"),
      controller_username: String(cleaned.controller_username || existing.technical_details?.controller_username || ""),
      controller_password: String(cleaned.controller_password || existing.technical_details?.controller_password || ""),
      drive_model_number: String(cleaned.drive_model_number || existing.technical_details?.drive_model_number || ""),
      ard_or_ups: String(cleaned.ard_or_ups || existing.technical_details?.ard_or_ups || ""),
      ard_make: String(cleaned.ard_make || existing.technical_details?.ard_make || ""),
      battery_size: String(cleaned.battery_size || existing.technical_details?.battery_size || ""),
      battery_make: String(cleaned.battery_make || existing.technical_details?.battery_make || ""),
      battery_quantity: String(cleaned.battery_quantity || existing.technical_details?.battery_quantity || ""),
      battery_warranty_expiry: String(cleaned.battery_warranty_expiry || existing.technical_details?.battery_warranty_expiry || ""),
      door_sensor_make: String(cleaned.door_sensor_make || existing.technical_details?.door_sensor_make || ""),
      lop_make: String(cleaned.lop_make || existing.technical_details?.lop_make || ""),
      cop_make: String(cleaned.cop_make || existing.technical_details?.cop_make || ""),
      button_type: String(cleaned.button_type || existing.technical_details?.button_type || "Push Button")
    },
    uploads: {
      building_photo: String(cleaned.building_photo || existing.uploads?.building_photo || ""),
      motor_sticker_photo: String(cleaned.motor_sticker_photo || existing.uploads?.motor_sticker_photo || ""),
      site_photos: normalizeTenderArray(cleaned.site_photos || existing.uploads?.site_photos),
      lift_videos: normalizeTenderArray(cleaned.lift_videos || existing.uploads?.lift_videos)
    },
    site_readiness: {
      lift_well_construction: String(cleaned.lift_well_construction || existing.site_readiness?.lift_well_construction || "Complete"),
      expected_completion_date: String(cleaned.expected_completion_date || existing.site_readiness?.expected_completion_date || "").slice(0, 10),
      notes: String(cleaned.site_readiness_notes || existing.site_readiness?.notes || "")
    },
    checklist: normalizeInstallationTests(cleaned.checklist, existing.checklist),
    panni_removed: panniRemoved,
    panni_removal_date: panniRemovalDate,
    next_panni_reminder_date: panniRemoved.toLowerCase() === "yes" ? "" : addDaysIso(existing.next_panni_reminder_date || now.slice(0, 10), 15),
    granite_required: String(cleaned.granite_required || existing.granite_required || "No"),
    granite_status: String(cleaned.granite_status || existing.granite_status || "Pending"),
    contractor_payments: contractorPayments,
    total_paid: totalPaid,
    total_due: Math.max(0, contractValue - totalPaid),
    outstanding_balance: Math.max(0, contractValue - totalPaid),
    warranty_start_date: warrantyStart,
    warranty_end_date: warrantyEnd,
    updated_at: now
  };
}

function installationNotificationEvents(record = {}, previous = {}) {
  const events = [];
  const status = String(record.status || "").trim();
  const previousStatus = String(previous.status || "").trim();
  const customer = String(record.customer || record.company_name || "Customer").trim();
  const siteReady = String(record.site_readiness?.lift_well_construction || "").toLowerCase();
  const previousSiteReady = String(previous.site_readiness?.lift_well_construction || "").toLowerCase();
  const warrantyStart = String(record.warranty_start_date || "").trim();
  const warrantyEnd = String(record.warranty_end_date || "").trim();
  if (!previous.id && (status || record.assigned_team || record.contractor || record.engineer)) {
    events.push({
      event_type: "installation-assigned",
      subject: `Installation assigned: ${customer}`,
      message: `Installation has been assigned for ${customer}. Team: ${record.assigned_team || "-"}, contractor: ${record.contractor || record.contractor_name || "-"}, engineer: ${record.engineer || "-"}.`
    });
  }
  if (siteReady.includes("progress") && siteReady !== previousSiteReady) {
    events.push({
      event_type: "installation-site-not-ready",
      subject: `Site not ready: ${customer}`,
      message: "Lift installation cannot proceed because site construction is still under progress. Please complete remaining work before the expected completion date."
    });
  }
  if (status && status !== previousStatus) {
    const statusMessages = {
      "Under Installation": "Installation work has started.",
      Commissioning: "Commissioning has started.",
      "Handover Pending": "Installation is ready for customer handover.",
      Completed: "Installation handover has been completed.",
      Closed: "Installation record has been closed.",
      "Material Ready": "Installation material is ready.",
      "Site Ready": "Site has been marked ready for installation."
    };
    if (statusMessages[status]) {
      events.push({
        event_type: `installation-${status.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
        subject: `${status}: ${customer}`,
        message: `${statusMessages[status]} Customer: ${customer}. Lift: ${record.lift_reference || record.unit || "-"}.`
      });
    }
  }
  if (warrantyStart && warrantyStart !== String(previous.warranty_start_date || "").trim()) {
    events.push({
      event_type: "installation-warranty-activated",
      subject: `Warranty activated: ${customer}`,
      message: `Warranty has been activated for ${customer}. Warranty end date: ${warrantyEnd || "-"}.`
    });
  }
  if (String(record.panni_removed || "No").toLowerCase() !== "yes" && !previous.id) {
    events.push({
      event_type: "installation-panni-reminder-scheduled",
      subject: `Panni reminder scheduled: ${customer}`,
      message: "Protection sheet (Panni) has not yet been removed from the lift. Kindly arrange removal."
    });
  }
  return events;
}

async function logInstallationNotifications(record = {}, previous = {}, actor = {}) {
  const events = installationNotificationEvents(record, previous);
  if (!events.length) return [];
  const now = new Date().toISOString();
  const deptComms = await readJson(listFiles.dept_comms, []);
  const created = events.map((event, index) => ({
    id: nextId([...deptComms, ...events.slice(0, index).map((_, eventIndex) => ({ id: `MSG-${String(deptComms.length + eventIndex + 1).padStart(3, "0")}` }))], "MSG"),
    department: "Installation",
    channel: "whatsapp",
    notification_type: event.event_type,
    subject: event.subject,
    message: event.message,
    status: "Queued",
    read: false,
    customer_id: String(record.customer_id || ""),
    customer: String(record.customer || record.company_name || ""),
    phone: String(record.whatsapp || record.mobile || record.customer_phone || ""),
    installation_ref: String(record.id || record.job_id || ""),
    job_id: String(record.job_id || record.id || ""),
    created_by: actor?.display_name || actor?.username || "System",
    created_at: now
  }));
  deptComms.unshift(...created);
  await writeJson(listFiles.dept_comms, deptComms);
  for (const item of created) {
    const delivery = await communicationService.sendBusinessChannelUpdate(item.notification_type, {
      agent: "Field Installation Manager",
      channel: "whatsapp",
      target: item.phone,
      customer_id: item.customer_id,
      job_id: item.job_id,
      subject: item.subject,
      message: item.message,
      summary: item.message
    }).catch((error) => ({ ok: false, error: error?.message || String(error) }));
    item.delivery_status = delivery.ok ? "Sent" : "Logged";
    item.delivery_error = delivery.ok ? "" : String(delivery.error || delivery.status || "");
  }
  await writeJson(listFiles.dept_comms, deptComms);
  return created;
}

function installationReportRows(records = []) {
  return records.map((record) => ({
    installation_id: record.job_id || record.id || "",
    customer_id: record.customer_id || "",
    customer: record.customer || record.company_name || "",
    project: record.project_name || "",
    lift: record.lift_reference || record.unit || "",
    status: record.status || "",
    team: record.assigned_team || "",
    engineer: record.engineer || "",
    contractor: record.contractor || record.contractor_name || "",
    start_date: record.start_date || "",
    completion_date: record.completion_date || "",
    handover_date: record.handed_over_date || record.handover_date || "",
    warranty_start_date: record.warranty_start_date || "",
    warranty_end_date: record.warranty_end_date || "",
    contract_value: record.contract_value || 0,
    total_paid: record.total_paid || 0,
    outstanding_balance: record.outstanding_balance || record.total_due || 0,
    panni_removed: record.panni_removed || "",
    granite_required: record.granite_required || "",
    site_readiness: record.site_readiness?.lift_well_construction || "",
    updated_at: record.updated_at || record.created_at || ""
  }));
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function rowsToCsv(rows = []) {
  const headers = Object.keys(rows[0] || {});
  if (!headers.length) return "";
  return [headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\r\n");
}

function parseCsvRows(text = "") {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const source = String(text || "").replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (inQuotes) {
      if (char === "\"" && next === "\"") {
        field += "\"";
        index += 1;
      } else if (char === "\"") {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === "\"") {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  row.push(field);
  if (row.some((value) => String(value || "").trim())) rows.push(row);
  const headers = (rows.shift() || []).map((header) => String(header || "").trim());
  return rows
    .filter((values) => values.some((value) => String(value || "").trim()))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, String(values[index] ?? "").trim()])));
}

function phoneDigits(value = "") {
  return String(value || "").replace(/\D/g, "").slice(-10);
}

function salesInquiryCustomerPayload(inquiry = {}, actor = {}) {
  return {
    id: String(inquiry.customer_id || "").trim(),
    name: String(inquiry.customer || inquiry.lead_name || "").trim(),
    contact_person: String(inquiry.contact_person || inquiry.customer || "").trim(),
    phone: String(inquiry.phone || inquiry.whatsapp_no || "").trim(),
    email: String(inquiry.email || "").trim(),
    address: String(inquiry.address || inquiry.site_address || inquiry.site || "").trim(),
    segment: String(inquiry.lead_type || inquiry.segment || "Lead").trim(),
    status: "Active",
    pipeline_stage: String(inquiry.lead_status || inquiry.status || "Lead").trim(),
    lead_source: String(inquiry.referral_by || inquiry.lead_source || "").trim(),
    account_owner: String(inquiry.assigned_to || inquiry.createdbyname || actor.display_name || actor.username || "").trim(),
    next_follow_up: String(inquiry.next_followup || "").slice(0, 10),
    preferred_channel: String(inquiry.followup_channel || "WhatsApp").trim(),
    notes: String(inquiry.enquiry_remark || inquiry.notes || "").trim(),
    source_inquiry_id: String(inquiry.id || inquiry.enquiry_no || "").trim(),
    source_enquiry_no: String(inquiry.enquiry_no || inquiry.source_enquiry_no || "").trim()
  };
}

function yesNo(value) {
  const text = String(value || "").trim().toLowerCase();
  if (["y", "yes", "true", "1"].includes(text)) return "Y";
  if (["n", "no", "false", "0"].includes(text)) return "N";
  return String(value || "").trim();
}

function csvRowImportType(row = {}) {
  const keys = new Set(Object.keys(row));
  if (keys.has("service_number") || keys.has("service_slot_in_year")) return "service_history";
  if (keys.has("pit_size_mm") || keys.has("site_visit_date")) return "site_visits";
  if (keys.has("enquiry_no") || keys.has("lead_name")) return "sales_inquiries";
  return "customers";
}

function customerFromCsvRow(row = {}, existing = {}, now = new Date().toISOString()) {
  const id = String(row.fuzi_customer_id || row.id || existing.id || "").trim();
  return cleanPayload({
    ...existing,
    external_customer_ref: row.external_customer_ref || existing.external_customer_ref || "",
    ...(id ? { id } : {}),
    name: row.name || row.customer || row.customer_name || row.lead_name || existing.name || "",
    contact_person: row.contact_person || existing.contact_person || "",
    phone: row.phone || row.whatsapp_no || existing.phone || "",
    email: row.email || existing.email || "",
    address: row.address || row.site_address || row.site || existing.address || "",
    segment: row.segment || row.lead_type || existing.segment || "Residential",
    pipeline_stage: row.pipeline_stage || row.lead_status || row.status || existing.pipeline_stage || "Lead",
    status: row.status || existing.status || "Active",
    lead_source: row.lead_source || row.referral_by || existing.lead_source || "",
    account_owner: row.account_owner || row.assigned_to || existing.account_owner || "",
    next_follow_up: row.next_follow_up || row.next_followup || existing.next_follow_up || "",
    preferred_channel: row.preferred_channel || row.followup_channel || existing.preferred_channel || "",
    date_of_birth: row.date_of_birth || existing.date_of_birth || "",
    anniversary_date: row.anniversary_date || existing.anniversary_date || "",
    gstin: row.gstin || existing.gstin || "",
    pan: row.pan || existing.pan || "",
    state: row.state || existing.state || "",
    place_of_supply: row.place_of_supply || existing.place_of_supply || "",
    dpdp_consent: yesNo(row.dpdp_consent || existing.dpdp_consent || ""),
    dpdp_consent_at: row.dpdp_consent_at || existing.dpdp_consent_at || "",
    marketing_consent: yesNo(row.marketing_consent || existing.marketing_consent || ""),
    dlt_reference: row.dlt_reference || existing.dlt_reference || "",
    installation_date: row.installation_date || existing.installation_date || "",
    installed_date: row.installed_date || row.installation_date || existing.installed_date || "",
    service_start_date: row.service_start_date || row.installed_date || row.installation_date || existing.service_start_date || "",
    included_service_years: row.included_service_years || existing.included_service_years || "",
    included_service_end_date: row.included_service_end_date || existing.included_service_end_date || "",
    additional_service_years_purchased: row.additional_service_years_purchased || existing.additional_service_years_purchased || "",
    service_end_date: row.service_end_date || row.service_contract_end_date || existing.service_end_date || "",
    service_contract_end_date: row.service_contract_end_date || row.service_end_date || existing.service_contract_end_date || "",
    service_years_purchased: row.service_years_purchased || existing.service_years_purchased || "",
    amc_status: row.amc_status || existing.amc_status || "",
    service_frequency: row.service_frequency || existing.service_frequency || "",
    parts_included: row.parts_included || existing.parts_included || "",
    annual_service_price: row.annual_service_price || existing.annual_service_price || "",
    unit: row.unit || existing.unit || "",
    lift_count: row.lift_count || existing.lift_count || "",
    assigned_engineer: row.assigned_engineer || existing.assigned_engineer || "",
    consent_notes: row.consent_notes || existing.consent_notes || "",
    notes: row.notes || existing.notes || "",
    imported_from: row.imported_from || existing.imported_from || "CRM CSV upload",
    created_at: existing.created_at || now,
    updated_at: now
  });
}

function findCustomerImportIndex(customers = [], row = {}) {
  const id = String(row.fuzi_customer_id || row.customer_id || row.id || "").trim();
  const external = String(row.external_customer_ref || "").trim().toLowerCase();
  const phone = phoneDigits(row.phone || row.whatsapp_no || "");
  const name = staffLookupKey(row.name || row.customer || row.customer_name || row.lead_name || "");
  return customers.findIndex((customer) => {
    if (id && [customer.id, customer.customer_id].some((value) => String(value || "").trim() === id)) return true;
    if (external && String(customer.external_customer_ref || "").trim().toLowerCase() === external) return true;
    if (phone && phoneDigits(customer.phone || "") === phone) return true;
    return name && staffLookupKey(customer.name || "") === name;
  });
}

function siteVisitFromCsvRow(row = {}, existing = {}, now = new Date().toISOString()) {
  const openingSchedule = [1, 2, 3, 4, 5, 6].map((index) => ({
    floor: row[`opening_floor_${index}`] || "",
    ff_height_mm: row[`opening_floor_to_floor_height_mm_${index}`] || "",
    lintel_height_mm: row[`opening_lintel_height_mm_${index}`] || ""
  })).filter((entry) => entry.floor || entry.ff_height_mm || entry.lintel_height_mm);
  return cleanPayload({
    ...existing,
    customer_id: row.customer_id || row.fuzi_customer_id || existing.customer_id || "",
    customer_name: row.customer_name || row.customer || existing.customer_name || "",
    address: row.address || existing.address || "",
    site_person_name: row.site_person_name || row.contact_person || existing.site_person_name || "",
    site_person_mobile: row.site_person_mobile || row.phone || existing.site_person_mobile || "",
    reference_given_by: row.reference_given_by || existing.reference_given_by || "",
    reference_mobile: row.reference_mobile || existing.reference_mobile || "",
    pit_size_mm: row.pit_size_mm || existing.pit_size_mm || "",
    machine_room_available: yesNo(row.machine_room_available || existing.machine_room_available || ""),
    site_visit_date: row.site_visit_date || existing.site_visit_date || "",
    site_offer_no: row.site_offer_no || existing.site_offer_no || "",
    site_enquiry_no: row.site_enquiry_no || row.enquiry_no || existing.site_enquiry_no || "",
    site_offer_type: row.site_offer_type || existing.site_offer_type || "",
    site_motor_required: row.site_motor_required || existing.site_motor_required || "",
    site_finish_required: row.site_finish_required || existing.site_finish_required || "",
    site_door_required: row.site_door_required || existing.site_door_required || "",
    site_stops: row.site_stops || existing.site_stops || "",
    site_number_of_openings: row.site_number_of_openings || existing.site_number_of_openings || "",
    site_opening_type: row.site_opening_type || existing.site_opening_type || "",
    door_size_width_mm: row.door_size_width_mm || existing.door_size_width_mm || "",
    door_size_height_mm: row.door_size_height_mm || existing.door_size_height_mm || "",
    car_size_width_mm: row.car_size_width_mm || existing.car_size_width_mm || "",
    car_size_depth_mm: row.car_size_depth_mm || existing.car_size_depth_mm || "",
    site_capacity_persons: row.site_capacity_persons || existing.site_capacity_persons || "",
    site_capacity_kg: row.site_capacity_kg || existing.site_capacity_kg || "",
    shaft_width_mm: row.shaft_width_mm || existing.shaft_width_mm || "",
    shaft_depth_mm: row.shaft_depth_mm || existing.shaft_depth_mm || "",
    brick_wall_available: yesNo(row.brick_wall_available || existing.brick_wall_available || ""),
    civil_door_height_mm: row.civil_door_height_mm || existing.civil_door_height_mm || "",
    visited_by: row.visited_by || existing.visited_by || "",
    opening_schedule: openingSchedule.length ? openingSchedule : existing.opening_schedule,
    notes: row.notes || existing.notes || "",
    imported_from: existing.imported_from || "CRM CSV upload",
    created_at: existing.created_at || now,
    updated_at: now
  });
}

async function importCrmCsvRows(rows = [], requestedType = "auto", user = {}) {
  const now = new Date().toISOString();
  const result = { imported: rows.length, created: 0, updated: 0, skipped: 0, type_counts: {}, errors: [] };
  const customers = await readJson(listFiles.customers, []);
  const inquiries = await readJson(listFiles.sales_inquiries, []);
  const siteVisits = await readJson(listFiles.site_visits, []);
  const serviceRecords = await readJson(listFiles.service_records, []);

  for (const [rowIndex, row] of rows.entries()) {
    const type = requestedType === "auto" ? csvRowImportType(row) : requestedType;
    result.type_counts[type] = (result.type_counts[type] || 0) + 1;
    try {
      if (type === "customers" || type === "customer_master") {
        const name = String(row.name || row.customer || row.customer_name || row.lead_name || "").trim();
        if (!name) {
          result.skipped += 1;
          result.errors.push(`Row ${rowIndex + 2}: customer name is required.`);
          continue;
        }
        const index = findCustomerImportIndex(customers, row);
        const record = customerFromCsvRow(row, index >= 0 ? customers[index] : {}, now);
        record.id = String(record.id || "").trim() || randomFourDigitCustomerId(customers);
        if (index >= 0) {
          const before = customers[index];
          customers[index] = record;
          await appendAuditLog({ user, collection: "customers", recordId: record.id, action: "csv-import-update", before, after: record });
          result.updated += 1;
        } else {
          customers.unshift(record);
          await appendAuditLog({ user, collection: "customers", recordId: record.id, action: "csv-import-create", before: null, after: record });
          result.created += 1;
        }
      } else if (type === "sales_inquiries") {
        const existingIndex = inquiries.findIndex((item) =>
          String(item.enquiry_no || item.id || "") === String(row.enquiry_no || row.id || "") ||
          (row.customer_id && String(item.customer_id || "") === String(row.customer_id))
        );
        const record = {
          ...(existingIndex >= 0 ? inquiries[existingIndex] : {}),
          ...normalizeSalesInquiryPayload(row, existingIndex >= 0 ? inquiries[existingIndex] : {}),
          id: existingIndex >= 0 ? inquiries[existingIndex].id : nextId(inquiries, "SIQ"),
          customer_id: String(row.customer_id || row.fuzi_customer_id || (existingIndex >= 0 ? inquiries[existingIndex].customer_id : "") || "").trim() || randomFourDigitCustomerId([...customers, ...inquiries]),
          source_enquiry_no: String(row.enquiry_no || row.source_enquiry_no || "").trim(),
          imported_from: "CRM CSV upload",
          created_at: existingIndex >= 0 ? inquiries[existingIndex].created_at : now,
          updated_at: now
        };
        if (existingIndex >= 0) {
          const before = inquiries[existingIndex];
          inquiries[existingIndex] = record;
          await appendAuditLog({ user, collection: "sales_inquiries", recordId: record.id, action: "csv-import-update", before, after: record });
          result.updated += 1;
        } else {
          inquiries.unshift(record);
          await appendAuditLog({ user, collection: "sales_inquiries", recordId: record.id, action: "csv-import-create", before: null, after: record });
          result.created += 1;
        }
      } else if (type === "site_visits") {
        const customerId = String(row.customer_id || row.fuzi_customer_id || "").trim();
        if (!customerId) {
          result.skipped += 1;
          result.errors.push(`Row ${rowIndex + 2}: site visit customer_id is required.`);
          continue;
        }
        const existingIndex = siteVisits.findIndex((item) =>
          String(item.customer_id || "") === customerId &&
          String(item.site_visit_date || "") === String(row.site_visit_date || "") &&
          String(item.site_enquiry_no || "") === String(row.site_enquiry_no || row.enquiry_no || "")
        );
        const record = siteVisitFromCsvRow(row, existingIndex >= 0 ? siteVisits[existingIndex] : {}, now);
        record.id = existingIndex >= 0 ? siteVisits[existingIndex].id : nextId(siteVisits, "SV");
        if (existingIndex >= 0) {
          const before = siteVisits[existingIndex];
          siteVisits[existingIndex] = record;
          await appendAuditLog({ user, collection: "site_visits", recordId: record.id, action: "csv-import-update", before, after: record });
          result.updated += 1;
        } else {
          siteVisits.unshift(record);
          await appendAuditLog({ user, collection: "site_visits", recordId: record.id, action: "csv-import-create", before: null, after: record });
          result.created += 1;
        }
      } else if (type === "service_history") {
        const customerId = String(row.customer_id || row.fuzi_customer_id || "").trim();
        if (!customerId) {
          result.skipped += 1;
          result.errors.push(`Row ${rowIndex + 2}: service customer_id is required.`);
          continue;
        }
        const existingIndex = serviceRecords.findIndex((item) =>
          String(item.service_number || item.job_number || item.id || "") === String(row.service_number || row.id || "") ||
          (String(item.customer_id || "") === customerId && String(item.service_date || item.completed_date || "") === String(row.service_date || row.completed_date || ""))
        );
        const record = cleanPayload({
          ...(existingIndex >= 0 ? serviceRecords[existingIndex] : {}),
          ...row,
          id: existingIndex >= 0 ? serviceRecords[existingIndex].id : nextId(serviceRecords, "SVC"),
          job_number: row.service_number || row.job_number || (existingIndex >= 0 ? serviceRecords[existingIndex].job_number : ""),
          customer_id: customerId,
          customer: row.customer || (existingIndex >= 0 ? serviceRecords[existingIndex].customer : ""),
          assigned_engineer: row.assigned_engineer || row.technician || (existingIndex >= 0 ? serviceRecords[existingIndex].assigned_engineer : ""),
          status: row.status || (existingIndex >= 0 ? serviceRecords[existingIndex].status : "Completed"),
          imported_from: "CRM CSV upload",
          created_at: existingIndex >= 0 ? serviceRecords[existingIndex].created_at : now,
          updated_at: now
        });
        if (existingIndex >= 0) {
          const before = serviceRecords[existingIndex];
          serviceRecords[existingIndex] = record;
          await appendAuditLog({ user, collection: "service_records", recordId: record.id, action: "csv-import-update", before, after: record });
          result.updated += 1;
        } else {
          serviceRecords.unshift(record);
          await appendAuditLog({ user, collection: "service_records", recordId: record.id, action: "csv-import-create", before: null, after: record });
          result.created += 1;
        }
      } else {
        result.skipped += 1;
        result.errors.push(`Row ${rowIndex + 2}: unknown import type ${type}.`);
      }
    } catch (error) {
      result.skipped += 1;
      result.errors.push(`Row ${rowIndex + 2}: ${error?.message || error}`);
    }
  }

  await Promise.all([
    writeJson(listFiles.customers, customers),
    writeJson(listFiles.sales_inquiries, inquiries),
    writeJson(listFiles.site_visits, siteVisits),
    writeJson(listFiles.service_records, serviceRecords)
  ]);
  const backfill = await ensureServiceJobsForCustomers();
  result.created_service_jobs = backfill.created;
  return result;
}

function globalSearchItems(collectionName, records = [], fields = [], query = "", limit = 8) {
  const normalizedQuery = query.toLowerCase();
  return records
    .filter((record) => JSON.stringify(record).toLowerCase().includes(normalizedQuery))
    .slice(0, limit)
    .map((record) => ({
      collection: collectionName,
      id: String(record.id || record.customer_id || record.job_id || record.enquiry_no || ""),
      title: String(fields.map((field) => record[field]).find(Boolean) || record.name || record.customer || record.subject || record.id || "-"),
      subtitle: String(record.phone || record.mobile || record.status || record.lead_status || record.department || record.site || record.address || ""),
      status: String(record.status || record.lead_status || record.pipeline_stage || ""),
      customer_id: String(record.customer_id || record.id || ""),
      raw: record
    }));
}

function execFileAsync(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function chromeExecutablePath() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.FUZI_CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "google-chrome",
    "chromium",
    "chromium-browser"
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate.includes(path.sep) || candidate.includes("\\")) {
      if (await pathExists(candidate)) return candidate;
      continue;
    }
    return candidate;
  }
  return "";
}

async function offerAssetDataUrl(fileName, mimeType) {
  const bytes = await fs.readFile(path.join(rootDir, "docs", "offer", "assets", fileName));
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

function safeAssetName(value, fallback = "asset") {
  const cleaned = String(value || fallback).replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "");
  return cleaned || fallback;
}

function decodeDataUrl(value = "") {
  const text = String(value || "");
  const match = text.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) return { contentType: "", bytes: Buffer.from(text, "base64") };
  return {
    contentType: match[1] || "",
    bytes: match[2] ? Buffer.from(match[3], "base64") : Buffer.from(decodeURIComponent(match[3]), "utf8")
  };
}

function numberFromInput(value, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function offerCostSummary(record = {}) {
  const materialCost = numberFromInput(record.material_cost);
  const installCost = numberFromInput(record.install_cost);
  const overheadCost = numberFromInput(record.overhead_cost);
  const marginPercent = numberFromInput(record.margin_percent, 15);
  const discount = numberFromInput(record.discount);
  const gstPercent = numberFromInput(record.gst_percent, 18);
  const baseCost = materialCost + installCost + overheadCost;
  const marginAmount = Math.round((baseCost * marginPercent) / 100);
  const subtotal = Math.max(0, baseCost + marginAmount - discount);
  const gstAmount = Math.round((subtotal * gstPercent) / 100);
  const calculatedTotal = subtotal + gstAmount;
  const savedTotal = numberFromInput(record.total_cost);
  const totalCost = savedTotal || calculatedTotal;
  return { materialCost, installCost, overheadCost, marginPercent, marginAmount, discount, gstPercent, gstAmount, baseCost, subtotal, totalCost };
}

function inventoryNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function inventoryStatus(item) {
  const onHand = inventoryNumber(item.qty_on_hand ?? item.stock);
  const reserved = inventoryNumber(item.qty_reserved);
  const available = onHand - reserved;
  const reorderPoint = inventoryNumber(item.reorder_point ?? item.min_stock);
  const hasOpenPo = Boolean(item.po_number || String(item.po_status || "").toLowerCase().includes("raised"));
  if (available <= 0) return hasOpenPo ? "On Order" : "Out of Stock";
  if (available <= reorderPoint) return hasOpenPo ? "On Order" : "Reorder Needed";
  return "In Stock";
}

function normalizeInventoryItem(item) {
  const onHand = inventoryNumber(item.qty_on_hand ?? item.stock);
  const reserved = inventoryNumber(item.qty_reserved);
  const reorderPoint = inventoryNumber(item.reorder_point ?? item.min_stock);
  const targetStock = inventoryNumber(item.target_stock, Math.max(reorderPoint * 2, onHand));
  const normalized = {
    ...item,
    name: String(item.name || item.item || "").trim(),
    category: String(item.category || "Warehouse").trim(),
    qty_on_hand: onHand,
    qty_reserved: reserved,
    reorder_point: reorderPoint,
    target_stock: targetStock,
    unit: String(item.unit || "pcs").trim(),
    vendor: String(item.vendor || "").trim(),
    lead_time_days: inventoryNumber(item.lead_time_days),
    unit_cost: inventoryNumber(item.unit_cost),
    purchase_price: inventoryNumber(item.purchase_price ?? item.unit_cost),
    current_price: inventoryNumber(item.current_price ?? item.sale_price ?? item.unit_price ?? item.unit_cost ?? item.purchase_price),
    sale_price: inventoryNumber(item.sale_price ?? item.current_price ?? item.unit_price),
    unit_price: inventoryNumber(item.unit_price ?? item.current_price ?? item.sale_price ?? item.unit_cost),
    price_date: String(item.price_date || item.last_price_date || item.updated_at || item.last_updated || new Date().toISOString().slice(0, 10)).trim(),
    bin_location: String(item.bin_location || item.location || "").trim(),
    last_updated: item.last_updated || item.updated_at || new Date().toISOString()
  };
  normalized.available_stock = normalized.qty_on_hand - normalized.qty_reserved;
  normalized.reorder_qty = Math.max(0, normalized.target_stock - normalized.available_stock);
  normalized.status = inventoryStatus(normalized);
  return normalized;
}

function normalizeInventoryPayload(body = {}) {
  const payload = cleanPayload(body);
  const name = String(payload.name || payload.item || "").trim();
  return normalizeInventoryItem({
    ...payload,
    name,
    qty_on_hand: payload.qty_on_hand ?? payload.stock ?? 0,
    qty_reserved: payload.qty_reserved ?? 0,
    reorder_point: payload.reorder_point ?? payload.min_stock ?? 0,
    target_stock: payload.target_stock ?? payload.max_stock ?? 0,
    unit_cost: payload.unit_cost ?? payload.purchase_price ?? 0,
    purchase_price: payload.purchase_price ?? payload.unit_cost ?? 0,
    current_price: payload.current_price ?? payload.sale_price ?? payload.unit_price ?? payload.unit_cost ?? payload.purchase_price ?? 0,
    sale_price: payload.sale_price ?? payload.current_price ?? payload.unit_price ?? 0,
    unit_price: payload.unit_price ?? payload.current_price ?? payload.sale_price ?? 0,
    price_date: payload.price_date || new Date().toISOString().slice(0, 10)
  });
}

function normalizeReportDate(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return raw;
}

function normalizeSalesInquiryPayload(body = {}, existing = {}) {
  const payload = cleanPayload(body);
  const customer = String(payload.customer || payload.lead_name || payload.name || existing.customer || "").trim();
  const phone = String(payload.phone || payload.whatsapp_no || existing.phone || "").trim();
  const whatsapp = String(payload.whatsapp_no || payload.whatsapp || payload.phone || existing.whatsapp_no || "").trim();
  const address = String(payload.address || payload.site_address || payload.site || existing.address || existing.site_address || existing.site || "").trim();
  const status = String(payload.status || payload.lead_status || existing.status || "New").trim();
  const leadType = String(payload.lead_type || payload.leadtype || existing.lead_type || "New").trim();
  return {
    ...existing,
    ...payload,
    customer_id: String(payload.customer_id || existing.customer_id || "").trim(),
    enquiry_no: String(payload.enquiry_no || payload.source_enquiry_no || existing.enquiry_no || "").trim(),
    source_enquiry_no: String(payload.source_enquiry_no || payload.enquiry_no || existing.source_enquiry_no || "").trim(),
    customer,
    lead_name: customer,
    contact_name: String(payload.contact_name || payload.contact_person || existing.contact_name || "").trim(),
    phone,
    whatsapp_no: whatsapp,
    address,
    site_address: address,
    site: address,
    lead_type: leadType,
    leadtype: leadType,
    qty: inventoryNumber(payload.qty ?? payload.quantity ?? existing.qty, 1),
    status,
    lead_status: status,
    requirement: String(payload.requirement || payload.enquiry_remark || existing.requirement || "").trim(),
    enquiry_remark: String(payload.enquiry_remark || payload.requirement || existing.enquiry_remark || "").trim(),
    received_date: normalizeReportDate(payload.received_date || payload.createddate || existing.received_date || ""),
    createddate: normalizeReportDate(payload.createddate || payload.received_date || existing.createddate || ""),
    referral_by: String(payload.referral_by || existing.referral_by || "").trim(),
    createdbyname: String(payload.createdbyname || payload.created_by || existing.createdbyname || "").trim(),
    lastmodifiedbyname: String(payload.lastmodifiedbyname || payload.last_modified_by || existing.lastmodifiedbyname || "").trim(),
    assigned_to: String(payload.assigned_to || existing.assigned_to || "Sales").trim(),
    next_followup: normalizeReportDate(payload.next_followup || existing.next_followup || ""),
    notes: String(payload.notes || existing.notes || "").trim()
  };
}

function findRecordIndex(records, id) {
  return records.findIndex((record) => String(record.id || record.job_id || record.payment_id || record.drawing_no || record.job_number || record.enquiry_no) === String(id));
}

function recordIdentityForAudit(record = {}) {
  return String(record.id || record.job_id || record.payment_id || record.drawing_no || record.job_number || record.enquiry_no || record.reference || "");
}

function normalizedLookup(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function publicRecords(key, records) {
  return key === "users" ? records.map(publicUser) : records;
}

const auditSnapshotKeys = [
  "id",
  "job_no",
  "enquiry_no",
  "customer_id",
  "customer_name",
  "customer",
  "status",
  "lead_status",
  "updated_at"
];

function compactAuditSnapshot(record = null) {
  if (!record || typeof record !== "object") return record;
  const summary = {};
  for (const key of auditSnapshotKeys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== "") summary[key] = record[key];
  }
  return Object.keys(summary).length ? summary : { id: recordIdentityForAudit(record) };
}

async function appendAuditLog({ user = {}, collection = "", recordId = "", action = "", before = null, after = null }) {
  if (!listFiles.audit_logs || collection === "audit_logs") return;
  const records = await readJson(listFiles.audit_logs, []);
  const now = new Date().toISOString();
  const entry = {
    id: nextId(records, "AUD"),
    collection,
    record_id: String(recordId || ""),
    action,
    actor: String(user.display_name || user.username || "system"),
    actor_username: String(user.username || ""),
    actor_department: String(user.department || ""),
    changed_at: now,
    before: compactAuditSnapshot(before),
    after: compactAuditSnapshot(after)
  };
  records.unshift(entry);
  await writeJson(listFiles.audit_logs, records.slice(0, 1000));
}

function defaultStatusForAction(action) {
  const normalized = String(action || "").toLowerCase();
  if (["close", "closed", "resolve", "resolved", "complete", "completed", "done", "read"].includes(normalized)) return "Closed";
  if (["approve", "approved", "order_received"].includes(normalized)) return "Approved";
  if (["start", "dispatch"].includes(normalized)) return "In Progress";
  if (["submit", "sent"].includes(normalized)) return "Submitted";
  if (["revise", "revision"].includes(normalized)) return "Revision";
  return null;
}

async function readOperationsState() {
  return await readJson("operations_state.json", {});
}

async function writeOperationsState(state) {
  await writeJson("operations_state.json", state);
}

function deliveryErrorMessage(delivery, { includeAttemptedConnection = false } = {}) {
  if (!delivery || delivery.ok) return "";
  const json = delivery.json && typeof delivery.json === "object" ? delivery.json : {};
  let errorMessage = "";
  for (const candidate of [delivery.error, delivery.error_message, json.error, json.message, delivery.body, delivery.status]) {
    const message = String(candidate || "").trim();
    if (message) {
      errorMessage = message;
      break;
    }
  }
  if (!errorMessage) return "";
  if (!includeAttemptedConnection) return errorMessage;
  const attempted = String(delivery.url || "").trim();
  const hostPort = hostPortFromUrl(attempted);
  const attemptedMessage = hostPort ? `OpenClaw connection tried ${hostPort}.` : (attempted ? `OpenClaw connection tried ${attempted}.` : "");
  return attemptedMessage && !errorMessage.includes(hostPort || attempted)
    ? `${attemptedMessage} ${errorMessage}`
    : errorMessage;
}

function stringifyFetchObject(value, details = {}) {
  let valueJson = "";
  try {
    valueJson = JSON.stringify(value);
  } catch (error) {
    valueJson = JSON.stringify({});
  }
  return JSON.stringify({ fetch: valueJson, ...details });
}

function normalizePhoneDeliveryTarget(target) {
  const value = String(target || "").trim();
  if (!value) return "";
  const digits = value.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length > 10) return `+${digits}`;
  return value;
}

function isPhoneDeliveryTarget(target) {
  return /^\+[1-9]\d{6,14}$/.test(normalizePhoneDeliveryTarget(target));
}

function defaultOpenClawCommunicationData(env, baseDir) {
  const homeDir = env.USERPROFILE || env.HOME || baseDir;
  const siblingDockerOpenClawDir = path.resolve(baseDir, "..", "dockeropenclaw", "data", "home", ".openclaw");
  const fallbackOpenClawConfigDir = fsSync.existsSync(path.join(siblingDockerOpenClawDir, "openclaw.json"))
    ? siblingDockerOpenClawDir
    : path.join(homeDir, ".openclaw");
  const openClawConfigDir = env.FUZI_OPENCLAW_CONFIG_DIR || fallbackOpenClawConfigDir;
  return {
    url: defaultOpenClawUrl(env),
    preferConfiguredUrl: hasExplicitOpenClawConnectionEnv(env),
    timeoutSeconds: Number(env.FUZI_OPENCLAW_TIMEOUT || 15),
    defaultChannel: env.FUZI_OPENCLAW_CHANNEL || "whatsapp",
    opsTarget: env.FUZI_OPENCLAW_OPS_TARGET || "",
    agentId: env.FUZI_OPENCLAW_AGENT_ID || "main",
    whatsappBackendChannel: env.FUZI_OPENCLAW_WHATSAPP_BACKEND_CHANNEL || "",
    whatsappBackendTarget: env.FUZI_OPENCLAW_WHATSAPP_BACKEND_TARGET || "",
    configFile: env.FUZI_OPENCLAW_CONFIG_FILE || path.join(openClawConfigDir, "openclaw.json"),
    envFile: env.FUZI_OPENCLAW_ENV_FILE || path.join(openClawConfigDir, ".env"),
    allowedDashboardCommand: ["openclaw", "dashboard", "--no-open"],
    freeChannels: ["whatsapp", "telegram", "signal", "discord", "slack", "email"],
    agentTargetEnvKeys: {
      "Modernization Project Coordinator": "FUZI_OPENCLAW_TARGET_MODERNIZATION_COORDINATOR",
      "Morning Operations Brief": "FUZI_OPENCLAW_TARGET_MORNING_BRIEF",
      "Live Operations Dashboard": "FUZI_OPENCLAW_TARGET_LIVE_DASHBOARD",
      "Contract Renewal CRM Agent": "FUZI_OPENCLAW_TARGET_RENEWALS",
      "CRM Query Agent": "FUZI_OPENCLAW_TARGET_CRM_QUERY",
      "Site Walkthrough to Work Order": "FUZI_OPENCLAW_TARGET_WORK_ORDERS",
      "Field Installation Manager": "FUZI_OPENCLAW_TARGET_INSTALLATIONS",
      "FUZI Service": "FUZI_OPENCLAW_TARGET_SERVICE",
      "FUZI Service Report": "FUZI_OPENCLAW_TARGET_SERVICE_REPORT"
    }
  };
}

function defaultDiscordBreakdownSyncData(env, baseDir) {
  // WARNING: Breakdown sync must not use Discord REST here. OpenClaw owns Discord access and FUZI reads OpenClaw session history only.
  const homeDir = env.USERPROFILE || env.HOME || baseDir;
  const openClawConfigDir = env.FUZI_OPENCLAW_CONFIG_DIR || path.join(homeDir, ".openclaw");
  return {
    openClawUrl: defaultOpenClawUrl(env),
    openClawBreakdownSessionKey: env.FUZI_OPENCLAW_BREAKDOWN_SESSION_KEY || "",
    openClawTimeoutSeconds: Number(env.FUZI_OPENCLAW_TIMEOUT || 15),
    configFile: env.FUZI_OPENCLAW_CONFIG_FILE || path.join(openClawConfigDir, "openclaw.json"),
    envFile: env.FUZI_OPENCLAW_ENV_FILE || path.join(openClawConfigDir, ".env"),
    channelTarget: env.FUZI_OPENCLAW_TARGET_BREAKDOWN_CHANNEL || "",
    pollMs: Math.max(Number(env.FUZI_BREAKDOWN_DISCORD_POLL_MS || 15000), 5000),
    limit: Math.min(Math.max(Number(env.FUZI_BREAKDOWN_DISCORD_LIMIT || 50), 1), 100)
  };
}

function defaultInboundPlatformMessageData(body, config, nowStamp) {
  const messageText = String(body.text || body.message || body.body || body.content || "").trim();
  const source = String(body.from || body.sender || body.customer || body.user || "OpenClaw").trim();
  const priority = String(body.priority || (/urgent|stuck|trapped|breakdown|emergency/i.test(messageText) ? "High" : "Normal")).trim();
  return {
    channel: String(body.channel || body.platform || config.defaultChannel).trim(),
    customer: String(body.customer || source).trim(),
    phone: String(body.phone || body.target_phone || "").trim(),
    from: source,
    priority,
    state: "New",
    status: "New",
    assigned_to: String(body.assigned_to || "").trim(),
    text: messageText,
    next_action: String(body.next_action || "Review inbound chat and assign owner.").trim(),
    external_id: String(body.id || body.message_id || "").trim(),
    created_at: nowStamp,
    updated_at: nowStamp
  };
}

function normalizePhoneDigits(value = "") {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function phoneLikeValue(value = "") {
  const text = String(value || "").trim();
  return /(?:\+?\d[\d\s-]{8,}\d)/.test(text) ? text : "";
}

function parseChatDateTime(dateText = "", timeText = "") {
  const dateParts = String(dateText || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!dateParts) return { date: new Date().toISOString().slice(0, 10), time: "" };
  const month = dateParts[1].padStart(2, "0");
  const day = dateParts[2].padStart(2, "0");
  const year = dateParts[3];
  const timeParts = String(timeText || "").trim().match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (!timeParts) return { date: `${year}-${month}-${day}`, time: "" };
  let hour = Number(timeParts[1]);
  const minute = timeParts[2];
  const meridian = timeParts[3].toUpperCase();
  if (meridian === "AM" && hour === 12) hour = 0;
  if (meridian === "PM" && hour !== 12) hour += 12;
  return { date: `${year}-${month}-${day}`, time: `${String(hour).padStart(2, "0")}:${minute}` };
}

function parseEngineerAttendanceMessages(body = {}) {
  const text = String(body.text || body.message || body.body || body.content || "").trim();
  if (!text) return [];
  const entryPattern = /\[(\d{1,2}:\d{2}\s*[AP]M),\s*(\d{1,2}\/\d{1,2}\/\d{4})\]\s*(\+?\d[\d\s-]{8,}\d):\s*/gi;
  const matches = [...text.matchAll(entryPattern)];
  if (!matches.length) {
    const phone = phoneLikeValue(body.phone || body.target_phone || body.from || body.sender || "");
    const parsed = parseChatDateTime(String(body.date || ""), String(body.time || ""));
    return [{
      phone,
      date: String(body.date || parsed.date).includes("/") ? parsed.date : String(body.date || parsed.date).slice(0, 10),
      time: String(body.time || parsed.time).trim(),
      text,
      external_id: String(body.id || body.message_id || "").trim()
    }];
  }
  return matches.map((match, index) => {
    const nextMatch = matches[index + 1];
    const start = match.index + match[0].length;
    const end = nextMatch ? nextMatch.index : text.length;
    const parsed = parseChatDateTime(match[2], match[1]);
    return {
      phone: match[3].trim(),
      date: parsed.date,
      time: parsed.time,
      text: text.slice(start, end).trim(),
      external_id: `${match[2]} ${match[1]} ${match[3].trim()}`
    };
  }).filter((entry) => entry.text);
}

function explicitAttendanceTime(text = "") {
  const match = String(text || "").match(/\b(?:at\s+office\s+)?(\d{1,2}):(\d{2})\b/i);
  if (!match) return "";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function attendanceStatusForText(text = "") {
  const lower = String(text || "").toLowerCase();
  if (/\bleave\s+cancel\b|\bcancel\s+leave\b/.test(lower)) return "present";
  if (/\b(on\s+)?leave\b|\bleave\s+permission\b|\bleave\s+parmission\b/.test(lower)) return "leave";
  if (/\bhalf[-\s]?day\b/.test(lower)) return "half-day";
  if (/\babsent\b/.test(lower)) return "absent";
  if (/\blate\b/.test(lower)) return "late";
  return "present";
}

function attendanceMovementForText(text = "") {
  const lower = String(text || "").toLowerCase();
  if (/\bout\s*(from)?\b|\bout\s+office\b/.test(lower)) return "out";
  if (/\bgoing\s+to\b|\bon\s+duty\b|\bat\s+office\b/.test(lower)) return "in";
  return "update";
}

function attendanceDestinationForText(text = "") {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  const out = normalized.match(/\bout(?:\s+from)?\s+(.+)$/i);
  if (out) return out[1].trim();
  const going = normalized.match(/\bgoing\s+to\s+(.+)$/i);
  if (going) return going[1].trim();
  if (/^at\s+office\b/i.test(normalized)) return "Office";
  const onDuty = normalized.match(/\bon\s+duty\b\s*(.+)$/i);
  if (onDuty) return onDuty[1].trim();
  return "";
}

function appendAttendanceNote(existingNotes = "", nextNote = "") {
  const note = String(nextNote || "").trim();
  if (!note) return String(existingNotes || "").trim();
  const current = String(existingNotes || "").trim();
  if (!current) return note;
  if (current.includes(note)) return current;
  return `${current}\n${note}`;
}

function normalizeMatchText(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function breakdownSiteText(record = {}) {
  return normalizeMatchText([
    record.id,
    record.task_id,
    record.current_task,
    record.current_job,
    record.site,
    record.location,
    record.customer,
    record.building,
    record.address
  ].filter(Boolean).join(" "));
}

function engineerNameFromAttendancePerson(person = {}) {
  return String(person?.name || "").trim().toLowerCase();
}

async function reconcileEngineerAttendanceBreakdown(entry = {}, person = null, sourceChannel = "engineer-attendance", sourceActor = "") {
  const movement = attendanceMovementForText(entry.text);
  if (!["in", "out"].includes(movement)) return null;
  const destination = attendanceDestinationForText(entry.text);
  if (!destination || /office/i.test(destination)) return null;

  const destinationText = normalizeMatchText(destination);
  if (!destinationText) return null;
  const destinationTaskId = (String(destination).match(/\bBRK-\d+\b/i)?.[0] || "").toUpperCase();

  const breakdowns = await readJson(listFiles.breakdowns, []);
  const sourceId = String(entry.external_id || "").trim();
  const alreadyApplied = breakdowns.find((record) => Array.isArray(record.engineer_attendance_updates) &&
    record.engineer_attendance_updates.some((update) => String(update.source_message_id || "") === sourceId && sourceId));
  if (alreadyApplied) return { matched: true, changed: false, record: alreadyApplied, reason: "already-applied" };

  const closedStatuses = new Set(["closed", "resolved", "done", "cancelled"]);
  const personKey = engineerNameFromAttendancePerson(person);
  const candidates = breakdowns
    .map((record, index) => ({ record, index, siteText: breakdownSiteText(record) }))
    .filter(({ record, siteText }) => {
      const status = String(record.status || "").trim().toLowerCase();
      if (closedStatuses.has(status)) return false;
      const recordTaskId = String(record.id || record.task_id || "").trim().toUpperCase();
      const taskIdMatches = destinationTaskId && recordTaskId === destinationTaskId;
      if (!taskIdMatches && (!siteText || (!siteText.includes(destinationText) && !destinationText.includes(siteText)))) return false;
      if (!personKey) return true;
      const assigned = String(record.engineer || record.assigned_to || record.scheduled_engineer || record.technician || "").trim().toLowerCase();
      return !assigned || assigned === personKey;
    })
    .sort((left, right) => {
      const rank = ({ record }) => {
        const status = String(record.status || "").trim().toLowerCase();
        const assigned = String(record.engineer || record.assigned_to || record.scheduled_engineer || record.technician || "").trim();
        if (movement === "out") {
          if (assigned && ["dispatched", "reached site"].includes(status)) return 0;
          if (["dispatched", "reached site"].includes(status)) return 1;
          if (assigned && status === "scheduled") return 2;
          if (assigned) return 3;
          return 8;
        }
        if (assigned && status === "scheduled") return 0;
        if (assigned && ["open", "waiting for engineer"].includes(status)) return 1;
        if (assigned) return 2;
        if (["open", "waiting for engineer"].includes(status)) return 7;
        return 9;
      };
      const rankDelta = rank(left) - rank(right);
      if (rankDelta) return rankDelta;
      const leftTime = Date.parse(left.record.updated_at || left.record.created_at || "") || 0;
      const rightTime = Date.parse(right.record.updated_at || right.record.created_at || "") || 0;
      return rightTime - leftTime || right.index - left.index;
    });

  if (!candidates.length) {
    if (!destinationTaskId) return { matched: false, changed: false, destination };
    const now = new Date().toISOString();
    const update = {
      source_channel: sourceChannel,
      source_actor: sourceActor,
      source_phone: entry.phone || "",
      source_message_id: sourceId,
      text: entry.text,
      movement,
      destination,
      at: now
    };
    const fallbackRecord = {
      id: destinationTaskId,
      site: destinationTaskId,
      location: destinationTaskId,
      customer: destinationTaskId,
      fault: `Engineer attendance update received for ${destinationTaskId}.`,
      issue: `Engineer attendance update received for ${destinationTaskId}.`,
      priority: "Normal",
      status: movement === "out" ? "Closed" : "Dispatched",
      scheduled_engineer: person?.name || "",
      engineer: person?.name || "",
      assigned_to: person?.name || "",
      technician: person?.name || "",
      assignment_source: "engineer-attendance-task-id",
      source: "Engineer Attendance",
      source_channel: sourceChannel,
      created_at: now,
      updated_at: now,
      engineer_attendance_updates: [update],
      last_engineer_attendance_source: sourceChannel,
      last_engineer_attendance_message_id: sourceId,
      last_engineer_attendance_text: entry.text,
      last_engineer_movement: movement,
      last_reported_location: destination,
      last_reported_at: now,
      ...(movement === "in" ? { dispatched_at: now } : {}),
      ...(movement === "out" ? { closed_at: now, completed_at: now } : {})
    };
    breakdowns.unshift(fallbackRecord);
    await writeJson(listFiles.breakdowns, breakdowns);
    return { matched: true, changed: true, record: fallbackRecord, movement, destination, reason: "created-from-task-id" };
  }

  const preferred = movement === "out"
    ? candidates.find(({ record }) => ["dispatched", "reached site", "scheduled"].includes(String(record.status || "").trim().toLowerCase())) || candidates[0]
    : candidates.find(({ record }) => !["dispatched", "reached site"].includes(String(record.status || "").trim().toLowerCase())) || candidates[0];
  const index = preferred.index;
  const existing = breakdowns[index];
  const now = new Date().toISOString();
  const update = {
    source_channel: sourceChannel,
    source_actor: sourceActor,
    source_phone: entry.phone || "",
    source_message_id: sourceId,
    text: entry.text,
    movement,
    destination,
    at: now
  };
  const nextUpdates = [...(Array.isArray(existing.engineer_attendance_updates) ? existing.engineer_attendance_updates : []), update];
  const nextStatus = movement === "out" ? "Closed" : "Dispatched";
  const nextRecord = {
    ...existing,
    status: nextStatus,
    engineer_attendance_updates: nextUpdates,
    last_engineer_attendance_source: sourceChannel,
    last_engineer_attendance_message_id: sourceId,
    last_engineer_attendance_text: entry.text,
    last_engineer_movement: movement,
    last_reported_location: destination,
    last_reported_at: now,
    ...(movement === "in" ? { dispatched_at: existing.dispatched_at || now } : {}),
    ...(movement === "out" ? { closed_at: existing.closed_at || now, completed_at: existing.completed_at || now } : {}),
    updated_at: now
  };
  breakdowns[index] = nextRecord;
  await writeJson(listFiles.breakdowns, breakdowns);

  const engineerName = String(nextRecord.engineer || nextRecord.assigned_to || nextRecord.scheduled_engineer || nextRecord.technician || person?.name || "").trim();
  if (engineerName) {
    const orgChart = await readJson(listFiles.org_chart, []);
    const engineerIndex = orgChart.findIndex((member) =>
      String(member.name || "").trim().toLowerCase() === engineerName.toLowerCase() &&
      String(member.department || "").trim().toLowerCase() === "breakdown"
    );
    if (engineerIndex >= 0) {
      const currentJob = String(orgChart[engineerIndex].current_job || orgChart[engineerIndex].current_task || "").trim();
      orgChart[engineerIndex] = {
        ...orgChart[engineerIndex],
        current_job: movement === "out" && (!currentJob || currentJob === nextRecord.id) ? "" : nextRecord.id,
        current_task: movement === "out" && (!currentJob || currentJob === nextRecord.id) ? "" : nextRecord.id,
        availability: movement === "out" ? "Available" : "On Site",
        next_available_at: movement === "out" ? "" : "after current task",
        last_engineer_attendance_message_id: sourceId,
        last_reported_location: destination,
        updated_at: now
      };
      await writeJson(listFiles.org_chart, orgChart);
    }
  }

  return { matched: true, changed: true, record: nextRecord, movement, destination };
}

async function importEngineerAttendanceMessages(body = {}) {
  const entries = parseEngineerAttendanceMessages(body);
  if (!entries.length) return { ok: false, status: 400, error: "Engineer attendance message text is required." };

  const now = new Date().toISOString();
  const staff = await readJson(listFiles.org_chart, []);
  const attendance = await readJson(listFiles.attendance, []);
  const deptComms = await readJson(listFiles.dept_comms, []);
  const staffByPhone = new Map(staff.map((person) => [normalizePhoneDigits(person.phone || person.mobile), person]).filter(([phone]) => phone));
  const sourceChannel = String(body.channel || body.platform || "engineer-attendance").trim();
  const sourceActor = String(body.sender || body.from || body.author || "").trim();
  const imported = [];
  const unmatched = [];
  const breakdown_updates = [];

  for (const entry of entries) {
    const phoneDigits = normalizePhoneDigits(entry.phone);
    const person = staffByPhone.get(phoneDigits);
    const status = attendanceStatusForText(entry.text);
    const movement = attendanceMovementForText(entry.text);
    const checkIn = explicitAttendanceTime(entry.text) || entry.time || "";
    const destination = attendanceDestinationForText(entry.text);
    const noteParts = [
      destination ? `Update: ${destination}` : "",
      `Channel ${sourceChannel}: ${entry.text}`
    ].filter(Boolean);

    if (!person) {
      unmatched.push({ ...entry, normalized_phone: phoneDigits });
    } else {
      const existingIndex = attendance.findIndex((item) => (
        String(item.person_id || item.staff_id || "") === String(person.id || "") &&
        String(item.date || "") === entry.date
      ));
      const previous = existingIndex >= 0 ? attendance[existingIndex] : {};
      const record = {
        ...previous,
        id: previous.id || nextId(attendance, "ATT"),
        date: entry.date,
        person_id: person.id,
        person_name: person.name,
        department: person.department || "",
        status,
        check_in: previous.check_in || (movement !== "out" && (status === "present" || status === "late") ? checkIn : ""),
        check_out: previous.check_out || (movement === "out" ? checkIn : ""),
        last_movement: movement,
        last_location_update: destination,
        notes: appendAttendanceNote(previous.notes, noteParts.join(" - ")),
        source_channel: sourceChannel,
        source_phone: entry.phone,
        source_message_id: entry.external_id || "",
        marked_by: "engineer-attendance-import",
        marked_at: previous.marked_at || now,
        updated_at: now
      };
      if (existingIndex >= 0) {
        attendance[existingIndex] = record;
      } else {
        attendance.unshift({ ...record, created_at: now });
      }
      imported.push(record);
    }

    const breakdownUpdate = await reconcileEngineerAttendanceBreakdown(entry, person, sourceChannel, sourceActor);
    if (breakdownUpdate?.matched) breakdown_updates.push(breakdownUpdate);

    const existingComm = deptComms.some((item) => (
      String(item.source_channel || "") === sourceChannel &&
      String(item.source_message_id || "") === String(entry.external_id || "") &&
      String(item.source_phone || "") === String(entry.phone || "") &&
      String(item.body || item.message || "").trim() === String(entry.text || "").trim()
    ));
    if (!existingComm) {
      const comm = {
        id: nextId(deptComms, "MSG"),
        department: person?.department || "Operations",
      from_dept: person?.department || "Engineer Attendance",
      from_user: entry.phone || sourceActor || "OpenClaw",
      from_name: person?.name || entry.phone || sourceActor || "OpenClaw",
        to_depts: ["HR", person?.department || "Operations"],
        subject: `Engineer attendance: ${person?.name || entry.phone}`,
        body: entry.text,
        message: entry.text,
        status: "Unread",
        priority: status === "leave" ? "High" : "Normal",
      source_channel: sourceChannel,
      source_phone: entry.phone,
      source_actor: sourceActor,
      source_message_id: entry.external_id || "",
        attendance_date: entry.date,
        timestamp: now,
        created_at: now,
        read_by: []
      };
      deptComms.unshift(comm);
    }
  }

  await writeJson(listFiles.attendance, attendance);
  await writeJson(listFiles.dept_comms, deptComms);
  return { ok: true, imported, unmatched, breakdown_updates, count: imported.length, unmatched_count: unmatched.length, breakdown_update_count: breakdown_updates.filter((item) => item.changed).length };
}

function defaultAgentForCommunicationAction(action, target) {
  const moduleMap = {
    "Elevator Modernization Management": "Modernization Project Coordinator",
    "Elevator Project Tracking": "Field Installation Manager",
    "Elevator MIS Reporting Dashboard": "Live Operations Dashboard",
    "uncontacted renewals": "Contract Renewal CRM Agent",
    "FSM": "Site Walkthrough to Work Order"
  };
  const actionMap = {
    "Send SMS brief": "Morning Operations Brief",
    "Draft outreach": "Contract Renewal CRM Agent",
    "Push to FSM": "Site Walkthrough to Work Order",
    "Send snapshot": "Live Operations Dashboard"
  };
  return actionMap[action] || moduleMap[target] || "Live Operations Dashboard";
}

function extractOpenClawDashboardUrlFromOutput(output, expectedPort = defaultOpenClawPort) {
  const expectedPortText = String(expectedPort || "").trim();
  for (const rawUrl of String(output || "").match(/https?:\/\/\S+/g) || []) {
    const cleanedUrl = rawUrl.replace(/[)\].,;']+$/g, "");
    try {
      const parsed = new URL(cleanedUrl);
      if (parsed.pathname.startsWith("/chat") || (expectedPortText && parsed.port === expectedPortText)) return cleanedUrl;
    } catch {
      // Ignore non-URL matches from command output.
    }
  }
  return "";
}

function configuredOpenClawPort(url) {
  try {
    return new URL(url).port || defaultOpenClawPort;
  } catch {
    return defaultOpenClawPort;
  }
}

function extractOpenClawTokenFromDashboardUrl(dashboardUrl) {
  if (!dashboardUrl) return "";
  try {
    const parsed = new URL(dashboardUrl);
    for (const source of [parsed.hash.replace(/^#/, ""), parsed.search.replace(/^\?/, "")]) {
      const values = new URLSearchParams(source);
      for (const key of ["token", "gatewayToken", "gateway_token", "authToken", "auth_token"]) {
        const value = values.get(key);
        if (value) return value.trim();
      }
    }
  } catch {
    return "";
  }
  return "";
}

function createOpenClawCommunicationService({
  config,
  env,
  readText,
  runCommand,
  fetchImpl,
  readState,
  writeState,
  nextRecordId,
  now
}) {
  const freeChannels = config.freeChannels || ["whatsapp", "telegram", "signal", "discord", "slack"];
  const agentTargetEnvKeys = config.agentTargetEnvKeys || {};
  let dashboardLookupAttempted = false;
  let discoveredDashboardUrl = "";

  const discoverDashboardUrl = async () => {
    if (dashboardLookupAttempted) return discoveredDashboardUrl;
    dashboardLookupAttempted = true;
    if (config.preferConfiguredUrl) return "";
    if (!runCommand || !Array.isArray(config.allowedDashboardCommand) || !config.allowedDashboardCommand.length) return "";
    const [command, ...args] = config.allowedDashboardCommand;
    const output = await runCommand(command, args, Math.max(config.timeoutSeconds, 5) * 1000);
    discoveredDashboardUrl = extractOpenClawDashboardUrlFromOutput(output, configuredOpenClawPort(config.url));
    return discoveredDashboardUrl;
  };

  const runtimeOpenClawBaseUrl = async () => {
    const configuredUrl = openClawUrlFromParts({
      url: await runtimeValue("FUZI_OPENCLAW_URL", ""),
      address: await runtimeValue("FUZI_OPENCLAW_ADDRESS", ""),
      host: await runtimeValue("FUZI_OPENCLAW_HOST", ""),
      port: await runtimeValue("FUZI_OPENCLAW_PUBLISHED_PORT", await runtimeValue("FUZI_OPENCLAW_PORT", defaultOpenClawPort))
    });
    return configuredUrl ? (configuredUrl.endsWith("/") ? configuredUrl : `${configuredUrl}/`) : "";
  };

  const openClawBaseUrl = async () => {
    const configuredUrl = await runtimeOpenClawBaseUrl();
    if (configuredUrl) return configuredUrl;
    const discoveredUrl = await discoverDashboardUrl();
    if (discoveredUrl) {
      try {
        const parsed = new URL(discoveredUrl);
        return `${parsed.protocol}//${parsed.host}/`;
      } catch {
        // Fall back to configured URL below.
      }
    }
    return config.url.endsWith("/") ? config.url : `${config.url}/`;
  };

  const endpointFor = async (endpointPath = "/tools/invoke") => {
    const base = await openClawBaseUrl();
    return new URL(endpointPath.replace(/^\/+/, ""), base).toString();
  };

  const loadConfig = async () => {
    const text = await readText(config.configFile);
    if (!text.trim()) return {};
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  };

  const loadEnvValues = async () => {
    const values = {};
    const text = await readText(config.envFile);
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.replace(/\r$/, "").trim();
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const [key, ...rest] = line.split("=");
      const normalizedKey = key.trim().replace(/^export\s+/, "").trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(normalizedKey)) continue;
      values[normalizedKey] = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
    }
    return values;
  };

  const resolvePossiblyEnvValue = async (value) => {
    if (value && typeof value === "object") {
      const envValues = await loadEnvValues();
      const source = String(value.source || value.refSource || value.ref_source || "").trim().toLowerCase();
      const id = String(value.id || value.key || value.name || value.env || value.envVar || value.env_var || "").trim();
      if ((source === "env" || value.provider || id) && id) return String(env[id] || envValues[id] || "").trim();
      for (const candidate of [value.value, value.token, value.secret]) {
        const resolvedObjectValue = await resolvePossiblyEnvValue(candidate);
        if (resolvedObjectValue) return resolvedObjectValue;
      }
      return "";
    }
    const envValues = await loadEnvValues();
    const resolved = String(value || "").trim();
    const secretRefEnv = resolved.match(/^secretref-env:([A-Za-z_][A-Za-z0-9_]*)$/);
    if (secretRefEnv) return String(env[secretRefEnv[1]] || envValues[secretRefEnv[1]] || "").trim();
    if (!resolved.startsWith("${") || !resolved.endsWith("}")) return resolved;
    const envKey = resolved.slice(2, -1);
    return String(env[envKey] || envValues[envKey] || "").trim();
  };

  const configSecret = async (fieldName) => {
    const openClawConfig = await loadConfig();
    const gateway = openClawConfig.gateway && typeof openClawConfig.gateway === "object" ? openClawConfig.gateway : {};
    const auth = gateway.auth && typeof gateway.auth === "object" ? gateway.auth : {};
    if (typeof auth[fieldName] === "string" && auth[fieldName].trim()) return await resolvePossiblyEnvValue(auth[fieldName]);

    const text = await readText(config.configFile);
    const match = text.match(new RegExp(`(?:^|[\\s{,])(?:['"]?${fieldName}['"]?)\\s*:\\s*(['"])([^'"]+)\\1`, "m"));
    return match ? await resolvePossiblyEnvValue(match[2]) : "";
  };

  const runtimeValue = async (envKey, fallback = "") => {
    const envValues = await loadEnvValues();
    return String(env[envKey] || envValues[envKey] || fallback || "").trim();
  };

  const configuredChannels = async () => {
    const openClawConfig = await loadConfig();
    const channels = openClawConfig.channels && typeof openClawConfig.channels === "object" ? openClawConfig.channels : {};
    return Object.entries(channels)
      .filter(([, channelConfig]) => channelConfig && channelConfig.enabled !== false)
      .map(([channelName]) => channelName);
  };

  const authSecret = async () => {
    const envValues = await loadEnvValues();
    const dashboardToken = extractOpenClawTokenFromDashboardUrl(await discoverDashboardUrl());
    for (const candidate of [
      env.OPENCLAW_GATEWAY_TOKEN,
      envValues.OPENCLAW_GATEWAY_TOKEN,
      await configSecret("token"),
      env.FUZI_OPENCLAW_PASSWORD,
      env.OPENCLAW_GATEWAY_PASSWORD,
      envValues.FUZI_OPENCLAW_PASSWORD,
      envValues.OPENCLAW_GATEWAY_PASSWORD,
      await configSecret("password"),
      readAppSecret("fuzi_openclaw_token"),
      readAppSecret("openclaw_gateway_token"),
      readAppSecret("fuzi_openclaw_password"),
      readAppSecret("openclaw_gateway_password"),
      dashboardToken
    ]) {
      if (String(candidate || "").trim()) return String(candidate).trim();
    }
    return "";
  };

  const formatMessage = (eventType, payload = {}) => {
    if (eventType === "technician-alert") return String(payload.message || "Technician alert from FUZI operations.").trim();
    if (eventType === "morning-brief") {
      const details = Array.isArray(payload.details) ? payload.details.slice(0, 4).map((item) => `- ${item}`).join("\n") : "";
      return `${payload.summary || "Morning operations brief."}\n${details}`.trim();
    }
    if (payload.summary) return String(payload.summary).trim();
    if (payload.message) return String(payload.message).trim();
    return JSON.stringify(payload);
  };

  const deliveryChannel = async (payload = {}) => {
    const explicitChannel = String(payload.channel || "").trim();
    if (explicitChannel) return explicitChannel;
    const configured = await configuredChannels();
    if (configured.includes(config.defaultChannel) || !configured.length) return config.defaultChannel;
    return freeChannels.find((channel) => configured.includes(channel)) || configured[0] || config.defaultChannel;
  };

  const whatsappBackendChannel = async () => {
    const explicitChannel = await runtimeValue("FUZI_OPENCLAW_WHATSAPP_BACKEND_CHANNEL", config.whatsappBackendChannel);
    if (explicitChannel) return explicitChannel;
    const configured = await configuredChannels();
    if (configured.includes("discord")) return "discord";
    if (configured.includes("whatsapp")) return "whatsapp";
    return configured[0] || config.defaultChannel;
  };

  const whatsappBackendTarget = async (payload = {}) => {
    const agentTargetKey = agentTargetEnvKeys[String(payload.agent || "").trim()];
    if (agentTargetKey) {
      const agentTarget = await runtimeValue(agentTargetKey, "");
      if (agentTarget) return agentTarget;
    }
    return await runtimeValue("FUZI_OPENCLAW_WHATSAPP_BACKEND_TARGET", config.whatsappBackendTarget) ||
      await runtimeValue("FUZI_OPENCLAW_OPS_TARGET", config.opsTarget);
  };

  const deliveryTarget = async (eventType, payload = {}) => {
    const explicitTarget = String(payload.target || payload.target_phone || "").trim();
    if (explicitTarget) return explicitTarget;
    const agentTargetKey = agentTargetEnvKeys[String(payload.agent || "").trim()];
    if (agentTargetKey) {
      const agentTarget = await runtimeValue(agentTargetKey, "");
      if (agentTarget) return agentTarget;
    }
    if (eventType === "morning-brief") {
      const briefTarget = await runtimeValue("FUZI_OPENCLAW_MORNING_BRIEF_PHONE", "");
      if (briefTarget) return briefTarget;
    }
    return await runtimeValue("FUZI_OPENCLAW_OPS_TARGET", config.opsTarget);
  };

  const postJson = async (endpointPath, payload) => {
    const endpoint = await endpointFor(endpointPath);
    const secret = await authSecret();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(config.timeoutSeconds, 1) * 1000);
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { Authorization: `Bearer ${secret}` } : {})
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const body = await response.text();
      let json = {};
      try {
        json = body ? JSON.parse(body) : {};
      } catch {
        json = {};
      }
      const ok = response.ok && (json.ok !== false);
      const responseError = stringifyFetchObject(response, {
        status: response.status,
        ok: response.ok,
        body: body.slice(0, 400),
        json
      });
      return { ok, status: response.status, body: body.slice(0, 400), json, url: endpoint, ...(ok ? {} : { error: responseError }) };
    } catch (error) {
      return { ok: false, status: null, error: stringifyFetchObject(error), url: endpoint };
    } finally {
      clearTimeout(timeout);
    }
  };

  const sendBusinessChannelUpdate = async (eventType, payload = {}) => {
    const requestPayload = {
      source: "fuzi-operations-portal",
      event_type: eventType,
      timestamp: now(),
      ...payload
    };
    const target = await deliveryTarget(eventType, payload);
    const channel = await deliveryChannel(payload);
    const configured = await configuredChannels();
    const message = formatMessage(eventType, requestPayload);
    const phoneTarget = isPhoneDeliveryTarget(target);
    const normalizedPhoneTarget = phoneTarget ? normalizePhoneDeliveryTarget(target) : "";
    let sendChannel = channel;
    let sendTarget = normalizedPhoneTarget || target;
    let sendMessage = message;
    let delivery;

    if (phoneTarget) {
      sendChannel = await whatsappBackendChannel();
      if (sendChannel !== "whatsapp") {
        const backendTarget = await whatsappBackendTarget(payload);
        if (!backendTarget) {
          delivery = {
            ok: false,
            status: null,
            error: `Injected WhatsApp backend '${sendChannel}' requires FUZI_OPENCLAW_WHATSAPP_BACKEND_TARGET, an agent target, or FUZI_OPENCLAW_OPS_TARGET.`,
            url: await endpointFor("/tools/invoke")
          };
        } else {
          sendTarget = backendTarget;
          sendMessage = `[Injected WhatsApp via ${sendChannel} for ${normalizedPhoneTarget}] ${message}`;
        }
      }
    }

    if (!delivery && !target) {
      delivery = { ok: true, status: 204, body: "OpenClaw delivery suppressed because no outbound target is configured.", url: await endpointFor("/tools/invoke") };
    } else if (!delivery && configured.length && !configured.includes(sendChannel)) {
      delivery = { ok: false, status: null, error: `OpenClaw channel '${sendChannel}' is not configured. Available channels: ${configured.join(", ")}.`, url: await endpointFor("/tools/invoke") };
    } else if (!delivery) {
      delivery = await postJson("/tools/invoke", {
        tool: "message",
        action: "send",
        agentId: config.agentId,
        agent_id: config.agentId,
        args: {
          channel: sendChannel,
          target: sendTarget,
          message: sendMessage
        },
        sessionKey: "fuzi-operations",
        request: requestPayload
      });
    }

    const exactErrorMessage = deliveryErrorMessage(delivery);
    if (!delivery.ok && exactErrorMessage) {
      delivery.error = exactErrorMessage;
      delivery.error_message = exactErrorMessage;
    }
    const state = await readState();
    state.connector_status = {
      state: delivery.ok ? "online" : "error",
      last_attempt: now(),
      channel: sendChannel,
      target,
      url: delivery.url,
      error: exactErrorMessage,
      error_message: exactErrorMessage,
      response_body: delivery.ok ? "" : String(delivery.body || "").trim()
    };
    if (!delivery.ok && exactErrorMessage) {
      state.last_openclaw_error = exactErrorMessage;
      state.last_openclaw_delivery_error = exactErrorMessage;
      state.last_openclaw_error_at = now();
      if (eventType === "breakdown-auto-assigned") {
        state.last_discord_breakdown_openclaw_error = exactErrorMessage;
        state.discord_breakdown_last_openclaw_delivery_error = exactErrorMessage;
      }
    }
    await writeState(state);
    return delivery;
  };

  const invokeTool = async (tool, args = {}, payload = {}) => {
    const delivery = await postJson("/tools/invoke", {
      tool,
      args,
      sessionKey: payload.sessionKey || payload.session_key || "fuzi-operations",
      request: {
        source: "fuzi-operations-portal",
        timestamp: now(),
        ...payload
      }
    });
    const exactErrorMessage = deliveryErrorMessage(delivery);
    if (!delivery.ok && exactErrorMessage) {
      delivery.error = exactErrorMessage;
      delivery.error_message = exactErrorMessage;
    }
    return delivery;
  };

  const appendOpenClawSessionMessage = async (sessionKey, message) => {
    const sessionId = String(sessionKey || "").split(":").pop()?.trim();
    if (!sessionId) return { ok: false, status: 400, error: "OpenClaw session id is required." };
    const openClawDir = path.dirname(config.configFile);
    const sessionsDir = path.join(openClawDir, "agents", "main", "sessions");
    await fs.mkdir(sessionsDir, { recursive: true });
    const sessionFile = path.join(sessionsDir, `${sessionId}.jsonl`);
    const timestamp = new Date().toISOString();
    if (!fsSync.existsSync(sessionFile) || !fsSync.readFileSync(sessionFile, "utf8").trim()) {
      await fs.appendFile(sessionFile, JSON.stringify({
        type: "session",
        version: 3,
        id: sessionId,
        timestamp,
        cwd: path.join(openClawDir, "workspace")
      }) + "\n", "utf8");
    }
    const millis = Date.now();
    await fs.appendFile(sessionFile, JSON.stringify({
      type: "message",
      id: `fuzi-backend-${millis.toString(36)}-${crypto.randomBytes(3).toString("hex")}`,
      parentId: null,
      timestamp,
      message: {
        role: "user",
        content: [{ type: "text", text: String(message || "") }],
        timestamp: millis
      }
    }) + "\n", "utf8");
    return { ok: true, status: 202, transport: "openclaw-session-file", sessionKey, sessionFile };
  };

  const sendSessionMessage = async (sessionKey, message, payload = {}) => {
    const normalizedSessionKey = String(sessionKey || "").trim();
    if (!normalizedSessionKey) return { ok: false, status: 400, error: "OpenClaw session key is required." };
    const delivery = await invokeTool("sessions_send", {
      sessionKey: normalizedSessionKey,
      message: String(message || "")
    }, { ...payload, sessionKey: normalizedSessionKey });
    if (delivery.ok) return delivery;
    const fallbackReason = String(delivery.error || delivery.body || "").trim();
    const fallback = await appendOpenClawSessionMessage(normalizedSessionKey, message);
    return {
      ...fallback,
      gateway_delivery: delivery,
      fallback_reason: fallbackReason || "OpenClaw gateway session send failed."
    };
  };

  const saveInboundPlatformMessage = async (body = {}) => {
    const state = await readState();
    const messages = Array.isArray(state.messages) ? state.messages : [];
    const messageData = defaultInboundPlatformMessageData(body, config, now());
    if (!messageData.text) return { ok: false, status: 400, error: "Inbound OpenClaw message text is required." };
    const serviceMessage = {
      id: nextRecordId(messages, "MSG"),
      ...messageData
    };
    messages.unshift(serviceMessage);
    state.messages = messages;
    await writeState(state);
    return { ok: true, message: serviceMessage };
  };

  return {
    configuredChannels,
    invokeTool,
    saveInboundPlatformMessage,
    sendSessionMessage,
    sendBusinessChannelUpdate
  };
}

function createDiscordBreakdownSyncService({
  config,
  env,
  readText,
  fetchImpl,
  readState,
  writeState,
  readCollection,
  writeCollection,
  notifyAutoAssignedBreakdown,
  nextRecordId,
  now
}) {
  // WARNING: Maintain the removed Discord REST fetch. This service must call OpenClaw tools only, never discord.com APIs.
  const loadJsonConfig = async () => {
    const text = await readText(config.configFile);
    if (!text.trim()) return {};
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  };

  const loadEnvValues = async () => {
    const values = {};
    const text = await readText(config.envFile);
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.replace(/\r$/, "").trim();
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const [key, ...rest] = line.split("=");
      const normalizedKey = key.trim().replace(/^export\s+/, "").trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(normalizedKey)) continue;
      values[normalizedKey] = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
    }
    return values;
  };

  const resolvePossiblyEnvValue = async (value) => {
    if (value && typeof value === "object") {
      const envValues = await loadEnvValues();
      const source = String(value.source || value.refSource || value.ref_source || "").trim().toLowerCase();
      const id = String(value.id || value.key || value.name || value.env || value.envVar || value.env_var || "").trim();
      if ((source === "env" || value.provider || id) && id) return String(env[id] || envValues[id] || "").trim();
      for (const candidate of [value.value, value.token, value.secret]) {
        const resolvedObjectValue = await resolvePossiblyEnvValue(candidate);
        if (resolvedObjectValue) return resolvedObjectValue;
      }
      return "";
    }
    const envValues = await loadEnvValues();
    const resolved = String(value || "").trim();
    const secretRefEnv = resolved.match(/^secretref-env:([A-Za-z_][A-Za-z0-9_]*)$/);
    if (secretRefEnv) return String(env[secretRefEnv[1]] || envValues[secretRefEnv[1]] || "").trim();
    if (!resolved.startsWith("${") || !resolved.endsWith("}")) return resolved;
    const envKey = resolved.slice(2, -1);
    return String(env[envKey] || envValues[envKey] || "").trim();
  };
  let lastBreakdownChannelLookup = null;
  const openClawRuntimeLookupKeys = new Set([
    "FUZI_OPENCLAW_TARGET_BREAKDOWN_CHANNEL",
    "FUZI_OPENCLAW_CONFIG_DIR",
    "FUZI_OPENCLAW_CONFIG_FILE",
    "FUZI_OPENCLAW_ENV_FILE"
  ]);

  const runtimeValue = async (key, fallback = "") => {
    const envValues = await loadEnvValues();
    const localValue = String(env[key] || envValues[key] || fallback || "").trim();
    if (localValue || !openClawRuntimeLookupKeys.has(key)) return localValue;
    return await openClawRuntimeValue(key);
  };

  const openClawEndpoint = (endpointPath = "/tools/invoke") => {
    const base = String(config.openClawUrl || "").trim();
    if (!base) return "";
    return new URL(endpointPath.replace(/^\/+/, ""), base.endsWith("/") ? base : `${base}/`).toString();
  };

  const openClawAuthSecret = async () => {
    const envValues = await loadEnvValues();
    const openClawConfig = await loadJsonConfig();
    const gateway = openClawConfig.gateway && typeof openClawConfig.gateway === "object" ? openClawConfig.gateway : {};
    const auth = gateway.auth && typeof gateway.auth === "object" ? gateway.auth : {};
    for (const candidate of [
      env.OPENCLAW_GATEWAY_TOKEN,
      envValues.OPENCLAW_GATEWAY_TOKEN,
      env.FUZI_OPENCLAW_TOKEN,
      envValues.FUZI_OPENCLAW_TOKEN,
      env.FUZI_OPENCLAW_PASSWORD,
      envValues.FUZI_OPENCLAW_PASSWORD,
      auth.token,
      auth.gatewayToken,
      auth.gateway_token,
      auth.authToken,
      auth.auth_token,
      auth.password
    ]) {
      const resolved = await resolvePossiblyEnvValue(candidate);
      if (resolved) return resolved;
    }
    return "";
  };

  const extractBreakdownTarget = (value = "") => {
    const match = String(value || "").match(/(?:^|[^A-Za-z0-9_-])(channel:\d{6,})(?:[^A-Za-z0-9_-]|$)/);
    return match ? match[1] : "";
  };

  const extractRuntimeResultValue = (key, value = "") => {
    const text = String(value || "").trim();
    if (!text) return "";
    if (key === "FUZI_OPENCLAW_TARGET_BREAKDOWN_CHANNEL") return extractBreakdownTarget(text);
    const exactLine = text.split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.startsWith(`${key}=`) || line.startsWith(`${key}:`));
    if (exactLine) return exactLine.slice(key.length + 1).trim();
    return text;
  };

  const extractOpenClawToolText = (body = "") => {
    try {
      const parsed = JSON.parse(String(body || ""));
      const content = parsed?.result?.content;
      if (Array.isArray(content)) {
        const text = content.map((item) => item?.text).filter(Boolean).join("\n").trim();
        if (text) return text;
      }
      return String(parsed?.result?.details || parsed?.result || "").trim();
    } catch {
      return String(body || "").trim();
    }
  };

  const parseOpenClawGatewayBody = (body = "") => {
    try {
      const parsed = JSON.parse(String(body || ""));
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // Keep the raw body available to diagnostics below.
    }
    return { ok: false, raw: String(body || "") };
  };

  const openClawToolInvoke = async (tool, args = {}) => {
    const endpoint = openClawEndpoint("/tools/invoke");
    const payload = {
      tool,
      args,
      ...args
    };
    const invoke = {
      url: endpoint,
      method: "POST",
      tool,
      openclaw_connection: openClawConnectionTriedMessage(config.openClawUrl)
    };
    if (!endpoint) {
      return {
        ok: false,
        invoke,
        returned: { ok: false, error: "OpenClaw gateway URL is not configured." },
        result: null
      };
    }
    const secret = await openClawAuthSecret();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(Number(config.openClawTimeoutSeconds || 15), 1) * 1000);
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { Authorization: `Bearer ${secret}` } : {})
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const body = await response.text();
      const parsed = parseOpenClawGatewayBody(body);
      const returned = { status: response.status, ok: response.ok, body };
      return {
        ok: response.ok && parsed?.ok !== false,
        status: response.status,
        invoke,
        returned,
        gateway: parsed,
        result: parsed?.result ?? parsed
      };
    } catch (error) {
      const message = error?.name === "AbortError" ? "OpenClaw gateway tool call timed out." : String(error?.message || "OpenClaw gateway tool call failed.");
      return {
        ok: false,
        invoke,
        returned: { ok: false, error: message },
        result: null,
        error: message
      };
    } finally {
      clearTimeout(timeout);
    }
  };

  const openClawRuntimeValue = async (key) => {
    const endpoint = openClawEndpoint("/tools/invoke");
    if (!endpoint) return "";
    const secret = await openClawAuthSecret();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(Number(config.openClawTimeoutSeconds || 15), 1) * 1000);
    const payload = {
      tool: "fuzidiscordchannel",
      action: "resolve",
      sessionKey: "agent:main:explicit:fuzidiscordchannel",
      key,
      expose: "value-only",
      readonly: true
    };
    const lookup = {
      url: endpoint,
      method: "POST",
      tool: payload.tool,
      sessionKey: payload.sessionKey,
      key: payload.key,
      expose: payload.expose,
      readonly: payload.readonly,
      openclaw_connection: openClawConnectionTriedMessage(config.openClawUrl)
    };
    if (key === "FUZI_OPENCLAW_TARGET_BREAKDOWN_CHANNEL") lastBreakdownChannelLookup = lookup;
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { Authorization: `Bearer ${secret}` } : {})
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const body = await response.text();
      const text = extractOpenClawToolText(body);
      const value = extractRuntimeResultValue(key, text || body);
      const updatedLookup = {
        ...lookup,
        status: response.status,
        ok: response.ok,
        found: Boolean(value),
        ...(key === "FUZI_OPENCLAW_TARGET_BREAKDOWN_CHANNEL" ? { target: value || "" } : { value_found: Boolean(value) }),
        returned: {
          status: response.status,
          ok: response.ok,
          body
        }
      };
      if (key === "FUZI_OPENCLAW_TARGET_BREAKDOWN_CHANNEL") lastBreakdownChannelLookup = updatedLookup;
      return value;
    } catch (error) {
      const updatedLookup = {
        ...lookup,
        ok: false,
        found: false,
        error: error?.name === "AbortError" ? "OpenClaw gateway lookup timed out." : String(error?.message || "OpenClaw gateway lookup failed."),
        returned: {
          ok: false,
          error: error?.name === "AbortError" ? "OpenClaw gateway lookup timed out." : String(error?.message || "OpenClaw gateway lookup failed.")
        }
      };
      if (key === "FUZI_OPENCLAW_TARGET_BREAKDOWN_CHANNEL") lastBreakdownChannelLookup = updatedLookup;
      return "";
    } finally {
      clearTimeout(timeout);
    }
  };

  const discordChannelId = async () => {
    const target = await runtimeValue("FUZI_OPENCLAW_TARGET_BREAKDOWN_CHANNEL", config.channelTarget);
    const value = String(target || "").trim();
    return value.startsWith("channel:") ? value.slice("channel:".length).trim() : value;
  };

  const discordConfigurationDiagnostics = (channelId) => {
    const target = channelId ? `channel:${channelId}` : String(lastBreakdownChannelLookup?.target || "").trim();
    const missing = [
      channelId ? "" : "channel"
    ].filter(Boolean);
    return {
      missing,
      target: target || "",
      openclaw_connection: openClawConnectionTriedMessage(config.openClawUrl),
      target_lookup_fetch: lastBreakdownChannelLookup || {
        url: openClawEndpoint("/tools/invoke"),
        method: "POST",
        tool: "fuzidiscordchannel",
        sessionKey: "agent:main:explicit:fuzidiscordchannel",
        key: "FUZI_OPENCLAW_TARGET_BREAKDOWN_CHANNEL",
        expose: "value-only",
        readonly: true,
        openclaw_connection: openClawConnectionTriedMessage(config.openClawUrl)
      }
    };
  };

  const cleanLineValue = (value) => String(value || "").replace(/\*\*/g, "").trim().replace(/\.+$/g, "").trim();
  const cleanLineKey = (value) => String(value || "").replace(/[*_`~#>-]/g, "").trim().toLowerCase();

  const parseConfirmation = (message) => {
    const textParts = [message?.content];
    for (const embed of Array.isArray(message?.embeds) ? message.embeds : []) {
      textParts.push(embed?.title, embed?.description);
      for (const field of Array.isArray(embed?.fields) ? embed.fields : []) {
        textParts.push(`${field?.name || ""}: ${field?.value || ""}`);
      }
    }
    const content = textParts.filter(Boolean).join("\n").trim();
    const header = content.match(/Breakdown\s+(BRK-\d+)\s+assigned\s+from\s+Discord\s+message\s+(\d+)/i);
    if (!header) return null;
    const values = {};
    for (const rawLine of content.split(/\r?\n/)) {
      const match = rawLine.match(/^\s*([^:]+):\s*(.*?)\s*$/);
      if (!match) continue;
      values[cleanLineKey(match[1])] = cleanLineValue(match[2]);
    }
    const scheduled = values["scheduled engineer"] || "";
    const scheduledMatch = scheduled.match(/^(.*?)\s*(?:\((.*?)\))?$/);
    const engineer = cleanLineValue(scheduledMatch?.[1] || values.technician || "");
    const availability = cleanLineValue(scheduledMatch?.[2] || "");
    const unit = values.unit || "";
    const site = values.site || "";
    const fault = values.fault || (site ? `Inbound Discord report for unit ${unit} at ${site}.` : "");
    return {
      id: header[1],
      source_discord_message_id: header[2],
      source_bot_message_id: String(message.id || ""),
      unit,
      site,
      location: site,
      customer: site || `Discord unit ${unit}`,
      fault,
      issue: fault,
      issue_category: "Other",
      custom_issue: fault,
      priority: values.priority || "High",
      engineer,
      assigned_to: engineer,
      technician: values.technician || engineer,
      engineer_availability: availability,
      status: engineer ? "Scheduled" : "Open",
      source: "Discord",
      channel: "discord",
      created_at: now(),
      updated_at: now()
    };
  };

  const parseHumanBreakdownMessage = (body = {}) => {
    const text = String(body.text || body.message || body.body || body.content || "").trim();
    const messageId = String(body.message_id || body.discord_message_id || body.id || "").trim();
    const phoneMatch = text.match(/(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{4,5}/);
    const phone = String(body.phone || body.caller_mobile || body.caller_phone || (phoneMatch ? phoneMatch[0] : "")).trim();
    const textWithoutPhone = phoneMatch ? text.replace(phoneMatch[0], " ").replace(/\s+/g, " ").trim() : text;
    const temporaryOnRequest = /\btemporary\b/i.test(text) && /\bon\b/i.test(text) && /krwa|karwa|karva|krawa/i.test(text);
    const [unitToken, ...rest] = textWithoutPhone.split(/\s+/);
    const startsWithSplitPhone = Boolean(phone && /^\d{5}$/.test(unitToken || "") && /^\d{5}$/.test(rest[0] || ""));
    const unit = String(body.unit || (!startsWithSplitPhone && /^\d+[A-Za-z-]*$/.test(unitToken || "") ? unitToken : "")).trim();
    const inferredSite = unit ? rest.join(" ") : textWithoutPhone;
    let site = String(body.site || body.location || (temporaryOnRequest ? "Temporary switch-on request" : inferredSite)).trim();
    site = site.replace(/^Place\s+Exists\s+/i, "").trim();
    site = site
      .replace(/\s+Dear User,\s*Phone received from.*$/i, "")
      .replace(/\s+Knowlarity Communications Pvt\. Ltd\.\s*$/i, "")
      .trim();
    const defaultFault = temporaryOnRequest
      ? "Customer requested temporary lift switch-on/operation; handle politely and urgently."
      : (unit && site ? `Inbound Discord report for unit ${unit} at ${site}.` : (textWithoutPhone || text));
    const priority = String(body.priority || (temporaryOnRequest || /urgent|stuck|trapped|breakdown|emergency|not working|fault/i.test(text) ? "High" : "Normal")).trim();
    const status = String(body.status || body.breakdown_status || "").trim();
    const fault = String(body.fault || body.issue || defaultFault).trim();
    return {
      source_discord_message_id: messageId,
      unit,
      site,
      location: site,
      customer: site || (unit ? `Discord unit ${unit}` : "Discord breakdown"),
      phone,
      caller_mobile: phone,
      fault,
      issue: fault,
      issue_category: "Other",
      custom_issue: fault,
      priority,
      ...(status ? { status } : {}),
      source: "Discord",
      channel: "discord",
      created_at: now(),
      updated_at: now()
    };
  };

  const normalizeOpenClawContentText = (value) => {
    if (typeof value === "string") return value.trim();
    if (Array.isArray(value)) {
      return value.map((item) => normalizeOpenClawContentText(item)).filter(Boolean).join("\n").trim();
    }
    if (value && typeof value === "object") {
      return String(value.text || value.message || value.content || value.body || value.value || "").trim();
    }
    return "";
  };

  const collectOpenClawMessages = (value, messages = [], seen = new Set()) => {
    if (!value || typeof value !== "object") return messages;
    if (seen.has(value)) return messages;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const item of value) collectOpenClawMessages(item, messages, seen);
      return messages;
    }
    const text = normalizeOpenClawContentText(value.content || value.message || value.text || value.body);
    const role = String(value.role || value.type || value.kind || value.authorRole || "").trim().toLowerCase();
    const id = String(value.id || value.message_id || value.messageId || value.discord_message_id || value.discordMessageId || value.event_id || value.eventId || "").trim();
    const timestamp = String(value.timestamp || value.created_at || value.createdAt || value.time || value.date || "").trim();
    const sender = String(value.sender || value.author || value.author_name || value.authorName || value.from || value.username || "").trim();
    const channel = String(value.channel || value.provider || value.source || "").trim();
    const looksLikeMessage = Boolean(text) && (
      Boolean(id || timestamp || sender) ||
      ["user", "assistant", "message", "event_msg", "input", "output"].includes(role)
    );
    if (looksLikeMessage) {
      messages.push({
        id,
        timestamp,
        sender,
        channel,
        role,
        content: text,
        raw: value
      });
    }
    for (const key of ["messages", "history", "items", "events", "entries", "content", "result", "details"]) {
      if (value[key] && value[key] !== value) collectOpenClawMessages(value[key], messages, seen);
    }
    return messages;
  };

  const openClawMessageId = (message = {}, fallbackIndex = 0) => {
    const raw = message.raw || {};
    return String(
      message.id ||
      raw.id ||
      raw.message_id ||
      raw.messageId ||
      raw.discord_message_id ||
      raw.discordMessageId ||
      raw.payload?.message_id ||
      raw.payload?.messageId ||
      raw.payload?.id ||
      ""
    ).trim() || `openclaw-${message.timestamp || fallbackIndex}`;
  };

  const messageLooksLikeBreakdownChannel = (message = {}, channelId = "") => {
    const haystack = JSON.stringify(message.raw || message).toLowerCase();
    const target = String(channelId || "").trim().toLowerCase();
    if (!target) return true;
    return haystack.includes(target) || haystack.includes(`channel:${target}`) || haystack.includes("fuzi-breakdown") || haystack.includes("breakdown");
  };

  const openClawHistoryMessages = async ({ channelId = "", limit = config.limit } = {}) => {
    // WARNING: Do not replace this with Discord channel polling. OpenClaw stores the Discord session/history and exposes it via existing tools.
    const explicitSessionKey = String(config.openClawBreakdownSessionKey || env.FUZI_OPENCLAW_BREAKDOWN_SESSION_KEY || "").trim();
    const directSessionKeys = [
      explicitSessionKey,
      channelId ? `agent:main:discord:channel:${channelId}` : "",
      channelId ? `agent:main:discord:${channelId}` : ""
    ].filter(Boolean);
    const searchHints = [
      explicitSessionKey,
      channelId ? `channel:${channelId}` : "",
      channelId,
      "fuzi-breakdown",
      "breakdown"
    ].filter(Boolean);
    let sessionKey = explicitSessionKey;
    let listResult = null;
    for (const directSessionKey of directSessionKeys) {
      const historyResult = await openClawToolInvoke("sessions_history", {
        sessionKey: directSessionKey,
        limit: Math.max(Number(limit || config.limit || 1), 1),
        includeTools: false
      });
      if (historyResult.ok) {
        const messages = collectOpenClawMessages(historyResult.result)
          .filter((message) => message.content && !["developer", "system", "tool", "function"].includes(message.role))
          .filter((message) => messageLooksLikeBreakdownChannel(message, channelId));
        return { ok: true, messages, sessionKey: directSessionKey, listResult, historyResult };
      }
    }
    if (!sessionKey) {
      for (const search of searchHints.slice(1)) {
        listResult = await openClawToolInvoke("sessions_list", {
          search,
          agentId: "main",
          includeLastMessage: true,
          messageLimit: 1,
          limit: 10
        });
        const sessions = collectOpenClawMessages(listResult.result)
          .map((item) => item.raw)
          .filter((item) => item && typeof item === "object");
        const flatSessions = [];
        const collectSessions = (value, seen = new Set()) => {
          if (typeof value === "string") {
            try {
              const parsed = JSON.parse(value);
              collectSessions(parsed, seen);
            } catch {
              // Non-JSON text cannot contain structured session entries.
            }
            return;
          }
          if (!value || typeof value !== "object" || seen.has(value)) return;
          seen.add(value);
          if (Array.isArray(value)) {
            value.forEach((item) => collectSessions(item, seen));
            return;
          }
          const key = String(value.sessionKey || value.key || value.id || value.sessionId || value.label || "").trim();
          if (key && (value.sessionKey || value.sessionId || value.label || value.lastMessage || value.last_message)) flatSessions.push(value);
          for (const nestedKey of ["sessions", "items", "result", "content", "details", "text"]) collectSessions(value[nestedKey], seen);
        };
        collectSessions(listResult.result);
        flatSessions.push(...sessions);
        const match = flatSessions.find((item) => {
          const text = JSON.stringify(item).toLowerCase();
          return text.includes(search.toLowerCase()) || text.includes("fuzi-breakdown") || text.includes(channelId);
        }) || flatSessions[0];
        sessionKey = String(match?.sessionKey || match?.key || match?.id || match?.label || "").trim();
        if (sessionKey) break;
      }
    }
    if (!sessionKey) {
      return {
        ok: false,
        messages: [],
        sessionKey: "",
        listResult,
        historyResult: null,
        message: "OpenClaw breakdown session was not found from sessions_list."
      };
    }
    const historyResult = await openClawToolInvoke("sessions_history", {
      sessionKey,
      limit: Math.max(Number(limit || config.limit || 1), 1),
      includeTools: false
    });
    if (!historyResult.ok) {
      return {
        ok: false,
        messages: [],
        sessionKey,
        listResult,
        historyResult,
        message: "OpenClaw breakdown session history could not be fetched."
      };
    }
    const messages = collectOpenClawMessages(historyResult.result)
      .filter((message) => message.content && !["developer", "system", "tool", "function"].includes(message.role))
      .filter((message) => messageLooksLikeBreakdownChannel(message, channelId));
    return { ok: true, messages, sessionKey, listResult, historyResult };
  };

  const selectedEngineerFromBody = (body = {}) => String(
    body.scheduled_engineer ||
    body.engineer ||
    body.assigned_to ||
    body.technician ||
    ""
  ).trim();

  const formatBreakdownSummary = (record) => [
    `Breakdown ${record.id} assigned from Discord message ${record.source_discord_message_id || "unknown"}.`,
    `Unit: ${record.unit || "-"}.`,
    `Site: ${record.site || record.location || "-"}.`,
    `Fault: ${record.fault || record.issue || "-"}.`,
    `Priority: ${record.priority || "Normal"}.`,
    `Scheduled engineer: ${record.engineer || record.assigned_to || "-"} (${record.engineer_availability || "Scheduled"}).`,
    `Technician: ${record.technician || record.engineer || record.assigned_to || "-"}.`
  ].join("\n");

  const formatPhoneForReply = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const digits = raw.replace(/\D/g, "");
    const india = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : (digits.length === 10 ? digits : "");
    if (india) return `+91 ${india.slice(0, 5)} ${india.slice(5)}`;
    return raw;
  };

  const formatAutoAssignedReply = (record) => {
    const engineer = String(record.engineer || record.assigned_to || record.scheduled_engineer || "").trim();
    const site = String(record.site || record.location || record.customer || "the breakdown site").trim();
    const phone = formatPhoneForReply(record.phone || record.caller_mobile);
    const phoneText = phone ? `; phone is ${phone}` : "";
    return `${engineer} is now assigned to ${site}${phoneText}, and the current task is ${record.id}.`;
  };

  const formatBreakdownChannelReply = (record) => {
    const status = String(record.status || "").trim().toLowerCase();
    const engineer = String(record.engineer || record.assigned_to || record.technician || "").trim();
    const site = String(record.site || record.location || record.customer || "").trim();
    const unit = String(record.unit || "").trim();
    const phone = formatPhoneForReply(record.phone || record.caller_mobile || record.caller_phone);
    const currentTask = String(record.current_task || record.current_job || record.id || "").trim();
    const siteLabel = site || (unit ? `unit ${unit}` : "the breakdown");
    const unitLabel = unit && site ? `, unit ${unit}` : "";
    const taskLabel = currentTask || "not assigned";
    const withDetails = (message) => {
      const details = [
        phone ? `phone is ${phone}` : "",
        `current task is ${taskLabel}`
      ].filter(Boolean);
      return `${message.replace(/\.$/, "")}; ${details.join(", and ")}.`;
    };
    if (["done", "closed", "resolved", "completed"].includes(status)) {
      return withDetails(`Done, ${siteLabel}${unitLabel} is marked ${record.status || "Done"}.`);
    }
    if (engineer) {
      return withDetails(`Ok, ${engineer} is going to ${siteLabel}${unitLabel}.`);
    }
    return withDetails(`Ok, ${siteLabel}${unitLabel} is logged.`);
  };

  const idGreaterThan = (left, right) => {
    if (!left) return false;
    if (!right) return true;
    try {
      return BigInt(left) > BigInt(right);
    } catch {
      return String(left) > String(right);
    }
  };

  const activeBreakdownLoad = (breakdowns) => {
    const load = new Map();
    for (const item of Array.isArray(breakdowns) ? breakdowns : []) {
      const status = String(item.status || "").trim().toLowerCase();
      if (["closed", "resolved", "done", "cancelled"].includes(status)) continue;
      const engineer = String(item.engineer || item.assigned_to || item.technician || "").trim().toLowerCase();
      if (!engineer) continue;
      load.set(engineer, (load.get(engineer) || 0) + 1);
    }
    return load;
  };

  const availableLabels = /available|standby|ready|free/i;
  const unavailableLabels = /inactive|off|leave|holiday|unavailable|busy|scheduled|on site|onsite/i;

  const parseTimeOfDay = (value) => {
    const match = String(value || "").trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if (!match) return null;
    let hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    const meridiem = String(match[3] || "").toUpperCase();
    if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) return null;
    if (meridiem === "PM" && hour < 12) hour += 12;
    if (meridiem === "AM" && hour === 12) hour = 0;
    return (hour * 60) + minute;
  };

  const parseShiftWindow = (shift) => {
    const text = String(shift || "").trim();
    const match = text.match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*(?:-|to|–|—)\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i);
    if (!match) return null;
    const start = parseTimeOfDay(match[1]);
    const end = parseTimeOfDay(match[2]);
    if (start === null || end === null) return null;
    return { start, end, label: text };
  };

  const shiftStatus = (member, date = new Date()) => {
    const shift = String(member.shift || "").trim();
    const window = parseShiftWindow(shift);
    if (!window) return { shift, inShift: Boolean(shift), minutesUntilStart: shift ? 0 : 9999, score: shift ? 1 : 4 };
    const nowMinutes = (date.getHours() * 60) + date.getMinutes();
    const inShift = window.start <= window.end
      ? nowMinutes >= window.start && nowMinutes <= window.end
      : nowMinutes >= window.start || nowMinutes <= window.end;
    const minutesUntilStart = inShift ? 0 : (
      window.start >= nowMinutes ? window.start - nowMinutes : (24 * 60) - nowMinutes + window.start
    );
    return { shift, inShift, minutesUntilStart, score: inShift ? 0 : 2 + Math.min(6, Math.ceil(minutesUntilStart / 120)) };
  };

  const staffAvailabilityDetails = (member, loads = new Map(), state = {}) => {
    const name = String(member.name || "").trim();
    const availability = String(member.availability || "Available").trim();
    const currentJob = String(member.current_job || "").trim();
    const nextAvailable = String(member.next_available_at || "").trim();
    const notes = String(member.notes || "").trim();
    const shift = String(member.shift || "").trim();
    const activeLoad = loads.get(name.toLowerCase()) || 0;
    const statusText = availability.toLowerCase();
    const shiftInfo = shiftStatus(member);
    const hasActiveBreakdown = activeLoad > 0;
    const availableNow = !currentJob && !hasActiveBreakdown && availableLabels.test(availability || "Available") && !unavailableLabels.test(statusText);
    const when = availableNow
      ? "Available now"
        : currentJob
          ? `Busy on ${currentJob}${nextAvailable ? ` until ${nextAvailable}` : ""}`
        : hasActiveBreakdown
          ? `Busy on ${activeLoad} active breakdown${activeLoad === 1 ? "" : "s"} - available after current breakdown`
          : unavailableLabels.test(statusText)
          ? (nextAvailable || shift ? `${availability} - available ${nextAvailable || shift}` : availability)
          : availability;
    const lastEngineer = String(state.discord_breakdown_last_openclaw_engineer || state.discord_breakdown_last_engineer || "").trim().toLowerCase();
    const score = (availableNow ? 0 : 1000) + shiftInfo.score + (activeLoad * 10) + (name.toLowerCase() === lastEngineer ? 5 : 0);
    return {
      name,
      availability,
      shift,
      current_job: currentJob,
      next_available_at: nextAvailable,
      notes,
      active_breakdown_load: activeLoad,
      available_now: availableNow,
      busy: Boolean(currentJob) || hasActiveBreakdown || unavailableLabels.test(statusText),
      shift_in_window: shiftInfo.inShift,
      minutes_until_shift_start: shiftInfo.minutesUntilStart,
      assignment_score: score,
      availability_summary: [when, shift && !when.includes(shift) ? `Shift ${shift}` : "", notes].filter(Boolean).join(" - ")
    };
  };

  const readAssignableStaff = async () => {
    const [orgChart, users] = await Promise.all([
      readCollection("org_chart"),
      readCollection("users")
    ]);
    const usersByOrgNode = new Map(users.map((user) => [String(user.linked_org_node || ""), user]));
    const usersByName = new Map(users.map((user) => [String(user.display_name || user.username || "").trim().toLowerCase(), user]));
    const breakdownStaff = orgChart
      .filter((person) => String(person.department || "").trim().toLowerCase() === "breakdown")
      .filter((person) => !String(person.title || "").toLowerCase().includes("supervisor"))
      .map((person) => {
        const name = String(person.name || "").trim();
        const linkedUser = usersByOrgNode.get(String(person.id || "")) || usersByName.get(name.toLowerCase());
        const currentJob = String(person.current_job || person.current_task || "").trim();
        const availability = String(person.availability || (currentJob ? "Scheduled" : "Available")).trim();
        return {
          id: String(person.id || name),
          name,
          role: String(person.title || "Breakdown Staff"),
          phone: String(person.phone || linkedUser?.phone || ""),
          availability: String(linkedUser?.active === false ? "Inactive" : availability),
          current_job: currentJob,
          next_available_at: String(person.next_available_at || (currentJob ? "after current task" : "")).trim(),
          shift: String(person.shift || "24/7 emergency rotation").trim(),
          notes: String(person.notes || "Breakdown dispatch pool").trim()
        };
      });
    const seen = new Set();
    return breakdownStaff.filter((member) => {
      const key = String(member.name || "").trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const readBreakdownSupervisor = async () => {
    const orgChart = await readCollection("org_chart");
    return orgChart.find((person) =>
      String(person.department || "").trim().toLowerCase() === "breakdown" &&
      String(person.title || "").toLowerCase().includes("supervisor")
    ) || null;
  };

  const availabilityRank = (member) => {
    const details = staffAvailabilityDetails(member);
    if (details.busy) return null;
    if (details.available_now) return details.shift_in_window ? 0 : 1;
    return null;
  };

  const availableBreakdownEngineers = async (breakdowns = null, state = null) => {
    const team = await readAssignableStaff();
    const activeBreakdowns = breakdowns || await readCollection("breakdowns");
    const assignmentState = state || await readState();
    const loads = activeBreakdownLoad(activeBreakdowns);
    return team
      .map((member, index) => ({ member, index, details: staffAvailabilityDetails(member, loads, assignmentState), rank: availabilityRank(member) }))
      .filter((candidate) => candidate.rank !== null && candidate.details.available_now && !candidate.member.current_job)
      .sort((left, right) => left.details.assignment_score - right.details.assignment_score || left.index - right.index);
  };

  const breakdownCustomerLinkFromRecord = async (record = {}) => {
    const customerId = String(record.customer_id || "").trim();
    const phone = phoneDigits(record.phone || record.caller_mobile || record.caller_phone || record.customer_phone || "");
    const [customers, inquiries] = await Promise.all([
      readCollection("customers"),
      readCollection("sales_inquiries")
    ]);
    const match = customers.find((item) => String(item.id || "") === customerId) ||
      inquiries.find((item) => String(item.customer_id || item.id || item.enquiry_no || "") === customerId) ||
      (phone ? customers.find((item) => phoneDigits(item.phone || item.mobile || item.whatsapp_no || "") === phone) : null) ||
      (phone ? inquiries.find((item) => phoneDigits(item.phone || item.mobile || item.whatsapp_no || "") === phone) : null);
    if (!match) return {};
    const resolvedCustomerId = String(match.customer_id || match.id || match.enquiry_no || customerId).trim();
    return {
      customer_id: resolvedCustomerId,
      source_inquiry_id: String(record.source_inquiry_id || match.source_inquiry_id || match.enquiry_no || "").trim(),
      customer: String(match.name || match.customer || match.lead_name || record.customer || resolvedCustomerId).trim(),
      customer_phone: String(record.customer_phone || match.phone || match.whatsapp_no || "").trim(),
      phone: String(record.phone || match.phone || match.whatsapp_no || "").trim(),
      customer_address: String(match.address || match.site_address || match.site || record.customer_address || "").trim(),
      location: String(record.location || match.address || match.site_address || match.site || "").trim()
    };
  };

  const saveWaitingBreakdown = async (record, reason = "All Breakdown engineers are busy; waiting for the next available engineer.") => {
    const breakdowns = await readCollection("breakdowns");
    const existingIndex = breakdowns.findIndex((item) =>
      String(item.id || "") === String(record.id || "") ||
      String(item.source_discord_message_id || "") === String(record.source_discord_message_id || "")
    );
    const existing = existingIndex >= 0 ? breakdowns[existingIndex] : {};
    const customerLink = await breakdownCustomerLinkFromRecord({ ...existing, ...record });
    const saved = {
      ...existing,
      ...record,
      ...customerLink,
      scheduled_engineer: "",
      engineer: "",
      assigned_to: "",
      technician: "",
      engineer_availability: "Waiting for available engineer",
      assignment_source: "waiting-for-available-engineer",
      waiting_for_engineer: true,
      waiting_reason: reason,
      status: "Waiting for Engineer",
      created_at: existing.created_at || record.created_at || now(),
      updated_at: now()
    };
    if (existingIndex >= 0) breakdowns[existingIndex] = saved;
    else breakdowns.unshift(saved);
    await writeCollection("breakdowns", breakdowns);
    return saved;
  };

  const selectEngineerForBreakdown = async (record, breakdowns, existing = {}) => {
    if (existing.assignment_source === "manual" && String(existing.engineer || existing.assigned_to || "").trim()) {
      const engineer = String(existing.engineer || existing.assigned_to).trim();
      return { engineer, availability: String(existing.engineer_availability || existing.availability || "Manually assigned").trim(), source: "manual" };
    }

    if (existing.assignment_source === "openclaw-judgement" && String(existing.engineer || existing.assigned_to || existing.technician || "").trim()) {
      const engineer = String(existing.engineer || existing.assigned_to || existing.technician).trim();
      return {
        engineer,
        availability: String(existing.engineer_availability || "OpenClaw selected").trim(),
        source: "openclaw-judgement"
      };
    }

    if (record.assignment_source === "openclaw-judgement" && String(record.engineer || record.assigned_to || record.technician || "").trim()) {
      const requestedEngineer = String(record.engineer || record.assigned_to || record.technician).trim();
      const team = await readAssignableStaff();
      const teamMember = team.find((member) => String(member.name || "").trim().toLowerCase() === requestedEngineer.toLowerCase());
      const state = await readState();
      state.discord_breakdown_last_openclaw_engineer = teamMember ? String(teamMember.name || "").trim() : requestedEngineer;
      await writeState(state);
      return {
        engineer: teamMember ? String(teamMember.name || "").trim() : requestedEngineer,
        availability: String(record.engineer_availability || teamMember?.availability || "OpenClaw selected").trim(),
        source: "openclaw-judgement"
      };
    }

    const team = await readAssignableStaff();
    const candidates = team
      .map((member, index) => ({ member, index, rank: availabilityRank(member) }))
      .filter((candidate) => candidate.rank !== null && String(candidate.member.name || "").trim());
    if (!candidates.length) {
      const fallback = String(record.engineer || record.assigned_to || record.technician || "").trim();
      return { engineer: fallback, availability: String(record.engineer_availability || "Assigned").trim(), source: "openclaw-fallback" };
    }

    const state = await readState();
    const lastEngineer = String(state.discord_breakdown_last_engineer || "").trim().toLowerCase();
    const loads = activeBreakdownLoad(breakdowns);
    const sorted = candidates.slice().sort((left, right) => {
      const leftName = String(left.member.name || "").trim().toLowerCase();
      const rightName = String(right.member.name || "").trim().toLowerCase();
      const leftDetails = staffAvailabilityDetails(left.member, loads, state);
      const rightDetails = staffAvailabilityDetails(right.member, loads, state);
      const leftScore = (left.rank * 100) + leftDetails.assignment_score + (leftName === lastEngineer ? 1 : 0);
      const rightScore = (right.rank * 100) + rightDetails.assignment_score + (rightName === lastEngineer ? 1 : 0);
      return leftScore - rightScore || left.index - right.index;
    });
    const selected = sorted[0].member;
    const engineer = String(selected.name || "").trim();
    state.discord_breakdown_last_engineer = engineer;
    await writeState(state);
    return {
      engineer,
      availability: String(selected.availability || "Assigned").trim(),
      source: "portal-roster"
    };
  };

  const upsertBreakdown = async (record) => {
    if (!record?.id) return { changed: false, record: null };
    const breakdowns = await readCollection("breakdowns");
    const index = breakdowns.findIndex((item) =>
      String(item.id || "") === record.id ||
      String(item.source_discord_message_id || "") === record.source_discord_message_id
    );
    const existing = index >= 0 ? breakdowns[index] : {};
    const parsedEngineer = String(record.engineer || record.assigned_to || record.technician || "").trim();
    if (!record.assignment_source && record.source_bot_message_id && parsedEngineer) {
      record.assignment_source = "openclaw-judgement";
    }
    const assignment = await selectEngineerForBreakdown(record, breakdowns, existing);
    const selectedEngineer = assignment.engineer || parsedEngineer;
    const saved = {
      ...existing,
      ...record,
      original_openclaw_engineer: existing.original_openclaw_engineer || parsedEngineer,
      assignment_source: assignment.source,
      waiting_for_engineer: false,
      waiting_reason: "",
      scheduled_engineer: selectedEngineer,
      engineer: selectedEngineer,
      assigned_to: selectedEngineer,
      technician: selectedEngineer,
      engineer_availability: assignment.availability || record.engineer_availability || existing.engineer_availability || "Assigned",
      status: selectedEngineer ? "Scheduled" : (record.status || existing.status || "Open"),
      created_at: existing.created_at || record.created_at,
      updated_at: now()
    };
    if (index >= 0) breakdowns[index] = saved;
    else breakdowns.unshift(saved);
    await writeCollection("breakdowns", breakdowns);

    if (selectedEngineer) {
      const team = await readCollection("install_team");
      const previousEngineer = String(existing.engineer || existing.assigned_to || "").trim().toLowerCase();
      const selectedEngineerKey = selectedEngineer.toLowerCase();
      const previousIndex = team.findIndex((member) => String(member.name || "").trim().toLowerCase() === previousEngineer);
      if (previousIndex >= 0 && previousEngineer !== selectedEngineerKey && String(team[previousIndex].current_job || "") === record.id) {
        team[previousIndex] = {
          ...team[previousIndex],
          current_job: "",
          availability: "Available",
          updated_at: now()
        };
      }
      const teamIndex = team.findIndex((member) => String(member.name || "").trim().toLowerCase() === selectedEngineerKey);
      if (teamIndex >= 0) {
        team[teamIndex] = {
          ...team[teamIndex],
          availability: "Scheduled",
          current_job: record.id,
          updated_at: now()
        };
        await writeCollection("install_team", team);
      }
    }
    return { changed: true, record: saved };
  };

  const assignWaitingBreakdowns = async () => {
    const breakdowns = await readCollection("breakdowns");
    const waiting = breakdowns
      .filter((item) => item.waiting_for_engineer || String(item.status || "").toLowerCase() === "waiting for engineer")
      .filter((item) => !String(item.engineer || item.assigned_to || item.scheduled_engineer || item.technician || "").trim());
    const assigned = [];
    for (const item of waiting) {
      const latestBreakdowns = await readCollection("breakdowns");
      const available = await availableBreakdownEngineers(latestBreakdowns);
      if (!available.length) break;
      const engineer = String(available[0].member.name || "").trim();
      const result = await upsertBreakdown({
        ...item,
        scheduled_engineer: engineer,
        engineer,
        assigned_to: engineer,
        technician: engineer,
        engineer_availability: available[0].details.availability_summary || "Available now",
        assignment_source: "auto-assigned-after-wait",
        status: "Scheduled"
      });
      if (result.record) {
        const reply = formatAutoAssignedReply(result.record);
        const notification = typeof notifyAutoAssignedBreakdown === "function"
          ? await notifyAutoAssignedBreakdown(result.record, reply)
          : { ok: false, error: "No auto-assignment notification handler configured." };
        assigned.push({ ...result.record, auto_assignment_reply: reply, auto_assignment_notification: notification });
      }
    }
    return assigned;
  };

  const sync = async ({ force = false, limit = config.limit } = {}) => {
    // WARNING: This sync intentionally reads one latest message from OpenClaw session history; direct Discord REST fetch was removed.
    const channelId = await discordChannelId();
    if (!channelId) {
      const diagnostics = discordConfigurationDiagnostics(channelId, "");
      const lookup = diagnostics.target_lookup_fetch;
      const lookupText = lookup?.url
        ? ` Target lookup fetch: POST ${lookup.url} tool=${lookup.tool} session=${lookup.sessionKey} key=${lookup.key}.`
        : "";
      const targetText = diagnostics.target ? ` Target value: ${diagnostics.target}.` : " Target value was not found.";
      const returnedText = lookup?.returned ? ` Target lookup returned: ${JSON.stringify(lookup.returned)}.` : "";
      return {
        ok: false,
        imported: 0,
        message: `Discord breakdown channel is not configured. ${diagnostics.openclaw_connection}${lookupText}${targetText}${returnedText}`.replace(/\s+/g, " ").trim(),
        diagnostics
      };
    }
    const state = await readState();
    const cursors = state.discord_cursors && typeof state.discord_cursors === "object" ? state.discord_cursors : {};
    const cursor = String(cursors.breakdown_last_message_id || "");
    const history = await openClawHistoryMessages({ channelId, limit: Math.max(Number(limit || 1), 1) });
    if (!history.ok) {
      const returned = history.historyResult?.returned || history.listResult?.returned || { ok: false, error: history.message };
      return {
        ok: false,
        imported: 0,
        status: history.historyResult?.status || history.listResult?.status || null,
        message: `${history.message} OpenClaw history returned: ${JSON.stringify(returned)}. ${openClawConnectionTriedMessage(config.openClawUrl)}`.replace(/\s+/g, " ").trim(),
        openclaw_history: {
          sessionKey: history.sessionKey,
          list_returned: history.listResult?.returned,
          history_returned: history.historyResult?.returned
        }
      };
    }
    const ordered = history.messages
      .map((message, index) => ({
        id: openClawMessageId(message, index),
        content: message.content,
        embeds: Array.isArray(message.raw?.embeds) ? message.raw.embeds : [],
        role: message.role,
        raw: message.raw,
        timestamp: message.timestamp
      }))
      .sort((a, b) => idGreaterThan(a.id, b.id) ? 1 : -1);
    const imported = [];
    let newestId = cursor;
    const candidates = ordered.filter((message) => force || !cursor || idGreaterThan(String(message.id || ""), cursor));
    const latest = candidates[candidates.length - 1];
    for (const message of latest ? [latest] : []) {
      const messageId = String(message.id || "");
      let record = parseConfirmation(message);
      if (!record) {
        const parsed = parseHumanBreakdownMessage({
          id: messageId,
          message_id: messageId,
          discord_message_id: messageId,
          text: message.content,
          content: message.content,
          channel: channelId ? `channel:${channelId}` : "discord"
        });
        if (parsed.unit || parsed.fault || parsed.issue) record = parsed;
      }
      if (record) {
        if (!record.id) {
          const breakdowns = await readCollection("breakdowns");
          record.id = nextRecordId(breakdowns, "BRK");
        }
        const result = await upsertBreakdown(record);
        if (result.changed) imported.push(result.record);
      }
      if (idGreaterThan(messageId, newestId)) newestId = messageId;
    }
    if (newestId && idGreaterThan(newestId, cursor)) {
      state.discord_cursors = { ...cursors, breakdown_last_message_id: newestId };
      await writeState(state);
    }
    return { ok: true, imported: imported.length, records: imported, openclaw_session: history.sessionKey };
  };

  const createFromDiscordMessage = async (body = {}) => {
    const incoming = parseHumanBreakdownMessage(body);
    if (!incoming.source_discord_message_id) return { ok: false, status: 400, message: "Discord message id is required." };
    if (!incoming.unit && !incoming.fault) return { ok: false, status: 400, message: "Breakdown message text is required." };
    const openClawEngineer = selectedEngineerFromBody(body);
    const openClawAvailability = String(body.engineer_availability || body.availability || "").trim();
    const breakdowns = await readCollection("breakdowns");
    const existing = breakdowns.find((item) => String(item.source_discord_message_id || "") === incoming.source_discord_message_id);
    if (!openClawEngineer && !existing) {
      const available = await availableBreakdownEngineers(breakdowns);
      if (!available.length) {
        const waitingRecord = await saveWaitingBreakdown({
          ...incoming,
          id: nextRecordId(breakdowns, "BRK")
        });
        const reply = `${waitingRecord.site || waitingRecord.location || waitingRecord.customer || "The breakdown"} is logged and waiting because all Breakdown engineers are busy; it will be assigned automatically when an engineer becomes available.`;
        return {
          ok: true,
          waiting_for_engineer: true,
          record: waitingRecord,
          reply,
          summary: reply
        };
      }
      const reason = "Choose an available scheduled_engineer from /api/openclaw/breakdown/available-context and try again.";
      return {
        ok: false,
        status: 409,
        retry_required: true,
        available_engineer_required: true,
        message: reason,
        reply: reason
      };
    }
    if (openClawEngineer) {
      const team = await readAssignableStaff();
      const teamMember = team.find((member) => String(member.name || "").trim().toLowerCase() === openClawEngineer.toLowerCase());
      if (!teamMember) {
        const reason = `${openClawEngineer} is not in the Breakdown dispatch staff list; choose a Breakdown engineer from /api/openclaw/breakdown/available-context and try again.`;
        return {
          ok: false,
          status: 409,
          retry_required: true,
          engineer_not_in_breakdown_roster: true,
          scheduled_engineer: openClawEngineer,
          message: reason,
          reply: reason
        };
      }
      const busyJob = String(teamMember?.current_job || "").trim();
      const existingId = String(existing?.id || "").trim();
      const busyJobIsSameRecord = Boolean(existingId && busyJob === existingId);
      const otherBreakdowns = existing
        ? breakdowns.filter((item) =>
            String(item.id || "") !== existingId &&
            String(item.source_discord_message_id || "") !== incoming.source_discord_message_id
          )
        : breakdowns;
      const busyDetails = teamMember ? staffAvailabilityDetails(teamMember, activeBreakdownLoad(otherBreakdowns)) : null;
      if (teamMember && ((!busyJobIsSameRecord && busyJob) || busyDetails?.busy || !busyDetails?.available_now)) {
        const available = await availableBreakdownEngineers(otherBreakdowns);
        if (!available.length && !existing) {
          const waitingRecord = await saveWaitingBreakdown({
            ...incoming,
            id: nextRecordId(breakdowns, "BRK"),
            original_openclaw_engineer: openClawEngineer
          });
          const reply = `Ok, ${waitingRecord.site || waitingRecord.location || waitingRecord.customer || "the breakdown"} is logged and waiting because all Breakdown engineers are busy; it will be assigned automatically when an engineer becomes available.`;
          return {
            ok: true,
            waiting_for_engineer: true,
            engineer_busy: true,
            scheduled_engineer: openClawEngineer,
            record: waitingRecord,
            reply,
            summary: reply
          };
        }
        const reason = busyJob
          ? `${openClawEngineer} is busy on ${busyJob}; choose a different available engineer and try again.`
          : `${openClawEngineer} is not available now; choose a different available engineer and try again.`;
        return {
          ok: false,
          status: 409,
          retry_required: true,
          engineer_busy: true,
          scheduled_engineer: openClawEngineer,
          current_job: busyJob,
          message: reason,
          reply: reason
        };
      }
    }
    const preserveExisting = existing ? {
      ...(body.unit === undefined ? { unit: existing.unit || "" } : {}),
      ...(body.site === undefined && body.location === undefined ? {
        site: existing.site || existing.location || "",
        location: existing.location || existing.site || "",
        customer: existing.customer || existing.site || existing.location || ""
      } : {}),
      ...(body.fault === undefined && body.issue === undefined ? {
        fault: existing.fault || existing.issue || "",
        issue: existing.issue || existing.fault || ""
      } : {}),
      ...(body.phone === undefined && body.caller_mobile === undefined && body.caller_phone === undefined ? {
        phone: existing.phone || "",
        caller_mobile: existing.caller_mobile || existing.phone || ""
      } : {})
    } : {};
    const record = {
      ...incoming,
      ...preserveExisting,
      ...(openClawEngineer ? {
        scheduled_engineer: openClawEngineer,
        engineer: openClawEngineer,
        assigned_to: openClawEngineer,
        technician: openClawEngineer,
        engineer_availability: openClawAvailability,
        assignment_source: "openclaw-judgement"
      } : {}),
      id: existing?.id || nextRecordId(breakdowns, "BRK")
    };
    const customerLink = await breakdownCustomerLinkFromRecord({ ...existing, ...record });
    const result = await upsertBreakdown({ ...record, ...customerLink });
    return {
      ok: true,
      record: result.record,
      reply: formatBreakdownChannelReply(result.record),
      summary: formatBreakdownSummary(result.record)
    };
  };

  const getAssignmentContext = async (body = {}) => {
    const incoming = parseHumanBreakdownMessage(body);
    if (!incoming.unit && !incoming.fault) return { ok: false, status: 400, message: "Breakdown message text is required." };
    const [team, breakdowns, state, supervisor] = await Promise.all([
      readAssignableStaff(),
      readCollection("breakdowns"),
      readState(),
      readBreakdownSupervisor()
    ]);
    const loads = activeBreakdownLoad(breakdowns);
    const activeBreakdowns = breakdowns
      .filter((item) => !["closed", "resolved", "done", "cancelled"].includes(String(item.status || "").trim().toLowerCase()))
      .slice(0, 12)
      .map((item) => ({
        id: item.id,
        unit: item.unit,
        site: item.site || item.location,
        status: item.status,
        priority: item.priority,
        engineer: item.engineer || item.assigned_to || item.technician
      }));
    const engineers = team
      .filter((member) => String(member.name || "").trim())
      .map((member) => {
        const name = String(member.name || "").trim();
        const details = staffAvailabilityDetails(member, loads, state);
        const rank = availabilityRank(member);
        return {
          name,
          availability: member.availability || "",
          shift: member.shift || "",
          availability_summary: details.availability_summary,
          current_job: member.current_job || "",
          active_breakdown_load: details.active_breakdown_load,
          selectable: rank !== null,
          selection_hint: rank === null ? "Do not assign unless explicitly necessary." : (rank === 0 ? "Best availability." : "Assignable with caution.")
        };
      });
    return {
      ok: true,
      report: incoming,
      last_openclaw_engineer: state.discord_breakdown_last_openclaw_engineer || "",
      supervisor: supervisor ? {
        name: supervisor.name || "",
        title: supervisor.title || "",
        department: supervisor.department || ""
      } : null,
      dispatch_staff_count: team.length,
      available_engineer_count: engineers.filter((member) => member.selectable).length,
      engineers,
      active_breakdowns: activeBreakdowns,
      guidance: [
        "Choose the scheduled engineer only from the Breakdown dispatch staff in engineers.",
        "Do not copy a prior transcript assignment.",
        "Avoid assigning the same engineer repeatedly when another selectable engineer has a lower or equal load.",
        "After choosing, POST to /api/openclaw/breakdown/from-discord with scheduled_engineer set to the chosen engineer."
      ]
    };
  };

  const getAvailableAssignmentContext = async (body = {}) => {
    const incoming = parseHumanBreakdownMessage(body);
    if (!incoming.unit && !incoming.fault) return { ok: false, status: 400, message: "Breakdown message text is required." };
    const [team, breakdowns, state, supervisor] = await Promise.all([
      readAssignableStaff(),
      readCollection("breakdowns"),
      readState(),
      readBreakdownSupervisor()
    ]);
    const loads = activeBreakdownLoad(breakdowns);
    const engineers = team
      .filter((member) => String(member.name || "").trim())
      .map((member, index) => ({ ...staffAvailabilityDetails(member, loads, state), index }))
      .filter((member) => member.available_now && !member.current_job)
      .sort((left, right) => left.assignment_score - right.assignment_score || left.index - right.index)
      .map(({ index, ...member }) => ({
        ...member,
        selectable: true,
        selection_hint: member.shift
          ? `Available now; include shift in judgement (${member.availability_summary}).`
          : "Available now."
      }));
    return {
      ok: true,
      report: incoming,
      last_openclaw_engineer: state.discord_breakdown_last_openclaw_engineer || "",
      supervisor: supervisor ? {
        name: supervisor.name || "",
        title: supervisor.title || "",
        department: supervisor.department || ""
      } : null,
      dispatch_staff_count: team.length,
      available_engineer_count: engineers.length,
      engineers,
      guidance: [
        "Only choose scheduled_engineer from this Breakdown dispatch engineers list.",
        "If available_engineer_count is 0 or engineers is empty, this is still an actionable breakdown: call /api/openclaw/breakdown/from-discord without scheduled_engineer so FUZI saves it as Waiting for Engineer.",
        "This endpoint excludes supervisors, non-Breakdown staff, engineers with current_job, and busy/unavailable status.",
        "Use assignment_score, active_breakdown_load, and shift details such as 'Available now - Shift 10:00 AM - 7:00 PM' when deciding.",
        "If /from-discord says the selected engineer is busy, call this endpoint again and choose a different available engineer."
      ]
    };
  };

  return { assignWaitingBreakdowns, createFromDiscordMessage, getAssignmentContext, getAvailableAssignmentContext, sync };
}

function normalizedOpsRecord(record, prefix, index) {
  return {
    id: record.id || `${prefix}-LEGACY-${String(index + 1).padStart(3, "0")}`,
    ...record
  };
}

async function ensureRenewalCustomerLinks() {
  const state = await readOperationsState();
  const renewals = Array.isArray(state.renewals) ? state.renewals : [];
  if (!renewals.length) return state;

  const customers = await readJson(listFiles.customers, []);
  const now = new Date().toISOString();
  let changedRenewals = false;

  const matchCustomer = (renewal) => {
    const customerId = String(renewal.customer_id || "").trim();
    if (customerId) {
      const byId = customers.find((customer) => String(customer.id) === customerId);
      if (byId) return byId;
    }
    const label = normalizedLookup(renewal.customer || renewal.building || renewal.site || renewal.name);
    if (!label) return null;
    return customers.find((customer) => {
      const fields = [customer.name, customer.company, customer.building, customer.site, customer.site_address, customer.address];
      return fields.some((field) => {
        const candidate = normalizedLookup(field);
        return candidate && (candidate === label || candidate.includes(label) || label.includes(candidate));
      });
    }) || null;
  };

  renewals.forEach((renewal, index) => {
    const label = String(renewal.customer || renewal.building || renewal.site || renewal.name || "").trim();
    if (!label) return;
    let customer = matchCustomer(renewal);
    if (!customer) return;
    const normalized = normalizedOpsRecord(renewal, operationsPrefixes.renewals, index);
    const linkedRenewal = {
      ...renewal,
      id: renewal.id || normalized.id,
      customer_id: customer.id,
      customer: customer.name,
      building: renewal.building || customer.name,
      contact_email: renewal.contact_email || customer.email || "",
      contact_phone: renewal.contact_phone || customer.phone || "",
      status: renewal.status || "Open",
      updated_at: renewal.updated_at || now
    };
    if (JSON.stringify(linkedRenewal) !== JSON.stringify(renewal)) {
      renewals[index] = linkedRenewal;
      changedRenewals = true;
    }
  });

  if (changedRenewals) {
    state.renewals = renewals;
    await writeOperationsState(state);
  }
  return state;
}

async function updateOperationsRecord(listKey, id, body, res) {
  const state = await readOperationsState();
  const records = Array.isArray(state[listKey]) ? state[listKey] : [];
  const prefix = operationsPrefixes[listKey] || listKey.toUpperCase();
  const index = records.findIndex((record, i) => normalizedOpsRecord(record, prefix, i).id === id);
  if (index < 0) return res.status(404).json({ ok: false, message: "Record not found." });
  const previousRecord = normalizedOpsRecord(records[index], prefix, index);
  const actionStatus = defaultStatusForAction(body?.action);
  records[index] = {
    ...records[index],
    ...cleanPayload(body),
    ...(actionStatus ? { status: actionStatus, state: actionStatus } : {}),
    updated_at: new Date().toISOString()
  };
  state[listKey] = records;
  await writeOperationsState(state);
  const nextRecord = normalizedOpsRecord(records[index], prefix, index);
  await appendAuditLog({ user: res.req?.user || {}, collection: listKey, recordId: nextRecord.id, action: "update", before: previousRecord, after: nextRecord });
  res.json({ ok: true, record: nextRecord });
}

async function listCollection(routeName, res, user = res.req?.user || {}) {
  const config = resolveCollection(routeName);
  if (!config) return res.status(404).json({ ok: false, message: "Unknown portal module." });
  const records = await readJson(config.file, config.singleton ? {} : []);
  const serviceScope = await serviceTeamScopeForUser(user);
  const scopedRecords = applyServiceManagerCollectionScope(config.key, records, serviceScope);
  const visibleRecords = Array.isArray(scopedRecords)
    ? scopedRecords.filter((record) => {
      if (routeName === "service" && !canManageServiceRecords(user)) return serviceRecordAssignedToUser(record, user);
      if (routeName === "attendance" && !canManageStaffAttendance(user)) return attendanceRecordBelongsToUser(record, user);
      return true;
    })
    : scopedRecords;
  return res.json({ ok: true, [config.key]: publicRecords(config.key, Array.isArray(visibleRecords) ? visibleRecords : [visibleRecords]), records: visibleRecords });
}

async function linkedCrmCustomerPayload(body, res, recordLabel = "service record") {
  const customerId = String(body?.customer_id || "").trim();
  if (!customerId) {
    res.status(400).json({ ok: false, message: `Select a CRM customer before saving a ${recordLabel}.` });
    return null;
  }
  const customers = await readJson(listFiles.customers, []);
  const inquiries = await readJson(listFiles.sales_inquiries, []);
  const customer = customers.find((item) => String(item.id || "") === customerId) ||
    inquiries.find((item) => String(item.customer_id || item.id || item.enquiry_no || "") === customerId);
  if (!customer) {
    res.status(400).json({ ok: false, message: "Selected CRM customer was not found." });
    return null;
  }
  const customerName = String(customer.name || customer.customer || customer.lead_name || customer.contact_name || customerId).trim();
  return {
    customer_id: customerId,
    source_inquiry_id: String(body?.source_inquiry_id || customer.id || customer.enquiry_no || "").trim(),
    customer: customerName,
    phone: String(body?.phone || customer.phone || customer.whatsapp_no || "").trim(),
    site: String(body?.site || customer.site || customer.site_address || customer.address || "").trim(),
    crm_linked_at: new Date().toISOString(),
  };
}

async function syncCustomerServiceCounts(customerIds = []) {
  const ids = Array.from(new Set(customerIds.map((id) => String(id || "").trim()).filter(Boolean)));
  if (!ids.length) return;
  const [customers, serviceRecords, breakdowns] = await Promise.all([
    readJson(listFiles.customers, []),
    readJson(listFiles.service_records, []),
    readJson(listFiles.breakdowns, [])
  ]);
  let changed = false;
  const now = new Date().toISOString();
  const nextCustomers = customers.map((customer) => {
    const id = String(customer.id || customer.customer_id || "").trim();
    if (!ids.includes(id)) return customer;
    const serviceCount = serviceRecords.filter((service) => String(service.customer_id || "").trim() === id).length;
    const breakdownCount = breakdowns.filter((breakdown) => String(breakdown.customer_id || "").trim() === id).length;
    const count = serviceCount + breakdownCount;
    if (Number(customer.service_count || 0) === count && String(customer.last_service_counted_at || "")) return customer;
    changed = true;
    return { ...customer, service_count: count, services_done: count, last_service_counted_at: now, updated_at: now };
  });
  if (changed) await writeJson(listFiles.customers, nextCustomers);
}

function serviceRecordMatchesCustomer(record = {}, customer = {}) {
  const customerId = String(customer.id || customer.customer_id || "").trim();
  const customerName = crmNameKey(customer.name || customer.customer || customer.customer_name || "");
  const recordCustomerId = String(record.customer_id || "").trim();
  const recordCustomerName = crmNameKey(record.customer || record.customer_name || record.building || "");
  return Boolean(
    (customerId && recordCustomerId && customerId === recordCustomerId) ||
    (customerName && recordCustomerName && customerName === recordCustomerName)
  );
}

function defaultServiceDateForCustomer(customer = {}) {
  const candidates = [
    customer.next_service_date,
    customer.next_follow_up,
    customer.service_start_date,
    customer.installed_date,
    customer.installation_date
  ];
  const today = new Date().toISOString().slice(0, 10);
  for (const value of candidates) {
    const date = String(value || "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date < today ? today : date;
  }
  return today;
}

function autoServiceRecordForCustomer(customer = {}, records = []) {
  const now = new Date().toISOString();
  const customerId = String(customer.id || customer.customer_id || "").trim();
  const customerName = String(customer.name || customer.customer || customer.customer_name || customerId).trim();
  const scheduledDate = defaultServiceDateForCustomer(customer);
  const id = nextId(records, "SVC");
  return {
    id,
    service_number: id,
    job_number: id,
    customer_id: customerId,
    customer: customerName,
    phone: String(customer.phone || customer.whatsapp_no || "").trim(),
    site: String(customer.address || customer.site || customer.site_address || "").trim(),
    unit: String(customer.unit || customer.lift_unit || "").trim(),
    service_type: "Preventive Maintenance",
    issue_category: "Scheduled preventive service",
    scheduled_date: scheduledDate,
    next_service_date: scheduledDate,
    assigned_engineer: String(customer.assigned_engineer || customer.service_engineer || customer.account_owner || "").trim(),
    technician: String(customer.assigned_engineer || customer.service_engineer || "").trim(),
    status: "Scheduled",
    notes: "Auto-created so every CRM customer has a linked service job.",
    assignment_source: "auto-customer-service-backfill",
    created_at: now,
    updated_at: now
  };
}

async function ensureServiceJobsForCustomers(targetCustomerIds = []) {
  const [customers, serviceRecords] = await Promise.all([
    readJson(listFiles.customers, []),
    readJson(listFiles.service_records, [])
  ]);
  if (!Array.isArray(customers) || !customers.length) return { created: 0, customer_ids: [] };
  const requestedIds = new Set(targetCustomerIds.map((id) => String(id || "").trim()).filter(Boolean));
  const eligibleCustomers = requestedIds.size
    ? customers.filter((customer) => requestedIds.has(String(customer.id || customer.customer_id || "").trim()))
    : customers;
  const nextServiceRecords = [...serviceRecords];
  const createdCustomerIds = [];
  for (const customer of eligibleCustomers) {
    const customerId = String(customer.id || customer.customer_id || "").trim();
    if (!customerId) continue;
    if (nextServiceRecords.some((record) => serviceRecordMatchesCustomer(record, customer))) continue;
    const record = autoServiceRecordForCustomer(customer, nextServiceRecords);
    nextServiceRecords.unshift(record);
    createdCustomerIds.push(customerId);
  }
  if (!createdCustomerIds.length) return { created: 0, customer_ids: [] };
  await writeJson(listFiles.service_records, nextServiceRecords);
  await syncCustomerServiceCounts(createdCustomerIds);
  return { created: createdCustomerIds.length, customer_ids: createdCustomerIds };
}

async function siteVisitCrmCustomerPayload(body, res) {
  const customerId = String(body?.customer_id || "").trim();
  if (!customerId) {
    res.status(400).json({ ok: false, message: "Select a CRM customer before saving a site visit report." });
    return null;
  }
  const [customers, inquiries] = await Promise.all([
    readJson(listFiles.customers, []),
    readJson(listFiles.sales_inquiries, [])
  ]);
  const customer = customers.find((item) => String(item.id || "") === customerId);
  const inquiry = !customer ? inquiries.find((item) =>
    String(item.customer_id || "") === customerId ||
    String(item.id || "") === customerId ||
    String(item.enquiry_no || item.source_enquiry_no || "") === customerId
  ) : null;
  const record = customer || inquiry;
  if (!record) {
    res.status(400).json({ ok: false, message: "Site visits must be saved against a CRM customer. Select a customer from CRM before saving." });
    return null;
  }
  const resolvedCustomerId = String(record.customer_id || record.id || customerId).trim();
  return {
    customer_id: resolvedCustomerId,
    customer_name: String(record.name || record.customer || record.lead_name || record.contact_name || resolvedCustomerId).trim(),
    address: String(record.address || record.site_address || record.site || "").trim(),
    site_person_name: String(body?.site_person_name || record.contact_person || record.customer || record.lead_name || record.name || "").trim(),
    site_person_mobile: String(body?.site_person_mobile || record.phone || record.whatsapp_no || "").trim(),
    site_enquiry_no: String(body?.site_enquiry_no || record.enquiry_no || record.source_enquiry_no || "").trim()
  };
}

async function offerCrmCustomerPayload(body, res) {
  const customerId = String(body?.customer_id || "").trim();
  if (!customerId) {
    res.status(400).json({ ok: false, message: "Select a CRM customer before creating an offer." });
    return null;
  }
  const [customers, inquiries] = await Promise.all([
    readJson(listFiles.customers, []),
    readJson(listFiles.sales_inquiries, [])
  ]);
  const customer = customers.find((item) => String(item.id || "") === customerId);
  const inquiry = !customer ? inquiries.find((item) =>
    String(item.customer_id || "") === customerId ||
    String(item.id || "") === customerId ||
    String(item.enquiry_no || item.source_enquiry_no || "") === customerId
  ) : null;
  const record = customer || inquiry;
  if (!record) {
    res.status(400).json({ ok: false, message: "Offers must be linked to a saved CRM customer." });
    return null;
  }
  const resolvedCustomerId = String(record.customer_id || record.id || customerId).trim();
  const sourceInquiryId = String(body?.source_inquiry_id || inquiry?.id || inquiry?.enquiry_no || record.enquiry_no || "").trim();
  return {
    customer_id: resolvedCustomerId,
    source_inquiry_id: sourceInquiryId,
    customer_name: String(record.name || record.customer || record.lead_name || body?.customer_name || resolvedCustomerId).trim(),
    offer_name: String(body?.offer_name || record.name || record.customer || record.lead_name || resolvedCustomerId).trim(),
    customer_phone: String(body?.customer_phone || record.phone || record.whatsapp_no || "").trim(),
    customer_email: String(body?.customer_email || record.email || "").trim(),
    site: String(body?.site || record.address || record.site_address || record.site || "").trim(),
  };
}

async function normalizeOfferPayload(body, res) {
  const customerLink = await offerCrmCustomerPayload(body, res);
  if (!customerLink) return null;
  const payload = cleanPayload(body);
  const allowedOfferInventoryNames = new Set(["guide rail", "bracket"]);
  const inventoryItems = Array.isArray(payload.inventory_items) ? payload.inventory_items.map((item) => ({
    item_id: String(item?.item_id || item?.id || "").trim(),
    name: String(item?.name || item?.item || "").trim(),
    description: String(item?.description || item?.specification || "").trim(),
    category: String(item?.category || "").trim(),
    unit: String(item?.unit || "pcs").trim(),
    qty: inventoryNumber(item?.qty ?? item?.quantity, 1),
    actual: item?.actual === undefined || item?.actual === null || String(item?.actual).trim() === "" ? "" : inventoryNumber(item?.actual),
    current_price: inventoryNumber(item?.current_price ?? item?.unit_price ?? item?.sale_price ?? item?.unit_cost),
    purchase_price: inventoryNumber(item?.purchase_price ?? item?.unit_cost),
    price_date: String(item?.price_date || "").trim(),
    vendor: String(item?.vendor || "").trim()
  })).filter((item) => allowedOfferInventoryNames.has(String(item.name || item.item_id).trim().toLowerCase())) : [];
  const inventoryMaterialTotal = inventoryItems.reduce((sum, item) => sum + (item.actual === "" ? item.qty : item.actual) * item.current_price, 0);
  const costPayload = inventoryMaterialTotal && !payload.material_cost ? { ...payload, material_cost: inventoryMaterialTotal } : payload;
  const cost = offerCostSummary(costPayload);
  const measurementKeys = [
    "site_visit_id",
    "site_measurements_source",
    "site_address",
    "pit_size_mm",
    "machine_room_available",
    "floor_height_profile",
    "site_stops",
    "site_number_of_openings",
    "site_opening_type",
    "door_size_width_mm",
    "door_size_height_mm",
    "car_size_width_mm",
    "car_size_depth_mm",
    "site_capacity_persons",
    "site_capacity_kg",
    "shaft_width_mm",
    "shaft_depth_mm",
    "brick_wall_available",
    "civil_door_height_mm",
    "opening_schedule_summary"
  ];
  const measurementPayload = Object.fromEntries(measurementKeys.map((key) => [key, String(payload[key] || "").trim()]));
  return {
    ...payload,
    ...customerLink,
    ...measurementPayload,
    job_no: String(payload.job_no || "").trim(),
    offer_date: String(payload.offer_date || new Date().toISOString().slice(0, 10)).trim(),
    offer_type: String(payload.offer_type || payload.elevator_type || "Individual").trim(),
    elevator_type: String(payload.elevator_type || payload.offer_type || "Passenger Elevator").trim(),
    status: String(payload.status || payload.lead_status || "Offer Pending").trim(),
    lead_status: String(payload.lead_status || payload.status || "Offer Pending").trim(),
    material_cost: cost.materialCost,
    install_cost: cost.installCost,
    overhead_cost: cost.overheadCost,
    margin_percent: cost.marginPercent,
    margin_amount: cost.marginAmount,
    discount: cost.discount,
    gst_percent: cost.gstPercent,
    gst_amount: cost.gstAmount,
    base_cost: cost.baseCost,
    subtotal: cost.subtotal,
    total_cost: cost.totalCost,
    calculated_total_cost: cost.totalCost,
    payment_terms: String(payload.payment_terms || "40% advance, 50% before dispatch, 10% after installation").trim(),
    delivery_timeline: String(payload.delivery_timeline || "As per final technical approval and material readiness").trim(),
    warranty_terms: String(payload.warranty_terms || "12 months from handover against manufacturing defects").trim(),
    offer_letter_status: String(payload.offer_letter_status || "Prepared").trim(),
    source: String(payload.source || "CRM Offer Manager").trim(),
    offer_source: String(payload.offer_source || "CRM").trim(),
    offer_number: String(payload.offer_number || payload.job_no || "").trim(),
    source_snapshot: payload.source_snapshot && typeof payload.source_snapshot === "object" ? payload.source_snapshot : {},
    expanded_costing_data: payload.expanded_costing_data && typeof payload.expanded_costing_data === "object" ? payload.expanded_costing_data : {},
    costing_source_file: String(payload.costing_source_file || "").trim(),
    inventory_items: inventoryItems,
    inventory_material_total: inventoryMaterialTotal,
    inventory_pricing_source: String(payload.inventory_pricing_source || (inventoryItems.length ? "Inventory current prices" : "")).trim(),
    opening_schedule: Array.isArray(payload.opening_schedule) ? payload.opening_schedule : []
  };
}

function buildOfferLetterHtml(estimate = {}, options = {}) {
  const cost = offerCostSummary(estimate);
  const offerNo = estimate.job_no || estimate.id || "-";
  const offerDate = estimate.offer_date || estimate.created_at || new Date().toISOString().slice(0, 10);
  const customerName = estimate.customer_name || estimate.offer_name || "Customer";
  const customerSite = estimate.site_address || estimate.site || "-";
  const customerPhone = estimate.customer_phone || estimate.phone || "";
  const stops = estimate.site_stops || estimate.stops || "-";
  const openings = estimate.site_number_of_openings || estimate.openings || stops || "-";
  const capacity = estimate.capacity || (estimate.site_capacity_kg ? `${estimate.site_capacity_kg} Kgs.` : "") || (estimate.site_capacity_persons ? `${estimate.site_capacity_persons} passengers` : "-");
  const doorType = estimate.door_type || estimate.site_opening_type || "Center Opening Automatic Door";
  const finish = estimate.finish || "Stainless Steel Hairline Finish";
  const driveType = estimate.drive_type || "VVVF Variable Voltage Variable Frequency";
  const speed = estimate.speed || "1.0 Meter Per Second";
  const motor = estimate.motor || "Traction (Gearless)";
  const floorOpening = `${stops} stops, ${openings} openings${estimate.opening_schedule_summary ? ` (${estimate.opening_schedule_summary})` : ""}`;
  const doorSize = estimate.door_size_width_mm || estimate.door_size_height_mm ? `${estimate.door_size_width_mm || "-"}mm (width) x ${estimate.door_size_height_mm || "-"}mm (height)` : "As per GAD";
  const shaftSize = estimate.shaft_width_mm || estimate.shaft_depth_mm ? `${estimate.shaft_width_mm || "-"}mm (width) x ${estimate.shaft_depth_mm || "-"}mm (depth)` : "As per GAD";
  const carSize = estimate.car_size_width_mm || estimate.car_size_depth_mm ? `${estimate.car_size_width_mm || "-"}mm (w) x ${estimate.car_size_depth_mm || "-"}mm (d) / as per GAD` : "As per GAD";
  const pitDepth = estimate.pit_size_mm ? `${estimate.pit_size_mm} mm` : "As per GAD";
  const machineRoom = String(estimate.machine_room_available || "").toUpperCase() === "Y" ? "Machine room available as per site" : "Top-Machine Room Less";
  const serviceType = estimate.elevator_type || estimate.offer_type || "Passenger";
  const priceText = moneyInr(cost.totalCost);
  const tableRows = (rows) => rows.map(([label, value]) => `<tr><th>${htmlEscape(label)}</th><td>${htmlEscape(value || "-")}</td></tr>`).join("");
  const bulletList = (items) => `<ul>${items.map((item) => `<li>${htmlEscape(item)}</li>`).join("")}</ul>`;
  const specificationRows = [
    ["Service", serviceType],
    ["No. of Elevators", "One (01) no."],
    ["Capacity", capacity],
    ["Speed", speed],
    ["Control", driveType],
    ["Operation", estimate.operation || "Simplex Full Collective"],
    ["Motor", motor],
    ["Floors & Opening", floorOpening],
    ["Door Opening Type", doorType],
    ["Door Opening Size", doorSize],
    ["Hoist-way Size Available", shaftSize],
    ["Car Internal Size", carSize],
    ["Power Supply", "440V AC 50 Hz"],
    ["Lighting Supply", "220 V AC 50 Hz"],
    ["Travel", estimate.floor_height_profile || "As per site and GAD"],
    ["Overhead Required", estimate.overhead_required || "As per GAD"],
    ["Pit Depth Required", pitDepth],
    ["Machine Room Location", machineRoom]
  ];
  const carRows = [
    ["Ceiling / Lighting", estimate.ceiling_lighting || "Stainless Steel Mirror finish with decorative lumasite"],
    ["Car Construction", `${finish} with sheet thickness as per approved specification`],
    ["Car Door", `${finish} small / big vision glass door as selected`],
    ["Flooring", estimate.flooring || "PVC / granite recess as per final scope"]
  ];
  const signalRows = [
    ["Car Operating Panel", "Micro push button in stainless steel hairline Braille panel"],
    ["Hall Button", "Micro push button in stainless steel hairline Braille panel"]
  ];
  const inventoryRows = Array.isArray(estimate.inventory_items) ? estimate.inventory_items.map((item) => [
    item.name || item.item_id || "-",
    item.description || "-",
    item.unit || "pcs",
    item.qty || 1,
    moneyInr(item.current_price || item.unit_price || 0),
    item.actual === undefined || item.actual === null || item.actual === "" ? item.qty || 1 : item.actual
  ]) : [];
  const standardMakesImage = options.standardMakesImage || "/assets/offer/standard-makes.jpg";
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>FUZI Offer ${htmlEscape(estimate.id || "")}</title>
  <style>
    @page { size: A4; margin: 12mm 17mm 18mm; }
    body { font-family: "Times New Roman", Times, serif; color: #111; margin: 0; line-height: 1.32; font-size: 11pt; }
    header { border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 14px; }
    .letterhead { display: grid; grid-template-columns: 72px 1fr; align-items: center; gap: 12px; }
    .brand-mark { width: 64px; height: 64px; border: 3px solid #111; display: grid; place-items: center; font-family: Arial, sans-serif; font-size: 23pt; font-weight: 900; color: #e11b22; letter-spacing: -2px; }
    .brand-name { margin: 0; font-family: Arial, sans-serif; font-size: 21pt; font-weight: 900; letter-spacing: .2px; }
    .brand-rule { height: 4px; background: #e11b22; margin: 4px 0 5px; }
    .brand-meta { margin: 0; font-size: 9.5pt; text-align: left; }
    h1 { margin: 0; font-size: 20pt; letter-spacing: .3px; }
    h2 { margin: 18px 0 8px; font-size: 14pt; text-align: center; text-decoration: underline; }
    h3 { margin: 14px 0 6px; font-size: 12pt; }
    p { margin: 0 0 8px; text-align: justify; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0 12px; }
    td, th { border: 1px solid #333; padding: 5px 7px; text-align: left; vertical-align: top; }
    th { width: 34%; font-weight: 700; background: #f3f3f3; }
    ul, ol { margin-top: 4px; margin-bottom: 10px; padding-left: 24px; }
    li { margin-bottom: 3px; }
    .topline { display: flex; justify-content: space-between; gap: 24px; }
    .company { font-weight: 700; }
    .address-block { margin: 12px 0; font-weight: 700; }
    .subject { margin-top: 10px; }
    .annexure { page-break-before: always; }
    .price { font-weight: 700; }
    .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 36px; margin-top: 32px; }
    .footer { border-top: 1px solid #333; margin-top: 20px; padding-top: 6px; text-align: center; font-size: 9.5pt; }
    .standard-makes { width: 100%; max-width: 520px; display: block; margin: 8px auto 12px; border: 1px solid #ddd; }
    .muted { color: #444; }
  </style>
</head>
<body>
  <header>
    <div class="letterhead">
      <div class="brand-mark">FE</div>
      <div>
        <div class="brand-name">FUZI Classic Elevators Pvt. Ltd.</div>
        <div class="brand-rule"></div>
        <p class="brand-meta">360, Guru Nanak Pura, Raja Park, Jaipur, Rajasthan, India-302004</p>
        <p class="brand-meta">Tele No. 91-141-2620168 | Toll Free 18001028421 | Mobile 09928019671 | Email: atulsinghal@fuzielevators.com</p>
      </div>
    </div>
  </header>
  <div class="topline">
    <div>Ref. No. FUZI/Classic/${htmlEscape(new Date().getFullYear())}-${htmlEscape(String(new Date().getFullYear() + 1).slice(-2))}/${htmlEscape(offerNo)}</div>
    <div>Dated: ${htmlEscape(offerDate)}</div>
  </div>
  <div class="address-block">
    <div>${htmlEscape(customerName)}</div>
    <div>${htmlEscape(customerSite)}</div>
    ${customerPhone ? `<div># ${htmlEscape(customerPhone)}</div>` : ""}
  </div>
  <p class="subject"><strong>Subject:</strong> Supply, Installation, Testing, Commissioning and complete handing over of 01 nos. ${htmlEscape(serviceType)} Elevator for your site.</p>
  <p><strong>Reference:</strong> Personal discussions and site visit reference.</p>
  <p>Dear Sir,</p>
  <p>This refers to the aforementioned subject in line with SITC of one no. elevator. Further, we thank you for extending your valued enquiry to us. We have pleasure to submit our offer for supply, installation, testing, commissioning and complete handing over of FUZI brand elevator in the building at the above address.</p>
  <p>We are FUZI brand business partners and install and maintain FUZI brand elevators in Rajasthan.</p>
  <p>FUZI brand elevators are a perfect blend of performance, function, design technology and safety standards, offering a smooth and comfortable ride through world-class people moving systems.</p>
  <p>Quality, safety and time-bound project delivery are key words of our company. Our motto is to provide safe, reliable and trouble-free elevators and escalators. Customer satisfaction is the slogan of our company and it is our pleasure to serve our valued customers.</p>
  <p>We have enclosed our detailed offer including specifications, features, taxes, duties, price, terms and conditions. Please call us for any clarification or verification if needed.</p>
  <p>We are sure this will receive your favorable consideration and look forward to receiving your valuable order at the earliest.</p>
  <p>We assure you of our best attention and services at all times.</p>
  <p>Thanking you with warm regards,</p>
  <p>Yours Truly,<br>For FUZI Classic Elevators Pvt. Ltd.</p>
  <p style="margin-top:28px;">(Authorized Signatory)</p>
  <p>Encl: As Annexure</p>

  <section class="annexure">
    <h2>ANNEXURE - I</h2>
    <h2>TECHNICAL SPECIFICATIONS SHEET</h2>
    <h3>1. Standard Specifications</h3>
    <table>${tableRows(specificationRows)}</table>
    <h3>2. Elevator Car</h3>
    <table>${tableRows(carRows)}</table>
    <h3>3. Hoist-way Entrance</h3>
    <table>${tableRows([["Landing Doors", `${finish} small / big vision glass doors as selected`]])}</table>
    <h3>4. Signals</h3>
    <table>${tableRows(signalRows)}</table>
    <h3>5. Other Features</h3>
    ${bulletList([
      "Ventilation fan / blower",
      "Emergency light and fan / blower in car",
      "Attendant key function",
      "Luminous car operating panel with digital position and direction indicator",
      "Combined luminous hall position indicator with direction indicators at all floors",
      "Automatic Rescue Device",
      "Overload and over speed governor",
      "Phase reversal and fireman switch",
      "Auto light and fan off",
      "Stainless steel handrail",
      "Music, voice announcement and alarm in car",
      "Multi beam full length infra-red door sensor in case of auto door",
      "Door open and close button in case of auto door",
      "Arrival gong, lift lock function, main / service floor selection and forced door close function"
    ])}
    <h3>Our Standard Makes</h3>
    <img class="standard-makes" src="${standardMakesImage}" alt="FUZI standard makes logos">
    <table>${tableRows([
      ["Drive", "Monarch Make"],
      ["Rope", "Usha Martin Make"],
      ["Motor", "Sharp / Bharat Bijali"],
      ["Guide Rail", "Marazzi Make"],
      ["Auto Door", "Complete cartoon pack original Fermator make, 8 lakh cycle per year tested door"]
    ])}</table>

    <h2>Price</h2>
    <p class="price">Our price for one number ${htmlEscape(capacity)} ${htmlEscape(motor)} elevator for ${htmlEscape(stops)} stops as per Annexure-I with ${htmlEscape(finish)} car and ${htmlEscape(doorType)} serving the above site will be @ ${htmlEscape(priceText)}.</p>
    ${inventoryRows.length ? `<h3>Inventory Pricing Used For Internal Costing</h3><table><tr><th>Item</th><th>Description</th><th>Unit</th><th>QTY</th><th>Current price</th><th>Actual</th></tr>${inventoryRows.map((row) => `<tr>${row.map((cell) => `<td>${htmlEscape(cell)}</td>`).join("")}</tr>`).join("")}</table>` : ""}
    <h3>The above offer is Inclusive of:</h3>
    ${bulletList(["Installation charges along with 12 months warranty from the date of handing over", "Freight up to the site"])}
    <h3>The above offer is Exclusive of:</h3>
    ${bulletList(["Architrave work at all floors", "Separating channel work if applicable", "GST @18%"])}
    <h3>Taxes and Duties</h3>
    <p>The prices quoted above are exclusive of GST. Any variation in the same or addition of new taxes and duties if levied in future shall be in customer scope from the date it is made effective.</p>
    <h3>Payment Terms</h3>
    <p>${htmlEscape(estimate.payment_terms || "1) 40% of the contract value advance along with the order. 2) 50% of the contract value on intimation of material readiness at factory. 3) 10% of the contract value along with all taxes at the time of handing over of lift.")}</p>
    <h3>Delivery & Installation Schedule</h3>
    <p>${htmlEscape(estimate.delivery_timeline || "GAD will be submitted within ten days from receipt of confirmed written order with advance payment. Material shall be delivered after 50 days from submission of GAD and material payment clearance. Installation work shall be completed within 40 days excluding customer scope of work.")}</p>
    <h3>Maintenance</h3>
    <p>${htmlEscape(estimate.warranty_terms || "Our offer includes 12 months free maintenance at site including all parts exclusive consumable parts such as fan, blower, bulb, tube light, battery and PVC flooring.")}</p>
    <h3>CAMC</h3>
    <p>We undertake CAMC including spare parts, excluding consumable parts such as fan, blower, bulb, tube light, battery and PVC flooring, @ 5% of the total contract value excluding taxes.</p>
    <h3>Customer Scope of Work</h3>
    ${bulletList([
      "Lift pit should be as per GAD with waterproof arrangements",
      "Shaft lighting as per GAD should be provided by the customer",
      "Shaft should be whitewashed by the customer",
      "Load hook and trap door as per GAD should be provided by the customer",
      "Proper stairs should be provided to enter the machine room where applicable",
      "3 phase and separate single phase power supply along with MCB and cable",
      "Double earthing in the machine room",
      "Lockable store should be provided to keep lift material near the shaft at ground floor, approximately 40 sq ft",
      "All kinds of civil work"
    ])}
    ${estimate.notes ? `<h3>Offer Notes</h3><p>${htmlEscape(estimate.notes)}</p>` : ""}
    <div class="signature-grid">
      <div>Signature of the Customer</div>
      <div>For FUZI Classic Elevators Pvt. Ltd.<br><br>Atul Singhal<br>Mobile: 09928019671</div>
    </div>
    <h3>Bank Details</h3>
    <table>${tableRows([
      ["Account Name", "FUZI Classic Elevators Private Limited"],
      ["HDFC Bank", "Account No. 59251870000001, Branch Adarsh Nagar Jaipur, IFSC HDFC0005187"],
      ["State Bank of India", "Account No. 61091952889, Branch Adarsh Nagar Jaipur, IFSC SBIN0031022"],
      ["CIN", "U29150RJ2009PTC029448"]
    ])}</table>
  </section>
  <div class="footer">360, Guru Nanak Pura, Raja Park, Jaipur, Rajasthan, India-302004 | Tele No. 91-141-2620168 | Toll Free 18001028421 | Mobile 09928019671 | Email: atulsinghal@fuzielevators.com</div>
</body>
</html>`;
}

async function buildOfferLetterPdf(estimate = {}) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "fuzi-offer-"));
  const htmlPath = path.join(tempDir, "offer.html");
  const pdfPath = path.join(tempDir, "offer.pdf");
  try {
    const standardMakesDataUrl = await offerAssetDataUrl("standard-makes.jpg", "image/jpeg").catch(() => "/assets/offer/standard-makes.jpg");
    const html = buildOfferLetterHtml(estimate, { standardMakesImage: standardMakesDataUrl });
    await fs.writeFile(htmlPath, html, "utf8");
    const chrome = await chromeExecutablePath();
    if (!chrome) throw new Error("Chrome or Edge is required to generate offer PDFs.");
    await execFileAsync(chrome, [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--print-to-pdf-no-header",
      `--print-to-pdf=${pdfPath}`,
      pathToFileURL(htmlPath).href
    ], { timeout: 30000, windowsHide: true });
    const pdf = await fs.readFile(pdfPath);
    if (!pdf.length) throw new Error("Generated offer PDF is empty.");
    return pdf;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function createCollectionRecord(routeName, body, res) {
  const config = resolveCollection(routeName);
  if (!config) return res.status(404).json({ ok: false, message: "Unknown portal module." });
  if (config.singleton) {
    const existing = await readJson(config.file, {});
    const updated = { ...existing, ...cleanPayload(body), updated_at: new Date().toISOString() };
    await writeJson(config.file, updated);
    await appendAuditLog({ user: res.req?.user || {}, collection: config.key, recordId: config.key, action: "update", before: existing, after: updated });
    return res.json({ ok: true, record: updated, [config.key]: updated });
  }
  const records = await readJson(config.file, []);
  const now = new Date().toISOString();
  const crmLinkedRoute = ["service", "breakdown"].includes(routeName);
  const serviceLink = crmLinkedRoute ? await linkedCrmCustomerPayload(body, res, routeName === "breakdown" ? "breakdown call" : "service record") : {};
  if (crmLinkedRoute && !serviceLink) return;
  const offerPayload = routeName === "estimates" ? await normalizeOfferPayload(body, res) : null;
  if (routeName === "estimates" && !offerPayload) return;
  const paymentPayload = routeName === "payments" ? normalizePaymentPayload(body) : null;
  const tenderPayload = routeName === "tender" ? normalizeTenderPayload(body, {}, records) : null;
  const installationPayload = routeName === "install-jobs" ? normalizeInstallationPayload(body, {}, records) : null;
  const basePayload = offerPayload || paymentPayload || tenderPayload || installationPayload || cleanPayload(body);
  const serviceAssignmentPayload = routeName === "service" ? await autoAssignServicePayload({ ...basePayload, ...serviceLink }, records) : {};
  const serviceScope = routeName === "attendance" ? await serviceTeamScopeForUser(res.req?.user || {}) : null;
  if (serviceScope && !recordMatchesServiceTeamScope(basePayload, serviceScope) && !attendanceRecordIsSelf(basePayload, res.req?.user || {})) {
    return res.status(403).json({ ok: false, message: "Service Manager can mark attendance only for Service team staff." });
  }
  if (routeName === "attendance" && !attendanceRecordBelongsToUser(basePayload, res.req?.user || {})) {
    return res.status(403).json({ ok: false, message: "Staff can create attendance only for themselves." });
  }
  const serviceGenerated = routeName === "service" ? {
    service_number: String(basePayload.service_number || "").trim() || nextId(records, "SVC"),
    breakdown_number: String(basePayload.breakdown_number || "").trim() || nextId(records, "BRK"),
    service_date: String(basePayload.service_date || "").trim() || now,
    date_time: String(basePayload.date_time || "").trim() || now,
  } : {};
  const recordId = nextId(records, config.prefix);
  const offerGenerated = routeName === "estimates" ? {
    job_no: String(basePayload.job_no || "").trim() || recordId,
    offer_number: String(basePayload.offer_number || "").trim() || String(basePayload.job_no || "").trim() || recordId,
  } : {};
  const breakdownGenerated = routeName === "breakdown" ? {
    breakdown_number: String(basePayload.breakdown_number || "").trim() || recordId,
    date_time: String(basePayload.date_time || "").trim() || now,
    breakdown_date: String(basePayload.breakdown_date || "").trim() || now,
  } : {};
  const record = { id: recordId, ...basePayload, ...serviceGenerated, ...offerGenerated, ...breakdownGenerated, ...serviceLink, ...serviceAssignmentPayload, created_at: now, updated_at: now };
  records.unshift(record);
  await writeJson(config.file, records);
  if (["service", "breakdown"].includes(routeName)) await syncCustomerServiceCounts([record.customer_id]);
  await appendAuditLog({ user: res.req?.user || {}, collection: config.key, recordId: record.id, action: "create", before: null, after: record });
  if (routeName === "install-jobs") {
    await logInstallationNotifications(record, {}, res.req?.user || {});
  }
  return res.json({ ok: true, record, [config.key.slice(0, -1) || "record"]: record });
}

async function updateCollectionRecord(routeName, id, body, res) {
  const config = resolveCollection(routeName);
  if (!config) return res.status(404).json({ ok: false, message: "Unknown portal module." });
  const records = await readJson(config.file, []);
  const index = findRecordIndex(records, id);
  if (index < 0) return res.status(404).json({ ok: false, message: "Record not found." });
  const previousRecord = records[index];
  const serviceScope = routeName === "attendance" ? await serviceTeamScopeForUser(res.req?.user || {}) : null;
  if (serviceScope && !attendanceRecordIsSelf(previousRecord, res.req?.user || {}) && (!recordMatchesServiceTeamScope(previousRecord, serviceScope) || !recordMatchesServiceTeamScope({ ...previousRecord, ...body }, serviceScope))) {
    return res.status(403).json({ ok: false, message: "Service Manager can update attendance only for Service team staff." });
  }
  if (routeName === "attendance" && !attendanceRecordBelongsToUser(previousRecord, res.req?.user || {})) {
    return res.status(403).json({ ok: false, message: "Staff can update only their own attendance." });
  }
  if (routeName === "attendance" && !canManageStaffAttendance(res.req?.user || {}) && !attendanceRecordBelongsToUser({ ...previousRecord, ...body }, res.req?.user || {})) {
    return res.status(403).json({ ok: false, message: "Staff cannot move attendance to another team member." });
  }
  if (routeName === "service" && serviceUpdateCapturesVisitPoint(body) && isJitendraServiceManager(res.req?.user || {}) && !isAdminUser(res.req?.user || {})) {
    return res.status(403).json({ ok: false, message: "Service managers can assign service jobs, but job-site check-in and check-out must be captured by the assigned engineer." });
  }
  if (routeName === "service" && Object.prototype.hasOwnProperty.call(body || {}, "check_in_at") && String(previousRecord.check_in_at || "").trim()) {
    return res.status(409).json({ ok: false, message: "Service check-in is already captured for this record." });
  }
  if (routeName === "service" && Object.prototype.hasOwnProperty.call(body || {}, "check_out_at") && !String(previousRecord.check_in_at || "").trim()) {
    return res.status(409).json({ ok: false, message: "Service check-in is required before check-out." });
  }
  if (routeName === "service" && Object.prototype.hasOwnProperty.call(body || {}, "check_out_at") && String(previousRecord.check_out_at || "").trim()) {
    return res.status(409).json({ ok: false, message: "Service check-out is already captured for this record." });
  }
  if (routeName === "service" && Object.prototype.hasOwnProperty.call(body || {}, "check_in_at") && !canManageServiceRecords(res.req?.user || {})) {
    const activeServiceRecord = records.find((record, recordIndex) => (
      recordIndex !== index &&
      serviceRecordIsActivelyCheckedIn(record) &&
      serviceRecordAssignedToUser(record, res.req?.user || {})
    ));
    if (activeServiceRecord) {
      return res.status(409).json({ ok: false, message: "Check out from your current service before checking in to another service." });
    }
  }
  if (routeName === "service" && !serviceRecordAssignedToUser(previousRecord, res.req?.user || {})) {
    return res.status(403).json({ ok: false, message: "Service engineers can update only service records assigned to them." });
  }
  if (routeName === "service" && !canManageServiceRecords(res.req?.user || {})) {
    delete body.assigned_engineer;
    delete body.technician;
    delete body.engineer;
    delete body.assigned_to;
  }
  if (routeName === "service" && canManageServiceRecords(res.req?.user || {})) {
    const assignmentTouched = ["assigned_engineer", "technician", "engineer", "assigned_to"].some((key) => Object.prototype.hasOwnProperty.call(body || {}, key));
    const nextEngineer = serviceAssignmentName({ ...previousRecord, ...body });
    const previousEngineer = serviceAssignmentName(previousRecord);
    if (assignmentTouched && nextEngineer !== previousEngineer && !String(body.assignment_source || "").trim()) {
      body.assignment_source = nextEngineer ? "manager-direct" : "manager-unassigned";
      body.assignment_reset_at = new Date().toISOString();
    }
  }
  const actionStatus = defaultStatusForAction(body?.action);
  const crmLinkedRoute = ["service", "breakdown"].includes(routeName);
  const serviceLink = crmLinkedRoute && body?.customer_id ? await linkedCrmCustomerPayload(body, res, routeName === "breakdown" ? "breakdown call" : "service record") : {};
  if (crmLinkedRoute && body?.customer_id && !serviceLink) return;
  const offerPayload = routeName === "estimates" ? await normalizeOfferPayload({ ...records[index], ...body }, res) : null;
  if (routeName === "estimates" && !offerPayload) return;
  const paymentPayload = routeName === "payments" ? normalizePaymentPayload({ ...records[index], ...body }) : null;
  const tenderPayload = routeName === "tender" ? normalizeTenderPayload(body, records[index], records) : null;
  const installationPayload = routeName === "install-jobs" ? normalizeInstallationPayload(body, records[index], records) : null;
  const nextRecord = {
    ...records[index],
    ...(offerPayload || paymentPayload || tenderPayload || installationPayload || cleanPayload(body)),
    ...serviceLink,
    ...(actionStatus ? { status: actionStatus } : {}),
    updated_at: new Date().toISOString()
  };
  records[index] = nextRecord;
  await writeJson(config.file, records);
  if (["service", "breakdown"].includes(routeName)) await syncCustomerServiceCounts([previousRecord.customer_id, nextRecord.customer_id]);
  await appendAuditLog({ user: res.req?.user || {}, collection: config.key, recordId: recordIdentityForAudit(nextRecord), action: "update", before: previousRecord, after: nextRecord });
  if (routeName === "install-jobs") {
    await logInstallationNotifications(nextRecord, previousRecord || {}, res.req?.user || {});
  }
  return res.json({ ok: true, record: publicRecords(config.key, [nextRecord])[0] });
}

async function deleteCollectionRecord(routeName, id, res) {
  const config = resolveCollection(routeName);
  if (!config) return res.status(404).json({ ok: false, message: "Unknown portal module." });
  if (routeName === "service" && !canManageServiceRecords(res.req?.user || {})) {
    return res.status(403).json({ ok: false, message: "Only Service Manager, CEO, or Admin can remove service records." });
  }
  if (routeName === "attendance" && !canManageStaffAttendance(res.req?.user || {})) {
    return res.status(403).json({ ok: false, message: "Only managers can remove attendance records." });
  }
  const records = await readJson(config.file, []);
  const deletedRecord = records.find((record) => findRecordIndex([record], id) === 0);
  const serviceScope = routeName === "attendance" ? await serviceTeamScopeForUser(res.req?.user || {}) : null;
  if (serviceScope && !recordMatchesServiceTeamScope(deletedRecord || {}, serviceScope) && !attendanceRecordIsSelf(deletedRecord || {}, res.req?.user || {})) {
    return res.status(403).json({ ok: false, message: "Service Manager can remove attendance only for Service team staff." });
  }
  const nextRecords = records.filter((record) => findRecordIndex([record], id) !== 0);
  if (nextRecords.length === records.length) return res.status(404).json({ ok: false, message: "Record not found." });
  await writeJson(config.file, nextRecords);
  if (["service", "breakdown"].includes(routeName)) await syncCustomerServiceCounts([deletedRecord?.customer_id]);
  await appendAuditLog({ user: res.req?.user || {}, collection: config.key, recordId: id, action: "delete", before: deletedRecord || null, after: null });
  return res.json({ ok: true });
}

function buildMetrics(data) {
  const workOrders = data.operations_state?.work_orders || [];
  const renewals = data.operations_state?.renewals || [];
  const tickets = data.project_tickets || [];
  const inventory = data.inventory || [];
  const openWorkOrders = workOrders.filter((item) => !["closed", "resolved", "done"].includes(String(item.status || item.state || "").toLowerCase()));
  const lowStock = inventory.filter((item) => Number(item.stock || item.qty_on_hand || 0) <= Number(item.min_stock || item.reorder_point || 0));
  const openTickets = tickets.filter((item) => !["closed", "done", "resolved"].includes(String(item.status || "").toLowerCase()));
  return [
    { label: "Work Orders", value: String(openWorkOrders.length), delta: "open service execution records", tone: openWorkOrders.length ? "warn" : "good" },
    { label: "Open Tickets", value: String(openTickets.length), delta: `${openTickets.filter((t) => String(t.status || "").toLowerCase() === "blocked").length} blocked`, tone: openTickets.length ? "warn" : "good" },
    { label: "Parts Stockouts", value: String(lowStock.length), delta: "stock watch", tone: lowStock.length ? "warn" : "good" },
    { label: "Upcoming Renewals", value: String(renewals.length), delta: "renewal pipeline", tone: renewals.length ? "info" : "good" }
  ];
}

const dynamicBrotliOptions = {
  params: {
    [zlib.constants.BROTLI_PARAM_QUALITY]: Number(process.env.FUZI_DYNAMIC_BROTLI_QUALITY || 4)
  }
};
const dynamicGzipOptions = { level: Number(process.env.FUZI_DYNAMIC_GZIP_LEVEL || 6) };

function compressionMiddleware(req, res, next) {
  const acceptEncoding = String(req.headers["accept-encoding"] || "");
  const encoding = /\bbr\b/.test(acceptEncoding) ? "br" : /\bgzip\b/.test(acceptEncoding) ? "gzip" : "";
  if (!encoding || req.method === "HEAD") return next();
  const originalSend = res.send.bind(res);
  res.send = (body) => {
    if (
      res.headersSent ||
      res.getHeader("Content-Encoding") ||
      res.statusCode === 204 ||
      res.statusCode === 304 ||
      body === undefined ||
      body === null
    ) {
      return originalSend(body);
    }
    const contentType = String(res.getHeader("Content-Type") || "");
    const shouldCompress = /json|text|javascript|css|svg|xml/i.test(contentType);
    if (!shouldCompress) return originalSend(body);
    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === "string" ? body : JSON.stringify(body));
    if (buffer.length < 1024) return originalSend(body);
    const compressed = encoding === "br"
      ? zlib.brotliCompressSync(buffer, dynamicBrotliOptions)
      : zlib.gzipSync(buffer, dynamicGzipOptions);
    res.setHeader("Content-Encoding", encoding);
    res.setHeader("Vary", "Accept-Encoding");
    res.setHeader("Content-Length", String(compressed.length));
    return originalSend(compressed);
  };
  return next();
}

function staticCacheControl(res, filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  if (/\/index\.html$/i.test(normalized) || /\.html?$/i.test(normalized)) {
    res.setHeader("Cache-Control", "no-store");
    return;
  }
  if (/\.(?:js|css|png|jpe?g|webp|gif|svg|ico|woff2?)$/i.test(normalized)) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return;
  }
  res.setHeader("Cache-Control", "no-store");
}

const staticContentTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function staticContentType(filePath) {
  return staticContentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function safeStaticFilePath(baseDir, requestPath) {
  try {
    const decodedPath = decodeURIComponent(String(requestPath || "/").split("?")[0]);
    const resolvedPath = path.resolve(baseDir, `.${decodedPath}`);
    return resolvedPath === baseDir || resolvedPath.startsWith(`${baseDir}${path.sep}`) ? resolvedPath : "";
  } catch {
    return "";
  }
}

function precompressedStaticMiddleware(baseDir) {
  return (req, res, next) => {
    if (!["GET", "HEAD"].includes(req.method)) return next();
    const originalPath = safeStaticFilePath(baseDir, req.path);
    if (!originalPath || !fsSync.existsSync(originalPath) || !fsSync.statSync(originalPath).isFile()) return next();
    const acceptEncoding = String(req.headers["accept-encoding"] || "");
    const candidates = [
      { encoding: "br", path: `${originalPath}.br`, accepted: /\bbr\b/.test(acceptEncoding) },
      { encoding: "gzip", path: `${originalPath}.gz`, accepted: /\bgzip\b/.test(acceptEncoding) }
    ];
    const match = candidates.find((candidate) => candidate.accepted && fsSync.existsSync(candidate.path));
    if (!match) return next();
    const stats = fsSync.statSync(match.path);
    staticCacheControl(res, originalPath);
    res.setHeader("Content-Encoding", match.encoding);
    res.setHeader("Content-Length", String(stats.size));
    res.setHeader("Content-Type", staticContentType(originalPath));
    res.setHeader("Vary", "Accept-Encoding");
    return res.sendFile(match.path);
  };
}

function sendMaybePrecompressed(req, res, filePath) {
  const acceptEncoding = String(req.headers["accept-encoding"] || "");
  const candidates = [
    { encoding: "br", path: `${filePath}.br`, accepted: /\bbr\b/.test(acceptEncoding) },
    { encoding: "gzip", path: `${filePath}.gz`, accepted: /\bgzip\b/.test(acceptEncoding) }
  ];
  const match = candidates.find((candidate) => candidate.accepted && fsSync.existsSync(candidate.path));
  staticCacheControl(res, filePath);
  if (!match) return res.sendFile(filePath);
  const stats = fsSync.statSync(match.path);
  res.setHeader("Content-Encoding", match.encoding);
  res.setHeader("Content-Length", String(stats.size));
  res.setHeader("Content-Type", staticContentType(filePath));
  res.setHeader("Vary", "Accept-Encoding");
  return res.sendFile(match.path);
}

async function ensurePortalCollectionIntegrity() {
  const now = Date.now();
  if (portalIntegrityPromise) return portalIntegrityPromise;
  if (now - portalIntegrityCheckedAt < portalIntegrityTtlMs) return;
  portalIntegrityPromise = (async () => {
    await ensureFourDigitCustomerIds();
    await ensureSalesInquiryCustomerIds();
    await ensureOfferInquiryLinks();
    await ensureRenewalCustomerLinks();
    await ensureSiteVisitCustomerLinks();
    await ensureServiceJobsForCustomers();
    portalIntegrityCheckedAt = Date.now();
  })().finally(() => {
    portalIntegrityPromise = null;
  });
  return portalIntegrityPromise;
}

function slimPortalRecord(collectionKey, record = {}) {
  if (!record || typeof record !== "object") return record;
  if (collectionKey === "estimates") {
    const { expanded_costing_data, costing_rows, ...rest } = record;
    return rest;
  }
  if (collectionKey === "service_records") {
    const { service_history, ...rest } = record;
    return {
      ...rest,
      service_history_count: Array.isArray(service_history) ? service_history.length : 0
    };
  }
  if (collectionKey === "audit_logs") {
    const before = compactAuditSnapshot(record.before);
    const after = compactAuditSnapshot(record.after);
    return {
      ...record,
      before,
      after,
      before_summary: before,
      after_summary: after
    };
  }
  return record;
}

function slimPortalCollection(collectionKey, value) {
  return Array.isArray(value) ? value.map((record) => slimPortalRecord(collectionKey, record)) : value;
}

async function loadPortalCollections() {
  await ensurePortalCollectionIntegrity();
  const entries = await Promise.all(Object.entries(listFiles).map(async ([key, file]) => [key, slimPortalCollection(key, await readJson(file, []))]));
  const data = Object.fromEntries(entries);
  data.operations_state = await readJson("operations_state.json", {});
  return data;
}

function portalData(collections, user) {
  const access = accessForUser(user);
  const serviceScope = isServiceManagerScopedUser(user) ? serviceTeamScopeFromOrgChart(collections.org_chart) : null;
  const scopedUsers = serviceScope
    ? collections.users.filter((record) => recordMatchesServiceTeamScope(record, serviceScope) || attendanceRecordIsSelf(record, user))
    : collections.users;
  const scopedOrgChart = serviceScope
    ? collections.org_chart.filter((record) => recordMatchesServiceTeamScope(record, serviceScope) || attendanceRecordIsSelf(record, user))
    : collections.org_chart;
  const managerScopedAttendance = serviceScope
    ? collections.attendance.filter((record) => recordMatchesServiceTeamScope(record, serviceScope) || attendanceRecordIsSelf(record, user))
    : collections.attendance;
  const scopedAttendance = canManageStaffAttendance(user)
    ? managerScopedAttendance
    : collections.attendance.filter((record) => attendanceRecordBelongsToUser(record, user));
  const scopedLeaveRequests = applyServiceManagerCollectionScope("leave_requests", collections.leave_requests, serviceScope);
  const payload = {
    metrics: buildMetrics(collections),
    dashboard_overview: {},
    refresh_interval_minutes: 5,
    projects: collections.operations_state?.projects || [],
    installations: collections.operations_state?.installations || [],
    renewals: collections.operations_state?.renewals || [],
    work_orders: collections.operations_state?.work_orders || [],
    project_tickets: collections.project_tickets,
    install_jobs: collections.install_jobs,
    install_team: collections.install_team,
    installation_contractors: collections.installation_contractors,
    users: scopedUsers.map(publicUser),
    customers: collections.customers,
    customer_assignments: collections.customer_assignments,
    department_assignments: collections.department_assignments,
    time_tracking: collections.time_tracking,
    department_history: collections.department_history,
    site_visits: collections.site_visits,
    platform_modules: platformModules,
    inventory: Array.isArray(collections.inventory) ? collections.inventory.map(normalizeInventoryItem) : [],
    inventory_insights: {},
    viewer: publicUser(user),
    access,
    department_options: [],
    org_chart: scopedOrgChart,
    attendance_today: scopedAttendance,
    leave_requests: scopedLeaveRequests,
    estimates: collections.estimates,
    payments: collections.payments,
    customer_users: collections.customer_users,
    sales_inquiries: collections.sales_inquiries,
    sales_admin_panel: collections.sales_admin_panel,
    breakdowns: collections.breakdowns,
    service_records: collections.service_records,
    gad_records: collections.gad_records,
    commissionings: collections.commissionings,
    factory_jobs: collections.factory_jobs,
    tenders: collections.tenders,
    international_vendors: collections.international_vendors,
    marketing_assets: collections.marketing_assets,
    dept_comms: collections.dept_comms,
    approvals: collections.approvals,
    documents: collections.documents,
    escalation_rules: collections.escalation_rules,
    conversations: collections.conversations,
    audit_logs: collections.audit_logs,
    warranty_records: collections.warranty_records,
    dispatch_records: collections.dispatch_records,
    readiness_checklists: collections.readiness_checklists,
    skill_matrix: collections.skill_matrix,
    handover_packs: collections.handover_packs,
    lift_assets: collections.lift_assets,
    parts_usage: collections.parts_usage,
    safety_incidents: collections.safety_incidents,
    tender_checklists: collections.tender_checklists,
    amc_contracts: collections.amc_contracts,
    service_reports: collections.service_reports,
    daily_briefs: collections.daily_briefs,
    synced_at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  };
  if (!canManageServiceRecords(user)) {
    payload.service_records = payload.service_records.filter((record) => serviceRecordAssignedToUser(record, user));
  }
  return filterPortalPayload(payload, access);
}

async function cachedPortalData(user) {
  const access = accessForUser(user);
  const userKey = [
    String(user.username || user.display_name || ""),
    String(user.department || ""),
    String(user.role || ""),
    (access.allowed_views || []).join(","),
    dataVersion
  ].join("|");
  const cached = portalResponseCache.get(userKey);
  if (cached && Date.now() - cached.createdAt < portalCacheTtlMs) return cached.payload;
  const payload = portalData(await loadPortalCollections(), user);
  portalResponseCache.set(userKey, { createdAt: Date.now(), payload });
  return payload;
}

const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: true, credentials: true }));
app.use(compressionMiddleware);
app.use(express.json({ limit: "5mb" }));
const offerAssetsDir = path.join(rootDir, "docs", "offer", "assets");
const customerAssetsDir = path.join(rootDir, "docs", "customer-assets");
const crmImportTemplatesDir = path.join(rootDir, "crm-import-templates");
app.use("/assets/offer", precompressedStaticMiddleware(offerAssetsDir), express.static(offerAssetsDir, { setHeaders: staticCacheControl }));
app.use("/assets/customer", precompressedStaticMiddleware(customerAssetsDir), express.static(customerAssetsDir, { setHeaders: staticCacheControl }));
app.use("/crm-import-templates", express.static(crmImportTemplatesDir, { setHeaders: staticCacheControl }));
const webDistDir = path.join(rootDir, "expo-app", "dist");
const webDistIndex = path.join(webDistDir, "index.html");
const webSiteDir = path.join(webDistDir, "site");
const webSiteIndex = path.join(webSiteDir, "index.html");
function webDistInfo() {
  const available = fsSync.existsSync(webDistIndex);
  const stats = available ? fsSync.statSync(webDistIndex) : null;
  return {
    available,
    type: "expo-single-page-web-export",
    updated_at: stats ? stats.mtime.toISOString() : null,
    bytes: stats ? stats.size : 0
  };
}
if (fsSync.existsSync(webDistIndex)) {
  app.use(precompressedStaticMiddleware(webDistDir));
  app.use(express.static(webDistDir, {
    index: false,
    setHeaders: staticCacheControl
  }));
}
if (fsSync.existsSync(webSiteIndex)) {
  app.use(precompressedStaticMiddleware(webSiteDir));
  app.use(express.static(webSiteDir, {
    index: false,
    setHeaders: staticCacheControl
  }));
}

const communicationService = createOpenClawCommunicationService({
  config: defaultOpenClawCommunicationData(process.env, rootDir),
  env: process.env,
  readText: async (filePath) => {
    try {
      return await fs.readFile(filePath, "utf8");
    } catch {
      return "";
    }
  },
  runCommand: (command, args, timeoutMs) => new Promise((resolve) => {
    execFile(command, args, { timeout: timeoutMs, windowsHide: true }, (error, stdout, stderr) => {
      resolve([stdout, stderr, error?.message || ""].filter(Boolean).join("\n"));
    });
  }),
  fetchImpl: fetch,
  readState: readOperationsState,
  writeState: writeOperationsState,
  nextRecordId: nextId,
  now: () => new Date().toISOString()
});

const discordBreakdownConfig = defaultDiscordBreakdownSyncData(process.env, rootDir);
const resolveDiscordBreakdownTargetFromOpenClaw = async () => {
  const endpoint = (() => {
    const base = String(discordBreakdownConfig.openClawUrl || "").trim();
    if (!base) return "";
    return new URL("tools/invoke", base.endsWith("/") ? base : `${base}/`).toString();
  })();
  if (!endpoint) return "";
  const envValues = {};
  try {
    const text = await fs.readFile(discordBreakdownConfig.envFile, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const [key, ...rest] = line.split("=");
      envValues[key.trim()] = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // The gateway tool call can still work without a local OpenClaw env file.
  }
  const resolvePossiblyEnvValue = (value) => {
    const resolved = String(value || "").trim();
    if (!resolved.startsWith("${") || !resolved.endsWith("}")) return resolved;
    const envKey = resolved.slice(2, -1);
    return String(process.env[envKey] || envValues[envKey] || "").trim();
  };
  let openClawConfig = {};
  try {
    openClawConfig = JSON.parse(await fs.readFile(discordBreakdownConfig.configFile, "utf8")) || {};
  } catch {
    openClawConfig = {};
  }
  const gateway = openClawConfig.gateway && typeof openClawConfig.gateway === "object" ? openClawConfig.gateway : {};
  const auth = gateway.auth && typeof gateway.auth === "object" ? gateway.auth : {};
  const secret = [
    process.env.OPENCLAW_GATEWAY_TOKEN,
    envValues.OPENCLAW_GATEWAY_TOKEN,
    process.env.FUZI_OPENCLAW_TOKEN,
    envValues.FUZI_OPENCLAW_TOKEN,
    process.env.FUZI_OPENCLAW_PASSWORD,
    envValues.FUZI_OPENCLAW_PASSWORD,
    auth.token,
    auth.gatewayToken,
    auth.gateway_token,
    auth.authToken,
    auth.auth_token,
    auth.password
  ].map(resolvePossiblyEnvValue).find(Boolean) || "";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(Number(discordBreakdownConfig.openClawTimeoutSeconds || 15), 1) * 1000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {})
      },
      body: JSON.stringify({
        tool: "fuzidiscordchannel",
        action: "resolve",
        sessionKey: "agent:main:explicit:fuzidiscordchannel",
        key: "FUZI_OPENCLAW_TARGET_BREAKDOWN_CHANNEL",
        expose: "value-only",
        readonly: true
      }),
      signal: controller.signal
    });
    const body = await response.text();
    const match = String(body || "").match(/(?:^|[^A-Za-z0-9_-])(channel:\d{6,})(?:[^A-Za-z0-9_-]|$)/);
    return match ? match[1] : "";
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
};
const resolveDiscordBreakdownTarget = async () => {
  if (String(discordBreakdownConfig.channelTarget || "").trim()) return String(discordBreakdownConfig.channelTarget).trim();
  try {
    const text = await fs.readFile(discordBreakdownConfig.envFile, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const [key, ...rest] = line.split("=");
      if (key.trim() !== "FUZI_OPENCLAW_TARGET_BREAKDOWN_CHANNEL") continue;
      return rest.join("=").trim().replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // Auto-assignment replies should use the same OpenClaw env-file target as incoming breakdown sync.
  }
  return await resolveDiscordBreakdownTargetFromOpenClaw();
};
const discordBreakdownSyncService = createDiscordBreakdownSyncService({
  config: discordBreakdownConfig,
  env: process.env,
  readText: async (filePath) => {
    try {
      return await fs.readFile(filePath, "utf8");
    } catch {
      return "";
    }
  },
  fetchImpl: fetch,
  readState: readOperationsState,
  writeState: writeOperationsState,
  readCollection: async (key) => await readJson(listFiles[key], []),
  writeCollection: async (key, records) => await writeJson(listFiles[key], records),
  notifyAutoAssignedBreakdown: async (record, reply) => await communicationService.sendBusinessChannelUpdate("breakdown-auto-assigned", {
    channel: "discord",
    target: await resolveDiscordBreakdownTarget(),
    message: reply,
    summary: reply,
    breakdown_id: record.id,
    source_discord_message_id: record.source_discord_message_id || "",
    scheduled_engineer: record.engineer || record.assigned_to || record.scheduled_engineer || "",
    phone: record.phone || record.caller_mobile || "",
    current_task: record.id
  }),
  nextRecordId: nextId,
  now: () => new Date().toISOString()
});

app.post("/api/portal/auth/login", async (req, res) => {
  const users = await ensureSharedStaffPortalPassword();
  const username = String(req.body?.username || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const attempt = loginAttemptState(req, username);
  if (attempt.state.count >= loginMaxAttempts) {
    const retryAfter = Math.max(1, Math.ceil((attempt.state.resetAt - Date.now()) / 1000));
    return res.status(429).json({ ok: false, message: `Too many login attempts. Try again in ${retryAfter} seconds.` });
  }
  const user = users.find((item) => String(item.username || "").toLowerCase() === username && item.active !== false);
  if (!user || !verifyWerkzeugPassword(user.password_hash, password)) {
    recordFailedLogin(req, username);
    return res.status(401).json({ ok: false, message: "Invalid username or password." });
  }
  clearLoginAttempts(req, username);
  const token = crypto.randomBytes(48).toString("base64url");
  tokens.set(token, { user, createdAt: Date.now(), expiresAt: Date.now() + tokenTtlMs });
  return res.json({ ok: true, token, user: publicUser(user), access: accessForUser(user), must_change_password: Boolean(user.must_change_password) });
});

app.get("/api/portal/auth/login-directory", async (_req, res) => {
  const users = await ensureSharedStaffPortalPassword();
  const directory = users
    .filter((user) => user.active !== false)
    .map((user) => ({
      username: String(user.username || ""),
      display_name: String(user.display_name || user.username || ""),
      department: String(user.department || "Unassigned"),
      role: String(user.role || "staff"),
      linked_org_node: String(user.linked_org_node || "")
    }))
    .sort((a, b) => `${a.department} ${a.display_name}`.localeCompare(`${b.department} ${b.display_name}`));
  const departments = Array.from(new Set(directory.map((user) => user.department || "Unassigned"))).sort();
  res.json({ ok: true, departments, users: directory });
});

app.get("/api/portal/auth/session", authRequired, (req, res) => {
  res.json({ ok: true, user: publicUser(req.user), access: accessForUser(req.user) });
});

app.post("/api/portal/auth/logout", authRequired, (req, res) => {
  tokens.delete(req.token);
  res.json({ ok: true });
});

app.get("/api/portal/data", authRequired, async (req, res) => {
  await ensureSharedStaffPortalPassword();
  res.setHeader("Cache-Control", "private, max-age=15, stale-while-revalidate=60");
  res.json(await cachedPortalData(req.user));
});

app.get("/api/portal/global-search", authRequired, async (req, res) => {
  const query = String(req.query.q || "").trim();
  if (query.length < 2) return res.json({ ok: true, query, results: [] });
  const collections = await loadPortalCollections();
  const serviceSearchRecords = canManageServiceRecords(req.user)
    ? collections.service_records
    : collections.service_records.filter((record) => serviceRecordAssignedToUser(record, req.user));
  const results = [
    ...globalSearchItems("customers", collections.customers, ["name", "contact_person"], query),
    ...globalSearchItems("sales_inquiries", collections.sales_inquiries, ["customer", "enquiry_no"], query),
    ...globalSearchItems("install_jobs", collections.install_jobs, ["job_id", "customer", "project_name"], query),
    ...globalSearchItems("breakdowns", collections.breakdowns, ["id", "customer", "unit"], query),
    ...globalSearchItems("service_records", serviceSearchRecords, ["job_number", "customer"], query),
    ...globalSearchItems("payments", collections.payments, ["customer_name", "milestone"], query),
    ...globalSearchItems("tenders", collections.tenders, ["tender_no", "tender_invited_by", "party_name"], query),
    ...globalSearchItems("dept_comms", collections.dept_comms, ["subject", "message"], query)
  ];
  res.json({ ok: true, query, results: results.slice(0, 40) });
});

app.post("/api/portal/crm/import-csv", authRequired, async (req, res) => {
  if (!isAdminUser(req.user) && !canManageCustomerAssignments(req.user)) {
    return res.status(403).json({ ok: false, message: "Only Admin, Manager, or Team Lead users can import CRM CSV data." });
  }
  const csvText = String(req.body?.csv_text || "");
  if (!csvText.trim()) return res.status(400).json({ ok: false, message: "Upload a CSV file with rows to import." });
  const rows = parseCsvRows(csvText);
  if (!rows.length) return res.status(400).json({ ok: false, message: "No data rows found in the CSV file." });
  const importType = String(req.body?.import_type || "auto").trim() || "auto";
  const result = await importCrmCsvRows(rows, importType, req.user || {});
  res.json({ ok: true, ...result, filename: String(req.body?.filename || "").trim() });
});

app.get("/api/portal/crm/export", authRequired, async (req, res) => {
  if (!isAdminUser(req.user)) return res.status(403).json({ ok: false, message: "Only admin can download CRM data." });
  const [customers, salesInquiries, estimates, payments, siteVisits, customerUsers] = await Promise.all([
    readJson(listFiles.customers, []),
    readJson(listFiles.sales_inquiries, []),
    readJson(listFiles.estimates, []),
    readJson(listFiles.payments, []),
    readJson(listFiles.site_visits, []),
    readJson(listFiles.customer_users, [])
  ]);
  const exportedAt = new Date().toISOString();
  const payload = {
    exported_at: exportedAt,
    exported_by: publicUser(req.user),
    counts: {
      customers: customers.length,
      sales_inquiries: salesInquiries.length,
      estimates: estimates.length,
      payments: payments.length,
      site_visits: siteVisits.length,
      customer_users: customerUsers.length
    },
    customers,
    sales_inquiries: salesInquiries,
    estimates,
    payments,
    site_visits: siteVisits,
    customer_users: customerUsers
  };
  const stamp = exportedAt.replace(/[:.]/g, "-");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="fuzi-crm-export-${stamp}.json"`);
  res.send(JSON.stringify(payload, null, 2));
});

app.post("/api/portal/customers/occasion-reminders", authRequired, async (req, res) => {
  const today = String(req.body?.date || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const monthDay = today.slice(5);
  const customers = await readJson(listFiles.customers, []);
  const deptComms = await readJson(listFiles.dept_comms, []);
  const reminders = [];
  const alreadyLogged = new Set(deptComms
    .filter((item) => String(item.notification_date || "").slice(0, 10) === today)
    .map((item) => `${item.notification_type}:${item.customer_id}`));
  for (const customer of customers) {
    const occasions = [
      { type: "customer-birthday", date: String(customer.date_of_birth || ""), message: "Happy Birthday from Fuzi Elevators." },
      { type: "customer-anniversary", date: String(customer.anniversary_date || ""), message: "Happy Anniversary from Fuzi Elevators." }
    ];
    for (const occasion of occasions) {
      if (!occasion.date || occasion.date.slice(5) !== monthDay) continue;
      const key = `${occasion.type}:${customer.id}`;
      if (alreadyLogged.has(key)) continue;
      reminders.push({
        id: nextId([...deptComms, ...reminders], "MSG"),
        department: "CRM",
        channel: "whatsapp",
        notification_type: occasion.type,
        notification_date: today,
        subject: `${occasion.type === "customer-birthday" ? "Birthday" : "Anniversary"}: ${customer.name || customer.id}`,
        message: occasion.message,
        status: "Queued",
        read: false,
        customer_id: String(customer.id || ""),
        customer: String(customer.name || ""),
        phone: String(customer.phone || customer.whatsapp || ""),
        created_by: req.user?.display_name || req.user?.username || "System",
        created_at: new Date().toISOString()
      });
    }
  }
  if (reminders.length) {
    deptComms.unshift(...reminders);
    await writeJson(listFiles.dept_comms, deptComms);
    for (const reminder of reminders) {
      const delivery = await communicationService.sendBusinessChannelUpdate(reminder.notification_type, {
        agent: "CRM Query Agent",
        channel: "whatsapp",
        target: reminder.phone,
        customer_id: reminder.customer_id,
        message: reminder.message,
        summary: reminder.message
      }).catch((error) => ({ ok: false, error: error?.message || String(error) }));
      reminder.delivery_status = delivery.ok ? "Sent" : "Logged";
      reminder.delivery_error = delivery.ok ? "" : String(delivery.error || delivery.status || "");
    }
    await writeJson(listFiles.dept_comms, deptComms);
  }
  res.json({ ok: true, reminders, count: reminders.length, date: today });
});

app.post("/api/portal/action", authRequired, async (req, res) => {
  const action = String(req.body?.action || "noted").trim();
  const target = String(req.body?.target || req.body?.label || "").trim();
  const delivery = await communicationService.sendBusinessChannelUpdate("portal-action", {
    agent: String(req.body?.agent || defaultAgentForCommunicationAction(action, target)).trim(),
    action,
    target,
    summary: target ? `${action} executed for ${target}.` : `${action} executed.`
  });
  res.json({ ok: true, action, message: "Portal action recorded by the Node API.", delivery });
});

app.post("/api/portal/crm-query", authRequired, async (req, res) => {
  const query = String(req.body?.query || req.body?.message || "").trim().toLowerCase();
  const customers = await readJson(listFiles.customers, []);
  const matches = query
    ? customers.filter((customer) => JSON.stringify(customer).toLowerCase().includes(query)).slice(0, 10)
    : customers.slice(0, 10);
  const answer = matches.length ? `${matches.length} matching customer records found.` : "No matching customer records found.";
  const delivery = await communicationService.sendBusinessChannelUpdate("crm-query", {
    agent: "CRM Query Agent",
    question: query,
    summary: answer,
    details: matches.map((customer) => customer.name || customer.id).filter(Boolean).slice(0, 5)
  });
  res.json({ ok: true, matches, answer, delivery });
});

app.post("/api/openclaw/webhook", async (req, res) => {
  const inboundChannel = String(req.body?.channel || req.body?.platform || "").trim().toLowerCase();
  if (inboundChannel === "engineer-attendance" || inboundChannel === "#engineer-attendance") {
    const result = await importEngineerAttendanceMessages(req.body || {});
    if (!result.ok) return res.status(result.status || 400).json({ ok: false, message: result.error || "Engineer attendance message could not be imported." });
    return res.json(result);
  }
  const result = await communicationService.saveInboundPlatformMessage(req.body || {});
  if (!result.ok) return res.status(result.status || 400).json({ ok: false, message: result.error || "Inbound platform message could not be saved." });
  res.json(result);
});

app.post("/api/openclaw/engineer-attendance/import", async (req, res) => {
  const result = await importEngineerAttendanceMessages({ channel: "engineer-attendance", ...(req.body || {}) });
  if (!result.ok) return res.status(result.status || 400).json({ ok: false, message: result.error || "Engineer attendance message could not be imported." });
  res.json(result);
});

app.post("/api/openclaw/send", authRequired, async (req, res) => {
  const eventType = String(req.body?.event_type || "manual-message").trim();
  const delivery = await communicationService.sendBusinessChannelUpdate(eventType, req.body || {});
  res.status(delivery.ok ? 200 : 502).json({ ok: delivery.ok, delivery });
});

function openClawCostingBackendUrl(req) {
  return String(process.env.FUZI_OPENCLAW_COSTING_BACKEND_URL || process.env.FUZI_BACKEND_URL || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
}

function openClawTerminalBackendUrl(req) {
  const explicit = String(process.env.FUZI_OPENCLAW_COSTING_BACKEND_URL || process.env.FUZI_BACKEND_URL || process.env.FUZI_DOCKER_API_URL || "").trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const host = String(req.get("host") || "").replace(/^127\.0\.0\.1(?=:|$)/, "host.docker.internal").replace(/^localhost(?=:|$)/i, "host.docker.internal");
  return `${req.protocol}://${host}`.replace(/\/+$/, "");
}

function costingManifestOpenClawMessage(manifest, req) {
  return [
    "FUZI costing workbook file list.",
    JSON.stringify(manifest.files.map((file) => ({
      source_file: file.source_file,
      size_bytes: file.size_bytes
    })), null, 2)
  ].join("\n");
}

function openClawCostingNextPrompt(reason, details = {}) {
  return [
    "Update FUZI so OpenClaw can complete the costing workbook import through the Offer Manager Save offer section.",
    "",
    `Reason: ${reason}`,
    "",
    "Required behavior:",
    "- OpenClaw must decide A1 or 1A ordering, convert every .xlsx workbook, fetch the full converted JSON, then POST the converted payload to the backend action that emulates typing into the Offer Manager section containing the Save offer button.",
    "- That backend action must save the offer through the same normalization and storage path as the real Save offer button.",
    "- The saved offer must include `costing_source_file` and `expanded_costing_data` from the converted workbook JSON.",
    "- If a required customer/offer field cannot be chosen from backend context, return `exact_next_prompt_for_codex` with the missing field and no work for the user to invent.",
    "",
    `Backend details: ${JSON.stringify(details, null, 2)}`
  ].join("\n");
}

async function writeCostingConversionArtifact(data, orderDecisions = {}, options = {}) {
  const artifactDir = path.join(rootDir, "docs", "6-passenger-costing", "openclaw-import-results");
  await fs.mkdir(artifactDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const artifactId = `costing-import-${timestamp}-${crypto.randomBytes(4).toString("hex")}`;
  const password = crypto.randomBytes(18).toString("base64url");
  const artifactPath = path.join(artifactDir, `${artifactId}.json`);
  await fs.writeFile(artifactPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    artifact_id: artifactId,
    order_decisions: orderDecisions,
    ...data
  }, null, 2), "utf8");
  costingArtifactPasswords.set(artifactId, {
    password,
    artifactPath,
    data,
    manifest: options.manifest || null,
    orderDecisions,
    sessionKey: options.sessionKey || costingImportSessionKey,
    createdAt: Date.now(),
    expiresAt: Date.now() + (Number(process.env.FUZI_OPENCLAW_COSTING_PASSWORD_TTL_MINUTES || 240) * 60 * 1000)
  });
  return { artifactId, artifactPath, password };
}

function costingConversionOpenClawMessage(data, manifest, orderDecisions = {}, artifact = {}, req = null) {
  const sources = Array.isArray(data.sources) ? data.sources : [];
  const backendUrl = req ? openClawTerminalBackendUrl(req) : "";
  const fetchUrl = backendUrl && artifact.artifactId ? `${backendUrl}/api/openclaw/costing/result/${encodeURIComponent(artifact.artifactId)}` : "";
  const contextUrl = backendUrl && artifact.artifactId ? `${backendUrl}/api/openclaw/costing/offer-manager/context` : "";
  const saveOfferUrl = backendUrl && artifact.artifactId ? `${backendUrl}/api/openclaw/costing/offer-manager/save` : "";
  const terminalOutputPath = artifact.artifactId ? `/tmp/${artifact.artifactId}.json` : "/tmp/fuzi-costing-converted.json";
  const commandOptions = fetchUrl && artifact.password ? {
    curl: `curl -sS -H "X-FUZI-OpenClaw-Costing-Password: ${artifact.password}" "${fetchUrl}" -o "${terminalOutputPath}"`,
    powershell: `$out = "${terminalOutputPath}"; Invoke-RestMethod -Uri "${fetchUrl}" -Headers @{ "X-FUZI-OpenClaw-Costing-Password" = "${artifact.password}" } | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $out -Encoding UTF8`,
    node_fetch: `node -e "const fs=require('fs'); fetch('${fetchUrl}',{headers:{'X-FUZI-OpenClaw-Costing-Password':'${artifact.password}'}}).then(r=>r.text()).then(t=>{fs.writeFileSync('${terminalOutputPath}',t);})"`
  } : {};
  return [
    "FUZI costing workbook conversion result.",
    "Full converted cell arrays are not pasted into chat. OpenClaw must decide which terminal command to run, using the backend URL and password below, to receive the complete JSON.",
    "",
    JSON.stringify({
      session_key: manifest.session_key,
      source_count: data.source_count || sources.length,
      total_values: sources.reduce((sum, source) => sum + Number(source.non_empty_cell_count || 0), 0),
      order_decisions: orderDecisions,
      artifact_id: artifact.artifactId || "",
      full_result_path: artifact.artifactPath || "",
      backend_result_url: fetchUrl,
      backend_password: artifact.password || "",
      terminal_output_path: terminalOutputPath,
      terminal_command_decision_required: true,
      terminal_command_options: commandOptions,
      offer_manager_save_action: {
        method: "POST",
        url: saveOfferUrl,
        password_header: "X-FUZI-OpenClaw-Costing-Password",
        password: artifact.password || "",
        required_body: {
          artifact_id: artifact.artifactId || "",
          converted_data_source: "Read the full JSON from terminal_output_path after running one terminal_command_options command.",
          offer_fields: {
            customer_id: "OpenClaw must choose or provide the CRM customer id for the Offer Manager draft.",
            customer_name: "Customer name shown in the Offer Manager Save offer section.",
            lead_status: "Offer Pending",
            source: "CRM Offer Manager",
            offer_source: "OpenClaw costing import"
          }
        },
        behavior: "This endpoint emulates typing the converted costing fields into the Offer Manager section that contains Save offer, then uses the same backend save logic as the Save offer button.",
        if_logic_missing: "Return exact_next_prompt_for_codex. Do not ask the user to invent the next prompt."
      },
      offer_manager_context_action: {
        method: "POST",
        url: contextUrl,
        password_header: "X-FUZI-OpenClaw-Costing-Password",
        password: artifact.password || "",
        body: { artifact_id: artifact.artifactId || "" },
        behavior: "Use this if OpenClaw needs minimal CRM customer/enquiry choices before deciding the offer_fields for offer_manager_save_action."
      },
      files: sources.map((source) => ({
        source_file: source.source_file,
        size_bytes: manifest.files.find((file) => file.source_file === source.source_file)?.size_bytes || 0
      })),
      save_offer_fields: {
        costing_source_file: sources.map((source) => source.source_file),
        expanded_costing_data: "OpenClaw decides and runs one terminal command using backend_result_url plus backend_password to receive the full converted sources, including all sheets_matrix cell arrays and samples."
      },
      after_terminal_command: "After OpenClaw runs one terminal_command_options command, POST the full converted JSON plus chosen Offer Manager fields to offer_manager_save_action.url. Do not stop at a short command summary."
    }, null, 2)
  ].join("\n");
}

function attachCostingManifestToSources(data, manifest) {
  const filesByName = new Map((manifest.files || []).map((file) => [file.source_file, file]));
  return {
    ...data,
    sources: (Array.isArray(data.sources) ? data.sources : []).map((source) => {
      const file = filesByName.get(source.source_file) || {};
      return {
        ...source,
        size_bytes: file.size_bytes || file.bytes || 0,
        size_kb: file.size_kb || 0,
        modified_at: file.modified_at || ""
      };
    })
  };
}

app.get("/api/openclaw/costing/manifest", async (req, res) => {
  try {
    const manifest = await listCostingWorkbookManifest();
    res.json({ ok: true, ...manifest });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : "Could not read costing workbook manifest." });
  }
});

app.post("/api/openclaw/costing/manifest/send", async (req, res) => {
  try {
    const manifest = await listCostingWorkbookManifest();
    const sessionKey = String(req.body?.session_key || req.body?.sessionKey || costingImportSessionKey).trim();
    const delivery = await communicationService.sendSessionMessage(
      sessionKey,
      costingManifestOpenClawMessage(manifest, req),
      { event_type: "costing-workbook-manifest", source_count: manifest.source_count }
    );
    res.status(delivery.ok ? 200 : 202).json({
      ok: true,
      session_key: sessionKey,
      source_count: manifest.source_count,
      files: manifest.files.map((file) => ({
        source_file: file.source_file,
        size_bytes: file.size_bytes
      })),
      openclaw_delivery: delivery
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : "Could not send costing workbook manifest to OpenClaw." });
  }
});

app.get("/api/openclaw/costing/result/:artifactId", async (req, res) => {
  const artifactId = String(req.params.artifactId || "").trim();
  const record = costingArtifactPasswords.get(artifactId);
  const password = String(req.get("X-FUZI-OpenClaw-Costing-Password") || req.query.password || "").trim();
  if (!record || record.expiresAt < Date.now()) {
    if (record) costingArtifactPasswords.delete(artifactId);
    return res.status(404).json({ ok: false, message: "Costing conversion artifact was not found or has expired." });
  }
  if (!password || password !== record.password) {
    return res.status(401).json({ ok: false, message: "Costing conversion password is required." });
  }
  try {
    if (String(req.query.response || req.query.format || "").trim().toLowerCase() === "prompt") {
      if (!record.data || !record.manifest) {
        return res.status(404).json({ ok: false, message: "Costing conversion prompt data was not found." });
      }
      res.setHeader("Cache-Control", "no-store");
      res.type("text/plain");
      return res.send(costingConversionOpenClawMessage(record.data, record.manifest, record.orderDecisions || {}, {
        artifactId,
        artifactPath: record.artifactPath,
        password: record.password
      }, req));
    }
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Disposition", `attachment; filename="${artifactId}.json"`);
    res.type("application/json");
    res.send(await fs.readFile(record.artifactPath, "utf8"));
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : "Could not read costing conversion artifact." });
  }
});

app.post("/api/openclaw/costing/offer-manager/context", async (req, res) => {
  const artifactId = String(req.body?.artifact_id || req.body?.artifactId || "").trim();
  const artifact = costingArtifactPasswords.get(artifactId);
  const password = String(req.get("X-FUZI-OpenClaw-Costing-Password") || req.body?.backend_password || req.body?.password || "").trim();
  if (!artifact || artifact.expiresAt < Date.now()) {
    if (artifact) costingArtifactPasswords.delete(artifactId);
    return res.status(404).json({ ok: false, exact_next_prompt_for_codex: openClawCostingNextPrompt("The costing artifact expired before OpenClaw could read Offer Manager context.", { artifact_id: artifactId }) });
  }
  if (!password || password !== artifact.password) {
    return res.status(401).json({ ok: false, exact_next_prompt_for_codex: openClawCostingNextPrompt("Offer Manager context requires the artifact password from the conversion prompt.", { artifact_id: artifactId }) });
  }
  try {
    const [customers, inquiries, siteVisits, estimates] = await Promise.all([
      readJson(listFiles.customers, []),
      readJson(listFiles.sales_inquiries, []),
      readJson(listFiles.site_visits, []),
      readJson(listFiles.estimates, [])
    ]);
    const siteVisitCountByCustomer = new Map();
    for (const visit of siteVisits) {
      const key = String(visit.customer_id || "").trim();
      if (!key) continue;
      siteVisitCountByCustomer.set(key, (siteVisitCountByCustomer.get(key) || 0) + 1);
    }
    const offerCountByCustomer = new Map();
    for (const offer of estimates) {
      const key = String(offer.customer_id || "").trim();
      if (!key) continue;
      offerCountByCustomer.set(key, (offerCountByCustomer.get(key) || 0) + 1);
    }
    const customerOptions = customers.slice(0, 100).map((customer) => {
      const id = String(customer.id || customer.customer_id || "").trim();
      return {
        customer_id: id,
        customer_name: String(customer.name || customer.customer || "").trim(),
        phone: String(customer.phone || customer.mobile || "").trim(),
        address: String(customer.address || customer.site_address || "").trim(),
        source: "CRM customer",
        site_visit_count: siteVisitCountByCustomer.get(id) || 0,
        offer_count: offerCountByCustomer.get(id) || 0
      };
    }).filter((item) => item.customer_id && item.customer_name);
    const inquiryOptions = inquiries.slice(0, 100).map((inquiry) => {
      const customerId = String(inquiry.customer_id || inquiry.id || inquiry.enquiry_no || "").trim();
      return {
        customer_id: customerId,
        customer_name: String(inquiry.customer || inquiry.lead_name || inquiry.name || "").trim(),
        source_inquiry_id: String(inquiry.id || inquiry.enquiry_no || "").trim(),
        phone: String(inquiry.phone || inquiry.whatsapp_no || "").trim(),
        address: String(inquiry.address || inquiry.site_address || inquiry.site || "").trim(),
        status: String(inquiry.status || inquiry.lead_status || "").trim(),
        source: "CRM enquiry",
        site_visit_count: siteVisitCountByCustomer.get(customerId) || 0,
        offer_count: offerCountByCustomer.get(customerId) || 0
      };
    }).filter((item) => item.customer_id && item.customer_name);
    res.json({
      ok: true,
      artifact_id: artifactId,
      instruction: "OpenClaw should choose the best Offer Manager customer/enquiry, then POST that choice as offer_fields to /api/openclaw/costing/offer-manager/save with converted_data.",
      customers: customerOptions,
      inquiries: inquiryOptions
    });
  } catch (error) {
    res.status(500).json({ ok: false, exact_next_prompt_for_codex: openClawCostingNextPrompt("The backend could not provide Offer Manager context for OpenClaw.", { artifact_id: artifactId, error: error instanceof Error ? error.message : String(error) }) });
  }
});

app.post("/api/openclaw/costing/offer-manager/save", async (req, res) => {
  const artifactId = String(req.body?.artifact_id || req.body?.artifactId || "").trim();
  const artifact = costingArtifactPasswords.get(artifactId);
  const password = String(req.get("X-FUZI-OpenClaw-Costing-Password") || req.body?.backend_password || req.body?.password || "").trim();
  if (!artifact || artifact.expiresAt < Date.now()) {
    if (artifact) costingArtifactPasswords.delete(artifactId);
    const exactPrompt = openClawCostingNextPrompt("The costing conversion artifact is missing or expired before OpenClaw could type the converted data into Offer Manager Save offer.", { artifact_id: artifactId });
    return res.status(404).json({ ok: false, exact_next_prompt_for_codex: exactPrompt });
  }
  if (!password || password !== artifact.password) {
    return res.status(401).json({ ok: false, exact_next_prompt_for_codex: openClawCostingNextPrompt("The Offer Manager save emulation endpoint needs the artifact password from the conversion prompt.", { artifact_id: artifactId }) });
  }
  try {
    const convertedData = req.body?.converted_data && typeof req.body.converted_data === "object"
      ? req.body.converted_data
      : JSON.parse(await fs.readFile(artifact.artifactPath, "utf8"));
    const sources = Array.isArray(convertedData.sources) ? convertedData.sources : [];
    const sourceFiles = sources.map((source) => String(source.source_file || "").trim()).filter(Boolean);
    const selectedSourceFile = String(req.body?.selected_source_file || req.body?.selectedSourceFile || sourceFiles[0] || "").trim();
    const selectedSource = sources.find((source) => String(source.source_file || "") === selectedSourceFile) || sources[0] || {};
    const offerFields = req.body?.offer_fields && typeof req.body.offer_fields === "object" ? req.body.offer_fields : {};
    const customerId = String(offerFields.customer_id || req.body?.customer_id || "").trim();
    if (!customerId) {
      const exactPrompt = openClawCostingNextPrompt("OpenClaw has converted the workbooks but did not choose the CRM customer id required by the Offer Manager Save offer section.", {
        endpoint: "/api/openclaw/costing/offer-manager/save",
        missing_field: "offer_fields.customer_id",
        available_action: "Call a FUZI context endpoint or select a CRM customer before retrying the same save endpoint with the converted_data payload."
      });
      return res.status(409).json({ ok: false, exact_next_prompt_for_codex: exactPrompt });
    }
    const offerPayloadInput = {
      ...offerFields,
      customer_id: customerId,
      customer_name: String(offerFields.customer_name || req.body?.customer_name || "").trim(),
      offer_name: String(offerFields.offer_name || offerFields.customer_name || req.body?.customer_name || "").trim(),
      offer_type: String(offerFields.offer_type || selectedSource.variant || "Individual").trim(),
      lead_status: String(offerFields.lead_status || offerFields.status || "Offer Pending").trim(),
      source: "CRM Offer Manager",
      offer_source: String(offerFields.offer_source || "OpenClaw costing import").trim(),
      costing_source_file: String(offerFields.costing_source_file || sourceFiles.join(", ")).trim(),
      expanded_costing_data: convertedData,
      expanded_costing_data_status: String(offerFields.expanded_costing_data_status || `OpenClaw typed converted costing data from ${sourceFiles.length || 1} workbook${sourceFiles.length === 1 ? "" : "s"} into Offer Manager Save offer`).trim(),
      source_snapshot: {
        ...(offerFields.source_snapshot && typeof offerFields.source_snapshot === "object" ? offerFields.source_snapshot : {}),
        costing_artifact_id: artifactId,
        costing_source_file: String(offerFields.costing_source_file || sourceFiles.join(", ")).trim(),
        openclaw_session_key: artifact.sessionKey || costingImportSessionKey,
        save_emulation: "OpenClaw backend Offer Manager Save offer section"
      },
      offer_letter_status: String(offerFields.offer_letter_status || "Prepared").trim()
    };
    const openClawUser = { username: "openclaw", display_name: "OpenClaw", role: "agent", department: "CRM & Sales" };
    const normalizeRes = {
      req: { user: openClawUser },
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return payload;
      }
    };
    const normalizedOffer = await normalizeOfferPayload(offerPayloadInput, normalizeRes);
    if (!normalizedOffer) {
      const exactPrompt = openClawCostingNextPrompt("FUZI rejected the Offer Manager Save offer emulation payload during normal offer validation.", {
        status: normalizeRes.statusCode,
        response: normalizeRes.body || null,
        sent_fields: Object.keys(offerPayloadInput)
      });
      return res.status(normalizeRes.statusCode >= 400 ? normalizeRes.statusCode : 400).json({ ok: false, exact_next_prompt_for_codex: exactPrompt, validation: normalizeRes.body || null });
    }
    const records = await readJson(listFiles.estimates, []);
    const now = new Date().toISOString();
    const recordId = nextId(records, "EST");
    const offer = {
      id: recordId,
      ...normalizedOffer,
      job_no: String(normalizedOffer.job_no || "").trim() || recordId,
      offer_number: String(normalizedOffer.offer_number || normalizedOffer.job_no || "").trim() || recordId,
      created_at: now,
      updated_at: now,
      createdbyname: String(normalizedOffer.createdbyname || "OpenClaw").trim(),
      lastmodifiedbyname: String(normalizedOffer.lastmodifiedbyname || "OpenClaw").trim()
    };
    records.unshift(offer);
    await writeJson(listFiles.estimates, records);
    await appendAuditLog({ user: openClawUser, collection: "estimates", recordId: offer.id, action: "create", before: null, after: offer });
    if (offer.source_inquiry_id) {
      const inquiries = await readJson(listFiles.sales_inquiries, []);
      const inquiryIndex = findRecordIndex(inquiries, offer.source_inquiry_id);
      if (inquiryIndex >= 0) {
        const previousInquiry = inquiries[inquiryIndex];
        inquiries[inquiryIndex] = { ...inquiries[inquiryIndex], lead_status: offer.lead_status, status: offer.lead_status, updated_at: now };
        await writeJson(listFiles.sales_inquiries, inquiries);
        await appendAuditLog({ user: openClawUser, collection: "sales_inquiries", recordId: recordIdentityForAudit(inquiries[inquiryIndex]), action: "update", before: previousInquiry, after: inquiries[inquiryIndex] });
      }
    }
    res.json({
      ok: true,
      action: "offer-manager-save-emulated",
      artifact_id: artifactId,
      exact_next_prompt_for_codex: null,
      saved_offer: {
        id: offer.id,
        job_no: offer.job_no,
        offer_number: offer.offer_number,
        customer_id: offer.customer_id,
        customer_name: offer.customer_name,
        costing_source_file: offer.costing_source_file,
        expanded_costing_data_status: offer.expanded_costing_data_status,
        source_count: sources.length,
        total_values: sources.reduce((sum, source) => sum + Number(source.non_empty_cell_count || 0), 0)
      }
    });
  } catch (error) {
    const exactPrompt = openClawCostingNextPrompt("The backend failed while emulating typing converted costing data into Offer Manager Save offer.", {
      artifact_id: artifactId,
      error: error instanceof Error ? error.message : String(error)
    });
    res.status(500).json({ ok: false, exact_next_prompt_for_codex: exactPrompt });
  }
});

app.post("/api/openclaw/costing/convert", async (req, res) => {
  try {
    const manifest = await listCostingWorkbookManifest();
    const sessionKey = String(req.body?.session_key || req.body?.sessionKey || costingImportSessionKey).trim();
    const orderDecisions = costingOrderDecisionsMap(req.body?.order_decisions || req.body?.orderDecisions || {});
    const defaultOrderMode = normalizeCostingOrderMode(req.body?.default_order_mode || req.body?.defaultOrderMode || "A1");
    const data = attachCostingManifestToSources(await parseCostingWorkbooks({ orderDecisions, defaultOrderMode }), manifest);
    const artifact = await writeCostingConversionArtifact(data, orderDecisions, { manifest, sessionKey });
    res.setHeader("Cache-Control", "no-store");
    res.type("text/plain");
    res.send(costingConversionOpenClawMessage(data, manifest, orderDecisions, artifact, req));
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : "Could not convert costing workbooks." });
  }
});

function marketingAssetPrompt(record = {}, action = "generate-image") {
  const product = String(record.product_line || "FUZI elevators and manufactured lift parts").trim();
  const audience = String(record.audience || "builders, architects, hotels, hospitals, housing societies, and elevator partners").trim();
  const channel = String(record.channel || "social media and catalog").trim();
  const tone = String(record.tone || "premium, trustworthy, safety-focused, modern Indian elevator brand").trim();
  if (action === "draft-catalog") {
    return `Create a polished FUZI company catalog section for ${product}. Audience: ${audience}. Include product benefits, safety/quality claims, use cases, installation/service support, and a concise call to action. Tone: ${tone}.`;
  }
  if (action === "draft-ad-copy") {
    return `Write high-converting ad copy for ${channel} promoting ${product}. Audience: ${audience}. Tone: ${tone}. Include headline, short body, CTA, and 3 variant hooks.`;
  }
  return `Generate an advertising image concept for FUZI Classic Elevators. Product: ${product}. Audience: ${audience}. Channel: ${channel}. Visual style: clean premium elevator showroom or real installation setting, red/white/black FUZI branding, safety and engineering confidence, no clutter, space for headline text. Tone: ${tone}.`;
}

app.post("/api/portal/marketing-assets/:id/openclaw", authRequired, async (req, res) => {
  const records = await readJson(listFiles.marketing_assets, []);
  const index = findRecordIndex(records, req.params.id);
  if (index < 0) return res.status(404).json({ ok: false, message: "Marketing asset not found." });
  const action = String(req.body?.action || "generate-image").trim();
  const prompt = String(req.body?.prompt || records[index].ai_prompt || marketingAssetPrompt(records[index], action)).trim();
  const delivery = await communicationService.sendBusinessChannelUpdate("marketing-platform", {
    agent: "Marketing Platform AI",
    channel: req.body?.channel || "openclaw",
    action,
    asset_id: records[index].id || req.params.id,
    campaign: records[index].campaign_name || records[index].title || "",
    product_line: records[index].product_line || "",
    target_audience: records[index].audience || "",
    prompt,
    instruction: "Use AI/OpenClaw to draft ad creative, image generation prompts, campaign copy, and company catalog content for FUZI. Return concise usable content that the portal can paste into the asset record.",
    summary: `Marketing Platform ${action} requested for ${records[index].campaign_name || records[index].title || req.params.id}.`
  });
  const now = new Date().toISOString();
  records[index] = {
    ...records[index],
    ai_prompt: prompt,
    last_openclaw_action: action,
    last_openclaw_prompt: prompt,
    last_openclaw_at: now,
    delivery_status: delivery.ok ? "Sent to OpenClaw" : "OpenClaw delivery failed",
    status: action === "generate-image" ? "Image requested" : (action === "draft-catalog" ? "Catalog draft requested" : "AI draft requested"),
    updated_at: now
  };
  await writeJson(listFiles.marketing_assets, records);
  res.status(delivery.ok ? 200 : 502).json({ ok: delivery.ok, record: records[index], delivery, prompt });
});

function adminRequired(req, res) {
  if (isAdminUser(req.user)) return true;
  res.status(403).json({ ok: false, message: "Only admin can manage International Vendor records." });
  return false;
}

function numberFromPayload(value, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function realTenderLink(value) {
  const text = String(value || "").trim();
  if (!text || text.toLowerCase() === "view tender") return "";
  return text;
}

function internationalVendorCost(body = {}) {
  const fuziCost = numberFromPayload(body.fuzi_cost);
  const installCost = numberFromPayload(body.install_cost);
  const packageCount = Math.max(1, numberFromPayload(body.package_count, 1));
  const lengthCm = numberFromPayload(body.length_cm);
  const widthCm = numberFromPayload(body.width_cm);
  const heightCm = numberFromPayload(body.height_cm);
  const actualWeightKg = numberFromPayload(body.actual_weight_kg);
  const freightRate = numberFromPayload(body.freight_rate);
  const cbm = lengthCm && widthCm && heightCm ? (lengthCm * widthCm * heightCm * packageCount) / 1000000 : 0;
  const volumetricWeightKg = lengthCm && widthCm && heightCm ? (lengthCm * widthCm * heightCm * packageCount) / 5000 : 0;
  const mode = String(body.freight_mode || "Ocean LCL");
  const chargeableWeightKg = mode.toLowerCase().includes("ocean") ? Math.max(cbm, actualWeightKg / 1000) : Math.max(actualWeightKg, volumetricWeightKg);
  const calculatedFreightCost = freightRate ? Math.round(chargeableWeightKg * freightRate) : 0;
  const shippingCost = numberFromPayload(body.shipping_cost, calculatedFreightCost);
  const customsDutyPercent = numberFromPayload(body.customs_duty_percent);
  const importTaxPercent = numberFromPayload(body.import_tax_percent);
  const brokerFee = numberFromPayload(body.broker_fee);
  const portFee = numberFromPayload(body.port_fee);
  const insurancePercent = numberFromPayload(body.insurance_percent, 1);
  const partnerPercent = numberFromPayload(body.partner_percent, 2);
  const kitBaseCost = Math.max(0, fuziCost - installCost);
  const customsDuty = Math.round((kitBaseCost * customsDutyPercent) / 100);
  const importTax = Math.round(((kitBaseCost + shippingCost + customsDuty) * importTaxPercent) / 100);
  const insuranceCost = Math.round((kitBaseCost * insurancePercent) / 100);
  const landedCost = kitBaseCost + shippingCost + customsDuty + importTax + brokerFee + portFee + insuranceCost;
  const partnerFee = Math.round((landedCost * partnerPercent) / 100);
  const vendorCost = landedCost + partnerFee;
  return { fuzi_cost: fuziCost, install_cost: installCost, package_count: packageCount, length_cm: lengthCm, width_cm: widthCm, height_cm: heightCm, actual_weight_kg: actualWeightKg, cbm, volumetric_weight_kg: volumetricWeightKg, chargeable_weight_kg: chargeableWeightKg, freight_rate: freightRate, calculated_freight_cost: calculatedFreightCost, shipping_cost: shippingCost, customs_duty_percent: customsDutyPercent, customs_duty: customsDuty, import_tax_percent: importTaxPercent, import_tax: importTax, broker_fee: brokerFee, port_fee: portFee, insurance_percent: insurancePercent, insurance_cost: insuranceCost, partner_percent: partnerPercent, kit_base_cost: kitBaseCost, landed_cost: landedCost, partner_fee: partnerFee, vendor_cost: vendorCost };
}

function internationalVendorEmailTemplate(record = {}, stage = "") {
  const company = String(record.company || "").trim();
  const greeting = company ? `Hello ${company}` : "Hello";
  const tenderTitle = String(record.tender_title || record.closest_tender_title || "").trim();
  const tenderArea = String(record.tender_area || record.closest_tender_region || record.region || "your area").trim();
  const tenderDeadline = String(record.tender_deadline || record.closest_tender_deadline || "").trim();
  const tenderRef = String(record.tender_ref || record.closest_tender_ref || "").trim();
  const normalizedStage = String(stage || record.followup_stage || record.pipeline_stage || "").toLowerCase();
  const vendorCost = record.vendor_cost || record.calculated_vendor_cost || "ready to calculate";
  if (normalizedStage.includes("tender") || normalizedStage.includes("bid") || normalizedStage.includes("meeting") || normalizedStage.includes("draft")) {
    const tenderLine = tenderTitle
      ? `We noticed ${tenderTitle} in ${tenderArea}${tenderDeadline ? ` with a deadline of ${tenderDeadline}` : ""}${tenderRef ? `, ref ${tenderRef}` : ""}.`
      : `We noticed an elevator tender/opportunity near ${tenderArea}.`;
    return `${greeting}, a friend mentioned they had used your service, so we wanted to set a short meeting. ${tenderLine} Your company could bid locally while FUZI supplies manufactured elevator parts and kits at a competitive landed cost; our current vendor-cost estimate is ${vendorCost}. Would you be open to a call to discuss partnering on this contract?`;
  }
  if (normalizedStage.includes("cost")) {
    return `${greeting}, FUZI has prepared a landed-cost sheet for ${String(record.destination_country || record.country || "your market").trim()} with freight, duty/tax placeholders, broker fees, insurance, and the 2% local partner margin. The current vendor-cost estimate is ${vendorCost}.`;
  }
  if (normalizedStage.includes("sample") || normalizedStage.includes("smart")) {
    return `${greeting}, FUZI can start with smaller smart elevator parts or sample kits before a heavy shipment. We can quote parts, packing weight, courier/ocean freight, and import assumptions for your local review.`;
  }
  return `${greeting}, FUZI manufactures elevator parts and lift kits internationally. We are looking for USA and Canada elevator companies that can install locally while FUZI supplies manufactured parts and kits. Please reply if you would like our catalog, landed-cost sheet, and partnership terms.`;
}

function normalizeInternationalVendor(body = {}) {
  const cost = internationalVendorCost(body);
  const company = String(body.company || body.name || "").trim();
  const pipelineStage = String(body.pipeline_stage || body.status || "Lead identified").trim();
  return {
    ...cleanPayload(body),
    company,
    country: String(body.country || "Canada").trim(),
    region: String(body.region || body.state || body.province || "").trim(),
    website: String(body.website || "").trim(),
    email: String(body.email || body.contact_email || "").trim(),
    phone: String(body.phone || "").trim(),
    contact_name: String(body.contact_name || body.contact || "").trim(),
    product_interest: String(body.product_interest || "Elevator parts and kits").trim(),
    freight_mode: String(body.freight_mode || "Ocean LCL").trim(),
    destination_country: String(body.destination_country || body.country || "Canada").trim(),
    destination_port: String(body.destination_port || "").trim(),
    tender_area: String(body.tender_area || "").trim(),
    tender_source: String(body.tender_source || "").trim(),
    tender_title: String(body.tender_title || body.closest_tender_title || "").trim(),
    tender_deadline: String(body.tender_deadline || body.closest_tender_deadline || "").trim(),
    tender_ref: String(body.tender_ref || body.closest_tender_ref || "").trim(),
    tender_link: realTenderLink(body.tender_link || body.closest_tender_link),
    closest_tender_title: String(body.closest_tender_title || body.tender_title || "").trim(),
    closest_tender_region: String(body.closest_tender_region || body.tender_area || "").trim(),
    closest_tender_deadline: String(body.closest_tender_deadline || body.tender_deadline || "").trim(),
    closest_tender_ref: String(body.closest_tender_ref || body.tender_ref || "").trim(),
    closest_tender_link: realTenderLink(body.closest_tender_link || body.tender_link),
    friend_referral_note: String(body.friend_referral_note || "A friend mentioned they used your service.").trim(),
    openclaw_email_plan: String(body.openclaw_email_plan || "Draft intro email, request a meeting, follow up with catalog and landed-cost sheet, then support tender bid pricing with FUZI manufactured parts.").trim(),
    outreach_sequence: String(body.outreach_sequence || "1. Tender meeting intro; 2. Catalog and cost sheet; 3. Bid support follow-up; 4. Meeting reminder; 5. Close/lost decision.").trim(),
    bid_value: numberFromPayload(body.bid_value),
    status: String(body.status || pipelineStage).trim(),
    followup_stage: String(body.followup_stage || "1. Catalog intro").trim(),
    pipeline_stage: pipelineStage,
    incoterm: String(body.incoterm || "FOB India").trim(),
    export_docs_status: String(body.export_docs_status || "Not started").trim(),
    production_status: String(body.production_status || "Not started").trim(),
    shipment_status: String(body.shipment_status || "Not booked").trim(),
    tracking_ref: String(body.tracking_ref || body.tracking || "").trim(),
    next_followup: String(body.next_followup || body.next_follow_up || "").trim(),
    openclaw_target: String(body.openclaw_target || "").trim(),
    notes: String(body.notes || "").trim(),
    ...cost,
    calculated_vendor_cost: cost.vendor_cost
  };
}

app.get("/api/portal/international-vendors", authRequired, async (req, res) => {
  if (!adminRequired(req, res)) return;
  const records = await readJson(listFiles.international_vendors, []);
  res.json({ ok: true, international_vendors: records });
});

app.post("/api/portal/international-vendors", authRequired, async (req, res) => {
  if (!adminRequired(req, res)) return;
  const records = await readJson(listFiles.international_vendors, []);
  const vendor = normalizeInternationalVendor(req.body || {});
  if (!vendor.company) return res.status(400).json({ ok: false, message: "Company name is required." });
  const now = new Date().toISOString();
  const record = { id: nextId(records, "IV"), ...vendor, email_template: internationalVendorEmailTemplate(vendor), created_at: now, updated_at: now };
  records.unshift(record);
  await writeJson(listFiles.international_vendors, records);
  res.json({ ok: true, record, international_vendor: record });
});

app.patch("/api/portal/international-vendors/:id", authRequired, async (req, res) => {
  if (!adminRequired(req, res)) return;
  const records = await readJson(listFiles.international_vendors, []);
  const index = findRecordIndex(records, req.params.id);
  if (index < 0) return res.status(404).json({ ok: false, message: "International vendor not found." });
  const updated = normalizeInternationalVendor({ ...records[index], ...cleanPayload(req.body) });
  records[index] = { ...records[index], ...updated, email_template: internationalVendorEmailTemplate(updated), updated_at: new Date().toISOString() };
  await writeJson(listFiles.international_vendors, records);
  res.json({ ok: true, record: records[index], international_vendor: records[index] });
});

app.post("/api/portal/international-vendors/:id/outreach", authRequired, async (req, res) => {
  if (!adminRequired(req, res)) return;
  const records = await readJson(listFiles.international_vendors, []);
  const index = findRecordIndex(records, req.params.id);
  if (index < 0) return res.status(404).json({ ok: false, message: "International vendor not found." });
  const stage = String(req.body?.stage || records[index].followup_stage || "1. Catalog intro").trim();
  const message = String(req.body?.message || internationalVendorEmailTemplate(records[index], stage)).trim();
  const delivery = await communicationService.sendBusinessChannelUpdate("international-vendor-outreach", {
    agent: "International Vendor Partnering",
    channel: req.body?.channel || "email",
    target: req.body?.target || records[index].email || records[index].openclaw_target || "",
    email: records[index].email || "",
    company: records[index].company,
    stage,
    tender: {
      title: records[index].tender_title || records[index].closest_tender_title || "",
      area: records[index].tender_area || records[index].closest_tender_region || records[index].region || "",
      deadline: records[index].tender_deadline || records[index].closest_tender_deadline || "",
      ref: records[index].tender_ref || records[index].closest_tender_ref || "",
      link: records[index].tender_link || records[index].closest_tender_link || ""
    },
    openclaw_email_plan: records[index].openclaw_email_plan || "",
    friend_referral_note: records[index].friend_referral_note || "",
    instruction: "Draft a concise email from FUZI to this elevator company. Mention the closest tender, say a friend mentioned they used the company's service, ask to set a meeting, and explain they can bid locally using FUZI manufactured elevator parts/kits.",
    message,
    summary: `International vendor outreach for ${records[index].company || req.params.id}: ${stage}.`
  });
  records[index] = {
    ...records[index],
    followup_stage: stage,
    pipeline_stage: stage.toLowerCase().includes("draft") ? "OpenClaw email drafted" : (stage.toLowerCase().includes("meeting") ? "Meeting requested" : records[index].pipeline_stage),
    status: stage.toLowerCase().includes("draft") ? "OpenClaw email drafted" : (stage.toLowerCase().includes("meeting") ? "Meeting requested" : records[index].status),
    last_outreach_message: message,
    last_outreach_at: new Date().toISOString(),
    delivery_status: delivery.ok ? "Sent to OpenClaw/email handoff" : "Delivery failed",
    updated_at: new Date().toISOString()
  };
  await writeJson(listFiles.international_vendors, records);
  res.status(delivery.ok ? 200 : 502).json({ ok: delivery.ok, record: records[index], delivery, message });
});

app.post("/api/openclaw/breakdown/from-discord", async (req, res) => {
  const result = await discordBreakdownSyncService.createFromDiscordMessage(req.body || {});
  res.status(result.ok ? 200 : (result.status || 400)).json(result);
});

app.post("/api/openclaw/breakdown/context", async (req, res) => {
  res.status(410).json({
    ok: false,
    deprecated_endpoint: true,
    retry_required: true,
    message: "Do not call /api/openclaw/breakdown/context for breakdown dispatch. Call POST /api/openclaw/breakdown/available-context instead."
  });
});

app.post("/api/openclaw/breakdown/available-context", async (req, res) => {
  const result = await discordBreakdownSyncService.getAvailableAssignmentContext(req.body || {});
  res.status(result.ok ? 200 : (result.status || 400)).json(result);
});

app.get("/api/portal/renewals", authRequired, async (_req, res) => {
  const state = await ensureRenewalCustomerLinks();
  const renewals = Array.isArray(state.renewals) ? state.renewals.map((item, index) => normalizedOpsRecord(item, "REN", index)) : [];
  res.json({ ok: true, renewals });
});

app.post("/api/portal/renewals", authRequired, async (req, res) => {
  const customerId = String(req.body?.customer_id || "").trim();
  const customers = await readJson(listFiles.customers, []);
  const customer = customers.find((item) => String(item.id) === customerId);
  if (!customer) return res.status(400).json({ ok: false, message: "Select a saved customer before creating a maintenance renewal." });
  const state = await readOperationsState();
  const renewals = Array.isArray(state.renewals) ? state.renewals : [];
  const now = new Date().toISOString();
  const renewal = {
    id: nextId(renewals, "REN"),
    customer_id: customerId,
    customer: customer.name,
    building: customer.name,
    contact_email: req.body?.contact_email || customer.email || "",
    contact_phone: customer.phone || "",
    renewal_date: String(req.body?.renewal_date || "").trim(),
    days: Number(req.body?.days || 0),
    value: String(req.body?.value || "Medium").trim(),
    status: String(req.body?.status || "Open").trim(),
    contacted: Boolean(req.body?.contacted),
    notes: String(req.body?.notes || "").trim(),
    created_at: now,
    updated_at: now
  };
  renewals.unshift(renewal);
  state.renewals = renewals;
  await writeOperationsState(state);
  await appendAuditLog({ user: req.user || {}, collection: "renewals", recordId: renewal.id, action: "create", before: null, after: renewal });
  res.json({ ok: true, renewal });
});

app.patch("/api/portal/renewals/:id", authRequired, async (req, res) => {
  await updateOperationsRecord("renewals", req.params.id, req.body, res);
});

app.post("/api/portal/customers", authRequired, async (req, res) => {
  const customers = await readJson(listFiles.customers, []);
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ ok: false, message: "Customer or building name is required." });
  const now = new Date().toISOString();
  const customer = {
    ...cleanPayload(req.body),
    id: randomFourDigitCustomerId(customers),
    name,
    contact_person: String(req.body.contact_person || "").trim(),
    phone: String(req.body.phone || "").trim(),
    email: String(req.body.email || "").trim(),
    address: String(req.body.address || "").trim(),
    segment: String(req.body.segment || "Residential").trim(),
    pipeline_stage: String(req.body.pipeline_stage || "Lead").trim(),
    status: String(req.body.status || "Active").trim(),
    notes: String(req.body.notes || "").trim(),
    created_at: now,
    updated_at: now
  };
  customers.unshift(customer);
  await writeJson(listFiles.customers, customers);
  await ensureServiceJobsForCustomers([customer.id]);
  await appendAuditLog({ user: req.user || {}, collection: "customers", recordId: customer.id, action: "create", before: null, after: customer });
  res.json({ ok: true, customer, message: `${name} saved.` });
});

app.put("/api/portal/customers/:id/assignments", authRequired, async (req, res) => {
  if (!canManageCustomerAssignments(req.user)) {
    return res.status(403).json({ ok: false, message: "Only Admin, Manager, or Team Lead users can modify customer assignments." });
  }
  const customerId = String(req.params.id || "").trim();
  const customers = await readJson(listFiles.customers, []);
  const customer = customers.find((item) => String(item.id || "").trim() === customerId);
  if (!customer) return res.status(404).json({ ok: false, message: "Customer not found." });

  const requested = Array.isArray(req.body?.assignments) ? req.body.assignments : [];
  const directory = await staffDirectory();
  const directoryById = new Map(directory.map((staff) => [staff.id, staff]));
  const directoryByName = new Map(directory.map((staff) => [staffLookupKey(staff.name), staff]));
  const seen = new Set();
  const nextActive = [];
  for (const item of requested) {
    const staffId = String(item?.staff_id || item?.id || "").trim();
    const staffName = String(item?.staff_name || item?.name || "").trim();
    const staff = directoryById.get(staffId) || directoryByName.get(staffLookupKey(staffName));
    if (!staff || seen.has(staff.id)) continue;
    seen.add(staff.id);
    nextActive.push({
      staff_id: staff.id,
      staff_name: staff.name,
      department: staff.department,
      role: staff.role,
      avatar_url: staff.avatar_url,
      primary_owner: Boolean(item?.primary_owner)
    });
  }
  if (nextActive.length && !nextActive.some((item) => item.primary_owner)) nextActive[0].primary_owner = true;

  const now = new Date().toISOString();
  const assignments = await readJson(listFiles.customer_assignments, []);
  const activeForCustomer = assignments.filter((item) => String(item.customer_id || "") === customerId && isActiveAssignment(item));
  const nextStaffIds = new Set(nextActive.map((item) => item.staff_id));
  const nextAssignments = assignments.map((item) => {
    if (String(item.customer_id || "") !== customerId || !isActiveAssignment(item)) return item;
    if (!nextStaffIds.has(String(item.staff_id || ""))) {
      return {
        ...item,
        active_status: false,
        removed_by: req.user?.username || req.user?.display_name || "",
        removed_date: now,
        updated_at: now
      };
    }
    return item;
  });
  for (const staff of nextActive) {
    const existing = activeForCustomer.find((item) => String(item.staff_id || "") === staff.staff_id);
    if (existing) {
      const index = nextAssignments.findIndex((item) => String(item.id || "") === String(existing.id || ""));
      if (index >= 0) {
        nextAssignments[index] = {
          ...nextAssignments[index],
          staff_name: staff.staff_name,
          department: staff.department,
          role: staff.role,
          avatar_url: staff.avatar_url,
          primary_owner: staff.primary_owner,
          updated_at: now
        };
      }
      continue;
    }
    nextAssignments.unshift({
      id: nextId(nextAssignments, "CTA"),
      customer_id: customerId,
      staff_id: staff.staff_id,
      staff_name: staff.staff_name,
      department: staff.department,
      role: staff.role,
      avatar_url: staff.avatar_url,
      primary_owner: staff.primary_owner,
      assigned_by: req.user?.display_name || req.user?.username || "",
      assigned_by_username: req.user?.username || "",
      assigned_date: now,
      active_status: true,
      created_at: now,
      updated_at: now
    });
  }
  const activeRecords = nextAssignments
    .filter((item) => String(item.customer_id || "") === customerId && isActiveAssignment(item))
    .sort((a, b) => Number(Boolean(b.primary_owner)) - Number(Boolean(a.primary_owner)) || String(a.staff_name || "").localeCompare(String(b.staff_name || "")));

  const customerIndex = customers.findIndex((item) => String(item.id || "").trim() === customerId);
  customers[customerIndex] = {
    ...customers[customerIndex],
    assigned_staff_ids: activeRecords.map((item) => item.staff_id),
    assigned_team_summary: activeRecords.map((item) => `${item.staff_name}${item.department ? ` - ${item.department}` : ""}`).join("; "),
    primary_account_owner: activeRecords.find((item) => item.primary_owner)?.staff_name || activeRecords[0]?.staff_name || "",
    updated_at: now
  };

  await Promise.all([
    writeJson(listFiles.customer_assignments, nextAssignments),
    writeJson(listFiles.customers, customers)
  ]);
  res.json({ ok: true, customer: customers[customerIndex], assignments: activeRecords });
});

function departmentDurationHours(start, end = new Date().toISOString()) {
  const startDate = new Date(String(start || ""));
  const endDate = new Date(String(end || ""));
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0;
  return Math.max(0, Number(((endDate.getTime() - startDate.getTime()) / 36e5).toFixed(2)));
}

function departmentBusinessDays(start, end = new Date().toISOString()) {
  const startDate = new Date(String(start || ""));
  const endDate = new Date(String(end || ""));
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0;
  let days = 0;
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);
  const finish = new Date(endDate);
  finish.setHours(0, 0, 0, 0);
  while (cursor <= finish) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) days += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

app.put("/api/portal/projects/customers/:id/department", authRequired, async (req, res) => {
  if (!canManageCustomerAssignments(req.user)) {
    return res.status(403).json({ ok: false, message: "Only Admin, Manager, or Team Lead users can move customer projects between departments." });
  }
  const customerId = String(req.params.id || "").trim();
  const nextDepartment = String(req.body?.department_id || req.body?.department || "").trim();
  if (!nextDepartment) return res.status(400).json({ ok: false, message: "Department is required." });
  const now = new Date().toISOString();
  const [customers, assignments, timeEntries, history] = await Promise.all([
    readJson(listFiles.customers, []),
    readJson(listFiles.department_assignments, []),
    readJson(listFiles.time_tracking, []),
    readJson(listFiles.department_history, [])
  ]);
  const customer = customers.find((item) => String(item.id || "") === customerId);
  if (!customer) return res.status(404).json({ ok: false, message: "Customer not found." });
  const active = assignments.find((item) => String(item.customer_id || "") === customerId && isActiveAssignment(item));
  if (active && String(active.department_id || "") === nextDepartment) {
    return res.json({ ok: true, assignment: active, history: history.filter((item) => String(item.customer_id || "") === customerId) });
  }
  const nextAssignments = assignments.map((item) => {
    if (String(item.customer_id || "") !== customerId || !isActiveAssignment(item)) return item;
    return {
      ...item,
      active_status: false,
      completed_date: now,
      exited_at: now,
      total_hours: departmentDurationHours(item.assigned_date || item.entered_at, now),
      business_days: departmentBusinessDays(item.assigned_date || item.entered_at, now),
      updated_at: now
    };
  });
  if (active) {
    history.unshift({
      id: nextId(history, "DH"),
      customer_id: customerId,
      department_id: String(active.department_id || active.department || ""),
      entered_at: active.assigned_date || active.entered_at || active.created_at || now,
      exited_at: now,
      duration_hours: departmentDurationHours(active.assigned_date || active.entered_at || active.created_at, now),
      business_days: departmentBusinessDays(active.assigned_date || active.entered_at || active.created_at, now),
      moved_by: req.user?.username || "",
      created_at: now
    });
  }
  const nextAssignment = {
    id: nextId(nextAssignments, "DA"),
    customer_id: customerId,
    project_name: String(req.body?.project_name || customer.project_name || customer.name || "").trim(),
    department_id: nextDepartment,
    department_owner: String(req.body?.department_owner || "").trim(),
    status: String(req.body?.status || "Active").trim(),
    priority: String(req.body?.priority || "Normal").trim(),
    assigned_by: req.user?.display_name || req.user?.username || "",
    assigned_by_username: req.user?.username || "",
    assigned_date: now,
    entered_at: now,
    completed_date: "",
    total_hours: 0,
    active_status: true,
    created_at: now,
    updated_at: now
  };
  nextAssignments.unshift(nextAssignment);
  const nextTimeEntries = timeEntries.map((item) => {
    if (String(item.customer_id || "") !== customerId || !isActiveAssignment(item) || item.end_time) return item;
    return {
      ...item,
      end_time: now,
      total_hours: departmentDurationHours(item.start_time, now),
      active_status: false,
      updated_at: now
    };
  });
  nextTimeEntries.unshift({
    id: nextId(nextTimeEntries, "TT"),
    customer_id: customerId,
    department_id: nextDepartment,
    staff_id: String(req.body?.staff_id || ""),
    staff_name: String(req.body?.staff_name || ""),
    start_time: now,
    end_time: "",
    total_hours: 0,
    tasks_completed: Number(req.body?.tasks_completed || 0),
    last_activity: now,
    active_status: true,
    created_at: now,
    updated_at: now
  });
  await Promise.all([
    writeJson(listFiles.department_assignments, nextAssignments),
    writeJson(listFiles.time_tracking, nextTimeEntries),
    writeJson(listFiles.department_history, history)
  ]);
  res.json({ ok: true, assignment: nextAssignment, history: history.filter((item) => String(item.customer_id || "") === customerId) });
});

app.post("/api/portal/projects/time-tracking", authRequired, async (req, res) => {
  const customerId = String(req.body?.customer_id || "").trim();
  const departmentId = String(req.body?.department_id || req.body?.department || "").trim();
  const staffId = String(req.body?.staff_id || "").trim();
  if (!customerId || !departmentId) return res.status(400).json({ ok: false, message: "Customer and department are required." });
  const now = new Date().toISOString();
  const records = await readJson(listFiles.time_tracking, []);
  const startTime = String(req.body?.start_time || now).trim();
  const endTime = String(req.body?.end_time || "").trim();
  const record = {
    id: nextId(records, "TT"),
    customer_id: customerId,
    department_id: departmentId,
    staff_id: staffId,
    staff_name: String(req.body?.staff_name || "").trim(),
    start_time: startTime,
    end_time: endTime,
    total_hours: endTime ? departmentDurationHours(startTime, endTime) : Number(req.body?.total_hours || 0),
    tasks_completed: Number(req.body?.tasks_completed || 0),
    last_activity: String(req.body?.last_activity || now).trim(),
    notes: String(req.body?.notes || "").trim(),
    active_status: !endTime,
    created_at: now,
    updated_at: now
  };
  records.unshift(record);
  await writeJson(listFiles.time_tracking, records);
  res.json({ ok: true, record });
});

app.post("/api/portal/users", authRequired, async (req, res) => {
  if (!isAdminUser(req.user)) return res.status(403).json({ ok: false, message: "Admin access required." });
  const users = await readJson(listFiles.users, []);
  const username = String(req.body?.username || "").trim().toLowerCase();
  if (!username) return res.status(400).json({ ok: false, message: "Username is required." });
  if (users.some((user) => String(user.username || "").toLowerCase() === username)) {
    return res.status(409).json({ ok: false, message: "Username already exists." });
  }
  const user = {
    id: nextId(users, "USR"),
    username,
    display_name: String(req.body?.display_name || username).trim(),
    role: normalizePortalRole(req.body?.role || "staff"),
    department: String(req.body?.department || "").trim(),
    linked_org_node: String(req.body?.linked_org_node || "").trim(),
    active: req.body?.active !== false,
    must_change_password: false,
    password_policy: "shared-staff-portal",
    password_hash: req.body?.password ? makeWerkzeugScryptHash(String(req.body.password)) : sharedStaffPortalPasswordHash(),
    created_at: new Date().toISOString()
  };
  users.unshift(user);
  await writeJson(listFiles.users, users);
  res.json({ ok: true, user: publicUser(user) });
});

app.post("/api/portal/users/sync-staff", authRequired, async (_req, res) => {
  if (!isAdminUser(_req.user)) return res.status(403).json({ ok: false, message: "Admin access required." });
  const before = await readJson(listFiles.users, []);
  const users = await ensureStaffPortalUsers();
  const after = await readJson(listFiles.users, []);
  res.json({
    ok: true,
    created: Math.max(0, after.length - before.length),
    users: after.map(publicUser),
    message: "Staff login accounts synced from the org chart."
  });
});

app.patch("/api/portal/users/:id", authRequired, async (req, res) => {
  if (!isAdminUser(req.user)) return res.status(403).json({ ok: false, message: "Admin access required." });
  const users = await readJson(listFiles.users, []);
  const index = findRecordIndex(users, req.params.id);
  if (index < 0) return res.status(404).json({ ok: false, message: "User not found." });
  const nextUsername = req.body?.username ? String(req.body.username).trim().toLowerCase() : users[index].username;
  if (users.some((user, userIndex) => userIndex !== index && String(user.username || "").toLowerCase() === nextUsername)) {
    return res.status(409).json({ ok: false, message: "Username already exists." });
  }
  const patch = cleanPayload(req.body);
  delete patch.password;
  delete patch.temporary_password;
  delete patch.reset_shared_password;
  if (patch.role) patch.role = normalizePortalRole(patch.role);
  const nextUser = {
    ...users[index],
    ...patch,
    username: nextUsername,
    ...(req.body?.password || req.body?.temporary_password || req.body?.reset_shared_password ? {
      password_hash: req.body?.reset_shared_password
        ? sharedStaffPortalPasswordHash()
        : makeWerkzeugScryptHash(String(req.body.password || req.body.temporary_password)),
      must_change_password: false,
      password_policy: "shared-staff-portal",
      password_synced_at: new Date().toISOString()
    } : {}),
    updated_at: new Date().toISOString()
  };
  users[index] = nextUser;
  await writeJson(listFiles.users, users);
  for (const [token, user] of tokens.entries()) {
    if (String(user.user?.id) === String(nextUser.id)) tokens.set(token, { ...user, user: nextUser });
  }
  res.json({ ok: true, record: publicUser(nextUser), user: publicUser(nextUser) });
});

app.patch("/api/portal/customers/:id", authRequired, async (req, res) => {
  await updateCollectionRecord("customers", req.params.id, req.body, res);
});

app.delete("/api/portal/customers/:id", authRequired, async (req, res) => {
  if (!isAdminUser(req.user)) return res.status(403).json({ ok: false, message: "Only admin can remove CRM customer records." });
  await deleteCollectionRecord("customers", req.params.id, res);
});

app.post("/api/portal/install-jobs", authRequired, async (req, res) => {
  const customerId = String(req.body?.customer_id || "").trim();
  const customers = await readJson(listFiles.customers, []);
  const customer = customers.find((item) => String(item.id) === customerId);
  if (!customer) return res.status(400).json({ ok: false, message: "Select a saved customer before creating an installation job." });
  await createCollectionRecord("install-jobs", {
    ...req.body,
    customer_id: customerId,
    customer: customer.name,
    customer_phone: customer.phone || "",
    customer_address: customer.address || ""
  }, res);
});

app.post("/api/portal/breakdown", authRequired, async (req, res) => {
  const customerId = String(req.body?.customer_id || "").trim();
  const customers = await readJson(listFiles.customers, []);
  const inquiries = await readJson(listFiles.sales_inquiries, []);
  const customer = customers.find((item) => String(item.id) === customerId) ||
    inquiries.find((item) => String(item.customer_id || item.id || item.enquiry_no || "") === customerId);
  if (!customer) return res.status(400).json({ ok: false, message: "Select a saved customer before logging a breakdown call." });
  await createCollectionRecord("breakdown", {
    ...req.body,
    customer_id: customerId,
    customer: customer.name || customer.customer || customer.lead_name || customer.contact_name || customerId,
    customer_phone: customer.phone || customer.whatsapp_no || "",
    customer_address: customer.address || customer.site_address || customer.site || "",
    location: req.body?.location || customer.address || customer.site_address || customer.site || ""
  }, res);
});

app.post("/api/portal/breakdown/sync-discord", authRequired, async (req, res) => {
  const result = await discordBreakdownSyncService.sync({
    force: req.body?.force !== false,
    limit: Number(req.body?.limit || 50)
  });
  if (!result.ok) result.message = await discordBreakdownSyncErrorMessage(result);
  res.status(result.ok ? 200 : 502).json(result);
});

app.patch("/api/portal/breakdown-engineer-task", authRequired, async (req, res) => {
  const engineerName = String(req.body?.engineer || req.body?.name || "").trim();
  const engineerId = String(req.body?.engineer_id || req.body?.org_id || req.body?.id || "").trim();
  if (!engineerName && !engineerId) return res.status(400).json({ ok: false, message: "Engineer name or id is required." });
  const orgChart = await readJson(listFiles.org_chart, []);
  const index = orgChart.findIndex((person) =>
    Boolean(
      (engineerId && String(person.id || "").trim() === engineerId) ||
      (engineerName && String(person.name || "").trim().toLowerCase() === engineerName.toLowerCase())
    ) &&
    String(person.department || "").trim().toLowerCase() === "breakdown" &&
    !String(person.title || "").toLowerCase().includes("supervisor")
  );
  if (index < 0) {
    return res.status(404).json({ ok: false, message: "Only saved Breakdown staff engineers can have their current task changed from Breakdown Portal." });
  }
  const task = String(req.body?.current_job || req.body?.current_task || req.body?.task || "").trim();
  const nextAvailable = String(req.body?.next_available_at || "").trim();
  const record = {
    ...orgChart[index],
    current_job: task,
    current_task: task,
    availability: task ? "Scheduled" : "Available",
    next_available_at: task ? (nextAvailable || orgChart[index].next_available_at || "after current task") : "",
    updated_at: new Date().toISOString()
  };
  orgChart[index] = record;
  await writeJson(listFiles.org_chart, orgChart);
  let clearedBreakdowns = [];
  if (!task) {
    const engineerKey = String(record.name || engineerName || "").trim().toLowerCase();
    const breakdowns = await readJson(listFiles.breakdowns, []);
    let changedBreakdowns = false;
    clearedBreakdowns = breakdowns.filter((item) => {
      const status = String(item.status || "").trim().toLowerCase();
      if (["closed", "resolved", "done", "cancelled"].includes(status)) return false;
      const assigned = String(item.engineer || item.assigned_to || item.scheduled_engineer || item.technician || "").trim().toLowerCase();
      return engineerKey && assigned === engineerKey;
    }).map((item) => String(item.id || "").trim()).filter(Boolean);
    if (clearedBreakdowns.length) {
      const clearedSet = new Set(clearedBreakdowns);
      const nextBreakdowns = breakdowns.map((item) => {
        if (!clearedSet.has(String(item.id || "").trim())) return item;
        changedBreakdowns = true;
        const status = String(item.status || "").trim();
        return {
          ...item,
          scheduled_engineer: "",
          engineer: "",
          assigned_to: "",
          technician: "",
          engineer_availability: "Unassigned after task clear",
          assignment_source: "task-cleared",
          status: ["scheduled", "dispatched"].includes(status.toLowerCase()) ? "Open" : status,
          updated_at: new Date().toISOString()
        };
      });
      if (changedBreakdowns) await writeJson(listFiles.breakdowns, nextBreakdowns);
    }
  }
  const displayName = String(record.name || engineerName || engineerId);
  const assigned_waiting_breakdowns = task ? [] : await discordBreakdownSyncService.assignWaitingBreakdowns();
  res.json({ ok: true, record, cleared_breakdowns: clearedBreakdowns, assigned_waiting_breakdowns, message: task ? `${displayName}'s current task updated.` : `${displayName} marked available with no current task.` });
});

app.post("/api/portal/site-visits", authRequired, async (req, res) => {
  const customerLink = await siteVisitCrmCustomerPayload(req.body, res);
  if (!customerLink) return;
  const siteVisits = await readJson(listFiles.site_visits, []);
  const now = new Date().toISOString();
  const visitNumber = siteVisits.filter((visit) => String(visit.customer_id || "") === String(customerLink.customer_id || "")).length + 1;
  const siteVisit = {
    ...req.body,
    id: nextId(siteVisits, "SV"),
    visit_number: visitNumber,
    ...customerLink,
    submitted_by: req.user?.display_name || req.user?.username || "",
    submitted_by_username: req.user?.username || "",
    submitted_by_department: req.user?.department || "",
    submitted_by_staff_id: req.user?.linked_org_node || "",
    created_at: now,
    updated_at: now
  };
  siteVisits.unshift(siteVisit);
  await writeJson(listFiles.site_visits, siteVisits);
  await appendAuditLog({ user: req.user || {}, collection: "site_visits", recordId: siteVisit.id, action: "create", before: null, after: siteVisit });
  res.json({ ok: true, site_visit: siteVisit, message: `Site visit report saved for ${customerLink.customer_name}.` });
});

app.patch("/api/portal/site-visits/:id", authRequired, async (req, res) => {
  const id = String(req.params.id || "");
  const customerLink = await siteVisitCrmCustomerPayload(req.body, res);
  if (!customerLink) return;
  const siteVisits = await readJson(listFiles.site_visits, []);
  const index = siteVisits.findIndex((visit) => String(visit.id || "") === id);
  if (index === -1) return res.status(404).json({ ok: false, message: "Site visit report not found." });
  const siteVisit = {
    ...siteVisits[index],
    ...req.body,
    id,
    ...customerLink,
    updated_by: req.user?.display_name || req.user?.username || "",
    updated_by_username: req.user?.username || "",
    updated_at: new Date().toISOString()
  };
  const previousVisit = siteVisits[index];
  siteVisits[index] = siteVisit;
  await writeJson(listFiles.site_visits, siteVisits);
  await appendAuditLog({ user: req.user || {}, collection: "site_visits", recordId: siteVisit.id, action: "update", before: previousVisit, after: siteVisit });
  res.json({ ok: true, site_visit: siteVisit, message: `Site visit report updated for ${siteVisit.customer_name}.` });
});

app.get("/api/portal/sales/inquiries", authRequired, async (_req, res) => {
  const records = await readJson(listFiles.sales_inquiries, []);
  res.json({ ok: true, sales_inquiries: records.map((record) => normalizeSalesInquiryPayload(record, record)), records });
});

app.post("/api/portal/sales/inquiries", authRequired, async (req, res) => {
  const records = await readJson(listFiles.sales_inquiries, []);
  const customers = await readJson(listFiles.customers, []);
  const now = new Date().toISOString();
  const inquiry = {
    id: nextId(records, "INQ"),
    ...normalizeSalesInquiryPayload(req.body),
    customer_id: String(req.body?.customer_id || "").trim() || randomFourDigitCustomerId([...customers, ...records]),
    created_at: now,
    updated_at: now
  };
  if (!inquiry.customer) return res.status(400).json({ ok: false, message: "Lead/customer name is required for enquiry intake." });
  records.unshift(inquiry);
  await writeJson(listFiles.sales_inquiries, records);
  await appendAuditLog({ user: req.user || {}, collection: "sales_inquiries", recordId: inquiry.id, action: "create", before: null, after: inquiry });
  res.json({ ok: true, inquiry, record: inquiry });
});

app.patch("/api/portal/sales/inquiries/:id", authRequired, async (req, res) => {
  const records = await readJson(listFiles.sales_inquiries, []);
  const index = findRecordIndex(records, req.params.id);
  if (index < 0) return res.status(404).json({ ok: false, message: "Sales inquiry not found." });
  const previousInquiry = records[index];
  records[index] = {
    ...normalizeSalesInquiryPayload(req.body, records[index]),
    updated_at: new Date().toISOString()
  };
  await writeJson(listFiles.sales_inquiries, records);
  await appendAuditLog({ user: req.user || {}, collection: "sales_inquiries", recordId: recordIdentityForAudit(records[index]), action: "update", before: previousInquiry, after: records[index] });
  res.json({ ok: true, inquiry: records[index], record: records[index] });
});

app.post("/api/portal/sales/inquiries/:id/convert-customer", authRequired, async (req, res) => {
  const [records, customers, deptComms] = await Promise.all([
    readJson(listFiles.sales_inquiries, []),
    readJson(listFiles.customers, []),
    readJson(listFiles.dept_comms, [])
  ]);
  const index = findRecordIndex(records, req.params.id);
  if (index < 0) return res.status(404).json({ ok: false, message: "Sales inquiry not found." });
  const inquiry = records[index];
  const incoming = salesInquiryCustomerPayload(inquiry, req.user);
  if (!incoming.name) return res.status(400).json({ ok: false, message: "Inquiry needs a customer name before conversion." });
  const phone = phoneDigits(incoming.phone);
  const existingIndex = customers.findIndex((customer) => {
    const sameId = incoming.id && String(customer.id || "") === incoming.id;
    const samePhone = phone && phoneDigits(customer.phone || customer.mobile || "") === phone;
    const sameSource = String(customer.source_inquiry_id || "") === String(inquiry.id || inquiry.enquiry_no || "");
    return sameId || samePhone || sameSource;
  });
  const now = new Date().toISOString();
  let customer;
  if (existingIndex >= 0) {
    customer = {
      ...customers[existingIndex],
      ...Object.fromEntries(Object.entries(incoming).filter(([, value]) => String(value || "").trim())),
      updated_at: now,
      last_converted_from_inquiry_at: now
    };
    customers[existingIndex] = customer;
  } else {
    const nextIdValue = incoming.id || randomFourDigitCustomerId([...customers, ...records]);
    customer = {
      ...incoming,
      id: nextIdValue,
      created_at: now,
      updated_at: now,
      converted_from_inquiry_at: now,
      converted_by: req.user?.display_name || req.user?.username || ""
    };
    customers.unshift(customer);
  }
  records[index] = {
    ...inquiry,
    customer_id: customer.id,
    crm_customer_id: customer.id,
    converted_to_customer: true,
    converted_to_customer_at: now,
    status: String(inquiry.status || inquiry.lead_status || "Converted").includes("Converted") ? inquiry.status : "Converted to CRM",
    lead_status: String(inquiry.lead_status || "Converted").includes("Converted") ? inquiry.lead_status : "Converted to CRM",
    updated_at: now
  };
  deptComms.unshift({
    id: nextId(deptComms, "MSG"),
    department: "CRM",
    notification_type: "sales-inquiry-converted",
    subject: `Inquiry converted: ${customer.name}`,
    message: `Sales inquiry ${inquiry.enquiry_no || inquiry.id || req.params.id} was converted to CRM customer ${customer.id}.`,
    status: "Unread",
    read: false,
    customer_id: customer.id,
    inquiry_id: inquiry.id || inquiry.enquiry_no || "",
    created_by: req.user?.display_name || req.user?.username || "",
    created_at: now
  });
  await Promise.all([
    writeJson(listFiles.customers, customers),
    writeJson(listFiles.sales_inquiries, records),
    writeJson(listFiles.dept_comms, deptComms)
  ]);
  res.json({ ok: true, customer, inquiry: records[index], created: existingIndex < 0 });
});

app.delete("/api/portal/sales/inquiries/:id", authRequired, async (req, res) => {
  if (!isAdminUser(req.user)) return res.status(403).json({ ok: false, message: "Only admin can remove CRM enquiry records." });
  const records = await readJson(listFiles.sales_inquiries, []);
  const nextRecords = records.filter((record) => findRecordIndex([record], req.params.id) !== 0);
  if (nextRecords.length === records.length) return res.status(404).json({ ok: false, message: "Sales inquiry not found." });
  await writeJson(listFiles.sales_inquiries, nextRecords);
  res.json({ ok: true });
});

app.get("/api/portal/sales/admin-panel", authRequired, async (_req, res) => {
  await listCollection("sales/admin-panel", res);
});

app.post("/api/portal/sales/admin-panel", authRequired, async (req, res) => {
  await createCollectionRecord("sales/admin-panel", req.body, res);
});

app.get("/api/portal/inventory/ai-insights", authRequired, async (_req, res) => {
  const inventory = await readJson(listFiles.inventory, []);
  const normalized = inventory.map(normalizeInventoryItem);
  const low_stock = normalized.filter((item) => item.available_stock <= item.reorder_point);
  res.json({ ok: true, low_stock, recommendations: low_stock.map((item) => `Reorder ${item.item || item.name || item.id}.`) });
});

app.get("/api/portal/costing-source-data", authRequired, async (req, res) => {
  try {
    const manifest = await listCostingWorkbookManifest();
    const data = attachCostingManifestToSources(await parseCostingWorkbooks(), manifest);
    res.json({ ok: true, manifest, ...data });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : "Could not read costing source files." });
  }
});

app.post("/api/portal/costing-source-data/openclaw-import", authRequired, async (req, res) => {
  try {
    const manifest = await listCostingWorkbookManifest();
    const sessionKey = String(req.body?.session_key || req.body?.sessionKey || costingImportSessionKey).trim();
    const manifestDelivery = await communicationService.sendSessionMessage(
      sessionKey,
      costingManifestOpenClawMessage(manifest, req),
      { event_type: "costing-workbook-manifest", source_count: manifest.source_count }
    );
    const orderDecisions = costingOrderDecisionsMap(req.body?.order_decisions || req.body?.orderDecisions || {});
    const defaultOrderMode = normalizeCostingOrderMode(req.body?.default_order_mode || req.body?.defaultOrderMode || "A1");
    const data = attachCostingManifestToSources(await parseCostingWorkbooks({ orderDecisions, defaultOrderMode }), manifest);
    const artifact = await writeCostingConversionArtifact(data, orderDecisions, { manifest, sessionKey });
    const resultDelivery = await communicationService.sendSessionMessage(
      sessionKey,
      costingConversionOpenClawMessage(data, manifest, orderDecisions, artifact, req),
      { event_type: "costing-workbook-conversion-result", source_count: data.source_count || 0 }
    );
    res.status(manifestDelivery.ok || resultDelivery.ok ? 200 : 202).json({
      ok: true,
      manifest,
      order_decisions: orderDecisions,
      artifact_id: artifact.artifactId,
      artifact_path: artifact.artifactPath,
      ...data,
      openclaw: {
        session_key: sessionKey,
        manifest_delivery: manifestDelivery,
        conversion_delivery: resultDelivery
      }
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : "Could not send costing source data to OpenClaw." });
  }
});

app.post("/api/portal/inventory/raise-po", authRequired, async (req, res) => {
  const records = await readJson(listFiles.inventory, []);
  const itemId = String(req.body?.item_id || req.body?.id || "").trim();
  const index = itemId ? findRecordIndex(records, itemId) : -1;
  const now = new Date().toISOString();
  const poNumber = String(req.body?.po_number || `PO-${Date.now()}`).trim();
  const requestedQty = inventoryNumber(req.body?.quantity ?? req.body?.reorder_qty);
  const purchaseOrder = {
    id: poNumber,
    item_id: itemId,
    item_name: String(req.body?.item_name || req.body?.name || "").trim(),
    vendor: String(req.body?.vendor || "").trim(),
    quantity: requestedQty,
    customer_id: String(req.body?.customer_id || "").trim(),
    customer_name: String(req.body?.customer_name || req.body?.customer || "").trim(),
    offer_id: String(req.body?.offer_id || req.body?.estimate_id || "").trim(),
    offer_name: String(req.body?.offer_name || "").trim(),
    status: "Raised",
    created_at: now
  };
  if (index >= 0) {
    const item = normalizeInventoryItem(records[index]);
    const quantity = requestedQty || item.reorder_qty || Math.max(item.reorder_point, 1);
    const poHistory = Array.isArray(item.po_history) ? item.po_history : [];
    records[index] = normalizeInventoryItem({
      ...item,
      po_number: poNumber,
      po_status: "Raised",
      reorder_qty: quantity,
      vendor: req.body?.vendor || item.vendor,
      po_history: [{ ...purchaseOrder, quantity, item_name: item.name, vendor: req.body?.vendor || item.vendor }, ...poHistory],
      updated_at: now,
      last_updated: now
    });
    await writeJson(listFiles.inventory, records);
    return res.json({ ok: true, purchase_order: { ...purchaseOrder, quantity, item_name: item.name }, item: records[index] });
  }
  res.json({ ok: true, purchase_order: purchaseOrder });
});

app.post("/api/portal/inventory/:id/adjust", authRequired, async (req, res) => {
  const records = await readJson(listFiles.inventory, []);
  const index = findRecordIndex(records, req.params.id);
  if (index < 0) return res.status(404).json({ ok: false, message: "Inventory item not found." });
  const delta = Number(req.body?.delta ?? req.body?.quantity ?? 0);
  const stockKey = "qty_on_hand";
  records[index] = {
    ...records[index],
    [stockKey]: Number(records[index][stockKey] ?? records[index].stock ?? 0) + delta,
    last_adjustment: {
      delta,
      reason: String(req.body?.reason || "").trim(),
      created_at: new Date().toISOString()
    },
    updated_at: new Date().toISOString(),
    last_updated: new Date().toISOString()
  };
  records[index] = normalizeInventoryItem(records[index]);
  await writeJson(listFiles.inventory, records);
  res.json({ ok: true, item: records[index] });
});

app.post("/api/portal/inventory", authRequired, async (req, res) => {
  const records = await readJson(listFiles.inventory, []);
  const item = normalizeInventoryPayload(req.body);
  if (!item.name) return res.status(400).json({ ok: false, message: "Inventory item name is required." });
  const now = new Date().toISOString();
  const record = normalizeInventoryItem({ id: nextId(records, "INV"), ...item, created_at: now, updated_at: now, last_updated: now });
  records.unshift(record);
  await writeJson(listFiles.inventory, records);
  res.json({ ok: true, record, inventory: record });
});

app.patch("/api/portal/inventory/:id", authRequired, async (req, res) => {
  const records = await readJson(listFiles.inventory, []);
  const index = findRecordIndex(records, req.params.id);
  if (index < 0) return res.status(404).json({ ok: false, message: "Inventory item not found." });
  records[index] = normalizeInventoryItem({
    ...records[index],
    ...cleanPayload(req.body),
    updated_at: new Date().toISOString(),
    last_updated: new Date().toISOString()
  });
  await writeJson(listFiles.inventory, records);
  res.json({ ok: true, record: records[index], item: records[index] });
});

app.post("/api/portal/estimates/calculate", authRequired, async (req, res) => {
  const base = Number(req.body?.base_cost || req.body?.material_cost || 0);
  const markup = Number(req.body?.markup_percent || req.body?.markup || 15);
  const total_cost = Math.round(base + (base * markup) / 100);
  res.json({ ok: true, estimate: { ...cleanPayload(req.body), base_cost: base, markup_percent: markup, total_cost } });
});

app.get("/api/portal/estimates/:id/report", authRequired, async (req, res) => {
  const estimates = await readJson(listFiles.estimates, []);
  const estimate = estimates.find((item) => String(item.id) === String(req.params.id));
  if (!estimate) return res.status(404).send("Estimate not found.");
  const cost = offerCostSummary(estimate);
  res.type("html").send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>FUZI Internal Costing ${htmlEscape(estimate.id)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; color: #14151a; }
    h1 { margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin: 18px 0; }
    th, td { border: 1px solid #d9dde7; padding: 9px; text-align: left; }
    th { background: #f5f7fb; }
    pre { white-space: pre-wrap; background: #f8fafc; border: 1px solid #d9dde7; padding: 12px; }
  </style>
</head>
<body>
  <h1>Internal Costing Report ${htmlEscape(estimate.id)}</h1>
  <p>${htmlEscape(estimate.customer_name || "-")} - Customer ${htmlEscape(estimate.customer_id || "-")}</p>
  <table>
    <tr><th>Material cost</th><td>${moneyInr(cost.materialCost)}</td></tr>
    <tr><th>Install cost</th><td>${moneyInr(cost.installCost)}</td></tr>
    <tr><th>Overhead</th><td>${moneyInr(cost.overheadCost)}</td></tr>
    <tr><th>Margin</th><td>${htmlEscape(cost.marginPercent)}% (${moneyInr(cost.marginAmount)})</td></tr>
    <tr><th>Discount</th><td>${moneyInr(cost.discount)}</td></tr>
    <tr><th>GST</th><td>${htmlEscape(cost.gstPercent)}% (${moneyInr(cost.gstAmount)})</td></tr>
    <tr><th>Client offer value</th><td><strong>${moneyInr(cost.totalCost)}</strong></td></tr>
  </table>
  <h2>Full saved costing data</h2>
  <pre>${htmlEscape(JSON.stringify(estimate, null, 2))}</pre>
</body>
</html>`);
});

app.get("/api/portal/estimates/:id/offer.:format", authRequired, async (req, res) => {
  const estimates = await readJson(listFiles.estimates, []);
  const estimate = estimates.find((item) => String(item.id) === String(req.params.id));
  if (!estimate) return res.status(404).send("Estimate not found.");
  const format = String(req.params.format || "pdf").toLowerCase();
  if (format === "pdf") {
    try {
      const pdf = await buildOfferLetterPdf(estimate);
      const fileName = `${String(estimate.job_no || estimate.id || req.params.id).replace(/[^a-z0-9._-]+/gi, "-")}-offer-letter.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
      res.setHeader("Content-Length", String(pdf.length));
      return res.send(pdf);
    } catch (error) {
      return res.status(500).json({ ok: false, message: error instanceof Error ? error.message : "Offer PDF could not be generated." });
    }
  }
  res.type("html").send(buildOfferLetterHtml(estimate));
});

app.post("/api/portal/estimates/:id/approve-offer", authRequired, async (req, res) => {
  await updateCollectionRecord("estimates", req.params.id, { ...req.body, status: "Approved" }, res);
});

app.post("/api/portal/estimates/:id/send", authRequired, async (req, res) => {
  const estimates = await readJson(listFiles.estimates, []);
  const estimate = estimates.find((item) => String(item.id) === String(req.params.id));
  const delivery = await communicationService.sendBusinessChannelUpdate("estimate-send", {
    agent: "Contract Renewal CRM Agent",
    estimate_id: req.params.id,
    target: req.body?.target || req.body?.recipient || estimate?.customer_phone || estimate?.phone || "",
    channel: req.body?.channel,
    summary: `Estimate ${req.params.id} sent${estimate?.customer_name ? ` to ${estimate.customer_name}` : ""}.`
  });
  await updateCollectionRecord("estimates", req.params.id, { ...req.body, status: "Sent", delivery_status: delivery.ok ? "Sent" : "Delivery failed" }, res);
});

app.post("/api/portal/customer-users", authRequired, async (req, res) => {
  const customerId = String(req.body?.customer_id || "").trim();
  const customers = await readJson(listFiles.customers, []);
  const customer = customers.find((item) => String(item.id) === customerId);
  if (!customer) return res.status(400).json({ ok: false, message: "Select a saved customer before granting portal access." });
  const users = await readJson(listFiles.customer_users, []);
  const existing = users.find((item) => String(item.customer_id) === customerId);
  if (existing) return res.json({ ok: true, customer_user: existing, message: "Customer portal access already exists." });
  const username = String(customer.name || customerId).toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "") || customerId.toLowerCase();
  const record = {
    id: nextId(users, "CU"),
    customer_id: customerId,
    customer_name: customer.name,
    username: `${username}.${customerId.toLowerCase()}`,
    temporary_password: `FUZI${customerId.replace(/\D/g, "") || "2026"}`,
    active: true,
    must_change_password: true,
    portal_url: "/customer/login",
    created_at: new Date().toISOString()
  };
  users.unshift(record);
  await writeJson(listFiles.customer_users, users);
  res.json({ ok: true, customer_user: record, message: "Customer portal access created." });
});

app.post("/api/portal/payments/auto-schedule", authRequired, async (req, res) => {
  const estimateId = String(req.body?.estimate_id || "").trim();
  const amount = Number(req.body?.amount || req.body?.total_amount || 0);
  const startDate = req.body?.start_date ? new Date(req.body.start_date) : new Date();
  const payments = await readJson(listFiles.payments, []);
  const existing = payments.filter((item) => String(item.estimate_id || "") === estimateId);
  if (existing.length) return res.status(409).json({ ok: false, message: "Payment milestones already exist for this estimate.", payments: existing });
  const splits = [
    ["Advance", 0.3, 0],
    ["Civil Work", 0.3, 30],
    ["Pre-Delivery", 0.3, 60],
    ["Sign-Off", 0.1, 90]
  ];
  const created = splits.map(([milestone, percent, days], index) => {
    const due = new Date(startDate);
    due.setDate(due.getDate() + Number(days));
    return {
      id: nextId([...payments, ...splits.slice(0, index).map((_, i) => ({ id: `PAY-${String(payments.length + i + 1).padStart(3, "0")}` }))], "PAY"),
      estimate_id: estimateId,
      customer_name: String(req.body?.customer_name || "").trim(),
      milestone,
      amount: Math.round(amount * Number(percent)),
      due_date: due.toISOString().slice(0, 10),
      status: "Due",
      created_at: new Date().toISOString()
    };
  });
  payments.unshift(...created);
  await writeJson(listFiles.payments, payments);
  res.json({ ok: true, payments: created, message: "Payment schedule created." });
});

app.post("/api/portal/comms/:id/read", authRequired, async (req, res) => {
  await updateCollectionRecord("comms", req.params.id, { ...req.body, read: true, status: "Read" }, res);
});

app.get("/api/portal/notifications", authRequired, async (_req, res) => {
  const records = await readJson(listFiles.dept_comms, []);
  const notifications = records
    .filter((record) => String(record.status || "").toLowerCase() !== "read" && record.read !== true)
    .slice(0, 20);
  res.json({ ok: true, notifications, unread_count: notifications.length });
});

app.post("/api/portal/notifications/read-all", authRequired, async (req, res) => {
  const records = await readJson(listFiles.dept_comms, []);
  const now = new Date().toISOString();
  const next = records.map((record) => ({
    ...record,
    read: true,
    status: "Read",
    read_by: req.user?.display_name || req.user?.username || "",
    read_at: record.read_at || now,
    updated_at: now
  }));
  await writeJson(listFiles.dept_comms, next);
  res.json({ ok: true, updated: records.length });
});

app.get("/api/portal/install-jobs/report", authRequired, async (req, res) => {
  const records = await readJson(listFiles.install_jobs, []);
  const query = String(req.query.q || "").trim().toLowerCase();
  const status = String(req.query.status || "All").trim();
  const startDate = String(req.query.start_date || "").trim();
  const endDate = String(req.query.end_date || "").trim();
  const filtered = records
    .filter((record) => status === "All" || String(record.status || "") === status)
    .filter((record) => !query || JSON.stringify(record).toLowerCase().includes(query))
    .filter((record) => {
      const date = String(record.start_date || record.created_at || "").slice(0, 10);
      if (startDate && date < startDate) return false;
      if (endDate && date > endDate) return false;
      return true;
    });
  const rows = installationReportRows(filtered);
  const format = String(req.query.format || "json").trim().toLowerCase();
  if (format === "csv") {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="fuzi-installation-report-${stamp}.csv"`);
    return res.send(rowsToCsv(rows));
  }
  const totals = rows.reduce((summary, row) => ({
    contract_value: summary.contract_value + numberValue(row.contract_value),
    total_paid: summary.total_paid + numberValue(row.total_paid),
    outstanding_balance: summary.outstanding_balance + numberValue(row.outstanding_balance)
  }), { contract_value: 0, total_paid: 0, outstanding_balance: 0 });
  res.json({ ok: true, rows, totals, count: rows.length });
});

app.patch("/api/portal/install-jobs/:jobId/stages/:stageId", authRequired, async (req, res) => {
  const jobs = await readJson(listFiles.install_jobs, []);
  const index = findRecordIndex(jobs, req.params.jobId);
  if (index < 0) return res.status(404).json({ ok: false, message: "Install job not found." });
  const stages = Array.isArray(jobs[index].stages) ? jobs[index].stages : [];
  const stageIndex = stages.findIndex((stage) => String(stage.id || stage.stage_id || stage.name) === String(req.params.stageId));
  if (stageIndex >= 0) {
    stages[stageIndex] = { ...stages[stageIndex], ...cleanPayload(req.body), updated_at: new Date().toISOString() };
  } else {
    stages.push({ id: req.params.stageId, ...cleanPayload(req.body), updated_at: new Date().toISOString() });
  }
  jobs[index] = { ...jobs[index], stages, updated_at: new Date().toISOString() };
  await writeJson(listFiles.install_jobs, jobs);
  res.json({ ok: true, job: jobs[index] });
});

app.post("/api/portal/install-jobs/:jobId/send-commissioning", authRequired, async (req, res) => {
  const jobs = await readJson(listFiles.install_jobs, []);
  const jobIndex = findRecordIndex(jobs, req.params.jobId);
  if (jobIndex < 0) return res.status(404).json({ ok: false, message: "Install job not found." });
  const job = jobs[jobIndex];
  const commissionings = await readJson(listFiles.commissionings, []);
  const existing = commissionings.find((item) => String(item.installation_ref || item.job_ref || "") === String(job.id || job.job_id));
  const now = new Date().toISOString();
  const handoff = {
    installation_ref: job.id || job.job_id,
    job_ref: job.id || job.job_id,
    unit: req.body?.unit || job.unit || job.site || job.id,
    customer_id: req.body?.customer_id || job.customer_id || "",
    customer: req.body?.customer || job.customer || job.site || "",
    site: req.body?.site || job.site || "",
    assigned_engineer: req.body?.assigned_engineer || job.commissioning_engineer || job.engineer || "",
    controller_type: req.body?.controller_type || job.controller_type || "",
    drive_model_number: req.body?.drive_model_number || job.drive_model_number || job.drive_model || "",
    motor_serial_number: req.body?.motor_serial_number || job.motor_serial_number || job.motor_serial || "",
    motor_nameplate_url: req.body?.motor_nameplate_url || job.motor_nameplate_url || "",
    motor_nameplate_file: req.body?.motor_nameplate_file || job.motor_nameplate_file || "",
    communication_link: req.body?.communication_link || job.communication_link || "",
    protocol_required: req.body?.protocol_required || job.protocol_required || "",
    protocol_type: req.body?.protocol_type || job.protocol_type || job.protocol || "",
    commissioning_details: req.body?.commissioning_details || job.commissioning_details || "",
    install_complete_date: req.body?.install_complete_date || now.slice(0, 10),
    payment_cleared: Boolean(req.body?.payment_cleared || job.payment_cleared),
    status: existing?.status || "Pending",
    notes: req.body?.notes || `Install team handoff from ${job.crew || "Install Team"}. ${job.handover_report || ""}`.trim(),
    message_from_install_team: req.body?.message || `Product installed for ${job.site || job.customer || job.id}. Commissioning can begin after final checks.`,
    updated_at: now
  };
  let commissioning;
  if (existing) {
    commissioning = { ...existing, ...handoff };
    commissionings[commissionings.indexOf(existing)] = commissioning;
  } else {
    commissioning = { id: nextId(commissionings, "COM"), ...handoff, created_at: now };
    commissionings.unshift(commissioning);
  }
  await writeJson(listFiles.commissionings, commissionings);

  const deptComms = await readJson(listFiles.dept_comms, []);
  const message = {
    id: nextId(deptComms, "MSG"),
    department: "Commissioning",
    subject: `Install handoff: ${job.site || job.id}`,
    message: commissioning.message_from_install_team,
    status: "Unread",
    installation_ref: commissioning.installation_ref,
    commissioning_id: commissioning.id,
    created_at: now
  };
  deptComms.unshift(message);
  await writeJson(listFiles.dept_comms, deptComms);

  jobs[jobIndex] = { ...job, status: "Installed - Sent to Commissioning", commissioning_id: commissioning.id, commissioning_handoff_at: now };
  await writeJson(listFiles.install_jobs, jobs);

  const delivery = await communicationService.sendBusinessChannelUpdate("installation-complete", {
    agent: "Field Installation Manager",
    job_id: job.id || job.job_id,
    site: job.site,
    crew: job.crew,
    summary: `Install handoff sent for ${job.site || job.id}.`
  });
  res.json({ ok: true, commissioning, message, job: jobs[jobIndex], delivery });
});

app.post("/api/portal/commissioning/:id/motor-nameplate", authRequired, async (req, res) => {
  const commissionings = await readJson(listFiles.commissionings, []);
  const index = findRecordIndex(commissionings, req.params.id);
  if (index < 0) return res.status(404).json({ ok: false, message: "Commissioning record not found." });
  const record = commissionings[index];
  const { contentType, bytes } = decodeDataUrl(req.body?.data_url || "");
  if (!bytes.length) return res.status(400).json({ ok: false, message: "Upload a motor nameplate image." });
  const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  const type = String(req.body?.content_type || contentType || "").toLowerCase();
  if (type && !allowed.has(type)) return res.status(400).json({ ok: false, message: "Motor nameplate must be an image file." });
  const extension = type.includes("png") ? ".png" : type.includes("webp") ? ".webp" : type.includes("gif") ? ".gif" : ".jpg";
  const customerKey = safeAssetName(record.customer_id || record.customer || "customer");
  const uploadDir = path.join(rootDir, "docs", "customer-assets", "nameplates", customerKey);
  await fs.mkdir(uploadDir, { recursive: true });
  const baseName = safeAssetName(`${record.id || req.params.id}-${req.body?.filename || "motor-nameplate"}`).replace(/\.[a-z0-9]+$/i, "");
  const fileName = `${baseName}-${Date.now()}${extension}`;
  const filePath = path.join(uploadDir, fileName);
  await fs.writeFile(filePath, bytes);
  const publicUrl = `/assets/customer/nameplates/${encodeURIComponent(customerKey)}/${encodeURIComponent(fileName)}`;
  const nextRecord = {
    ...record,
    motor_nameplate_url: publicUrl,
    motor_nameplate_file: String(req.body?.filename || fileName).trim(),
    motor_nameplate_uploaded_at: new Date().toISOString(),
    motor_nameplate_uploaded_by: req.user?.display_name || req.user?.username || "",
    updated_at: new Date().toISOString()
  };
  commissionings[index] = nextRecord;
  await writeJson(listFiles.commissionings, commissionings);
  res.json({ ok: true, record: nextRecord, url: publicUrl });
});

app.post("/api/portal/attendance", authRequired, async (req, res) => {
  const payload = cleanPayload(req.body || {});
  const personId = String(payload.person_id || payload.staff_id || "").trim();
  const personName = String(payload.person_name || payload.staff_name || payload.name || "").trim();
  const date = String(payload.date || new Date().toISOString().slice(0, 10)).trim();
  if (!personId || !personName) {
    return res.status(400).json({ ok: false, message: "Attendance requires a staff ID and staff name." });
  }
  const serviceScope = await serviceTeamScopeForUser(req.user);
  const attendanceSubject = { ...payload, person_id: personId, person_name: personName };
  if (serviceScope && !recordMatchesServiceTeamScope(attendanceSubject, serviceScope) && !attendanceRecordIsSelf(attendanceSubject, req.user)) {
    return res.status(403).json({ ok: false, message: "Service Manager can mark attendance only for Service team staff." });
  }
  if (!attendanceRecordBelongsToUser(attendanceSubject, req.user)) {
    return res.status(403).json({ ok: false, message: "Staff can check in or check out only for their own attendance." });
  }

  const records = await readJson(listFiles.attendance, []);
  const existingIndex = records.findIndex((item) => String(item.person_id || item.staff_id || "") === personId && String(item.date || "") === date);
  const now = new Date().toISOString();
  const existingRecord = existingIndex >= 0 ? records[existingIndex] : {};
  const historyEntry = attendanceEntryFromPayload(payload, existingRecord, now);
  const historyEntries = [
    ...(Array.isArray(existingRecord.entries) ? existingRecord.entries.filter((entry) => String(entry?.date || date).slice(0, 10) === date) : []),
    ...(historyEntry ? [historyEntry] : [])
  ];
  const record = {
    ...existingRecord,
    ...payload,
    id: existingIndex >= 0 ? existingRecord.id : nextId(records, "ATT"),
    date,
    person_id: personId,
    person_name: personName,
    department: String(payload.department || "").trim(),
    status: String(payload.status || "present").trim(),
    check_in: String(existingRecord.check_in || existingRecord.time_in || payload.check_in || "").trim(),
    check_out: String(payload.check_out || "").trim(),
    check_in_location: existingRecord.check_in_location || payload.check_in_location || null,
    check_out_location: payload.check_out_location || existingRecord.check_out_location || null,
    entries: historyEntries,
    notes: String(payload.notes || "").trim(),
    marked_by: payload.marked_by || req.user?.username || "",
    marked_at: payload.marked_at || now,
    updated_at: now,
  };
  if (existingIndex >= 0) {
    records[existingIndex] = record;
  } else {
    records.unshift({ ...record, created_at: now });
  }
  await writeJson(listFiles.attendance, records);
  res.json({ ok: true, attendance: record, record });
});

function canReviewLeaveRequest(user = {}, request = {}) {
  if (isAdminUser(user) || String(user.department || "").toLowerCase() === "executive office") return true;
  const role = String(user.role || "").toLowerCase();
  if (!["manager", "team lead", "team_lead", "lead"].includes(role)) return false;
  return staffLookupKey(user.department) && staffLookupKey(user.department) === staffLookupKey(request.department);
}

app.post("/api/portal/leave-requests", authRequired, async (req, res) => {
  const payload = cleanPayload(req.body || {});
  const personId = String(payload.person_id || payload.staff_id || req.user?.linked_org_node || "").trim();
  const now = new Date().toISOString();
  if (!personId) return res.status(400).json({ ok: false, message: "Leave request requires a linked staff profile." });
  if (!payload.reason) return res.status(400).json({ ok: false, message: "Leave reason is required." });
  const [records, orgChart, deptComms] = await Promise.all([
    readJson(listFiles.leave_requests, []),
    readJson(listFiles.org_chart, []),
    readJson(listFiles.dept_comms, [])
  ]);
  const person = orgChart.find((item) => String(item.id || "") === personId) || {};
  const department = String(payload.department || person.department || req.user?.department || "").trim();
  const userRole = String(req.user?.role || "").toLowerCase();
  const isSelfRequest = String(req.user?.linked_org_node || "") === personId;
  const canSubmitForDepartment = isAdminUser(req.user) || String(req.user?.department || "").toLowerCase() === "executive office" || (["manager", "team lead", "team_lead", "lead"].includes(userRole) && staffLookupKey(req.user?.department) === staffLookupKey(department));
  if (!isSelfRequest && !canSubmitForDepartment) {
    return res.status(403).json({ ok: false, message: "Staff can only submit their own leave request." });
  }
  const reviewer = orgChart.find((item) => staffLookupKey(item.department) === staffLookupKey(department) && isDepartmentHead(item));
  const record = {
    id: nextId(records, "LEAVE"),
    ...payload,
    person_id: personId,
    person_name: String(payload.person_name || person.name || req.user?.display_name || req.user?.username || "").trim(),
    department,
    leave_type: String(payload.leave_type || "Casual").trim(),
    start_date: String(payload.start_date || now.slice(0, 10)).slice(0, 10),
    end_date: String(payload.end_date || payload.start_date || now.slice(0, 10)).slice(0, 10),
    reason: String(payload.reason || "").trim(),
    status: "Pending",
    requested_by: req.user?.display_name || req.user?.username || "",
    requested_by_username: req.user?.username || "",
    submitted_at: now,
    department_head_id: String(reviewer?.id || ""),
    department_head_name: String(reviewer?.name || ""),
    created_at: now,
    updated_at: now
  };
  records.unshift(record);
  deptComms.unshift({
    id: nextId(deptComms, "MSG"),
    department,
    notification_type: "leave-request",
    subject: `Leave request: ${record.person_name}`,
    message: `${record.person_name} requested ${record.leave_type} leave from ${record.start_date} to ${record.end_date}. Reason: ${record.reason}`,
    status: "Unread",
    read: false,
    staff_id: record.person_id,
    leave_request_id: record.id,
    created_at: now
  });
  await Promise.all([
    writeJson(listFiles.leave_requests, records),
    writeJson(listFiles.dept_comms, deptComms)
  ]);
  res.json({ ok: true, record, leave_request: record });
});

app.patch("/api/portal/leave-requests/:id", authRequired, async (req, res) => {
  const records = await readJson(listFiles.leave_requests, []);
  const index = findRecordIndex(records, req.params.id);
  if (index < 0) return res.status(404).json({ ok: false, message: "Leave request not found." });
  if (!canReviewLeaveRequest(req.user, records[index])) {
    return res.status(403).json({ ok: false, message: "Only admin or the department head can approve this leave request." });
  }
  const now = new Date().toISOString();
  const status = String(req.body?.status || records[index].status || "Pending").trim();
  records[index] = {
    ...records[index],
    ...cleanPayload(req.body),
    status,
    reviewed_by: req.user?.display_name || req.user?.username || "",
    reviewed_by_username: req.user?.username || "",
    reviewed_at: ["approved", "rejected"].includes(status.toLowerCase()) ? now : records[index].reviewed_at || "",
    updated_at: now
  };
  await writeJson(listFiles.leave_requests, records);
  res.json({ ok: true, record: records[index], leave_request: records[index] });
});

for (const routeName of Object.keys(routeCollections).filter((route) => !route.includes("/"))) {
  app.get(`/api/portal/${routeName}`, authRequired, async (_req, res) => {
    await listCollection(routeName, res, _req.user);
  });
  if (!["customers", "breakdown", "install-jobs", "users"].includes(routeName)) {
    app.post(`/api/portal/${routeName}`, authRequired, async (req, res) => {
      await createCollectionRecord(routeName, req.body, res);
    });
  }
  if (routeName !== "users") {
    app.patch(`/api/portal/${routeName}/:id`, authRequired, async (req, res) => {
      await updateCollectionRecord(routeName, req.params.id, req.body, res);
    });
  }
  app.delete(`/api/portal/${routeName}/:id`, authRequired, async (req, res) => {
    if (routeName === "customers" && !isAdminUser(req.user)) return res.status(403).json({ ok: false, message: "Only admin can remove CRM customer records." });
    await deleteCollectionRecord(routeName, req.params.id, res);
  });
}

app.get("/api/portal/:collection", authRequired, async (req, res) => {
  const file = listFiles[req.params.collection];
  if (!file) return res.status(404).json({ ok: false, message: "Unknown collection." });
  const records = await readJson(file, []);
  const serviceScope = await serviceTeamScopeForUser(req.user);
  const scopedRecords = applyServiceManagerCollectionScope(req.params.collection, records, serviceScope);
  const visibleRecords = Array.isArray(scopedRecords)
    ? scopedRecords.filter((record) => {
      if (req.params.collection === "service_records" && !canManageServiceRecords(req.user)) return serviceRecordAssignedToUser(record, req.user);
      if (req.params.collection === "attendance" && !canManageStaffAttendance(req.user)) return attendanceRecordBelongsToUser(record, req.user);
      return true;
    })
    : scopedRecords;
  res.json({ ok: true, [req.params.collection]: visibleRecords });
});

app.get("/api/app", (_req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ ok: false, message: "Not found." });
  }
  res.json({
    ok: true,
    service: "FUZI API + production web",
    web: webDistInfo()
  });
});

app.get("/", (req, res) => {
  if (fsSync.existsSync(webSiteIndex)) {
    return sendMaybePrecompressed(req, res, webSiteIndex);
  }
  if (fsSync.existsSync(webDistIndex)) {
    return sendMaybePrecompressed(req, res, webDistIndex);
  }
  res.json({
    ok: true,
    service: "FUZI API",
    web: webDistInfo()
  });
});

app.get("/metadata.json", (_req, res) => {
  res.status(404).json({ ok: false, message: "Not found." });
});

if (fsSync.existsSync(webDistIndex)) {
  app.get(/^\/(?!api\/).*/, (req, res) => {
    sendMaybePrecompressed(req, res, webDistIndex);
  });
}

let discordBreakdownSyncWarned = false;
function autoAssignmentNotificationErrorMessage(records = []) {
  for (const record of records) {
    const message = deliveryErrorMessage(record.auto_assignment_notification);
    if (message) return message;
  }
  return "";
}

async function discordBreakdownSyncErrorMessage(result, assignedWaiting = []) {
  const syncErrorMessage = String(result?.message || result?.status || "unknown error").trim();
  const attemptedMessage = openClawConnectionTriedMessage();
  const extraErrorMessage = String(autoAssignmentNotificationErrorMessage(assignedWaiting) || "").trim();
  const extras = [];
  for (const message of [attemptedMessage, extraErrorMessage].map((item) => String(item || "").trim())) {
    if (!message || message === syncErrorMessage) continue;
    const existingIndex = extras.findIndex((existing) => existing === message || existing.includes(message) || message.includes(existing));
    if (existingIndex >= 0) {
      if (message.length > extras[existingIndex].length) extras[existingIndex] = message;
    } else {
      extras.push(message);
    }
  }
  return extras.length ? `${syncErrorMessage} ${extras.join(" ")}` : syncErrorMessage;
}

async function runDiscordBreakdownSync() {
  const result = await discordBreakdownSyncService.sync();
  const assignedWaiting = await discordBreakdownSyncService.assignWaitingBreakdowns();
  if (assignedWaiting.length) result.assigned_waiting_breakdowns = assignedWaiting.length;
  if (!result.ok && !discordBreakdownSyncWarned) {
    discordBreakdownSyncWarned = true;
    result.message = await discordBreakdownSyncErrorMessage(result, assignedWaiting);
    console.warn(result.message);
  }
  if (result.ok) discordBreakdownSyncWarned = false;
  return result;
}

app.listen(port, "0.0.0.0", () => {
  console.log(`FUZI Node API listening on http://127.0.0.1:${port}`);
  runDiscordBreakdownSync().catch((error) => console.warn(`Discord breakdown sync failed: ${error?.message || error}`));
  const pollMs = defaultDiscordBreakdownSyncData(process.env, rootDir).pollMs;
  const interval = setInterval(() => {
    runDiscordBreakdownSync().catch((error) => console.warn(`Discord breakdown sync failed: ${error?.message || error}`));
  }, pollMs);
  interval.unref?.();
});
