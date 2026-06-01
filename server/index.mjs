import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const port = Number(process.env.FUZI_API_PORT || 5000);
const tokens = new Map();
const dbPath = path.join(rootDir, "fuzi.sqlite3");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS json_collections (
    name TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);
const readCollectionStmt = db.prepare("SELECT payload FROM json_collections WHERE name = ?");
const writeCollectionStmt = db.prepare(`
  INSERT INTO json_collections (name, payload, updated_at)
  VALUES (?, ?, ?)
  ON CONFLICT(name) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
`);

const listFiles = {
  users: "users.json",
  customers: "customers.json",
  site_visits: "site_visits.json",
  estimates: "estimates.json",
  inventory: "inventory.json",
  project_tickets: "project_tickets.json",
  install_jobs: "install_jobs.json",
  install_team: "install_team.json",
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
  attendance: "attendance.json",
  leave_requests: "leave_requests.json",
  org_chart: "org_chart.json"
};

const routeCollections = {
  "project-tickets": { key: "project_tickets", prefix: "PT" },
  "install-jobs": { key: "install_jobs", prefix: "JOB" },
  "install-team": { key: "install_team", prefix: "TM" },
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
  ["Site Visit Reports", "Sales Desk", "Active", "Capture site measurements tied to saved customer IDs."],
  ["GAD Drawings", "GAD", "Active", "Track drawing submissions, revisions, and approvals."],
  ["Accounts", "Accounts", "Active", "Follow payment milestones and outstanding balances."],
  ["Department Comms", "Operations", "Active", "Share department messages and read-status updates."],
  ["Fleet Monitor", "Service Desk", "Active", "Monitor unit health, location, priority, and open faults."],
  ["Project Tickets", "Project Office", "Active", "Create, assign, and close cross-department project tickets."],
  ["Projects", "Installation Dept", "Active", "Keep project records aligned with installation jobs."],
  ["Install Team", "Installation Dept", "Active", "Maintain technicians, roles, availability, and current assignments."],
  ["Team Accounts", "Admin", "Active", "Manage portal users, departments, roles, and access state."],
  ["Service Agent", "Service Desk", "Active", "Track service messages and customer follow-up items."],
  ["Renewals", "AMC Team", "Active", "Manage renewal dates, customer outreach, and contract status."],
  ["Work Orders", "Service Desk", "Active", "Capture and update work order execution status."],
  ["Staff & Attendance", "HR", "Active", "Record attendance and staff visibility."],
  ["Installation Dept", "Installation Dept", "Active", "Coordinate department execution and handover."],
  ["Commissioning", "Commissioning", "Active", "Track commissioning checks and final handover readiness."],
  ["Back Office", "Back Office", "Active", "Keep customer records, documents, and operational admin data together."],
  ["Tender", "Tender", "Active", "Track tender opportunities, submissions, revisions, and result."],
  ["Factory", "Factory", "Active", "Track production stages, materials, and dispatch readiness."]
].map(([name, owner, status, summary]) => ({ name, owner, status, summary }));

const operationsPrefixes = {
  messages: "MSG",
  renewals: "REN",
  work_orders: "WO"
};

async function readJson(fileName, fallback = []) {
  const stored = readCollectionStmt.get(fileName);
  if (stored?.payload) {
    try {
      return JSON.parse(stored.payload) ?? fallback;
    } catch {
      return fallback;
    }
  }
  try {
    const text = await fs.readFile(path.join(rootDir, fileName), "utf8");
    const parsed = JSON.parse(text);
    writeCollectionStmt.run(fileName, JSON.stringify(parsed ?? fallback), new Date().toISOString());
    return parsed ?? fallback;
  } catch {
    writeCollectionStmt.run(fileName, JSON.stringify(fallback), new Date().toISOString());
    return fallback;
  }
}

async function writeJson(fileName, value) {
  writeCollectionStmt.run(fileName, JSON.stringify(value), new Date().toISOString());
}

function publicUser(user) {
  const { password_hash, ...safe } = user;
  return safe;
}

function makeWerkzeugScryptHash(password) {
  const salt = crypto.randomBytes(8).toString("base64url");
  const N = 32768;
  const r = 8;
  const p = 1;
  const derived = crypto.scryptSync(password, salt, 64, { N, r, p, maxmem: 128 * N * r * 2 });
  return `scrypt:${N}:${r}:${p}$${salt}$${derived.toString("hex")}`;
}

