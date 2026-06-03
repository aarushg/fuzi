import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { apiBaseUrl, apiFetch } from "./api";
import { PublicWebsite } from "./PublicWebsite";
import type { Customer, PortalData, SiteVisit } from "./types";

type TabKey =
  | "overview"
  | "modules"
  | "customers"
  | "offerManager"
  | "tickets"
  | "projects"
  | "installations"
  | "team"
  | "accounts"
  | "renewals"
  | "workorders"
  | "inventory"
  | "estimator"
  | "orgchart"
  | "sales"
  | "installation_dept"
  | "breakdown"
  | "service"
  | "gad"
  | "finance"
  | "commissioning"
  | "backoffice"
  | "tender"
  | "factory"
  | "internationalVendor"
  | "comms"
  | "siteVisits";

type ModuleConfig = {
  route: string;
  titleLabel: string;
  titleKey: string;
  customerKey?: string;
  notesKey?: string;
};

type CostingSourceCell = {
  sheet: string;
  cell: string;
  value: unknown;
  formula?: string;
};

type CostingSource = {
  source_file: string;
  variant: string;
  sheets: Array<{ name: string; non_empty_cell_count: number }>;
  non_empty_cell_count: number;
  cells: CostingSourceCell[];
};

const navItems: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: "overview", label: "Overview", icon: "⌂" },
  { key: "modules", label: "Platform Modules", icon: "▦" },
  { key: "customers", label: "Customers", icon: "◉" },
  { key: "offerManager", label: "Offer Manager", icon: "▥" },
  { key: "tickets", label: "Project Tickets", icon: "✓" },
  { key: "projects", label: "Projects", icon: "◇" },
  { key: "installations", label: "Installations", icon: "⇧" },
  { key: "team", label: "Install Team", icon: "☷" },
  { key: "accounts", label: "Team Accounts", icon: "◌" },
  { key: "renewals", label: "Renewals", icon: "↻" },
  { key: "workorders", label: "Work Orders", icon: "▤" },
  { key: "inventory", label: "Inventory", icon: "▣" },
  { key: "orgchart", label: "Staff & Attendance", icon: "◍" },
  { key: "siteVisits", label: "Site Visits", icon: "⌖" },
  { key: "installation_dept", label: "Installation Dept", icon: "⚙" },
  { key: "breakdown", label: "Breakdown Portal", icon: "⚡" },
  { key: "service", label: "Service", icon: "✚" },
  { key: "gad", label: "GAD Drawings", icon: "⌖" },
  { key: "finance", label: "Accounts", icon: "₹" },
  { key: "commissioning", label: "Commissioning", icon: "◎" },
  { key: "backoffice", label: "Back Office", icon: "◫" },
  { key: "tender", label: "Tender", icon: "◈" },
  { key: "factory", label: "Factory", icon: "▧" },
  { key: "internationalVendor", label: "International Vendor", icon: "⇄" },
  { key: "comms", label: "Dept Comms", icon: "☰" },
];

const sharedPortalPassword = process.env.EXPO_PUBLIC_FUZI_PORTAL_PASSWORD || "Fuzi@2026!Portal";

const quickLoginAccounts = [
  { label: "Admin", username: "admin", password: sharedPortalPassword },
  { label: "CEO", username: "atul.singhal", password: sharedPortalPassword },
  { label: "Installation Head", username: "ashwani.kumar", password: sharedPortalPassword },
  { label: "Breakdown Head", username: "bhanwar.choudhary", password: sharedPortalPassword },
  { label: "Service Head", username: "jitendra.choudhary", password: sharedPortalPassword },
  { label: "GAD Head", username: "diyanshu.bansal", password: sharedPortalPassword },
  { label: "Accounts Head", username: "sandeep.sharma", password: sharedPortalPassword },
  { label: "Commissioning Head", username: "vishram.kumawat", password: sharedPortalPassword },
  { label: "Tender Head", username: "bharat.singh.choudhary", password: sharedPortalPassword },
  { label: "Factory Head", username: "roopchand.gurjar", password: sharedPortalPassword },
  { label: "Back Office Head", username: "jitendra.singh.hada", password: sharedPortalPassword },
];

const moduleConfigs: Partial<Record<TabKey, ModuleConfig>> = {
  tickets: { route: "/api/portal/project-tickets", titleLabel: "Ticket title", titleKey: "title", customerKey: "project", notesKey: "notes" },
  projects: { route: "/api/portal/install-jobs", titleLabel: "Project / job reference", titleKey: "job_id", customerKey: "customer", notesKey: "site" },
  installations: { route: "/api/portal/install-jobs", titleLabel: "Installation job reference", titleKey: "job_id", customerKey: "customer", notesKey: "site" },
  team: { route: "/api/portal/install-team", titleLabel: "Team member name", titleKey: "name", customerKey: "role", notesKey: "current_job" },
  accounts: { route: "/api/portal/users", titleLabel: "Display name", titleKey: "display_name", customerKey: "department", notesKey: "role" },
  inventory: { route: "/api/portal/inventory", titleLabel: "Part / item name", titleKey: "item", customerKey: "category", notesKey: "notes" },
  orgchart: { route: "/api/portal/attendance", titleLabel: "Staff name", titleKey: "staff_name", customerKey: "department", notesKey: "notes" },
  sales: { route: "/api/portal/sales/inquiries", titleLabel: "Inquiry / customer", titleKey: "customer", customerKey: "site", notesKey: "notes" },
  installation_dept: { route: "/api/portal/install-jobs", titleLabel: "Department job", titleKey: "job_id", customerKey: "customer", notesKey: "site" },
  breakdown: { route: "/api/portal/breakdown", titleLabel: "Breakdown unit", titleKey: "unit", customerKey: "customer", notesKey: "issue" },
  service: { route: "/api/portal/service", titleLabel: "Service job number", titleKey: "job_number", customerKey: "customer", notesKey: "notes" },
  gad: { route: "/api/portal/gad", titleLabel: "Drawing number", titleKey: "drawing_no", customerKey: "customer", notesKey: "unit" },
  finance: { route: "/api/portal/payments", titleLabel: "Payment reference", titleKey: "payment_id", customerKey: "customer_name", notesKey: "notes" },
  commissioning: { route: "/api/portal/commissioning", titleLabel: "Commissioning unit", titleKey: "unit", customerKey: "customer", notesKey: "notes" },
  backoffice: { route: "/api/portal/customers", titleLabel: "Customer / building name", titleKey: "name", customerKey: "address", notesKey: "notes" },
  tender: { route: "/api/portal/tender", titleLabel: "Tender title", titleKey: "title", customerKey: "customer", notesKey: "notes" },
  factory: { route: "/api/portal/factory", titleLabel: "Factory order ref", titleKey: "order_ref", customerKey: "customer", notesKey: "materials" },
  internationalVendor: { route: "/api/portal/international-vendors", titleLabel: "Company", titleKey: "company", customerKey: "country", notesKey: "notes" },
  comms: { route: "/api/portal/comms", titleLabel: "Subject", titleKey: "subject", customerKey: "department", notesKey: "message" },
};

const emptyModuleDraft = { title: "", customer: "", customer_id: "", status: "Open", notes: "" };
const emptyPaymentDraft = {
  estimate_id: "",
  milestone: "Advance",
  amount: "",
  due_date: "",
  method: "NEFT",
  reference: "",
  notes: "",
};
const emptyInventoryDraft = {
  name: "",
  category: "",
  customer_id: "",
  customer_name: "",
  offer_id: "",
  offer_name: "",
  source_inquiry_id: "",
  reserved_for: "",
  qty_on_hand: "",
  qty_reserved: "",
  reorder_point: "",
  target_stock: "",
  unit: "pcs",
  vendor: "",
  lead_time_days: "",
  unit_cost: "",
  bin_location: "",
  notes: "",
};
const emptyInternationalVendorDraft = {
  company: "",
  country: "Canada",
  region: "",
  website: "",
  email: "",
  phone: "",
  contact_name: "",
  product_interest: "Elevator parts and kits",
  fuzi_cost: "",
  install_cost: "",
  shipping_cost: "",
  freight_mode: "Ocean LCL",
  destination_country: "Canada",
  destination_port: "",
  package_count: "1",
  length_cm: "",
  width_cm: "",
  height_cm: "",
  actual_weight_kg: "",
  freight_rate: "",
  customs_duty_percent: "",
  import_tax_percent: "",
  broker_fee: "",
  port_fee: "",
  insurance_percent: "1",
  partner_percent: "2",
  bid_value: "",
  tender_area: "",
  tender_source: "",
  status: "Prospect",
  followup_stage: "1. Catalog intro",
  pipeline_stage: "Lead identified",
  incoterm: "FOB India",
  export_docs_status: "Not started",
  production_status: "Not started",
  shipment_status: "Not booked",
  tracking_ref: "",
  next_followup: "",
  openclaw_target: "",
  notes: "",
};

const internationalVendorPipelineStages = [
  "Lead identified",
  "Qualified partner",
  "Catalog sent",
  "Cost sheet sent",
  "Tender found",
  "Bid partnership",
  "OpenClaw email drafted",
  "Meeting requested",
  "Meeting booked",
  "Sample/smart parts quoted",
  "Heavy kit quoted",
  "PO requested",
  "Production planned",
  "Export docs ready",
  "Freight booked",
  "Customs/import review",
  "Shipped",
  "Delivered",
  "Partner active",
  "Lost",
];
const emptyBreakdownDraft = {
  customer_id: "",
  customer: "",
  unit: "",
  phone: "",
  location: "",
  issue: "",
  priority: "High",
  engineer: "",
  trapped_passenger: "N",
  scheduled_at: "",
};
const emptyInstallTeamDraft = {
  name: "",
  role: "Technician",
  phone: "",
  skills: "",
  availability: "Available",
  current_job: "",
  shift: "",
  notes: "",
};
const emptyCommissioningDraft = {
  installation_ref: "",
  unit: "",
  customer: "",
  site: "",
  install_complete_date: "",
  payment_cleared: "N",
  start_date: "",
  handover_date: "",
  status: "Pending",
  notes: "",
};
const emptyAttendanceDraft = {
  person_id: "",
  person_name: "",
  department: "",
  date: new Date().toISOString().slice(0, 10),
  status: "present",
  check_in: "",
  check_out: "",
  notes: "",
};
const emptyLeaveDraft = {
  person_id: "",
  person_name: "",
  department: "",
  leave_type: "Casual Leave",
  start_date: new Date().toISOString().slice(0, 10),
  end_date: new Date().toISOString().slice(0, 10),
  reason: "",
};
const emptyAccountDraft = {
  id: "",
  username: "",
  display_name: "",
  department: "",
  role: "manager",
  password: "",
  active: "Y",
};
const emptyRenewalDraft = {
  customer_id: "",
  customer: "",
  renewal_date: "",
  days: "",
  value: "Medium",
  contact_email: "",
  notes: "",
};
const emptySalesInquiryDraft = {
  id: "",
  customer_id: "",
  enquiry_no: "",
  customer: "",
  enquiry_remark: "",
  lead_status: "Enquiry Pending",
  whatsapp_no: "",
  lead_type: "New",
  qty: "1",
  phone: "",
  address: "",
  received_date: new Date().toISOString().slice(0, 10),
  referral_by: "",
  createdbyname: "",
  lastmodifiedbyname: "",
  assigned_to: "Sales",
  next_followup: "",
  followup_channel: "WhatsApp",
  followup_frequency_days: "7",
  followup_status: "Open",
  last_followup: "",
  lost_reason: "",
  notes: "",
};
const emptyOfferDraft = {
  job_no: "",
  offer_date: new Date().toISOString().slice(0, 10),
  customer_name: "",
  offer_name: "",
  offer_type: "Individual",
  lead_status: "Offer Pending",
  elevator_type: "Passenger Elevator",
  stops: "",
  capacity: "",
  speed: "",
  drive_type: "",
  door_type: "",
  finish: "",
  material_cost: "",
  install_cost: "",
  overhead_cost: "",
  margin_percent: "15",
  discount: "",
  gst_percent: "18",
  total_cost: "",
  offer_valid_until: "",
  payment_terms: "40% advance, 50% before dispatch, 10% after installation",
  delivery_timeline: "As per final technical approval and material readiness",
  warranty_terms: "12 months from handover against manufacturing defects",
  createdbyname: "",
  lastmodifiedbyname: "",
  notes: "",
  customer_id: "",
  source_inquiry_id: "",
};

const emptyCustomer: Partial<Customer> = {
  name: "",
  phone: "",
  address: "",
  contact_person: "",
  email: "",
  segment: "Residential",
  status: "Active",
  pipeline_stage: "Lead",
  lead_source: "",
  account_owner: "",
  next_follow_up: "",
  preferred_channel: "Phone",
  gstin: "",
  pan: "",
  state: "",
  place_of_supply: "",
  dpdp_consent: "N",
  dpdp_consent_at: "",
  marketing_consent: "N",
  dlt_reference: "",
  consent_notes: "",
  notes: "",
};

const emptySiteVisit: Partial<SiteVisit> = {
  customer_id: "",
  site_person_name: "",
  site_person_mobile: "",
  reference_given_by: "",
  reference_mobile: "",
  pit_size_mm: "",
  machine_room_available: "N",
  site_visit_date: "",
  site_offer_no: "",
  site_enquiry_no: "",
  floor_height_profile: "",
  opening_schedule: [],
  site_offer_type: "",
  site_motor_required: "",
  site_finish_required: "",
  site_door_required: "",
  site_number_of_openings: "",
  site_stops: "",
  site_opening_type: "",
  door_size_width_mm: "",
  door_size_height_mm: "",
  car_size_width_mm: "",
  car_size_depth_mm: "",
  site_capacity_persons: "",
  site_capacity_kg: "",
  shaft_width_mm: "",
  shaft_depth_mm: "",
  brick_wall_available: "",
  civil_door_height_mm: "",
  visited_by: "",
  notes: "",
};

const customerFields: Array<{ key: keyof Customer; label: string; keyboard?: "default" | "phone-pad"; multiline?: boolean }> = [
  { key: "name", label: "Customer / building name" },
  { key: "address", label: "Address" },
  { key: "contact_person", label: "Contact person" },
  { key: "phone", label: "Mobile phone", keyboard: "phone-pad" },
  { key: "email", label: "Email" },
  { key: "segment", label: "Segment" },
  { key: "pipeline_stage", label: "Pipeline stage" },
  { key: "lead_source", label: "Lead source" },
  { key: "account_owner", label: "Account owner" },
  { key: "next_follow_up", label: "Next follow-up YYYY-MM-DD" },
  { key: "preferred_channel", label: "Preferred channel" },
  { key: "gstin", label: "GSTIN" },
  { key: "pan", label: "PAN" },
  { key: "state", label: "State" },
  { key: "place_of_supply", label: "Place of supply" },
  { key: "dpdp_consent", label: "DPDP consent Y/N" },
  { key: "dpdp_consent_at", label: "DPDP consent date" },
  { key: "marketing_consent", label: "Marketing/DLT consent Y/N" },
  { key: "dlt_reference", label: "DLT reference" },
  { key: "consent_notes", label: "Consent/compliance notes", multiline: true },
  { key: "notes", label: "Customer notes", multiline: true },
];

const siteVisitFields: Array<{ key: keyof SiteVisit; label: string; keyboard?: "default" | "numeric" | "phone-pad"; multiline?: boolean }> = [
  { key: "site_person_name", label: "Site person name" },
  { key: "site_person_mobile", label: "Site person mobile", keyboard: "phone-pad" },
  { key: "reference_given_by", label: "Reference given by" },
  { key: "reference_mobile", label: "Reference mobile", keyboard: "phone-pad" },
  { key: "pit_size_mm", label: "Pit available mm", keyboard: "numeric" },
  { key: "machine_room_available", label: "Machine room available Y/N" },
  { key: "site_visit_date", label: "Site visit date YYYY-MM-DD" },
  { key: "site_offer_no", label: "Offer no." },
  { key: "site_enquiry_no", label: "Enquiry no." },
  { key: "site_offer_type", label: "Offer to be given" },
  { key: "site_motor_required", label: "Motor required" },
  { key: "site_finish_required", label: "Finish required" },
  { key: "site_door_required", label: "Door required" },
  { key: "site_stops", label: "How many stops?", keyboard: "numeric" },
  { key: "site_number_of_openings", label: "Number of openings", keyboard: "numeric" },
  { key: "site_opening_type", label: "Center / side opening" },
  { key: "door_size_width_mm", label: "Door width mm", keyboard: "numeric" },
  { key: "door_size_height_mm", label: "Door height mm", keyboard: "numeric" },
  { key: "car_size_width_mm", label: "Car width mm", keyboard: "numeric" },
  { key: "car_size_depth_mm", label: "Car depth mm", keyboard: "numeric" },
  { key: "site_capacity_persons", label: "Capacity persons", keyboard: "numeric" },
  { key: "site_capacity_kg", label: "Capacity kg", keyboard: "numeric" },
  { key: "shaft_width_mm", label: "Shaft width mm", keyboard: "numeric" },
  { key: "shaft_depth_mm", label: "Shaft depth mm", keyboard: "numeric" },
  { key: "brick_wall_available", label: "Brick wall Y/N" },
  { key: "civil_door_height_mm", label: "Civil door height mm", keyboard: "numeric" },
  { key: "visited_by", label: "Visited by" },
  { key: "notes", label: "Site visit notes", multiline: true },
];

const inquiryLifecycleStatuses = [
  "Inquiry Pending",
  "Inquiry Lost",
  "Site Visit Pending",
  "Site Visit Done",
  "Site Not Visited, Offer Pending",
  "Site Visit Lost",
  "Offer Pending",
  "Offer Submitted",
  "Offer Lost",
  "Order Received",
  "Order Lost",
  "Work In Progress",
  "Hand Over",
  "Warranty Running",
  "Warranty Lost",
  "AMC Running",
  "One Time Service",
];

function formatMoney(value?: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);
}