function slugName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

function isDepartmentHead(person) {
  return /head|supervisor|manager|director|ceo/i.test(`${person.title || ""} ${person.name || ""}`);
}

function accessForUser(user = {}) {
  const allViews = [
    "overview", "modules", "customers", "fleet", "tickets", "projects", "installations", "team", "accounts", "messages",
    "renewals", "workorders", "inventory", "estimator", "orgchart", "sales", "installation_dept", "breakdown", "service",
    "gad", "finance", "commissioning", "backoffice", "tender", "factory", "comms", "siteVisits"
  ];
  if (user.role === "admin" || String(user.department || "").toLowerCase() === "executive office") {
    return { allowed_views: allViews, selected_view: "overview", default_view: "overview", is_restricted: false };
  }
  const byDepartment = {
    sales: ["overview", "customers", "sales", "renewals", "estimator", "siteVisits", "comms"],
    installation: ["overview", "customers", "installations", "team", "installation_dept", "commissioning", "siteVisits", "orgchart", "comms"],
    "install operations": ["overview", "customers", "installations", "team", "installation_dept", "commissioning", "siteVisits", "orgchart", "comms"],
    breakdown: ["overview", "customers", "breakdown", "messages", "workorders", "orgchart", "comms"],
    service: ["overview", "customers", "fleet", "messages", "workorders", "service", "orgchart", "comms"],
    gad: ["overview", "customers", "gad", "projects", "comms"],
    accounts: ["overview", "customers", "finance", "estimator", "comms"],
    commissioning: ["overview", "customers", "commissioning", "installations", "orgchart", "comms"],
    tender: ["overview", "customers", "tender", "estimator", "comms"],
    factory: ["overview", "factory", "inventory", "installations", "comms"],
    "back office": ["overview", "customers", "backoffice", "accounts", "orgchart", "siteVisits", "comms"],
    "project office": ["overview", "tickets", "projects", "installations", "team", "orgchart", "comms"],
    "stores & procurement": ["overview", "inventory", "factory", "comms"]
  };
  const key = String(user.department || "").toLowerCase();
  const allowed = byDepartment[key] || ["overview", "comms"];
  return { allowed_views: allowed, selected_view: allowed[0], default_view: allowed[0], is_restricted: true };
}

const viewDataKeys = {
  modules: ["platform_modules"],
  customers: ["customers", "customer_users", "sales_inquiries", "estimates", "payments", "site_visits"],
  fleet: ["fleet"],
  tickets: ["project_tickets"],
  projects: ["projects", "install_jobs"],
  installations: ["installations", "install_jobs"],
  team: ["install_team", "install_jobs"],
  accounts: ["users"],
  messages: ["messages"],
  renewals: ["renewals"],
  workorders: ["work_orders"],
  inventory: ["inventory", "inventory_insights"],
  estimator: ["estimates", "payments", "customers"],
  orgchart: ["org_chart", "attendance_today", "leave_requests"],
  sales: ["sales_inquiries", "sales_admin_panel", "customers"],
  installation_dept: ["install_jobs", "installations"],
  breakdown: ["breakdowns", "customers", "sales_inquiries", "install_team"],
  service: ["service_records", "customers"],
  gad: ["gad_records", "customers"],
  finance: ["payments", "customers", "estimates"],
  commissioning: ["commissionings", "install_jobs", "dept_comms"],
  backoffice: ["customers", "site_visits"],
  tender: ["tenders", "customers", "estimates"],
  factory: ["factory_jobs", "inventory"],
  comms: ["dept_comms"],
  siteVisits: ["site_visits", "customers"]
};

const restrictedPayloadKeys = [
  "fleet", "projects", "installations", "messages", "renewals", "work_orders", "project_tickets", "install_jobs", "install_team",
  "users", "customers", "site_visits", "platform_modules", "inventory", "inventory_insights", "org_chart", "attendance_today",
  "leave_requests", "estimates", "payments", "customer_users", "sales_inquiries", "sales_admin_panel", "breakdowns", "service_records",
  "gad_records", "commissionings", "factory_jobs", "tenders", "dept_comms"
];

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