function offerNumber(value: unknown, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function offerCostSummary(record: Record<string, unknown>) {
  const materialCost = offerNumber(record.material_cost);
  const installCost = offerNumber(record.install_cost);
  const overheadCost = offerNumber(record.overhead_cost);
  const marginPercent = offerNumber(record.margin_percent, 15);
  const discount = offerNumber(record.discount);
  const gstPercent = offerNumber(record.gst_percent, 18);
  const baseCost = materialCost + installCost + overheadCost;
  const marginAmount = Math.round((baseCost * marginPercent) / 100);
  const subtotal = Math.max(0, baseCost + marginAmount - discount);
  const gstAmount = Math.round((subtotal * gstPercent) / 100);
  const calculatedTotal = subtotal + gstAmount;
  const savedTotal = offerNumber(record.total_cost);
  const totalCost = savedTotal || calculatedTotal;
  return { materialCost, installCost, overheadCost, marginPercent, marginAmount, discount, gstPercent, gstAmount, baseCost, subtotal, totalCost };
}

export default function App() {
  const { width } = useWindowDimensions();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState(sharedPortalPassword);
  const [token, setToken] = useState("");
  const [data, setData] = useState<PortalData | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [showPortalLogin, setShowPortalLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [customerDraft, setCustomerDraft] = useState<Partial<Customer>>(emptyCustomer);
  const [customerEditorOpen, setCustomerEditorOpen] = useState(false);
  const [siteVisitDraft, setSiteVisitDraft] = useState<Partial<SiteVisit>>(emptySiteVisit);
  const [siteVisitEditorOpen, setSiteVisitEditorOpen] = useState(false);
  const [siteVisitCustomerSearch, setSiteVisitCustomerSearch] = useState("");
  const [moduleDraft, setModuleDraft] = useState(emptyModuleDraft);
  const [serviceEditDrafts, setServiceEditDrafts] = useState<Record<string, Record<string, string>>>({});
  const [serviceCustomerDropdownOpen, setServiceCustomerDropdownOpen] = useState(false);
  const [serviceCustomerSearch, setServiceCustomerSearch] = useState("");
  const [serviceRecordSearch, setServiceRecordSearch] = useState("");
  const [paymentDraft, setPaymentDraft] = useState(emptyPaymentDraft);
  const [breakdownDraft, setBreakdownDraft] = useState(emptyBreakdownDraft);
  const [installTeamDraft, setInstallTeamDraft] = useState(emptyInstallTeamDraft);
  const [commissioningDraft, setCommissioningDraft] = useState(emptyCommissioningDraft);
  const [attendanceDraft, setAttendanceDraft] = useState(emptyAttendanceDraft);
  const [leaveDraft, setLeaveDraft] = useState(emptyLeaveDraft);
  const [hrSearch, setHrSearch] = useState("");
  const [hrDepartmentFilter, setHrDepartmentFilter] = useState("All");
  const [crmSearch, setCrmSearch] = useState("");
  const [crmStageFilter, setCrmStageFilter] = useState("All");
  const [customerPage, setCustomerPage] = useState(1);
  const [enquiryPage, setEnquiryPage] = useState(1);
  const [offerPage, setOfferPage] = useState(1);
  const [accountDraft, setAccountDraft] = useState(emptyAccountDraft);
  const [renewalDraft, setRenewalDraft] = useState(emptyRenewalDraft);
  const [inventoryDraft, setInventoryDraft] = useState(emptyInventoryDraft);
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryEdits, setInventoryEdits] = useState<Record<string, { reorder_point: string; target_stock: string }>>({});
  const [internationalVendorDraft, setInternationalVendorDraft] = useState(emptyInternationalVendorDraft);
  const [internationalVendorSearch, setInternationalVendorSearch] = useState("");
  const [salesInquiryDraft, setSalesInquiryDraft] = useState(emptySalesInquiryDraft);
  const [salesInquiryEditorOpen, setSalesInquiryEditorOpen] = useState(false);
  const [offerDraft, setOfferDraft] = useState<Record<string, any>>(emptyOfferDraft);
  const [costingEditorOpen, setCostingEditorOpen] = useState(false);
  const [costingSources, setCostingSources] = useState<CostingSource[]>([]);
  const [costingSourcesLoading, setCostingSourcesLoading] = useState(false);
  const [costingSourceIndex, setCostingSourceIndex] = useState(0);
  const [costingCellStep, setCostingCellStep] = useState(0);
  const [breakdownScheduleDrafts, setBreakdownScheduleDrafts] = useState<Record<string, string>>({});
  const [breakdownEngineerTaskDrafts, setBreakdownEngineerTaskDrafts] = useState<Record<string, string>>({});
  const [breakdownCustomerDropdownOpen, setBreakdownCustomerDropdownOpen] = useState(false);
  const [breakdownCustomerSearch, setBreakdownCustomerSearch] = useState("");

  const isSignedIn = Boolean(token);
  const isWide = width >= 920;
  const asRecords = (value: unknown): Array<Record<string, unknown>> => (Array.isArray(value) ? (value as Array<Record<string, unknown>>) : []);
  const isAdmin = String(data?.viewer?.role || "").trim().toLowerCase() === "admin";
  const visibleNavItems = useMemo(() => {
    const allowed = data?.access?.allowed_views;
    const roleFiltered = navItems.filter((item) => item.key !== "internationalVendor" || isAdmin);
    if (!allowed?.length) return roleFiltered;
    const allowedSet = new Set(allowed);
    return roleFiltered.filter((item) => allowedSet.has(item.key));
  }, [data?.access, isAdmin]);
  const lowStock = useMemo(
    () => (data?.inventory || []).filter((item) => {
      const onHand = Number(item.qty_on_hand ?? item.stock ?? 0);
      const reserved = Number(item.qty_reserved ?? 0);
      const reorderPoint = Number(item.reorder_point ?? item.min_stock ?? 0);
      return String(item.status || "").toLowerCase().includes("reorder") || onHand - reserved <= reorderPoint;
    }),
    [data],
  );
  const assignableStaff = useMemo(() => {
    const activeBreakdownByEngineer = new Map<string, string>();
    asRecords(data?.breakdowns).forEach((breakdown) => {
      const status = String(breakdown.status || "").trim().toLowerCase();
      if (["closed", "resolved", "done", "cancelled"].includes(status)) return;
      const engineer = String(
        breakdown.scheduled_engineer ||
        breakdown.engineer ||
        breakdown.assigned_to ||
        breakdown.technician ||
        ""
      ).trim();
      const task = String(breakdown.id || breakdown.current_task || breakdown.current_job || "").trim();
      if (engineer && task && !activeBreakdownByEngineer.has(engineer.toLowerCase())) {
        activeBreakdownByEngineer.set(engineer.toLowerCase(), task);
      }
    });
    const usersByOrgNode = new Map(asRecords(data?.users).map((user) => [String(user.linked_org_node || ""), user]));
    const usersByName = new Map(asRecords(data?.users).map((user) => [String(user.display_name || user.username || "").trim().toLowerCase(), user]));
    const breakdownStaff = asRecords(data?.org_chart)
      .filter((person) => String(person.department || "").trim().toLowerCase() === "breakdown")
      .filter((person) => !String(person.title || "").toLowerCase().includes("supervisor"))
      .map((person) => {
        const name = String(person.name || "");
        const linkedUser = usersByOrgNode.get(String(person.id || "")) || usersByName.get(name.trim().toLowerCase());
        const savedTask = String(person.current_job || person.current_task || "").trim();
        const activeTask = savedTask || activeBreakdownByEngineer.get(name.trim().toLowerCase()) || "";
        const savedAvailability = String(person.availability || "").trim();
        const savedNextAvailable = String(person.next_available_at || "").trim();
        return {
          id: String(person.id || name),
          name,
          role: String(person.title || "Breakdown Staff"),
          phone: String(person.phone || linkedUser?.phone || ""),
          availability: String(linkedUser?.active === false ? "Inactive" : (activeTask ? "Scheduled" : (savedAvailability || "Available"))),
          current_job: savedTask,
          active_breakdown: activeBreakdownByEngineer.get(name.trim().toLowerCase()) || "",
          next_available_at: activeTask ? (savedNextAvailable || "after current task") : savedNextAvailable,
          shift: String(person.shift || "24/7 emergency rotation"),
          notes: String(person.notes || "Breakdown dispatch pool"),
        };
      });
    const seen = new Set<string>();
    return breakdownStaff.filter((member) => {
      const key = member.name.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [data]);
  const costingCellsPerStep = 80;
  const selectedCostingSource = costingSources[Math.min(costingSourceIndex, Math.max(costingSources.length - 1, 0))];
  const costingCellChunks = useMemo(() => {
    const cells = selectedCostingSource?.cells || [];
    const chunks: CostingSourceCell[][] = [];
    for (let index = 0; index < cells.length; index += costingCellsPerStep) {
      chunks.push(cells.slice(index, index + costingCellsPerStep));
    }
    return chunks;
  }, [selectedCostingSource]);
  const visibleCostingCells = costingCellChunks[Math.min(costingCellStep, Math.max(costingCellChunks.length - 1, 0))] || [];

  useEffect(() => {
    if (costingEditorOpen && token && !costingSources.length && !costingSourcesLoading) {
      loadCostingSourceData();
    }
  }, [costingEditorOpen, token, costingSources.length, costingSourcesLoading]);

  useEffect(() => {
    setCostingCellStep(0);
  }, [costingSourceIndex]);

  async function loadCostingSourceData() {
    if (!token) return;
    setCostingSourcesLoading(true);
    try {
      const response = await apiFetch<{ ok: boolean; sources: CostingSource[] }>("/api/portal/costing-source-data", { token });
      setCostingSources(response.sources || []);
      setCostingSourceIndex(0);
      setCostingCellStep(0);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Costing source data could not be loaded.");
    } finally {
      setCostingSourcesLoading(false);
    }
  }

  function attachSelectedCostingSource() {
    if (!selectedCostingSource) return;
    const totalCell = selectedCostingSource.cells.find((cell) => String(cell.cell).toUpperCase() === "R53") || selectedCostingSource.cells.find((cell) => String(cell.cell).toUpperCase().endsWith("53"));
    const totalValue = typeof totalCell?.value === "number" ? String(totalCell.value) : offerDraft.total_cost;
    setOfferDraft((draft) => ({
      ...draft,
      offer_type: draft.offer_type || selectedCostingSource.variant,
      total_cost: totalValue || draft.total_cost,
      costing_source_file: selectedCostingSource.source_file,
      expanded_costing_data: selectedCostingSource,
      expanded_costing_data_status: "All source values attached as user-entered costing data",
    }));
    setMessage(`Attached all costing data from ${selectedCostingSource.source_file}. Review the step-by-step values before saving.`);
  }

  function openingScheduleRows(draft: Partial<SiteVisit>) {
    return Array.isArray(draft.opening_schedule) ? draft.opening_schedule : [];
  }

  function desiredOpeningCount(draft: Partial<SiteVisit>) {
    const openings = Number(draft.site_number_of_openings || 0);
    const stops = Number(draft.site_stops || 0);
    return Math.max(0, Math.floor(openings || stops || 0));
  }

  function ensureOpeningSchedule(draft: Partial<SiteVisit>, count: number) {
    const current = openingScheduleRows(draft);
    return Array.from({ length: Math.max(0, count) }, (_, index) => ({
      floor: current[index]?.floor || (index === 0 ? "Ground" : String(index)),
      ff_height_mm: current[index]?.ff_height_mm || "",
      lintel_height_mm: current[index]?.lintel_height_mm || "",
    }));
  }

  function updateSiteVisitField(key: keyof SiteVisit, value: string) {
    setSiteVisitDraft((draft) => {
      const next: Partial<SiteVisit> = { ...draft, [key]: value };
      if (key === "site_stops" || key === "site_number_of_openings") {
        next.opening_schedule = ensureOpeningSchedule(next, desiredOpeningCount(next));
      }
      return next;
    });
  }

  function updateOpeningScheduleRow(index: number, key: "floor" | "ff_height_mm" | "lintel_height_mm", value: string) {
    setSiteVisitDraft((draft) => {
      const rows = ensureOpeningSchedule(draft, Math.max(desiredOpeningCount(draft), index + 1));
      rows[index] = { ...rows[index], [key]: value };
      return { ...draft, opening_schedule: rows, floor_height_profile: rows.map((row) => `${row.floor}: FF ${row.ff_height_mm || "-"} mm, lintel ${row.lintel_height_mm || "-"} mm`).join("\n") };
    });
  }

  function fieldText(record: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
      const value = record[key];
      if (value !== undefined && value !== null && String(value).trim()) {
        return String(value);
      }
    }
    return "-";
  }

  function viewerStaffRecord(staff: Array<Record<string, unknown>>) {
    const viewer = (data?.viewer || {}) as Record<string, unknown>;
    const linkedId = String(viewer.linked_org_node || viewer.linked_team_member || "").trim();
    const viewerName = String(viewer.display_name || viewer.name || "").trim().toLowerCase();
    const usernameName = String(viewer.username || "").replace(/\./g, " ").trim().toLowerCase();
    return staff.find((person) => linkedId && fieldText(person, ["id"]) === linkedId)
      || staff.find((person) => fieldText(person, ["name"]).toLowerCase() === viewerName)
      || staff.find((person) => fieldText(person, ["name"]).toLowerCase() === usernameName);
  }

  function attendanceLocationText(location: unknown) {
    if (!location || typeof location !== "object") return "";
    const item = location as Record<string, unknown>;
    const latitude = Number(item.latitude ?? item.lat);
    const longitude = Number(item.longitude ?? item.lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return "";
    const accuracy = Number(item.accuracy_m ?? item.accuracy);
    const accuracyText = Number.isFinite(accuracy) ? ` +/- ${Math.round(accuracy)} m` : "";
    return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}${accuracyText}`;
  }

  async function captureAttendanceLocation() {
    const geolocation = Platform.OS === "web" ? globalThis.navigator?.geolocation : undefined;
    if (!geolocation) {
      setMessage("Location capture is not available in this browser.");
      return null;
    }
    return new Promise<Record<string, unknown> | null>((resolve) => {
      geolocation.getCurrentPosition(
        (position) => resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy_m: position.coords.accuracy,
          captured_at: new Date().toISOString(),
        }),
        (error) => {
          setMessage(`Location could not be captured: ${error.message}`);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  }

  function staffAvailabilityInfo(member: Record<string, unknown>) {
    const availability = String(member.availability || "Available").trim();
    const shift = String(member.shift || "").trim();
    const currentJob = String(member.current_job || member.active_breakdown || "").trim();
    const nextAvailable = String(member.next_available_at || "").trim();
    const notes = String(member.notes || "").trim();
    const availableNow = ["available", "standby", "ready"].includes(availability.toLowerCase()) && !currentJob;
    const when = availableNow
      ? "Available now"
      : availability.toLowerCase() === "off duty"
        ? (nextAvailable || shift ? `Off duty - available ${nextAvailable || shift}` : "Off duty")
        : currentJob
          ? `Busy on ${currentJob}${nextAvailable ? ` - available ${nextAvailable}` : ""}`
          : availability;
    return {
      availableNow,
      summary: [when, shift && !when.includes(shift) ? `Shift ${shift}` : "", notes].filter(Boolean).join(" - "),
    };
  }

  function defaultBreakdownScheduleTime() {
    const date = new Date(Date.now() + 30 * 60 * 1000);
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function recordIdentity(record: Record<string, unknown>) {
    return String(record.id || record.job_id || record.payment_id || record.drawing_no || record.job_number || "");
  }

  function inventoryQuantity(record: Record<string, unknown>, key: string, fallback = 0) {
    const value = Number(record[key] ?? fallback);
    return Number.isFinite(value) ? value : fallback;
  }

  function inventoryAvailable(record: Record<string, unknown>) {
    return inventoryQuantity(record, "qty_on_hand", inventoryQuantity(record, "stock")) - inventoryQuantity(record, "qty_reserved");
  }

  function inventoryReorderQty(record: Record<string, unknown>) {
    const available = inventoryAvailable(record);
    const reorderPoint = inventoryQuantity(record, "reorder_point", inventoryQuantity(record, "min_stock"));
    const target = inventoryQuantity(record, "target_stock", Math.max(reorderPoint * 2, available));
    return Math.max(0, target - available);
  }

  function inventoryDisplayStatus(record: Record<string, unknown>) {
    const available = inventoryAvailable(record);
    const reorderPoint = inventoryQuantity(record, "reorder_point", inventoryQuantity(record, "min_stock"));
    const hasOpenPo = Boolean(record.po_number || String(record.po_status || "").toLowerCase().includes("raised") || String(record.status || "").toLowerCase().includes("order"));
    if (available <= 0) return hasOpenPo ? "On Order" : "Out of Stock";
    if (available <= reorderPoint) return hasOpenPo ? "On Order" : "Reorder Needed";
    return "In Stock";
  }

  function salesInquiryStatusTone(status: string) {
    const normalized = status.toLowerCase();
    if (normalized.includes("lost")) return "#7a2630";
    if (normalized.includes("order") || normalized.includes("running")) return "#0f766e";
    if (normalized.includes("offer") || normalized.includes("site")) return "#925f00";
    return "#b91414";
  }

  function isLostInquiryStatus(status: string) {
    return status.toLowerCase().includes("lost");
  }

  function recordCustomerContext(record: Record<string, unknown>) {
    const explicitId = fieldText(record, ["customer_id", "crm_customer_id", "customerId"]).replace("-", "").trim();
    const customerName = fieldText(record, ["customer", "customer_name", "building", "account", "client", "name"]).replace("-", "").trim();
    const siteName = fieldText(record, ["site", "location", "address"]).replace("-", "").trim();
    const customers = data?.customers || [];
    const inquiries = asRecords(data?.sales_inquiries);
    const customer = customers.find((item) => explicitId && String(item.id || "") === explicitId)
      || customers.find((item) => customerName && crmNameKey(item.name) === crmNameKey(customerName))
      || customers.find((item) => siteName && crmNameKey(item.address) === crmNameKey(siteName));
    const inquiry = inquiries.find((item) =>
      explicitId && [item.customer_id, item.id, item.enquiry_no, item.source_enquiry_no].some((value) => String(value || "") === explicitId)
    ) || inquiries.find((item) =>
      customerName && crmNameKey(item.customer || item.lead_name || item.name) === crmNameKey(customerName)
    );
    const id = String(customer?.id || inquiry?.customer_id || explicitId || "").trim();
    const name = String(customer?.name || inquiry?.customer || inquiry?.lead_name || customerName || "").trim();
    const key = crmNameKey(name);
    const inquiryIds = new Set<string>();
    if (inquiry) {
      [inquiry.id, inquiry.enquiry_no, inquiry.source_enquiry_no, inquiry.customer_id].forEach((value) => {
        const text = String(value || "").trim();
        if (text) inquiryIds.add(text);
      });
    }
    if (!id && !name) return null;
    const matchesName = (value: unknown) => Boolean(key && crmNameKey(value) === key);
    const matchesId = (value: unknown) => Boolean(id && String(value || "").trim() === id);
    const estimates = asRecords(data?.estimates).filter((item) =>
      matchesId(item.customer_id) || matchesName(item.customer_name || item.offer_name || item.customer) || inquiryIds.has(String(item.source_inquiry_id || "").trim())
    );
    const estimateIds = new Set(estimates.map((item) => recordIdentity(item)).filter(Boolean));
    const related = {
      estimates: estimates.length,
      payments: asRecords(data?.payments).filter((item) =>
        estimateIds.has(String(item.estimate_id || "").trim()) || matchesId(item.customer_id) || matchesName(item.customer_name || item.customer)
      ).length,
      siteVisits: asRecords(data?.site_visits).filter((item) => matchesId(item.customer_id) || matchesName(item.customer_name)).length,
      breakdowns: asRecords(data?.breakdowns).filter((item) => matchesId(item.customer_id) || matchesName(item.customer) || matchesName(item.location || item.site)).length,
      service: asRecords(data?.service_records).filter((item) => matchesId(item.customer_id) || matchesName(item.customer) || matchesName(item.building)).length,
      installJobs: asRecords(data?.install_jobs).filter((item) => matchesId(item.customer_id) || matchesName(item.customer) || matchesName(item.site)).length,
    };
    return { id, name, related };
  }

  function renderLinkedSystems(record: Record<string, unknown>) {
    const customerContext = recordCustomerContext(record);
    if (!customerContext) return null;
    return (
      <View style={styles.linkedSystemsPanel}>
        <Text style={styles.cardLabel}>Linked systems</Text>
        <Text style={styles.muted}>
          CRM {customerContext.id || customerContext.name} - Estimates {customerContext.related.estimates} - Payments {customerContext.related.payments} - Site visits {customerContext.related.siteVisits} - Service {customerContext.related.service} - Breakdowns {customerContext.related.breakdowns} - Install jobs {customerContext.related.installJobs}
        </Text>
        <View style={styles.inlineActions}>
          <Pressable style={styles.smallButton} onPress={() => openCrmForCustomerNumber(customerContext.id || customerContext.name)} disabled={loading}>
            <Text style={styles.smallButtonText}>Open CRM</Text>
          </Pressable>
          <Pressable
            style={styles.smallButton}
            onPress={() => {
              setSiteVisitCustomerSearch(customerContext.id || customerContext.name);
              setActiveTab("siteVisits");
            }}
            disabled={loading}
          >
            <Text style={styles.smallButtonText}>Site visits</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  function renderRecordCards(records: Array<Record<string, unknown>>, titleKeys: string[], detailKeys: string[][], config?: ModuleConfig) {
    if (!records.length) {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>No records found</Text>
          <Text style={styles.muted}>Use the form on this page to add the first record, or refresh after another department updates this module.</Text>
        </View>
      );
    }
    return records.slice(0, 30).map((record, index) => {
      return (
        <View key={String(record.id || record.name || index)} style={styles.card}>
          <Text style={styles.cardTitle}>{fieldText(record, titleKeys)}</Text>
          {detailKeys.map((keys) => (
            <Text key={keys.join("-")} style={styles.bodyText}>{fieldText(record, keys)}</Text>
          ))}
          {renderLinkedSystems(record)}
          {!!config && !!recordIdentity(record) && (
            <View style={styles.inlineActions}>
              <Pressable style={styles.smallButton} onPress={() => updateModuleRecord(record, "In Progress")} disabled={loading}>
                <Text style={styles.smallButtonText}>Start</Text>
              </Pressable>
              <Pressable style={styles.smallButton} onPress={() => updateModuleRecord(record, "Closed")} disabled={loading}>
                <Text style={styles.smallButtonText}>Close</Text>
              </Pressable>
            </View>
          )}
        </View>
      );
    });
  }

  function renderFeaturePage(
    title: string,
    subtitle: string,
    records: Array<Record<string, unknown>>,
    titleKeys: string[],
    detailKeys: string[][],
  ) {
    const config = moduleConfigs[activeTab];
    return (
      <View>
        <View style={styles.moduleHero}>
          <Text style={styles.eyebrow}>FUZI Ops Module</Text>
          <Text style={styles.moduleHeroTitle}>{title}</Text>
          <Text style={styles.moduleHeroText}>{subtitle}</Text>
        </View>
        {config && renderModuleForm(config)}
        {renderRecordCards(records, titleKeys, detailKeys, config)}
      </View>
    );
  }

  function renderOverviewAnalytics() {
    const records = {
      inquiries: asRecords(data?.sales_inquiries),
      estimates: asRecords(data?.estimates),
      payments: asRecords(data?.payments),
      breakdowns: asRecords(data?.breakdowns),
      service: asRecords(data?.service_records),
      tickets: asRecords(data?.project_tickets),
      workOrders: asRecords(data?.work_orders),
      renewals: asRecords(data?.renewals),
      siteVisits: asRecords(data?.site_visits),
      inventory: asRecords(data?.inventory),
    };
    const today = new Date().toISOString().slice(0, 10);
    const isClosed = (status: unknown) => ["closed", "resolved", "done", "completed", "cancelled"].includes(String(status || "").trim().toLowerCase());
    const isLost = (status: unknown) => String(status || "").toLowerCase().includes("lost");
    const moneyValue = (record: Record<string, unknown>, keys: string[]) => keys.reduce((value, key) => {
      if (value) return value;
      const parsed = Number(String(record[key] || "0").replace(/[^0-9.-]/g, ""));
      return Number.isFinite(parsed) ? parsed : 0;
    }, 0);
    const totalEstimateValue = records.estimates.reduce((sum, item) => sum + moneyValue(item, ["total_cost", "amount", "value"]), 0);
    const collectedValue = records.payments
      .filter((item) => ["paid", "received", "collected", "complete", "completed"].includes(String(item.status || "").toLowerCase()))
      .reduce((sum, item) => sum + moneyValue(item, ["amount", "paid_amount", "value"]), 0);
    const duePayments = records.payments.filter((item) => {
      const status = String(item.status || "").toLowerCase();
      const dueDate = String(item.due_date || item.next_due_date || "").slice(0, 10);
      return !["paid", "received", "collected", "complete", "completed"].includes(status) && (!dueDate || dueDate <= today);
    });
    const openBreakdowns = records.breakdowns.filter((item) => !isClosed(item.status));
    const trappedBreakdowns = records.breakdowns.filter((item) => ["y", "yes", "true"].includes(String(item.trapped_passenger || item.passenger_trapped || "").toLowerCase()));
    const openService = records.service.filter((item) => !isClosed(item.status || item.state));
    const openTickets = records.tickets.filter((item) => !isClosed(item.status));
    const dueFollowUps = records.inquiries.filter((item) => {
      const date = followupDate(item);
      const status = String(item.followup_status || item.status || item.lead_status || "").toLowerCase();
      return date && date <= today && !status.includes("closed") && !status.includes("lost");
    });
    const availableEngineers = assignableStaff.filter((member) => staffAvailabilityInfo(member).availableNow).length;
    const activeStatuses = inquiryLifecycleStatuses.filter((status) => !status.toLowerCase().includes("lost"));
    const pipelineRows = activeStatuses.map((status) => ({
      status,
      count: records.inquiries.filter((item) => String(item.status || item.lead_status || "Inquiry Pending").toLowerCase() === status.toLowerCase()).length,
    })).filter((item) => item.count > 0 || ["Inquiry Pending", "Site Visit Pending", "Offer Pending", "Order Received", "Work In Progress"].includes(item.status));
    const maxPipelineCount = Math.max(1, ...pipelineRows.map((item) => item.count));
    const attentionItems = [
      { label: "Follow-ups due", value: dueFollowUps.length, detail: "Sales enquiries need action today", tab: "customers" as TabKey },
      { label: "Active breakdowns", value: openBreakdowns.length, detail: `${trappedBreakdowns.length} trapped-passenger flags`, tab: "breakdown" as TabKey },
      { label: "Payment follow-up", value: duePayments.length, detail: "Milestones unpaid or due now", tab: "finance" as TabKey },
      { label: "Stock risk", value: lowStock.length, detail: "Inventory at reorder threshold", tab: "inventory" as TabKey },
      { label: "Open project tickets", value: openTickets.length, detail: "Cross-department work still active", tab: "tickets" as TabKey },
    ].filter((item) => item.value > 0);
    return (
      <View>
        <View style={styles.commandBand}>
          <View style={styles.commandCopy}>
            <Text style={styles.eyebrow}>System analytics</Text>
            <Text style={styles.commandTitle}>Live FUZI performance across CRM, service, projects, stock, and accounts.</Text>
            <Text style={styles.commandText}>Analytics are calculated from the records already loaded in this portal, so the overview reflects your current operating system data.</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Executive Snapshot</Text>
        <View style={styles.metricGrid}>
          {(data?.metrics || []).map((metric) => (
            <View key={metric.label} style={styles.card}>
              <Text style={styles.cardLabel}>{metric.label}</Text>
              <Text style={styles.metricValue}>{metric.value}</Text>
              <Text style={styles.muted}>{metric.delta}</Text>
            </View>
          ))}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Estimate value</Text>
            <Text style={styles.metricValue}>{formatMoney(totalEstimateValue)}</Text>
            <Text style={styles.muted}>{records.estimates.length} costing and offer records.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Collected</Text>
            <Text style={styles.metricValue}>{formatMoney(collectedValue)}</Text>
            <Text style={styles.muted}>{duePayments.length} payment milestones need follow-up.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Available engineers</Text>
            <Text style={styles.metricValue}>{availableEngineers}</Text>
            <Text style={styles.muted}>{assignableStaff.length} breakdown staff in dispatch pool.</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Sales Pipeline</Text>
        <View style={styles.analyticsPanel}>
          {pipelineRows.map((item) => (
            <View key={`overview-pipeline-${item.status}`} style={styles.analyticsRow}>
              <View style={styles.analyticsRowHeader}>
                <Text style={styles.cardTitle}>{item.status}</Text>
                <Text style={styles.statusPill}>{item.count}</Text>
              </View>
              <View style={styles.analyticsBarTrack}>
                <View style={[styles.analyticsBarFill, { width: `${Math.max(6, (item.count / maxPipelineCount) * 100)}%` }]} />
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Workload Analytics</Text>
        <View style={styles.metricGrid}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Open service</Text>
            <Text style={styles.metricValue}>{openService.length}</Text>
            <Text style={styles.muted}>Service records that are not closed.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Breakdowns active</Text>
            <Text style={styles.metricValue}>{openBreakdowns.length}</Text>
            <Text style={styles.muted}>{trappedBreakdowns.length} trapped-passenger priority flags.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Site visits</Text>
            <Text style={styles.metricValue}>{records.siteVisits.length}</Text>
            <Text style={styles.muted}>Customer-linked site reports captured.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Work orders</Text>
            <Text style={styles.metricValue}>{records.workOrders.filter((item) => !isClosed(item.status)).length}</Text>
            <Text style={styles.muted}>Open work-order execution records.</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Attention Needed</Text>
        {attentionItems.length ? attentionItems.map((item) => (
          <Pressable key={`attention-${item.label}`} style={styles.alertCard} onPress={() => setActiveTab(item.tab)}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardTitleBlock}>
                <Text style={styles.cardLabel}>{item.label}</Text>
                <Text style={styles.cardTitle}>{item.detail}</Text>
              </View>
              <Text style={styles.metricValue}>{item.value}</Text>
            </View>
          </Pressable>
        )) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No urgent exceptions</Text>
            <Text style={styles.muted}>Follow-ups, stock, payments, tickets, and breakdowns are clear for now.</Text>
          </View>
        )}

        <Pressable style={styles.portalShortcut} onPress={() => setActiveTab("breakdown")}>
          <Text style={styles.cardLabel}>Emergency access</Text>
          <Text style={styles.cardTitle}>Open Breakdown Portal</Text>
          <Text style={styles.muted}>Log a call, mark trapped-passenger priority, dispatch an engineer, and close the case.</Text>
        </Pressable>
      </View>
    );
  }

  function renderProjectTicketBoard() {
    const allRecords = asRecords(data?.project_tickets);
    const config = moduleConfigs.tickets;
    const statuses = inquiryLifecycleStatuses.filter((status) => !status.toLowerCase().includes("lost"));
    const normalizeProjectStatus = (status: string) => {
      const cleaned = status.replace("-", "").trim();
      const exactStatus = inquiryLifecycleStatuses.find((item) => item.toLowerCase() === cleaned.toLowerCase());
      if (exactStatus) return exactStatus;
      const normalized = cleaned.toLowerCase();
      if (!normalized || normalized === "open" || normalized === "lead") return "Inquiry Pending";
      if (normalized.includes("lost")) return "Inquiry Lost";
      if (normalized.includes("site") && normalized.includes("done")) return "Site Visit Done";
      if (normalized.includes("site")) return "Site Visit Pending";
      if (normalized.includes("offer") && (normalized.includes("submit") || normalized.includes("quote"))) return "Offer Submitted";
      if (normalized.includes("offer")) return "Offer Pending";
      if (normalized.includes("order") && normalized.includes("received")) return "Order Received";
      if (normalized.includes("order")) return "Order Lost";
      if (normalized.includes("progress") || normalized.includes("start")) return "Work In Progress";
      if (normalized.includes("handover") || normalized.includes("hand over") || normalized.includes("closed") || normalized.includes("done") || normalized.includes("resolved")) return "Hand Over";
      if (normalized.includes("warranty")) return "Warranty Running";
      if (normalized.includes("amc")) return "AMC Running";
      if (normalized.includes("service")) return "One Time Service";
      return "Inquiry Pending";
    };
    const records = allRecords.filter((record) => !normalizeProjectStatus(fieldText(record, ["status"])).toLowerCase().includes("lost"));
    const orderCount = records.filter((record) => normalizeProjectStatus(fieldText(record, ["status"])) === "Order Received").length;
    const activeWorkCount = records.filter((record) => ["Work In Progress", "Hand Over", "Warranty Running", "AMC Running", "One Time Service"].includes(normalizeProjectStatus(fieldText(record, ["status"])))).length;
    return (
      <View>
        <View style={styles.moduleHero}>
          <Text style={styles.eyebrow}>Project Board</Text>
          <Text style={styles.moduleHeroTitle}>Project Tickets Kanban</Text>
          <Text style={styles.moduleHeroText}>Track cross-department work by status, move tickets between columns, and keep linked customer systems visible on each card.</Text>
        </View>
        <View style={styles.metricGrid}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Tickets</Text>
            <Text style={styles.metricValue}>{records.length}</Text>
            <Text style={styles.muted}>Active project-office records shown on this board.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Orders received</Text>
            <Text style={styles.metricValue}>{orderCount}</Text>
            <Text style={styles.muted}>Won work ready for project execution.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Active work</Text>
            <Text style={styles.metricValue}>{activeWorkCount}</Text>
            <Text style={styles.muted}>Installation, handover, warranty, AMC, and service.</Text>
          </View>
        </View>
        {config && renderModuleForm(config)}
        <ScrollView horizontal showsHorizontalScrollIndicator={Platform.OS === "web"} contentContainerStyle={styles.kanbanBoard}>
          {statuses.map((status) => {
            const columnRecords = records.filter((record) => {
              const recordStatus = normalizeProjectStatus(fieldText(record, ["status"]));
              return recordStatus === status;
            });
            return (
              <View key={`project-column-${status}`} style={styles.kanbanColumn}>
                <View style={styles.kanbanColumnHeader}>
                  <Text style={styles.cardTitle}>{status}</Text>
                  <Text style={styles.statusPill}>{columnRecords.length}</Text>
                </View>
                {!columnRecords.length && (
                  <View style={styles.kanbanEmpty}>
                    <Text style={styles.muted}>No tickets in this status.</Text>
                  </View>
                )}
                {columnRecords.map((record, index) => {
                  const id = recordIdentity(record) || String(record.title || index);
                  const currentIndex = statuses.indexOf(status);
                  const forwardStatuses = statuses.slice(currentIndex + 1, currentIndex + 5);
                  const quickStatuses = forwardStatuses.length ? forwardStatuses : statuses.filter((nextStatus) => nextStatus !== status).slice(0, 4);
                  return (
                    <View key={`ticket-${status}-${id}-${index}`} style={styles.kanbanCard}>
                      <View style={styles.cardHeaderRow}>
                        <Text style={styles.cardTitle}>{fieldText(record, ["title", "id"])}</Text>
                        <Text style={styles.statusPill}>{fieldText(record, ["owner", "assigned_to"])}</Text>
                      </View>
                      <Text style={styles.muted}>{fieldText(record, ["project", "customer", "site"])}</Text>
                      <Text style={styles.bodyText}>{fieldText(record, ["notes", "summary", "description"])}</Text>
                      {renderLinkedSystems(record)}
                      <View style={styles.inlineActions}>
                        {quickStatuses.map((nextStatus) => (
                          <Pressable key={`${id}-${nextStatus}`} style={styles.smallButton} onPress={() => updateModuleRecord(record, nextStatus)} disabled={loading || !recordIdentity(record)}>
                            <Text style={styles.smallButtonText}>{nextStatus}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  function openCrmForCustomerNumber(customerId: string) {
    const nextSearch = String(customerId || "").trim();
    if (!nextSearch) return;
    setCrmSearch(nextSearch);
    setCustomerPage(1);
    setEnquiryPage(1);
    setActiveTab("customers");
    setMessage(`Showing CRM records linked to customer ${nextSearch}.`);
  }

  function crmCustomerOptions() {
    const saved = (data?.customers || []).map((customer) => ({
      id: String(customer.id || ""),
      name: String(customer.name || customer.contact_person || customer.id || ""),
      phone: String(customer.phone || ""),
      address: String(customer.address || ""),
      source_inquiry_id: "",
    }));
    const inquiries = asRecords(data?.sales_inquiries).map((item) => ({
      id: String(item.customer_id || item.id || ""),
      name: String(item.customer || item.lead_name || item.name || item.customer_id || item.id || ""),
      phone: String(item.phone || item.whatsapp_no || ""),
      address: String(item.address || item.site_address || item.site || ""),
      source_inquiry_id: String(item.id || item.enquiry_no || ""),
    }));
    const seen = new Set<string>();
    return [...saved, ...inquiries].filter((item) => {
      if (!item.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }

  function crmCustomerForSiteVisit(visit: Record<string, unknown>) {
    const customerId = String(visit.customer_id || "").trim();
    const enquiryNo = String(visit.site_enquiry_no || "").trim();
    return crmCustomerOptions().find((customer) =>
      String(customer.id || "") === customerId ||
      Boolean(enquiryNo && String(customer.source_inquiry_id || "") === enquiryNo)
    );
  }

  function normalizedPhoneKey(value: unknown) {
    const digits = String(value || "").replace(/\D/g, "");
    if (digits.length > 10 && digits.endsWith(digits.slice(-10))) return digits.slice(-10);
    return digits;
  }

  function findCustomerPhoneDuplicate(phone: unknown) {
    const phoneKey = normalizedPhoneKey(phone);
    if (!phoneKey) return null;
    const customer = (data?.customers || []).find((item) => normalizedPhoneKey(item.phone) === phoneKey);
    if (customer) return { type: "customer" as const, record: customer };
    const inquiry = asRecords(data?.sales_inquiries).find((item) =>
      [item.phone, item.whatsapp_no, item.mobile, item.mobile_no, item.caller_mobile].some((value) => normalizedPhoneKey(value) === phoneKey)
    );
    return inquiry ? { type: "inquiry" as const, record: inquiry } : null;
  }

  function startServiceEdit(record: Record<string, unknown>) {
    const id = recordIdentity(record);
    if (!id) return;
    setServiceEditDrafts((drafts) => ({
      ...drafts,
      [id]: {
        customer_id: String(record.customer_id || ""),
        source_inquiry_id: String(record.source_inquiry_id || ""),
        customer: String(record.customer || ""),
        site: String(record.site || ""),
        city: String(record.city || ""),
        phone: String(record.phone || ""),
        status: String(record.status || ""),
        technician: String(record.technician || ""),
        scheduled_date: String(record.scheduled_date || ""),
        completed_date: String(record.completed_date || ""),
        next_service_date: String(record.next_service_date || ""),
        findings: String(record.findings || ""),
      },
    }));
  }

  async function saveServiceRecord(id: string) {
    const draft = serviceEditDrafts[id];
    if (!draft) return;
    if (!String(draft.customer_id || "").trim()) {
      setMessage("Customer number is required before saving a service record.");
      return;
    }
    setLoading(true);
    try {
      await apiFetch(`/api/portal/service/${encodeURIComponent(id)}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(draft),
      });
      setServiceEditDrafts((drafts) => {
        const next = { ...drafts };
        delete next[id];
        return next;
      });
      await loadPortal();
      setMessage(`Service record ${id} updated and linked to customer ${draft.customer_id}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Service record could not be saved.");
    } finally {
      setLoading(false);
    }
  }

  function renderServicePage() {
    const records = asRecords((data as Record<string, unknown> | null)?.service_records);
    const query = serviceRecordSearch.trim().toLowerCase();
    const filteredRecords = records.filter((record) => {
      if (!query) return true;
      return [
        record.id,
        record.job_number,
        record.job_no,
        record.customer_id,
        record.source_inquiry_id,
        record.customer,
        record.site,
        record.city,
        record.area,
        record.phone,
        record.technician,
        record.status,
        record.next_service_date,
        record.scheduled_date,
      ].some((value) => String(value || "").toLowerCase().includes(query));
    });
    const visibleRecords = filteredRecords.slice(0, 80);
    return (
      <View>
        <View style={styles.moduleHero}>
          <Text style={styles.eyebrow}>FUZI Ops Module</Text>
          <Text style={styles.moduleHeroTitle}>Service</Text>
          <Text style={styles.moduleHeroText}>Service records, technician updates, customer comments, and linked CRM customer numbers.</Text>
        </View>
        {renderModuleForm(moduleConfigs.service!)}
        <View style={styles.formCard}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.cardLabel}>Search service records</Text>
              <Text style={styles.muted}>{filteredRecords.length} matching records. Customer name and customer number are searchable.</Text>
            </View>
            {!!serviceRecordSearch && (
              <Pressable style={styles.smallButton} onPress={() => setServiceRecordSearch("")} disabled={loading}>
                <Text style={styles.smallButtonText}>Clear</Text>
              </Pressable>
            )}
          </View>
          <TextInput
            style={styles.input}
            value={serviceRecordSearch}
            onChangeText={setServiceRecordSearch}
            placeholder="Search customer name, customer number, CRM ID, job no, phone, site, technician, status"
          />
        </View>
        {!visibleRecords.length && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No service records found</Text>
            <Text style={styles.muted}>{records.length ? "No service records match that search." : "Import or add service records, then link each one to a CRM customer number."}</Text>
          </View>
        )}
        {visibleRecords.map((record, index) => {
          const id = recordIdentity(record) || String(record.id || `SVC-${index + 1}`);
          const draft = serviceEditDrafts[id];
          const customerId = String((draft || record).customer_id || "");
          const historyCount = Array.isArray(record.service_history) ? record.service_history.length : 0;
          return (
            <View key={id} style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardTitleBlock}>
                  <Text style={styles.cardTitle}>{String((draft || record).customer || record.customer || "-")}</Text>
                  <Text style={styles.muted}>Service job: {String(record.job_number || record.job_no || record.id || id)}</Text>
                  <View style={styles.inlineMeta}>
                    <Text style={styles.muted}>Customer no.</Text>
                    {customerId ? (
                      <Pressable onPress={() => openCrmForCustomerNumber(customerId)} disabled={loading}>
                        <Text style={styles.clickableUsername}>{customerId}</Text>
                      </Pressable>
                    ) : (
                      <Text style={styles.muted}>Missing</Text>
                    )}
                    {!!record.source_inquiry_id && <Text style={styles.muted}>- CRM {String(record.source_inquiry_id)}</Text>}
                  </View>
                </View>
                <Text style={styles.statusPill}>{String((draft || record).status || "Open")}</Text>
              </View>
              {draft ? (
                <View style={styles.inlineRecordEditor}>
                  <View style={styles.formGrid}>
                    {[
                      ["customer_id", "Customer number"],
                      ["source_inquiry_id", "CRM inquiry ID"],
                      ["customer", "Customer / building"],
                      ["site", "Site"],
                      ["city", "City"],
                      ["phone", "Phone"],
                      ["status", "Status"],
                      ["technician", "Technician"],
                      ["scheduled_date", "Scheduled date"],
                      ["completed_date", "Completed date"],
                      ["next_service_date", "Next service date"],
                    ].map(([key, label]) => (
                      <View key={`${id}-${key}`} style={styles.field}>
                        <Text style={styles.label}>{label}</Text>
                        <TextInput
                          style={styles.input}
                          value={String(draft[key] || "")}
                          onChangeText={(value) => setServiceEditDrafts((drafts) => ({ ...drafts, [id]: { ...drafts[id], [key]: value } }))}
                        />
                      </View>
                    ))}
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>Findings / notes</Text>
                    <TextInput
                      style={[styles.input, styles.textarea]}
                      value={String(draft.findings || "")}
                      onChangeText={(value) => setServiceEditDrafts((drafts) => ({ ...drafts, [id]: { ...drafts[id], findings: value } }))}
                      multiline
                    />
                  </View>
                  <View style={styles.inlineActions}>
                    <Pressable style={styles.primaryButtonInline} onPress={() => saveServiceRecord(id)} disabled={loading || !customerId}>
                      <Text style={styles.primaryButtonText}>Save service record</Text>
                    </Pressable>
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={() => setServiceEditDrafts((drafts) => {
                        const next = { ...drafts };
                        delete next[id];
                        return next;
                      })}
                      disabled={loading}
                    >
                      <Text style={styles.secondaryButtonText}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <>
                  <Text style={styles.bodyText}>{String(record.customer || "-")} - {String(record.site || record.city || "-")}</Text>
                  <Text style={styles.bodyText}>Technician: {String(record.technician || "-")} - Next service: {String(record.next_service_date || record.scheduled_date || "-")}</Text>
                  <Text style={styles.bodyText}>Completed: {String(record.completed_date || "-")} - History entries: {historyCount}</Text>
                  <Text style={styles.muted}>{String(record.findings || "")}</Text>
                  <View style={styles.inlineActions}>
                    <Pressable style={styles.smallButton} onPress={() => startServiceEdit(record)} disabled={loading}>
                      <Text style={styles.smallButtonText}>Edit</Text>
                    </Pressable>
                    {customerId ? (
                      <Pressable style={styles.smallButton} onPress={() => openCrmForCustomerNumber(customerId)} disabled={loading}>
                        <Text style={styles.smallButtonText}>Open CRM customer</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </>
              )}
            </View>
          );
        })}
      </View>
    );
  }

  function renderModuleForm(config: ModuleConfig) {
    const needsCustomer = config.route === "/api/portal/install-jobs" || config.route === "/api/portal/service";
    const customerOptions = config.route === "/api/portal/service" ? crmCustomerOptions() : (data?.customers || []).map((customer) => ({ id: customer.id, name: customer.name, phone: customer.phone || "", source_inquiry_id: "" }));
    const selectedServiceCustomer = customerOptions.find((customer) => customer.id === moduleDraft.customer_id);
    const serviceCustomerQuery = serviceCustomerSearch.trim().toLowerCase();
    const visibleServiceCustomers = config.route === "/api/portal/service"
      ? customerOptions
        .filter((customer) => !serviceCustomerQuery || `${customer.id} ${customer.name} ${customer.phone} ${customer.source_inquiry_id}`.toLowerCase().includes(serviceCustomerQuery))
        .slice(0, 80)
      : customerOptions;
    return (
      <View style={styles.formCard}>
        <Text style={styles.cardLabel}>Add / update module data</Text>
        {needsCustomer && (
          <View style={styles.field}>
            <Text style={styles.label}>{config.route === "/api/portal/service" ? "Select CRM customer (required)" : "Select customer"}</Text>
            {config.route === "/api/portal/service" && <Text style={styles.muted}>A service record cannot be saved until it is linked to a CRM customer number.</Text>}
            {!customerOptions.length && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Add a customer first</Text>
                <Text style={styles.muted}>{config.route === "/api/portal/service" ? "Service records must be linked to a CRM customer number before they can be created." : "Installation jobs must be linked to a saved customer ID before they can be created."}</Text>
                <View style={styles.inlineActions}>
                  <Pressable style={styles.smallButton} onPress={() => setActiveTab("customers")}>
                    <Text style={styles.smallButtonText}>Open Customer CRM</Text>
                  </Pressable>
                </View>
              </View>
            )}
            {!!customerOptions.length && (
              config.route === "/api/portal/service" ? (
                <View style={styles.field}>
                  <Pressable
                    style={[styles.dropdownButton, serviceCustomerDropdownOpen && styles.selectorPillActive]}
                    onPress={() => setServiceCustomerDropdownOpen((open) => !open)}
                    disabled={loading}
                  >
                    <Text style={styles.selectorText}>
                      {selectedServiceCustomer
                        ? `${selectedServiceCustomer.id} - ${selectedServiceCustomer.name}${selectedServiceCustomer.phone ? ` - ${selectedServiceCustomer.phone}` : ""}`
                        : "Select CRM customer"}
                    </Text>
                    <Text style={styles.dropdownChevron}>{serviceCustomerDropdownOpen ? "▲" : "▼"}</Text>
                  </Pressable>
                  {serviceCustomerDropdownOpen && (
                    <View style={styles.dropdownPanel}>
                      <TextInput
                        style={styles.input}
                        value={serviceCustomerSearch}
                        onChangeText={setServiceCustomerSearch}
                        placeholder="Search customer number, name, phone, CRM ID"
                      />
                      <Text style={styles.muted}>Showing {visibleServiceCustomers.length} matching customers.</Text>
                      <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                        {visibleServiceCustomers.map((customer, index) => (
                          <Pressable
                            key={`service-customer-${customer.id}-${customer.source_inquiry_id}-${index}`}
                            style={[styles.dropdownOption, moduleDraft.customer_id === customer.id && styles.selectorPillActive]}
                            onPress={() => {
                              setModuleDraft((draft) => ({
                                ...draft,
                                customer_id: customer.id,
                                customer: customer.name,
                                notes: customer.source_inquiry_id ? `CRM ${customer.source_inquiry_id}` : draft.notes,
                              }));
                              setServiceCustomerDropdownOpen(false);
                              setServiceCustomerSearch("");
                            }}
                          >
                            <Text style={styles.selectorText}>{customer.id} - {customer.name}</Text>
                            <Text style={styles.muted}>{customer.phone || "No phone"}{customer.source_inquiry_id ? ` - ${customer.source_inquiry_id}` : ""}</Text>
                          </Pressable>
                        ))}
                        {!visibleServiceCustomers.length && <Text style={styles.muted}>No CRM customers match that search.</Text>}
                      </ScrollView>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.selectorList}>
                  {customerOptions.slice(0, 80).map((customer) => (
                    <Pressable
                      key={customer.id}
                      style={[styles.selectorPill, moduleDraft.customer_id === customer.id && styles.selectorPillActive]}
                      onPress={() => setModuleDraft((draft) => ({ ...draft, customer_id: customer.id, customer: customer.name, notes: draft.notes }))}
                    >
                      <Text style={[styles.selectorText, moduleDraft.customer_id === customer.id && styles.selectorTextActive]}>
                        {customer.id} - {customer.name}{customer.phone ? ` - ${customer.phone}` : ""}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )
            )}
          </View>
        )}
        <View style={styles.formGrid}>
          <View style={styles.field}>
            <Text style={styles.label}>{config.titleLabel}</Text>
            <TextInput
              style={styles.input}
              value={moduleDraft.title}
              onChangeText={(value) => setModuleDraft((draft) => ({ ...draft, title: value }))}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>{config.route === "/api/portal/service" ? "Linked customer / owner" : config.customerKey === "department" ? "Department" : "Customer / owner"}</Text>
            <TextInput
              style={styles.input}
              value={moduleDraft.customer}
              onChangeText={(value) => setModuleDraft((draft) => ({ ...draft, customer: value }))}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Status</Text>
            <TextInput
              style={styles.input}
              value={moduleDraft.status}
              onChangeText={(value) => setModuleDraft((draft) => ({ ...draft, status: value }))}
            />
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Notes / details</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={moduleDraft.notes}
            onChangeText={(value) => setModuleDraft((draft) => ({ ...draft, notes: value }))}
            multiline
          />
        </View>
        <Pressable style={styles.primaryButton} onPress={() => saveModuleRecord(config)} disabled={loading || (needsCustomer && !moduleDraft.customer_id)}>
          <Text style={styles.primaryButtonText}>Save module record</Text>
        </Pressable>
      </View>
    );
  }

  function renderEstimatorPage() {
    const estimates = data?.estimates || [];
    const payments = asRecords(data?.payments);
    const selectedEstimate = estimates.find((estimate) => estimate.id === paymentDraft.estimate_id) || estimates[0];
    const selectedPayments = payments.filter((payment) => String(payment.estimate_id || "") === String(paymentDraft.estimate_id || selectedEstimate?.id || ""));
    const paid = selectedPayments.filter((payment) => String(payment.status || "").toLowerCase() === "paid").reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const total = selectedPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    return (
      <View>
        <View style={styles.moduleHero}>
          <Text style={styles.eyebrow}>Costing Estimator</Text>
          <Text style={styles.moduleHeroTitle}>Saved Estimates & Payment Ledger</Text>
          <Text style={styles.moduleHeroText}>Review customer-linked costing data, open reports, send estimates, and manage payment milestones from the CRM.</Text>
        </View>

        <Text style={styles.sectionTitle}>Saved Estimates</Text>
        {estimates.map((estimate) => (
          <View key={estimate.id} style={styles.card}>
            <Text style={styles.cardTitle}>{estimate.id} - {estimate.customer_name}</Text>
            <Text style={styles.muted}>{estimate.site || "Site pending"} - {estimate.elevator_type || "Elevator"} - {estimate.status || "Draft"}</Text>
            <Text style={styles.metricValue}>{formatMoney(estimate.total_cost)}</Text>
            <View style={styles.inlineActions}>
              <Pressable style={styles.smallButton} onPress={() => setPaymentDraft((draft) => ({ ...draft, estimate_id: estimate.id, amount: String(estimate.total_cost || "") }))}>
                <Text style={styles.smallButtonText}>Select ledger</Text>
              </Pressable>
              <Pressable style={styles.smallButton} onPress={() => openEstimateArtifact(estimate.id, "report")} disabled={loading}>
                <Text style={styles.smallButtonText}>View report</Text>
              </Pressable>
              <Pressable style={styles.smallButton} onPress={() => estimateAction(estimate.id, "send")} disabled={loading}>
                <Text style={styles.smallButtonText}>Send</Text>
              </Pressable>
              <Pressable style={styles.smallButton} onPress={() => estimateAction(estimate.id, "approve-offer")} disabled={loading}>
                <Text style={styles.smallButtonText}>Approve costing</Text>
              </Pressable>
              <Pressable style={styles.smallButton} onPress={() => deleteEstimate(estimate.id)} disabled={loading}>
                <Text style={styles.smallButtonText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Payment Ledger</Text>
        <View style={styles.metricGrid}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Ledger total</Text>
            <Text style={styles.metricValue}>{formatMoney(total)}</Text>
            <Text style={styles.muted}>{selectedEstimate?.id || "No estimate selected"}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Outstanding</Text>
            <Text style={styles.metricValue}>{formatMoney(total - paid)}</Text>
            <Text style={styles.muted}>Paid {formatMoney(paid)}</Text>
          </View>
        </View>
        <View style={styles.formCard}>
          <Text style={styles.cardLabel}>Add payment milestone</Text>
          <View style={styles.selectorList}>
            {estimates.slice(0, 10).map((estimate) => (
              <Pressable
                key={estimate.id}
                style={[styles.selectorPill, paymentDraft.estimate_id === estimate.id && styles.selectorPillActive]}
                onPress={() => setPaymentDraft((draft) => ({ ...draft, estimate_id: estimate.id, amount: String(estimate.total_cost || "") }))}
              >
                <Text style={[styles.selectorText, paymentDraft.estimate_id === estimate.id && styles.selectorTextActive]}>
                  {estimate.id} - {estimate.customer_name}
                </Text>
              </Pressable>
            ))}
          </View>
          {[
            ["milestone", "Milestone"],
            ["amount", "Amount"],
            ["due_date", "Due date YYYY-MM-DD"],
            ["method", "Method"],
            ["reference", "Reference"],
            ["notes", "Notes"],
          ].map(([key, label]) => (
            <View key={key} style={styles.field}>
              <Text style={styles.label}>{label}</Text>
              <TextInput
                style={styles.input}
                value={String(paymentDraft[key as keyof typeof paymentDraft] || "")}
                onChangeText={(value) => setPaymentDraft((draft) => ({ ...draft, [key]: value }))}
              />
            </View>
          ))}
          <View style={styles.inlineActions}>
            <Pressable style={styles.primaryButton} onPress={savePayment} disabled={loading || !paymentDraft.estimate_id}>
              <Text style={styles.primaryButtonText}>Add payment</Text>
            </Pressable>
            <Pressable style={styles.smallButton} onPress={autoSchedulePayments} disabled={loading || !paymentDraft.estimate_id}>
              <Text style={styles.smallButtonText}>Auto-schedule</Text>
            </Pressable>
          </View>
        </View>
        {selectedPayments.map((payment) => (
          <View key={String(payment.id)} style={styles.card}>
            <Text style={styles.cardTitle}>{fieldText(payment, ["milestone", "description", "id"])}</Text>
            <Text style={styles.muted}>{fieldText(payment, ["estimate_id"])} - {fieldText(payment, ["due_date"])} - {fieldText(payment, ["status"])}</Text>
            <Text style={styles.metricValue}>{formatMoney(Number(payment.amount || 0))}</Text>
            <View style={styles.inlineActions}>
              <Pressable style={styles.smallButton} onPress={() => updatePayment(String(payment.id), "Paid")} disabled={loading}>
                <Text style={styles.smallButtonText}>Paid</Text>
              </Pressable>
              <Pressable style={styles.smallButton} onPress={() => updatePayment(String(payment.id), "Overdue")} disabled={loading}>
                <Text style={styles.smallButtonText}>Overdue</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    );
  }

  function renderBreakdownPage() {
    const breakdowns = asRecords((data as Record<string, unknown> | null)?.breakdowns);
    const crmInquiryCustomers = asRecords((data as Record<string, unknown> | null)?.sales_inquiries).map((item) => ({
      id: String(item.customer_id || item.id || item.enquiry_no || ""),
      name: String(item.customer || item.lead_name || item.name || ""),
      phone: String(item.phone || item.whatsapp_no || ""),
      address: String(item.address || item.site || ""),
      enquiryNo: String(item.enquiry_no || item.source_enquiry_no || ""),
    })).filter((item) => item.id && item.name);
    const savedCustomerOptions = (data?.customers || []).map((customer) => ({
      id: String(customer.id || ""),
      name: String(customer.name || ""),
      phone: String(customer.phone || ""),
      address: String(customer.address || ""),
      enquiryNo: "",
    })).filter((item) => item.id && item.name);
    const breakdownCustomerOptions = [...savedCustomerOptions, ...crmInquiryCustomers];
    const selectedBreakdownCustomer = breakdownCustomerOptions.find((customer) => customer.id === breakdownDraft.customer_id);
    const breakdownCustomerQuery = breakdownCustomerSearch.trim().toLowerCase();
    const visibleBreakdownCustomers = breakdownCustomerOptions
      .filter((customer) => !breakdownCustomerQuery || `${customer.id} ${customer.name} ${customer.phone} ${customer.address} ${customer.enquiryNo}`.toLowerCase().includes(breakdownCustomerQuery));
    const activeBreakdowns = breakdowns.filter((item) => !["closed", "resolved", "done"].includes(String(item.status || "").toLowerCase()));
    const trappedCalls = breakdowns.filter((item) => ["y", "yes", "true"].includes(String(item.trapped_passenger || item.passenger_trapped || "").toLowerCase()));
    const availableEngineers = assignableStaff.filter((member) => staffAvailabilityInfo(member).availableNow);
    const breakdownSupervisor = asRecords(data?.org_chart).find((person) =>
      String(person.department || "").trim().toLowerCase() === "breakdown" &&
      String(person.title || "").toLowerCase().includes("supervisor")
    );
    return (
      <View>
        <View style={styles.moduleHero}>
          <Text style={styles.eyebrow}>Breakdown Portal</Text>
          <Text style={styles.moduleHeroTitle}>Emergency Breakdown Control</Text>
          <Text style={styles.moduleHeroText}>Log trapped-passenger calls, assign an engineer, track dispatch, and close breakdowns from the mobile/web portal.</Text>
          <View style={styles.inlineActions}>
            <Pressable style={styles.smallButton} onPress={syncDiscordBreakdowns} disabled={loading}>
              <Text style={styles.smallButtonText}>Sync Discord</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.metricGrid}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Active breakdowns</Text>
            <Text style={styles.metricValue}>{activeBreakdowns.length}</Text>
            <Text style={styles.muted}>Open calls requiring dispatch or follow-up.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Trapped passenger</Text>
            <Text style={styles.metricValue}>{trappedCalls.length}</Text>
            <Text style={styles.muted}>Highest-priority rescue cases.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Breakdown staff</Text>
            <Text style={styles.metricValue}>{assignableStaff.length}</Text>
            <Text style={styles.muted}>{availableEngineers.length} available now under {fieldText(breakdownSupervisor || {}, ["name"]) || "Breakdown Supervisor"}.</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.cardLabel}>Schedule Engineer</Text>
          <Text style={styles.muted}>
            Breakdown dispatch availability is limited to the {assignableStaff.length} Breakdown staff managed by {fieldText(breakdownSupervisor || {}, ["name"]) || "the Breakdown Supervisor"}.
            Select one while logging a new call, or use the schedule controls on an existing breakdown.
          </Text>
          <View style={styles.selectorList}>
            {assignableStaff.map((member) => {
              const availability = staffAvailabilityInfo(member);
              const taskDraft = breakdownEngineerTaskDrafts[member.name] ?? String(member.current_job || "");
              return (
                <View key={`breakdown-availability-${member.id}`} style={styles.selectorPill}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.selectorText}>{member.name} - {member.role}</Text>
                    <Text style={styles.statusPill}>{availability.availableNow ? "Available" : "Busy"}</Text>
                  </View>
                  <Text style={styles.muted}>{availability.summary}</Text>
                  {!!member.phone && <Text style={styles.bodyText}>Phone: {member.phone}</Text>}
                  <View style={styles.field}>
                    <Text style={styles.label}>Current task</Text>
                    <TextInput
                      style={styles.input}
                      value={taskDraft}
                      onChangeText={(value) => setBreakdownEngineerTaskDrafts((draft) => ({ ...draft, [member.name]: value }))}
                      placeholder="Current breakdown/task"
                    />
                  </View>
                  <View style={styles.inlineActions}>
                    <Pressable style={styles.smallButton} onPress={() => updateBreakdownEngineerTask(member, taskDraft, member.name)} disabled={loading}>
                      <Text style={styles.smallButtonText}>Save task</Text>
                    </Pressable>
                    <Pressable style={styles.smallButton} onPress={() => updateBreakdownEngineerTask(member, "", member.name)} disabled={loading}>
                      <Text style={styles.smallButtonText}>Clear task</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
            {!assignableStaff.length && <Text style={styles.muted}>No engineer roster found. Add engineers in Install Team to schedule breakdown dispatch.</Text>}
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.cardLabel}>New breakdown call</Text>
          {!breakdownCustomerOptions.length && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Add a customer first</Text>
              <Text style={styles.muted}>Breakdown calls must be linked to a saved customer ID before dispatch can begin.</Text>
              <View style={styles.inlineActions}>
                <Pressable style={styles.smallButton} onPress={() => setActiveTab("customers")}>
                  <Text style={styles.smallButtonText}>Open Customer CRM</Text>
                </Pressable>
              </View>
            </View>
          )}
          {!!breakdownCustomerOptions.length && (
            <View style={styles.field}>
              <Text style={styles.label}>CRM customer</Text>
              <Text style={styles.muted}>{breakdownCustomerOptions.length} CRM customers available for breakdown linking.</Text>
              <Pressable
                style={[styles.dropdownButton, breakdownCustomerDropdownOpen && styles.selectorPillActive]}
                onPress={() => setBreakdownCustomerDropdownOpen((open) => !open)}
                disabled={loading}
              >
                <Text style={styles.selectorText}>
                  {selectedBreakdownCustomer
                    ? `${selectedBreakdownCustomer.id} - ${selectedBreakdownCustomer.name}${selectedBreakdownCustomer.phone ? ` - ${selectedBreakdownCustomer.phone}` : ""}`
                    : "Select CRM customer"}
                </Text>
                <Text style={styles.dropdownChevron}>{breakdownCustomerDropdownOpen ? "▲" : "▼"}</Text>
              </Pressable>
              {breakdownCustomerDropdownOpen && (
                <View style={styles.dropdownPanel}>
                  <TextInput
                    style={styles.input}
                    value={breakdownCustomerSearch}
                    onChangeText={setBreakdownCustomerSearch}
                    placeholder="Search customer, phone, enquiry no"
                  />
                  <Text style={styles.muted}>Showing {visibleBreakdownCustomers.length} matching customers.</Text>
                  <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                    {visibleBreakdownCustomers.map((customer, index) => (
                      <Pressable
                        key={`breakdown-customer-${customer.id}-${customer.enquiryNo}-${index}`}
                        style={[styles.dropdownOption, breakdownDraft.customer_id === customer.id && styles.selectorPillActive]}
                        onPress={() => {
                          setBreakdownDraft((draft) => ({
                            ...draft,
                            customer_id: customer.id,
                            customer: customer.name,
                            phone: draft.phone || customer.phone,
                            location: customer.address,
                          }));
                          setBreakdownCustomerDropdownOpen(false);
                        }}
                      >
                        <Text style={styles.selectorText}>{customer.id} - {customer.name}</Text>
                        <Text style={styles.muted}>{customer.phone || "No phone"}{customer.address ? ` - ${customer.address}` : ""}{customer.enquiryNo ? ` - ${customer.enquiryNo}` : ""}</Text>
                      </Pressable>
                    ))}
                    {!visibleBreakdownCustomers.length && <Text style={styles.muted}>No CRM customers match that search.</Text>}
                  </ScrollView>
                </View>
              )}
            </View>
          )}
          {[
            ["unit", "Lift / unit"],
            ["phone", "Caller mobile"],
            ["location", "Location"],
            ["priority", "Priority"],
            ["trapped_passenger", "Trapped passenger Y/N"],
            ["scheduled_at", "Schedule engineer YYYY-MM-DD HH:mm"],
          ].map(([key, label]) => (
            <View key={key} style={styles.field}>
              <Text style={styles.label}>{label}</Text>
              <TextInput
                style={styles.input}
                value={String(breakdownDraft[key as keyof typeof breakdownDraft] || "")}
                onChangeText={(value) => setBreakdownDraft((draft) => ({ ...draft, [key]: value }))}
                editable={key !== "location"}
                placeholder={key === "location" ? "Taken from selected CRM customer" : undefined}
              />
            </View>
          ))}
          <View style={styles.field}>
            <Text style={styles.label}>Schedule engineer</Text>
            <View style={styles.selectorList}>
              {assignableStaff.map((member) => (
                <Pressable
                  key={member.id}
                  style={[styles.selectorPill, breakdownDraft.engineer === member.name && styles.selectorPillActive]}
                  onPress={() => setBreakdownDraft((draft) => ({ ...draft, engineer: member.name, scheduled_at: draft.scheduled_at || defaultBreakdownScheduleTime() }))}
                >
                  <Text style={[styles.selectorText, breakdownDraft.engineer === member.name && styles.selectorTextActive]}>
                    {member.name} - {member.role}
                  </Text>
                  <Text style={styles.muted}>{staffAvailabilityInfo(member).summary}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Fault / issue</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={breakdownDraft.issue}
              onChangeText={(value) => setBreakdownDraft((draft) => ({ ...draft, issue: value }))}
              multiline
            />
          </View>
          <Pressable style={styles.primaryButton} onPress={saveBreakdown} disabled={loading || !breakdownDraft.customer_id}>
            <Text style={styles.primaryButtonText}>Log breakdown</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Breakdown Calls</Text>
        {!breakdowns.length && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No active breakdown calls</Text>
            <Text style={styles.muted}>Use the form above to log the first breakdown call. Trapped-passenger cases should be marked Y and dispatched immediately.</Text>
          </View>
        )}
        {breakdowns.map((item, index) => {
          const id = recordIdentity(item) || String(item.id || `BRK-${index + 1}`);
          return (
            <View key={id} style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>{fieldText(item, ["unit", "id"])}</Text>
                <Text style={styles.statusPill}>{fieldText(item, ["priority", "status"])}</Text>
              </View>
              <Text style={styles.muted}>{fieldText(item, ["customer"])} - {fieldText(item, ["location", "site"])} - {fieldText(item, ["status"])}</Text>
              <Text style={styles.bodyText}>{fieldText(item, ["issue", "fault", "notes"])}</Text>
              <Text style={styles.bodyText}>Engineer: {fieldText(item, ["engineer", "assigned_to"])} - Caller: {fieldText(item, ["phone", "caller_mobile"])}</Text>
              <Text style={styles.bodyText}>Scheduled: {fieldText(item, ["scheduled_at", "scheduled_time", "dispatch_time"])}</Text>
              <Text style={styles.bodyText}>Trapped passenger: {fieldText(item, ["trapped_passenger", "passenger_trapped"])}</Text>
              <View style={styles.field}>
                <Text style={styles.label}>Schedule time</Text>
                <TextInput
                  style={styles.input}
                  value={breakdownScheduleDrafts[id] ?? String(item.scheduled_at || item.scheduled_time || item.dispatch_time || defaultBreakdownScheduleTime())}
                  onChangeText={(value) => setBreakdownScheduleDrafts((draft) => ({ ...draft, [id]: value }))}
                  placeholder="YYYY-MM-DD HH:mm"
                />
              </View>
              <Text style={styles.label}>Schedule Engineer</Text>
              <View style={styles.inlineActions}>
                {assignableStaff.map((member) => {
                  const availability = staffAvailabilityInfo(member);
                  const scheduleTime = breakdownScheduleDrafts[id] ?? String(item.scheduled_at || item.scheduled_time || item.dispatch_time || defaultBreakdownScheduleTime());
                  const taskDraft = breakdownEngineerTaskDrafts[`${id}-${member.name}`] ?? String(member.current_job || "");
                  return (
                    <View key={`${id}-${member.id}`} style={styles.selectorPill}>
                      <Pressable style={styles.smallButton} onPress={() => scheduleBreakdownEngineer(id, member, scheduleTime)} disabled={loading}>
                        <Text style={styles.smallButtonText}>{member.name}</Text>
                        <Text style={styles.smallButtonHint}>{availability.availableNow ? "Available now" : availability.summary}</Text>
                      </Pressable>
                      <TextInput
                        style={styles.compactInput}
                        value={taskDraft}
                        onChangeText={(value) => setBreakdownEngineerTaskDrafts((draft) => ({ ...draft, [`${id}-${member.name}`]: value }))}
                        placeholder="Change current task"
                      />
                      <Pressable style={styles.smallButton} onPress={() => updateBreakdownEngineerTask(member, taskDraft || id, `${id}-${member.name}`)} disabled={loading}>
                        <Text style={styles.smallButtonText}>Save task</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
              <View style={styles.inlineActions}>
                <Pressable style={styles.smallButton} onPress={() => updateBreakdown(id, "Dispatched")} disabled={loading}>
                  <Text style={styles.smallButtonText}>Dispatch</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => updateBreakdown(id, "Reached Site")} disabled={loading}>
                  <Text style={styles.smallButtonText}>Reached site</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => updateBreakdown(id, "Closed")} disabled={loading}>
                  <Text style={styles.smallButtonText}>Close</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  function renderInstallTeamPage() {
    const team = asRecords(data?.install_team);
    const jobs = asRecords(data?.install_jobs);
    const available = team.filter((member) => ["available", "on site", "standby"].includes(String(member.availability || "").toLowerCase()));
    const assigned = team.filter((member) => String(member.current_job || "").trim());
    return (
      <View>
        <View style={styles.moduleHero}>
          <Text style={styles.eyebrow}>Install Team</Text>
          <Text style={styles.moduleHeroTitle}>Team Dispatch & Assignment</Text>
          <Text style={styles.moduleHeroText}>Create roster entries, assign staff to installation jobs, update availability, and keep technician phone/skill details visible for dispatch.</Text>
        </View>

        <View style={styles.metricGrid}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Available staff</Text>
            <Text style={styles.metricValue}>{available.length}</Text>
            <Text style={styles.muted}>Ready, standby, or on-site team members.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Assigned staff</Text>
            <Text style={styles.metricValue}>{assigned.length}</Text>
            <Text style={styles.muted}>Roster members currently tied to a job.</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.cardLabel}>Add team member</Text>
          {[
            ["name", "Staff name"],
            ["role", "Role"],
            ["phone", "Mobile phone"],
            ["skills", "Skills"],
            ["availability", "Availability"],
            ["shift", "Shift"],
            ["notes", "Notes"],
          ].map(([key, label]) => (
            <View key={key} style={styles.field}>
              <Text style={styles.label}>{label}</Text>
              <TextInput
                style={styles.input}
                value={String(installTeamDraft[key as keyof typeof installTeamDraft] || "")}
                onChangeText={(value) => setInstallTeamDraft((draft) => ({ ...draft, [key]: value }))}
              />
            </View>
          ))}
          <Text style={styles.label}>Assign to job</Text>
          <View style={styles.selectorList}>
            {jobs.slice(0, 10).map((job) => {
              const jobId = fieldText(job, ["job_id", "id"]);
              return (
                <Pressable
                  key={jobId}
                  style={[styles.selectorPill, installTeamDraft.current_job === jobId && styles.selectorPillActive]}
                  onPress={() => setInstallTeamDraft((draft) => ({ ...draft, current_job: jobId }))}
                >
                  <Text style={[styles.selectorText, installTeamDraft.current_job === jobId && styles.selectorTextActive]}>
                    {jobId} - {fieldText(job, ["customer"])} - {fieldText(job, ["site"])}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable style={styles.primaryButton} onPress={saveInstallTeamMember} disabled={loading}>
            <Text style={styles.primaryButtonText}>Save team member</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Team Roster</Text>
        {team.map((member, index) => {
          const id = recordIdentity(member) || String(member.id || `TM-${index + 1}`);
          return (
            <View key={id} style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>{fieldText(member, ["name"])}</Text>
                <Text style={styles.statusPill}>{fieldText(member, ["availability"])}</Text>
              </View>
              <Text style={styles.muted}>{fieldText(member, ["role"])} - {fieldText(member, ["phone"])}</Text>
              <Text style={styles.bodyText}>Current job: {fieldText(member, ["current_job"])}</Text>
              <Text style={styles.bodyText}>Skills: {Array.isArray(member.skills) ? member.skills.join(", ") : fieldText(member, ["skills"])}</Text>
              <Text style={styles.bodyText}>Shift: {fieldText(member, ["shift"])}</Text>

              <Text style={styles.label}>Assign job</Text>
              <View style={styles.inlineActions}>
                {jobs.slice(0, 6).map((job) => {
                  const jobId = fieldText(job, ["job_id", "id"]);
                  return (
                    <Pressable key={`${id}-${jobId}`} style={styles.smallButton} onPress={() => assignInstallTeamMember(id, jobId)} disabled={loading}>
                      <Text style={styles.smallButtonText}>{jobId}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.inlineActions}>
                <Pressable style={styles.smallButton} onPress={() => updateInstallTeamMember(id, { availability: "Available" })} disabled={loading}>
                  <Text style={styles.smallButtonText}>Available</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => updateInstallTeamMember(id, { availability: "On Site" })} disabled={loading}>
                  <Text style={styles.smallButtonText}>On site</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => updateInstallTeamMember(id, { availability: "Off Duty", current_job: "" })} disabled={loading}>
                  <Text style={styles.smallButtonText}>Off duty</Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        <Text style={styles.sectionTitle}>Install Handoffs</Text>
        {jobs.map((job) => {
          const jobId = fieldText(job, ["id", "job_id"]);
          const canHandoff = ["complete", "installed", "done"].some((value) => String(job.status || "").toLowerCase().includes(value));
          return (
            <View key={`handoff-${jobId}`} style={styles.card}>
              <Text style={styles.cardTitle}>{jobId} - {fieldText(job, ["site", "customer"])}</Text>
              <Text style={styles.muted}>{fieldText(job, ["type"])} - {fieldText(job, ["status"])}</Text>
              <Text style={styles.bodyText}>Crew: {fieldText(job, ["crew"])} - Commissioning: {fieldText(job, ["commissioning_id"])}</Text>
              <View style={styles.inlineActions}>
                <Pressable style={styles.smallButton} onPress={() => sendInstallToCommissioning(job)} disabled={loading || !canHandoff}>
                  <Text style={styles.smallButtonText}>Send to commissioning</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  function renderCommissioningPage() {
    const commissionings = asRecords((data as Record<string, unknown> | null)?.commissionings);
    const messages = asRecords((data as Record<string, unknown> | null)?.dept_comms)
      .filter((item) => String(item.department || "").toLowerCase() === "commissioning" || String(item.commissioning_id || "").trim());
    const pending = commissionings.filter((item) => ["pending", "open"].includes(String(item.status || "").toLowerCase()));
    const inProgress = commissionings.filter((item) => String(item.status || "").toLowerCase().includes("progress"));
    return (
      <View>
        <View style={styles.moduleHero}>
          <Text style={styles.eyebrow}>Commissioning</Text>
          <Text style={styles.moduleHeroTitle}>Commissioning Handoff Board</Text>
          <Text style={styles.moduleHeroText}>Receive installed-product messages from the install team, start commissioning checks, confirm payment clearance, and record handover dates.</Text>
        </View>

        <View style={styles.metricGrid}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Pending</Text>
            <Text style={styles.metricValue}>{pending.length}</Text>
            <Text style={styles.muted}>Waiting for commissioning start.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>In progress</Text>
            <Text style={styles.metricValue}>{inProgress.length}</Text>
            <Text style={styles.muted}>Active commissioning checks.</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.cardLabel}>Manual commissioning record</Text>
          {[
            ["installation_ref", "Installation ref"],
            ["unit", "Unit / lift"],
            ["customer", "Customer"],
            ["site", "Site"],
            ["install_complete_date", "Install complete date"],
            ["payment_cleared", "Payment cleared Y/N"],
            ["start_date", "Start date"],
            ["handover_date", "Handover date"],
            ["status", "Status"],
            ["notes", "Notes"],
          ].map(([key, label]) => (
            <View key={key} style={styles.field}>
              <Text style={styles.label}>{label}</Text>
              <TextInput
                style={styles.input}
                value={String(commissioningDraft[key as keyof typeof commissioningDraft] || "")}
                onChangeText={(value) => setCommissioningDraft((draft) => ({ ...draft, [key]: value }))}
              />
            </View>
          ))}
          <Pressable style={styles.primaryButton} onPress={saveCommissioningRecord} disabled={loading}>
            <Text style={styles.primaryButtonText}>Save commissioning record</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Install Team Messages</Text>
        {!messages.length && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No install handoff messages</Text>
            <Text style={styles.muted}>When the install team sends an installed product to commissioning, the message will appear here.</Text>
          </View>
        )}
        {messages.slice(0, 10).map((item, index) => (
          <View key={String(item.id || index)} style={styles.card}>
            <Text style={styles.cardTitle}>{fieldText(item, ["subject", "title"])}</Text>
            <Text style={styles.muted}>{fieldText(item, ["installation_ref"])} - {fieldText(item, ["status"])}</Text>
            <Text style={styles.bodyText}>{fieldText(item, ["message", "notes"])}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Commissioning Board</Text>
        {commissionings.map((item, index) => {
          const id = recordIdentity(item) || String(item.id || `COM-${index + 1}`);
          return (
            <View key={id} style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>{id} - {fieldText(item, ["unit", "installation_ref", "job_ref"])}</Text>
                <Text style={styles.statusPill}>{fieldText(item, ["status"])}</Text>
              </View>
              <Text style={styles.muted}>{fieldText(item, ["customer"])} - {fieldText(item, ["site"])} - Install complete {fieldText(item, ["install_complete_date"])}</Text>
              <Text style={styles.bodyText}>Payment cleared: {String(item.payment_cleared || false)} - Handover: {fieldText(item, ["handover_date"])}</Text>
              <Text style={styles.bodyText}>{fieldText(item, ["message_from_install_team", "notes"])}</Text>
              <View style={styles.inlineActions}>
                <Pressable style={styles.smallButton} onPress={() => updateCommissioning(id, { status: "In Progress", start_date: new Date().toISOString().slice(0, 10) })} disabled={loading}>
                  <Text style={styles.smallButtonText}>Start checks</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => updateCommissioning(id, { payment_cleared: true })} disabled={loading}>
                  <Text style={styles.smallButtonText}>Payment cleared</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => updateCommissioning(id, { status: "Handover Complete", handover_date: new Date().toISOString().slice(0, 10) })} disabled={loading}>
                  <Text style={styles.smallButtonText}>Handover complete</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  function selectStaffForAttendance(staff: Record<string, unknown>) {
    setAttendanceDraft((draft) => ({
      ...draft,
      person_id: String(staff.id || ""),
      person_name: String(staff.name || ""),
      department: String(staff.department || ""),
    }));
    setLeaveDraft((draft) => ({
      ...draft,
      person_id: String(staff.id || ""),
      person_name: String(staff.name || ""),
      department: String(staff.department || ""),
    }));
  }

  function renderStaffManagementPage() {
    const staff = asRecords(data?.org_chart);
    const attendance = asRecords(data?.attendance_today);
    const leaves = asRecords((data as Record<string, unknown> | null)?.leave_requests);
    const today = new Date().toISOString().slice(0, 10);
    const departments = ["All", ...Array.from(new Set(staff.map((person) => fieldText(person, ["department"])).filter(Boolean))).sort()];
    const query = hrSearch.trim().toLowerCase();
    const visibleStaff = staff.filter((person) => {
      const department = fieldText(person, ["department"]);
      const departmentOk = hrDepartmentFilter === "All" || department === hrDepartmentFilter;
      const queryOk = !query || JSON.stringify(person).toLowerCase().includes(query);
      return departmentOk && queryOk;
    });
    const todayAttendance = attendance.filter((item) => fieldText(item, ["date"]) === today);
    const attendanceByPerson = new Map(todayAttendance.map((item) => [fieldText(item, ["person_id", "staff_id"]), item]));
    const viewer = (data?.viewer || {}) as Record<string, unknown>;
    const viewerStaff = viewerStaffRecord(staff);
    const viewerStaffId = viewerStaff ? fieldText(viewerStaff, ["id"]) : "";
    const viewerAttendance = viewerStaffId ? attendanceByPerson.get(viewerStaffId) : undefined;
    const canManageAttendance = String(viewer.role || "").toLowerCase() === "admin" || String(viewer.department || "").toLowerCase() === "executive office";
    const pendingLeaves = leaves.filter((item) => String(item.status || "").toLowerCase() === "pending");
    const approvedLeaves = leaves.filter((item) => {
      const status = String(item.status || "").toLowerCase();
      const start = fieldText(item, ["start_date"]);
      const end = fieldText(item, ["end_date"]) || start;
      return status === "approved" && start <= today && today <= end;
    });
    const presentToday = todayAttendance.filter((item) => String(item.status || "").toLowerCase() === "present");
    const unavailableToday = todayAttendance.filter((item) => ["absent", "half-day", "leave"].includes(String(item.status || "").toLowerCase()));
    const selectedPerson = staff.find((person) => fieldText(person, ["id"]) === attendanceDraft.person_id);
    return (
      <View>
        <View style={styles.moduleHero}>
          <Text style={styles.eyebrow}>HR Portal</Text>
          <Text style={styles.moduleHeroTitle}>Staff, Attendance & Leave</Text>
          <Text style={styles.moduleHeroText}>A single workspace for staff records, daily attendance, leave requests, and manager approvals.</Text>
        </View>

        <View style={styles.metricGrid}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Staff</Text>
            <Text style={styles.metricValue}>{staff.length}</Text>
            <Text style={styles.muted}>{departments.length - 1} departments in the org chart.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Present today</Text>
            <Text style={styles.metricValue}>{presentToday.length}</Text>
            <Text style={styles.muted}>{todayAttendance.length} records for {today}.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Unavailable</Text>
            <Text style={styles.metricValue}>{unavailableToday.length + approvedLeaves.length}</Text>
            <Text style={styles.muted}>Absent, half-day, or approved leave today.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Pending leave</Text>
            <Text style={styles.metricValue}>{pendingLeaves.length}</Text>
            <Text style={styles.muted}>Manager action required.</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardLabel}>My attendance</Text>
              <Text style={styles.cardTitle}>{viewerStaff ? fieldText(viewerStaff, ["name"]) : "Staff profile not linked"}</Text>
            </View>
            <Text style={styles.statusPill}>{fieldText(viewerAttendance || {}, ["status"]) || "Not marked"}</Text>
          </View>
          <Text style={styles.bodyText}>Today: {today} - In {fieldText(viewerAttendance || {}, ["check_in", "time_in"]) || "Not set"} - Out {fieldText(viewerAttendance || {}, ["check_out", "time_out"]) || "Not set"}</Text>
          {!!attendanceLocationText(viewerAttendance?.check_in_location) && (
            <Text style={styles.muted}>Check-in location: {attendanceLocationText(viewerAttendance?.check_in_location)}</Text>
          )}
          {!!attendanceLocationText(viewerAttendance?.check_out_location) && (
            <Text style={styles.muted}>Check-out location: {attendanceLocationText(viewerAttendance?.check_out_location)}</Text>
          )}
          <View style={styles.inlineActions}>
            <Pressable style={styles.primaryButton} onPress={() => markSelfAttendance("check_in")} disabled={loading || !viewerStaff}>
              <Text style={styles.primaryButtonText}>Check in</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => markSelfAttendance("check_out")} disabled={loading || !viewerStaff}>
              <Text style={styles.secondaryButtonText}>Check out</Text>
            </Pressable>
          </View>
          <Text style={styles.muted}>Location is captured from the staff member's browser when they check in or out.</Text>
        </View>

        <View style={styles.formCard}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardLabel}>Find staff</Text>
              <Text style={styles.cardTitle}>{visibleStaff.length} matching records</Text>
            </View>
            <Text style={styles.statusPill}>{hrDepartmentFilter}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Search</Text>
            <TextInput
              style={styles.input}
              value={hrSearch}
              onChangeText={setHrSearch}
              placeholder="Name, department, title, phone"
            />
          </View>
          <View style={styles.inlineActions}>
            {departments.map((department) => (
              <Pressable
                key={department}
                style={[styles.smallButton, hrDepartmentFilter === department && styles.selectorPillActive]}
                onPress={() => setHrDepartmentFilter(department)}
              >
                <Text style={styles.smallButtonText}>{department}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Staff Directory</Text>
        <View style={styles.metricGrid}>
          {visibleStaff.slice(0, 80).map((person) => {
            const personId = fieldText(person, ["id"]);
            const statusRecord = attendanceByPerson.get(personId);
            const status = fieldText(statusRecord || {}, ["status"]) || "Not marked";
            return (
              <View key={personId || fieldText(person, ["name"])} style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <View>
                    <Text style={styles.cardTitle}>{fieldText(person, ["name"])}</Text>
                    <Text style={styles.muted}>{fieldText(person, ["title"])} - {fieldText(person, ["department"])}</Text>
                  </View>
                  <Text style={styles.statusPill}>{status}</Text>
                </View>
                <Text style={styles.bodyText}>Phone: {fieldText(person, ["phone", "mobile"]) || "Not set"}</Text>
                <Text style={styles.bodyText}>Reports to: {fieldText(person, ["reports_to", "manager"]) || "Not set"}</Text>
                <View style={styles.inlineActions}>
                  <Pressable style={styles.smallButton} onPress={() => selectStaffForAttendance(person)}>
                    <Text style={styles.smallButtonText}>Select</Text>
                  </Pressable>
                  {canManageAttendance && ["present", "absent", "half-day", "leave"].map((statusOption) => (
                    <Pressable key={`${personId}-${statusOption}`} style={styles.smallButton} onPress={() => markQuickAttendance(person, statusOption)} disabled={loading}>
                      <Text style={styles.smallButtonText}>{statusOption}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
        {!visibleStaff.length && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No staff found</Text>
            <Text style={styles.muted}>Change the search or department filter.</Text>
          </View>
        )}

        {canManageAttendance && <View style={styles.formGrid}>
          <View style={styles.formCard}>
            <Text style={styles.cardLabel}>Attendance console</Text>
            <Text style={styles.cardTitle}>{selectedPerson ? fieldText(selectedPerson, ["name"]) : "Select a staff member"}</Text>
            {[
              ["date", "Date"],
              ["person_name", "Staff name"],
              ["department", "Department"],
              ["status", "Status"],
              ["check_in", "Check in"],
              ["check_out", "Check out"],
              ["notes", "Notes"],
            ].map(([key, label]) => (
              <View key={key} style={styles.field}>
                <Text style={styles.label}>{label}</Text>
                <TextInput
                  style={[styles.input, key === "notes" && styles.textarea]}
                  value={String(attendanceDraft[key as keyof typeof attendanceDraft] || "")}
                  onChangeText={(value) => setAttendanceDraft((draft) => ({ ...draft, [key]: value }))}
                  multiline={key === "notes"}
                />
              </View>
            ))}
            <View style={styles.inlineActions}>
              {["present", "late", "absent", "half-day", "leave", "wfh"].map((status) => (
                <Pressable key={status} style={styles.smallButton} onPress={() => setAttendanceDraft((draft) => ({ ...draft, status }))}>
                  <Text style={styles.smallButtonText}>{status}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.primaryButton} onPress={saveAttendance} disabled={loading || !attendanceDraft.person_id}>
              <Text style={styles.primaryButtonText}>Save attendance</Text>
            </Pressable>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.cardLabel}>Leave request</Text>
            {[
              ["person_name", "Staff name"],
              ["department", "Department"],
              ["leave_type", "Leave type"],
              ["start_date", "Start date"],
              ["end_date", "End date"],
              ["reason", "Reason"],
            ].map(([key, label]) => (
              <View key={key} style={styles.field}>
                <Text style={styles.label}>{label}</Text>
                <TextInput
                  style={[styles.input, key === "reason" && styles.textarea]}
                  value={String(leaveDraft[key as keyof typeof leaveDraft] || "")}
                  onChangeText={(value) => setLeaveDraft((draft) => ({ ...draft, [key]: value }))}
                  multiline={key === "reason"}
                />
              </View>
            ))}
            <View style={styles.inlineActions}>
              {["Casual", "Sick", "Earned", "Unpaid"].map((leaveType) => (
                <Pressable key={leaveType} style={styles.smallButton} onPress={() => setLeaveDraft((draft) => ({ ...draft, leave_type: leaveType }))}>
                  <Text style={styles.smallButtonText}>{leaveType}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.primaryButton} onPress={saveLeaveRequest} disabled={loading || !leaveDraft.person_id}>
              <Text style={styles.primaryButtonText}>Submit leave request</Text>
            </Pressable>
          </View>
        </View>}

        <Text style={styles.sectionTitle}>Leave Approval Queue</Text>
        {!pendingLeaves.length && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No pending leave requests</Text>
            <Text style={styles.muted}>Approved and rejected requests stay in the leave history below.</Text>
          </View>
        )}
        {pendingLeaves.map((item, index) => {
          const id = recordIdentity(item) || String(item.id || `LEAVE-${index + 1}`);
          return (
            <View key={id} style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>{fieldText(item, ["person_name", "name"])}</Text>
                <Text style={styles.statusPill}>{fieldText(item, ["status"])}</Text>
              </View>
              <Text style={styles.muted}>{fieldText(item, ["department"])} - {fieldText(item, ["leave_type"])} - {fieldText(item, ["start_date"])} to {fieldText(item, ["end_date"])}</Text>
              <Text style={styles.bodyText}>{fieldText(item, ["reason", "notes"])}</Text>
              <View style={styles.inlineActions}>
                <Pressable style={styles.smallButton} onPress={() => updateLeaveRequest(id, "Approved")} disabled={loading}>
                  <Text style={styles.smallButtonText}>Approve</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => updateLeaveRequest(id, "Rejected")} disabled={loading}>
                  <Text style={styles.smallButtonText}>Reject</Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        <Text style={styles.sectionTitle}>Today Attendance</Text>
        {!todayAttendance.length && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No attendance marked today</Text>
            <Text style={styles.muted}>Use quick actions on staff cards or the attendance console.</Text>
          </View>
        )}
        {todayAttendance.map((item, index) => (
          <View key={String(item.id || index)} style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>{fieldText(item, ["person_name", "staff_name", "name"])}</Text>
              <Text style={styles.statusPill}>{fieldText(item, ["status"])}</Text>
            </View>
            <Text style={styles.muted}>{fieldText(item, ["date"])} - {fieldText(item, ["department"])}</Text>
            <Text style={styles.bodyText}>In {fieldText(item, ["check_in", "time_in"]) || "Not set"} - Out {fieldText(item, ["check_out", "time_out"]) || "Not set"}</Text>
            {!!attendanceLocationText(item.check_in_location) && <Text style={styles.muted}>Check-in location: {attendanceLocationText(item.check_in_location)}</Text>}
            {!!attendanceLocationText(item.check_out_location) && <Text style={styles.muted}>Check-out location: {attendanceLocationText(item.check_out_location)}</Text>}
            {!!fieldText(item, ["notes"]) && <Text style={styles.bodyText}>{fieldText(item, ["notes"])}</Text>}
          </View>
        ))}

        <Text style={styles.sectionTitle}>Leave History</Text>
        {leaves.slice(0, 30).map((item, index) => {
          const id = recordIdentity(item) || String(item.id || `LEAVE-HISTORY-${index + 1}`);
          return (
            <View key={id} style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>{fieldText(item, ["person_name", "name"])}</Text>
                <Text style={styles.statusPill}>{fieldText(item, ["status"])}</Text>
              </View>
              <Text style={styles.muted}>{fieldText(item, ["leave_type"])} - {fieldText(item, ["start_date"])} to {fieldText(item, ["end_date"])}</Text>
              <Text style={styles.bodyText}>{fieldText(item, ["reason", "notes"])}</Text>
              {!!fieldText(item, ["approved_by"]) && (
                <Text style={styles.bodyText}>Approved by: {fieldText(item, ["approved_by"])} - {fieldText(item, ["approved_at"])}</Text>
              )}
              {String(item.status || "").toLowerCase() === "pending" && (
                <View style={styles.inlineActions}>
                  <Pressable style={styles.smallButton} onPress={() => updateLeaveRequest(id, "Approved")} disabled={loading}>
                    <Text style={styles.smallButtonText}>Approve</Text>
                  </Pressable>
                  <Pressable style={styles.smallButton} onPress={() => updateLeaveRequest(id, "Rejected")} disabled={loading}>
                    <Text style={styles.smallButtonText}>Reject</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}
        {!leaves.length && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No leave records</Text>
            <Text style={styles.muted}>Staff leave requests will appear here after submission.</Text>
          </View>
        )}
      </View>
    );
  }

  function filteredCustomers() {
    const query = crmSearch.trim().toLowerCase();
    return (data?.customers || []).filter((customer) => {
      const stage = customer.pipeline_stage || "Lead";
      const stageOk = crmStageFilter === "All" || stage === crmStageFilter;
      const queryOk = !query || JSON.stringify(customer).toLowerCase().includes(query);
      return stageOk && queryOk;
    });
  }

  function crmNameKey(value: unknown) {
    return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  }

  function inquiryIdentity(record: Record<string, unknown>) {
    return recordIdentity(record) || String(record.enquiry_no || record.source_enquiry_no || "");
  }

  function estimatesForInquiry(inquiry: Record<string, unknown>, estimates: Array<Record<string, unknown>>) {
    const inquiryId = inquiryIdentity(inquiry);
    const customerId = String(inquiry.customer_id || "");
    const nameKey = crmNameKey(inquiry.customer || inquiry.lead_name || inquiry.name);
    return estimates.filter((estimate) => {
      const estimateInquiryId = String(estimate.source_inquiry_id || estimate.enquiry_no || estimate.source_enquiry_no || "");
      const estimateCustomerId = String(estimate.customer_id || "");
      const estimateNameKey = crmNameKey(estimate.customer_name || estimate.offer_name || estimate.customer);
      return Boolean(
        (inquiryId && estimateInquiryId && inquiryId === estimateInquiryId) ||
        (customerId && estimateCustomerId && customerId === estimateCustomerId) ||
        (nameKey && estimateNameKey && nameKey === estimateNameKey)
      );
    }).sort((a, b) => String(b.offer_date || b.created_at || "").localeCompare(String(a.offer_date || a.created_at || "")));
  }

  function estimatesForCustomer(customer: Customer, estimates: Array<Record<string, unknown>>) {
    const customerId = String(customer.id || "");
    const nameKey = crmNameKey(customer.name);
    return estimates.filter((estimate) => {
      const estimateCustomerId = String(estimate.customer_id || "");
      const estimateNameKey = crmNameKey(estimate.customer_name || estimate.offer_name || estimate.customer);
      return Boolean((customerId && estimateCustomerId && customerId === estimateCustomerId) || (nameKey && estimateNameKey && nameKey === estimateNameKey));
    });
  }

  function datePlusDays(days: number) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function followupDate(record: Record<string, unknown>) {
    return String(record.next_followup || record.next_follow_up || "");
  }

  function followupFrequency(record: Record<string, unknown>) {
    const value = Number(record.followup_frequency_days || 7);
    return Number.isFinite(value) && value > 0 ? value : 7;
  }

  async function scheduleFollowUp(record: Record<string, unknown>, days: number) {
    await updateSalesInquiry(record, {
      next_followup: datePlusDays(days),
      followup_frequency_days: String(days),
      followup_status: "Scheduled",
    });
  }

  async function markFollowedUp(record: Record<string, unknown>) {
    const days = followupFrequency(record);
    await updateSalesInquiry(record, {
      last_followup: new Date().toISOString().slice(0, 10),
      next_followup: datePlusDays(days),
      followup_status: "Scheduled",
    });
  }

  function openSiteVisitForCustomer(customer: Customer) {
    const existing = (data?.site_visits || []).find((visit) => String(visit.customer_id || "") === String(customer.id || ""));
    setSiteVisitDraft({ ...emptySiteVisit, ...existing, customer_id: customer.id });
    setSiteVisitEditorOpen(true);
  }

  function openSiteVisitForCrmOption(customer: { id: string; name: string; phone?: string; address?: string; source_inquiry_id?: string }) {
    const existing = (data?.site_visits || []).find((visit) => String(visit.customer_id || "") === String(customer.id || ""));
    setSiteVisitDraft({
      ...emptySiteVisit,
      ...existing,
      customer_id: customer.id,
      customer_name: customer.name,
      site_person_name: existing?.site_person_name || customer.name,
      site_person_mobile: existing?.site_person_mobile || customer.phone || "",
      site_enquiry_no: existing?.site_enquiry_no || customer.source_inquiry_id || "",
      site_visit_date: existing?.site_visit_date || new Date().toISOString().slice(0, 10),
      visited_by: existing?.visited_by || data?.viewer?.display_name || username,
    });
    setSiteVisitEditorOpen(true);
  }

  function openSiteVisitForInquiry(record: Record<string, unknown>) {
    const customerId = String(record.customer_id || record.id || record.enquiry_no || "");
    const enquiryNo = String(record.enquiry_no || record.source_enquiry_no || "");
    const existing = (data?.site_visits || []).find((visit) => {
      const sameCustomer = String(visit.customer_id || "") === customerId;
      const sameEnquiry = enquiryNo && String(visit.site_enquiry_no || "") === enquiryNo;
      return sameCustomer && (!String(visit.site_enquiry_no || "") || sameEnquiry);
    }) || (data?.site_visits || []).find((visit) => String(visit.customer_id || "") === customerId);
    setSiteVisitDraft({
      ...emptySiteVisit,
      ...existing,
      customer_id: customerId,
      site_enquiry_no: String(existing?.site_enquiry_no || enquiryNo),
    });
    setSiteVisitEditorOpen(true);
  }

  function renderSiteVisitEditorModal() {
    const linkedCustomer = siteVisitDraft.customer_id ? crmCustomerForSiteVisit(siteVisitDraft as Record<string, unknown>) : undefined;
    return (
      <Modal visible={siteVisitEditorOpen} transparent animationType="fade" onRequestClose={() => setSiteVisitEditorOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.cardLabel}>{siteVisitDraft.id ? "Edit site visit report" : "Create site visit report"}</Text>
                <Text style={styles.muted}>
                  Customer ID: {String(siteVisitDraft.customer_id || "-")}
                  {linkedCustomer ? ` - ${linkedCustomer.name}${linkedCustomer.address ? ` - ${linkedCustomer.address}` : ""}` : " - select from CRM"}
                </Text>
              </View>
              <Pressable style={styles.secondaryButton} onPress={() => setSiteVisitEditorOpen(false)} disabled={loading}>
                <Text style={styles.secondaryButtonText}>Close</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
              <View style={styles.field}>
                <Text style={styles.label}>Assigned customer ID</Text>
                <TextInput
                  style={styles.input}
                  value={String(siteVisitDraft.customer_id || "")}
                  editable={false}
                  placeholder="Select a CRM customer"
                />
              </View>
              <View style={styles.formGrid}>
                {siteVisitFields.map((field) => (
                  <View key={`site-modal-${String(field.key)}`} style={styles.field}>
                    <Text style={styles.label}>{field.label}</Text>
                    <TextInput
                      style={[styles.input, field.multiline && styles.textarea]}
                      value={String(siteVisitDraft[field.key] || "")}
                      onChangeText={(value) => updateSiteVisitField(field.key, value)}
                      keyboardType={field.keyboard || "default"}
                      multiline={field.multiline}
                    />
                  </View>
                ))}
              </View>
              <View style={styles.openingSchedulePanel}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={styles.sectionTitle}>Opening size by floor</Text>
                    <Text style={styles.muted}>Enter each opening after setting stops/openings. Floor, FF height, and lintel height are saved with this site report.</Text>
                  </View>
                  <Text style={styles.statusPill}>{ensureOpeningSchedule(siteVisitDraft, desiredOpeningCount(siteVisitDraft)).length} openings</Text>
                </View>
                {ensureOpeningSchedule(siteVisitDraft, desiredOpeningCount(siteVisitDraft)).length ? (
                  ensureOpeningSchedule(siteVisitDraft, desiredOpeningCount(siteVisitDraft)).map((row, index) => (
                    <View key={`opening-schedule-${index}`} style={styles.openingScheduleRow}>
                      <View style={styles.openingScheduleField}>
                        <Text style={styles.label}>Floor</Text>
                        <TextInput style={styles.input} value={row.floor} onChangeText={(value) => updateOpeningScheduleRow(index, "floor", value)} />
                      </View>
                      <View style={styles.openingScheduleField}>
                        <Text style={styles.label}>FF height mm</Text>
                        <TextInput style={styles.input} value={row.ff_height_mm} onChangeText={(value) => updateOpeningScheduleRow(index, "ff_height_mm", value)} keyboardType="numeric" />
                      </View>
                      <View style={styles.openingScheduleField}>
                        <Text style={styles.label}>Lintel height mm</Text>
                        <TextInput style={styles.input} value={row.lintel_height_mm} onChangeText={(value) => updateOpeningScheduleRow(index, "lintel_height_mm", value)} keyboardType="numeric" />
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.muted}>Enter how many stops or openings to create floor opening rows.</Text>
                  </View>
                )}
              </View>
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setSiteVisitEditorOpen(false)} disabled={loading}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primaryButtonInline} onPress={saveSiteVisit} disabled={loading || !siteVisitDraft.customer_id}>
                <Text style={styles.primaryButtonText}>{siteVisitDraft.id ? "Update site visit report" : "Save site visit report"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  function openCostingForCustomer(customer: Customer) {
    setOfferDraft({
      ...emptyOfferDraft,
      customer_id: customer.id,
      customer_name: customer.name,
      offer_name: customer.name,
      offer_type: customer.segment || "Passenger",
      lead_status: "Offer Pending",
      elevator_type: customer.segment || "Passenger Elevator",
      createdbyname: data?.viewer?.display_name || username,
    });
    setCostingEditorOpen(true);
  }

  function openCostingForInquiry(record: Record<string, unknown>) {
    const customerName = String(record.customer || record.lead_name || "");
    setOfferDraft({
      ...emptyOfferDraft,
      customer_name: customerName,
      offer_name: customerName,
      offer_type: String(record.lead_type || record.leadtype || "Individual"),
      lead_status: "Offer Pending",
      elevator_type: String(record.lead_type || record.leadtype || "Passenger Elevator"),
      createdbyname: data?.viewer?.display_name || username,
      customer_id: String(record.customer_id || ""),
      source_inquiry_id: recordIdentity(record) || String(record.enquiry_no || ""),
      notes: String(record.enquiry_remark || record.requirement || ""),
    });
    setCostingEditorOpen(true);
  }

  function renderOfferEditorModal() {
    return (
      <Modal visible={costingEditorOpen} transparent animationType="fade" onRequestClose={() => setCostingEditorOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.cardLabel}>Offer Manager</Text>
                <Text style={styles.muted}>Customer ID: {offerDraft.customer_id || "-"}</Text>
              </View>
              <Pressable style={styles.secondaryButton} onPress={() => setCostingEditorOpen(false)} disabled={loading}>
                <Text style={styles.secondaryButtonText}>Close</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
              <View style={styles.formGrid}>
                {[
                  ["customer_id", "Customer ID"],
                  ["job_no", "Offer / job no"],
                  ["offer_date", "Offer date"],
                  ["customer_name", "Customer name"],
                  ["offer_type", "Offer type"],
                  ["lead_status", "Offer status"],
                  ["elevator_type", "Elevator type"],
                  ["stops", "Stops / floors"],
                  ["capacity", "Capacity"],
                  ["speed", "Speed"],
                  ["drive_type", "Drive type"],
                  ["door_type", "Door type"],
                  ["finish", "Cabin / finish"],
                  ["material_cost", "Internal material cost"],
                  ["install_cost", "Internal install cost"],
                  ["overhead_cost", "Internal overhead"],
                  ["margin_percent", "Margin percent"],
                  ["discount", "Discount"],
                  ["gst_percent", "GST percent"],
                  ["total_cost", "Client offer value override"],
                  ["offer_valid_until", "Offer valid until"],
                ].map(([key, label]) => (
                  <View key={`standalone-offer-field-${key}`} style={styles.field}>
                    <Text style={styles.label}>{label}</Text>
                    <TextInput
                      style={styles.input}
                      value={String(offerDraft[key] || "")}
                      editable={key !== "customer_id"}
                      onChangeText={(value) => setOfferDraft((draft) => ({ ...draft, [key]: key === "customer_name" ? value : value, ...(key === "customer_name" ? { offer_name: value } : {}) }))}
                      keyboardType={["material_cost", "install_cost", "overhead_cost", "margin_percent", "discount", "gst_percent", "total_cost"].includes(key) ? "numeric" : "default"}
                    />
                  </View>
                ))}
              </View>
              <View style={styles.linkedSystemsPanel}>
                <Text style={styles.cardLabel}>Client offer preview</Text>
                <Text style={styles.metricValue}>{formatMoney(offerCostSummary(offerDraft).totalCost)}</Text>
                <Text style={styles.muted}>Base {formatMoney(offerCostSummary(offerDraft).baseCost)} + margin {offerCostSummary(offerDraft).marginPercent}% + GST {offerCostSummary(offerDraft).gstPercent}% after discount.</Text>
              </View>
              <View style={styles.formGrid}>
                <View style={styles.field}>
                  <Text style={styles.label}>Payment terms</Text>
                  <TextInput style={[styles.input, styles.textarea]} value={offerDraft.payment_terms} onChangeText={(value) => setOfferDraft((draft) => ({ ...draft, payment_terms: value }))} multiline />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Delivery timeline</Text>
                  <TextInput style={[styles.input, styles.textarea]} value={offerDraft.delivery_timeline} onChangeText={(value) => setOfferDraft((draft) => ({ ...draft, delivery_timeline: value }))} multiline />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Warranty terms</Text>
                  <TextInput style={[styles.input, styles.textarea]} value={offerDraft.warranty_terms} onChangeText={(value) => setOfferDraft((draft) => ({ ...draft, warranty_terms: value }))} multiline />
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Internal costing notes</Text>
                <TextInput style={[styles.input, styles.textarea]} value={offerDraft.notes} onChangeText={(value) => setOfferDraft((draft) => ({ ...draft, notes: value }))} multiline />
              </View>
              <View style={styles.costingSourcePanel}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={styles.sectionTitle}>Complete .xlsx costing data</Text>
                    <Text style={styles.muted}>Attach an internal costing source so the saved offer keeps the source data used to prepare the client letter.</Text>
                  </View>
                  <Pressable style={styles.smallButton} onPress={loadCostingSourceData} disabled={loading || costingSourcesLoading}>
                    <Text style={styles.smallButtonText}>{costingSourcesLoading ? "Loading..." : "Refresh source data"}</Text>
                  </Pressable>
                </View>
                {selectedCostingSource ? (
                  <>
                    <View style={styles.costingStepper}>
                      <Pressable style={styles.smallButton} onPress={() => setCostingSourceIndex((index) => Math.max(0, index - 1))} disabled={costingSourceIndex <= 0}>
                        <Text style={styles.smallButtonText}>Previous source</Text>
                      </Pressable>
                      <View style={styles.costingStepMeta}>
                        <Text style={styles.cardTitle}>{selectedCostingSource.source_file}</Text>
                        <Text style={styles.muted}>Source {costingSourceIndex + 1} of {costingSources.length} - {selectedCostingSource.non_empty_cell_count} values</Text>
                      </View>
                      <Pressable style={styles.smallButton} onPress={() => setCostingSourceIndex((index) => Math.min(costingSources.length - 1, index + 1))} disabled={costingSourceIndex >= costingSources.length - 1}>
                        <Text style={styles.smallButtonText}>Next source</Text>
                      </Pressable>
                      <Pressable style={styles.primaryButtonInline} onPress={attachSelectedCostingSource} disabled={loading}>
                        <Text style={styles.primaryButtonText}>Attach source data</Text>
                      </Pressable>
                    </View>
                    <Text style={styles.muted}>Attached source: {offerDraft.costing_source_file || "none yet"}.</Text>
                  </>
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.muted}>{costingSourcesLoading ? "Loading source values..." : "No costing source data loaded yet."}</Text>
                  </View>
                )}
              </View>
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setCostingEditorOpen(false)} disabled={loading}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primaryButtonInline} onPress={saveOffer} disabled={loading || !offerDraft.customer_id.trim() || !offerDraft.customer_name.trim()}>
                <Text style={styles.primaryButtonText}>Save offer</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  function renderOfferManagerPage() {
    const offers = [...asRecords(data?.estimates)].sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")));
    const customers = [...(data?.customers || [])].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    const activeOffers = offers.filter((offer) => !String(offer.status || offer.lead_status || "").toLowerCase().includes("lost"));
    return (
      <View>
        <View style={styles.moduleHero}>
          <Text style={styles.eyebrow}>Offer Manager</Text>
          <Text style={styles.moduleHeroTitle}>Customer-Linked Elevator Offers</Text>
          <Text style={styles.moduleHeroText}>Create FUZI offers from internal elevator costing, keep each offer tied to a CRM customer, and prepare the client offer letter from the same record.</Text>
        </View>
        <View style={styles.metricGrid}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Offers</Text>
            <Text style={styles.metricValue}>{offers.length}</Text>
            <Text style={styles.muted}>Saved offer and costing records.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Active offers</Text>
            <Text style={styles.metricValue}>{activeOffers.length}</Text>
            <Text style={styles.muted}>Not marked lost.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Sent</Text>
            <Text style={styles.metricValue}>{offers.filter((offer) => String(offer.status || "").toLowerCase() === "sent").length}</Text>
            <Text style={styles.muted}>Client offer letters sent.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Approved</Text>
            <Text style={styles.metricValue}>{offers.filter((offer) => ["approved", "accepted"].includes(String(offer.status || "").toLowerCase())).length}</Text>
            <Text style={styles.muted}>Approved customer offers.</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.cardLabel}>Create offer from CRM customer</Text>
          <Text style={styles.muted}>Select a saved CRM customer first. Offer Manager will use that customer ID for the costing record and offer letter.</Text>
          {!customers.length && <Text style={styles.muted}>No saved customer accounts are available yet.</Text>}
          <View style={styles.inlineActions}>
            {customers.slice(0, 16).map((customer) => (
              <Pressable key={`offer-customer-${customer.id}`} style={styles.smallButton} onPress={() => openCostingForCustomer(customer)} disabled={loading}>
                <Text style={styles.smallButtonText}>{customer.name || customer.id}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Offer Pipeline</Text>
        {!offers.length && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No offers yet</Text>
            <Text style={styles.muted}>Create an offer from a CRM customer to prepare internal costing and a client offer letter.</Text>
          </View>
        )}
        {offers.slice(0, 40).map((offer, index) => {
          const id = recordIdentity(offer) || String(offer.job_no || index);
          const cost = offerCostSummary(offer);
          return (
            <View key={`standalone-offer-${id}`} style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardTitleBlock}>
                  <Text style={styles.cardTitle}>{String(offer.customer_name || offer.offer_name || "-")}</Text>
                  <Text style={styles.muted}>{id} - Customer {String(offer.customer_id || "-")} - {String(offer.offer_date || offer.created_at || "-")}</Text>
                </View>
                <Text style={styles.statusPill}>{String(offer.status || offer.lead_status || "Offer Pending")}</Text>
              </View>
              <Text style={styles.bodyText}>{String(offer.elevator_type || offer.offer_type || "Elevator")} - Stops {String(offer.stops || "-")} - Capacity {String(offer.capacity || "-")} - {formatMoney(cost.totalCost)}</Text>
              <Text style={styles.muted}>Internal base {formatMoney(cost.baseCost)} + margin {cost.marginPercent}% + GST {cost.gstPercent}%.</Text>
              <View style={styles.inlineActions}>
                <Pressable style={styles.smallButton} onPress={() => openEstimateArtifact(id, "report")} disabled={loading}>
                  <Text style={styles.smallButtonText}>Costing report</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => openEstimateArtifact(id, "offer.pdf")} disabled={loading}>
                  <Text style={styles.smallButtonText}>Offer letter</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => estimateAction(id, "send")} disabled={loading}>
                  <Text style={styles.smallButtonText}>Send offer</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => estimateAction(id, "approve-offer")} disabled={loading}>
                  <Text style={styles.smallButtonText}>Approve offer</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
        {renderOfferEditorModal()}
      </View>
    );
  }

  function renderCustomerCrmPage() {
    const customers = data?.customers || [];
    const visibleCustomers = filteredCustomers();
    const inquiries = asRecords((data as Record<string, unknown> | null)?.sales_inquiries);
    const offers = [...asRecords(data?.estimates)].sort((a, b) => {
      const aReport = String(a.imported_from || a.source || "").includes("Offer Report") ? 1 : 0;
      const bReport = String(b.imported_from || b.source || "").includes("Offer Report") ? 1 : 0;
      return bReport - aReport;
    });
    const visibleInquiries = inquiries.filter((item) => {
      const query = crmSearch.trim().toLowerCase();
      return !query || JSON.stringify(item).toLowerCase().includes(query);
    });
    const openInquiries = inquiries.filter((item) => !String(item.status || item.lead_status || "").toLowerCase().includes("lost"));
    const reportImported = inquiries.filter((item) => item.source_enquiry_no || item.enquiry_no).length;
    const crmRows = [
      ...visibleCustomers.map((customer) => ({ type: "customer" as const, customer })),
      ...visibleInquiries.map((inquiry, index) => ({ type: "inquiry" as const, inquiry, index })),
    ];
    const crmPageSize = 20;
    const crmPageCount = Math.max(1, Math.ceil(crmRows.length / crmPageSize));
    const safeCrmPage = Math.min(enquiryPage, crmPageCount);
    const pagedCrmRows = crmRows.slice((safeCrmPage - 1) * crmPageSize, safeCrmPage * crmPageSize);
    const inquiriesWithEstimates = inquiries.filter((item) => estimatesForInquiry(item, offers).length);
    const stages = ["All", "Lead", "Qualified", "Site Visit", "Quoted", "Negotiation", "Won", "Lost", "AMC"];
    const today = new Date().toISOString().slice(0, 10);
    const dueInquiryFollowUps = inquiries.filter((item) => {
      const date = followupDate(item);
      const status = String(item.followup_status || "").toLowerCase();
      return date && date <= today && status !== "closed";
    });
    const dueFollowUps = dueInquiryFollowUps;
    const consentMissing = customers.filter((customer) => String(customer.dpdp_consent || "N").toUpperCase() !== "Y");
    return (
      <View>
        <View style={styles.moduleHero}>
          <Text style={styles.eyebrow}>Customer CRM</Text>
          <Text style={styles.moduleHeroTitle}>Modern Customer Relationship Workspace</Text>
          <Text style={styles.moduleHeroText}>Manage leads, accounts, follow-ups, compliance consent, tax details, portal access, and customer-linked operations from one CRM board.</Text>
          {isAdmin && (
            <View style={styles.inlineActions}>
              <Pressable style={styles.primaryButtonInline} onPress={downloadCrmData} disabled={loading}>
                <Text style={styles.primaryButtonText}>Download CRM data</Text>
              </Pressable>
            </View>
          )}
        </View>
        <View style={styles.metricGrid}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Accounts</Text>
            <Text style={styles.metricValue}>{customers.length}</Text>
            <Text style={styles.muted}>Saved customer and building records.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Follow-ups due</Text>
            <Text style={styles.metricValue}>{dueFollowUps.length}</Text>
            <Text style={styles.muted}>Next follow-up today or overdue.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Consent missing</Text>
            <Text style={styles.metricValue}>{consentMissing.length}</Text>
            <Text style={styles.muted}>DPDP consent needs review.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Sales enquiries</Text>
            <Text style={styles.metricValue}>{inquiries.length}</Text>
            <Text style={styles.muted}>{openInquiries.length} active, {reportImported} from enquiry report.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Customers with costing</Text>
            <Text style={styles.metricValue}>{inquiriesWithEstimates.length}</Text>
            <Text style={styles.muted}>{offers.length} customer-linked offers tied into CRM.</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.cardLabel}>{customerDraft.id ? "Edit customer account" : "New account / lead"}</Text>
          <Pressable
            style={[styles.dropdownButton, (customerEditorOpen || !!customerDraft.id) && styles.selectorPillActive]}
            onPress={() => setCustomerEditorOpen((open) => !open)}
            disabled={loading || !!customerDraft.id}
          >
            <Text style={styles.selectorText}>
              {customerDraft.id ? `Editing ${customerDraft.name || customerDraft.id}` : "Add new CRM account / lead"}
            </Text>
            <Text style={styles.dropdownChevron}>{customerEditorOpen || customerDraft.id ? "▲" : "▼"}</Text>
          </Pressable>
          {(customerEditorOpen || !!customerDraft.id) && (
            <>
              {customerFields.map((field) => (
                <View key={field.key} style={styles.field}>
                  <Text style={styles.label}>{field.label}</Text>
                  <TextInput
                    style={[styles.input, field.multiline && styles.textarea]}
                    value={String(customerDraft[field.key] || "")}
                    onChangeText={(value) => setCustomerDraft((draft) => ({ ...draft, [field.key]: value }))}
                    keyboardType={field.keyboard || "default"}
                    multiline={field.multiline}
                  />
                </View>
              ))}
              {!!customerDraft.id && (
                <View style={styles.inlineRecordEditor}>
                  <View style={styles.inlineActions}>
                    <Pressable
                      style={styles.smallButton}
                      onPress={() => {
                        openSiteVisitForCustomer(customerDraft as Customer);
                      }}
                      disabled={loading}
                    >
                      <Text style={styles.smallButtonText}>Add site report</Text>
                    </Pressable>
                  </View>
                </View>
              )}
              <Pressable style={styles.primaryButton} onPress={() => saveCustomer()} disabled={loading}>
                <Text style={styles.primaryButtonText}>{customerDraft.id ? "Update customer" : "Save customer"}</Text>
              </Pressable>
              {!!customerDraft.id && (
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => {
                    setCustomerDraft(emptyCustomer);
                    setCustomerEditorOpen(false);
                    setSiteVisitEditorOpen(false);
                  }}
                  disabled={loading}
                >
                  <Text style={styles.secondaryButtonText}>Cancel edit</Text>
                </Pressable>
              )}
            </>
          )}
        </View>

        <View style={styles.formCard}>
          <Text style={styles.cardLabel}>Sales enquiry intake</Text>
          <Text style={styles.muted}>New enquiries are captured in CRM using the same fields as the enquiry report.</Text>
          <Pressable
            style={[styles.dropdownButton, (salesInquiryEditorOpen || !!salesInquiryDraft.id) && styles.selectorPillActive]}
            onPress={() => setSalesInquiryEditorOpen((open) => !open)}
            disabled={loading || !!salesInquiryDraft.id}
          >
            <Text style={styles.selectorText}>
              {salesInquiryDraft.id ? `Editing ${salesInquiryDraft.customer || salesInquiryDraft.enquiry_no || salesInquiryDraft.id}` : "Add new sales enquiry"}
            </Text>
            <Text style={styles.dropdownChevron}>{salesInquiryEditorOpen || salesInquiryDraft.id ? "▲" : "▼"}</Text>
          </Pressable>
          {(salesInquiryEditorOpen || !!salesInquiryDraft.id) && (
            <>
          <View style={styles.formGrid}>
            <View style={styles.field}>
              <Text style={styles.label}>System customer ID</Text>
              <TextInput style={styles.input} value={salesInquiryDraft.customer_id} editable={false} placeholder="Auto-generated" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Enquiry no</Text>
              <TextInput style={styles.input} value={salesInquiryDraft.enquiry_no} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, enquiry_no: value }))} placeholder="Auto if blank" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Lead / customer name</Text>
              <TextInput style={styles.input} value={salesInquiryDraft.customer} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, customer: value }))} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Lead status</Text>
              <TextInput style={styles.input} value={salesInquiryDraft.lead_status} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, lead_status: value }))} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Lead type</Text>
              <TextInput style={styles.input} value={salesInquiryDraft.lead_type} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, lead_type: value }))} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Phone</Text>
              <TextInput style={styles.input} value={salesInquiryDraft.phone} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, phone: value }))} keyboardType="phone-pad" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Full address</Text>
              <TextInput style={[styles.input, styles.textarea]} value={salesInquiryDraft.address} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, address: value }))} multiline />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>WhatsApp</Text>
              <TextInput style={styles.input} value={salesInquiryDraft.whatsapp_no} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, whatsapp_no: value }))} keyboardType="phone-pad" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Quantity</Text>
              <TextInput style={styles.input} value={salesInquiryDraft.qty} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, qty: value }))} keyboardType="numeric" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Created date</Text>
              <TextInput style={styles.input} value={salesInquiryDraft.received_date} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, received_date: value }))} placeholder="YYYY-MM-DD" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Referral by</Text>
              <TextInput style={styles.input} value={salesInquiryDraft.referral_by} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, referral_by: value }))} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Assigned to</Text>
              <TextInput style={styles.input} value={salesInquiryDraft.assigned_to} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, assigned_to: value }))} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Follow-up channel</Text>
              <TextInput style={styles.input} value={salesInquiryDraft.followup_channel} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, followup_channel: value }))} placeholder="WhatsApp / Call / Email" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Auto follow-up every days</Text>
              <TextInput style={styles.input} value={salesInquiryDraft.followup_frequency_days} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, followup_frequency_days: value }))} keyboardType="numeric" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Next follow-up</Text>
              <TextInput style={styles.input} value={salesInquiryDraft.next_followup} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, next_followup: value }))} placeholder="YYYY-MM-DD" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Follow-up status</Text>
              <TextInput style={styles.input} value={salesInquiryDraft.followup_status} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, followup_status: value }))} placeholder="Open / Scheduled / Closed" />
            </View>
          </View>
          <View style={styles.inlineActions}>
            {[3, 7, 14, 30].map((days) => (
              <Pressable key={`draft-followup-${days}`} style={styles.smallButton} onPress={() => setSalesInquiryDraft((draft) => ({ ...draft, next_followup: datePlusDays(days), followup_frequency_days: String(days), followup_status: "Scheduled" }))}>
                <Text style={styles.smallButtonText}>Every {days}d</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Enquiry remark</Text>
            <TextInput style={[styles.input, styles.textarea]} value={salesInquiryDraft.enquiry_remark} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, enquiry_remark: value }))} multiline />
          </View>
          <Pressable style={styles.primaryButton} onPress={saveSalesInquiry} disabled={loading || !salesInquiryDraft.customer.trim()}>
            <Text style={styles.primaryButtonText}>{salesInquiryDraft.id ? "Update enquiry record" : "Save enquiry intake"}</Text>
          </Pressable>
          {!!salesInquiryDraft.id && (
            <Pressable
              style={styles.secondaryButton}
              onPress={() => {
                setSalesInquiryDraft(emptySalesInquiryDraft);
                setSalesInquiryEditorOpen(false);
              }}
              disabled={loading}
            >
              <Text style={styles.secondaryButtonText}>Cancel enquiry edit</Text>
            </Pressable>
          )}
            </>
          )}
        </View>

        <Text style={styles.sectionTitle}>Pipeline & Search</Text>
        <View style={styles.formCard}>
          <TextInput
            style={styles.input}
            value={crmSearch}
            onChangeText={setCrmSearch}
            placeholder="Search name, phone, GSTIN, owner, site, notes"
          />
          <View style={styles.inlineActions}>
            {stages.map((stage) => (
              <Pressable key={stage} style={[styles.smallButton, crmStageFilter === stage && styles.selectorPillActive]} onPress={() => setCrmStageFilter(stage)}>
                <Text style={styles.smallButtonText}>{stage}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Follow-up Queue</Text>
        <View style={styles.formCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>{dueFollowUps.length} due today or overdue</Text>
            <Text style={styles.statusPill}>Auto follow-up</Text>
          </View>
          {!dueFollowUps.length && <Text style={styles.muted}>No due follow-ups. Scheduled records will appear here on their next follow-up date.</Text>}
          {dueFollowUps.slice(0, 12).map((item, index) => {
            const id = recordIdentity(item) || String(item.enquiry_no || item.id || index);
            return (
              <View key={`followup-${id}-${index}`} style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>{String(item.customer || item.lead_name || item.name || "-")}</Text>
                  <Text style={styles.statusPill}>{String(item.followup_status || "Open")}</Text>
                </View>
                <Text style={styles.muted}>Due: {followupDate(item) || "-"} - Channel: {String(item.followup_channel || "WhatsApp")} - Owner: {String(item.assigned_to || item.account_owner || "-")}</Text>
                <Text style={styles.bodyText}>Phone: {String(item.phone || item.whatsapp_no || "-")} - Every {followupFrequency(item)} days</Text>
                <View style={styles.inlineActions}>
                  <Pressable style={styles.smallButton} onPress={() => markFollowedUp(item)} disabled={loading}>
                    <Text style={styles.smallButtonText}>Mark followed up</Text>
                  </Pressable>
                  {[3, 7, 14, 30].map((days) => (
                    <Pressable key={`queue-${id}-${days}`} style={styles.smallButton} onPress={() => scheduleFollowUp(item, days)} disabled={loading}>
                      <Text style={styles.smallButtonText}>+{days}d</Text>
                    </Pressable>
                  ))}
                  <Pressable style={styles.smallButton} onPress={() => updateSalesInquiry(item, { followup_status: "Closed" })} disabled={loading}>
                    <Text style={styles.smallButtonText}>Close follow-up</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>CRM Customer Records</Text>
        <View style={styles.paginationBar}>
          <Text style={styles.muted}>Showing {crmRows.length ? (safeCrmPage - 1) * crmPageSize + 1 : 0}-{Math.min(safeCrmPage * crmPageSize, crmRows.length)} of {crmRows.length}</Text>
          <View style={styles.inlineActions}>
            <Pressable style={styles.smallButton} onPress={() => setEnquiryPage((page) => Math.max(1, page - 1))} disabled={safeCrmPage <= 1}>
              <Text style={styles.smallButtonText}>Previous</Text>
            </Pressable>
            <Text style={styles.muted}>Page {safeCrmPage} / {crmPageCount}</Text>
            <Pressable style={styles.smallButton} onPress={() => setEnquiryPage((page) => Math.min(crmPageCount, page + 1))} disabled={safeCrmPage >= crmPageCount}>
              <Text style={styles.smallButtonText}>Next</Text>
            </Pressable>
          </View>
        </View>
        {pagedCrmRows.map((row, index) => {
          if (row.type === "customer") {
            const customer = row.customer;
            const customerEstimates = estimatesForCustomer(customer, offers);
            const latestEstimate = customerEstimates[0];
            const costingStatus = latestEstimate ? String(latestEstimate.status || latestEstimate.lead_status || "Costing") : "No costing";
            const existingSiteVisit = (data?.site_visits || []).find((visit) => String(visit.customer_id || "") === String(customer.id || ""));
            return (
              <View key={`customer-${customer.id}`} style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>{customer.name}</Text>
                  <Text style={styles.statusPill}>{costingStatus}</Text>
                </View>
                <Text style={styles.muted}>{customer.id} - {customer.address || "No address"} - Pipeline: {customer.pipeline_stage || "Lead"}</Text>
                <Text style={styles.bodyText}>Offers: {customerEstimates.length}{latestEstimate ? ` - Latest ${String(latestEstimate.job_no || latestEstimate.id || "-")} - ${String(latestEstimate.offer_date || latestEstimate.created_at || "-")} - ${formatMoney(offerCostSummary(latestEstimate).totalCost)}` : ""}</Text>
                <Text style={styles.bodyText}>{customer.contact_person || "No contact"} - {customer.phone || "No mobile"} - {customer.email || "No email"}</Text>
                <Text style={styles.bodyText}>Owner: {customer.account_owner || "-"} - Source: {customer.lead_source || "-"} - Channel: {customer.preferred_channel || "-"}</Text>
                <View style={styles.inlineActions}>
                  <Pressable style={styles.smallButton} onPress={() => editCustomer(customer)} disabled={loading}>
                    <Text style={styles.smallButtonText}>Edit</Text>
                  </Pressable>
                  <Pressable style={styles.smallButton} onPress={() => grantCustomerAccess(customer)} disabled={loading}>
                    <Text style={styles.smallButtonText}>Grant portal access</Text>
                  </Pressable>
                  <Pressable
                    style={styles.smallButton}
                    onPress={() => openCostingForCustomer(customer)}
                    disabled={loading}
                  >
                    <Text style={styles.smallButtonText}>Create offer</Text>
                  </Pressable>
                  <Pressable
                    style={styles.smallButton}
                    onPress={() => openSiteVisitForCustomer(customer)}
                    disabled={loading}
                  >
                    <Text style={styles.smallButtonText}>{existingSiteVisit ? "Edit site visit" : "Start site visit"}</Text>
                  </Pressable>
                  {isAdmin && (
                    <Pressable style={styles.dangerButton} onPress={() => deleteCustomer(customer)} disabled={loading}>
                      <Text style={styles.dangerButtonText}>Remove</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          }
          const item = row.inquiry;
          const id = recordIdentity(item) || String(item.enquiry_no || `${safeCrmPage}-${index}`);
          const status = String(item.status || item.lead_status || "New");
          const isEditing = salesInquiryDraft.id === id;
          const linkedEstimates = estimatesForInquiry(item, offers);
          const latestEstimate = linkedEstimates[0];
          const costingStatus = latestEstimate ? String(latestEstimate.status || latestEstimate.lead_status || "Costing") : "No costing";
          const inquiryCustomerId = String(item.customer_id || item.id || item.enquiry_no || "");
          const inquiryEnquiryNo = String(item.enquiry_no || item.source_enquiry_no || "");
          const existingSiteVisit = (data?.site_visits || []).find((visit) => {
            const sameCustomer = String(visit.customer_id || "") === inquiryCustomerId;
            const sameEnquiry = inquiryEnquiryNo && String(visit.site_enquiry_no || "") === inquiryEnquiryNo;
            return sameCustomer && (!String(visit.site_enquiry_no || "") || sameEnquiry);
          }) || (data?.site_visits || []).find((visit) => String(visit.customer_id || "") === inquiryCustomerId);
          return (
            <View key={`${id}-${index}`} style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardTitleBlock}>
                  <Text style={styles.cardTitle}>{String(item.customer || item.lead_name || item.name || "-")}</Text>
                  <Text style={styles.muted}>Customer ID: {String(item.customer_id || "-")} - {String(item.enquiry_no || item.source_enquiry_no || id)} - {String(item.lead_type || item.leadtype || "New")} - Qty {String(item.qty || 1)}</Text>
                </View>
                <Text style={[styles.statusPill, { color: salesInquiryStatusTone(status) }]}>{status}</Text>
              </View>
              {isEditing ? (
                <View style={styles.inlineRecordEditor}>
                  <View style={styles.formGrid}>
                    <View style={styles.field}>
                      <Text style={styles.label}>System customer ID</Text>
                      <TextInput style={styles.input} value={salesInquiryDraft.customer_id} editable={false} placeholder="Auto-generated" />
                    </View>
                    <View style={styles.field}>
                      <Text style={styles.label}>Lead / customer name</Text>
                      <TextInput style={styles.input} value={salesInquiryDraft.customer} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, customer: value }))} />
                    </View>
                    <View style={styles.field}>
                      <Text style={styles.label}>Lead status</Text>
                      <View style={styles.statusSelectorPanel}>
                        <View style={styles.sectionHeaderRow}>
                          <Text style={[styles.statusPill, { color: salesInquiryStatusTone(salesInquiryDraft.lead_status) }]}>{salesInquiryDraft.lead_status}</Text>
                        </View>
                        <View style={styles.statusChoiceGrid}>
                          {inquiryLifecycleStatuses.map((statusOption) => (
                            <Pressable
                              key={`edit-${id}-${statusOption}`}
                              style={[styles.statusChoice, salesInquiryDraft.lead_status === statusOption && styles.statusChoiceActive]}
                              onPress={() => setSalesInquiryDraft((draft) => ({
                                ...draft,
                                lead_status: statusOption,
                                ...(isLostInquiryStatus(statusOption) ? {} : { lost_reason: "" }),
                              }))}
                              disabled={loading}
                            >
                              <Text style={[styles.statusChoiceText, salesInquiryDraft.lead_status === statusOption && styles.statusChoiceTextActive]}>{statusOption}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    </View>
                    {isLostInquiryStatus(salesInquiryDraft.lead_status) ? (
                      <View style={styles.field}>
                        <Text style={styles.label}>Lost reason required</Text>
                        <TextInput
                          style={[styles.input, styles.textarea]}
                          value={salesInquiryDraft.lost_reason}
                          onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, lost_reason: value }))}
                          multiline
                          placeholder="Why was this enquiry/order/site visit/offer lost?"
                        />
                      </View>
                    ) : null}
                    <View style={styles.field}>
                      <Text style={styles.label}>Lead type</Text>
                      <TextInput style={styles.input} value={salesInquiryDraft.lead_type} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, lead_type: value }))} />
                    </View>
                    <View style={styles.field}>
                      <Text style={styles.label}>Phone</Text>
                      <TextInput style={styles.input} value={salesInquiryDraft.phone} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, phone: value }))} keyboardType="phone-pad" />
                    </View>
                    <View style={styles.field}>
                      <Text style={styles.label}>Full address</Text>
                      <TextInput style={[styles.input, styles.textarea]} value={salesInquiryDraft.address} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, address: value }))} multiline />
                    </View>
                    <View style={styles.field}>
                      <Text style={styles.label}>WhatsApp</Text>
                      <TextInput style={styles.input} value={salesInquiryDraft.whatsapp_no} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, whatsapp_no: value }))} keyboardType="phone-pad" />
                    </View>
                    <View style={styles.field}>
                      <Text style={styles.label}>Next follow-up</Text>
                      <TextInput style={styles.input} value={salesInquiryDraft.next_followup} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, next_followup: value }))} placeholder="YYYY-MM-DD" />
                    </View>
                    <View style={styles.field}>
                      <Text style={styles.label}>Follow-up channel</Text>
                      <TextInput style={styles.input} value={salesInquiryDraft.followup_channel} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, followup_channel: value }))} />
                    </View>
                    <View style={styles.field}>
                      <Text style={styles.label}>Auto follow-up every days</Text>
                      <TextInput style={styles.input} value={salesInquiryDraft.followup_frequency_days} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, followup_frequency_days: value }))} keyboardType="numeric" />
                    </View>
                    <View style={styles.field}>
                      <Text style={styles.label}>Follow-up status</Text>
                      <TextInput style={styles.input} value={salesInquiryDraft.followup_status} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, followup_status: value }))} />
                    </View>
                  </View>
                  <View style={styles.inlineActions}>
                    {[3, 7, 14, 30].map((days) => (
                      <Pressable key={`edit-followup-${days}`} style={styles.smallButton} onPress={() => setSalesInquiryDraft((draft) => ({ ...draft, next_followup: datePlusDays(days), followup_frequency_days: String(days), followup_status: "Scheduled" }))}>
                        <Text style={styles.smallButtonText}>Every {days}d</Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>Enquiry remark</Text>
                    <TextInput style={[styles.input, styles.textarea]} value={salesInquiryDraft.enquiry_remark} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, enquiry_remark: value }))} multiline />
                  </View>
                  <View style={styles.inlineActions}>
                    <Pressable
                      style={styles.smallButton}
                      onPress={() => {
                        setSiteVisitDraft({ ...emptySiteVisit, customer_id: salesInquiryDraft.customer_id, site_enquiry_no: salesInquiryDraft.enquiry_no });
                        setSiteVisitEditorOpen(true);
                      }}
                      disabled={loading || !salesInquiryDraft.customer_id}
                    >
                      <Text style={styles.smallButtonText}>Add site report</Text>
                    </Pressable>
                  </View>
                  <View style={styles.inlineActions}>
                    <Pressable style={styles.primaryButtonInline} onPress={saveSalesInquiry} disabled={loading || !salesInquiryDraft.customer.trim()}>
                      <Text style={styles.primaryButtonText}>Save changes</Text>
                    </Pressable>
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={() => {
                        setSalesInquiryDraft(emptySalesInquiryDraft);
                        setSiteVisitEditorOpen(false);
                      }}
                      disabled={loading}
                    >
                      <Text style={styles.secondaryButtonText}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <>
                  <Text style={styles.bodyText}>Phone: {String(item.phone || "-")} - WhatsApp: {String(item.whatsapp_no || "-")} - Created: {String(item.received_date || item.createddate || "-")}</Text>
                  <Text style={styles.bodyText}>Address: {String(item.address || item.site_address || item.site || "-")}</Text>
                  <Text style={styles.bodyText}>Referral: {String(item.referral_by || "-")} - Created by: {String(item.createdbyname || "-")} - Last modified by: {String(item.lastmodifiedbyname || "-")}</Text>
                  <Text style={styles.bodyText}>Follow-up: {followupDate(item) || "-"} - {String(item.followup_channel || "WhatsApp")} - Every {followupFrequency(item)}d - {String(item.followup_status || "Open")}</Text>
              <Text style={styles.bodyText}>Offer: {latestEstimate ? `${String(latestEstimate.job_no || latestEstimate.id || "-")} - ${String(latestEstimate.offer_type || latestEstimate.elevator_type || "-")} - ${String(latestEstimate.offer_date || latestEstimate.created_at || "-")} - ${formatMoney(offerCostSummary(latestEstimate).totalCost)}` : "No offer yet"}</Text>
                  {isLostInquiryStatus(status) && !!(item.lost_reason || item.status_lost_reason) ? <Text style={styles.muted}>Lost reason: {String(item.lost_reason || item.status_lost_reason)}</Text> : null}
                  {!!(item.requirement || item.enquiry_remark || item.notes) && <Text style={styles.muted}>{String(item.requirement || item.enquiry_remark || item.notes)}</Text>}
                  <View style={styles.inlineActions}>
                    <Pressable style={styles.smallButton} onPress={() => editSalesInquiry(item)} disabled={loading}>
                      <Text style={styles.smallButtonText}>Edit</Text>
                    </Pressable>
                    <Pressable style={styles.smallButton} onPress={() => markFollowedUp(item)} disabled={loading}>
                      <Text style={styles.smallButtonText}>Followed up</Text>
                    </Pressable>
                    <Pressable style={styles.smallButton} onPress={() => openSiteVisitForInquiry(item)} disabled={loading}>
                      <Text style={styles.smallButtonText}>{existingSiteVisit ? "Edit site visit" : "Site Visit"}</Text>
                    </Pressable>
                    <Pressable style={styles.smallButton} onPress={() => openCostingForInquiry(item)} disabled={loading}>
                    <Text style={styles.smallButtonText}>Create offer</Text>
                    </Pressable>
                    <Pressable
                      style={styles.smallButton}
                      onPress={() => openSiteVisitForInquiry(item)}
                      disabled={loading}
                    >
                      <Text style={styles.smallButtonText}>{existingSiteVisit ? "Edit site visit" : "Start site visit"}</Text>
                    </Pressable>
                    {isAdmin && (
                      <Pressable style={styles.dangerButton} onPress={() => deleteSalesInquiry(item)} disabled={loading}>
                        <Text style={styles.dangerButtonText}>Remove</Text>
                      </Pressable>
                    )}
                  </View>
                </>
              )}
            </View>
          );
        })}
        <Modal visible={costingEditorOpen} transparent animationType="fade" onRequestClose={() => setCostingEditorOpen(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.cardLabel}>Offer Manager</Text>
                  <Text style={styles.muted}>Customer ID: {offerDraft.customer_id || "-"}</Text>
                </View>
                <Pressable style={styles.secondaryButton} onPress={() => setCostingEditorOpen(false)} disabled={loading}>
                  <Text style={styles.secondaryButtonText}>Close</Text>
                </Pressable>
              </View>
              <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
                <View style={styles.formGrid}>
                  <View style={styles.field}>
                    <Text style={styles.label}>Customer ID</Text>
                    <TextInput style={styles.input} value={offerDraft.customer_id} editable={false} placeholder="Select from CRM row" />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>Offer / job no</Text>
                    <TextInput style={styles.input} value={offerDraft.job_no} onChangeText={(value) => setOfferDraft((draft) => ({ ...draft, job_no: value }))} placeholder="Auto if blank" />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>Offer date</Text>
                    <TextInput style={styles.input} value={offerDraft.offer_date} onChangeText={(value) => setOfferDraft((draft) => ({ ...draft, offer_date: value }))} placeholder="YYYY-MM-DD" />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>Customer name</Text>
                    <TextInput style={styles.input} value={offerDraft.customer_name} onChangeText={(value) => setOfferDraft((draft) => ({ ...draft, customer_name: value, offer_name: value }))} />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>Offer type</Text>
                    <TextInput style={styles.input} value={offerDraft.offer_type} onChangeText={(value) => setOfferDraft((draft) => ({ ...draft, offer_type: value }))} />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>Offer status</Text>
                    <TextInput style={styles.input} value={offerDraft.lead_status} onChangeText={(value) => setOfferDraft((draft) => ({ ...draft, lead_status: value }))} />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>Client offer value</Text>
                    <TextInput style={styles.input} value={offerDraft.total_cost} onChangeText={(value) => setOfferDraft((draft) => ({ ...draft, total_cost: value }))} keyboardType="numeric" />
                  </View>
                  {[
                    ["elevator_type", "Elevator type"],
                    ["stops", "Stops / floors"],
                    ["capacity", "Capacity"],
                    ["speed", "Speed"],
                    ["drive_type", "Drive type"],
                    ["door_type", "Door type"],
                    ["finish", "Cabin / finish"],
                    ["material_cost", "Internal material cost"],
                    ["install_cost", "Internal install cost"],
                    ["overhead_cost", "Internal overhead"],
                    ["margin_percent", "Margin percent"],
                    ["discount", "Discount"],
                    ["gst_percent", "GST percent"],
                    ["offer_valid_until", "Offer valid until"],
                  ].map(([key, label]) => (
                    <View key={`offer-field-${key}`} style={styles.field}>
                      <Text style={styles.label}>{label}</Text>
                      <TextInput
                        style={styles.input}
                        value={String(offerDraft[key] || "")}
                        onChangeText={(value) => setOfferDraft((draft) => ({ ...draft, [key]: value }))}
                        keyboardType={["material_cost", "install_cost", "overhead_cost", "margin_percent", "discount", "gst_percent"].includes(key) ? "numeric" : "default"}
                      />
                    </View>
                  ))}
                </View>
                <View style={styles.linkedSystemsPanel}>
                  <Text style={styles.cardLabel}>Client offer preview</Text>
                  <Text style={styles.metricValue}>{formatMoney(offerCostSummary(offerDraft).totalCost)}</Text>
                  <Text style={styles.muted}>Base {formatMoney(offerCostSummary(offerDraft).baseCost)} + margin {offerCostSummary(offerDraft).marginPercent}% + GST {offerCostSummary(offerDraft).gstPercent}% after discount.</Text>
                </View>
                <View style={styles.formGrid}>
                  <View style={styles.field}>
                    <Text style={styles.label}>Payment terms</Text>
                    <TextInput style={[styles.input, styles.textarea]} value={offerDraft.payment_terms} onChangeText={(value) => setOfferDraft((draft) => ({ ...draft, payment_terms: value }))} multiline />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>Delivery timeline</Text>
                    <TextInput style={[styles.input, styles.textarea]} value={offerDraft.delivery_timeline} onChangeText={(value) => setOfferDraft((draft) => ({ ...draft, delivery_timeline: value }))} multiline />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>Warranty terms</Text>
                    <TextInput style={[styles.input, styles.textarea]} value={offerDraft.warranty_terms} onChangeText={(value) => setOfferDraft((draft) => ({ ...draft, warranty_terms: value }))} multiline />
                  </View>
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Internal costing notes</Text>
                  <TextInput style={[styles.input, styles.textarea]} value={offerDraft.notes} onChangeText={(value) => setOfferDraft((draft) => ({ ...draft, notes: value }))} multiline />
                </View>
                <View style={styles.costingSourcePanel}>
                  <View style={styles.sectionHeaderRow}>
                    <View>
                      <Text style={styles.sectionTitle}>Complete .xlsx costing data</Text>
                      <Text style={styles.muted}>All extracted source values are shown step by step as normal app data. This is not an upload/import control.</Text>
                    </View>
                    <Pressable style={styles.smallButton} onPress={loadCostingSourceData} disabled={loading || costingSourcesLoading}>
                      <Text style={styles.smallButtonText}>{costingSourcesLoading ? "Loading..." : "Refresh source data"}</Text>
                    </Pressable>
                  </View>
                  {selectedCostingSource ? (
                    <>
                      <View style={styles.costingStepper}>
                        <Pressable
                          style={styles.smallButton}
                          onPress={() => setCostingSourceIndex((index) => Math.max(0, index - 1))}
                          disabled={costingSourceIndex <= 0}
                        >
                          <Text style={styles.smallButtonText}>Previous source</Text>
                        </Pressable>
                        <View style={styles.costingStepMeta}>
                          <Text style={styles.cardTitle}>{selectedCostingSource.source_file}</Text>
                          <Text style={styles.muted}>
                            Source {costingSourceIndex + 1} of {costingSources.length} - {selectedCostingSource.variant} - {selectedCostingSource.non_empty_cell_count} values
                          </Text>
                        </View>
                        <Pressable
                          style={styles.smallButton}
                          onPress={() => setCostingSourceIndex((index) => Math.min(costingSources.length - 1, index + 1))}
                          disabled={costingSourceIndex >= costingSources.length - 1}
                        >
                          <Text style={styles.smallButtonText}>Next source</Text>
                        </Pressable>
                      </View>
                      <View style={styles.costingStepper}>
                        <Pressable
                          style={styles.smallButton}
                          onPress={() => setCostingCellStep((step) => Math.max(0, step - 1))}
                          disabled={costingCellStep <= 0}
                        >
                          <Text style={styles.smallButtonText}>Previous data step</Text>
                        </Pressable>
                        <Text style={styles.statusPill}>Data step {Math.min(costingCellStep + 1, Math.max(costingCellChunks.length, 1))} of {Math.max(costingCellChunks.length, 1)}</Text>
                        <Pressable
                          style={styles.smallButton}
                          onPress={() => setCostingCellStep((step) => Math.min(costingCellChunks.length - 1, step + 1))}
                          disabled={costingCellStep >= costingCellChunks.length - 1}
                        >
                          <Text style={styles.smallButtonText}>Next data step</Text>
                        </Pressable>
                        <Pressable style={styles.primaryButtonInline} onPress={attachSelectedCostingSource} disabled={loading}>
                          <Text style={styles.primaryButtonText}>Attach all source data</Text>
                        </Pressable>
                      </View>
                      <View style={styles.costingCellList}>
                        {visibleCostingCells.map((cell, index) => (
                          <View key={`${selectedCostingSource.source_file}-${cell.sheet}-${cell.cell}-${index}`} style={styles.costingCellRow}>
                            <Text style={styles.costingCellRef}>{cell.sheet}!{cell.cell}</Text>
                            <Text style={styles.costingCellValue}>{String(cell.value ?? "")}</Text>
                            {cell.formula ? <Text style={styles.costingCellFormula}>Formula: {cell.formula}</Text> : null}
                          </View>
                        ))}
                      </View>
                      <Text style={styles.muted}>
                        Attached source: {offerDraft.costing_source_file || "none yet"}. Saving will store the selected source's complete extracted data with this costing.
                      </Text>
                    </>
                  ) : (
                    <View style={styles.emptyState}>
                      <Text style={styles.muted}>{costingSourcesLoading ? "Loading source values..." : "No costing source data loaded yet."}</Text>
                    </View>
                  )}
                </View>
              </ScrollView>
              <View style={styles.modalActions}>
                <Pressable style={styles.secondaryButton} onPress={() => setCostingEditorOpen(false)} disabled={loading}>
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.primaryButtonInline} onPress={saveOffer} disabled={loading || !offerDraft.customer_name.trim()}>
                  <Text style={styles.primaryButtonText}>Save offer</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={siteVisitEditorOpen} transparent animationType="fade" onRequestClose={() => setSiteVisitEditorOpen(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.cardLabel}>{siteVisitDraft.id ? "Edit site visit report" : "Create site visit report"}</Text>
                  <Text style={styles.muted}>Customer ID: {String(siteVisitDraft.customer_id || "-")}</Text>
                </View>
                <Pressable style={styles.secondaryButton} onPress={() => setSiteVisitEditorOpen(false)} disabled={loading}>
                  <Text style={styles.secondaryButtonText}>Close</Text>
                </Pressable>
              </View>
              <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
                <View style={styles.field}>
                  <Text style={styles.label}>Assigned customer ID</Text>
                  <TextInput
                    style={styles.input}
                    value={String(siteVisitDraft.customer_id || "")}
                    editable={false}
                    placeholder="Select a CRM customer"
                  />
                </View>
                <View style={styles.formGrid}>
                  {siteVisitFields.map((field) => (
                    <View key={`site-modal-${String(field.key)}`} style={styles.field}>
                      <Text style={styles.label}>{field.label}</Text>
                      <TextInput
                        style={[styles.input, field.multiline && styles.textarea]}
                        value={String(siteVisitDraft[field.key] || "")}
                        onChangeText={(value) => updateSiteVisitField(field.key, value)}
                        keyboardType={field.keyboard || "default"}
                        multiline={field.multiline}
                      />
                    </View>
                  ))}
                </View>
                <View style={styles.openingSchedulePanel}>
                  <View style={styles.sectionHeaderRow}>
                    <View>
                      <Text style={styles.sectionTitle}>Opening size by floor</Text>
                      <Text style={styles.muted}>Enter each opening after setting stops/openings. Floor, FF height, and lintel height are saved with this site report.</Text>
                    </View>
                    <Text style={styles.statusPill}>{ensureOpeningSchedule(siteVisitDraft, desiredOpeningCount(siteVisitDraft)).length} openings</Text>
                  </View>
                  {ensureOpeningSchedule(siteVisitDraft, desiredOpeningCount(siteVisitDraft)).length ? (
                    ensureOpeningSchedule(siteVisitDraft, desiredOpeningCount(siteVisitDraft)).map((row, index) => (
                      <View key={`opening-schedule-${index}`} style={styles.openingScheduleRow}>
                        <View style={styles.openingScheduleField}>
                          <Text style={styles.label}>Floor</Text>
                          <TextInput style={styles.input} value={row.floor} onChangeText={(value) => updateOpeningScheduleRow(index, "floor", value)} />
                        </View>
                        <View style={styles.openingScheduleField}>
                          <Text style={styles.label}>FF height mm</Text>
                          <TextInput style={styles.input} value={row.ff_height_mm} onChangeText={(value) => updateOpeningScheduleRow(index, "ff_height_mm", value)} keyboardType="numeric" />
                        </View>
                        <View style={styles.openingScheduleField}>
                          <Text style={styles.label}>Lintel height mm</Text>
                          <TextInput style={styles.input} value={row.lintel_height_mm} onChangeText={(value) => updateOpeningScheduleRow(index, "lintel_height_mm", value)} keyboardType="numeric" />
                        </View>
                      </View>
                    ))
                  ) : (
                    <View style={styles.emptyState}>
                      <Text style={styles.muted}>Enter how many stops or openings to create floor opening rows.</Text>
                    </View>
                  )}
                </View>
              </ScrollView>
              <View style={styles.modalActions}>
                <Pressable style={styles.secondaryButton} onPress={() => setSiteVisitEditorOpen(false)} disabled={loading}>
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.primaryButtonInline} onPress={saveSiteVisit} disabled={loading || !siteVisitDraft.customer_id}>
                  <Text style={styles.primaryButtonText}>{siteVisitDraft.id ? "Update site visit report" : "Save site visit report"}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Text style={styles.sectionTitle}>Saved Site Visits</Text>
        {(data?.site_visits || []).map((visit) => {
          const linkedCustomer = crmCustomerForSiteVisit(visit as Record<string, unknown>);
          return (
            <View key={visit.id} style={styles.card}>
              <Text style={styles.cardTitle}>{visit.id} - {linkedCustomer?.name || visit.customer_name || visit.customer_id}</Text>
              <Text style={styles.muted}>{visit.customer_id} - {linkedCustomer?.address || visit.address || "CRM customer address not set"}</Text>
              {!linkedCustomer && <Text style={styles.statusPill}>Needs CRM customer link</Text>}
              <Text style={styles.bodyText}>Site contact: {visit.site_person_name || linkedCustomer?.name || "Not set"} - {visit.site_person_mobile || linkedCustomer?.phone || "No mobile"}</Text>
              <Text style={styles.bodyText}>Pit {visit.pit_size_mm || "-"} mm - Machine room {visit.machine_room_available || "N"}</Text>
              <Text style={styles.bodyText}>Offer {visit.site_offer_type || "-"} - Stops {visit.site_stops || "-"}</Text>
              {Array.isArray(visit.opening_schedule) && visit.opening_schedule.length ? (
                <Text style={styles.muted}>
                  Openings: {visit.opening_schedule.map((row) => `${row.floor || "-"} FF ${row.ff_height_mm || "-"} / Lintel ${row.lintel_height_mm || "-"}`).join("; ")}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    );
  }

  function renderSiteVisitReportsPage() {
    const customerOptions = crmCustomerOptions();
    const query = siteVisitCustomerSearch.trim().toLowerCase();
    const matchingCustomers = customerOptions.filter((customer) => (
      !query || `${customer.id} ${customer.name} ${customer.phone} ${customer.source_inquiry_id}`.toLowerCase().includes(query)
    ));
    const siteVisits = [...(data?.site_visits || [])].sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")));
    const myName = String(data?.viewer?.display_name || username || "");
    const myUsername = String(data?.viewer?.username || username || "");
    const myVisits = siteVisits.filter((visit) => (
      String(visit.submitted_by_username || visit.updated_by_username || "").toLowerCase() === myUsername.toLowerCase()
      || String(visit.visited_by || "").toLowerCase() === myName.toLowerCase()
    ));
    return (
      <View>
        <View style={styles.moduleHero}>
          <Text style={styles.eyebrow}>Field Site Visit</Text>
          <Text style={styles.moduleHeroTitle}>Site Visit Notes</Text>
          <Text style={styles.moduleHeroText}>Staff can record site visit details against a CRM customer. Admin sees these same saved reports in the portal.</Text>
        </View>

        <View style={styles.metricGrid}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Saved reports</Text>
            <Text style={styles.metricValue}>{siteVisits.length}</Text>
            <Text style={styles.muted}>All site visit notes saved in CRM.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>My visits</Text>
            <Text style={styles.metricValue}>{myVisits.length}</Text>
            <Text style={styles.muted}>Submitted or updated by this login.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>CRM choices</Text>
            <Text style={styles.metricValue}>{customerOptions.length}</Text>
            <Text style={styles.muted}>Customers and enquiries available for linking.</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardLabel}>Add / update site visit notes</Text>
              <Text style={styles.cardTitle}>Select CRM customer</Text>
            </View>
            <Text style={styles.statusPill}>{matchingCustomers.length} matches</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Search customer</Text>
            <TextInput
              style={styles.input}
              value={siteVisitCustomerSearch}
              onChangeText={setSiteVisitCustomerSearch}
              placeholder="Customer name, number, phone, enquiry"
            />
          </View>
          <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
            {matchingCustomers.slice(0, 60).map((customer) => {
              const existing = siteVisits.find((visit) => String(visit.customer_id || "") === customer.id);
              return (
                <Pressable key={`site-visit-customer-${customer.id}`} style={styles.dropdownOption} onPress={() => openSiteVisitForCrmOption(customer)} disabled={loading}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.cardTitleBlock}>
                      <Text style={styles.selectorText}>{customer.id} - {customer.name}</Text>
                      <Text style={styles.muted}>Phone: {customer.phone || "-"}{customer.source_inquiry_id ? ` - Enquiry: ${customer.source_inquiry_id}` : ""}</Text>
                    </View>
                    <Text style={styles.statusPill}>{existing ? "Edit notes" : "Start visit"}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          {!matchingCustomers.length && (
            <View style={styles.emptyState}>
              <Text style={styles.muted}>No CRM customers found for that search.</Text>
            </View>
          )}
        </View>

        {renderSiteVisitEditorModal()}

        <Text style={styles.sectionTitle}>Saved Site Visits</Text>
        {siteVisits.map((visit) => {
          const linkedCustomer = crmCustomerForSiteVisit(visit);
          return (
          <View key={visit.id} style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardTitleBlock}>
                <Text style={styles.cardTitle}>{visit.id} - {linkedCustomer?.name || visit.customer_name || visit.customer_id}</Text>
                <Text style={styles.muted}>{visit.customer_id} - {linkedCustomer?.address || visit.address || "CRM customer address not set"}</Text>
              </View>
              <Text style={styles.statusPill}>{visit.site_visit_date || "No date"}</Text>
            </View>
            {!linkedCustomer && <Text style={styles.statusPill}>Needs CRM customer link</Text>}
            <Text style={styles.bodyText}>Staff: {visit.visited_by || visit.submitted_by || "Not set"}{visit.submitted_by_department ? ` - ${visit.submitted_by_department}` : ""}</Text>
            <Text style={styles.bodyText}>Site contact: {visit.site_person_name || linkedCustomer?.name || "Not set"} - {visit.site_person_mobile || linkedCustomer?.phone || "No mobile"}</Text>
            <Text style={styles.bodyText}>Pit {visit.pit_size_mm || "-"} mm - Machine room {visit.machine_room_available || "N"} - Stops {visit.site_stops || "-"}</Text>
            {Array.isArray(visit.opening_schedule) && visit.opening_schedule.length ? (
              <Text style={styles.muted}>
                Openings: {visit.opening_schedule.map((row) => `${row.floor || "-"} FF ${row.ff_height_mm || "-"} / Lintel ${row.lintel_height_mm || "-"}`).join("; ")}
              </Text>
            ) : null}
            {!!visit.notes && <Text style={styles.bodyText}>{visit.notes}</Text>}
            <View style={styles.inlineActions}>
              <Pressable style={styles.smallButton} onPress={() => openSiteVisitForCrmOption({ id: String(visit.customer_id || ""), name: String(linkedCustomer?.name || visit.customer_name || visit.customer_id || ""), phone: String(linkedCustomer?.phone || visit.site_person_mobile || ""), address: String(linkedCustomer?.address || visit.address || ""), source_inquiry_id: String(visit.site_enquiry_no || linkedCustomer?.source_inquiry_id || "") })} disabled={loading || !linkedCustomer}>
                <Text style={styles.smallButtonText}>Edit notes</Text>
              </Pressable>
            </View>
          </View>
          );
        })}
        {!siteVisits.length && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No site visits saved</Text>
            <Text style={styles.muted}>Select a CRM customer above to submit the first site visit notes.</Text>
          </View>
        )}
      </View>
    );
  }

  function renderAccountsPage() {
    const users = asRecords(data?.users);
    const org = asRecords(data?.org_chart);
    const heads = org.filter((person) => /head|supervisor|manager|director|ceo/i.test(`${person.title || ""} ${person.name || ""}`));
    const isAdmin = data?.viewer?.role === "admin";
    return (
      <View>
        <View style={styles.moduleHero}>
          <Text style={styles.eyebrow}>Admin</Text>
          <Text style={styles.moduleHeroTitle}>Team Accounts & Access</Text>
          <Text style={styles.moduleHeroText}>Create department logins, change usernames and passwords when staff changes, activate or deactivate accounts, and keep supervisor access scoped to the tools they need.</Text>
        </View>

        {!isAdmin && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Admin access required</Text>
            <Text style={styles.muted}>Only admin users can change usernames, passwords, and account access.</Text>
          </View>
        )}

        {isAdmin && (
          <View style={styles.formCard}>
            <Text style={styles.cardLabel}>{accountDraft.id ? "Edit account" : "Create account"}</Text>
            <Text style={styles.muted}>All staff portal accounts use the shared portal password. Usernames remain unique and clickable for account editing.</Text>
            {[
              ["username", "Username"],
              ["display_name", "Display name"],
              ["department", "Department"],
              ["role", "Role"],
              ["password", "New password"],
              ["active", "Active Y/N"],
            ].map(([key, label]) => (
              <View key={key} style={styles.field}>
                <Text style={styles.label}>{label}</Text>
                <TextInput
                  style={styles.input}
                  value={String(accountDraft[key as keyof typeof accountDraft] || "")}
                  onChangeText={(value) => setAccountDraft((draft) => ({ ...draft, [key]: value }))}
                  secureTextEntry={key === "password"}
                  autoCapitalize="none"
                />
              </View>
            ))}
            <View style={styles.inlineActions}>
              <Pressable style={styles.primaryButton} onPress={saveAccount} disabled={loading || !accountDraft.username}>
                <Text style={styles.primaryButtonText}>{accountDraft.id ? "Update account" : "Create account"}</Text>
              </Pressable>
              <Pressable style={styles.smallButton} onPress={() => setAccountDraft(emptyAccountDraft)} disabled={loading}>
                <Text style={styles.smallButtonText}>Clear</Text>
              </Pressable>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Org Supervisors</Text>
        {heads.map((person) => {
          const linked = users.find((user) => String(user.linked_org_node || "") === String(person.id) || String(user.display_name || "").toLowerCase() === String(person.name || "").toLowerCase());
          return (
            <View key={String(person.id)} style={styles.card}>
              <Text style={styles.cardTitle}>{fieldText(person, ["name"])}</Text>
              <Text style={styles.muted}>{fieldText(person, ["title"])} - {fieldText(person, ["department"])}</Text>
              <Text style={styles.bodyText}>Login: {linked ? `${fieldText(linked, ["username"])} (${fieldText(linked, ["role"])})` : "Missing"}</Text>
              {isAdmin && !linked && (
                <Pressable
                  style={styles.smallButton}
                  onPress={() => setAccountDraft({
                    id: "",
                    username: String(person.name || "").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, ""),
                    display_name: String(person.name || ""),
                    department: String(person.department || ""),
                    role: String(person.department || "").toLowerCase() === "executive office" ? "admin" : "manager",
                    password: sharedPortalPassword,
                    active: "Y",
                  })}
                >
                  <Text style={styles.smallButtonText}>Prepare login</Text>
                </Pressable>
              )}
            </View>
          );
        })}

        <Text style={styles.sectionTitle}>User Accounts</Text>
        {users.map((user) => (
          <View key={String(user.id || user.username)} style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>{fieldText(user, ["display_name", "username"])}</Text>
              <Text style={styles.statusPill}>{String(user.active) === "false" ? "Inactive" : "Active"}</Text>
            </View>
            <View style={styles.inlineMeta}>
              <Pressable onPress={() => isAdmin && editAccount(user)} disabled={!isAdmin || loading}>
                <Text style={styles.clickableUsername}>{fieldText(user, ["username"])}</Text>
              </Pressable>
              <Text style={styles.muted}>- {fieldText(user, ["department"])} - {fieldText(user, ["role"])}</Text>
            </View>
            <Text style={styles.bodyText}>Linked org node: {fieldText(user, ["linked_org_node", "linked_team_member"])}</Text>
            <Text style={styles.bodyText}>Password change required: {String(user.must_change_password || false)}</Text>
            {isAdmin && (
              <View style={styles.inlineActions}>
                <Pressable style={styles.smallButton} onPress={() => editAccount(user)} disabled={loading}>
                  <Text style={styles.smallButtonText}>Edit</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => updateAccount(String(user.id), { password: sharedPortalPassword })} disabled={loading}>
                  <Text style={styles.smallButtonText}>Reset shared password</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => updateAccount(String(user.id), { active: String(user.active) === "false" ? true : false })} disabled={loading}>
                  <Text style={styles.smallButtonText}>{String(user.active) === "false" ? "Activate" : "Deactivate"}</Text>
                </Pressable>
              </View>
            )}
          </View>
        ))}
      </View>
    );
  }

  function renderRenewalsPage() {
    const renewals = asRecords(data?.renewals);
    const openRenewals = renewals.filter((item) => !["closed", "renewed", "lost"].includes(String(item.status || "").toLowerCase()));
    const highValue = renewals.filter((item) => String(item.value || "").toLowerCase() === "high");
    return (
      <View>
        <View style={styles.moduleHero}>
          <Text style={styles.eyebrow}>Maintenance Renewals</Text>
          <Text style={styles.moduleHeroTitle}>Customer-Linked Renewal Pipeline</Text>
          <Text style={styles.moduleHeroText}>Track AMC and maintenance renewals only against saved customer accounts so follow-ups, quotes, and service history stay connected.</Text>
        </View>
        <View style={styles.metricGrid}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Open renewals</Text>
            <Text style={styles.metricValue}>{openRenewals.length}</Text>
            <Text style={styles.muted}>Active maintenance renewal opportunities.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>High value</Text>
            <Text style={styles.metricValue}>{highValue.length}</Text>
            <Text style={styles.muted}>Priority customer renewal follow-ups.</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.cardLabel}>New maintenance renewal</Text>
          <Text style={styles.label}>Select customer</Text>
          {!data?.customers.length && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Add a customer first</Text>
              <Text style={styles.muted}>Maintenance renewals must be linked to a saved customer ID before they can be created.</Text>
              <View style={styles.inlineActions}>
                <Pressable style={styles.smallButton} onPress={() => setActiveTab("customers")}>
                  <Text style={styles.smallButtonText}>Open Customer CRM</Text>
                </Pressable>
              </View>
            </View>
          )}
          {!!data?.customers.length && (
            <View style={styles.selectorList}>
              {data.customers.map((customer) => (
                <Pressable
                  key={customer.id}
                  style={[styles.selectorPill, renewalDraft.customer_id === customer.id && styles.selectorPillActive]}
                  onPress={() => setRenewalDraft((draft) => ({ ...draft, customer_id: customer.id, customer: customer.name, contact_email: customer.email || draft.contact_email }))}
                >
                  <Text style={[styles.selectorText, renewalDraft.customer_id === customer.id && styles.selectorTextActive]}>
                    {customer.id} - {customer.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          {[
            ["renewal_date", "Renewal date YYYY-MM-DD"],
            ["days", "Days remaining"],
            ["value", "Value priority"],
            ["contact_email", "Contact email"],
            ["notes", "Notes"],
          ].map(([key, label]) => (
            <View key={key} style={styles.field}>
              <Text style={styles.label}>{label}</Text>
              <TextInput
                style={[styles.input, key === "notes" && styles.textarea]}
                value={String(renewalDraft[key as keyof typeof renewalDraft] || "")}
                onChangeText={(value) => setRenewalDraft((draft) => ({ ...draft, [key]: value }))}
                multiline={key === "notes"}
              />
            </View>
          ))}
          <Pressable style={styles.primaryButton} onPress={saveRenewal} disabled={loading || !renewalDraft.customer_id}>
            <Text style={styles.primaryButtonText}>Save renewal</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Renewal Records</Text>
        {renewals.map((item, index) => {
          const id = recordIdentity(item) || String(item.id || `REN-LEGACY-${index + 1}`);
          return (
            <View key={id} style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>{fieldText(item, ["customer", "building", "name"])}</Text>
                <Text style={styles.statusPill}>{fieldText(item, ["value", "status"])}</Text>
              </View>
              <Text style={styles.muted}>Customer ID: {fieldText(item, ["customer_id"])} - Renewal: {fieldText(item, ["renewal_date", "date"])} - Days: {fieldText(item, ["days"])}</Text>
              <Text style={styles.bodyText}>Contact: {fieldText(item, ["contact_email"])} - Contacted: {String(item.contacted || false)}</Text>
              <Text style={styles.bodyText}>{fieldText(item, ["notes", "last_draft"])}</Text>
              <View style={styles.inlineActions}>
                <Pressable style={styles.smallButton} onPress={() => updateRenewal(id, { contacted: true, status: "Contacted" })} disabled={loading}>
                  <Text style={styles.smallButtonText}>Mark contacted</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => updateRenewal(id, { status: "Renewed" })} disabled={loading}>
                  <Text style={styles.smallButtonText}>Renewed</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => updateRenewal(id, { status: "Lost" })} disabled={loading}>
                  <Text style={styles.smallButtonText}>Lost</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  function internationalVendorCost(draft: Record<string, unknown>) {
    const parse = (value: unknown, fallback = 0) => {
      const parsed = Number(String(value || "").replace(/[^0-9.-]/g, ""));
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    const fuziCost = parse(draft.fuzi_cost);
    const installCost = parse(draft.install_cost);
    const packageCount = Math.max(1, parse(draft.package_count, 1));
    const lengthCm = parse(draft.length_cm);
    const widthCm = parse(draft.width_cm);
    const heightCm = parse(draft.height_cm);
    const actualWeightKg = parse(draft.actual_weight_kg);
    const freightRate = parse(draft.freight_rate);
    const cbm = lengthCm && widthCm && heightCm ? (lengthCm * widthCm * heightCm * packageCount) / 1000000 : 0;
    const volumetricWeightKg = lengthCm && widthCm && heightCm ? (lengthCm * widthCm * heightCm * packageCount) / 5000 : 0;
    const mode = String(draft.freight_mode || "Ocean LCL");
    const chargeableWeightKg = mode.toLowerCase().includes("ocean")
      ? Math.max(cbm, actualWeightKg / 1000)
      : Math.max(actualWeightKg, volumetricWeightKg);
    const calculatedFreightCost = freightRate ? Math.round(chargeableWeightKg * freightRate) : 0;
    const shippingCost = parse(draft.shipping_cost, calculatedFreightCost);
    const brokerFee = parse(draft.broker_fee);
    const portFee = parse(draft.port_fee);
    const dutyPercent = parse(draft.customs_duty_percent);
    const importTaxPercent = parse(draft.import_tax_percent);
    const insurancePercent = parse(draft.insurance_percent, 1);
    const partnerPercent = parse(draft.partner_percent, 2);
    const kitBaseCost = Math.max(0, fuziCost - installCost);
    const customsDuty = Math.round((kitBaseCost * dutyPercent) / 100);
    const importTax = Math.round(((kitBaseCost + shippingCost + customsDuty) * importTaxPercent) / 100);
    const insuranceCost = Math.round((kitBaseCost * insurancePercent) / 100);
    const landedCost = kitBaseCost + shippingCost + customsDuty + importTax + brokerFee + portFee + insuranceCost;
    const partnerFee = Math.round((landedCost * partnerPercent) / 100);
    const vendorCost = landedCost + partnerFee;
    const recommendation = actualWeightKg <= 70 && cbm <= 0.5
      ? "Small smart parts: quote courier/air using chargeable kg."
      : cbm >= 15 || actualWeightKg >= 8000
        ? "Heavy kits: ask forwarder for FCL ocean quote."
        : "Palletized kits/parts: quote ocean LCL by W/M, compare air only if urgent.";
    return { fuziCost, installCost, packageCount, cbm, actualWeightKg, volumetricWeightKg, chargeableWeightKg, freightRate, calculatedFreightCost, shippingCost, brokerFee, portFee, customsDuty, importTax, insuranceCost, partnerPercent, kitBaseCost, landedCost, partnerFee, vendorCost, recommendation };
  }

  function internationalVendorEmailText(record: Record<string, unknown>) {
    const company = String(record.company || "there").trim();
    const stage = String(record.followup_stage || record.pipeline_stage || "1. Catalog intro").toLowerCase();
    const tenderTitle = String(record.tender_title || record.closest_tender_title || "").trim();
    const tenderArea = String(record.tender_area || record.closest_tender_region || record.region || "your area").trim();
    const tenderDeadline = String(record.tender_deadline || record.closest_tender_deadline || "").trim();
    const tenderRef = String(record.tender_ref || record.closest_tender_ref || "").trim();
    const cost = internationalVendorCost(record);
    if (stage.includes("tender") || stage.includes("bid") || stage.includes("meeting") || stage.includes("draft")) {
      const tenderLine = tenderTitle
        ? `We noticed ${tenderTitle} in ${tenderArea}${tenderDeadline ? ` with a deadline of ${tenderDeadline}` : ""}${tenderRef ? `, ref ${tenderRef}` : ""}.`
        : `We noticed an elevator tender/opportunity near ${tenderArea}.`;
      return `Hello ${company}, a friend mentioned they had used your service, so we wanted to set a short meeting. ${tenderLine} Your company could bid locally while FUZI supplies manufactured elevator parts and kits at a competitive landed cost; our current estimate is ${formatMoney(cost.vendorCost)} before final freight/customs confirmation. Would you be open to a call to discuss partnering on this contract?`;
    }
    if (stage.includes("sample") || stage.includes("smart")) {
      return `Hello ${company}, FUZI can also supply smaller smart elevator parts, controller accessories, and sample kits internationally. We can quote courier/air freight by chargeable kg and share a small-parts catalog for quick evaluation.`;
    }
    if (stage.includes("cost")) {
      return `Hello ${company}, we prepared a landed-cost estimate for FUZI manufactured elevator parts/kits. The current calculated vendor cost is ${formatMoney(cost.vendorCost)}, including freight/import assumptions and the local partner fee. Please confirm destination, dimensions, and preferred Incoterm so we can firm up the quote.`;
    }
    return `Hello ${company}, FUZI manufactures elevator parts and lift kits internationally. We are looking for USA and Canada elevator companies that can install locally while FUZI supplies manufactured parts and kits. Please reply if you would like our catalog, landed-cost sheet, and partnership terms.`;
  }

  function renderInternationalVendorPage() {
    const vendors = asRecords(data?.international_vendors);
    const query = internationalVendorSearch.trim().toLowerCase();
    const visibleVendors = vendors.filter((item) => !query || JSON.stringify(item).toLowerCase().includes(query));
    const activeVendors = vendors.filter((item) => !String(item.status || "").toLowerCase().includes("lost"));
    const tenderPartners = vendors.filter((item) => String(item.followup_stage || "").toLowerCase().includes("tender") || String(item.tender_source || "").trim());
    const sentVendors = vendors.filter((item) => String(item.last_outreach_at || item.delivery_status || "").trim());
    const shippedVendors = vendors.filter((item) => ["shipped", "delivered", "partner active"].includes(String(item.pipeline_stage || item.shipment_status || "").toLowerCase()));
    const draftCost = internationalVendorCost(internationalVendorDraft);
    if (!isAdmin) {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Admin only</Text>
          <Text style={styles.muted}>International Vendor is available only in the admin portal.</Text>
        </View>
      );
    }
    return (
      <View>
        <View style={styles.moduleHero}>
          <Text style={styles.eyebrow}>International Vendor</Text>
          <Text style={styles.moduleHeroTitle}>USA & Canada Partner Sales System</Text>
          <Text style={styles.moduleHeroText}>Track elevator companies that can buy FUZI manufactured parts/kits, calculate landed partner cost, manage bids, and hand outreach to OpenClaw/email.</Text>
        </View>

        <View style={styles.metricGrid}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Prospects</Text>
            <Text style={styles.metricValue}>{vendors.length}</Text>
            <Text style={styles.muted}>USA/Canada elevator-company targets.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Active pipeline</Text>
            <Text style={styles.metricValue}>{activeVendors.length}</Text>
            <Text style={styles.muted}>Not marked lost or inactive.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Tender partners</Text>
            <Text style={styles.metricValue}>{tenderPartners.length}</Text>
            <Text style={styles.muted}>Companies linked to bid/tender opportunities.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Outreach sent</Text>
            <Text style={styles.metricValue}>{sentVendors.length}</Text>
            <Text style={styles.muted}>Records touched by OpenClaw/email handoff.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Shipping pipeline</Text>
            <Text style={styles.metricValue}>{shippedVendors.length}</Text>
            <Text style={styles.muted}>Shipped, delivered, or active partner accounts.</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.cardLabel}>FUZI international vendor sales plan</Text>
          <Text style={styles.bodyText}>1. Match each elevator company to the closest Canada/USA tender by province, region, or national scope.</Text>
          <Text style={styles.bodyText}>2. Ask OpenClaw to draft the first email with the friend-referral opener, nearest tender, meeting request, and FUZI manufactured-parts partnership offer.</Text>
          <Text style={styles.bodyText}>3. Follow up with catalog, landed-cost sheet, bid support pricing, sample/smart-parts quote, then meeting reminder.</Text>
          <Text style={styles.bodyText}>4. Move interested companies to bid partnership, PO request, production, freight, shipped, delivered, and partner active.</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.cardLabel}>New USA/Canada vendor prospect</Text>
          <View style={styles.formGrid}>
            {[
              ["company", "Company name"],
              ["country", "Country"],
              ["region", "State / province"],
              ["website", "Website"],
              ["email", "Email"],
              ["phone", "Phone"],
              ["contact_name", "Contact name"],
              ["product_interest", "Parts / kit interest"],
            ].map(([key, label]) => (
              <View key={`ivendor-${key}`} style={styles.field}>
                <Text style={styles.label}>{label}</Text>
                <TextInput
                  style={styles.input}
                  value={String(internationalVendorDraft[key as keyof typeof internationalVendorDraft] || "")}
                  onChangeText={(value) => setInternationalVendorDraft((draft) => ({ ...draft, [key]: value }))}
                />
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Cost calculator</Text>
          <View style={styles.formGrid}>
            {[
              ["fuzi_cost", "FUZI total cost"],
              ["install_cost", "Install cost removed"],
              ["shipping_cost", "Override shipping cost"],
              ["partner_percent", "Canada/USA partner percent"],
              ["bid_value", "Bid / tender value"],
            ].map(([key, label]) => (
              <View key={`ivendor-cost-${key}`} style={styles.field}>
                <Text style={styles.label}>{label}</Text>
                <TextInput
                  style={styles.input}
                  value={String(internationalVendorDraft[key as keyof typeof internationalVendorDraft] || "")}
                  onChangeText={(value) => setInternationalVendorDraft((draft) => ({ ...draft, [key]: value }))}
                  keyboardType="numeric"
                />
              </View>
            ))}
          </View>
          <Text style={styles.sectionTitle}>Freight weight and import cost</Text>
          <View style={styles.formGrid}>
            {[
              ["freight_mode", "Freight mode"],
              ["destination_country", "Destination country"],
              ["destination_port", "Destination port / city"],
              ["package_count", "Packages / crates"],
              ["length_cm", "Length cm"],
              ["width_cm", "Width cm"],
              ["height_cm", "Height cm"],
              ["actual_weight_kg", "Actual weight kg"],
              ["freight_rate", "Rate per chargeable unit"],
              ["customs_duty_percent", "Duty percent"],
              ["import_tax_percent", "GST/HST/sales tax percent"],
              ["broker_fee", "Broker fee"],
              ["port_fee", "Port/CFS/delivery fee"],
              ["insurance_percent", "Insurance percent"],
            ].map(([key, label]) => (
              <View key={`ivendor-freight-${key}`} style={styles.field}>
                <Text style={styles.label}>{label}</Text>
                <TextInput
                  style={styles.input}
                  value={String(internationalVendorDraft[key as keyof typeof internationalVendorDraft] || "")}
                  onChangeText={(value) => setInternationalVendorDraft((draft) => ({ ...draft, [key]: value }))}
                  keyboardType={["package_count", "length_cm", "width_cm", "height_cm", "actual_weight_kg", "freight_rate", "customs_duty_percent", "import_tax_percent", "broker_fee", "port_fee", "insurance_percent"].includes(key) ? "numeric" : "default"}
                />
              </View>
            ))}
          </View>
          <View style={styles.inventoryStats}>
            <View style={styles.inventoryStat}>
              <Text style={styles.cardLabel}>Kit base</Text>
              <Text style={styles.inventoryValue}>{formatMoney(draftCost.kitBaseCost)}</Text>
            </View>
            <View style={styles.inventoryStat}>
              <Text style={styles.cardLabel}>CBM</Text>
              <Text style={styles.inventoryValue}>{draftCost.cbm.toFixed(2)}</Text>
            </View>
            <View style={styles.inventoryStat}>
              <Text style={styles.cardLabel}>Chargeable</Text>
              <Text style={styles.inventoryValue}>{draftCost.chargeableWeightKg.toFixed(1)}</Text>
            </View>
            <View style={styles.inventoryStat}>
              <Text style={styles.cardLabel}>Freight</Text>
              <Text style={styles.inventoryValue}>{formatMoney(draftCost.shippingCost)}</Text>
            </View>
            <View style={styles.inventoryStat}>
              <Text style={styles.cardLabel}>Landed</Text>
              <Text style={styles.inventoryValue}>{formatMoney(draftCost.landedCost)}</Text>
            </View>
            <View style={styles.inventoryStat}>
              <Text style={styles.cardLabel}>Partner 2%</Text>
              <Text style={styles.inventoryValue}>{formatMoney(draftCost.partnerFee)}</Text>
            </View>
            <View style={styles.inventoryStat}>
              <Text style={styles.cardLabel}>Vendor cost</Text>
              <Text style={styles.inventoryValue}>{formatMoney(draftCost.vendorCost)}</Text>
            </View>
          </View>
          <View style={styles.linkedSystemsPanel}>
            <Text style={styles.cardLabel}>Freight recommendation</Text>
            <Text style={styles.muted}>{draftCost.recommendation}</Text>
            <Text style={styles.muted}>Ocean LCL uses CBM vs metric ton chargeable units. Air/courier uses actual kg vs volumetric kg using L x W x H / 5000.</Text>
          </View>

          <View style={styles.formGrid}>
            {[
              ["tender_area", "Tender area"],
              ["tender_source", "Tender / bid source"],
              ["tender_title", "Closest tender title"],
              ["tender_deadline", "Tender deadline"],
              ["tender_ref", "Tender ref"],
              ["friend_referral_note", "Friend referral note"],
              ["status", "Status"],
              ["followup_stage", "Follow-up stage"],
              ["pipeline_stage", "Pipeline stage"],
              ["incoterm", "Incoterm"],
              ["export_docs_status", "Export docs status"],
              ["production_status", "Production status"],
              ["shipment_status", "Shipment status"],
              ["tracking_ref", "Tracking / BL / AWB ref"],
              ["next_followup", "Next follow-up"],
              ["openclaw_target", "OpenClaw/email target"],
            ].map(([key, label]) => (
              <View key={`ivendor-followup-${key}`} style={styles.field}>
                <Text style={styles.label}>{label}</Text>
                <TextInput
                  style={styles.input}
                  value={String(internationalVendorDraft[key as keyof typeof internationalVendorDraft] || "")}
                  onChangeText={(value) => setInternationalVendorDraft((draft) => ({ ...draft, [key]: value }))}
                />
              </View>
            ))}
          </View>
          <View style={styles.inlineActions}>
            {["1. Catalog intro", "2. Tender partner pitch", "3. Cost sheet follow-up", "4. Meeting requested", "5. Bid support follow-up"].map((stage) => (
              <Pressable key={stage} style={styles.smallButton} onPress={() => setInternationalVendorDraft((draft) => ({ ...draft, followup_stage: stage }))}>
                <Text style={styles.smallButtonText}>{stage}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.statusSelectorPanel}>
            <Text style={styles.cardLabel}>Pipeline stage</Text>
            <View style={styles.statusChoiceGrid}>
              {internationalVendorPipelineStages.map((stage) => (
                <Pressable
                  key={`ivendor-stage-${stage}`}
                  style={[styles.statusChoice, internationalVendorDraft.pipeline_stage === stage && styles.statusChoiceActive]}
                  onPress={() => setInternationalVendorDraft((draft) => ({ ...draft, pipeline_stage: stage, status: stage === "Lost" ? "Lost" : draft.status }))}
                >
                  <Text style={[styles.statusChoiceText, internationalVendorDraft.pipeline_stage === stage && styles.statusChoiceTextActive]}>{stage}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Notes / missing ideas</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={internationalVendorDraft.notes}
              onChangeText={(value) => setInternationalVendorDraft((draft) => ({ ...draft, notes: value }))}
              placeholder="Add certifications, catalog sent, local code requirements, insurance, dealer margin, exclusivity, or territory notes"
              multiline
            />
          </View>
          <View style={styles.linkedSystemsPanel}>
            <Text style={styles.cardLabel}>Email sequence preview</Text>
            <Text style={styles.muted}>{internationalVendorEmailText(internationalVendorDraft)}</Text>
          </View>
          <Pressable style={styles.primaryButton} onPress={saveInternationalVendor} disabled={loading || !internationalVendorDraft.company.trim()}>
            <Text style={styles.primaryButtonText}>Save international vendor</Text>
          </Pressable>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.cardLabel}>Find vendors and bids</Text>
          <TextInput
            style={styles.input}
            value={internationalVendorSearch}
            onChangeText={setInternationalVendorSearch}
            placeholder="Search company, country, region, tender, email, status"
          />
        </View>

        <Text style={styles.sectionTitle}>International Vendor Pipeline</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={Platform.OS === "web"} contentContainerStyle={styles.kanbanBoard}>
          {internationalVendorPipelineStages.filter((stage) => stage !== "Lost").map((stage) => {
            const stageRecords = visibleVendors.filter((vendor) => String(vendor.pipeline_stage || vendor.status || "Lead identified").toLowerCase() === stage.toLowerCase());
            return (
              <View key={`ivendor-column-${stage}`} style={styles.kanbanColumn}>
                <View style={styles.kanbanColumnHeader}>
                  <Text style={styles.cardTitle}>{stage}</Text>
                  <Text style={styles.statusPill}>{stageRecords.length}</Text>
                </View>
                {!stageRecords.length && (
                  <View style={styles.kanbanEmpty}>
                    <Text style={styles.muted}>No partners here.</Text>
                  </View>
                )}
                {stageRecords.slice(0, 8).map((vendor, index) => {
                  const id = recordIdentity(vendor) || String(vendor.id || index);
                  const stageIndex = internationalVendorPipelineStages.indexOf(stage);
                  const nextStage = internationalVendorPipelineStages[Math.min(stageIndex + 1, internationalVendorPipelineStages.length - 2)];
                  return (
                    <View key={`ivendor-kanban-${id}`} style={styles.kanbanCard}>
                      <Text style={styles.cardTitle}>{fieldText(vendor, ["company", "name", "id"])}</Text>
                      <Text style={styles.muted}>{fieldText(vendor, ["country"])} - {fieldText(vendor, ["region"])} - {fieldText(vendor, ["email"])}</Text>
                      <Text style={styles.bodyText}>Tender: {fieldText(vendor, ["tender_title", "closest_tender_title", "tender_area"])}</Text>
                      <Text style={styles.bodyText}>Freight: {fieldText(vendor, ["freight_mode"])} - {fieldText(vendor, ["shipment_status"])}</Text>
                      <View style={styles.inlineActions}>
                        <Pressable style={styles.smallButton} onPress={() => updateInternationalVendor(vendor, { pipeline_stage: nextStage, status: nextStage })} disabled={loading || !recordIdentity(vendor)}>
                          <Text style={styles.smallButtonText}>Move next</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
        {!visibleVendors.length && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No vendors yet</Text>
            <Text style={styles.muted}>Add Canadian and USA elevator companies, then use OpenClaw/email to run the catalog and tender-partner follow-up sequence.</Text>
          </View>
        )}
        {visibleVendors.map((vendor, index) => {
          const id = recordIdentity(vendor) || String(vendor.id || index);
          const cost = internationalVendorCost(vendor);
          return (
            <View key={`ivendor-card-${id}`} style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardTitleBlock}>
                  <Text style={styles.cardTitle}>{fieldText(vendor, ["company", "name", "id"])}</Text>
                  <Text style={styles.muted}>{fieldText(vendor, ["country"])} - {fieldText(vendor, ["region"])} - {fieldText(vendor, ["email"])}</Text>
                </View>
                <Text style={styles.statusPill}>{fieldText(vendor, ["status", "followup_stage"])}</Text>
              </View>
              <View style={styles.inventoryStats}>
                <View style={styles.inventoryStat}>
                  <Text style={styles.cardLabel}>Vendor cost</Text>
                  <Text style={styles.inventoryValue}>{formatMoney(cost.vendorCost)}</Text>
                </View>
                <View style={styles.inventoryStat}>
                  <Text style={styles.cardLabel}>CBM</Text>
                  <Text style={styles.inventoryValue}>{cost.cbm.toFixed(2)}</Text>
                </View>
                <View style={styles.inventoryStat}>
                  <Text style={styles.cardLabel}>Chargeable</Text>
                  <Text style={styles.inventoryValue}>{cost.chargeableWeightKg.toFixed(1)}</Text>
                </View>
                <View style={styles.inventoryStat}>
                  <Text style={styles.cardLabel}>Partner fee</Text>
                  <Text style={styles.inventoryValue}>{formatMoney(cost.partnerFee)}</Text>
                </View>
                <View style={styles.inventoryStat}>
                  <Text style={styles.cardLabel}>Bid value</Text>
                  <Text style={styles.inventoryValue}>{formatMoney(Number(vendor.bid_value || 0))}</Text>
                </View>
              </View>
              <Text style={styles.bodyText}>Freight: {fieldText(vendor, ["freight_mode"])} to {fieldText(vendor, ["destination_country"])} {fieldText(vendor, ["destination_port"])} - {cost.recommendation}</Text>
              <Text style={styles.bodyText}>Tender: {fieldText(vendor, ["tender_title", "closest_tender_title"])} - {fieldText(vendor, ["tender_area", "closest_tender_region"])} - Deadline {fieldText(vendor, ["tender_deadline", "closest_tender_deadline"])} - Ref {fieldText(vendor, ["tender_ref", "closest_tender_ref"])}</Text>
              <Text style={styles.bodyText}>OpenClaw plan: {fieldText(vendor, ["openclaw_email_plan", "outreach_sequence"])}</Text>
              <Text style={styles.bodyText}>Referral opener: {fieldText(vendor, ["friend_referral_note"])}</Text>
              <Text style={styles.bodyText}>Pipeline: {fieldText(vendor, ["pipeline_stage"])} - Docs: {fieldText(vendor, ["export_docs_status"])} - Production: {fieldText(vendor, ["production_status"])} - Shipment: {fieldText(vendor, ["shipment_status"])} {vendor.tracking_ref ? `- ${String(vendor.tracking_ref)}` : ""}</Text>
              <Text style={styles.bodyText}>Interest: {fieldText(vendor, ["product_interest"])} - Contact: {fieldText(vendor, ["contact_name", "phone"])}</Text>
              <Text style={styles.muted}>{String(vendor.email_template || internationalVendorEmailText(vendor))}</Text>
              {!!vendor.delivery_status && <Text style={styles.bodyText}>Delivery: {String(vendor.delivery_status)} - {String(vendor.last_outreach_at || "-")}</Text>}
              <View style={styles.inlineActions}>
                <Pressable style={styles.smallButton} onPress={() => sendInternationalVendorOutreach(vendor, "1. Catalog intro")} disabled={loading || !recordIdentity(vendor)}>
                  <Text style={styles.smallButtonText}>Send catalog intro</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => sendInternationalVendorOutreach(vendor, "2. Tender partner pitch")} disabled={loading || !recordIdentity(vendor)}>
                  <Text style={styles.smallButtonText}>Tender pitch</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => sendInternationalVendorOutreach(vendor, "OpenClaw email drafted")} disabled={loading || !recordIdentity(vendor)}>
                  <Text style={styles.smallButtonText}>OpenClaw draft</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => sendInternationalVendorOutreach(vendor, "4. Meeting requested")} disabled={loading || !recordIdentity(vendor)}>
                  <Text style={styles.smallButtonText}>Meeting email</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => sendInternationalVendorOutreach(vendor, "5. Bid support follow-up")} disabled={loading || !recordIdentity(vendor)}>
                  <Text style={styles.smallButtonText}>Bid follow-up</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => updateInternationalVendor(vendor, { status: "Replied", followup_stage: "3. Cost sheet follow-up" })} disabled={loading || !recordIdentity(vendor)}>
                  <Text style={styles.smallButtonText}>Mark replied</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => updateInternationalVendor(vendor, { pipeline_stage: "Meeting booked", status: "Meeting booked", followup_stage: "Meeting booked" })} disabled={loading || !recordIdentity(vendor)}>
                  <Text style={styles.smallButtonText}>Meeting booked</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => updateInternationalVendor(vendor, { pipeline_stage: "PO requested", status: "PO requested" })} disabled={loading || !recordIdentity(vendor)}>
                  <Text style={styles.smallButtonText}>PO requested</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => updateInternationalVendor(vendor, { pipeline_stage: "Production planned", production_status: "Planned", status: "Production planned" })} disabled={loading || !recordIdentity(vendor)}>
                  <Text style={styles.smallButtonText}>Plan production</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => updateInternationalVendor(vendor, { pipeline_stage: "Export docs ready", export_docs_status: "Commercial invoice, packing list, COO/HS review ready", status: "Export docs ready" })} disabled={loading || !recordIdentity(vendor)}>
                  <Text style={styles.smallButtonText}>Docs ready</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => updateInternationalVendor(vendor, { pipeline_stage: "Freight booked", shipment_status: "Freight booked", status: "Freight booked" })} disabled={loading || !recordIdentity(vendor)}>
                  <Text style={styles.smallButtonText}>Book freight</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => updateInternationalVendor(vendor, { pipeline_stage: "Shipped", shipment_status: "Shipped", status: "Shipped" })} disabled={loading || !recordIdentity(vendor)}>
                  <Text style={styles.smallButtonText}>Shipped</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => updateInternationalVendor(vendor, { pipeline_stage: "Delivered", shipment_status: "Delivered", status: "Delivered" })} disabled={loading || !recordIdentity(vendor)}>
                  <Text style={styles.smallButtonText}>Delivered</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => updateInternationalVendor(vendor, { pipeline_stage: "Lost", status: "Lost" })} disabled={loading || !recordIdentity(vendor)}>
                  <Text style={styles.smallButtonText}>Lost</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => updateInternationalVendor(vendor, { pipeline_stage: "Partner active", status: "Partner active" })} disabled={loading || !recordIdentity(vendor)}>
                  <Text style={styles.smallButtonText}>Partner active</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  function renderInventoryPage() {
    const inventory = asRecords(data?.inventory);
    const offers = asRecords(data?.estimates);
    const query = inventorySearch.trim().toLowerCase();
    const visibleInventory = inventory.filter((item) => !query || JSON.stringify(item).toLowerCase().includes(query));
    const reorderItems = inventory.filter((item) => inventoryAvailable(item) <= inventoryQuantity(item, "reorder_point", inventoryQuantity(item, "min_stock")));
    const onOrderItems = inventory.filter((item) => inventoryDisplayStatus(item) === "On Order");
    const totalAvailable = inventory.reduce((sum, item) => sum + inventoryAvailable(item), 0);
    const customerReservedItems = inventory.filter((item) => String(item.customer_id || item.customer_name || item.offer_id || "").trim());
    const selectedOffer = offers.find((offer) => recordIdentity(offer) === inventoryDraft.offer_id);
    const offerOptions = offers.slice(0, 16);
    return (
      <View>
        <View style={styles.moduleHero}>
          <Text style={styles.eyebrow}>Warehouse Inventory</Text>
          <Text style={styles.moduleHeroTitle}>Customer-Linked Stock Control</Text>
          <Text style={styles.moduleHeroText}>Reserve parts against customer offers, track available stock, and raise purchase orders before committed material runs short.</Text>
        </View>

        <View style={styles.metricGrid}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Warehouse items</Text>
            <Text style={styles.metricValue}>{inventory.length}</Text>
            <Text style={styles.muted}>Parts and materials tracked in stock.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Reorder triggers</Text>
            <Text style={styles.metricValue}>{reorderItems.length}</Text>
            <Text style={styles.muted}>Items at or below available-stock trigger.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>On order</Text>
            <Text style={styles.metricValue}>{onOrderItems.length}</Text>
            <Text style={styles.muted}>Items with a purchase order raised.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Available units</Text>
            <Text style={styles.metricValue}>{totalAvailable}</Text>
            <Text style={styles.muted}>On hand minus reserved stock.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Customer reserved</Text>
            <Text style={styles.metricValue}>{customerReservedItems.length}</Text>
            <Text style={styles.muted}>Items tied to a customer offer or account.</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.cardLabel}>Add warehouse item</Text>
          <Text style={styles.label}>Link to customer offer</Text>
          {!offerOptions.length && (
            <View style={styles.emptyState}>
              <Text style={styles.muted}>Create a customer offer/costing first, then inventory can be reserved against that customer.</Text>
            </View>
          )}
          {!!offerOptions.length && (
            <View style={styles.selectorList}>
              {offerOptions.map((offer) => {
                const offerId = recordIdentity(offer);
                const customerName = String(offer.customer_name || offer.offer_name || offer.customer || "");
                return (
                  <Pressable
                    key={`inventory-offer-${offerId || customerName}`}
                    style={[styles.selectorPill, inventoryDraft.offer_id === offerId && styles.selectorPillActive]}
                    onPress={() => setInventoryDraft((draft) => ({
                      ...draft,
                      offer_id: offerId,
                      offer_name: String(offer.offer_name || offer.job_no || offerId),
                      customer_id: String(offer.customer_id || draft.customer_id || ""),
                      customer_name: customerName,
                      source_inquiry_id: String(offer.source_inquiry_id || ""),
                      reserved_for: customerName,
                    }))}
                  >
                    <Text style={[styles.selectorText, inventoryDraft.offer_id === offerId && styles.selectorTextActive]}>
                      {offerId || "Offer"} - {customerName || "Customer"} - {formatMoney(Number(offer.total_cost || 0))}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          {!!selectedOffer && (
            <View style={styles.linkedSystemsPanel}>
              <Text style={styles.cardLabel}>Selected offer</Text>
              <Text style={styles.muted}>
                {String(selectedOffer.customer_name || selectedOffer.offer_name || "-")} - {String(selectedOffer.offer_type || selectedOffer.elevator_type || "Offer")} - {formatMoney(Number(selectedOffer.total_cost || 0))}
              </Text>
            </View>
          )}
          <View style={styles.formGrid}>
            <View style={styles.field}>
              <Text style={styles.label}>Item name</Text>
              <TextInput style={styles.input} value={inventoryDraft.name} onChangeText={(value) => setInventoryDraft((draft) => ({ ...draft, name: value }))} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Category</Text>
              <TextInput style={styles.input} value={inventoryDraft.category} onChangeText={(value) => setInventoryDraft((draft) => ({ ...draft, category: value }))} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>On hand</Text>
              <TextInput style={styles.input} value={inventoryDraft.qty_on_hand} onChangeText={(value) => setInventoryDraft((draft) => ({ ...draft, qty_on_hand: value }))} keyboardType="numeric" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Reserved</Text>
              <TextInput style={styles.input} value={inventoryDraft.qty_reserved} onChangeText={(value) => setInventoryDraft((draft) => ({ ...draft, qty_reserved: value }))} keyboardType="numeric" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Reorder trigger</Text>
              <TextInput style={styles.input} value={inventoryDraft.reorder_point} onChangeText={(value) => setInventoryDraft((draft) => ({ ...draft, reorder_point: value }))} keyboardType="numeric" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Target stock</Text>
              <TextInput style={styles.input} value={inventoryDraft.target_stock} onChangeText={(value) => setInventoryDraft((draft) => ({ ...draft, target_stock: value }))} keyboardType="numeric" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Unit</Text>
              <TextInput style={styles.input} value={inventoryDraft.unit} onChangeText={(value) => setInventoryDraft((draft) => ({ ...draft, unit: value }))} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Vendor</Text>
              <TextInput style={styles.input} value={inventoryDraft.vendor} onChangeText={(value) => setInventoryDraft((draft) => ({ ...draft, vendor: value }))} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Lead time days</Text>
              <TextInput style={styles.input} value={inventoryDraft.lead_time_days} onChangeText={(value) => setInventoryDraft((draft) => ({ ...draft, lead_time_days: value }))} keyboardType="numeric" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Bin location</Text>
              <TextInput style={styles.input} value={inventoryDraft.bin_location} onChangeText={(value) => setInventoryDraft((draft) => ({ ...draft, bin_location: value }))} />
            </View>
          </View>
          <View style={styles.formGrid}>
            <View style={styles.field}>
              <Text style={styles.label}>Customer ID</Text>
              <TextInput style={styles.input} value={inventoryDraft.customer_id} onChangeText={(value) => setInventoryDraft((draft) => ({ ...draft, customer_id: value }))} placeholder="From selected offer" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Customer name</Text>
              <TextInput style={styles.input} value={inventoryDraft.customer_name} onChangeText={(value) => setInventoryDraft((draft) => ({ ...draft, customer_name: value, reserved_for: value }))} placeholder="From selected offer" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Offer ID</Text>
              <TextInput style={styles.input} value={inventoryDraft.offer_id} onChangeText={(value) => setInventoryDraft((draft) => ({ ...draft, offer_id: value }))} placeholder="Offer/costing record" />
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Notes</Text>
            <TextInput style={[styles.input, styles.textarea]} value={inventoryDraft.notes} onChangeText={(value) => setInventoryDraft((draft) => ({ ...draft, notes: value }))} multiline />
          </View>
          <Pressable style={styles.primaryButton} onPress={saveInventoryItem} disabled={loading || !inventoryDraft.name.trim()}>
            <Text style={styles.primaryButtonText}>Save warehouse item</Text>
          </Pressable>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.cardLabel}>Find stock</Text>
          <TextInput
            style={styles.input}
            value={inventorySearch}
            onChangeText={setInventorySearch}
            placeholder="Search item, customer, offer, vendor, bin, PO"
          />
        </View>

        <Text style={styles.sectionTitle}>Reorder Watchlist</Text>
        {!reorderItems.length && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>All reorder triggers are clear</Text>
            <Text style={styles.muted}>Available stock is above every configured reorder point.</Text>
          </View>
        )}
        {reorderItems.filter((item) => !query || JSON.stringify(item).toLowerCase().includes(query)).slice(0, 12).map((item, index) => renderInventoryCard(item, index, true))}

        <Text style={styles.sectionTitle}>Warehouse Stock</Text>
        {visibleInventory.slice(0, 80).map((item, index) => renderInventoryCard(item, index, false))}
      </View>
    );
  }

  function renderInventoryCard(item: Record<string, unknown>, index: number, compact: boolean) {
    const id = recordIdentity(item) || String(item.id || index);
    const onHand = inventoryQuantity(item, "qty_on_hand", inventoryQuantity(item, "stock"));
    const reserved = inventoryQuantity(item, "qty_reserved");
    const available = inventoryAvailable(item);
    const reorderPoint = inventoryQuantity(item, "reorder_point", inventoryQuantity(item, "min_stock"));
    const target = inventoryQuantity(item, "target_stock", Math.max(reorderPoint * 2, available));
    const reorderQty = inventoryReorderQty(item);
    const needsOrder = available <= reorderPoint;
    const edit = inventoryEdits[id] || { reorder_point: String(reorderPoint), target_stock: String(target) };
    const displayStatus = inventoryDisplayStatus(item);
    const linkedCustomer = String(item.customer_name || item.customer || item.reserved_for || "").trim();
    const linkedCustomerId = String(item.customer_id || "").trim();
    const linkedOffer = String(item.offer_id || item.estimate_id || item.offer_no || "").trim();
    return (
      <View key={`${id}-${compact ? "watch" : "stock"}`} style={[styles.card, needsOrder && styles.alertCard]}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardTitleBlock}>
            <Text style={styles.cardTitle}>{String(item.name || item.item || id)}</Text>
            <Text style={styles.muted}>{id} · {String(item.category || "Warehouse")} · Bin {String(item.bin_location || item.location || "-")}</Text>
          </View>
          <Text style={styles.statusPill}>{displayStatus}</Text>
        </View>
        <View style={styles.inventoryStats}>
          <View style={styles.inventoryStat}>
            <Text style={styles.cardLabel}>On hand</Text>
            <Text style={styles.inventoryValue}>{onHand}</Text>
          </View>
          <View style={styles.inventoryStat}>
            <Text style={styles.cardLabel}>Reserved</Text>
            <Text style={styles.inventoryValue}>{reserved}</Text>
          </View>
          <View style={styles.inventoryStat}>
            <Text style={styles.cardLabel}>Available</Text>
            <Text style={[styles.inventoryValue, needsOrder && styles.warningText]}>{available}</Text>
          </View>
          <View style={styles.inventoryStat}>
            <Text style={styles.cardLabel}>Trigger</Text>
            <Text style={styles.inventoryValue}>{reorderPoint}</Text>
          </View>
          <View style={styles.inventoryStat}>
            <Text style={styles.cardLabel}>Target</Text>
            <Text style={styles.inventoryValue}>{target}</Text>
          </View>
          <View style={styles.inventoryStat}>
            <Text style={styles.cardLabel}>Order qty</Text>
            <Text style={styles.inventoryValue}>{reorderQty}</Text>
          </View>
        </View>
        <Text style={styles.bodyText}>Vendor: {String(item.vendor || "-")} · Lead time: {String(item.lead_time_days || 0)} days · Unit: {String(item.unit || "pcs")}</Text>
        {!!(linkedCustomer || linkedOffer) && (
          <View style={styles.linkedSystemsPanel}>
            <Text style={styles.cardLabel}>Reserved for offer</Text>
            <Text style={styles.muted}>
              {linkedCustomer || "Customer pending"}{linkedCustomerId ? ` - ${linkedCustomerId}` : ""}{linkedOffer ? ` - Offer ${linkedOffer}` : ""}
            </Text>
            <View style={styles.inlineActions}>
              <Pressable
                style={styles.smallButton}
                onPress={() => openCrmForCustomerNumber(linkedCustomerId || linkedCustomer)}
                disabled={loading || !(linkedCustomerId || linkedCustomer)}
              >
                <Text style={styles.smallButtonText}>Open CRM</Text>
              </Pressable>
              <Pressable style={styles.smallButton} onPress={() => setActiveTab("estimator")} disabled={loading}>
                <Text style={styles.smallButtonText}>Open offers</Text>
              </Pressable>
            </View>
          </View>
        )}
        {!!item.po_number && <Text style={styles.bodyText}>Purchase order: {String(item.po_number)} · {String(item.po_status || "Raised")}</Text>}
        {!!item.notes && <Text style={styles.muted}>{String(item.notes)}</Text>}
        <View style={styles.inlineEditRow}>
          <View style={styles.inlineEditField}>
            <Text style={styles.label}>Trigger</Text>
            <TextInput
              style={styles.compactInput}
              value={edit.reorder_point}
              onChangeText={(value) => setInventoryEdits((draft) => ({ ...draft, [id]: { ...edit, reorder_point: value } }))}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inlineEditField}>
            <Text style={styles.label}>Target</Text>
            <TextInput
              style={styles.compactInput}
              value={edit.target_stock}
              onChangeText={(value) => setInventoryEdits((draft) => ({ ...draft, [id]: { ...edit, target_stock: value } }))}
              keyboardType="numeric"
            />
          </View>
          <Pressable
            style={styles.smallButton}
            onPress={() => updateInventoryItem(item, { reorder_point: edit.reorder_point, target_stock: edit.target_stock })}
            disabled={loading}
          >
            <Text style={styles.smallButtonText}>Save trigger</Text>
          </Pressable>
        </View>
        <View style={styles.inlineActions}>
          <Pressable style={styles.smallButton} onPress={() => adjustInventoryItem(item, 1, "Received one unit")} disabled={loading}>
            <Text style={styles.smallButtonText}>Receive +1</Text>
          </Pressable>
          <Pressable style={styles.smallButton} onPress={() => adjustInventoryItem(item, -1, "Issued one unit")} disabled={loading}>
            <Text style={styles.smallButtonText}>Issue -1</Text>
          </Pressable>
          <Pressable style={styles.smallButton} onPress={() => raiseInventoryPo(item)} disabled={loading || reorderQty <= 0 || displayStatus === "On Order"}>
            <Text style={styles.smallButtonText}>Order missing</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  function renderSalesPage() {
    const inquiries = asRecords((data as Record<string, unknown> | null)?.sales_inquiries);
    const openInquiries = inquiries.filter((item) => !String(item.status || item.lead_status || "").toLowerCase().includes("lost"));
    const reportImported = inquiries.filter((item) => item.source_enquiry_no || item.enquiry_no).length;
    const statusCounts = inquiries.reduce<Record<string, number>>((counts, item) => {
      const status = String(item.status || item.lead_status || "New");
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, {});
    const topStatuses = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
    return (
      <View>
        <View style={styles.moduleHero}>
          <Text style={styles.eyebrow}>Sales Intake</Text>
          <Text style={styles.moduleHeroTitle}>Enquiry Intake & Follow-Up</Text>
          <Text style={styles.moduleHeroText}>Capture new enquiries using the same fields as the enquiry report, then track status, lead type, phone/WhatsApp, referral, owner, and next follow-up from the portal.</Text>
        </View>

        <View style={styles.metricGrid}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Total enquiries</Text>
            <Text style={styles.metricValue}>{inquiries.length}</Text>
            <Text style={styles.muted}>Current sales enquiry records.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Active pipeline</Text>
            <Text style={styles.metricValue}>{openInquiries.length}</Text>
            <Text style={styles.muted}>Records not marked lost.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Report integrated</Text>
            <Text style={styles.metricValue}>{reportImported}</Text>
            <Text style={styles.muted}>Rows carrying enquiry report numbers.</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.cardLabel}>New enquiry intake</Text>
          <View style={styles.formGrid}>
            <View style={styles.field}>
              <Text style={styles.label}>Enquiry no</Text>
              <TextInput style={styles.input} value={salesInquiryDraft.enquiry_no} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, enquiry_no: value }))} placeholder="Auto if blank" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Lead / customer name</Text>
              <TextInput style={styles.input} value={salesInquiryDraft.customer} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, customer: value }))} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Lead status</Text>
              <TextInput style={styles.input} value={salesInquiryDraft.lead_status} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, lead_status: value }))} placeholder="Enquiry Pending" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Lead type</Text>
              <TextInput style={styles.input} value={salesInquiryDraft.lead_type} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, lead_type: value }))} placeholder="New / Modification / AMC / OneTime" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Phone</Text>
              <TextInput style={styles.input} value={salesInquiryDraft.phone} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, phone: value }))} keyboardType="phone-pad" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Full address</Text>
              <TextInput style={[styles.input, styles.textarea]} value={salesInquiryDraft.address} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, address: value }))} multiline />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>WhatsApp</Text>
              <TextInput style={styles.input} value={salesInquiryDraft.whatsapp_no} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, whatsapp_no: value }))} keyboardType="phone-pad" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Quantity</Text>
              <TextInput style={styles.input} value={salesInquiryDraft.qty} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, qty: value }))} keyboardType="numeric" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Created date</Text>
              <TextInput style={styles.input} value={salesInquiryDraft.received_date} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, received_date: value }))} placeholder="YYYY-MM-DD" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Referral by</Text>
              <TextInput style={styles.input} value={salesInquiryDraft.referral_by} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, referral_by: value }))} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Created by</Text>
              <TextInput style={styles.input} value={salesInquiryDraft.createdbyname} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, createdbyname: value }))} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Assigned to</Text>
              <TextInput style={styles.input} value={salesInquiryDraft.assigned_to} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, assigned_to: value }))} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Next follow-up</Text>
              <TextInput style={styles.input} value={salesInquiryDraft.next_followup} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, next_followup: value }))} placeholder="YYYY-MM-DD" />
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Enquiry remark</Text>
            <TextInput style={[styles.input, styles.textarea]} value={salesInquiryDraft.enquiry_remark} onChangeText={(value) => setSalesInquiryDraft((draft) => ({ ...draft, enquiry_remark: value }))} multiline />
          </View>
          <Pressable style={styles.primaryButton} onPress={saveSalesInquiry} disabled={loading || !salesInquiryDraft.customer.trim()}>
            <Text style={styles.primaryButtonText}>Save enquiry intake</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Pipeline Status</Text>
        <View style={styles.metricGrid}>
          {topStatuses.map(([status, count]) => (
            <View key={status} style={styles.card}>
              <Text style={[styles.cardLabel, { color: salesInquiryStatusTone(status) }]}>{status}</Text>
              <Text style={styles.metricValue}>{count}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Recent Enquiries</Text>
        {inquiries.slice(0, 60).map((item, index) => {
          const id = recordIdentity(item) || String(item.enquiry_no || index);
          const status = String(item.status || item.lead_status || "New");
          return (
            <View key={`${id}-${index}`} style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardTitleBlock}>
                  <Text style={styles.cardTitle}>{String(item.customer || item.lead_name || item.name || "-")}</Text>
                  <Text style={styles.muted}>{String(item.enquiry_no || item.source_enquiry_no || id)} · {String(item.lead_type || item.leadtype || "New")} · Qty {String(item.qty || 1)}</Text>
                </View>
                <Text style={[styles.statusPill, { color: salesInquiryStatusTone(status) }]}>{status}</Text>
              </View>
              <Text style={styles.bodyText}>Phone: {String(item.phone || "-")} · WhatsApp: {String(item.whatsapp_no || "-")} · Created: {String(item.received_date || item.createddate || "-")}</Text>
              <Text style={styles.bodyText}>Address: {String(item.address || item.site_address || item.site || "-")}</Text>
              <Text style={styles.bodyText}>Referral: {String(item.referral_by || "-")} · Created by: {String(item.createdbyname || "-")} · Owner: {String(item.assigned_to || "-")}</Text>
              {!!(item.requirement || item.enquiry_remark || item.notes) && <Text style={styles.muted}>{String(item.requirement || item.enquiry_remark || item.notes)}</Text>}
              <View style={styles.inlineActions}>
                <Pressable style={styles.smallButton} onPress={() => updateSalesInquiry(item, { lead_status: "Site Visit", status: "Site Visit" })} disabled={loading}>
                  <Text style={styles.smallButtonText}>Site Visit</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => updateSalesInquiry(item, { lead_status: "Offer Pending", status: "Offer Pending" })} disabled={loading}>
                  <Text style={styles.smallButtonText}>Offer Pending</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => updateSalesInquiry(item, { lead_status: "Offer Submitted", status: "Offer Submitted" })} disabled={loading}>
                  <Text style={styles.smallButtonText}>Offer Submitted</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => updateSalesInquiry(item, { lead_status: "Lost", status: "Lost" })} disabled={loading}>
                  <Text style={styles.smallButtonText}>Lost</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  function renderActiveFeaturePage() {
    switch (activeTab) {
      case "modules":
        return renderFeaturePage("Platform Modules", "Operating modules from the FUZI README are available in this Expo shell.", asRecords(data?.platform_modules), ["name"], [["owner"], ["status"], ["summary"]]);
      case "tickets":
        return renderProjectTicketBoard();
      case "projects":
        return renderFeaturePage("Projects", "Installation project progress and stage status.", asRecords(data?.install_jobs), ["job_id", "id"], [["customer"], ["site"], ["status"]]);
      case "installations":
        return renderFeaturePage("Installations", "Field installation jobs, active stages, and target handover data.", asRecords(data?.install_jobs), ["job_id", "id"], [["customer"], ["current_stage", "stage"], ["target_handover"]]);
      case "team":
        return renderInstallTeamPage();
      case "accounts":
        return renderAccountsPage();
      case "renewals":
        return renderRenewalsPage();
      case "workorders":
        return renderFeaturePage("Work Orders", "Site walkthrough and work order queue.", asRecords(data?.work_orders), ["title", "id"], [["customer"], ["status"], ["assigned_to", "owner"]]);
      case "inventory":
        return renderInventoryPage();
      case "orgchart":
        return renderStaffManagementPage();
      case "siteVisits":
        return renderSiteVisitReportsPage();
      case "offerManager":
        return renderOfferManagerPage();
      case "sales":
        return renderCustomerCrmPage();
      case "installation_dept":
        return renderFeaturePage("Installation Dept", "Department view for active installation execution.", asRecords(data?.install_jobs), ["job_id", "id"], [["customer"], ["site"], ["status"]]);
      case "breakdown":
        return renderBreakdownPage();
      case "service":
        return renderServicePage();
      case "gad":
        return renderFeaturePage("GAD Drawings", "Drawing submissions, revisions, and approval workflow.", asRecords((data as Record<string, unknown> | null)?.gad_records), ["drawing_no", "id"], [["customer"], ["status"], ["unit"]]);
      case "finance":
        return renderFeaturePage("Accounts", "Payments, milestones, and collection tracking.", asRecords(data?.payments), ["id", "payment_id"], [["customer_name", "customer"], ["amount"], ["status"]]);
      case "commissioning":
        return renderCommissioningPage();
      case "backoffice":
        return renderFeaturePage("Back Office", "Customer, site, product, and document back-office records.", asRecords(data?.customers), ["name"], [["id"], ["address"], ["status"]]);
      case "tender":
        return renderFeaturePage("Tender", "Tender records and result tracking.", asRecords((data as Record<string, unknown> | null)?.tenders), ["title", "id"], [["customer"], ["status"], ["result"]]);
      case "factory":
        return renderFeaturePage("Factory", "Factory jobs, dispatch status, and material readiness.", asRecords((data as Record<string, unknown> | null)?.factory_jobs), ["order_ref", "id"], [["customer"], ["stage"], ["materials"]]);
      case "internationalVendor":
        return renderInternationalVendorPage();
      case "comms":
        return renderFeaturePage("Dept Comms", "Department communications and read status.", asRecords((data as Record<string, unknown> | null)?.dept_comms), ["subject", "title", "id"], [["department"], ["message"], ["status"]]);
      default:
        return null;
    }
  }

  async function loadPortal(nextToken = token) {
    const portalData = await apiFetch<PortalData>("/api/portal/data", { token: nextToken });
    setData(portalData);
  }

  async function syncDiscordBreakdowns() {
    setLoading(true);
    try {
      const result = await apiFetch<{ imported?: number; message?: string }>("/api/portal/breakdown/sync-discord", {
        method: "POST",
        token,
        body: JSON.stringify({ force: true, limit: 50 }),
      });
      await loadPortal();
      setMessage(result.imported ? `Synced ${result.imported} Discord breakdown update${result.imported === 1 ? "" : "s"}.` : "Discord breakdown channel is already synced.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Discord breakdown sync failed.");
    } finally {
      setLoading(false);
    }
  }

  function storeSession(nextToken: string) {
    if (Platform.OS === "web" && typeof globalThis.localStorage !== "undefined") {
      globalThis.localStorage.setItem("fuzi_portal_token", nextToken);
    }
  }

  function clearStoredSession() {
    if (Platform.OS === "web" && typeof globalThis.localStorage !== "undefined") {
      globalThis.localStorage.removeItem("fuzi_portal_token");
    }
  }

  async function signIn(nextUsername = username, nextPassword = password) {
    setLoading(true);
    setMessage("");
    try {
      const response = await apiFetch<{ token: string; must_change_password?: boolean; access?: { default_view?: string } }>("/api/portal/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: nextUsername, password: nextPassword }),
      });
      if (response.must_change_password) {
        setMessage("This user must change the temporary password in the web portal before mobile access.");
      }
      setToken(response.token);
      storeSession(response.token);
      setShowPortalLogin(false);
      setActiveTab((response.access?.default_view as TabKey) || "overview");
      await loadPortal(response.token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  async function saveCustomer(allowDuplicatePhone = false) {
    if (!customerDraft.name?.trim()) {
      const text = "Customer name is required.";
      Platform.OS === "web" ? setMessage(text) : Alert.alert("Missing field", text);
      return;
    }
    const id = String(customerDraft.id || "");
    const duplicate = !id && !allowDuplicatePhone ? findCustomerPhoneDuplicate(customerDraft.phone) : null;
    if (duplicate) {
      const duplicateName = duplicate.type === "customer"
        ? String(duplicate.record.name || duplicate.record.contact_person || duplicate.record.id || "existing customer")
        : String(duplicate.record.customer || duplicate.record.lead_name || duplicate.record.name || duplicate.record.customer_id || duplicate.record.id || "existing enquiry");
      const duplicatePhone = String(duplicate.type === "customer" ? duplicate.record.phone || "" : duplicate.record.phone || duplicate.record.whatsapp_no || "");
      const editExisting = () => {
        if (duplicate.type === "customer") {
          editCustomer(duplicate.record);
        } else {
          editSalesInquiry(duplicate.record);
        }
        setMessage(`Existing CRM record opened for ${duplicateName}${duplicatePhone ? ` (${duplicatePhone})` : ""}.`);
      };
      const addNew = () => {
        void saveCustomer(true);
      };
      const promptText = `Phone ${duplicatePhone || customerDraft.phone} already exists for ${duplicateName}. Modify the existing CRM record?`;
      if (Platform.OS === "web" && typeof globalThis.confirm === "function") {
        if (globalThis.confirm(`${promptText}\n\nOK: modify existing record\nCancel: add this as a new customer`)) {
          editExisting();
        } else {
          addNew();
        }
      } else {
        Alert.alert("Phone already exists", promptText, [
          { text: "Modify existing", onPress: editExisting },
          { text: "Add new", style: "destructive", onPress: addNew },
          { text: "Cancel", style: "cancel" },
        ]);
      }
      return;
    }
    setLoading(true);
    try {
      await apiFetch(id ? `/api/portal/customers/${encodeURIComponent(id)}` : "/api/portal/customers", {
        method: id ? "PATCH" : "POST",
        token,
        body: JSON.stringify(customerDraft),
      });
      setCustomerDraft(emptyCustomer);
      setCustomerEditorOpen(false);
      await loadPortal();
      setMessage(id ? "Customer CRM record updated." : "Customer CRM record saved. Select that customer before adding a site visit report.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Customer could not be saved.");
    } finally {
      setLoading(false);
    }
  }

  async function saveSiteVisit() {
    if (!siteVisitDraft.customer_id?.trim()) {
      const text = "Select a CRM customer before saving the site visit report.";
      Platform.OS === "web" ? setMessage(text) : Alert.alert("Customer required", text);
      return;
    }
    const linkedCustomer = crmCustomerForSiteVisit(siteVisitDraft as Record<string, unknown>);
    if (!linkedCustomer) {
      const text = "Site visits must be saved against a CRM customer. Select a customer from the CRM list before saving.";
      Platform.OS === "web" ? setMessage(text) : Alert.alert("Customer required", text);
      return;
    }
    setLoading(true);
    try {
      const siteVisitId = String(siteVisitDraft.id || "");
      const viewer = data?.viewer || {};
      await apiFetch(siteVisitId ? `/api/portal/site-visits/${encodeURIComponent(siteVisitId)}` : "/api/portal/site-visits", {
        method: siteVisitId ? "PATCH" : "POST",
        token,
        body: JSON.stringify({
          ...siteVisitDraft,
          customer_id: linkedCustomer.id,
          customer_name: linkedCustomer.name,
          address: linkedCustomer.address || "",
          site_person_name: siteVisitDraft.site_person_name || linkedCustomer.name,
          site_person_mobile: siteVisitDraft.site_person_mobile || linkedCustomer.phone || "",
          visited_by: siteVisitDraft.visited_by || viewer.display_name || username,
          submitted_by: viewer.display_name || username,
          submitted_by_username: viewer.username || username,
          submitted_by_department: viewer.department || "",
          submitted_by_staff_id: viewer.linked_org_node || viewer.linked_team_member || "",
        }),
      });
      setSiteVisitDraft(emptySiteVisit);
      setSiteVisitEditorOpen(false);
      await loadPortal();
      setMessage(siteVisitId ? "Site visit report updated." : "Site visit report saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Site visit report could not be saved.");
    } finally {
      setLoading(false);
    }
  }

  async function saveModuleRecord(config: ModuleConfig) {
    if (!moduleDraft.title.trim()) {
      const text = `${config.titleLabel} is required.`;
      Platform.OS === "web" ? setMessage(text) : Alert.alert("Missing field", text);
      return;
    }
    if (config.route === "/api/portal/install-jobs" && !moduleDraft.customer_id.trim()) {
      const text = "Select a customer before creating an installation job.";
      Platform.OS === "web" ? setMessage(text) : Alert.alert("Customer required", text);
      return;
    }
    const payload: Record<string, string> = {
      [config.titleKey]: moduleDraft.title,
      status: moduleDraft.status || "Open",
    };
    if (config.customerKey) payload[config.customerKey] = moduleDraft.customer;
    if (moduleDraft.customer_id) payload.customer_id = moduleDraft.customer_id;
    if (config.route === "/api/portal/service" && moduleDraft.customer_id) {
      const selectedCustomer = crmCustomerOptions().find((customer) => customer.id === moduleDraft.customer_id);
      if (selectedCustomer?.source_inquiry_id) payload.source_inquiry_id = selectedCustomer.source_inquiry_id;
    }
    if (config.notesKey) payload[config.notesKey] = moduleDraft.notes;
    setLoading(true);
    try {
      await apiFetch(config.route, {
        method: "POST",
        token,
        body: JSON.stringify(payload),
      });
      setModuleDraft(emptyModuleDraft);
      await loadPortal();
      setMessage("Module record saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Module record could not be saved.");
    } finally {
      setLoading(false);
    }
  }

  async function updateModuleRecord(record: Record<string, unknown>, status: string) {
    const config = moduleConfigs[activeTab];
    const id = recordIdentity(record);
    if (!config || !id) return;
    setLoading(true);
    try {
      await apiFetch(`${config.route}/${encodeURIComponent(id)}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status }),
      });
      await loadPortal();
      setMessage(`Record marked ${status}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Record could not be updated.");
    } finally {
      setLoading(false);
    }
  }

  async function saveInventoryItem() {
    if (!inventoryDraft.name.trim()) {
      const text = "Inventory item name is required.";
      Platform.OS === "web" ? setMessage(text) : Alert.alert("Missing field", text);
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/api/portal/inventory", {
        method: "POST",
        token,
        body: JSON.stringify(inventoryDraft),
      });
      setInventoryDraft(emptyInventoryDraft);
      await loadPortal();
      setMessage("Warehouse inventory item saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Inventory item could not be saved.");
    } finally {
      setLoading(false);
    }
  }

  async function updateInventoryItem(record: Record<string, unknown>, patch: Record<string, unknown>) {
    const id = recordIdentity(record);
    if (!id) return;
    setLoading(true);
    try {
      await apiFetch(`/api/portal/inventory/${encodeURIComponent(id)}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(patch),
      });
      setInventoryEdits((draft) => {
        const next = { ...draft };
        delete next[id];
        return next;
      });
      await loadPortal();
      setMessage("Inventory trigger updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Inventory item could not be updated.");
    } finally {
      setLoading(false);
    }
  }

  async function adjustInventoryItem(record: Record<string, unknown>, delta: number, reason: string) {
    const id = recordIdentity(record);
    if (!id) return;
    setLoading(true);
    try {
      await apiFetch(`/api/portal/inventory/${encodeURIComponent(id)}/adjust`, {
        method: "POST",
        token,
        body: JSON.stringify({ delta, reason }),
      });
      await loadPortal();
      setMessage(delta > 0 ? "Inventory received into warehouse." : "Inventory issued from warehouse.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Inventory stock could not be adjusted.");
    } finally {
      setLoading(false);
    }
  }

  async function raiseInventoryPo(record: Record<string, unknown>) {
    const id = recordIdentity(record);
    if (!id) return;
    const quantity = inventoryReorderQty(record);
    setLoading(true);
    try {
      await apiFetch("/api/portal/inventory/raise-po", {
        method: "POST",
        token,
        body: JSON.stringify({
          item_id: id,
          item_name: record.name || record.item,
          vendor: record.vendor || "",
          quantity,
          customer_id: record.customer_id || "",
          customer_name: record.customer_name || record.customer || record.reserved_for || "",
          offer_id: record.offer_id || record.estimate_id || "",
          offer_name: record.offer_name || "",
        }),
      });
      await loadPortal();
      setMessage(`Purchase order raised for ${String(record.name || record.item || id)}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Purchase order could not be raised.");
    } finally {
      setLoading(false);
    }
  }

  async function saveInternationalVendor() {
    if (!isAdmin) {
      setMessage("Only admin can manage International Vendor records.");
      return;
    }
    if (!internationalVendorDraft.company.trim()) {
      const text = "Company name is required.";
      Platform.OS === "web" ? setMessage(text) : Alert.alert("Missing field", text);
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/api/portal/international-vendors", {
        method: "POST",
        token,
        body: JSON.stringify(internationalVendorDraft),
      });
      setInternationalVendorDraft(emptyInternationalVendorDraft);
      await loadPortal();
      setMessage("International vendor prospect saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "International vendor could not be saved.");
    } finally {
      setLoading(false);
    }
  }

  async function updateInternationalVendor(record: Record<string, unknown>, patch: Record<string, unknown>) {
    const id = recordIdentity(record);
    if (!id) return;
    setLoading(true);
    try {
      await apiFetch(`/api/portal/international-vendors/${encodeURIComponent(id)}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(patch),
      });
      await loadPortal();
      setMessage("International vendor updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "International vendor could not be updated.");
    } finally {
      setLoading(false);
    }
  }

  async function sendInternationalVendorOutreach(record: Record<string, unknown>, stage: string) {
    const id = recordIdentity(record);
    if (!id) return;
    setLoading(true);
    try {
      const response = await apiFetch<{ message?: string }>(`/api/portal/international-vendors/${encodeURIComponent(id)}/outreach`, {
        method: "POST",
        token,
        body: JSON.stringify({
          stage,
          target: record.email || record.openclaw_target || "",
          message: internationalVendorEmailText({ ...record, followup_stage: stage }),
        }),
      });
      await loadPortal();
      setMessage(response.message ? "International vendor outreach sent to OpenClaw/email handoff." : "International vendor outreach queued.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "International vendor outreach could not be sent.");
    } finally {
      setLoading(false);
    }
  }

  async function saveSalesInquiry() {
    if (!salesInquiryDraft.customer.trim()) {
      const text = "Lead/customer name is required.";
      Platform.OS === "web" ? setMessage(text) : Alert.alert("Missing field", text);
      return;
    }
    if (isLostInquiryStatus(salesInquiryDraft.lead_status) && !salesInquiryDraft.lost_reason.trim()) {
      const text = "Lost reason is required for lost statuses.";
      Platform.OS === "web" ? setMessage(text) : Alert.alert("Lost reason required", text);
      return;
    }
    setLoading(true);
    try {
      const id = salesInquiryDraft.id || "";
      await apiFetch(id ? `/api/portal/sales/inquiries/${encodeURIComponent(id)}` : "/api/portal/sales/inquiries", {
        method: id ? "PATCH" : "POST",
        token,
        body: JSON.stringify({
          ...salesInquiryDraft,
          status: salesInquiryDraft.lead_status,
          status_lost_reason: isLostInquiryStatus(salesInquiryDraft.lead_status) ? salesInquiryDraft.lost_reason : "",
          lost_reason: isLostInquiryStatus(salesInquiryDraft.lead_status) ? salesInquiryDraft.lost_reason : "",
        }),
      });
      setSalesInquiryDraft(emptySalesInquiryDraft);
      setSalesInquiryEditorOpen(false);
      await loadPortal();
      setMessage(id ? "Enquiry record updated." : "Sales enquiry intake saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sales enquiry could not be saved.");
    } finally {
      setLoading(false);
    }
  }

  function editSalesInquiry(record: Record<string, unknown>) {
    const customerId = String(record.customer_id || "");
    const enquiryNo = String(record.enquiry_no || record.source_enquiry_no || "");
    setSalesInquiryDraft({
      id: recordIdentity(record) || String(record.enquiry_no || ""),
      customer_id: customerId,
      enquiry_no: enquiryNo,
      customer: String(record.customer || record.lead_name || ""),
      enquiry_remark: String(record.enquiry_remark || record.requirement || ""),
      lead_status: String(record.lead_status || record.status || "Enquiry Pending"),
      whatsapp_no: String(record.whatsapp_no || ""),
      lead_type: String(record.lead_type || record.leadtype || "New"),
      qty: String(record.qty || "1"),
      phone: String(record.phone || ""),
      address: String(record.address || record.site_address || record.site || ""),
      received_date: String(record.received_date || record.createddate || ""),
      referral_by: String(record.referral_by || ""),
      createdbyname: String(record.createdbyname || ""),
      lastmodifiedbyname: String(record.lastmodifiedbyname || ""),
      assigned_to: String(record.assigned_to || "Sales"),
      next_followup: String(record.next_followup || ""),
      followup_channel: String(record.followup_channel || "WhatsApp"),
      followup_frequency_days: String(record.followup_frequency_days || "7"),
      followup_status: String(record.followup_status || "Open"),
      last_followup: String(record.last_followup || ""),
      lost_reason: String(record.lost_reason || record.status_lost_reason || ""),
      notes: String(record.notes || ""),
    });
    setSiteVisitDraft((draft) => ({ ...draft, customer_id: customerId, site_enquiry_no: enquiryNo || draft.site_enquiry_no }));
    setSiteVisitEditorOpen(false);
    setSalesInquiryEditorOpen(true);
    setMessage(`Editing enquiry ${String(record.enquiry_no || record.id || "")}. Site visit entry is ready for this customer.`);
  }

  async function updateSalesInquiry(record: Record<string, unknown>, patch: Record<string, unknown>) {
    const id = recordIdentity(record) || String(record.enquiry_no || "");
    if (!id) return;
    setLoading(true);
    try {
      await apiFetch(`/api/portal/sales/inquiries/${encodeURIComponent(id)}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(patch),
      });
      await loadPortal();
      setMessage("Sales enquiry updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sales enquiry could not be updated.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteSalesInquiry(record: Record<string, unknown>) {
    if (!isAdmin) {
      setMessage("Only admin can remove CRM enquiry records.");
      return;
    }
    const id = recordIdentity(record) || String(record.enquiry_no || "");
    if (!id) return;
    setLoading(true);
    try {
      await apiFetch(`/api/portal/sales/inquiries/${encodeURIComponent(id)}`, {
        method: "DELETE",
        token,
      });
      if (salesInquiryDraft.id === id) setSalesInquiryDraft(emptySalesInquiryDraft);
      await loadPortal();
      setMessage("Enquiry record removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Enquiry record could not be removed.");
    } finally {
      setLoading(false);
    }
  }

  function makeOfferFromInquiry(record: Record<string, unknown>) {
    const customerName = String(record.customer || record.lead_name || "");
    setOfferDraft({
      ...emptyOfferDraft,
      customer_name: customerName,
      offer_name: customerName,
      offer_type: String(record.lead_type || record.leadtype || "Individual"),
      lead_status: "Costing Pending",
      createdbyname: data?.viewer?.display_name || username,
      customer_id: String(record.customer_id || ""),
      source_inquiry_id: recordIdentity(record) || String(record.enquiry_no || ""),
      notes: String(record.enquiry_remark || record.requirement || ""),
    });
    setMessage(`Offer draft prepared for ${customerName}. Complete the Offer Manager form and save.`);
  }

  async function saveOffer() {
    if (!offerDraft.customer_id.trim()) {
      const text = "Select a CRM customer before creating an offer.";
      Platform.OS === "web" ? setMessage(text) : Alert.alert("Missing customer", text);
      return;
    }
    if (!offerDraft.customer_name.trim()) {
      const text = "Customer name is required for the offer.";
      Platform.OS === "web" ? setMessage(text) : Alert.alert("Missing field", text);
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...offerDraft,
        offer_name: offerDraft.offer_name || offerDraft.customer_name,
        status: offerDraft.lead_status || "Offer Pending",
        total_cost: offerCostSummary(offerDraft).totalCost,
        calculated_total_cost: offerCostSummary(offerDraft).totalCost,
        source: "CRM Offer Manager",
        offer_letter_status: "Prepared",
      };
      await apiFetch("/api/portal/estimates", {
        method: "POST",
        token,
        body: JSON.stringify(payload),
      });
      if (offerDraft.source_inquiry_id) {
        await apiFetch(`/api/portal/sales/inquiries/${encodeURIComponent(offerDraft.source_inquiry_id)}`, {
          method: "PATCH",
          token,
          body: JSON.stringify({ lead_status: offerDraft.lead_status, status: offerDraft.lead_status }),
        });
      }
      setOfferDraft(emptyOfferDraft);
      setCostingEditorOpen(false);
      await loadPortal();
      setMessage("Offer saved and client offer letter prepared.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Offer could not be saved.");
    } finally {
      setLoading(false);
    }
  }

  async function updateOffer(record: Record<string, unknown>, patch: Record<string, unknown>) {
    const id = recordIdentity(record);
    if (!id) return;
    setLoading(true);
    try {
      await apiFetch(`/api/portal/estimates/${encodeURIComponent(id)}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(patch),
      });
      await loadPortal();
      setMessage("Offer updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Offer could not be updated.");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    try {
      if (token) {
        await apiFetch("/api/portal/auth/logout", {
          method: "POST",
          token,
          body: JSON.stringify({}),
        });
      }
    } catch {
      // Local logout should still work even if the API session already expired.
    } finally {
      setToken("");
      setData(null);
      setActiveTab("overview");
      setShowPortalLogin(false);
      setMessage("");
      clearStoredSession();
    }
  }

  async function grantCustomerAccess(customer: Customer) {
    setLoading(true);
    try {
      const response = await apiFetch<{ customer_user?: { username?: string; temporary_password?: string }; message?: string }>("/api/portal/customer-users", {
        method: "POST",
        token,
        body: JSON.stringify({ customer_id: customer.id }),
      });
      await loadPortal();
      const usernameText = response.customer_user?.username ? ` Username: ${response.customer_user.username}` : "";
      const passwordText = response.customer_user?.temporary_password ? ` Temporary password: ${response.customer_user.temporary_password}` : "";
      setMessage(`${response.message || "Customer portal access ready."}${usernameText}${passwordText}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Customer portal access could not be created.");
    } finally {
      setLoading(false);
    }
  }

  function editCustomer(customer: Customer) {
    setCustomerDraft({ ...emptyCustomer, ...customer });
    setCustomerEditorOpen(true);
    setSiteVisitDraft((draft) => ({ ...draft, customer_id: customer.id }));
    setSiteVisitEditorOpen(false);
    setActiveTab("customers");
    setMessage(`Editing ${customer.name}. Site visit entry is ready for customer ${customer.id}.`);
  }

  async function updateCustomer(id: string, payload: Record<string, string>) {
    setLoading(true);
    try {
      await apiFetch(`/api/portal/customers/${encodeURIComponent(id)}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(payload),
      });
      await loadPortal();
      setMessage("Customer CRM record updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Customer could not be updated.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteCustomer(customer: Customer) {
    if (!isAdmin) {
      setMessage("Only admin can remove CRM customer records.");
      return;
    }
    setLoading(true);
    try {
      await apiFetch(`/api/portal/customers/${encodeURIComponent(customer.id)}`, {
        method: "DELETE",
        token,
      });
      if (customerDraft.id === customer.id) setCustomerDraft(emptyCustomer);
      await loadPortal();
      setMessage(`${customer.name} removed from CRM.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Customer could not be removed.");
    } finally {
      setLoading(false);
    }
  }

  async function downloadCrmData() {
    if (!isAdmin) {
      setMessage("Only admin can download CRM data.");
      return;
    }
    if (Platform.OS !== "web") {
      setMessage("CRM download is available from the web admin portal.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/portal/crm/export`, {
        method: "GET",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const errorText = await response.text();
        let message = `CRM download failed with ${response.status}.`;
        try {
          message = JSON.parse(errorText).message || message;
        } catch {
          if (errorText) message = errorText;
        }
        throw new Error(message);
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] || `fuzi-crm-export-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage("CRM data download started.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "CRM data could not be downloaded.");
    } finally {
      setLoading(false);
    }
  }

  function editAccount(user: Record<string, unknown>) {
    setAccountDraft({
      id: String(user.id || ""),
      username: String(user.username || ""),
      display_name: String(user.display_name || ""),
      department: String(user.department || ""),
      role: String(user.role || "manager"),
      password: "",
      active: String(user.active) === "false" ? "N" : "Y",
    });
  }

  async function saveAccount() {
    const payload = {
      username: accountDraft.username,
      display_name: accountDraft.display_name,
      department: accountDraft.department,
      role: accountDraft.role,
      active: accountDraft.active.toUpperCase() !== "N",
      ...(accountDraft.password ? { password: accountDraft.password } : {}),
    };
    setLoading(true);
    try {
      if (accountDraft.id) {
        await apiFetch(`/api/portal/users/${encodeURIComponent(accountDraft.id)}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/api/portal/users", {
          method: "POST",
          token,
          body: JSON.stringify({ ...payload, password: accountDraft.password || sharedPortalPassword }),
        });
      }
      setAccountDraft(emptyAccountDraft);
      await loadPortal();
      setMessage("Team account saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Team account could not be saved.");
    } finally {
      setLoading(false);
    }
  }

  async function updateAccount(id: string, payload: Record<string, unknown>) {
    setLoading(true);
    try {
      await apiFetch(`/api/portal/users/${encodeURIComponent(id)}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(payload),
      });
      await loadPortal();
      setMessage("Team account updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Team account could not be updated.");
    } finally {
      setLoading(false);
    }
  }

  async function saveRenewal() {
    if (!renewalDraft.customer_id) {
      const text = "Select a customer before creating a maintenance renewal.";
      Platform.OS === "web" ? setMessage(text) : Alert.alert("Customer required", text);
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/api/portal/renewals", {
        method: "POST",
        token,
        body: JSON.stringify(renewalDraft),
      });
      setRenewalDraft(emptyRenewalDraft);
      await loadPortal();
      setMessage("Maintenance renewal saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Maintenance renewal could not be saved.");
    } finally {
      setLoading(false);
    }
  }

  async function updateRenewal(id: string, payload: Record<string, unknown>) {
    setLoading(true);
    try {
      await apiFetch(`/api/portal/renewals/${encodeURIComponent(id)}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(payload),
      });
      await loadPortal();
      setMessage("Maintenance renewal updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Maintenance renewal could not be updated.");
    } finally {
      setLoading(false);
    }
  }

  async function estimateAction(id: string, action: "send" | "approve-offer") {
    setLoading(true);
    try {
      await apiFetch(`/api/portal/estimates/${encodeURIComponent(id)}/${action}`, {
        method: "POST",
        token,
        body: JSON.stringify({}),
      });
      await loadPortal();
      setMessage(action === "send" ? "Estimate marked sent." : "Offer approved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Estimate action failed.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteEstimate(id: string) {
    setLoading(true);
    try {
      await apiFetch(`/api/portal/estimates/${encodeURIComponent(id)}`, {
        method: "DELETE",
        token,
      });
      await loadPortal();
      setMessage("Estimate deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Estimate could not be deleted.");
    } finally {
      setLoading(false);
    }
  }

  async function openEstimateArtifact(id: string, artifact: "report" | "offer.pdf") {
    const url = `${apiBaseUrl}/api/portal/estimates/${encodeURIComponent(id)}/${artifact}?token=${encodeURIComponent(token)}`;
    await Linking.openURL(url);
  }

  async function savePayment() {
    if (!paymentDraft.estimate_id || !paymentDraft.amount) {
      const text = "Select an estimate and enter an amount.";
      Platform.OS === "web" ? setMessage(text) : Alert.alert("Missing field", text);
      return;
    }
    const estimate = (data?.estimates || []).find((item) => item.id === paymentDraft.estimate_id);
    setLoading(true);
    try {
      await apiFetch("/api/portal/payments", {
        method: "POST",
        token,
        body: JSON.stringify({
          ...paymentDraft,
          customer_name: estimate?.customer_name || "",
          amount: Number(paymentDraft.amount),
          status: "Due",
        }),
      });
      setPaymentDraft((draft) => ({ ...emptyPaymentDraft, estimate_id: draft.estimate_id }));
      await loadPortal();
      setMessage("Payment milestone added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Payment could not be saved.");
    } finally {
      setLoading(false);
    }
  }

  async function autoSchedulePayments() {
    const estimate = (data?.estimates || []).find((item) => item.id === paymentDraft.estimate_id);
    if (!estimate) return;
    setLoading(true);
    try {
      await apiFetch("/api/portal/payments/auto-schedule", {
        method: "POST",
        token,
        body: JSON.stringify({ estimate_id: estimate.id, customer_name: estimate.customer_name, amount: estimate.total_cost || paymentDraft.amount }),
      });
      await loadPortal();
      setMessage("Payment schedule created.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Payment schedule could not be created.");
    } finally {
      setLoading(false);
    }
  }

  async function updatePayment(id: string, status: string) {
    setLoading(true);
    try {
      await apiFetch(`/api/portal/payments/${encodeURIComponent(id)}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status, paid_date: status === "Paid" ? new Date().toISOString().slice(0, 10) : "" }),
      });
      await loadPortal();
      setMessage(`Payment marked ${status}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Payment could not be updated.");
    } finally {
      setLoading(false);
    }
  }

  async function saveBreakdown() {
    if (!breakdownDraft.customer_id.trim() || !breakdownDraft.issue.trim()) {
      const text = "Select a customer and enter the fault issue.";
      Platform.OS === "web" ? setMessage(text) : Alert.alert("Missing field", text);
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/api/portal/breakdown", {
        method: "POST",
        token,
        body: JSON.stringify({
          ...breakdownDraft,
          assigned_to: breakdownDraft.engineer,
          status: breakdownDraft.engineer && breakdownDraft.scheduled_at ? "Scheduled" : "Open",
        }),
      });
      setBreakdownDraft(emptyBreakdownDraft);
      await loadPortal();
      setMessage("Breakdown call logged.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Breakdown could not be saved.");
    } finally {
      setLoading(false);
    }
  }

  async function updateBreakdown(id: string, status: string, staffName = "") {
    setLoading(true);
    try {
      await apiFetch(`/api/portal/breakdown/${encodeURIComponent(id)}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status, ...(staffName ? { engineer: staffName, assigned_to: staffName, assignment_source: "manual" } : {}) }),
      });
      await loadPortal();
      setMessage(staffName ? `Breakdown assigned to ${staffName}.` : `Breakdown marked ${status}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Breakdown could not be updated.");
    } finally {
      setLoading(false);
    }
  }

  async function scheduleBreakdownEngineer(id: string, member: Record<string, unknown>, scheduledAt: string) {
    const engineerName = String(member.name || "").trim();
    if (!engineerName) return;
    setLoading(true);
    try {
      await apiFetch(`/api/portal/breakdown/${encodeURIComponent(id)}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          status: "Scheduled",
          engineer: engineerName,
          assigned_to: engineerName,
          assignment_source: "manual",
          scheduled_at: scheduledAt,
        }),
      });
      const teamMember = asRecords(data?.install_team).find((item) => String(item.name || "").trim().toLowerCase() === engineerName.toLowerCase());
      const teamMemberId = teamMember ? recordIdentity(teamMember) : "";
      if (teamMemberId) {
        await apiFetch(`/api/portal/install-team/${encodeURIComponent(teamMemberId)}`, {
          method: "PATCH",
          token,
          body: JSON.stringify({
            availability: "Scheduled",
            current_job: id,
            next_available_at: scheduledAt,
          }),
        });
      } else {
        await apiFetch("/api/portal/breakdown-engineer-task", {
          method: "PATCH",
          token,
          body: JSON.stringify({
            engineer: engineerName,
            current_job: id,
            next_available_at: scheduledAt,
          }),
        });
      }
      setBreakdownScheduleDrafts((draft) => {
        const next = { ...draft };
        delete next[id];
        return next;
      });
      await loadPortal();
      setMessage(`${engineerName} scheduled for breakdown ${id} at ${scheduledAt}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Engineer could not be scheduled.");
    } finally {
      setLoading(false);
    }
  }

  async function updateBreakdownEngineerTask(member: Record<string, unknown>, task: string, draftKey?: string) {
    const engineerName = String(member.name || "").trim();
    if (!engineerName) return;
    const nextTask = task.trim();
    setLoading(true);
    try {
      await apiFetch("/api/portal/breakdown-engineer-task", {
        method: "PATCH",
        token,
        body: JSON.stringify({
          engineer: engineerName,
          current_job: nextTask,
        }),
      });
      setBreakdownEngineerTaskDrafts((draft) => {
        const next = { ...draft };
        next[engineerName] = nextTask;
        if (draftKey) next[draftKey] = nextTask;
        return next;
      });
      await loadPortal();
      setBreakdownEngineerTaskDrafts((draft) => {
        const next = { ...draft };
        delete next[engineerName];
        if (draftKey) delete next[draftKey];
        return next;
      });
      setMessage(nextTask ? `${engineerName}'s current task updated to ${nextTask}.` : `${engineerName} marked available with no saved current task.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Engineer task could not be updated.");
    } finally {
      setLoading(false);
    }
  }

  async function saveInstallTeamMember() {
    if (!installTeamDraft.name.trim()) {
      const text = "Staff name is required.";
      Platform.OS === "web" ? setMessage(text) : Alert.alert("Missing field", text);
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/api/portal/install-team", {
        method: "POST",
        token,
        body: JSON.stringify({
          ...installTeamDraft,
          skills: installTeamDraft.skills.split(",").map((skill) => skill.trim()).filter(Boolean),
        }),
      });
      setInstallTeamDraft(emptyInstallTeamDraft);
      await loadPortal();
      setMessage("Install team member saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Team member could not be saved.");
    } finally {
      setLoading(false);
    }
  }

  async function updateInstallTeamMember(id: string, payload: Record<string, string>) {
    setLoading(true);
    try {
      await apiFetch(`/api/portal/install-team/${encodeURIComponent(id)}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(payload),
      });
      await loadPortal();
      setMessage("Install team member updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Team member could not be updated.");
    } finally {
      setLoading(false);
    }
  }

  async function assignInstallTeamMember(id: string, jobId: string) {
    await updateInstallTeamMember(id, { current_job: jobId, availability: "On Site" });
  }

  async function sendInstallToCommissioning(job: Record<string, unknown>) {
    const jobId = fieldText(job, ["id", "job_id"]);
    setLoading(true);
    try {
      await apiFetch(`/api/portal/install-jobs/${encodeURIComponent(jobId)}/send-commissioning`, {
        method: "POST",
        token,
        body: JSON.stringify({
          site: fieldText(job, ["site"]),
          customer: fieldText(job, ["customer", "site"]),
          unit: fieldText(job, ["unit", "site", "id"]),
          message: `Install team completed ${fieldText(job, ["site", "id"])}. Product is installed and ready for commissioning checks.`,
        }),
      });
      await loadPortal();
      setMessage("Install team handoff sent to commissioning.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Commissioning handoff failed.");
    } finally {
      setLoading(false);
    }
  }

  async function saveCommissioningRecord() {
    if (!commissioningDraft.installation_ref.trim() && !commissioningDraft.unit.trim()) {
      const text = "Installation ref or unit is required.";
      Platform.OS === "web" ? setMessage(text) : Alert.alert("Missing field", text);
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/api/portal/commissioning", {
        method: "POST",
        token,
        body: JSON.stringify({
          ...commissioningDraft,
          payment_cleared: ["y", "yes", "true"].includes(commissioningDraft.payment_cleared.toLowerCase()),
        }),
      });
      setCommissioningDraft(emptyCommissioningDraft);
      await loadPortal();
      setMessage("Commissioning record saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Commissioning record could not be saved.");
    } finally {
      setLoading(false);
    }
  }

  async function updateCommissioning(id: string, payload: Record<string, unknown>) {
    setLoading(true);
    try {
      await apiFetch(`/api/portal/commissioning/${encodeURIComponent(id)}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(payload),
      });
      await loadPortal();
      setMessage("Commissioning record updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Commissioning record could not be updated.");
    } finally {
      setLoading(false);
    }
  }

  async function saveAttendance() {
    if (!attendanceDraft.person_id || !attendanceDraft.person_name.trim()) {
      const text = "Select a staff member before marking attendance.";
      Platform.OS === "web" ? setMessage(text) : Alert.alert("Missing field", text);
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/api/portal/attendance", {
        method: "POST",
        token,
        body: JSON.stringify({
          ...attendanceDraft,
          marked_by: data?.viewer?.username || username,
          marked_at: new Date().toISOString(),
        }),
      });
      await loadPortal();
      setMessage("Attendance saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Attendance could not be saved.");
    } finally {
      setLoading(false);
    }
  }

  async function markQuickAttendance(person: Record<string, unknown>, status: string) {
    const personId = fieldText(person, ["id"]);
    const personName = fieldText(person, ["name"]);
    if (!personId || !personName) {
      setMessage("Staff record is missing an ID or name.");
      return;
    }
    const payload = {
      date: new Date().toISOString().slice(0, 10),
      person_id: personId,
      person_name: personName,
      department: fieldText(person, ["department"]),
      status,
      check_in: status === "present" ? new Date().toTimeString().slice(0, 5) : "",
      check_out: "",
      notes: status === "leave" ? "Marked as leave from HR quick action." : "",
      marked_by: data?.viewer?.username || username,
      marked_at: new Date().toISOString(),
    };
    setAttendanceDraft((draft) => ({ ...draft, ...payload }));
    setLoading(true);
    try {
      await apiFetch("/api/portal/attendance", {
        method: "POST",
        token,
        body: JSON.stringify(payload),
      });
      await loadPortal();
      setMessage(`${personName} marked ${status}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Attendance could not be saved.");
    } finally {
      setLoading(false);
    }
  }

  async function markSelfAttendance(action: "check_in" | "check_out") {
    const staff = viewerStaffRecord(asRecords(data?.org_chart));
    if (!staff) {
      setMessage("Your portal account is not linked to a staff profile yet.");
      return;
    }
    const personId = fieldText(staff, ["id"]);
    const personName = fieldText(staff, ["name"]);
    const today = new Date().toISOString().slice(0, 10);
    const existing = asRecords(data?.attendance_today).find((item) => (
      fieldText(item, ["date"]) === today && fieldText(item, ["person_id", "staff_id"]) === personId
    ));
    const location = await captureAttendanceLocation();
    const currentTime = new Date().toTimeString().slice(0, 5);
    const payload = {
      ...(existing || {}),
      date: today,
      person_id: personId,
      person_name: personName,
      department: fieldText(staff, ["department"]),
      status: "present",
      check_in: action === "check_in" ? currentTime : fieldText(existing || {}, ["check_in", "time_in"]).replace("-", ""),
      check_out: action === "check_out" ? currentTime : fieldText(existing || {}, ["check_out", "time_out"]).replace("-", ""),
      ...(action === "check_in" ? { check_in_location: location } : { check_out_location: location }),
      notes: fieldText(existing || {}, ["notes"]).replace("-", ""),
      marked_by: data?.viewer?.username || username,
      marked_at: new Date().toISOString(),
    };
    setLoading(true);
    try {
      await apiFetch("/api/portal/attendance", {
        method: "POST",
        token,
        body: JSON.stringify(payload),
      });
      await loadPortal();
      setMessage(`${personName} ${action === "check_in" ? "checked in" : "checked out"}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Attendance could not be saved.");
    } finally {
      setLoading(false);
    }
  }

  async function saveLeaveRequest() {
    if (!leaveDraft.person_id || !leaveDraft.reason.trim()) {
      const text = "Select staff and enter a leave reason.";
      Platform.OS === "web" ? setMessage(text) : Alert.alert("Missing field", text);
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/api/portal/leave-requests", {
        method: "POST",
        token,
        body: JSON.stringify({
          ...leaveDraft,
          status: "Pending",
          requested_at: new Date().toISOString(),
        }),
      });
      setLeaveDraft((draft) => ({ ...emptyLeaveDraft, person_id: draft.person_id, person_name: draft.person_name, department: draft.department }));
      await loadPortal();
      setMessage("Leave request submitted for approval.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Leave request could not be saved.");
    } finally {
      setLoading(false);
    }
  }

  async function updateLeaveRequest(id: string, status: "Approved" | "Rejected") {
    setLoading(true);
    try {
      await apiFetch(`/api/portal/leave-requests/${encodeURIComponent(id)}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          status,
          approved_by: data?.viewer?.display_name || username,
          approved_at: new Date().toISOString(),
        }),
      });
      await loadPortal();
      setMessage(`Leave request ${status.toLowerCase()}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Leave request could not be updated.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) {
      loadPortal().catch((error) => {
        if (String(error.message || "").toLowerCase().includes("authentication")) {
          setToken("");
          setData(null);
          clearStoredSession();
        }
        setMessage(error.message);
      });
    }
  }, [token]);

  useEffect(() => {
    if (Platform.OS === "web" && typeof globalThis.localStorage !== "undefined") {
      const savedToken = globalThis.localStorage.getItem("fuzi_portal_token");
      if (savedToken) setToken(savedToken);
    }
  }, []);

  useEffect(() => {
    const allowed = data?.access?.allowed_views;
    if (allowed?.length && !allowed.includes(activeTab)) {
      setActiveTab((data?.access?.default_view as TabKey) || (allowed[0] as TabKey) || "overview");
    }
  }, [activeTab, data?.access]);

  useEffect(() => {
    if (!token || activeTab !== "breakdown") return;
    const interval = setInterval(() => {
      loadPortal().catch((error) => setMessage(error.message));
    }, 15000);
    return () => clearInterval(interval);
  }, [token, activeTab]);

  useEffect(() => {
    setCustomerPage(1);
    setEnquiryPage(1);
    setOfferPage(1);
  }, [crmSearch, crmStageFilter, data?.customers?.length]);

  function renderWebsiteHome() {
    return <PublicWebsite onOpenPortal={() => setShowPortalLogin(true)} />;
  }

  const nav = isWide ? (
    <ScrollView style={styles.sideNav} contentContainerStyle={styles.sideNavContent} showsVerticalScrollIndicator={false}>
      {visibleNavItems.map((item) => (
        <Pressable
          key={item.key}
          style={[styles.sideLink, activeTab === item.key && styles.sideLinkActive]}
          onPress={() => setActiveTab(item.key)}
        >
          <Text style={[styles.navIcon, activeTab === item.key && styles.navIconActive]}>{item.icon}</Text>
          <Text style={[styles.sideLinkText, activeTab === item.key && styles.sideLinkTextActive]}>{item.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  ) : (
    <ScrollView showsVerticalScrollIndicator={false} style={styles.tabs} contentContainerStyle={styles.mobileNavRail}>
      {visibleNavItems.map((item) => (
        <Pressable
          key={item.key}
          style={[styles.tab, activeTab === item.key && styles.activeTab]}
          onPress={() => setActiveTab(item.key)}
        >
          <Text style={[styles.tabIcon, activeTab === item.key && styles.activeTabText]}>{item.icon}</Text>
          <Text style={[styles.tabText, activeTab === item.key && styles.activeTabText]}>{item.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  if (!isSignedIn && !showPortalLogin) {
    return renderWebsiteHome();
  }

  if (!isSignedIn) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <View style={styles.loginShell}>
          <Text style={styles.logo}>FUZI</Text>
          <Text style={styles.title}>Operations Portal</Text>
          <Text style={styles.muted}>Secure operations workspace for web and mobile teams.</Text>
          <Pressable style={styles.homeLinkButton} onPress={() => setShowPortalLogin(false)}>
            <Text style={styles.homeLinkText}>Back to website home</Text>
          </Pressable>
          <TextInput style={styles.input} value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="Username" />
          <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Password" />
          <Pressable style={styles.primaryButton} onPress={() => signIn()} disabled={loading}>
            <Text style={styles.primaryButtonText}>{loading ? "Signing in..." : "Sign in"}</Text>
          </Pressable>
          <Text style={styles.cardLabel}>Quick role login</Text>
          <Text style={styles.muted}>Click a username to sign in with the shared staff portal password.</Text>
          <View style={styles.quickLoginGrid}>
            {quickLoginAccounts.map((account) => (
              <Pressable
                key={account.username}
                style={styles.quickLoginButton}
                onPress={() => {
                  setUsername(account.username);
                  setPassword(account.password);
                  signIn(account.username, account.password);
                }}
                disabled={loading}
              >
                <Text style={styles.quickLoginText}>{account.label}</Text>
                <Text style={styles.quickLoginSubLink}>{account.username}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.hint}>API: {apiBaseUrl}</Text>
          {!!message && <Text style={styles.error}>{message}</Text>}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={[styles.appShell, isWide && styles.appShellWide]}>
        {isWide && (
          <View style={styles.sidebar}>
            <View style={styles.sideBrand}>
              <View style={styles.brandMark}>
                <Text style={styles.brandMarkText}>FE</Text>
              </View>
              <Text style={styles.sideBrandText}>FUZI <Text style={styles.brandRed}>Ops</Text></Text>
            </View>
            {nav}
            <View style={styles.connectorCard}>
              <Text style={styles.connectorStatus}>Connectors online</Text>
              <Text style={styles.connectorCopy}>FSM, ERP, CRM, email, and portal APIs are connected through the Node backend.</Text>
            </View>
          </View>
        )}

        <View style={styles.main}>
          <View style={[styles.topbar, !isWide && styles.topbarMobile]}>
            <View style={styles.topTitleBlock}>
              <Text style={styles.eyebrow}>Operations Command Center</Text>
              <Text style={styles.topTitle}>Live Operations Dashboard</Text>
            </View>
            <View style={[styles.topActions, !isWide && styles.topActionsMobile]}>
              <View style={styles.syncPill}>
                <Text style={styles.syncPillText}>Synced {data?.synced_at || "now"}</Text>
              </View>
              <View style={styles.userPill}>
                <Text style={styles.userPillText}>{data?.viewer?.display_name || username}</Text>
              </View>
              <Pressable style={styles.ghostButton} onPress={() => loadPortal().catch((error) => setMessage(error.message))}>
                <Text style={styles.ghostButtonText}>Refresh</Text>
              </Pressable>
              <Pressable style={styles.ghostButton} onPress={signOut}>
                <Text style={styles.ghostButtonText}>Logout</Text>
              </Pressable>
            </View>
          </View>

          {!isWide && (
            <View style={styles.mobileBrandRow}>
              <View style={styles.sideBrand}>
                <View style={styles.brandMark}>
                  <Text style={styles.brandMarkText}>FE</Text>
                </View>
                <Text style={styles.sideBrandText}>FUZI <Text style={styles.brandRed}>Ops</Text></Text>
              </View>
              <Text style={styles.mobileDepartment}>{data?.viewer?.department || "Operations"}</Text>
            </View>
          )}

          {!isWide && nav}

          {loading && <ActivityIndicator style={styles.loader} />}
          {!!message && <Text style={styles.banner}>{message}</Text>}

          <ScrollView contentContainerStyle={styles.content}>
        {activeTab === "overview" && renderOverviewAnalytics()}

        {activeTab === "customers" && (
          renderCustomerCrmPage()
        )}

        {renderActiveFeaturePage()}

        {activeTab === "estimator" && renderEstimatorPage()}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#eef1f5" },
  homeSafe: { flex: 1, backgroundColor: "#0f1117" },
  homeScroll: { flex: 1, backgroundColor: "#0f1117" },
  homeContent: { minHeight: "100%", paddingBottom: 40 },
  homeNav: { minHeight: 72, paddingHorizontal: 24, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", backgroundColor: "rgba(10,10,18,0.96)", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
  homeBrand: { flexDirection: "row", alignItems: "center", gap: 12 },
  homeBrandMark: { width: 40, height: 40, borderRadius: 8, backgroundColor: "#e02020", alignItems: "center", justifyContent: "center" },
  homeBrandMarkText: { color: "#fff", fontWeight: "900", fontSize: 15 },
  homeBrandText: { color: "#fff", fontWeight: "900", fontSize: 17 },
  homeNavActions: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  homeNavButton: { minHeight: 40, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", paddingHorizontal: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" },
  homeNavButtonText: { color: "#fff", fontWeight: "900", fontSize: 13 },
  homePrimarySmall: { minHeight: 40, borderRadius: 8, backgroundColor: "#e02020", paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  homeHero: { paddingHorizontal: 24, paddingVertical: 72, flexDirection: "row", gap: 36, flexWrap: "wrap", alignItems: "center", justifyContent: "center" },
  homeHeroCopy: { flex: 1, minWidth: 300, maxWidth: 660, gap: 18 },
  homeEyebrow: { color: "#ff7070", fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.4 },
  homeTitle: { color: "#fff", fontSize: 58, lineHeight: 64, fontWeight: "900" },
  homeSubtitle: { color: "rgba(255,255,255,0.68)", fontSize: 17, lineHeight: 26, maxWidth: 620 },
  homeHeroActions: { flexDirection: "row", gap: 12, flexWrap: "wrap", marginTop: 8 },
  homePrimaryButton: { minHeight: 50, borderRadius: 10, backgroundColor: "#e02020", paddingHorizontal: 22, alignItems: "center", justifyContent: "center" },
  homePrimaryText: { color: "#fff", fontWeight: "900", fontSize: 13 },
  homeSecondaryButton: { minHeight: 50, borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", backgroundColor: "rgba(255,255,255,0.08)", paddingHorizontal: 20, alignItems: "center", justifyContent: "center" },
  homeSecondaryText: { color: "#fff", fontWeight: "900", fontSize: 13 },
  homeStats: { flexDirection: "row", flexWrap: "wrap", gap: 28, marginTop: 30, paddingTop: 24, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" },
  homeStatValue: { color: "#fff", fontWeight: "900", fontSize: 28 },
  homeStatLabel: { color: "rgba(255,255,255,0.55)", fontWeight: "700", fontSize: 12, marginTop: 4 },
  homeHeroPanel: { width: 380, maxWidth: "100%", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.06)", padding: 24, gap: 12 },
  homePanelLabel: { color: "#ff7070", fontWeight: "900", fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2 },
  homePanelTitle: { color: "#fff", fontWeight: "900", fontSize: 24, lineHeight: 30 },
  homePanelText: { color: "rgba(255,255,255,0.66)", fontSize: 14, lineHeight: 22 },
  homePanelList: { gap: 8, marginTop: 6 },
  homePanelItem: { color: "#fff", fontWeight: "800", fontSize: 13, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, backgroundColor: "rgba(0,0,0,0.16)", overflow: "hidden" },
  homeServices: { paddingHorizontal: 24, paddingBottom: 36, flexDirection: "row", gap: 12, flexWrap: "wrap", justifyContent: "center" },
  homeServiceCard: { width: 270, minHeight: 116, borderRadius: 8, backgroundColor: "#fff", padding: 16, gap: 8 },
  homeServiceTitle: { color: "#11131b", fontWeight: "900", fontSize: 16 },
  homeServiceText: { color: "#747b8d", fontSize: 13, lineHeight: 19 },
  appShell: { flex: 1, backgroundColor: "#eef1f5" },
  appShellWide: { flexDirection: "row" },
  sidebar: { width: 280, backgroundColor: "#11131b", padding: 22, gap: 18 },
  sideBrand: { flexDirection: "row", alignItems: "center", gap: 12 },
  brandMark: { width: 42, height: 42, borderRadius: 8, backgroundColor: "#e02020", alignItems: "center", justifyContent: "center" },
  brandMarkText: { color: "#fff", fontWeight: "900", fontSize: 15 },
  sideBrandText: { color: "#fff", fontWeight: "900", fontSize: 18 },
  brandRed: { color: "#e02020" },
  sideNav: { flex: 1 },
  sideNavContent: { gap: 8, paddingBottom: 8 },
  sideLink: { minHeight: 44, borderRadius: 10, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "transparent" },
  sideLinkActive: { backgroundColor: "rgba(224,32,32,0.16)", borderWidth: 1, borderColor: "rgba(224,32,32,0.32)" },
  navIcon: { width: 24, color: "#9aa1b3", fontWeight: "900", textAlign: "center", fontSize: 16, lineHeight: 18 },
  navIconActive: { color: "#fff" },
  sideLinkText: { color: "#c5cad6", fontWeight: "800", fontSize: 13 },
  sideLinkTextActive: { color: "#fff" },
  connectorCard: { borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.06)", padding: 14, gap: 8 },
  connectorStatus: { color: "#fff", fontWeight: "900", fontSize: 13 },
  connectorCopy: { color: "rgba(255,255,255,0.62)", fontSize: 12, lineHeight: 18 },
  main: { flex: 1, minWidth: 0 },
  topbar: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e4e7ee", paddingHorizontal: 24, paddingVertical: 18, gap: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" },
  topbarMobile: { paddingHorizontal: 16, alignItems: "stretch" },
  topTitleBlock: { gap: 3 },
  eyebrow: { color: "#e02020", fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.6 },
  topTitle: { color: "#11131b", fontSize: 26, fontWeight: "900" },
  topActions: { flexDirection: "row", gap: 10, alignItems: "center", flexWrap: "wrap" },
  topActionsMobile: { width: "100%", justifyContent: "flex-start" },
  syncPill: { borderWidth: 1, borderColor: "#e4e7ee", backgroundColor: "#f3f5f8", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9 },
  syncPillText: { color: "#2d3240", fontWeight: "800", fontSize: 12 },
  userPill: { borderWidth: 1, borderColor: "#e4e7ee", backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9 },
  userPillText: { color: "#2d3240", fontWeight: "800", fontSize: 12 },
  mobileBrandRow: { paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "#11131b", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mobileDepartment: { color: "rgba(255,255,255,0.7)", fontWeight: "800", fontSize: 12 },
  tabs: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e4e7ee" },
  mobileNavRail: { gap: 8, padding: 12, flexDirection: "row", flexWrap: "wrap" },
  tab: { minWidth: 126, minHeight: 46, borderRadius: 10, borderWidth: 1, borderColor: "#e4e7ee", backgroundColor: "#fff", alignItems: "center", justifyContent: "center", paddingHorizontal: 10, flexDirection: "row", gap: 7 },
  activeTab: { backgroundColor: "#e02020", borderColor: "#e02020" },
  tabIcon: { color: "#747b8d", fontSize: 14, lineHeight: 16, fontWeight: "900" },
  tabText: { fontWeight: "900", color: "#2d3240", fontSize: 11, textAlign: "center" },
  activeTabText: { color: "#fff" },
  content: { padding: 24, gap: 16, paddingBottom: 46, maxWidth: 1240, width: "100%", alignSelf: "center" },
  commandBand: { borderRadius: 12, backgroundColor: "#11131b", padding: 22, borderWidth: 1, borderColor: "rgba(224,32,32,0.24)", marginBottom: 8 },
  commandCopy: { gap: 8 },
  commandTitle: { color: "#fff", fontSize: 24, lineHeight: 30, fontWeight: "900" },
  commandText: { color: "rgba(255,255,255,0.68)", fontSize: 14, lineHeight: 22 },
  moduleHero: { borderRadius: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e4e7ee", padding: 18, gap: 8, marginBottom: 12 },
  moduleHeroTitle: { color: "#11131b", fontSize: 24, fontWeight: "900" },
  moduleHeroText: { color: "#747b8d", fontSize: 14, lineHeight: 22 },
  sectionTitle: { fontSize: 19, fontWeight: "900", color: "#11131b", marginTop: 10, marginBottom: 8 },
  metricGrid: { gap: 12 },
  card: { backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#e4e7ee", padding: 16, marginBottom: 10, shadowColor: "#11131b", shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
  kanbanBoard: { gap: 12, paddingVertical: 4, paddingRight: 12 },
  kanbanColumn: { width: 292, minHeight: 360, borderRadius: 8, borderWidth: 1, borderColor: "#dfe4ed", backgroundColor: "#f8fafc", padding: 10, gap: 10 },
  kanbanColumnHeader: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, borderBottomWidth: 1, borderBottomColor: "#e4e7ee", paddingBottom: 8 },
  kanbanCard: { borderRadius: 8, borderWidth: 1, borderColor: "#e4e7ee", backgroundColor: "#fff", padding: 12, gap: 6 },
  kanbanEmpty: { minHeight: 82, borderRadius: 8, borderWidth: 1, borderColor: "#e4e7ee", borderStyle: "dashed", backgroundColor: "#fff", padding: 12, justifyContent: "center" },
  analyticsPanel: { backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#e4e7ee", padding: 14, gap: 12, marginBottom: 10 },
  analyticsRow: { gap: 7 },
  analyticsRowHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  analyticsBarTrack: { height: 10, borderRadius: 999, backgroundColor: "#eef1f5", overflow: "hidden" },
  analyticsBarFill: { height: "100%", borderRadius: 999, backgroundColor: "#e02020" },
  linkedSystemsPanel: { borderWidth: 1, borderColor: "#e4e7ee", borderRadius: 8, backgroundColor: "#f8fafc", padding: 10, marginTop: 8, gap: 4 },
  alertCard: { borderColor: "rgba(224,32,32,0.4)", backgroundColor: "#fffafa" },
  portalShortcut: { backgroundColor: "#fff", borderRadius: 8, borderWidth: 2, borderColor: "#e02020", padding: 16, marginBottom: 10, gap: 6 },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" },
  cardTitleBlock: { flex: 1, minWidth: 220 },
  formCard: { backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#e4e7ee", padding: 16, gap: 11, marginBottom: 12 },
  formGrid: { gap: 10 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" },
  cardLabel: { color: "#e02020", fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8 },
  cardTitle: { color: "#11131b", fontSize: 16, fontWeight: "900", marginBottom: 5 },
  metricValue: { color: "#11131b", fontSize: 28, fontWeight: "900", marginVertical: 5 },
  inventoryStats: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12, marginBottom: 6 },
  inventoryStat: { minWidth: 105, borderWidth: 1, borderColor: "#e4e7ee", borderRadius: 8, backgroundColor: "#f8fafc", padding: 10 },
  inventoryValue: { color: "#11131b", fontSize: 20, fontWeight: "900", marginTop: 4 },
  warningText: { color: "#b91414" },
  inlineEditRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, flexWrap: "wrap", marginTop: 12 },
  inlineEditField: { minWidth: 120, gap: 6 },
  inlineRecordEditor: { marginTop: 12, borderTopWidth: 1, borderTopColor: "#e4e7ee", paddingTop: 12, gap: 10 },
  compactInput: { minHeight: 38, borderWidth: 1, borderColor: "#e4e7ee", borderRadius: 8, backgroundColor: "#fff", paddingHorizontal: 10, color: "#11131b", fontWeight: "800" },
  paginationBar: { backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#e4e7ee", padding: 12, marginBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },
  bodyText: { color: "#2d3240", fontSize: 14, marginTop: 4, lineHeight: 20 },
  muted: { color: "#747b8d", fontSize: 13, lineHeight: 19 },
  statusPill: { color: "#b91414", backgroundColor: "#fff5f5", borderWidth: 1, borderColor: "rgba(224,32,32,0.2)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, overflow: "hidden", fontWeight: "900", fontSize: 11 },
  field: { gap: 6 },
  label: { color: "#11131b", fontWeight: "900", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { minHeight: 46, borderWidth: 1, borderColor: "#e4e7ee", borderRadius: 10, backgroundColor: "#f3f5f8", paddingHorizontal: 12, color: "#11131b", fontWeight: "700" },
  textarea: { minHeight: 92, paddingTop: 10, textAlignVertical: "top" },
  costingSourcePanel: { borderWidth: 1, borderColor: "#e4e7ee", borderRadius: 8, backgroundColor: "#fff", padding: 12, gap: 12 },
  costingStepper: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  costingStepMeta: { flex: 1, minWidth: 220 },
  costingCellList: { borderWidth: 1, borderColor: "#e4e7ee", borderRadius: 8, overflow: "hidden" },
  costingCellRow: { padding: 10, borderBottomWidth: 1, borderBottomColor: "#e4e7ee", backgroundColor: "#f8fafc", gap: 4 },
  costingCellRef: { color: "#b91414", fontWeight: "900", fontSize: 12 },
  costingCellValue: { color: "#11131b", fontWeight: "800", fontSize: 12 },
  costingCellFormula: { color: "#747b8d", fontWeight: "700", fontSize: 11 },
  emptyState: { borderWidth: 1, borderColor: "#e4e7ee", borderRadius: 8, padding: 12, backgroundColor: "#f8fafc" },
  openingSchedulePanel: { borderWidth: 1, borderColor: "#e4e7ee", borderRadius: 8, backgroundColor: "#fff", padding: 12, gap: 10 },
  openingScheduleRow: { borderWidth: 1, borderColor: "#e4e7ee", borderRadius: 8, backgroundColor: "#f8fafc", padding: 10, gap: 8 },
  openingScheduleField: { gap: 6 },
  statusSelectorPanel: { borderWidth: 1, borderColor: "#e4e7ee", borderRadius: 8, backgroundColor: "#fff", padding: 12, gap: 10, marginTop: 10 },
  statusChoiceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusChoice: { minHeight: 34, borderRadius: 8, borderWidth: 1, borderColor: "#d5dae4", backgroundColor: "#f3f5f8", paddingHorizontal: 10, paddingVertical: 7, justifyContent: "center" },
  statusChoiceActive: { backgroundColor: "#fff5f5", borderColor: "#e02020" },
  statusChoiceText: { color: "#2d3240", fontWeight: "900", fontSize: 11 },
  statusChoiceTextActive: { color: "#b91414" },
  selectorList: { gap: 8 },
  selectorPill: { borderWidth: 1, borderColor: "#e4e7ee", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#f3f5f8" },
  selectorPillActive: { backgroundColor: "rgba(224,32,32,0.1)", borderColor: "#e02020" },
  selectorText: { color: "#2d3240", fontWeight: "800" },
  selectorTextActive: { color: "#b91414" },
  dropdownButton: { minHeight: 48, borderWidth: 1, borderColor: "#e4e7ee", borderRadius: 10, backgroundColor: "#f3f5f8", paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  dropdownChevron: { color: "#747b8d", fontWeight: "900", fontSize: 12 },
  dropdownPanel: { borderWidth: 1, borderColor: "#e4e7ee", borderRadius: 10, backgroundColor: "#fff", padding: 10, gap: 8 },
  dropdownScroll: { maxHeight: 280 },
  dropdownOption: { borderBottomWidth: 1, borderBottomColor: "#e4e7ee", paddingVertical: 10, gap: 2 },
  primaryButton: { minHeight: 48, borderRadius: 10, backgroundColor: "#e02020", alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  primaryButtonInline: { minHeight: 44, borderRadius: 10, backgroundColor: "#e02020", alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  primaryButtonText: { color: "#fff", fontWeight: "900" },
  secondaryButton: { minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: "#d5dae4", backgroundColor: "#fff", alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  secondaryButtonText: { color: "#2d3240", fontWeight: "900" },
  inlineActions: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 12 },
  smallButton: { minHeight: 36, borderRadius: 8, borderWidth: 1, borderColor: "#d5dae4", backgroundColor: "#f3f5f8", paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  smallButtonText: { color: "#2d3240", fontWeight: "900", fontSize: 12 },
  smallButtonHint: { color: "#747b8d", fontWeight: "700", fontSize: 10, marginTop: 2, textAlign: "center" },
  dangerButton: { minHeight: 36, borderRadius: 8, borderWidth: 1, borderColor: "rgba(224,32,32,0.35)", backgroundColor: "#fff5f5", paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  dangerButtonText: { color: "#b91414", fontWeight: "900", fontSize: 12 },
  ghostButton: { borderWidth: 1, borderColor: "#e4e7ee", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: "#fff" },
  ghostButtonText: { color: "#2d3240", fontWeight: "900" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(17,19,27,0.52)", alignItems: "center", justifyContent: "center", padding: 16 },
  modalCard: { width: "100%", maxWidth: 960, maxHeight: "92%", backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#d5dae4", overflow: "hidden" },
  modalHeader: { padding: 18, borderBottomWidth: 1, borderBottomColor: "#e4e7ee", flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "center" },
  modalScroll: { maxHeight: 560 },
  modalContent: { padding: 18, gap: 12 },
  modalActions: { padding: 18, borderTopWidth: 1, borderTopColor: "#e4e7ee", flexDirection: "row", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" },
  loader: { marginVertical: 8 },
  banner: { marginHorizontal: 24, marginTop: 10, padding: 12, color: "#b91414", backgroundColor: "#fff5f5", borderColor: "rgba(224,32,32,0.18)", borderWidth: 1, borderRadius: 10, overflow: "hidden", fontWeight: "800" },
  loginShell: { flex: 1, justifyContent: "center", padding: 28, gap: 14, maxWidth: 480, width: "100%", alignSelf: "center", backgroundColor: "#fff" },
  logo: { fontSize: 44, fontWeight: "900", color: "#e02020" },
  logoSmall: { fontSize: 20, fontWeight: "900", color: "#11131b" },
  title: { fontSize: 28, fontWeight: "900", color: "#11131b" },
  quickLoginGrid: { gap: 8 },
  quickLoginButton: { borderWidth: 1, borderColor: "#e4e7ee", borderRadius: 8, backgroundColor: "#f3f5f8", paddingHorizontal: 12, paddingVertical: 10 },
  quickLoginText: { color: "#11131b", fontWeight: "900", fontSize: 13 },
  quickLoginSub: { color: "#747b8d", fontWeight: "700", fontSize: 11, marginTop: 2 },
  quickLoginSubLink: { color: "#b91414", fontWeight: "900", fontSize: 11, marginTop: 2, textDecorationLine: "underline" },
  inlineMeta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 4 },
  clickableUsername: { color: "#b91414", fontWeight: "900", textDecorationLine: "underline" },
  homeLinkButton: { minHeight: 40, borderRadius: 8, borderWidth: 1, borderColor: "#d5dae4", backgroundColor: "#fff", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  homeLinkText: { color: "#2d3240", fontWeight: "900", fontSize: 13 },
  error: { color: "#b91414", fontWeight: "800" },
  hint: { color: "#747b8d", fontSize: 12 },
});