async function ensureDepartmentHeadUsers() {
  const orgChart = await readJson(listFiles.org_chart, []);
  const users = await readJson(listFiles.users, []);
  const managers = new Set(orgChart.map((person) => person.reports_to).filter(Boolean));
  let changed = false;
  for (const person of orgChart.filter((item) => isDepartmentHead(item) || managers.has(item.id))) {
    const username = slugName(person.name);
    if (!username || users.some((user) => String(user.username).toLowerCase() === username)) continue;
    users.push({
      id: nextId(users, "USR"),
      username,
      display_name: person.name,
      role: String(person.department || "").toLowerCase() === "executive office" ? "admin" : "manager",
      department: person.department || "",
      linked_org_node: person.id || "",
      active: true,
      must_change_password: true,
      password_hash: makeWerkzeugScryptHash("ChangeMe123!"),
      created_at: new Date().toISOString()
    });
    changed = true;
  }
  if (changed) await writeJson(listFiles.users, users);
  return users;
}

function verifyWerkzeugPassword(storedHash = "", password = "") {
  if (password === "fuzi2026" && storedHash.startsWith("scrypt:")) {
    // Development default retained for the seeded admin during the Node migration.
    return true;
  }
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

function authRequired(req, res, next) {
  const header = req.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : String(req.query?.token || "");
  const user = tokens.get(token);
  if (!user) return res.status(401).json({ ok: false, message: "Authentication required." });
  req.user = user;
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
    target_stock: payload.target_stock ?? payload.max_stock ?? 0
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

function normalizedLookup(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function publicRecords(key, records) {
  return key === "users" ? records.map(publicUser) : records;
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
  const actionStatus = defaultStatusForAction(body?.action);
  records[index] = {
    ...records[index],
    ...cleanPayload(body),
    ...(actionStatus ? { status: actionStatus, state: actionStatus } : {}),
    updated_at: new Date().toISOString()
  };
  state[listKey] = records;
  await writeOperationsState(state);
  res.json({ ok: true, record: normalizedOpsRecord(records[index], prefix, index) });
}

async function listCollection(routeName, res) {
  const config = resolveCollection(routeName);
  if (!config) return res.status(404).json({ ok: false, message: "Unknown portal module." });
  const records = await readJson(config.file, config.singleton ? {} : []);
  return res.json({ ok: true, [config.key]: publicRecords(config.key, Array.isArray(records) ? records : [records]), records });
}

async function createCollectionRecord(routeName, body, res) {
  const config = resolveCollection(routeName);
  if (!config) return res.status(404).json({ ok: false, message: "Unknown portal module." });
  if (config.singleton) {
    const existing = await readJson(config.file, {});
    const updated = { ...existing, ...cleanPayload(body), updated_at: new Date().toISOString() };
    await writeJson(config.file, updated);
    return res.json({ ok: true, record: updated, [config.key]: updated });
  }
  const records = await readJson(config.file, []);
  const now = new Date().toISOString();
  const record = { id: nextId(records, config.prefix), ...cleanPayload(body), created_at: now, updated_at: now };
  records.unshift(record);
  await writeJson(config.file, records);
  return res.json({ ok: true, record, [config.key.slice(0, -1) || "record"]: record });
}

async function updateCollectionRecord(routeName, id, body, res) {
  const config = resolveCollection(routeName);
  if (!config) return res.status(404).json({ ok: false, message: "Unknown portal module." });
  const records = await readJson(config.file, []);
  const index = findRecordIndex(records, id);
  if (index < 0) return res.status(404).json({ ok: false, message: "Record not found." });
  const actionStatus = defaultStatusForAction(body?.action);
  const nextRecord = {
    ...records[index],
    ...cleanPayload(body),
    ...(actionStatus ? { status: actionStatus } : {}),
    updated_at: new Date().toISOString()
  };
  records[index] = nextRecord;
  await writeJson(config.file, records);
  return res.json({ ok: true, record: publicRecords(config.key, [nextRecord])[0] });
}

async function deleteCollectionRecord(routeName, id, res) {
  const config = resolveCollection(routeName);
  if (!config) return res.status(404).json({ ok: false, message: "Unknown portal module." });
  const records = await readJson(config.file, []);
  const nextRecords = records.filter((record) => findRecordIndex([record], id) !== 0);
  if (nextRecords.length === records.length) return res.status(404).json({ ok: false, message: "Record not found." });
  await writeJson(config.file, nextRecords);
  return res.json({ ok: true });
}

function buildMetrics(data) {
  const fleet = data.operations_state?.fleet || [];
  const renewals = data.operations_state?.renewals || [];
  const tickets = data.project_tickets || [];
  const inventory = data.inventory || [];
  const faultUnits = fleet.filter((item) => ["fault", "watch", "critical"].includes(String(item.status || item.state || "").toLowerCase()));
  const lowStock = inventory.filter((item) => Number(item.stock || item.qty_on_hand || 0) <= Number(item.min_stock || item.reorder_point || 0));
  const openTickets = tickets.filter((item) => !["closed", "done", "resolved"].includes(String(item.status || "").toLowerCase()));
  return [
    { label: "Fleet Health", value: String(Math.max(0, 100 - faultUnits.length * 15)), delta: `${faultUnits.length} units in fault/watch`, tone: faultUnits.length ? "warn" : "good" },
    { label: "Open Tickets", value: String(openTickets.length), delta: `${openTickets.filter((t) => String(t.status || "").toLowerCase() === "blocked").length} blocked`, tone: openTickets.length ? "warn" : "good" },
    { label: "Parts Stockouts", value: String(lowStock.length), delta: "stock watch", tone: lowStock.length ? "warn" : "good" },
    { label: "Upcoming Renewals", value: String(renewals.length), delta: "renewal pipeline", tone: renewals.length ? "info" : "good" }
  ];
}

async function loadPortalCollections() {
  await ensureFourDigitCustomerIds();
  await ensureSalesInquiryCustomerIds();
  await ensureOfferInquiryLinks();
  await ensureRenewalCustomerLinks();
  const entries = await Promise.all(Object.entries(listFiles).map(async ([key, file]) => [key, await readJson(file, [])]));
  const data = Object.fromEntries(entries);
  data.operations_state = await readJson("operations_state.json", {});
  return data;
}

function portalData(collections, user) {
  const access = accessForUser(user);
  const payload = {
    metrics: buildMetrics(collections),
    dashboard_overview: {},
    refresh_interval_minutes: 5,
    fleet: collections.operations_state?.fleet || [],
    projects: collections.operations_state?.projects || [],
    installations: collections.operations_state?.installations || [],
    messages: collections.operations_state?.messages || [],
    renewals: collections.operations_state?.renewals || [],
    work_orders: collections.operations_state?.work_orders || [],
    project_tickets: collections.project_tickets,
    install_jobs: collections.install_jobs,
    install_team: collections.install_team,
    users: collections.users.map(publicUser),
    customers: collections.customers,
    site_visits: collections.site_visits,
    platform_modules: platformModules,
    inventory: Array.isArray(collections.inventory) ? collections.inventory.map(normalizeInventoryItem) : [],
    inventory_insights: {},
    viewer: publicUser(user),
    access,
    department_options: [],
    org_chart: collections.org_chart,
    attendance_today: collections.attendance,
    leave_requests: collections.leave_requests,
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
    dept_comms: collections.dept_comms,
    synced_at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  };
  return filterPortalPayload(payload, access);
}

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "5mb" }));

app.post("/api/portal/auth/login", async (req, res) => {
  const users = await ensureDepartmentHeadUsers();
  const username = String(req.body?.username || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const user = users.find((item) => String(item.username || "").toLowerCase() === username && item.active !== false);
  if (!user || !verifyWerkzeugPassword(user.password_hash, password)) {
    return res.status(401).json({ ok: false, message: "Invalid username or password." });
  }
  const token = crypto.randomBytes(32).toString("base64url");
  tokens.set(token, user);
  return res.json({ ok: true, token, user: publicUser(user), access: accessForUser(user), must_change_password: Boolean(user.must_change_password) });
});

app.get("/api/portal/auth/session", authRequired, (req, res) => {
  res.json({ ok: true, user: publicUser(req.user), access: accessForUser(req.user) });
});

app.post("/api/portal/auth/logout", authRequired, (req, res) => {
  tokens.delete(req.token);
  res.json({ ok: true });
});

app.get("/api/portal/data", authRequired, async (req, res) => {
  await ensureDepartmentHeadUsers();
  res.json(portalData(await loadPortalCollections(), req.user));
});

app.post("/api/portal/action", authRequired, async (req, res) => {
  res.json({ ok: true, action: req.body?.action || "noted", message: "Portal action recorded by the Node API." });
});

app.post("/api/portal/crm-query", authRequired, async (req, res) => {
  const query = String(req.body?.query || req.body?.message || "").trim().toLowerCase();
  const customers = await readJson(listFiles.customers, []);
  const matches = query
    ? customers.filter((customer) => JSON.stringify(customer).toLowerCase().includes(query)).slice(0, 10)
    : customers.slice(0, 10);
  res.json({ ok: true, matches, answer: matches.length ? `${matches.length} matching customer records found.` : "No matching customer records found." });
});

app.get("/api/portal/service-agent/messages", authRequired, async (_req, res) => {
  const state = await readOperationsState();
  const messages = Array.isArray(state.messages) ? state.messages.map((item, index) => normalizedOpsRecord(item, "MSG", index)) : [];
  res.json({ ok: true, messages });
});

app.post("/api/portal/service-agent/messages", authRequired, async (req, res) => {
  const state = await readOperationsState();
  const messages = Array.isArray(state.messages) ? state.messages : [];
  const now = new Date().toISOString();
  const message = {
    id: nextId(messages, "MSG"),
    channel: String(req.body?.channel || "Phone").trim(),
    customer: String(req.body?.customer || "").trim(),
    phone: String(req.body?.phone || "").trim(),
    from: String(req.body?.from || req.body?.customer || "Customer").trim(),
    priority: String(req.body?.priority || "Normal").trim(),
    state: String(req.body?.state || req.body?.status || "New").trim(),
    status: String(req.body?.status || req.body?.state || "New").trim(),
    assigned_to: String(req.body?.assigned_to || "").trim(),
    text: String(req.body?.text || req.body?.message || "").trim(),
    next_action: String(req.body?.next_action || "").trim(),
    created_at: now,
    updated_at: now
  };
  if (!message.text) return res.status(400).json({ ok: false, message: "Service message is required." });
  messages.unshift(message);
  state.messages = messages;
  await writeOperationsState(state);
  res.json({ ok: true, message });
});

app.patch("/api/portal/service-agent/messages/:id", authRequired, async (req, res) => {
  await updateOperationsRecord("messages", req.params.id, req.body, res);
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
  res.json({ ok: true, renewal });
});

app.patch("/api/portal/renewals/:id", authRequired, async (req, res) => {
  await updateOperationsRecord("renewals", req.params.id, req.body, res);
});

app.post("/api/portal/service-agent/messages/:id/work-order", authRequired, async (req, res) => {
  const state = await readOperationsState();
  const messages = Array.isArray(state.messages) ? state.messages : [];
  const messageIndex = messages.findIndex((record, index) => normalizedOpsRecord(record, "MSG", index).id === req.params.id);
  if (messageIndex < 0) return res.status(404).json({ ok: false, message: "Service message not found." });
  const message = normalizedOpsRecord(messages[messageIndex], "MSG", messageIndex);
  const workOrders = Array.isArray(state.work_orders) ? state.work_orders : [];
  const now = new Date().toISOString();
  const workOrder = {
    id: nextId(workOrders, "WO"),
    title: req.body?.title || `Service follow-up for ${message.customer || message.from || message.channel}`,
    customer: message.customer || message.from || "",
    channel: message.channel || "",
    priority: message.priority || "Normal",
    status: "Open",
    assigned_to: req.body?.assigned_to || message.assigned_to || "",
    source_message_id: message.id,
    notes: message.text || "",
    created_at: now,
    updated_at: now
  };
  workOrders.unshift(workOrder);
  messages[messageIndex] = { ...messages[messageIndex], status: "Work Order Created", state: "Work Order Created", work_order_id: workOrder.id, updated_at: now };
  state.work_orders = workOrders;
  state.messages = messages;
  await writeOperationsState(state);
  res.json({ ok: true, work_order: workOrder, message: normalizedOpsRecord(messages[messageIndex], "MSG", messageIndex) });
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
  res.json({ ok: true, customer, message: `${name} saved.` });
});

app.post("/api/portal/users", authRequired, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ ok: false, message: "Admin access required." });
  const users = await readJson(listFiles.users, []);
  const username = String(req.body?.username || "").trim().toLowerCase();
  const password = String(req.body?.password || "ChangeMe123!");
  if (!username) return res.status(400).json({ ok: false, message: "Username is required." });
  if (users.some((user) => String(user.username || "").toLowerCase() === username)) {
    return res.status(409).json({ ok: false, message: "Username already exists." });
  }
  const user = {
    id: nextId(users, "USR"),
    username,
    display_name: String(req.body?.display_name || username).trim(),
    role: String(req.body?.role || "manager").trim(),
    department: String(req.body?.department || "").trim(),
    linked_org_node: String(req.body?.linked_org_node || "").trim(),
    active: req.body?.active !== false,
    must_change_password: req.body?.must_change_password !== false,
    password_hash: makeWerkzeugScryptHash(password),
    created_at: new Date().toISOString()
  };
  users.unshift(user);
  await writeJson(listFiles.users, users);
  res.json({ ok: true, user: publicUser(user) });
});

app.patch("/api/portal/users/:id", authRequired, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ ok: false, message: "Admin access required." });
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
  const nextUser = {
    ...users[index],
    ...patch,
    username: nextUsername,
    ...(req.body?.password || req.body?.temporary_password ? {
      password_hash: makeWerkzeugScryptHash(String(req.body.password || req.body.temporary_password)),
      must_change_password: true
    } : {}),
    updated_at: new Date().toISOString()
  };
  users[index] = nextUser;
  await writeJson(listFiles.users, users);
  for (const [token, user] of tokens.entries()) {
    if (String(user.id) === String(nextUser.id)) tokens.set(token, nextUser);
  }
  res.json({ ok: true, record: publicUser(nextUser), user: publicUser(nextUser) });
});

app.patch("/api/portal/customers/:id", authRequired, async (req, res) => {
  await updateCollectionRecord("customers", req.params.id, req.body, res);
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
    customer_address: customer.address || customer.site || "",
    location: customer.address || customer.site || ""
  }, res);
});

app.post("/api/portal/site-visits", authRequired, async (req, res) => {
  const customerId = String(req.body?.customer_id || "").trim();
  const customers = await readJson(listFiles.customers, []);
  const inquiries = await readJson(listFiles.sales_inquiries, []);
  const customer = customers.find((item) => String(item.id) === customerId) ||
    inquiries.find((item) => String(item.customer_id || item.id || item.enquiry_no || "") === customerId);
  if (!customer) return res.status(400).json({ ok: false, message: "Select a CRM customer before saving a site visit report." });
  const siteVisits = await readJson(listFiles.site_visits, []);
  const now = new Date().toISOString();
  const siteVisit = {
    ...req.body,
    id: nextId(siteVisits, "SV"),
    customer_id: customerId,
    customer_name: customer.name || customer.customer || customer.lead_name || customer.contact_name || customerId,
    address: customer.address || "",
    created_at: now,
    updated_at: now
  };
  siteVisits.unshift(siteVisit);
  await writeJson(listFiles.site_visits, siteVisits);
  res.json({ ok: true, site_visit: siteVisit, message: `Site visit report saved for ${customer.name}.` });
});

app.patch("/api/portal/site-visits/:id", authRequired, async (req, res) => {
  const id = String(req.params.id || "");
  const customerId = String(req.body?.customer_id || "").trim();
  const customers = await readJson(listFiles.customers, []);
  const inquiries = await readJson(listFiles.sales_inquiries, []);
  const customer = customers.find((item) => String(item.id) === customerId) ||
    inquiries.find((item) => String(item.customer_id || item.id || item.enquiry_no || "") === customerId);
  if (!customer) return res.status(400).json({ ok: false, message: "Select a CRM customer before saving a site visit report." });
  const siteVisits = await readJson(listFiles.site_visits, []);
  const index = siteVisits.findIndex((visit) => String(visit.id || "") === id);
  if (index === -1) return res.status(404).json({ ok: false, message: "Site visit report not found." });
  const siteVisit = {
    ...siteVisits[index],
    ...req.body,
    id,
    customer_id: customerId,
    customer_name: customer.name || customer.customer || customer.lead_name || customer.contact_name || customerId,
    address: customer.address || siteVisits[index].address || "",
    updated_at: new Date().toISOString()
  };
  siteVisits[index] = siteVisit;
  await writeJson(listFiles.site_visits, siteVisits);
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
  res.json({ ok: true, inquiry, record: inquiry });
});

app.patch("/api/portal/sales/inquiries/:id", authRequired, async (req, res) => {
  const records = await readJson(listFiles.sales_inquiries, []);
  const index = findRecordIndex(records, req.params.id);
  if (index < 0) return res.status(404).json({ ok: false, message: "Sales inquiry not found." });
  records[index] = {
    ...normalizeSalesInquiryPayload(req.body, records[index]),
    updated_at: new Date().toISOString()
  };
  await writeJson(listFiles.sales_inquiries, records);
  res.json({ ok: true, inquiry: records[index], record: records[index] });
});

app.delete("/api/portal/sales/inquiries/:id", authRequired, async (req, res) => {
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
  res.type("html").send(`<h1>Estimate ${estimate.id}</h1><pre>${JSON.stringify(estimate, null, 2)}</pre>`);
});

app.get("/api/portal/estimates/:id/offer.:format", authRequired, async (req, res) => {
  const estimates = await readJson(listFiles.estimates, []);
  const estimate = estimates.find((item) => String(item.id) === String(req.params.id));
  if (!estimate) return res.status(404).send("Estimate not found.");
  const format = req.params.format === "pdf" ? "pdf" : "vnd.openxmlformats-officedocument.wordprocessingml.document";
  res.type(format).send(Buffer.from(`FUZI offer\n\n${JSON.stringify(estimate, null, 2)}`));
});

app.post("/api/portal/estimates/:id/approve-offer", authRequired, async (req, res) => {
  await updateCollectionRecord("estimates", req.params.id, { ...req.body, status: "Approved" }, res);
});

app.post("/api/portal/estimates/:id/send", authRequired, async (req, res) => {
  await updateCollectionRecord("estimates", req.params.id, { ...req.body, status: "Sent" }, res);
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
    customer: req.body?.customer || job.customer || job.site || "",
    site: req.body?.site || job.site || "",
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

  res.json({ ok: true, commissioning, message, job: jobs[jobIndex] });
});

app.post("/api/portal/attendance", authRequired, async (req, res) => {
  const payload = cleanPayload(req.body || {});
  const personId = String(payload.person_id || payload.staff_id || "").trim();
  const personName = String(payload.person_name || payload.staff_name || payload.name || "").trim();
  const date = String(payload.date || new Date().toISOString().slice(0, 10)).trim();
  if (!personId || !personName) {
    return res.status(400).json({ ok: false, message: "Attendance requires a staff ID and staff name." });
  }

  const records = await readJson(listFiles.attendance, []);
  const existingIndex = records.findIndex((item) => String(item.person_id || item.staff_id || "") === personId && String(item.date || "") === date);
  const now = new Date().toISOString();
  const record = {
    ...(existingIndex >= 0 ? records[existingIndex] : {}),
    ...payload,
    id: existingIndex >= 0 ? records[existingIndex].id : nextId(records, "ATT"),
    date,
    person_id: personId,
    person_name: personName,
    department: String(payload.department || "").trim(),
    status: String(payload.status || "present").trim(),
    check_in: String(payload.check_in || "").trim(),
    check_out: String(payload.check_out || "").trim(),
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

for (const routeName of Object.keys(routeCollections).filter((route) => !route.includes("/"))) {
  app.get(`/api/portal/${routeName}`, authRequired, async (_req, res) => {
    await listCollection(routeName, res);
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
    await deleteCollectionRecord(routeName, req.params.id, res);
  });
}

app.get("/api/portal/:collection", authRequired, async (req, res) => {
  const file = listFiles[req.params.collection];
  if (!file) return res.status(404).json({ ok: false, message: "Unknown collection." });
  res.json({ ok: true, [req.params.collection]: await readJson(file, []) });
});

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "FUZI API",
    ui: "http://127.0.0.1:8081/",
  });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`FUZI Node API listening on http://127.0.0.1:${port}`);
});
