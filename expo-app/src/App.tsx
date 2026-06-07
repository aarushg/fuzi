import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
  | "marketing"
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
  { key: "marketing", label: "Marketing Platform", icon: "✦" },
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

const quickLoginAccounts = [
  { label: "Admin", username: "admin" },
  { label: "CEO", username: "atul.singhal" },
  { label: "Installation Head", username: "ashwani.kumar" },
  { label: "Breakdown Head", username: "bhanwar.choudhary" },
  { label: "Service Head", username: "jitendra.choudhary" },
  { label: "GAD Head", username: "diyanshu.bansal" },
  { label: "Accounts Head", username: "sandeep.sharma" },
  { label: "Commissioning Head", username: "vishram.kumawat" },
  { label: "Tender Head", username: "bharat.singh.choudhary" },
  { label: "Factory Head", username: "roopchand.gurjar" },
  { label: "Back Office Head", username: "jitendra.singh.hada" },
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
  marketing: { route: "/api/portal/marketing-assets", titleLabel: "Campaign", titleKey: "campaign_name", customerKey: "channel", notesKey: "notes" },
  comms: { route: "/api/portal/comms", titleLabel: "Subject", titleKey: "subject", customerKey: "department", notesKey: "message" },
};

const emptyModuleDraft = { title: "", customer: "", customer_id: "", status: "Open", notes: "" };
const emptyPaymentDraft = {
  payment_type: "Contract",
  customer_id: "",
  customer_name: "",
  estimate_id: "",
  milestone: "Advance",
  amount: "",
  contract_basic_value: "",
  basic_check_value: "",
  basic_cash_value: "",
  basic_card_value: "",
  gst_percent: "18",
  amount_received_check: "",
  amount_received_cash: "",
  amount_received_card: "",
  credit_card_charge_percent: "2",
  outstanding_date: "",
  reminder_interval_days: "7",
  next_reminder_date: "",
  amc_from_date: "",
  amc_to_date: "",
  due_date: "",
  method: "NEFT",
  cheque_number: "",
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
  purchase_price: "",
  current_price: "",
  sale_price: "",
  price_date: new Date().toISOString().slice(0, 10),
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

const emptyMarketingDraft = {
  campaign_name: "FUZI elevator campaign",
  asset_type: "AI ad image",
  product_line: "Passenger elevators, home lifts, hospital lifts, goods lifts, and manufactured elevator parts",
  audience: "Builders, architects, hospitals, hotels, housing societies, factories, and elevator partner companies",
  channel: "Instagram, Facebook, WhatsApp, email, and catalog",
  tone: "Premium, safe, reliable, engineered in India",
  headline: "Elevating Lives, One Floor at a Time",
  ad_copy: "FUZI Classic Elevators delivers safe, elegant, and dependable elevator solutions for residential, commercial, hospital, hotel, and industrial projects.",
  ai_prompt: "Create a premium advertising image for FUZI Classic Elevators showing a modern elevator in a clean Indian commercial/residential setting with red, white, and black FUZI branding, professional lighting, space for headline text, and a trustworthy safety-focused mood.",
  catalog_title: "FUZI Classic Elevators Company Catalog",
  catalog_sections: "Company profile; Passenger elevators; Home lifts; Hospital lifts; Goods lifts; Escalators; Manufactured parts and kits; Safety and certifications; Installation process; AMC and support; Contact details",
  design_notes: "Use FUZI red/black/white, clean product photography style, clear headings, technical trust, and practical customer benefits.",
  status: "Draft",
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
const emptyInstallationDraft = {
  id: "",
  customer_id: "",
  project_name: "",
  lift_reference: "",
  status: "Site Visit Pending",
  assigned_team: "",
  contractor: "",
  engineer: "",
  start_date: "",
  completion_date: "",
  approved_by: "",
  approval_date: "",
  approval_remarks: "",
  motor_make: "",
  motor_model_number: "",
  motor_sticker_photo: "",
  door_make: "",
  controller_make: "",
  controller_type: "Closed Loop",
  controller_communication: "Full Serial",
  protocol: "Protocol",
  controller_username: "",
  controller_password: "",
  drive_model_number: "",
  ard_or_ups: "",
  ard_make: "",
  battery_size: "",
  battery_make: "",
  battery_quantity: "",
  battery_warranty_expiry: "",
  door_sensor_make: "",
  lop_make: "",
  cop_make: "",
  button_type: "Push Button",
  building_photo: "",
  site_photo_url: "",
  lift_video_url: "",
  lift_well_construction: "Complete",
  expected_completion_date: "",
  site_readiness_notes: "",
  panni_removed: "No",
  panni_removal_date: "",
  granite_required: "No",
  granite_status: "Pending",
  granite_completion_date: "",
  granite_remarks: "",
  installed_by: "",
  commissioned_by: "",
  handed_over_by: "",
  handed_over_date: "",
  warranty_start_date: "",
  warranty_end_date: "",
  final_remarks: "",
  contractor_name: "",
  contractor_mobile: "",
  contractor_email: "",
  contractor_gst: "",
  contractor_address: "",
  contractor_bank_details: "",
  contract_value: "",
  payment_terms: "",
  contractor_payment_amount: "",
  contractor_payment_date: "",
  contractor_payment_method: "",
  contractor_payment_remarks: "",
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
  customer_id: "",
  customer: "",
  site: "",
  assigned_engineer: "",
  controller_type: "Closed loop",
  drive_model_number: "",
  motor_serial_number: "",
  motor_nameplate_url: "",
  motor_nameplate_file: "",
  communication_link: "Serial link",
  protocol_required: "Y",
  protocol_type: "",
  commissioning_details: "",
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
const emptyTenderDraft = {
  id: "",
  job_number: "",
  file_number: "",
  tender_invited_by: "",
  party_name: "",
  tender_due_at: new Date().toISOString().slice(0, 16),
  status: "Tender Pending",
  product_type: "Lift",
  price_in_nit: "",
  warranty_period: "",
  dlp_period: "",
  emd_amount: "",
  emd_deposited_by: "DD",
  emd_deposit_date: new Date().toISOString().slice(0, 10),
  emd_deposit_amount: "",
  passenger_capacity: "",
  number_of_stops: "",
  speed: "",
  door_finish: "Hairline",
  cabin_finish: "Hairline",
  door_size: "",
  door_width_mm: "",
  door_height_mm: "",
  lift_quantity: "1",
  location_type: "Indoor",
  escalator_degree: "30",
  step_width_mm: "",
  quoted_price: "",
  escalator_quantity: "1",
  opening_date: "",
  total_parties_participated: "",
  party_name_entry: "",
  quoted_rates_entry: "",
  lowest_party_name: "",
  lowest_rates: "",
  order_number: "",
  order_date: "",
  order_value: "",
  agreement_number: "",
  basic_value: "",
  gst_amount: "",
  gross_order_amount: "",
  stipulated_work_start_date: "",
  completion_date: "",
  order_file_number: "",
  bill_number: "",
  bill_date: "",
  bill_amount: "",
  billing_period: "",
  payment_received: "No",
  payment_received_date: "",
  sd_amount: "",
  sd_deposited_by: "DD",
  sd_deposit_date: "",
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
  inventory_items: [],
  inventory_material_total: "",
  inventory_pricing_source: "",
  site_visit_id: "",
  site_measurements_source: "",
  site_address: "",
  pit_size_mm: "",
  machine_room_available: "",
  floor_height_profile: "",
  site_stops: "",
  site_number_of_openings: "",
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
  opening_schedule_summary: "",
  opening_schedule: [],
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
  date_of_birth: "",
  anniversary_date: "",
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
  { key: "date_of_birth", label: "Date of birth YYYY-MM-DD" },
  { key: "anniversary_date", label: "Anniversary date YYYY-MM-DD" },
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

const projectDepartments = [
  "Sales",
  "Engineering",
  "Operations",
  "Project Management",
  "Finance",
  "Customer Success",
  "Support",
  "QA",
  "Compliance",
];

const mandatoryInstallationTests = [
  "Floor to Floor Level",
  "Overload Test",
  "ARD Test",
  "Locking System Test",
  "Overspeed Test",
  "Door Sensor Test",
];

function formatMoney(value?: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);
}

function formatMoneyExact(value?: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
}

function offerNumber(value: unknown, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function addDays(dateValue: unknown, daysValue: unknown) {
  const date = new Date(String(dateValue || new Date().toISOString().slice(0, 10)));
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + Math.max(0, offerNumber(daysValue)));
  return date.toISOString().slice(0, 10);
}

function paymentAccountSummary(record: Record<string, unknown>) {
  const contractBasic = offerNumber(record.contract_basic_value || record.basic_contract_value || record.contract_value || record.amount);
  const basicCheck = offerNumber(record.basic_check_value || record.check_basic_value || record.check_value);
  const basicCash = offerNumber(record.basic_cash_value || record.cash_basic_value || record.cash_value);
  const basicCard = offerNumber(record.basic_card_value || record.card_basic_value || record.credit_card_value);
  const gstPercent = offerNumber(record.gst_percent, 18);
  const cardChargePercent = offerNumber(record.credit_card_charge_percent || record.card_charge_percent, 2);
  const checkGst = Number((basicCheck * gstPercent / 100).toFixed(2));
  const cardCharge = Number((basicCard * cardChargePercent / 100).toFixed(2));
  const finalContract = Number((basicCheck + checkGst + basicCash + basicCard + cardCharge).toFixed(2));
  const receivedCheck = offerNumber(record.amount_received_check || record.received_check || (String(record.method || "").toLowerCase().includes("check") ? record.amount : 0));
  const receivedCash = offerNumber(record.amount_received_cash || record.received_cash || (String(record.method || "").toLowerCase().includes("cash") ? record.amount : 0));
  const receivedCard = offerNumber(record.amount_received_card || record.received_card || (String(record.method || "").toLowerCase().includes("card") ? record.amount : 0));
  const receivedTotal = receivedCheck + receivedCash + receivedCard;
  const outstandingCheck = Number(Math.max(0, basicCheck + checkGst - receivedCheck).toFixed(2));
  const outstandingCash = Number(Math.max(0, basicCash - receivedCash).toFixed(2));
  const outstandingCard = Number(Math.max(0, basicCard + cardCharge - receivedCard).toFixed(2));
  const outstandingTotal = Number(Math.max(0, finalContract - receivedTotal).toFixed(2));
  const splitMatches = Math.abs(contractBasic - (basicCheck + basicCash + basicCard)) < 0.01;
  const nextReminder = String(record.next_reminder_date || addDays(record.outstanding_date || record.due_date, record.reminder_interval_days || 7));
  return { contractBasic, basicCheck, basicCash, basicCard, gstPercent, cardChargePercent, checkGst, cardCharge, finalContract, receivedCheck, receivedCash, receivedCard, receivedTotal, outstandingCheck, outstandingCash, outstandingCard, outstandingTotal, splitMatches, nextReminder };
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

function inventoryPrice(record: Record<string, unknown>) {
  return offerNumber(record.current_price || record.sale_price || record.unit_price || record.unit_cost || record.purchase_price);
}

function offerInventoryLines(record: Record<string, unknown>) {
  return Array.isArray(record.inventory_items) ? record.inventory_items as Array<Record<string, unknown>> : [];
}

function offerInventoryTotal(record: Record<string, unknown>) {
  return offerInventoryLines(record).reduce((sum, line) => {
    const qty = offerNumber(line.qty, 1) || 1;
    const price = offerNumber(line.current_price || line.unit_price || line.sale_price || line.unit_cost);
    return sum + qty * price;
  }, 0);
}

function currentFiscalYearRange() {
  const today = new Date();
  const year = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  return { start: `${year}-04-01`, end: `${year + 1}-03-31` };
}

export default function App() {
  const { width } = useWindowDimensions();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [data, setData] = useState<PortalData | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [showPortalLogin, setShowPortalLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [overviewStartDate, setOverviewStartDate] = useState(currentFiscalYearRange().start);
  const [overviewEndDate, setOverviewEndDate] = useState(currentFiscalYearRange().end);
  const [projectNow, setProjectNow] = useState(() => Date.now());
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
  const [installationDraft, setInstallationDraft] = useState<Record<string, string>>(emptyInstallationDraft);
  const [installationCustomerSearch, setInstallationCustomerSearch] = useState("");
  const [installationSearch, setInstallationSearch] = useState("");
  const [installationStatusFilter, setInstallationStatusFilter] = useState("All");
  const [installationReportStart, setInstallationReportStart] = useState("");
  const [installationReportEnd, setInstallationReportEnd] = useState("");
  const [installTeamDraft, setInstallTeamDraft] = useState(emptyInstallTeamDraft);
  const [commissioningDraft, setCommissioningDraft] = useState(emptyCommissioningDraft);
  const [attendanceDraft, setAttendanceDraft] = useState(emptyAttendanceDraft);
  const [leaveDraft, setLeaveDraft] = useState(emptyLeaveDraft);
  const [tenderDraft, setTenderDraft] = useState<Record<string, string>>(emptyTenderDraft);
  const [tenderSearch, setTenderSearch] = useState("");
  const [tenderStatusFilter, setTenderStatusFilter] = useState("All");
  const [hrSearch, setHrSearch] = useState("");
  const [hrDepartmentFilter, setHrDepartmentFilter] = useState("All");
  const [crmSearch, setCrmSearch] = useState("");
  const [crmStageFilter, setCrmStageFilter] = useState("All");
  const [crmStaffFilter, setCrmStaffFilter] = useState("");
  const [crmDepartmentFilter, setCrmDepartmentFilter] = useState("All");
  const [crmTeamFilter, setCrmTeamFilter] = useState("All");
  const [customerPage, setCustomerPage] = useState(1);
  const [enquiryPage, setEnquiryPage] = useState(1);
  const [offerPage, setOfferPage] = useState(1);
  const [accountDraft, setAccountDraft] = useState(emptyAccountDraft);
  const [renewalDraft, setRenewalDraft] = useState(emptyRenewalDraft);
  const [inventoryDraft, setInventoryDraft] = useState(emptyInventoryDraft);
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryEdits, setInventoryEdits] = useState<Record<string, { reorder_point: string; target_stock: string; current_price: string; purchase_price: string; price_date: string }>>({});
  const [internationalVendorDraft, setInternationalVendorDraft] = useState(emptyInternationalVendorDraft);
  const [internationalVendorSearch, setInternationalVendorSearch] = useState("");
  const [internationalVendorFilter, setInternationalVendorFilter] = useState("All");
  const [internationalVendorPage, setInternationalVendorPage] = useState(1);
  const [marketingDraft, setMarketingDraft] = useState(emptyMarketingDraft);
  const [marketingSearch, setMarketingSearch] = useState("");
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
  const normalizedKey = (value: unknown) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
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
        // current_job is the task text shown everywhere; active_breakdown is only a boolean state flag.
        const savedAvailability = String(person.availability || "").trim();
        const savedNextAvailable = String(person.next_available_at || "").trim();
        return {
          id: String(person.id || name),
          org_id: String(person.id || ""),
          name,
          role: String(person.title || "Breakdown Staff"),
          phone: String(person.phone || linkedUser?.phone || ""),
          availability: String(linkedUser?.active === false ? "Inactive" : (activeTask ? "Scheduled" : (savedAvailability || "Available"))),
          current_job: activeTask,
          active_breakdown: Boolean(activeBreakdownByEngineer.get(name.trim().toLowerCase())),
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
  const customerStaffDirectory = useMemo(() => {
    const usersByOrgNode = new Map(asRecords(data?.users).map((user) => [String(user.linked_org_node || ""), user]));
    const usersByName = new Map(asRecords(data?.users).map((user) => [normalizedKey(user.display_name || user.username), user]));
    const staff = [
      ...asRecords(data?.org_chart).map((person) => {
        const name = String(person.name || person.display_name || "").trim();
        const linkedUser = usersByOrgNode.get(String(person.id || "")) || usersByName.get(normalizedKey(name));
        return {
          id: String(person.id || linkedUser?.id || linkedUser?.username || name),
          name,
          department: String(person.department || linkedUser?.department || "Unassigned"),
          role: String(person.title || person.position || linkedUser?.title || linkedUser?.role || ""),
          avatar_url: String(person.avatar_url || person.profile_avatar || linkedUser?.avatar_url || ""),
        };
      }),
      ...asRecords(data?.users).map((user) => ({
        id: String(user.linked_org_node || user.id || user.username || user.display_name || ""),
        name: String(user.display_name || user.username || "").trim(),
        department: String(user.department || "Unassigned"),
        role: String(user.title || user.position || user.role || ""),
        avatar_url: String(user.avatar_url || ""),
      })),
    ].filter((person) => person.id && person.name);
    const seen = new Set<string>();
    return staff.filter((person) => {
      const key = normalizedKey(person.id || person.name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);
  const customerAssignmentOptions = useMemo(() => {
    const activeAssignments = asRecords(data?.customer_assignments).filter((item) => item.active_status !== false && String(item.active_status || "true").toLowerCase() !== "false");
    const departments = new Set<string>();
    const teams = new Set<string>();
    activeAssignments.forEach((item) => {
      const department = String(item.department || "").trim();
      const role = String(item.role || item.position || "").trim();
      if (department) departments.add(department);
      if (role) teams.add(role);
    });
    customerStaffDirectory.forEach((person) => {
      if (person.department) departments.add(person.department);
      if (person.role) teams.add(person.role);
    });
    return {
      departments: ["All", ...[...departments].sort()],
      teams: ["All", ...[...teams].sort()],
    };
  }, [customerStaffDirectory, data?.customer_assignments]);
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
    // current_job contains the displayable task id/details; active_breakdown stays boolean.
    const currentJob = String(member.current_job || "").trim();
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

  function openingScheduleSummaryFromRows(rows: unknown) {
    if (!Array.isArray(rows)) return "";
    return rows
      .map((item, index) => {
        const row = item as Record<string, unknown>;
        const floor = String(row.floor || (index === 0 ? "Ground" : index)).trim();
        const ff = String(row.ff_height_mm || "").trim();
        const lintel = String(row.lintel_height_mm || "").trim();
        return `${floor}: FF ${ff || "-"} mm, lintel ${lintel || "-"} mm`;
      })
      .filter(Boolean)
      .join("; ");
  }

  function siteVisitsForCustomerId(customerId: unknown) {
    const id = String(customerId || "").trim();
    if (!id) return [];
    return asRecords(data?.site_visits)
      .filter((visit) => String(visit.customer_id || "").trim() === id)
      .sort((a, b) => String(b.updated_at || b.site_visit_date || b.created_at || "").localeCompare(String(a.updated_at || a.site_visit_date || a.created_at || "")));
  }

  function offerMeasurementPayloadFromSiteVisit(visit?: Record<string, unknown>): Record<string, any> {
    if (!visit) return { site_measurements_source: "No site visit linked yet" };
    const capacityKg = String(visit.site_capacity_kg || "").trim();
    const capacityPersons = String(visit.site_capacity_persons || "").trim();
    const capacity = capacityKg ? `${capacityKg} kg` : capacityPersons ? `${capacityPersons} persons` : "";
    const openingSummary = openingScheduleSummaryFromRows(visit.opening_schedule);
    return {
      site_visit_id: recordIdentity(visit),
      site_measurements_source: `Site visit ${recordIdentity(visit) || ""}${visit.site_visit_date ? ` on ${visit.site_visit_date}` : ""}`.trim(),
      site_address: String(visit.address || "").trim(),
      pit_size_mm: String(visit.pit_size_mm || "").trim(),
      machine_room_available: String(visit.machine_room_available || "").trim(),
      floor_height_profile: String(visit.floor_height_profile || "").trim(),
      site_stops: String(visit.site_stops || "").trim(),
      site_number_of_openings: String(visit.site_number_of_openings || "").trim(),
      site_opening_type: String(visit.site_opening_type || "").trim(),
      door_size_width_mm: String(visit.door_size_width_mm || "").trim(),
      door_size_height_mm: String(visit.door_size_height_mm || "").trim(),
      car_size_width_mm: String(visit.car_size_width_mm || "").trim(),
      car_size_depth_mm: String(visit.car_size_depth_mm || "").trim(),
      site_capacity_persons: String(visit.site_capacity_persons || "").trim(),
      site_capacity_kg: capacityKg,
      shaft_width_mm: String(visit.shaft_width_mm || "").trim(),
      shaft_depth_mm: String(visit.shaft_depth_mm || "").trim(),
      brick_wall_available: String(visit.brick_wall_available || "").trim(),
      civil_door_height_mm: String(visit.civil_door_height_mm || "").trim(),
      opening_schedule_summary: openingSummary,
      opening_schedule: Array.isArray(visit.opening_schedule) ? visit.opening_schedule : [],
      stops: String(visit.site_stops || "").trim(),
      capacity,
      door_type: String(visit.site_door_required || visit.site_opening_type || "").trim(),
      finish: String(visit.site_finish_required || "").trim(),
      offer_type: String(visit.site_offer_type || "").trim(),
    };
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
    const customerPayments = asRecords(data?.payments).filter((item) =>
      estimateIds.has(String(item.estimate_id || "").trim()) || matchesId(item.customer_id) || matchesName(item.customer_name || item.customer)
    );
    const latestChequePayment = customerPayments.find((item) => String(item.cheque_number || item.check_number || "").trim());
    const related = {
      estimates: estimates.length,
      payments: customerPayments.length,
      latestChequeNumber: String(latestChequePayment?.cheque_number || latestChequePayment?.check_number || "").trim(),
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
          {customerContext.related.latestChequeNumber ? ` - Latest cheque ${customerContext.related.latestChequeNumber}` : ""}
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
      customerAssignments: asRecords(data?.customer_assignments),
      departmentAssignments: asRecords(data?.department_assignments),
      timeTracking: asRecords(data?.time_tracking),
      departmentHistory: asRecords(data?.department_history),
    };
    const today = new Date().toISOString().slice(0, 10);
    const startDate = overviewStartDate || currentFiscalYearRange().start;
    const endDate = overviewEndDate || currentFiscalYearRange().end;
    const isClosed = (status: unknown) => ["closed", "resolved", "done", "completed", "cancelled"].includes(String(status || "").trim().toLowerCase());
    const isLost = (status: unknown) => String(status || "").toLowerCase().includes("lost");
    const recordDate = (record: Record<string, unknown>, keys: string[]) => {
      for (const key of keys) {
        const value = String(record[key] || "").slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
      }
      return "";
    };
    const inDateRange = (record: Record<string, unknown>, keys: string[]) => {
      const value = recordDate(record, keys);
      return Boolean(value && value >= startDate && value <= endDate);
    };
    const overlapsRange = (from: unknown, to: unknown) => {
      const start = String(from || "").slice(0, 10);
      const finish = String(to || "").slice(0, 10);
      return Boolean((!finish || finish >= startDate) && (!start || start <= endDate));
    };
    const statusText = (record: Record<string, unknown>) => String(record.status || record.lead_status || record.stage || record.state || "").trim();
    const unitCount = (record: Record<string, unknown>) => Math.max(1, offerNumber(record.elevator_units || record.units || record.unit_count || record.qty, 1));
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
    const fiscal = {
      inquiries: records.inquiries.filter((item) => inDateRange(item, ["received_date", "created_at", "createddate", "date"])),
      siteVisits: records.siteVisits.filter((item) => inDateRange(item, ["visit_date", "created_at", "date"])),
      estimates: records.estimates.filter((item) => inDateRange(item, ["offer_date", "created_at", "date"])),
      payments: records.payments.filter((item) => inDateRange(item, ["received_date", "paid_date", "due_date", "created_at"])),
      service: records.service.filter((item) => inDateRange(item, ["service_date", "created_at", "date"])),
      renewals: records.renewals.filter((item) => overlapsRange(item.from_date || item.amc_from_date || item.start_date, item.to_date || item.amc_to_date || item.end_date || item.renewal_date)),
      tickets: records.tickets.filter((item) => inDateRange(item, ["created_at", "date", "updated_at"])),
      installJobs: records.workOrders.filter((item) => inDateRange(item, ["created_at", "date", "target_handover", "handover_date"])),
    };
    const offerSubmitted = fiscal.estimates.filter((item) => !isLost(statusText(item)));
    const orderWorkStatuses = ["order received", "work in progress", "hand over", "handover", "warranty running", "amc running", "one time service"];
    const orderUnits = [
      ...fiscal.inquiries.filter((item) => orderWorkStatuses.some((status) => statusText(item).toLowerCase().includes(status))),
      ...fiscal.estimates.filter((item) => ["approved", "order received", "work in progress"].some((status) => statusText(item).toLowerCase().includes(status))),
    ].reduce((sum, item) => sum + unitCount(item), 0);
    const warrantyRecords = [
      ...records.inquiries.filter((item) => statusText(item).toLowerCase().includes("warranty running")),
      ...records.service.filter((item) => statusText(item).toLowerCase().includes("warranty")),
    ];
    const amcRecords = [
      ...records.inquiries.filter((item) => statusText(item).toLowerCase().includes("amc running")),
      ...records.renewals.filter((item) => !isLost(statusText(item)) && overlapsRange(item.from_date || item.amc_from_date || item.start_date, item.to_date || item.amc_to_date || item.end_date || item.renewal_date)),
      ...records.payments.filter((item) => String(item.payment_type || "").toLowerCase() === "amc" && overlapsRange(item.amc_from_date, item.amc_to_date)),
    ];
    const inquiryLost = fiscal.inquiries.filter((item) => {
      const status = statusText(item).toLowerCase();
      return status.includes("inquiry lost") || (status.includes("lost") && !status.includes("offer") && !status.includes("order") && !status.includes("site"));
    });
    const orderLost = fiscal.inquiries.filter((item) => {
      const status = statusText(item).toLowerCase();
      return status.includes("order lost") || status.includes("offer lost") || status.includes("site visit lost") || status.includes("warranty lost") || status.includes("amc lost");
    });
    const competitorCounts = orderLost.reduce((map, item) => {
      const competitor = String(item.lost_to_competitor || item.competitor || item.major_competitor || item.lost_to || "").trim();
      if (competitor) map.set(competitor, (map.get(competitor) || 0) + unitCount(item));
      return map;
    }, new Map<string, number>());
    const majorCompetitor = [...competitorCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const amcPayments = records.payments.filter((item) => String(item.payment_type || "").toLowerCase() === "amc");
    const newElevatorPayments = records.payments.filter((item) => String(item.payment_type || "Contract").toLowerCase() !== "amc");
    const paymentReceived = (item: Record<string, unknown>) => paymentAccountSummary(item).receivedTotal || (["paid", "received", "collected", "complete", "completed"].includes(String(item.status || "").toLowerCase()) ? paymentAccountSummary(item).finalContract : 0);
    const amcPaymentReceived = amcPayments.filter((item) => inDateRange(item, ["received_date", "paid_date", "due_date", "created_at"])).reduce((sum, item) => sum + paymentReceived(item), 0);
    const amcPaymentToReceive = amcPayments.filter((item) => overlapsRange(item.amc_from_date || item.due_date, item.amc_to_date || endDate)).reduce((sum, item) => sum + paymentAccountSummary(item).outstandingTotal, 0);
    const newElevatorPaymentReceived = newElevatorPayments.filter((item) => inDateRange(item, ["received_date", "paid_date", "due_date", "created_at"])).reduce((sum, item) => sum + paymentReceived(item), 0);
    const newElevatorPaymentPending = newElevatorPayments.filter((item) => inDateRange(item, ["due_date", "created_at"])).reduce((sum, item) => sum + paymentAccountSummary(item).outstandingTotal, 0);
    const amcAnnualValue = amcPayments.reduce((sum, item) => sum + paymentAccountSummary(item).finalContract, 0) || records.renewals.reduce((sum, item) => sum + moneyValue(item, ["amount", "amc_amount", "contract_value", "value"]), 0);
    const newOrderLosses = records.estimates.filter((item) => {
      const cost = offerCostSummary(item);
      const actual = moneyValue(item, ["actual_parts_cost", "actual_material_cost", "actual_cost", "supplied_parts_cost"]);
      const considered = moneyValue(item, ["considered_parts_cost", "inventory_material_total", "material_cost"]) || cost.materialCost;
      return actual > 0 && considered > 0 && actual > considered;
    });
    const maintenanceLosses = [...records.service, ...records.renewals].filter((item) => {
      const revenue = moneyValue(item, ["amc_amount", "contract_value", "amount", "value", "final_contract_value"]);
      const manHoursCost = moneyValue(item, ["man_hours_cost", "labour_cost"]) || offerNumber(item.man_hours || item.hours) * moneyValue(item, ["hourly_rate", "engineer_rate"]);
      const spareCost = moneyValue(item, ["spare_parts_cost", "parts_cost", "material_cost"]);
      return revenue > 0 && manHoursCost + spareCost > revenue;
    });
    const fiscalMetrics = [
      { label: "Inquiry received", value: fiscal.inquiries.length, detail: "Sales enquiries received in selected period." },
      { label: "Site visited", value: fiscal.siteVisits.length, detail: "Customer-linked site visit records." },
      { label: "Offer submitted", value: offerSubmitted.length, detail: "Offer/estimate records not marked lost." },
      { label: "Elevator units received", value: orderUnits, detail: "Orders and work in progress units." },
      { label: "Elevators in warranty", value: warrantyRecords.reduce((sum, item) => sum + unitCount(item), 0), detail: "Warranty Running records." },
      { label: "Elevators in AMC", value: amcRecords.reduce((sum, item) => sum + unitCount(item), 0), detail: "AMC Running, renewals, and AMC payment records." },
      { label: "Elevators in service", value: warrantyRecords.reduce((sum, item) => sum + unitCount(item), 0) + amcRecords.reduce((sum, item) => sum + unitCount(item), 0), detail: "Warranty plus AMC units." },
      { label: "Inquiry lost", value: inquiryLost.length, detail: "Lost before offer submitted or site visit." },
      { label: "Order lost", value: orderLost.length, detail: "Lost after site visit, offer, warranty, or AMC stage." },
      { label: "Major competitor", value: majorCompetitor ? majorCompetitor[0] : "-", detail: majorCompetitor ? `${majorCompetitor[1]} unit(s) lost to this competitor.` : "No competitor loss captured." },
      { label: "Units lost from warranty", value: fiscal.inquiries.filter((item) => statusText(item).toLowerCase().includes("warranty lost")).reduce((sum, item) => sum + unitCount(item), 0), detail: "Warranty Lost status units." },
      { label: "Units lost from AMC", value: fiscal.inquiries.filter((item) => statusText(item).toLowerCase().includes("amc lost")).reduce((sum, item) => sum + unitCount(item), 0), detail: "AMC Lost status units." },
      { label: "AMC received", value: formatMoneyExact(amcPaymentReceived), detail: "AMC payment received in selected period." },
      { label: "AMC due this year", value: formatMoneyExact(amcPaymentToReceive), detail: "AMC outstanding for this fiscal year." },
      { label: "New elevator received", value: formatMoneyExact(newElevatorPaymentReceived), detail: "Non-AMC payment received." },
      { label: "New elevator pending", value: formatMoneyExact(newElevatorPaymentPending), detail: "Non-AMC payment yet to be received." },
      { label: "AMC next 10 years", value: formatMoneyExact(amcAnnualValue * 10), detail: "Projection based on current AMC annual value." },
      { label: "New orders in loss", value: newOrderLosses.length, detail: "Actual supplied parts cost exceeded considered cost." },
      { label: "Maintenance in loss", value: maintenanceLosses.length, detail: "AMC value below man-hours plus spare parts cost." },
    ];
    const availableEngineers = assignableStaff.filter((member) => staffAvailabilityInfo(member).availableNow).length;
    const viewerNameKey = normalizedKey(data?.viewer?.display_name || data?.viewer?.username);
    const viewerStaffKeys = new Set([
      viewerNameKey,
      normalizedKey(data?.viewer?.username),
      normalizedKey(data?.viewer?.linked_org_node),
      normalizedKey(data?.viewer?.linked_team_member),
    ].filter(Boolean));
    const viewerDepartment = String(data?.viewer?.department || "").trim();
    const activeCustomerAssignments = records.customerAssignments.filter((item) => item.active_status !== false && String(item.active_status || "true").toLowerCase() !== "false");
    const assignmentCustomer = (assignment: Record<string, unknown>) => (data?.customers || []).find((customer) => String(customer.id || "") === String(assignment.customer_id || ""));
    const myAssignedCustomers = activeCustomerAssignments
      .filter((item) => viewerStaffKeys.has(normalizedKey(item.staff_name)) || viewerStaffKeys.has(normalizedKey(item.staff_id)) || viewerStaffKeys.has(normalizedKey(item.assigned_by_username)))
      .map((item) => ({ assignment: item, customer: assignmentCustomer(item) }))
      .filter((item) => item.customer);
    const departmentAssignedCustomers = activeCustomerAssignments
      .filter((item) => viewerDepartment && String(item.department || "") === viewerDepartment)
      .map((item) => ({ assignment: item, customer: assignmentCustomer(item) }))
      .filter((item) => item.customer);
    const activeDepartmentAssignments = records.departmentAssignments.filter((item) => item.active_status !== false && String(item.active_status || "true").toLowerCase() !== "false");
    const myActiveProjects = activeDepartmentAssignments.filter((item) => {
      const customerAssignments = activeCustomerAssignments.filter((assignment) => String(assignment.customer_id || "") === String(item.customer_id || ""));
      return customerAssignments.some((assignment) => viewerStaffKeys.has(normalizedKey(assignment.staff_name)) || viewerStaffKeys.has(normalizedKey(assignment.staff_id)));
    });
    const todaysDate = today;
    const hoursLoggedToday = records.timeTracking
      .filter((item) => String(item.start_time || item.created_at || "").slice(0, 10) === todaysDate)
      .filter((item) => !viewerStaffKeys.size || viewerStaffKeys.has(normalizedKey(item.staff_name)) || viewerStaffKeys.has(normalizedKey(item.staff_id)))
      .reduce((sum, item) => sum + (Number(item.total_hours || 0) || projectHoursBetween(item.start_time, item.end_time || undefined)), 0);
    const departmentQueue = activeDepartmentAssignments.filter((item) => viewerDepartment && String(item.department_id || "") === viewerDepartment);
    const departmentCapacity = projectDepartments.map((department) => ({
      department,
      active: activeDepartmentAssignments.filter((item) => String(item.department_id || "") === department).length,
      hours: activeDepartmentAssignments
        .filter((item) => String(item.department_id || "") === department)
        .reduce((sum, item) => sum + projectHoursBetween(item.entered_at || item.assigned_date), 0),
    }));
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

        <Text style={styles.sectionTitle}>Fiscal Year Analytics</Text>
        <View style={styles.formCard}>
          <Text style={styles.cardLabel}>Date option</Text>
          <Text style={styles.muted}>Default fiscal year is April 1 to March 31. Change the dates below to see the dashboard for a custom period.</Text>
          <View style={styles.formGrid}>
            <View style={styles.field}>
              <Text style={styles.label}>Start date YYYY-MM-DD</Text>
              <TextInput style={styles.input} value={overviewStartDate} onChangeText={setOverviewStartDate} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>End date YYYY-MM-DD</Text>
              <TextInput style={styles.input} value={overviewEndDate} onChangeText={setOverviewEndDate} />
            </View>
          </View>
          <View style={styles.inlineActions}>
            <Pressable style={styles.smallButton} onPress={() => {
              const fiscalRange = currentFiscalYearRange();
              setOverviewStartDate(fiscalRange.start);
              setOverviewEndDate(fiscalRange.end);
            }}>
              <Text style={styles.smallButtonText}>Current fiscal year</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.metricGrid}>
          {fiscalMetrics.map((metric) => (
            <View key={`fiscal-${metric.label}`} style={styles.card}>
              <Text style={styles.cardLabel}>{metric.label}</Text>
              <Text style={styles.metricValue}>{metric.value}</Text>
              <Text style={styles.muted}>{metric.detail}</Text>
            </View>
          ))}
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

        <Text style={styles.sectionTitle}>Assigned Customers</Text>
        <View style={styles.metricGrid}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>My customers</Text>
            <Text style={styles.metricValue}>{myAssignedCustomers.length}</Text>
            <Text style={styles.muted}>Customer records assigned to your staff profile.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Department customers</Text>
            <Text style={styles.metricValue}>{departmentAssignedCustomers.length}</Text>
            <Text style={styles.muted}>{viewerDepartment || "No department"} assignment coverage.</Text>
          </View>
        </View>
        <View style={styles.analyticsPanel}>
          {[...new Map([...myAssignedCustomers, ...departmentAssignedCustomers].map((item) => [String(item.customer?.id || item.assignment.customer_id || item.assignment.id), item])).values()].slice(0, 8).map((item, index) => (
            <View key={`assigned-overview-${String(item.assignment.id || index)}`} style={styles.assignmentRow}>
              <View style={styles.assignmentDetails}>
                <Text style={styles.assignmentName}>{String(item.customer?.name || item.assignment.customer_id || "-")}</Text>
                <Text style={styles.muted}>{String(item.assignment.staff_name || "-")} - {String(item.assignment.department || "-")} - {String(item.assignment.role || "-")}</Text>
              </View>
              {!!item.assignment.primary_owner && <Text style={styles.statusPill}>Primary</Text>}
            </View>
          ))}
          {!myAssignedCustomers.length && !departmentAssignedCustomers.length && (
            <Text style={styles.muted}>Assigned customer lists will appear here after managers assign staff to CRM accounts.</Text>
          )}
        </View>

        <Text style={styles.sectionTitle}>Department Workflow</Text>
        <View style={styles.metricGrid}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>My active projects</Text>
            <Text style={styles.metricValue}>{myActiveProjects.length}</Text>
            <Text style={styles.muted}>Projects tied to customers assigned to your staff profile.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Hours logged today</Text>
            <Text style={styles.metricValue}>{hoursLoggedToday.toFixed(1)}</Text>
            <Text style={styles.muted}>Time entries recorded for your staff profile today.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Department queue</Text>
            <Text style={styles.metricValue}>{departmentQueue.length}</Text>
            <Text style={styles.muted}>{viewerDepartment || "No department"} active project queue.</Text>
          </View>
        </View>
        <View style={styles.analyticsPanel}>
          {departmentCapacity.filter((item) => item.active > 0).slice(0, 9).map((item) => (
            <View key={`capacity-${item.department}`} style={styles.analyticsRow}>
              <View style={styles.analyticsRowHeader}>
                <Text style={styles.cardTitle}>{item.department}</Text>
                <Text style={styles.statusPill}>{item.active} customers</Text>
              </View>
              <Text style={styles.muted}>{item.hours.toFixed(1)} live hours in department.</Text>
            </View>
          ))}
          {!departmentCapacity.some((item) => item.active > 0) && <Text style={styles.muted}>Department workflow metrics will appear after customers enter department queues.</Text>}
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

  function projectHoursBetween(start: unknown, end?: unknown) {
    const startMs = new Date(String(start || "")).getTime();
    const endMs = end ? new Date(String(end || "")).getTime() : projectNow;
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
    return Math.max(0, Number(((endMs - startMs) / 36e5).toFixed(1)));
  }

  function projectDaysFromHours(hours: number) {
    return Number((hours / 24).toFixed(1));
  }

  function projectBusinessDays(start: unknown, end?: unknown) {
    const startDate = new Date(String(start || ""));
    const endDate = end ? new Date(String(end || "")) : new Date(projectNow);
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

  function projectSlaStatus(hours: number, priority: unknown) {
    const normalized = String(priority || "Normal").toLowerCase();
    const limit = normalized.includes("urgent") || normalized.includes("high") ? 48 : normalized.includes("low") ? 168 : 96;
    if (hours > limit) return "Overdue";
    if (hours > limit * 0.75) return "Warning";
    return "On Track";
  }

  function projectSlaStyle(status: string) {
    if (status === "Overdue") return styles.slaOverdue;
    if (status === "Warning") return styles.slaWarning;
    return styles.slaOnTrack;
  }

  function activeDepartmentAssignment(customer: Customer) {
    const records = asRecords(data?.department_assignments)
      .filter((item) => String(item.customer_id || "") === String(customer.id || ""))
      .filter((item) => item.active_status !== false && String(item.active_status || "true").toLowerCase() !== "false")
      .sort((a, b) => String(b.assigned_date || b.entered_at || "").localeCompare(String(a.assigned_date || a.entered_at || "")));
    if (records[0]) return records[0];
    const assigned = customerAssignmentRecords(customer.id)[0];
    const department = String(assigned?.department || customer.primary_account_owner || "").trim();
    if (!department) return null;
    return {
      id: `virtual-${customer.id}-${department}`,
      customer_id: customer.id,
      project_name: customer.name,
      department_id: department,
      department_owner: department,
      status: customer.pipeline_stage || "Active",
      priority: "Normal",
      assigned_date: assigned?.assigned_date || customer.next_follow_up || customer.dpdp_consent_at || new Date().toISOString(),
      entered_at: assigned?.assigned_date || customer.next_follow_up || customer.dpdp_consent_at || new Date().toISOString(),
      active_status: true,
    };
  }

  function projectHistoryForCustomer(customerId: unknown) {
    const history = asRecords(data?.department_history).filter((item) => String(item.customer_id || "") === String(customerId || ""));
    const active = asRecords(data?.department_assignments)
      .filter((item) => String(item.customer_id || "") === String(customerId || ""))
      .filter((item) => item.active_status !== false && String(item.active_status || "true").toLowerCase() !== "false")
      .map((item) => ({
        id: `active-${String(item.id || "")}`,
        customer_id: item.customer_id,
        department_id: item.department_id,
        entered_at: item.entered_at || item.assigned_date,
        exited_at: "",
        duration_hours: projectHoursBetween(item.entered_at || item.assigned_date),
      }));
    return [...history, ...active].sort((a, b) => String(a.entered_at || "").localeCompare(String(b.entered_at || "")));
  }

  function projectStaffHours(customerId: unknown, departmentId?: unknown) {
    return asRecords(data?.time_tracking)
      .filter((item) => String(item.customer_id || "") === String(customerId || ""))
      .filter((item) => !departmentId || String(item.department_id || "") === String(departmentId || ""))
      .reduce((rows, item) => {
        const key = String(item.staff_id || item.staff_name || "Unassigned");
        const existing = rows.get(key) || {
          staff_id: key,
          staff_name: String(item.staff_name || item.staff_id || "Unassigned"),
          department_id: String(item.department_id || ""),
          hours: 0,
          tasks: 0,
          last_activity: "",
        };
        existing.hours += Number(item.total_hours || 0) || projectHoursBetween(item.start_time, item.end_time || undefined);
        existing.tasks += Number(item.tasks_completed || 0);
        existing.last_activity = [existing.last_activity, String(item.last_activity || item.updated_at || item.end_time || item.start_time || "")].sort().pop() || "";
        rows.set(key, existing);
        return rows;
      }, new Map<string, { staff_id: string; staff_name: string; department_id: string; hours: number; tasks: number; last_activity: string }>());
  }

  async function moveCustomerDepartment(customer: Customer, department: string) {
    setLoading(true);
    try {
      await apiFetch(`/api/portal/projects/customers/${encodeURIComponent(customer.id)}/department`, {
        method: "PUT",
        token,
        body: JSON.stringify({
          department,
          project_name: customer.name,
          status: customer.pipeline_stage || "Active",
          priority: "Normal",
        }),
      });
      await loadPortal();
      setMessage(`${customer.name} moved to ${department}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Department move could not be saved.");
    } finally {
      setLoading(false);
    }
  }

  async function logProjectTime(customer: Customer, department: string) {
    const staff = customerAssignmentRecords(customer.id)[0];
    setLoading(true);
    try {
      await apiFetch("/api/portal/projects/time-tracking", {
        method: "POST",
        token,
        body: JSON.stringify({
          customer_id: customer.id,
          department_id: department,
          staff_id: String(staff?.staff_id || ""),
          staff_name: String(staff?.staff_name || ""),
          start_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          end_time: new Date().toISOString(),
          tasks_completed: 1,
          notes: "Manual one-hour project work entry",
        }),
      });
      await loadPortal();
      setMessage(`Logged 1 hour for ${customer.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Time entry could not be saved.");
    } finally {
      setLoading(false);
    }
  }

  function renderDepartmentProjectDashboard() {
    const customers = data?.customers || [];
    const activeRows = customers.map((customer) => ({ customer, assignment: activeDepartmentAssignment(customer) })).filter((row) => row.assignment);
    const totalHoursByDepartment = new Map<string, number>();
    const activeCountByDepartment = new Map<string, number>();
    activeRows.forEach(({ assignment }) => {
      const department = String(assignment?.department_id || "Operations");
      const hours = projectHoursBetween(assignment?.entered_at || assignment?.assigned_date);
      totalHoursByDepartment.set(department, (totalHoursByDepartment.get(department) || 0) + hours);
      activeCountByDepartment.set(department, (activeCountByDepartment.get(department) || 0) + 1);
    });
    const bottleneck = [...totalHoursByDepartment.entries()].sort((a, b) => b[1] - a[1])[0];
    const overdueCount = activeRows.filter(({ assignment }) => projectSlaStatus(projectHoursBetween(assignment?.entered_at || assignment?.assigned_date), assignment?.priority) === "Overdue").length;
    return (
      <View>
        <View style={styles.moduleHero}>
          <Text style={styles.eyebrow}>Department Projects</Text>
          <Text style={styles.moduleHeroTitle}>Customer Workflow by Department</Text>
          <Text style={styles.moduleHeroText}>Track where each customer project sits, who owns it, elapsed department time, logged staff hours, SLA status, and historical movement.</Text>
        </View>
        <View style={styles.metricGrid}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Active customers</Text>
            <Text style={styles.metricValue}>{activeRows.length}</Text>
            <Text style={styles.muted}>Customers currently visible in department queues.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Overdue projects</Text>
            <Text style={styles.metricValue}>{overdueCount}</Text>
            <Text style={styles.muted}>Based on priority SLA thresholds.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Bottleneck</Text>
            <Text style={styles.metricValue}>{bottleneck?.[0] || "-"}</Text>
            <Text style={styles.muted}>{bottleneck ? `${bottleneck[1].toFixed(1)} active hours in queue.` : "No department timing yet."}</Text>
          </View>
        </View>
        <Text style={styles.sectionTitle}>Department Board</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={Platform.OS === "web"} contentContainerStyle={styles.departmentBoard}>
          {projectDepartments.map((department) => {
            const rows = activeRows.filter(({ assignment }) => String(assignment?.department_id || "") === department);
            const averageHours = rows.length ? rows.reduce((sum, row) => sum + projectHoursBetween(row.assignment?.entered_at || row.assignment?.assigned_date), 0) / rows.length : 0;
            return (
              <View key={`dept-${department}`} style={styles.departmentColumn}>
                <View style={styles.kanbanColumnHeader}>
                  <Text style={styles.cardTitle}>{department}</Text>
                  <Text style={styles.statusPill}>{rows.length}</Text>
                </View>
                <Text style={styles.muted}>Avg {averageHours.toFixed(1)}h - Workload {activeCountByDepartment.get(department) || 0}</Text>
                {!rows.length && (
                  <View style={styles.kanbanEmpty}>
                    <Text style={styles.muted}>No customers in this department.</Text>
                  </View>
                )}
                {rows.map(({ customer, assignment }) => {
                  const enteredAt = assignment?.entered_at || assignment?.assigned_date;
                  const hours = projectHoursBetween(enteredAt);
                  const history = projectHistoryForCustomer(customer.id);
                  const staffHours = [...projectStaffHours(customer.id, department).values()];
                  const totalProjectHours = [...projectStaffHours(customer.id).values()].reduce((sum, row) => sum + row.hours, 0) + history.reduce((sum, item) => sum + Number(item.duration_hours || 0), 0);
                  const sla = projectSlaStatus(hours, assignment?.priority);
                  const assignedTeam = customerAssignmentRecords(customer.id);
                  return (
                    <View key={`dept-card-${department}-${customer.id}`} style={styles.projectCustomerCard}>
                      <View style={styles.cardHeaderRow}>
                        <Text style={styles.cardTitle}>{customer.name}</Text>
                        <Text style={[styles.statusPill, projectSlaStyle(sla)]}>{sla}</Text>
                      </View>
                      <Text style={styles.bodyText}>Project: {String(assignment?.project_name || customer.name || "-")}</Text>
                      <Text style={styles.muted}>Status: {String(assignment?.status || customer.pipeline_stage || "Active")} - Priority: {String(assignment?.priority || "Normal")}</Text>
                      <Text style={styles.bodyText}>Assigned: {assignedTeam.map((item) => `${String(item.staff_name || "-")} (${String(item.department || "-")})`).join(", ") || "-"}</Text>
                      <Text style={styles.bodyText}>Department owner: {String(assignment?.department_owner || department)}</Text>
                      <Text style={styles.bodyText}>Entered: {String(enteredAt || "-").slice(0, 10)} - Current time: {hours.toFixed(1)}h / {projectDaysFromHours(hours)}d / {projectBusinessDays(enteredAt)} business days</Text>
                      <Text style={styles.bodyText}>Total logged hours: {staffHours.reduce((sum, row) => sum + row.hours, 0).toFixed(1)} - Total project duration: {totalProjectHours.toFixed(1)}h</Text>
                      <Text style={styles.muted}>Last activity: {staffHours.map((row) => row.last_activity).sort().pop()?.slice(0, 10) || String(assignment?.updated_at || assignment?.assigned_date || "-").slice(0, 10)}</Text>
                      <View style={styles.historyPanel}>
                        <Text style={styles.cardLabel}>Department History</Text>
                        {history.slice(-5).map((item, index) => (
                          <Text key={`hist-${customer.id}-${index}`} style={styles.muted}>
                            {String(item.department_id || "-")} - {String(item.entered_at || "-").slice(0, 10)} to {item.exited_at ? String(item.exited_at).slice(0, 10) : "Present"} - {Number(item.duration_hours || projectHoursBetween(item.entered_at, item.exited_at || undefined)).toFixed(1)}h
                          </Text>
                        ))}
                        {!history.length && <Text style={styles.muted}>No completed movement history yet.</Text>}
                      </View>
                      <View style={styles.historyPanel}>
                        <Text style={styles.cardLabel}>Staff Hours</Text>
                        {staffHours.slice(0, 4).map((row) => (
                          <Text key={`staff-hours-${customer.id}-${row.staff_id}`} style={styles.muted}>{row.staff_name} - {row.department_id} - {row.hours.toFixed(1)}h - {row.tasks} tasks - {row.last_activity.slice(0, 10) || "-"}</Text>
                        ))}
                        {!staffHours.length && <Text style={styles.muted}>No staff time entries logged.</Text>}
                      </View>
                      <View style={styles.inlineActions}>
                        {projectDepartments.filter((next) => next !== department).slice(0, 5).map((next) => (
                          <Pressable key={`move-${customer.id}-${next}`} style={styles.smallButton} onPress={() => moveCustomerDepartment(customer, next)} disabled={loading || !canManageCustomerAssignments()}>
                            <Text style={styles.smallButtonText}>{next}</Text>
                          </Pressable>
                        ))}
                        <Pressable style={styles.smallButton} onPress={() => logProjectTime(customer, department)} disabled={loading}>
                          <Text style={styles.smallButtonText}>Log 1h</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
        <Text style={styles.sectionTitle}>Reports</Text>
        <View style={styles.metricGrid}>
          {projectDepartments.map((department) => {
            const rows = activeRows.filter(({ assignment }) => String(assignment?.department_id || "") === department);
            const total = totalHoursByDepartment.get(department) || 0;
            return (
              <View key={`report-${department}`} style={styles.card}>
                <Text style={styles.cardLabel}>{department}</Text>
                <Text style={styles.metricValue}>{rows.length}</Text>
                <Text style={styles.muted}>Average duration {rows.length ? (total / rows.length).toFixed(1) : "0.0"}h - Total active hours {total.toFixed(1)}h.</Text>
              </View>
            );
          })}
        </View>
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

  function renderPaymentAccountsPage() {
    const payments = asRecords(data?.payments);
    const estimates = asRecords(data?.estimates);
    const customers = [
      ...asRecords(data?.customers).map((item) => ({
        id: String(item.id || item.customer_id || ""),
        name: String(item.name || item.customer || item.lead_name || ""),
        phone: String(item.phone || item.whatsapp_no || ""),
        sourceInquiryId: String(item.enquiry_no || item.source_inquiry_no || ""),
      })),
      ...asRecords((data as Record<string, unknown> | null)?.sales_inquiries).map((item) => ({
        id: String(item.customer_id || item.id || item.enquiry_no || ""),
        name: String(item.customer || item.lead_name || item.name || ""),
        phone: String(item.phone || item.whatsapp_no || ""),
        sourceInquiryId: String(item.enquiry_no || item.source_inquiry_no || item.id || ""),
      })),
    ].filter((item, index, list) => item.id && item.name && list.findIndex((candidate) => candidate.id === item.id) === index);
    const selectedEstimate = estimates.find((estimate) => String(estimate.id) === String(paymentDraft.estimate_id));
    const selectedCustomer = customers.find((customer) => customer.id === paymentDraft.customer_id);
    const estimatesForAccountsCustomer = (customer?: { id: string; name: string; sourceInquiryId?: string }) => {
      if (!customer) return [];
      const customerId = String(customer.id || "").trim();
      const sourceInquiryId = String(customer.sourceInquiryId || "").trim();
      const nameKey = crmNameKey(customer.name);
      return estimates.filter((estimate) => {
        const estimateCustomerId = String(estimate.customer_id || "").trim();
        const estimateInquiryId = String(estimate.source_inquiry_id || estimate.enquiry_no || estimate.source_enquiry_no || "").trim();
        const estimateNameKey = crmNameKey(estimate.customer_name || estimate.offer_name || estimate.customer);
        return Boolean(
          (customerId && estimateCustomerId && customerId === estimateCustomerId) ||
          (sourceInquiryId && estimateInquiryId && sourceInquiryId === estimateInquiryId) ||
          (nameKey && estimateNameKey && nameKey === estimateNameKey)
        );
      }).sort((a, b) => String(b.offer_date || b.created_at || "").localeCompare(String(a.offer_date || a.created_at || "")));
    };
    const linkedEstimateOptions = estimatesForAccountsCustomer(selectedCustomer).slice(0, 12);
    const paymentSummary = paymentAccountSummary(paymentDraft as Record<string, unknown>);
    const totalContractFinal = payments.reduce((sum, item) => sum + paymentAccountSummary(item).finalContract, 0);
    const totalOutstanding = payments.reduce((sum, item) => sum + paymentAccountSummary(item).outstandingTotal, 0);
    const today = new Date().toISOString().slice(0, 10);
    const amcRecords = payments.filter((item) => String(item.payment_type || "").toLowerCase() === "amc");
    const activeAmcRecords = amcRecords.filter((item) => String(item.amc_from_date || "") <= today && (!item.amc_to_date || String(item.amc_to_date) >= today));
    const dueReminders = payments.filter((item) => {
      const summary = paymentAccountSummary(item);
      return summary.outstandingTotal > 0 && summary.nextReminder && summary.nextReminder <= today;
    });

    const setDraftFromEstimate = (estimate: Record<string, unknown>) => {
      const value = String(estimate.total_cost || estimate.amount || "");
      setPaymentDraft((draft) => {
        const customerId = String(estimate.customer_id || draft.customer_id || "");
        const customerName = String(estimate.customer_name || draft.customer_name || "");
        return {
          ...draft,
          estimate_id: String(estimate.id || ""),
          customer_id: customerId,
          customer_name: customerName,
          contract_basic_value: draft.contract_basic_value || value,
          amount: draft.amount || value,
        };
      });
    };

    const setDraftFromCustomer = (customer: { id: string; name: string; sourceInquiryId?: string }) => {
      const linkedEstimateIds = new Set(estimatesForAccountsCustomer(customer).map((estimate) => String(estimate.id || "")));
      setPaymentDraft((draft) => ({
        ...draft,
        customer_id: customer.id,
        customer_name: customer.name,
        estimate_id: linkedEstimateIds.has(String(draft.estimate_id || "")) ? draft.estimate_id : "",
      }));
    };

    return (
      <View>
        <View style={styles.moduleHero}>
          <Text style={styles.eyebrow}>Accounts System</Text>
          <Text style={styles.moduleHeroTitle}>Client payments, GST split, outstanding reminders, and AMC collections.</Text>
          <Text style={styles.moduleHeroText}>Track the basic contract value, check amount with GST, cash amount, received payments, dated outstanding follow-ups, and maintenance periods from one Accounts tab.</Text>
        </View>

        <View style={styles.metricGrid}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Final contract value</Text>
            <Text style={styles.metricValue}>{formatMoneyExact(totalContractFinal)}</Text>
            <Text style={styles.muted}>Check basic + GST + cash across saved records.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Outstanding</Text>
            <Text style={styles.metricValue}>{formatMoneyExact(totalOutstanding)}</Text>
            <Text style={styles.muted}>{dueReminders.length} reminders due today or earlier.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>AMC dashboard</Text>
            <Text style={styles.metricValue}>{activeAmcRecords.length}</Text>
            <Text style={styles.muted}>{amcRecords.length} maintenance payment records saved.</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.cardLabel}>New account / payment entry</Text>
          <View style={styles.inlineActions}>
            {["Contract", "AMC"].map((type) => (
              <Pressable
                key={type}
                style={[styles.selectorPill, paymentDraft.payment_type === type && styles.selectorPillActive]}
                onPress={() => setPaymentDraft((draft) => ({ ...draft, payment_type: type }))}
              >
                <Text style={[styles.selectorText, paymentDraft.payment_type === type && styles.selectorTextActive]}>{type}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Link customer</Text>
          <View style={styles.selectorList}>
            {customers.slice(0, 12).map((customer) => (
              <Pressable
                key={customer.id}
                style={[styles.selectorPill, paymentDraft.customer_id === customer.id && styles.selectorPillActive]}
                onPress={() => setDraftFromCustomer(customer)}
              >
                <Text style={[styles.selectorText, paymentDraft.customer_id === customer.id && styles.selectorTextActive]}>
                  {customer.name}{customer.phone ? ` - ${customer.phone}` : ""}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Link offer / estimate</Text>
          <View style={styles.selectorList}>
            {!selectedCustomer && <Text style={styles.muted}>Select a customer first to show only that customer's linked offers and estimates.</Text>}
            {selectedCustomer && linkedEstimateOptions.length === 0 && <Text style={styles.muted}>No offers or estimates are linked to {selectedCustomer.name}. Create or link an offer in Offer Manager first.</Text>}
            {linkedEstimateOptions.map((estimate) => (
              <Pressable
                key={String(estimate.id)}
                style={[styles.selectorPill, paymentDraft.estimate_id === String(estimate.id) && styles.selectorPillActive]}
                onPress={() => setDraftFromEstimate(estimate)}
              >
                <Text style={[styles.selectorText, paymentDraft.estimate_id === String(estimate.id) && styles.selectorTextActive]}>
                  {String(estimate.id)} - {String(estimate.customer_name || "-")} - {formatMoney(Number(estimate.total_cost || 0))}
                </Text>
              </Pressable>
            ))}
          </View>
          {[["milestone", "Milestone / payment purpose"], ["method", "Payment method"], ["contract_basic_value", "Basic contract value"], ["basic_check_value", "Basic cheque value"], ["basic_cash_value", "Basic cash value"], ["basic_card_value", "Basic credit card value"], ["credit_card_charge_percent", "Credit card charge percent paid by client"], ["amount_received_check", "Received by cheque"], ["amount_received_cash", "Received by cash"], ["amount_received_card", "Received by credit card"], ["due_date", "Payment due date YYYY-MM-DD"], ["outstanding_date", "Outstanding date YYYY-MM-DD"], ["reminder_interval_days", "Reminder increment days"], ["cheque_number", "Cheque number"], ["reference", "Bank / payment reference"], ["notes", "Notes"]].map(([key, label]) => (
            <View key={key} style={styles.field}>
              <Text style={styles.label}>{label}</Text>
              <TextInput
                style={styles.input}
                value={String(paymentDraft[key as keyof typeof paymentDraft] || "")}
                onChangeText={(value) => setPaymentDraft((draft) => ({ ...draft, [key]: value }))}
              />
            </View>
          ))}
          {paymentDraft.payment_type === "AMC" && (
            <View>
              {[["amc_from_date", "AMC from date YYYY-MM-DD"], ["amc_to_date", "AMC to date YYYY-MM-DD"]].map(([key, label]) => (
                <View key={key} style={styles.field}>
                  <Text style={styles.label}>{label}</Text>
                  <TextInput
                    style={styles.input}
                    value={String(paymentDraft[key as keyof typeof paymentDraft] || "")}
                    onChangeText={(value) => setPaymentDraft((draft) => ({ ...draft, [key]: value }))}
                  />
                </View>
              ))}
            </View>
          )}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Calculated collection split</Text>
            <Text style={styles.bodyText}>Basic cheque {formatMoneyExact(paymentSummary.basicCheck)} + GST {paymentSummary.gstPercent}% {formatMoneyExact(paymentSummary.checkGst)} + cash {formatMoneyExact(paymentSummary.basicCash)} + card {formatMoneyExact(paymentSummary.basicCard)} + client card charge {paymentSummary.cardChargePercent}% {formatMoneyExact(paymentSummary.cardCharge)} = final {formatMoneyExact(paymentSummary.finalContract)}.</Text>
            <Text style={styles.bodyText}>Basic contract match: {paymentSummary.splitMatches ? "Yes" : "No"} ({formatMoneyExact(paymentSummary.contractBasic)} should equal cheque {formatMoneyExact(paymentSummary.basicCheck)} + cash {formatMoneyExact(paymentSummary.basicCash)} + card {formatMoneyExact(paymentSummary.basicCard)}).</Text>
            <Text style={styles.bodyText}>Outstanding: cheque/GST {formatMoneyExact(paymentSummary.outstandingCheck)}, cash {formatMoneyExact(paymentSummary.outstandingCash)}, card/charges {formatMoneyExact(paymentSummary.outstandingCard)}, total {formatMoneyExact(paymentSummary.outstandingTotal)}. Next reminder {paymentSummary.nextReminder || "-"}.</Text>
          </View>
          <View style={styles.inlineActions}>
            <Pressable style={styles.primaryButton} onPress={savePayment} disabled={loading || !paymentDraft.customer_id}>
              <Text style={styles.primaryButtonText}>Save account payment</Text>
            </Pressable>
            <Pressable style={styles.smallButton} onPress={autoSchedulePayments} disabled={loading || !selectedEstimate}>
              <Text style={styles.smallButtonText}>Auto-schedule offer</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Saved account payments</Text>
        {payments.map((payment) => {
          const summary = paymentAccountSummary(payment);
          const id = String(payment.id || "");
          return (
            <View key={id} style={styles.card}>
              <Text style={styles.cardTitle}>{String(payment.customer_name || payment.customer || "-")} - {String(payment.milestone || payment.payment_type || id)}</Text>
              <Text style={styles.muted}>{String(payment.payment_type || "Contract")} - {String(payment.estimate_id || "No offer")} - Due {String(payment.due_date || "-")} - Status {String(payment.status || "-")}</Text>
              {String(payment.payment_type || "").toLowerCase() === "amc" && <Text style={styles.bodyText}>AMC period: {String(payment.amc_from_date || "-")} to {String(payment.amc_to_date || "-")}</Text>}
              <Text style={styles.bodyText}>Basic contract {formatMoneyExact(summary.contractBasic)}. Cheque {formatMoneyExact(summary.basicCheck)} + GST {formatMoneyExact(summary.checkGst)}. Cash {formatMoneyExact(summary.basicCash)}. Card {formatMoneyExact(summary.basicCard)} + client charge {formatMoneyExact(summary.cardCharge)}. Final {formatMoneyExact(summary.finalContract)}.</Text>
              <Text style={styles.bodyText}>Cheque number: {String(payment.cheque_number || payment.check_number || "-")}.</Text>
              <Text style={styles.bodyText}>Received cheque {formatMoneyExact(summary.receivedCheck)}, cash {formatMoneyExact(summary.receivedCash)}, and card {formatMoneyExact(summary.receivedCard)}. Outstanding total {formatMoneyExact(summary.outstandingTotal)}. Next reminder {summary.nextReminder || "-"}.</Text>
              <View style={styles.inlineActions}>
                <Pressable style={styles.smallButton} onPress={() => updatePayment(id, "Paid")} disabled={loading}>
                  <Text style={styles.smallButtonText}>Paid</Text>
                </Pressable>
                {[7, 15, 30].map((days) => (
                  <Pressable key={days} style={styles.smallButton} onPress={() => updatePaymentRecord(id, { status: "Outstanding", outstanding_date: today, reminder_interval_days: days, next_reminder_date: addDays(today, days) })} disabled={loading}>
                    <Text style={styles.smallButtonText}>Remind +{days}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}
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

  function installationCustomerDetails(customerId: string) {
    const customer = (data?.customers || []).find((item) => String(item.id || "") === String(customerId || ""));
    if (customer) {
      return {
        id: customer.id,
        name: customer.name,
        company: customer.segment || customer.name,
        contact: customer.contact_person || "",
        phone: customer.phone || "",
        whatsapp: customer.phone || "",
        email: customer.email || "",
        siteAddress: customer.address || "",
        billingAddress: customer.address || "",
        owner: customer.account_owner || "",
        notes: customer.notes || "",
      };
    }
    const option = crmCustomerOptions().find((item) => item.id === customerId);
    return option ? { id: option.id, name: option.name, company: option.name, contact: "", phone: option.phone, whatsapp: option.phone, email: "", siteAddress: option.address, billingAddress: option.address, owner: "", notes: "" } : null;
  }

  function installationPayloadFromDraft() {
    const customer = installationCustomerDetails(installationDraft.customer_id);
    const contractorPayments = installationDraft.contractor_payment_amount.trim()
      ? [{ date: installationDraft.contractor_payment_date, amount: Number(installationDraft.contractor_payment_amount || 0), method: installationDraft.contractor_payment_method, remarks: installationDraft.contractor_payment_remarks }]
      : [];
    return {
      ...installationDraft,
      customer_id: installationDraft.customer_id,
      customer: customer?.name || "",
      company_name: customer?.company || "",
      contact_person: customer?.contact || "",
      mobile: customer?.phone || "",
      whatsapp: customer?.whatsapp || "",
      email: customer?.email || "",
      site_address: customer?.siteAddress || "",
      billing_address: customer?.billingAddress || "",
      site: customer?.siteAddress || "",
      assigned_salesperson: customer?.owner || "",
      crm_notes: customer?.notes || "",
      checklist: mandatoryInstallationTests.concat(Array.from({ length: 10 }, (_, index) => `Test ${index + 1}`)).map((name) => ({ name, result: "Pending", date: "", tested_by: "", remarks: "" })),
      site_photos: installationDraft.site_photo_url.trim() ? [{ url: installationDraft.site_photo_url }] : [],
      lift_videos: installationDraft.lift_video_url.trim() ? [{ url: installationDraft.lift_video_url }] : [],
      contractor_payments: contractorPayments,
    };
  }

  async function saveInstallation() {
    if (!installationDraft.customer_id.trim()) {
      const text = "Select an existing CRM customer before creating an installation.";
      Platform.OS === "web" ? setMessage(text) : Alert.alert("Customer required", text);
      return;
    }
    setLoading(true);
    try {
      const id = installationDraft.id;
      await apiFetch(id ? `/api/portal/install-jobs/${encodeURIComponent(id)}` : "/api/portal/install-jobs", {
        method: id ? "PATCH" : "POST",
        token,
        body: JSON.stringify(installationPayloadFromDraft()),
      });
      setInstallationDraft(emptyInstallationDraft);
      await loadPortal();
      setMessage(id ? "Installation updated." : "Installation created from CRM customer.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Installation could not be saved.");
    } finally {
      setLoading(false);
    }
  }

  async function updateInstallationRecord(record: Record<string, unknown>, payload: Record<string, unknown>, successMessage = "Installation updated.") {
    const id = recordIdentity(record);
    if (!id) return;
    setLoading(true);
    try {
      await apiFetch(`/api/portal/install-jobs/${encodeURIComponent(id)}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(payload),
      });
      await loadPortal();
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Installation could not be updated.");
    } finally {
      setLoading(false);
    }
  }

  async function downloadInstallationReport() {
    if (Platform.OS !== "web") {
      setMessage("Installation report export is available from the web portal.");
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        format: "csv",
        status: installationStatusFilter,
        q: installationSearch,
        start_date: installationReportStart,
        end_date: installationReportEnd,
      });
      const response = await fetch(`${apiBaseUrl}/api/portal/install-jobs/report?${params.toString()}`, {
        method: "GET",
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Installation report failed with ${response.status}.`);
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] || `fuzi-installation-report-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage("Installation report download started.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Installation report could not be downloaded.");
    } finally {
      setLoading(false);
    }
  }

  function editInstallation(record: Record<string, unknown>) {
    const technical = (record.technical_details || {}) as Record<string, unknown>;
    const readiness = (record.site_readiness || {}) as Record<string, unknown>;
    const uploads = (record.uploads || {}) as Record<string, unknown>;
    const payment = asRecords(record.contractor_payments)[0] || {};
    setInstallationDraft({
      ...emptyInstallationDraft,
      ...Object.fromEntries(Object.entries(record).map(([key, value]) => [key, String(value ?? "")])),
      id: String(recordIdentity(record) || ""),
      motor_make: String(technical.motor_make || ""),
      motor_model_number: String(technical.motor_model_number || ""),
      motor_sticker_photo: String(technical.motor_sticker_photo || uploads.motor_sticker_photo || ""),
      door_make: String(technical.door_make || ""),
      controller_make: String(technical.controller_make || ""),
      controller_type: String(technical.controller_type || "Closed Loop"),
      controller_communication: String(technical.controller_communication || "Full Serial"),
      protocol: String(technical.protocol || "Protocol"),
      drive_model_number: String(technical.drive_model_number || ""),
      lift_well_construction: String(readiness.lift_well_construction || "Complete"),
      expected_completion_date: String(readiness.expected_completion_date || ""),
      site_readiness_notes: String(readiness.notes || ""),
      site_photo_url: String(asRecords(uploads.site_photos)[0]?.url || ""),
      lift_video_url: String(asRecords(uploads.lift_videos)[0]?.url || ""),
      contractor_payment_amount: String(payment.amount || ""),
      contractor_payment_date: String(payment.date || ""),
      contractor_payment_method: String(payment.method || ""),
      contractor_payment_remarks: String(payment.remarks || ""),
    });
  }

  function renderInstallationField(label: string, key: keyof typeof emptyInstallationDraft, placeholder = "") {
    return (
      <View key={`installation-field-${String(key)}`} style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          style={styles.input}
          value={String(installationDraft[key] || "")}
          onChangeText={(value) => setInstallationDraft((draft) => ({ ...draft, [key]: value }))}
          placeholder={placeholder}
        />
      </View>
    );
  }

  function renderInstallationPage() {
    const jobs = asRecords(data?.install_jobs);
    const teams = asRecords(data?.install_team);
    const contractors = asRecords(data?.installation_contractors);
    const customers = crmCustomerOptions();
    const selectedCustomer = installationCustomerDetails(installationDraft.customer_id);
    const visibleCustomers = customers.filter((customer) => {
      const query = installationCustomerSearch.trim().toLowerCase();
      return !query || `${customer.id} ${customer.name} ${customer.phone} ${customer.address}`.toLowerCase().includes(query);
    }).slice(0, 30);
    const filteredJobs = jobs.filter((job) => installationStatusFilter === "All" || String(job.status || "") === installationStatusFilter)
      .filter((job) => !installationSearch.trim() || JSON.stringify(job).toLowerCase().includes(installationSearch.trim().toLowerCase()));
    const today = new Date().toISOString().slice(0, 10);
    const statusOptions = ["All", "Site Visit Pending", "Site Ready", "Material Ready", "Installation Assigned", "Under Installation", "Commissioning", "Handover Pending", "Completed", "Closed"];
    const warrantyExpiring = jobs.filter((job) => String(job.warranty_end_date || "") >= today && String(job.warranty_end_date || "") <= datePlusDays(90));
    const panniPending = jobs.filter((job) => String(job.panni_removed || "No").toLowerCase() !== "yes");
    const sitePending = jobs.filter((job) => String((job.site_readiness as Record<string, unknown> | undefined)?.lift_well_construction || "").toLowerCase().includes("progress"));
    const contractorDue = jobs.reduce((sum, job) => sum + Number(job.outstanding_balance || job.total_due || 0), 0);
    const totalContract = jobs.reduce((sum, job) => sum + Number(job.contract_value || 0), 0);
    const totalPaid = jobs.reduce((sum, job) => sum + Number(job.total_paid || 0), 0);
    return (
      <View>
        <View style={styles.moduleHero}>
          <Text style={styles.eyebrow}>Installation Management</Text>
          <Text style={styles.moduleHeroTitle}>CRM-Linked Installation Lifecycle</Text>
          <Text style={styles.moduleHeroText}>Create installations only from CRM customers, assign teams and contractors, capture approval, technical details, site readiness, tests, handover, warranty, and contractor payments.</Text>
        </View>
        <View style={styles.metricGrid}>
          {[
            ["Total installations", jobs.length, "CRM-linked install records."],
            ["Pending", jobs.filter((job) => !["Completed", "Closed"].includes(String(job.status || ""))).length, "Open installation workload."],
            ["Site not ready", sitePending.length, "Construction work still pending."],
            ["Under installation", jobs.filter((job) => String(job.status || "") === "Under Installation").length, "Approved active work."],
            ["Commissioning pending", jobs.filter((job) => String(job.status || "") === "Commissioning").length, "Waiting commissioning completion."],
            ["Panni pending", panniPending.length, "Reminder every 15 days."],
            ["Warranty expiring", warrantyExpiring.length, "Within 90 days."],
            ["Contractor due", formatMoney(contractorDue), `Paid ${formatMoney(totalPaid)} / ${formatMoney(totalContract)}`],
          ].map(([label, value, detail]) => (
            <View key={String(label)} style={styles.card}>
              <Text style={styles.cardLabel}>{label}</Text>
              <Text style={styles.metricValue}>{value}</Text>
              <Text style={styles.muted}>{detail}</Text>
            </View>
          ))}
        </View>

        <View style={styles.formCard}>
          <Text style={styles.cardLabel}>{installationDraft.id ? "Edit installation" : "New installation from CRM"}</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Select CRM customer</Text>
            <TextInput style={styles.input} value={installationCustomerSearch} onChangeText={setInstallationCustomerSearch} placeholder="Search CRM customers by ID, name, phone, site" />
            <View style={styles.selectorList}>
              {visibleCustomers.map((customer) => (
                <Pressable
                  key={`install-customer-${customer.id}`}
                  style={[styles.selectorPill, installationDraft.customer_id === customer.id && styles.selectorPillActive]}
                  onPress={() => setInstallationDraft((draft) => ({ ...draft, customer_id: customer.id }))}
                >
                  <Text style={[styles.selectorText, installationDraft.customer_id === customer.id && styles.selectorTextActive]}>{customer.id} - {customer.name}</Text>
                  <Text style={styles.muted}>{customer.phone || "No phone"} - {customer.address || "No site address"}</Text>
                </Pressable>
              ))}
              {!visibleCustomers.length && <Text style={styles.muted}>No CRM customers match. Add or edit customers in Customer CRM first.</Text>}
            </View>
          </View>
          {selectedCustomer && (
            <View style={styles.linkedSystemsPanel}>
              <Text style={styles.cardLabel}>Read-only CRM customer information</Text>
              <Text style={styles.bodyText}>{selectedCustomer.name} - {selectedCustomer.contact || "No contact"} - {selectedCustomer.phone || "No mobile"} - {selectedCustomer.email || "No email"}</Text>
              <Text style={styles.muted}>Site: {selectedCustomer.siteAddress || "-"} - Billing: {selectedCustomer.billingAddress || "-"} - Sales: {selectedCustomer.owner || "-"}</Text>
              <Text style={styles.muted}>CRM notes: {selectedCustomer.notes || "-"}</Text>
            </View>
          )}
          <View style={styles.formGrid}>
            {renderInstallationField("Project", "project_name")}
            {renderInstallationField("Lift", "lift_reference")}
            {renderInstallationField("Installation status", "status")}
            {renderInstallationField("Assigned team", "assigned_team")}
            {renderInstallationField("Contractor", "contractor")}
            {renderInstallationField("Engineer", "engineer")}
            {renderInstallationField("Start date", "start_date")}
            {renderInstallationField("Completion date", "completion_date")}
            {renderInstallationField("Approved by", "approved_by", "Ashwani Ji")}
            {renderInstallationField("Approval date", "approval_date")}
            {renderInstallationField("Approval remarks", "approval_remarks")}
          </View>
          <Text style={styles.sectionTitle}>Technical Details</Text>
          <View style={styles.formGrid}>
            {["motor_make", "motor_model_number", "motor_sticker_photo", "door_make", "controller_make", "controller_type", "controller_communication", "protocol", "controller_username", "controller_password", "drive_model_number", "ard_or_ups", "ard_make", "battery_size", "battery_make", "battery_quantity", "battery_warranty_expiry", "door_sensor_make", "lop_make", "cop_make", "button_type"].map((key) => renderInstallationField(key.replace(/_/g, " "), key as keyof typeof emptyInstallationDraft))}
          </View>
          <Text style={styles.sectionTitle}>Uploads, Readiness, Handover</Text>
          <View style={styles.formGrid}>
            {["building_photo", "site_photo_url", "lift_video_url", "lift_well_construction", "expected_completion_date", "site_readiness_notes", "panni_removed", "panni_removal_date", "granite_required", "granite_status", "granite_completion_date", "granite_remarks", "installed_by", "commissioned_by", "handed_over_by", "handed_over_date", "warranty_start_date", "warranty_end_date", "final_remarks"].map((key) => renderInstallationField(key.replace(/_/g, " "), key as keyof typeof emptyInstallationDraft))}
          </View>
          <Text style={styles.sectionTitle}>Contractor & Financials</Text>
          <View style={styles.formGrid}>
            {["contractor_name", "contractor_mobile", "contractor_email", "contractor_gst", "contractor_address", "contractor_bank_details", "contract_value", "payment_terms", "contractor_payment_amount", "contractor_payment_date", "contractor_payment_method", "contractor_payment_remarks"].map((key) => renderInstallationField(key.replace(/_/g, " "), key as keyof typeof emptyInstallationDraft))}
          </View>
          <View style={styles.inlineActions}>
            <Pressable style={styles.primaryButtonInline} onPress={saveInstallation} disabled={loading || !installationDraft.customer_id}>
              <Text style={styles.primaryButtonText}>{installationDraft.id ? "Update installation" : "Create installation"}</Text>
            </Pressable>
            {!!installationDraft.id && <Pressable style={styles.secondaryButton} onPress={() => setInstallationDraft(emptyInstallationDraft)} disabled={loading}><Text style={styles.secondaryButtonText}>Cancel edit</Text></Pressable>}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Installation Records</Text>
        <View style={styles.formCard}>
          <TextInput style={styles.input} value={installationSearch} onChangeText={setInstallationSearch} placeholder="Search customer, project, lift, team, contractor, engineer" />
          <View style={styles.formGrid}>
            <View style={styles.field}>
              <Text style={styles.label}>Report start date</Text>
              <TextInput style={styles.input} value={installationReportStart} onChangeText={setInstallationReportStart} placeholder="YYYY-MM-DD" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Report end date</Text>
              <TextInput style={styles.input} value={installationReportEnd} onChangeText={setInstallationReportEnd} placeholder="YYYY-MM-DD" />
            </View>
          </View>
          <View style={styles.inlineActions}>
            {statusOptions.map((status) => <Pressable key={status} style={[styles.smallButton, installationStatusFilter === status && styles.selectorPillActive]} onPress={() => setInstallationStatusFilter(status)}><Text style={styles.smallButtonText}>{status}</Text></Pressable>)}
            <Pressable style={styles.primaryButtonInline} onPress={downloadInstallationReport} disabled={loading}>
              <Text style={styles.primaryButtonText}>Export CSV</Text>
            </Pressable>
          </View>
        </View>
        {filteredJobs.map((job, index) => {
          const id = recordIdentity(job) || String(job.job_id || index);
          const customerId = String(job.customer_id || "");
          const technical = (job.technical_details || {}) as Record<string, unknown>;
          const readiness = (job.site_readiness || {}) as Record<string, unknown>;
          const checklist = asRecords(job.checklist);
          const passedTests = checklist.filter((test) => String(test.result || "").toLowerCase() === "pass").length;
          const totalDays = job.start_date && job.completion_date ? projectBusinessDays(job.start_date, job.completion_date) : 0;
          return (
            <View key={`installation-${id}`} style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardTitleBlock}>
                  <Text style={styles.cardTitle}>{String(job.job_id || id)} - {String(job.customer || "-")}</Text>
                  <Text style={styles.muted}>CRM {customerId || "-"} - Project {String(job.project_name || "-")} - Lift {String(job.lift_reference || job.unit || "-")}</Text>
                </View>
                <Text style={styles.statusPill}>{String(job.status || "-")}</Text>
              </View>
              <Text style={styles.bodyText}>Team: {String(job.assigned_team || "-")} - Contractor: {String(job.contractor || job.contractor_name || "-")} - Engineer: {String(job.engineer || "-")}</Text>
              <Text style={styles.bodyText}>Approval: {String(job.approval_status || "Pending")} - {String(job.approved_by || "-")} - {String(job.approval_date || "-")}</Text>
              <Text style={styles.bodyText}>Dates: Start {String(job.start_date || "-")} - Completion {String(job.completion_date || "-")} - Total days {totalDays || "-"}</Text>
              <Text style={styles.bodyText}>Technical: Motor {String(technical.motor_make || "-")} {String(technical.motor_model_number || "")} - Controller {String(technical.controller_make || "-")} / {String(technical.controller_type || "-")} / {String(technical.controller_communication || "-")}</Text>
              <Text style={styles.bodyText}>Site readiness: {String(readiness.lift_well_construction || "-")} - Expected {String(readiness.expected_completion_date || "-")} - Panni {String(job.panni_removed || "No")} - Granite {String(job.granite_required || "No")} {String(job.granite_status || "")}</Text>
              <Text style={styles.bodyText}>Checklist: {passedTests}/{checklist.length || 16} passed - Warranty {String(job.warranty_start_date || "-")} to {String(job.warranty_end_date || "-")}</Text>
              <Text style={styles.bodyText}>Contract: {formatMoney(Number(job.contract_value || 0))} - Paid {formatMoney(Number(job.total_paid || 0))} - Due {formatMoney(Number(job.outstanding_balance || job.total_due || 0))}</Text>
              <View style={styles.linkedSystemsPanel}>
                <Text style={styles.cardLabel}>Customer lifecycle links</Text>
                <Text style={styles.muted}>Tickets {asRecords(data?.project_tickets).filter((ticket) => String(ticket.customer_id || "") === customerId || crmNameKey(ticket.customer || ticket.project) === crmNameKey(job.customer)).length} - Service {asRecords(data?.service_records).filter((service) => String(service.customer_id || "") === customerId || crmNameKey(service.customer) === crmNameKey(job.customer)).length} - Commissioning {asRecords(data?.commissionings).filter((item) => String(item.customer_id || "") === customerId || String(item.installation_ref || "") === id).length}</Text>
              </View>
              <View style={styles.inlineActions}>
                <Pressable style={styles.smallButton} onPress={() => editInstallation(job)} disabled={loading}><Text style={styles.smallButtonText}>Edit</Text></Pressable>
                <Pressable style={styles.smallButton} onPress={() => updateInstallationRecord(job, { approved_by: "Ashwani Ji", approval_date: today, approval_status: "Approved" }, "Installation approved.")} disabled={loading}><Text style={styles.smallButtonText}>Approve</Text></Pressable>
                {["Site Ready", "Material Ready", "Installation Assigned", "Under Installation", "Commissioning", "Handover Pending", "Completed", "Closed"].map((status) => <Pressable key={`${id}-${status}`} style={styles.smallButton} onPress={() => updateInstallationRecord(job, { status })} disabled={loading}><Text style={styles.smallButtonText}>{status}</Text></Pressable>)}
                <Pressable style={styles.smallButton} onPress={() => sendInstallToCommissioning(job)} disabled={loading || !["Completed", "Commissioning", "Handover Pending"].includes(String(job.status || ""))}><Text style={styles.smallButtonText}>Send commissioning</Text></Pressable>
                {!!customerId && <Pressable style={styles.smallButton} onPress={() => openCrmForCustomerNumber(customerId)} disabled={loading}><Text style={styles.smallButtonText}>Open CRM</Text></Pressable>}
              </View>
            </View>
          );
        })}
        {!filteredJobs.length && <View style={styles.card}><Text style={styles.cardTitle}>No installations found</Text><Text style={styles.muted}>Create one from an existing CRM customer above.</Text></View>}

        <Text style={styles.sectionTitle}>Team & Contractor Metrics</Text>
        <View style={styles.metricGrid}>
          {teams.slice(0, 8).map((team) => {
            const name = fieldText(team, ["name"]);
            const assignedCount = jobs.filter((job) => String(job.assigned_team || job.crew || "").toLowerCase().includes(name.toLowerCase())).length;
            return <View key={`team-metric-${name}`} style={styles.card}><Text style={styles.cardLabel}>{name}</Text><Text style={styles.metricValue}>{assignedCount}</Text><Text style={styles.muted}>{fieldText(team, ["availability"])} - {fieldText(team, ["phone"])}</Text></View>;
          })}
          {contractors.slice(0, 8).map((contractor) => <View key={`contractor-metric-${recordIdentity(contractor) || fieldText(contractor, ["name", "contractor_name"])}`} style={styles.card}><Text style={styles.cardLabel}>{fieldText(contractor, ["contractor_name", "name"])}</Text><Text style={styles.metricValue}>{jobs.filter((job) => fieldText(job, ["contractor", "contractor_name"]) === fieldText(contractor, ["contractor_name", "name"])).length}</Text><Text style={styles.muted}>{fieldText(contractor, ["mobile", "phone"])} - GST {fieldText(contractor, ["gst", "gst_number"])}</Text></View>)}
        </View>
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
    const commissioningEngineers = asRecords(data?.org_chart)
      .filter((person) => {
        const haystack = `${person.department || ""} ${person.title || ""} ${person.role || ""}`.toLowerCase();
        return haystack.includes("commissioning") || haystack.includes("installation") || haystack.includes("engineer");
      })
      .filter((person, index, list) => {
        const name = fieldText(person, ["name"]);
        return name !== "-" && list.findIndex((item) => fieldText(item, ["name"]).toLowerCase() === name.toLowerCase()) === index;
      });
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
          <Text style={styles.label}>Assign engineer</Text>
          <View style={styles.selectorList}>
            {commissioningEngineers.slice(0, 16).map((engineer) => {
              const name = fieldText(engineer, ["name"]);
              return (
                <Pressable
                  key={`commissioning-engineer-${name}`}
                  style={[styles.selectorPill, commissioningDraft.assigned_engineer === name && styles.selectorPillActive]}
                  onPress={() => setCommissioningDraft((draft) => ({ ...draft, assigned_engineer: name }))}
                  disabled={loading}
                >
                  <Text style={[styles.selectorText, commissioningDraft.assigned_engineer === name && styles.selectorTextActive]}>
                    {name} - {fieldText(engineer, ["title", "role", "department"])}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {[
            ["installation_ref", "Installation ref"],
            ["unit", "Unit / lift"],
            ["customer_id", "CRM customer ID"],
            ["customer", "Customer"],
            ["site", "Site"],
            ["assigned_engineer", "Assigned engineer"],
            ["controller_type", "Controller type (Closed loop / Open loop)"],
            ["drive_model_number", "Drive model number"],
            ["motor_serial_number", "Motor serial number"],
            ["communication_link", "Communication link (Serial link / Normal)"],
            ["protocol_required", "Protocol required Y/N"],
            ["protocol_type", "Protocol type / protocol details"],
            ["commissioning_details", "Specific commissioning details"],
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
              <Text style={styles.bodyText}>Engineer: {fieldText(item, ["assigned_engineer", "engineer", "technician"])} - Controller: {fieldText(item, ["controller_type"])} - Drive model: {fieldText(item, ["drive_model_number", "drive_model"])}</Text>
              <Text style={styles.bodyText}>Motor serial: {fieldText(item, ["motor_serial_number", "motor_serial"])} - Nameplate: {fieldText(item, ["motor_nameplate_file", "motor_nameplate_url"])}</Text>
              <Text style={styles.bodyText}>Communication: {fieldText(item, ["communication_link"])} - Protocol required: {fieldText(item, ["protocol_required"])} - Protocol: {fieldText(item, ["protocol_type", "protocol"])}</Text>
              <Text style={styles.bodyText}>Payment cleared: {String(item.payment_cleared || false)} - Handover: {fieldText(item, ["handover_date"])}</Text>
              {!!fieldText(item, ["commissioning_details", "technical_details"]) && fieldText(item, ["commissioning_details", "technical_details"]) !== "-" && <Text style={styles.bodyText}>Details: {fieldText(item, ["commissioning_details", "technical_details"])}</Text>}
              <Text style={styles.bodyText}>{fieldText(item, ["message_from_install_team", "notes"])}</Text>
              {!!commissioningEngineers.length && (
                <>
                  <Text style={styles.label}>Assign engineer</Text>
                  <View style={styles.inlineActions}>
                    {commissioningEngineers.slice(0, 8).map((engineer) => {
                      const name = fieldText(engineer, ["name"]);
                      return (
                        <Pressable key={`${id}-engineer-${name}`} style={styles.smallButton} onPress={() => updateCommissioning(id, { assigned_engineer: name })} disabled={loading}>
                          <Text style={styles.smallButtonText}>{name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}
              <View style={styles.inlineActions}>
                <Pressable style={styles.smallButton} onPress={() => updateCommissioning(id, { controller_type: "Closed loop" })} disabled={loading}>
                  <Text style={styles.smallButtonText}>Closed loop</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => updateCommissioning(id, { controller_type: "Open loop" })} disabled={loading}>
                  <Text style={styles.smallButtonText}>Open loop</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => updateCommissioning(id, { communication_link: "Serial link" })} disabled={loading}>
                  <Text style={styles.smallButtonText}>Serial link</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => updateCommissioning(id, { communication_link: "Normal" })} disabled={loading}>
                  <Text style={styles.smallButtonText}>Normal</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => updateCommissioning(id, { protocol_required: "Y" })} disabled={loading}>
                  <Text style={styles.smallButtonText}>Protocol yes</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => updateCommissioning(id, { protocol_required: "N", protocol_type: "" })} disabled={loading}>
                  <Text style={styles.smallButtonText}>Protocol no</Text>
                </Pressable>
              </View>
              <View style={styles.inlineActions}>
                <Pressable style={styles.smallButton} onPress={() => uploadMotorNameplate(id)} disabled={loading}>
                  <Text style={styles.smallButtonText}>Upload motor nameplate</Text>
                </Pressable>
                {!!item.motor_nameplate_url && (
                  <Pressable style={styles.smallButton} onPress={() => Linking.openURL(`${apiBaseUrl}${String(item.motor_nameplate_url)}`)} disabled={loading}>
                    <Text style={styles.smallButtonText}>View nameplate</Text>
                  </Pressable>
                )}
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
    const staffQuery = crmStaffFilter.trim().toLowerCase();
    return (data?.customers || []).filter((customer) => {
      const stage = customer.pipeline_stage || "Lead";
      const assignments = customerAssignmentRecords(customer.id);
      const assignmentText = assignments.map((assignment) => [
        assignment.staff_name,
        assignment.department,
        assignment.role,
      ].join(" ")).join(" ").toLowerCase();
      const stageOk = crmStageFilter === "All" || stage === crmStageFilter;
      const staffOk = !staffQuery || assignmentText.includes(staffQuery);
      const departmentOk = crmDepartmentFilter === "All" || assignments.some((assignment) => String(assignment.department || "") === crmDepartmentFilter);
      const teamOk = crmTeamFilter === "All" || assignments.some((assignment) => String(assignment.role || "") === crmTeamFilter);
      const queryOk = !query || `${JSON.stringify(customer)} ${assignmentText}`.toLowerCase().includes(query);
      return stageOk && staffOk && departmentOk && teamOk && queryOk;
    });
  }

  function canManageCustomerAssignments() {
    const viewer = data?.viewer as Record<string, unknown> | undefined;
    const role = String(viewer?.role || "").trim().toLowerCase();
    const title = String(viewer?.title || viewer?.position || "").trim().toLowerCase();
    return isAdmin || role.includes("manager") || role.includes("lead") || title.includes("manager") || title.includes("lead");
  }

  function customerAssignmentRecords(customerId: unknown) {
    return asRecords(data?.customer_assignments)
      .filter((assignment) => String(assignment.customer_id || "") === String(customerId || ""))
      .filter((assignment) => assignment.active_status !== false && String(assignment.active_status || "true").toLowerCase() !== "false")
      .sort((a, b) => {
        const primaryDiff = Number(Boolean(b.primary_owner)) - Number(Boolean(a.primary_owner));
        if (primaryDiff) return primaryDiff;
        return String(a.staff_name || a.name || "").localeCompare(String(b.staff_name || b.name || ""));
      });
  }

  function assignmentStaffKey(record: Record<string, unknown>) {
    return normalizedKey(record.staff_id || record.id || record.staff_name || record.name);
  }

  function staffInitials(name: unknown) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    return (parts[0]?.[0] || "S").toUpperCase() + (parts[1]?.[0] || "").toUpperCase();
  }

  function assignmentPayloadFromRecords(records: Array<Record<string, unknown>>) {
    return records.map((record, index) => ({
      staff_id: String(record.staff_id || record.id || ""),
      staff_name: String(record.staff_name || record.name || ""),
      primary_owner: Boolean(record.primary_owner) || index === 0,
    })).filter((record) => record.staff_id || record.staff_name);
  }

  async function saveCustomerAssignments(customer: Customer, assignments: Array<Record<string, unknown>>) {
    setLoading(true);
    try {
      await apiFetch(`/api/portal/customers/${encodeURIComponent(customer.id)}/assignments`, {
        method: "PUT",
        token,
        body: JSON.stringify({ assignments: assignmentPayloadFromRecords(assignments) }),
      });
      await loadPortal();
      setMessage(`Assigned team updated for ${customer.name || customer.id}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Customer assignments could not be updated.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleCustomerStaffAssignment(customer: Customer, staff: Record<string, unknown>) {
    const assignments = customerAssignmentRecords(customer.id);
    const staffKey = assignmentStaffKey(staff);
    const exists = assignments.some((assignment) => assignmentStaffKey(assignment) === staffKey);
    const nextAssignments = exists
      ? assignments.filter((assignment) => assignmentStaffKey(assignment) !== staffKey)
      : [
        ...assignments,
        {
          staff_id: String(staff.id || staff.staff_id || ""),
          staff_name: String(staff.name || staff.staff_name || ""),
          primary_owner: assignments.length === 0,
        },
      ];
    await saveCustomerAssignments(customer, nextAssignments.map((assignment, index) => ({
      ...assignment,
      primary_owner: Boolean(assignment.primary_owner) || index === 0,
    })));
  }

  async function setPrimaryCustomerAssignment(customer: Customer, primary: Record<string, unknown>) {
    const primaryKey = assignmentStaffKey(primary);
    const assignments = customerAssignmentRecords(customer.id).map((assignment) => ({
      ...assignment,
      primary_owner: assignmentStaffKey(assignment) === primaryKey,
    }));
    await saveCustomerAssignments(customer, assignments);
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
    setSiteVisitDraft({
      ...emptySiteVisit,
      customer_id: customer.id,
      customer_name: customer.name,
      address: customer.address || "",
      site_person_name: customer.contact_person || customer.name,
      site_person_mobile: customer.phone || "",
      site_visit_date: new Date().toISOString().slice(0, 10),
      visited_by: data?.viewer?.display_name || username,
    });
    setSiteVisitEditorOpen(true);
  }

  function openSiteVisitForCrmOption(customer: { id: string; name: string; phone?: string; address?: string; source_inquiry_id?: string }) {
    setSiteVisitDraft({
      ...emptySiteVisit,
      customer_id: customer.id,
      customer_name: customer.name,
      address: customer.address || "",
      site_person_name: customer.name,
      site_person_mobile: customer.phone || "",
      site_enquiry_no: customer.source_inquiry_id || "",
      site_visit_date: new Date().toISOString().slice(0, 10),
      visited_by: data?.viewer?.display_name || username,
    });
    setSiteVisitEditorOpen(true);
  }

  function openSiteVisitForInquiry(record: Record<string, unknown>) {
    const customerId = String(record.customer_id || record.id || record.enquiry_no || "");
    const enquiryNo = String(record.enquiry_no || record.source_enquiry_no || "");
    setSiteVisitDraft({
      ...emptySiteVisit,
      customer_id: customerId,
      customer_name: String(record.customer || record.lead_name || record.name || ""),
      address: String(record.address || record.site_address || record.site || ""),
      site_person_name: String(record.customer || record.lead_name || record.name || ""),
      site_person_mobile: String(record.phone || record.whatsapp_no || ""),
      site_enquiry_no: enquiryNo,
      site_visit_date: new Date().toISOString().slice(0, 10),
      visited_by: data?.viewer?.display_name || username,
    });
    setSiteVisitEditorOpen(true);
  }

  function openExistingSiteVisit(visit: SiteVisit) {
    setSiteVisitDraft({ ...emptySiteVisit, ...visit });
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
    const siteMeasurements = offerMeasurementPayloadFromSiteVisit(siteVisitsForCustomerId(customer.id)[0]);
    setOfferDraft({
      ...emptyOfferDraft,
      ...siteMeasurements,
      customer_id: customer.id,
      customer_name: customer.name,
      offer_name: customer.name,
      offer_type: siteMeasurements.offer_type || customer.segment || "Passenger",
      lead_status: "Offer Pending",
      elevator_type: customer.segment || "Passenger Elevator",
      createdbyname: data?.viewer?.display_name || username,
    });
    setCostingEditorOpen(true);
  }

  function openCostingForInquiry(record: Record<string, unknown>) {
    const customerName = String(record.customer || record.lead_name || "");
    const customerId = String(record.customer_id || "");
    const siteMeasurements = offerMeasurementPayloadFromSiteVisit(siteVisitsForCustomerId(customerId)[0]);
    setOfferDraft({
      ...emptyOfferDraft,
      ...siteMeasurements,
      customer_name: customerName,
      offer_name: customerName,
      offer_type: String(record.lead_type || record.leadtype || "Individual"),
      lead_status: "Offer Pending",
      elevator_type: String(record.lead_type || record.leadtype || "Passenger Elevator"),
      createdbyname: data?.viewer?.display_name || username,
      customer_id: customerId,
      source_inquiry_id: recordIdentity(record) || String(record.enquiry_no || ""),
      notes: String(record.enquiry_remark || record.requirement || ""),
    });
    setCostingEditorOpen(true);
  }

  function applySiteVisitToOffer(visit: Record<string, unknown>) {
    const payload = offerMeasurementPayloadFromSiteVisit(visit);
    setOfferDraft((draft) => ({
      ...draft,
      ...payload,
      offer_type: payload.offer_type || draft.offer_type,
      stops: payload.stops || draft.stops,
      capacity: payload.capacity || draft.capacity,
      door_type: payload.door_type || draft.door_type,
      finish: payload.finish || draft.finish,
    }));
  }

  function renderOfferMeasurementSection() {
    const linkedSiteVisits = siteVisitsForCustomerId(offerDraft.customer_id);
    const measurementFields = [
      ["site_visit_id", "Linked site visit ID"],
      ["site_measurements_source", "Measurement source"],
      ["site_address", "Site address"],
      ["pit_size_mm", "Pit available mm"],
      ["machine_room_available", "Machine room Y/N"],
      ["site_stops", "Site stops"],
      ["site_number_of_openings", "Number of openings"],
      ["site_opening_type", "Opening type"],
      ["door_size_width_mm", "Door width mm"],
      ["door_size_height_mm", "Door height mm"],
      ["car_size_width_mm", "Car width mm"],
      ["car_size_depth_mm", "Car depth mm"],
      ["site_capacity_persons", "Capacity persons"],
      ["site_capacity_kg", "Capacity kg"],
      ["shaft_width_mm", "Shaft width mm"],
      ["shaft_depth_mm", "Shaft depth mm"],
      ["brick_wall_available", "Brick wall Y/N"],
      ["civil_door_height_mm", "Civil door height mm"],
    ];
    return (
      <View style={styles.openingSchedulePanel}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Site visit measurements used for offer</Text>
            <Text style={styles.muted}>Offer Manager pulls these dimensions from the CRM customer's saved site visit report. They can be reviewed or corrected before saving the client offer.</Text>
          </View>
          <Text style={styles.statusPill}>{linkedSiteVisits.length ? `${linkedSiteVisits.length} site visits` : "No site visit"}</Text>
        </View>
        {linkedSiteVisits.length ? (
          <View style={styles.inlineActions}>
            {linkedSiteVisits.slice(0, 4).map((visit) => {
              const visitId = recordIdentity(visit);
              const label = `${visitId || "Site visit"}${visit.site_visit_date ? ` - ${visit.site_visit_date}` : ""}`;
              return (
                <Pressable key={`offer-site-source-${visitId || label}`} style={styles.smallButton} onPress={() => applySiteVisitToOffer(visit)} disabled={loading}>
                  <Text style={styles.smallButtonText}>Use {label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.muted}>No saved site visit is linked to this CRM customer yet. Add the site visit first when measurements are needed for the offer.</Text>
          </View>
        )}
        <View style={styles.formGrid}>
          {measurementFields.map(([key, label]) => (
            <View key={`offer-measurement-${key}`} style={styles.field}>
              <Text style={styles.label}>{label}</Text>
              <TextInput
                style={styles.input}
                value={String(offerDraft[key] || "")}
                editable={key !== "site_visit_id"}
                onChangeText={(value) => setOfferDraft((draft) => ({ ...draft, [key]: value }))}
                keyboardType={["pit_size_mm", "site_stops", "site_number_of_openings", "door_size_width_mm", "door_size_height_mm", "car_size_width_mm", "car_size_depth_mm", "site_capacity_persons", "site_capacity_kg", "shaft_width_mm", "shaft_depth_mm", "civil_door_height_mm"].includes(key) ? "numeric" : "default"}
              />
            </View>
          ))}
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Floor height profile</Text>
          <TextInput style={[styles.input, styles.textarea]} value={String(offerDraft.floor_height_profile || "")} onChangeText={(value) => setOfferDraft((draft) => ({ ...draft, floor_height_profile: value }))} multiline />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Opening schedule summary</Text>
          <TextInput style={[styles.input, styles.textarea]} value={String(offerDraft.opening_schedule_summary || "")} onChangeText={(value) => setOfferDraft((draft) => ({ ...draft, opening_schedule_summary: value }))} multiline />
        </View>
      </View>
    );
  }

  function addInventoryItemToOffer(item: Record<string, unknown>) {
    const id = recordIdentity(item) || String(item.id || item.name || item.item || "");
    const price = inventoryPrice(item);
    setOfferDraft((draft) => {
      const currentLines = offerInventoryLines(draft);
      const existingIndex = currentLines.findIndex((line) => String(line.item_id || "") === id);
      const nextLines = existingIndex >= 0
        ? currentLines.map((line, index) => index === existingIndex ? { ...line, qty: String((offerNumber(line.qty, 1) || 1) + 1) } : line)
        : [
            ...currentLines,
            {
              item_id: id,
              name: String(item.name || item.item || id),
              category: String(item.category || ""),
              unit: String(item.unit || "pcs"),
              qty: "1",
              current_price: String(price || ""),
              purchase_price: String(item.purchase_price || item.unit_cost || ""),
              price_date: String(item.price_date || item.last_updated || item.updated_at || ""),
              vendor: String(item.vendor || ""),
            },
          ];
      const materialTotal = offerInventoryTotal({ inventory_items: nextLines });
      return {
        ...draft,
        inventory_items: nextLines,
        inventory_material_total: String(materialTotal),
        inventory_pricing_source: `Inventory prices from ${new Date().toISOString().slice(0, 10)}`,
        material_cost: String(materialTotal),
      };
    });
  }

  function updateOfferInventoryLine(index: number, patch: Record<string, string>) {
    setOfferDraft((draft) => {
      const nextLines = offerInventoryLines(draft).map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line);
      const materialTotal = offerInventoryTotal({ inventory_items: nextLines });
      return { ...draft, inventory_items: nextLines, inventory_material_total: String(materialTotal), material_cost: String(materialTotal) };
    });
  }

  function removeOfferInventoryLine(index: number) {
    setOfferDraft((draft) => {
      const nextLines = offerInventoryLines(draft).filter((_, lineIndex) => lineIndex !== index);
      const materialTotal = offerInventoryTotal({ inventory_items: nextLines });
      return { ...draft, inventory_items: nextLines, inventory_material_total: String(materialTotal), material_cost: materialTotal ? String(materialTotal) : "" };
    });
  }

  function renderOfferInventorySection() {
    const inventory = asRecords(data?.inventory);
    const selectedLines = offerInventoryLines(offerDraft);
    const materialTotal = offerInventoryTotal(offerDraft);
    const pricedInventory = inventory
      .filter((item) => String(item.name || item.item || "").trim())
      .sort((a, b) => String(a.category || "").localeCompare(String(b.category || "")) || String(a.name || a.item || "").localeCompare(String(b.name || b.item || "")));
    return (
      <View style={styles.openingSchedulePanel}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Inventory items used in offer</Text>
            <Text style={styles.muted}>Add priced warehouse items to this offer. The current item prices become the offer's internal material cost.</Text>
          </View>
          <Text style={styles.statusPill}>{formatMoney(materialTotal)}</Text>
        </View>
        {!!pricedInventory.length && (
          <ScrollView horizontal showsHorizontalScrollIndicator={Platform.OS === "web"} contentContainerStyle={styles.inlineActions}>
            {pricedInventory.slice(0, 24).map((item, index) => {
              const id = recordIdentity(item) || String(item.id || item.name || index);
              const price = inventoryPrice(item);
              return (
                <Pressable key={`offer-inventory-${id}`} style={styles.smallButton} onPress={() => addInventoryItemToOffer(item)} disabled={loading}>
                  <Text style={styles.smallButtonText}>{String(item.name || item.item || id)} - {formatMoney(price)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
        {!pricedInventory.length && (
          <View style={styles.emptyState}>
            <Text style={styles.muted}>Add inventory items with current prices first, then they can be used in Offer Manager costing.</Text>
          </View>
        )}
        {selectedLines.map((line, index) => {
          const qty = offerNumber(line.qty, 1) || 1;
          const price = offerNumber(line.current_price || line.unit_price || line.sale_price || line.unit_cost);
          return (
            <View key={`offer-inventory-line-${String(line.item_id || index)}`} style={styles.openingScheduleRow}>
              <View style={styles.openingScheduleField}>
                <Text style={styles.label}>Item</Text>
                <TextInput style={styles.input} value={String(line.name || "")} onChangeText={(value) => updateOfferInventoryLine(index, { name: value })} />
              </View>
              <View style={styles.openingScheduleField}>
                <Text style={styles.label}>Qty</Text>
                <TextInput style={styles.input} value={String(line.qty || "1")} onChangeText={(value) => updateOfferInventoryLine(index, { qty: value })} keyboardType="numeric" />
              </View>
              <View style={styles.openingScheduleField}>
                <Text style={styles.label}>Current price</Text>
                <TextInput style={styles.input} value={String(line.current_price || "")} onChangeText={(value) => updateOfferInventoryLine(index, { current_price: value })} keyboardType="numeric" />
              </View>
              <View style={styles.openingScheduleField}>
                <Text style={styles.label}>Line total</Text>
                <Text style={styles.bodyText}>{formatMoney(qty * price)}</Text>
              </View>
              <Pressable style={styles.smallButton} onPress={() => removeOfferInventoryLine(index)} disabled={loading}>
                <Text style={styles.smallButtonText}>Remove</Text>
              </Pressable>
            </View>
          );
        })}
        <Text style={styles.muted}>Material cost from inventory: {formatMoney(materialTotal)}. You can still override the material cost field if needed.</Text>
      </View>
    );
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
              {renderOfferMeasurementSection()}
              {renderOfferInventorySection()}
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
    const customersWithMeasurements = customers.filter((customer) => siteVisitsForCustomerId(customer.id).length);
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
            <Text style={styles.cardLabel}>Measurement ready</Text>
            <Text style={styles.metricValue}>{customersWithMeasurements.length}</Text>
            <Text style={styles.muted}>CRM customers with saved site visit dimensions.</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.cardLabel}>Create offer from CRM customer</Text>
          <Text style={styles.muted}>Select a saved CRM customer first. Offer Manager will use that customer ID and pull the latest linked site visit measurements into the costing record and offer letter.</Text>
          {!customers.length && <Text style={styles.muted}>No saved customer accounts are available yet.</Text>}
          <View style={styles.formGrid}>
            {customers.slice(0, 16).map((customer) => {
              const visits = siteVisitsForCustomerId(customer.id);
              const latestVisit = visits[0];
              const measurementText = latestVisit
                ? `Site visit ${recordIdentity(latestVisit) || ""} - ${String(latestVisit.site_visit_date || "No date")} - Stops ${String(latestVisit.site_stops || "-")} - Pit ${String(latestVisit.pit_size_mm || "-")} mm - Shaft ${String(latestVisit.shaft_width_mm || "-")} x ${String(latestVisit.shaft_depth_mm || "-")} mm`
                : "No linked site visit measurements yet";
              return (
                <View key={`offer-customer-card-${customer.id}`} style={styles.card}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.cardTitleBlock}>
                      <Text style={styles.cardTitle}>{customer.name || customer.id}</Text>
                      <Text style={styles.muted}>CRM {customer.id} - {customer.address || "No address"}</Text>
                    </View>
                    <Text style={styles.statusPill}>{visits.length ? "Measurements ready" : "Needs site visit"}</Text>
                  </View>
                  <Text style={styles.bodyText}>{measurementText}</Text>
                  <View style={styles.inlineActions}>
                    <Pressable style={styles.smallButton} onPress={() => openCostingForCustomer(customer)} disabled={loading}>
                      <Text style={styles.smallButtonText}>Create offer</Text>
                    </Pressable>
                    <Pressable style={styles.smallButton} onPress={() => openSiteVisitForCustomer(customer)} disabled={loading}>
                      <Text style={styles.smallButtonText}>New site visit</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
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
              <Text style={styles.bodyText}>Measurements: {String(offer.site_measurements_source || offer.site_visit_id || "No site visit linked")} - Pit {String(offer.pit_size_mm || "-")} mm - Shaft {String(offer.shaft_width_mm || "-")} x {String(offer.shaft_depth_mm || "-")} mm</Text>
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
    const assignmentFiltersActive = Boolean(crmStaffFilter.trim() || crmDepartmentFilter !== "All" || crmTeamFilter !== "All");
    const visibleInquiries = assignmentFiltersActive ? [] : inquiries.filter((item) => {
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
    const latestMotorForCustomer = (customer: Customer) => {
      const customerId = String(customer.id || "");
      const nameKey = crmNameKey(customer.name);
      return asRecords((data as Record<string, unknown> | null)?.commissionings)
        .filter((item) => {
          const itemCustomerId = String(item.customer_id || "").trim();
          const itemNameKey = crmNameKey(item.customer);
          return Boolean((customerId && itemCustomerId && customerId === itemCustomerId) || (nameKey && itemNameKey && nameKey === itemNameKey));
        })
        .filter((item) => String(item.motor_serial_number || item.motor_nameplate_url || item.motor_nameplate_file || "").trim())
        .sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")))[0];
    };
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
              <Pressable style={styles.secondaryButton} onPress={sendCustomerOccasionReminders} disabled={loading}>
                <Text style={styles.secondaryButtonText}>Send occasion reminders</Text>
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
            placeholder="Search name, phone, GSTIN, assigned staff, department, site, notes"
          />
          <View style={styles.formGrid}>
            <View style={styles.field}>
              <Text style={styles.label}>Assigned staff search</Text>
              <TextInput
                style={styles.input}
                value={crmStaffFilter}
                onChangeText={setCrmStaffFilter}
                placeholder="Employee name"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Department</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={Platform.OS === "web"} contentContainerStyle={styles.inlineActions}>
                {customerAssignmentOptions.departments.map((department) => (
                  <Pressable key={`crm-dept-${department}`} style={[styles.smallButton, crmDepartmentFilter === department && styles.selectorPillActive]} onPress={() => setCrmDepartmentFilter(department)}>
                    <Text style={styles.smallButtonText}>{department}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Team / position</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={Platform.OS === "web"} contentContainerStyle={styles.inlineActions}>
                {customerAssignmentOptions.teams.map((team) => (
                  <Pressable key={`crm-team-${team}`} style={[styles.smallButton, crmTeamFilter === team && styles.selectorPillActive]} onPress={() => setCrmTeamFilter(team)}>
                    <Text style={styles.smallButtonText}>{team}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
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
            const latestMotor = latestMotorForCustomer(customer);
            const costingStatus = latestEstimate ? String(latestEstimate.status || latestEstimate.lead_status || "Costing") : "No costing";
            const customerSiteVisits = (data?.site_visits || []).filter((visit) => String(visit.customer_id || "") === String(customer.id || ""));
            const customerInstallations = asRecords(data?.install_jobs).filter((job) => String(job.customer_id || "") === String(customer.id || "") || crmNameKey(job.customer) === crmNameKey(customer.name));
            const assignedTeam = customerAssignmentRecords(customer.id);
            const assignedStaffKeys = new Set(assignedTeam.map(assignmentStaffKey));
            const canEditAssignments = canManageCustomerAssignments();
            return (
              <View key={`customer-${customer.id}`} style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>{customer.name}</Text>
                  <Text style={styles.statusPill}>{costingStatus}</Text>
                </View>
                <Text style={styles.muted}>{customer.id} - {customer.address || "No address"} - Pipeline: {customer.pipeline_stage || "Lead"}</Text>
                <Text style={styles.bodyText}>Offers: {customerEstimates.length}{latestEstimate ? ` - Latest ${String(latestEstimate.job_no || latestEstimate.id || "-")} - ${String(latestEstimate.offer_date || latestEstimate.created_at || "-")} - ${formatMoney(offerCostSummary(latestEstimate).totalCost)}` : ""}</Text>
                <Text style={styles.bodyText}>Site visits: {customerSiteVisits.length}{customerSiteVisits[0] ? ` - Latest ${String(customerSiteVisits[0].id || "-")} ${String(customerSiteVisits[0].site_visit_date || "")}` : ""}</Text>
                {!!latestMotor && (
                  <Text style={styles.bodyText}>Motor: {fieldText(latestMotor, ["motor_serial_number", "motor_serial"])} - Nameplate: {fieldText(latestMotor, ["motor_nameplate_file", "motor_nameplate_url"])} - Commissioning {fieldText(latestMotor, ["id"])}</Text>
                )}
                {!!customerInstallations.length && (
                  <View style={styles.linkedSystemsPanel}>
                    <Text style={styles.cardLabel}>Installation History</Text>
                    {customerInstallations.slice(0, 4).map((job, jobIndex) => (
                      <Text key={`customer-install-${customer.id}-${String(job.id || jobIndex)}`} style={styles.muted}>
                        {String(job.job_id || job.id || "-")} - {String(job.status || "-")} - Install {String(job.start_date || job.created_at || "-").slice(0, 10)} - Handover {String(job.handed_over_date || job.handover_date || "-").slice(0, 10)} - Warranty end {String(job.warranty_end_date || "-").slice(0, 10)} - Team {String(job.assigned_team || job.crew || "-")} - Contractor {String(job.contractor || job.contractor_name || "-")} - Engineer {String(job.engineer || job.assigned_engineer || "-")}
                      </Text>
                    ))}
                  </View>
                )}
                <Text style={styles.bodyText}>{customer.contact_person || "No contact"} - {customer.phone || "No mobile"} - {customer.email || "No email"}</Text>
                <Text style={styles.bodyText}>Owner: {customer.account_owner || "-"} - Source: {customer.lead_source || "-"} - Channel: {customer.preferred_channel || "-"}</Text>
                <View style={styles.assignedTeamPanel}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardLabel}>Assigned Team</Text>
                    {!!assignedTeam.length && <Text style={styles.statusPill}>{assignedTeam.length} staff</Text>}
                  </View>
                  {assignedTeam.map((assignment) => {
                    const name = String(assignment.staff_name || assignment.name || "-");
                    const avatarUrl = String(assignment.avatar_url || "");
                    return (
                      <View key={`assignment-${String(assignment.id || assignment.staff_id || name)}`} style={styles.assignmentRow}>
                        {avatarUrl ? (
                          <Image source={{ uri: avatarUrl }} style={styles.assignmentAvatarImage} />
                        ) : (
                          <View style={styles.assignmentAvatar}>
                            <Text style={styles.assignmentAvatarText}>{staffInitials(name)}</Text>
                          </View>
                        )}
                        <View style={styles.assignmentDetails}>
                          <Text style={styles.assignmentName}>{name} - {String(assignment.department || "Unassigned")}</Text>
                          <Text style={styles.muted}>{String(assignment.role || assignment.position || "Role not set")}</Text>
                        </View>
                        {!!assignment.primary_owner && <Text style={styles.statusPill}>Primary</Text>}
                        {canEditAssignments && !assignment.primary_owner && (
                          <Pressable style={styles.smallButton} onPress={() => setPrimaryCustomerAssignment(customer, assignment)} disabled={loading}>
                            <Text style={styles.smallButtonText}>Make primary</Text>
                          </Pressable>
                        )}
                        {canEditAssignments && (
                          <Pressable style={styles.dangerButton} onPress={() => toggleCustomerStaffAssignment(customer, assignment)} disabled={loading}>
                            <Text style={styles.dangerButtonText}>Remove</Text>
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                  {!assignedTeam.length && <Text style={styles.muted}>No staff assigned yet.</Text>}
                  {canEditAssignments ? (
                    <View style={styles.assignmentPicker}>
                      <Text style={styles.label}>Add or change staff</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={Platform.OS === "web"} contentContainerStyle={styles.inlineActions}>
                        {customerStaffDirectory.map((staff) => {
                          const active = assignedStaffKeys.has(assignmentStaffKey(staff));
                          return (
                            <Pressable
                              key={`assign-${customer.id}-${staff.id}`}
                              style={[styles.selectorPill, active && styles.selectorPillActive]}
                              onPress={() => toggleCustomerStaffAssignment(customer, staff)}
                              disabled={loading}
                            >
                              <Text style={styles.selectorText}>{staff.name} - {staff.department}</Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  ) : (
                    <Text style={styles.muted}>Only Admin, Manager, or Team Lead users can change assignments.</Text>
                  )}
                </View>
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
                    <Text style={styles.smallButtonText}>New site visit</Text>
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
          const inquirySiteVisits = (data?.site_visits || []).filter((visit) => {
            const sameCustomer = String(visit.customer_id || "") === inquiryCustomerId;
            const sameEnquiry = inquiryEnquiryNo && String(visit.site_enquiry_no || "") === inquiryEnquiryNo;
            return sameCustomer && (!String(visit.site_enquiry_no || "") || sameEnquiry);
          });
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
                  <Text style={styles.bodyText}>Site visits: {inquirySiteVisits.length}{inquirySiteVisits[0] ? ` - Latest ${String(inquirySiteVisits[0].id || "-")} ${String(inquirySiteVisits[0].site_visit_date || "")}` : ""}</Text>
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
                      <Text style={styles.smallButtonText}>New site visit</Text>
                    </Pressable>
                    <Pressable style={styles.smallButton} onPress={() => openCostingForInquiry(item)} disabled={loading}>
                    <Text style={styles.smallButtonText}>Create offer</Text>
                    </Pressable>
                    <Pressable
                      style={styles.smallButton}
                      onPress={() => openSiteVisitForInquiry(item)}
                      disabled={loading}
                    >
                      <Text style={styles.smallButtonText}>New site visit</Text>
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
                {renderOfferMeasurementSection()}
                {renderOfferInventorySection()}
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
          <Text style={styles.moduleHeroText}>Staff can record every site visit against a CRM customer, keeping each measurement set as its own saved report for future offers.</Text>
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
              <Text style={styles.cardLabel}>Add a new site visit record</Text>
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
              const savedVisitCount = siteVisits.filter((visit) => String(visit.customer_id || "") === customer.id).length;
              return (
                <Pressable key={`site-visit-customer-${customer.id}`} style={styles.dropdownOption} onPress={() => openSiteVisitForCrmOption(customer)} disabled={loading}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.cardTitleBlock}>
                      <Text style={styles.selectorText}>{customer.id} - {customer.name}</Text>
                      <Text style={styles.muted}>Phone: {customer.phone || "-"}{customer.source_inquiry_id ? ` - Enquiry: ${customer.source_inquiry_id}` : ""}</Text>
                    </View>
                    <Text style={styles.statusPill}>{savedVisitCount ? `${savedVisitCount} saved visits` : "Start new visit"}</Text>
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
              <Text style={styles.statusPill}>{visit.visit_number ? `Visit ${visit.visit_number}` : visit.site_visit_date || "No date"}</Text>
            </View>
            {!linkedCustomer && <Text style={styles.statusPill}>Needs CRM customer link</Text>}
            <Text style={styles.bodyText}>Date: {visit.site_visit_date || "-"} - Staff: {visit.visited_by || visit.submitted_by || "Not set"}{visit.submitted_by_department ? ` - ${visit.submitted_by_department}` : ""}</Text>
            <Text style={styles.bodyText}>Site contact: {visit.site_person_name || linkedCustomer?.name || "Not set"} - {visit.site_person_mobile || linkedCustomer?.phone || "No mobile"}</Text>
            <Text style={styles.bodyText}>Pit {visit.pit_size_mm || "-"} mm - Machine room {visit.machine_room_available || "N"} - Stops {visit.site_stops || "-"}</Text>
            {Array.isArray(visit.opening_schedule) && visit.opening_schedule.length ? (
              <Text style={styles.muted}>
                Openings: {visit.opening_schedule.map((row) => `${row.floor || "-"} FF ${row.ff_height_mm || "-"} / Lintel ${row.lintel_height_mm || "-"}`).join("; ")}
              </Text>
            ) : null}
            {!!visit.notes && <Text style={styles.bodyText}>{visit.notes}</Text>}
            <View style={styles.inlineActions}>
              <Pressable style={styles.smallButton} onPress={() => openExistingSiteVisit(visit)} disabled={loading}>
                <Text style={styles.smallButtonText}>Edit this visit</Text>
              </Pressable>
              <Pressable style={styles.smallButton} onPress={() => openSiteVisitForCrmOption({ id: String(visit.customer_id || ""), name: String(linkedCustomer?.name || visit.customer_name || visit.customer_id || ""), phone: String(linkedCustomer?.phone || visit.site_person_mobile || ""), address: String(linkedCustomer?.address || visit.address || ""), source_inquiry_id: String(visit.site_enquiry_no || linkedCustomer?.source_inquiry_id || "") })} disabled={loading || !linkedCustomer}>
                <Text style={styles.smallButtonText}>New follow-up visit</Text>
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
            <Text style={styles.muted}>Staff portal passwords are managed by the server secret file. Leave the password field blank to use the configured staff password.</Text>
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
                    password: "",
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
                <Pressable style={styles.smallButton} onPress={() => updateAccount(String(user.id), { reset_shared_password: true })} disabled={loading}>
                  <Text style={styles.smallButtonText}>Reset staff password</Text>
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
    const company = String(record.company || "").trim();
    const greeting = company ? `Hello ${company}` : "Hello";
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
      return `${greeting}, a friend mentioned they had used your service, so we wanted to set a short meeting. ${tenderLine} Your company could bid locally while FUZI supplies manufactured elevator parts and kits at a competitive landed cost; our current estimate is ${formatMoney(cost.vendorCost)} before final freight/customs confirmation. Would you be open to a call to discuss partnering on this contract?`;
    }
    if (stage.includes("sample") || stage.includes("smart")) {
      return `${greeting}, FUZI can also supply smaller smart elevator parts, controller accessories, and sample kits internationally. We can quote courier/air freight by chargeable kg and share a small-parts catalog for quick evaluation.`;
    }
    if (stage.includes("cost")) {
      return `${greeting}, we prepared a landed-cost estimate for FUZI manufactured elevator parts/kits. The current calculated vendor cost is ${formatMoney(cost.vendorCost)}, including freight/import assumptions and the local partner fee. Please confirm destination, dimensions, and preferred Incoterm so we can firm up the quote.`;
    }
    return `${greeting}, FUZI manufactures elevator parts and lift kits internationally. We are looking for USA and Canada elevator companies that can install locally while FUZI supplies manufactured parts and kits. Please reply if you would like our catalog, landed-cost sheet, and partnership terms.`;
  }

  function renderInternationalVendorPage() {
    const vendors = asRecords(data?.international_vendors);
    const query = internationalVendorSearch.trim().toLowerCase();
    const filteredByStatus = vendors.filter((item) => {
      if (internationalVendorFilter === "Has email") return Boolean(String(item.email || "").trim());
      if (internationalVendorFilter === "Needs email") return !String(item.email || "").trim();
      if (internationalVendorFilter === "Tender matched") return Boolean(String(item.tender_title || item.closest_tender_title || "").trim());
      if (internationalVendorFilter === "Needs deadline") return !String(item.tender_deadline || item.closest_tender_deadline || "").trim() || ["tbd", "unknown"].includes(String(item.tender_deadline || item.closest_tender_deadline || "").trim().toLowerCase());
      if (internationalVendorFilter === "OpenClaw sent") return Boolean(String(item.last_outreach_at || item.delivery_status || "").trim());
      return true;
    });
    const visibleVendors = filteredByStatus.filter((item) => !query || JSON.stringify(item).toLowerCase().includes(query));
    const vendorPageSize = 25;
    const vendorPageCount = Math.max(1, Math.ceil(visibleVendors.length / vendorPageSize));
    const safeVendorPage = Math.min(internationalVendorPage, vendorPageCount);
    const pagedVendors = visibleVendors.slice((safeVendorPage - 1) * vendorPageSize, safeVendorPage * vendorPageSize);
    const activeVendors = vendors.filter((item) => !String(item.status || "").toLowerCase().includes("lost"));
    const tenderPartners = vendors.filter((item) => String(item.followup_stage || "").toLowerCase().includes("tender") || String(item.tender_source || "").trim());
    const sentVendors = vendors.filter((item) => String(item.last_outreach_at || item.delivery_status || "").trim());
    const shippedVendors = vendors.filter((item) => ["shipped", "delivered", "partner active"].includes(String(item.pipeline_stage || item.shipment_status || "").toLowerCase()));
    const missingEmail = vendors.filter((item) => !String(item.email || "").trim());
    const needsTenderVerification = vendors.filter((item) => ["tbd", "unknown"].includes(String(item.tender_deadline || item.closest_tender_deadline || "").trim().toLowerCase()));
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
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Needs contact</Text>
            <Text style={styles.metricValue}>{missingEmail.length}</Text>
            <Text style={styles.muted}>No email saved; use phone/profile research before sending.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Tender review</Text>
            <Text style={styles.metricValue}>{needsTenderVerification.length}</Text>
            <Text style={styles.muted}>Tender deadlines marked TBD or needing confirmation.</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.cardLabel}>FUZI international vendor sales plan</Text>
          <Text style={styles.bodyText}>1. Match each elevator company to the closest Canada/USA tender by province, region, or national scope.</Text>
          <Text style={styles.bodyText}>2. Ask OpenClaw to draft the first email with the friend-referral opener, nearest tender, meeting request, and FUZI manufactured-parts partnership offer.</Text>
          <Text style={styles.bodyText}>3. Follow up with catalog, landed-cost sheet, bid support pricing, sample/smart-parts quote, then meeting reminder.</Text>
          <Text style={styles.bodyText}>4. Move interested companies to bid partnership, PO request, production, freight, shipped, delivered, and partner active.</Text>
          <Text style={styles.muted}>OpenClaw draft actions can prepare copy without an email address. Send outreach only after the company has a verified email or OpenClaw target.</Text>
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
            onChangeText={(value) => {
              setInternationalVendorSearch(value);
              setInternationalVendorPage(1);
            }}
            placeholder="Search company, country, region, tender, email, status"
          />
          <View style={styles.inlineActions}>
            {["All", "Has email", "Needs email", "Tender matched", "Needs deadline", "OpenClaw sent"].map((filter) => (
              <Pressable
                key={`ivendor-filter-${filter}`}
                style={[styles.smallButton, internationalVendorFilter === filter && styles.selectorPillActive]}
                onPress={() => {
                  setInternationalVendorFilter(filter);
                  setInternationalVendorPage(1);
                }}
              >
                <Text style={styles.smallButtonText}>{filter}</Text>
              </Pressable>
            ))}
          </View>
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
        {!!visibleVendors.length && (
          <View style={styles.paginationBar}>
            <Text style={styles.muted}>Showing {(safeVendorPage - 1) * vendorPageSize + 1}-{Math.min(safeVendorPage * vendorPageSize, visibleVendors.length)} of {visibleVendors.length}</Text>
            <View style={styles.inlineActions}>
              <Pressable style={styles.smallButton} onPress={() => setInternationalVendorPage((page) => Math.max(1, page - 1))} disabled={safeVendorPage <= 1}>
                <Text style={styles.smallButtonText}>Previous</Text>
              </Pressable>
              <Text style={styles.muted}>Page {safeVendorPage} / {vendorPageCount}</Text>
              <Pressable style={styles.smallButton} onPress={() => setInternationalVendorPage((page) => Math.min(vendorPageCount, page + 1))} disabled={safeVendorPage >= vendorPageCount}>
                <Text style={styles.smallButtonText}>Next</Text>
              </Pressable>
            </View>
          </View>
        )}
        {pagedVendors.map((vendor, index) => {
          const id = recordIdentity(vendor) || String(vendor.id || index);
          const cost = internationalVendorCost(vendor);
          const hasEmail = Boolean(String(vendor.email || "").trim());
          const tenderDeadline = String(vendor.tender_deadline || vendor.closest_tender_deadline || "").trim();
          const needsDeadlineCheck = !tenderDeadline || ["tbd", "unknown"].includes(tenderDeadline.toLowerCase());
          return (
            <View key={`ivendor-card-${id}`} style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardTitleBlock}>
                  <Text style={styles.cardTitle}>{fieldText(vendor, ["company", "name", "id"])}</Text>
                  <Text style={styles.muted}>{fieldText(vendor, ["country"])} - {fieldText(vendor, ["region"])} - {fieldText(vendor, ["email"])}</Text>
                </View>
                <Text style={styles.statusPill}>{fieldText(vendor, ["status", "followup_stage"])}</Text>
              </View>
              {(!hasEmail || needsDeadlineCheck) && (
                <View style={styles.alertCard}>
                  {!hasEmail && <Text style={styles.bodyText}>Contact needed: no email is saved for this company. Use phone/profile research before sending outreach.</Text>}
                  {needsDeadlineCheck && <Text style={styles.bodyText}>Tender check needed: confirm the deadline/source before bid outreach.</Text>}
                </View>
              )}
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
                  <Text style={styles.smallButtonText}>Draft catalog intro</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => sendInternationalVendorOutreach(vendor, "2. Tender partner pitch")} disabled={loading || !recordIdentity(vendor)}>
                  <Text style={styles.smallButtonText}>Draft tender pitch</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => sendInternationalVendorOutreach(vendor, "OpenClaw email drafted")} disabled={loading || !recordIdentity(vendor)}>
                  <Text style={styles.smallButtonText}>OpenClaw draft</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => sendInternationalVendorOutreach(vendor, "4. Meeting requested")} disabled={loading || !recordIdentity(vendor)}>
                  <Text style={styles.smallButtonText}>Draft meeting email</Text>
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

  function marketingPromptFor(record: Record<string, unknown>, action = "generate-image") {
    const product = String(record.product_line || "FUZI elevators and manufactured lift parts").trim();
    const audience = String(record.audience || "builders, architects, hotels, hospitals, housing societies, and elevator partners").trim();
    const channel = String(record.channel || "social media and catalog").trim();
    const tone = String(record.tone || "premium, safe, reliable, engineered in India").trim();
    if (action === "draft-catalog") {
      return `Create a polished FUZI company catalog section for ${product}. Audience: ${audience}. Include product benefits, safety/quality claims, use cases, installation/service support, and a concise call to action. Tone: ${tone}.`;
    }
    if (action === "draft-ad-copy") {
      return `Write high-converting ad copy for ${channel} promoting ${product}. Audience: ${audience}. Tone: ${tone}. Include headline, short body, CTA, and 3 variant hooks.`;
    }
    return String(record.ai_prompt || `Create a premium advertising image for FUZI Classic Elevators. Product: ${product}. Audience: ${audience}. Channel: ${channel}. Visual style: clean modern elevator showroom or real installation setting, red/white/black FUZI branding, safety and engineering confidence, no clutter, space for headline text. Tone: ${tone}.`);
  }

  function renderMarketingPlatformPage() {
    const assets = asRecords(data?.marketing_assets);
    const query = marketingSearch.trim().toLowerCase();
    const visibleAssets = assets.filter((asset) => !query || JSON.stringify(asset).toLowerCase().includes(query));
    const imageAssets = assets.filter((asset) => String(asset.asset_type || "").toLowerCase().includes("image"));
    const catalogAssets = assets.filter((asset) => String(asset.asset_type || asset.catalog_title || "").toLowerCase().includes("catalog"));
    const openclawTouched = assets.filter((asset) => String(asset.last_openclaw_at || asset.delivery_status || "").trim());
    return (
      <View>
        <View style={styles.moduleHero}>
          <Text style={styles.eyebrow}>Marketing Platform</Text>
          <Text style={styles.moduleHeroTitle}>AI Ads And FUZI Catalog Studio</Text>
          <Text style={styles.moduleHeroText}>Use AI/OpenClaw to generate ad image prompts, campaign copy, and editable company catalog sections for FUZI elevators, service, manufactured parts, and international partner sales.</Text>
        </View>

        <View style={styles.metricGrid}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Marketing assets</Text>
            <Text style={styles.metricValue}>{assets.length}</Text>
            <Text style={styles.muted}>Saved campaign and catalog records.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>AI image briefs</Text>
            <Text style={styles.metricValue}>{imageAssets.length}</Text>
            <Text style={styles.muted}>Prompts ready for OpenClaw/image generation.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Catalog drafts</Text>
            <Text style={styles.metricValue}>{catalogAssets.length}</Text>
            <Text style={styles.muted}>Company catalog sections and layouts.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>OpenClaw requests</Text>
            <Text style={styles.metricValue}>{openclawTouched.length}</Text>
            <Text style={styles.muted}>AI/OpenClaw creative handoffs.</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.cardLabel}>Create marketing asset</Text>
          <View style={styles.formGrid}>
            {[
              ["campaign_name", "Campaign name"],
              ["asset_type", "Asset type"],
              ["product_line", "Product / service"],
              ["audience", "Target audience"],
              ["channel", "Marketing channel"],
              ["tone", "Tone / brand style"],
              ["headline", "Headline"],
              ["status", "Status"],
              ["openclaw_target", "OpenClaw target"],
            ].map(([key, label]) => (
              <View key={`marketing-${key}`} style={styles.field}>
                <Text style={styles.label}>{label}</Text>
                <TextInput
                  style={styles.input}
                  value={String(marketingDraft[key as keyof typeof marketingDraft] || "")}
                  onChangeText={(value) => setMarketingDraft((draft) => ({ ...draft, [key]: value }))}
                />
              </View>
            ))}
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Ad copy</Text>
            <TextInput style={[styles.input, styles.textarea]} value={marketingDraft.ad_copy} onChangeText={(value) => setMarketingDraft((draft) => ({ ...draft, ad_copy: value }))} multiline />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>AI image prompt</Text>
            <TextInput style={[styles.input, styles.textarea]} value={marketingDraft.ai_prompt} onChangeText={(value) => setMarketingDraft((draft) => ({ ...draft, ai_prompt: value }))} multiline />
          </View>
          <View style={styles.formGrid}>
            <View style={styles.field}>
              <Text style={styles.label}>Catalog title</Text>
              <TextInput style={styles.input} value={marketingDraft.catalog_title} onChangeText={(value) => setMarketingDraft((draft) => ({ ...draft, catalog_title: value }))} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Catalog sections</Text>
              <TextInput style={[styles.input, styles.textarea]} value={marketingDraft.catalog_sections} onChangeText={(value) => setMarketingDraft((draft) => ({ ...draft, catalog_sections: value }))} multiline />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Design notes</Text>
              <TextInput style={[styles.input, styles.textarea]} value={marketingDraft.design_notes} onChangeText={(value) => setMarketingDraft((draft) => ({ ...draft, design_notes: value }))} multiline />
            </View>
          </View>
          <View style={styles.linkedSystemsPanel}>
            <Text style={styles.cardLabel}>OpenClaw image generation brief</Text>
            <Text style={styles.muted}>{marketingPromptFor(marketingDraft, "generate-image")}</Text>
          </View>
          <View style={styles.inlineActions}>
            <Pressable style={styles.smallButton} onPress={() => setMarketingDraft((draft) => ({ ...draft, asset_type: "AI ad image", ai_prompt: marketingPromptFor(draft, "generate-image") }))}>
              <Text style={styles.smallButtonText}>Build image prompt</Text>
            </Pressable>
            <Pressable style={styles.smallButton} onPress={() => setMarketingDraft((draft) => ({ ...draft, asset_type: "Ad copy", ai_prompt: marketingPromptFor(draft, "draft-ad-copy") }))}>
              <Text style={styles.smallButtonText}>Build ad copy brief</Text>
            </Pressable>
            <Pressable style={styles.smallButton} onPress={() => setMarketingDraft((draft) => ({ ...draft, asset_type: "Company catalog", ai_prompt: marketingPromptFor(draft, "draft-catalog") }))}>
              <Text style={styles.smallButtonText}>Build catalog brief</Text>
            </Pressable>
          </View>
          <Pressable style={styles.primaryButton} onPress={() => saveMarketingAsset()} disabled={loading || !marketingDraft.campaign_name.trim()}>
            <Text style={styles.primaryButtonText}>Save marketing asset</Text>
          </Pressable>
          <View style={styles.inlineActions}>
            <Pressable style={styles.smallButton} onPress={() => saveMarketingAsset("generate-image")} disabled={loading || !marketingDraft.campaign_name.trim()}>
              <Text style={styles.smallButtonText}>Save & generate image</Text>
            </Pressable>
            <Pressable style={styles.smallButton} onPress={() => saveMarketingAsset("draft-ad-copy")} disabled={loading || !marketingDraft.campaign_name.trim()}>
              <Text style={styles.smallButtonText}>Save & draft ad copy</Text>
            </Pressable>
            <Pressable style={styles.smallButton} onPress={() => saveMarketingAsset("draft-catalog")} disabled={loading || !marketingDraft.campaign_name.trim()}>
              <Text style={styles.smallButtonText}>Save & draft catalog</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.cardLabel}>Find marketing work</Text>
          <TextInput style={styles.input} value={marketingSearch} onChangeText={setMarketingSearch} placeholder="Search campaign, catalog, audience, channel, OpenClaw status" />
        </View>

        <Text style={styles.sectionTitle}>Marketing Studio</Text>
        {!visibleAssets.length && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No marketing assets yet</Text>
            <Text style={styles.muted}>Create an ad image prompt or company catalog draft, then send it to OpenClaw for AI creative generation.</Text>
          </View>
        )}
        {visibleAssets.map((asset, index) => {
          const id = recordIdentity(asset) || String(asset.id || index);
          return (
            <View key={`marketing-${id}`} style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardTitleBlock}>
                  <Text style={styles.cardTitle}>{fieldText(asset, ["campaign_name", "title", "id"])}</Text>
                  <Text style={styles.muted}>{fieldText(asset, ["asset_type"])} - {fieldText(asset, ["channel"])} - {fieldText(asset, ["audience"])}</Text>
                </View>
                <Text style={styles.statusPill}>{fieldText(asset, ["status", "delivery_status"])}</Text>
              </View>
              <Text style={styles.bodyText}>Headline: {fieldText(asset, ["headline"])}</Text>
              <Text style={styles.bodyText}>Catalog: {fieldText(asset, ["catalog_title"])} - {fieldText(asset, ["catalog_sections"])}</Text>
              <Text style={styles.muted}>{String(asset.ai_prompt || marketingPromptFor(asset, "generate-image"))}</Text>
              {!!asset.last_openclaw_at && <Text style={styles.bodyText}>OpenClaw: {String(asset.last_openclaw_action || "-")} - {String(asset.last_openclaw_at || "-")}</Text>}
              <View style={styles.inlineActions}>
                <Pressable style={styles.smallButton} onPress={() => requestMarketingOpenClaw(asset, "generate-image")} disabled={loading || !recordIdentity(asset)}>
                  <Text style={styles.smallButtonText}>Generate ad image</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => requestMarketingOpenClaw(asset, "draft-ad-copy")} disabled={loading || !recordIdentity(asset)}>
                  <Text style={styles.smallButtonText}>Draft ad copy</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => requestMarketingOpenClaw(asset, "draft-catalog")} disabled={loading || !recordIdentity(asset)}>
                  <Text style={styles.smallButtonText}>Draft catalog</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => updateMarketingAsset(asset, { status: "Approved", approved_at: new Date().toISOString() })} disabled={loading || !recordIdentity(asset)}>
                  <Text style={styles.smallButtonText}>Approve</Text>
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
              <Text style={styles.label}>Purchase price</Text>
              <TextInput style={styles.input} value={inventoryDraft.purchase_price} onChangeText={(value) => setInventoryDraft((draft) => ({ ...draft, purchase_price: value, unit_cost: value }))} keyboardType="numeric" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Current selling price</Text>
              <TextInput style={styles.input} value={inventoryDraft.current_price} onChangeText={(value) => setInventoryDraft((draft) => ({ ...draft, current_price: value, sale_price: value }))} keyboardType="numeric" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Price date</Text>
              <TextInput style={styles.input} value={inventoryDraft.price_date} onChangeText={(value) => setInventoryDraft((draft) => ({ ...draft, price_date: value }))} placeholder="YYYY-MM-DD" />
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
    const purchasePrice = offerNumber(item.purchase_price || item.unit_cost);
    const currentPrice = inventoryPrice(item);
    const edit = inventoryEdits[id] || {
      reorder_point: String(reorderPoint),
      target_stock: String(target),
      current_price: String(currentPrice || ""),
      purchase_price: String(purchasePrice || ""),
      price_date: String(item.price_date || item.last_updated || new Date().toISOString().slice(0, 10)),
    };
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
        <Text style={styles.bodyText}>Current price: {formatMoney(currentPrice)} · Purchase price: {formatMoney(purchasePrice)} · Price date: {String(item.price_date || item.last_updated || "-")}</Text>
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
              <Pressable style={styles.smallButton} onPress={() => setActiveTab("offerManager")} disabled={loading}>
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
          <View style={styles.inlineEditField}>
            <Text style={styles.label}>Current price</Text>
            <TextInput
              style={styles.compactInput}
              value={edit.current_price}
              onChangeText={(value) => setInventoryEdits((draft) => ({ ...draft, [id]: { ...edit, current_price: value } }))}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inlineEditField}>
            <Text style={styles.label}>Purchase price</Text>
            <TextInput
              style={styles.compactInput}
              value={edit.purchase_price}
              onChangeText={(value) => setInventoryEdits((draft) => ({ ...draft, [id]: { ...edit, purchase_price: value } }))}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inlineEditField}>
            <Text style={styles.label}>Price date</Text>
            <TextInput
              style={styles.compactInput}
              value={edit.price_date}
              onChangeText={(value) => setInventoryEdits((draft) => ({ ...draft, [id]: { ...edit, price_date: value } }))}
              placeholder="YYYY-MM-DD"
            />
          </View>
          <Pressable
            style={styles.smallButton}
            onPress={() => updateInventoryItem(item, {
              reorder_point: edit.reorder_point,
              target_stock: edit.target_stock,
              current_price: edit.current_price,
              sale_price: edit.current_price,
              unit_price: edit.current_price,
              purchase_price: edit.purchase_price,
              unit_cost: edit.purchase_price,
              price_date: edit.price_date,
            })}
            disabled={loading}
          >
            <Text style={styles.smallButtonText}>Save stock/pricing</Text>
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

  function tenderMoney(value: unknown) {
    return Number(String(value || "0").replace(/[^0-9.-]/g, "")) || 0;
  }

  function tenderTimeLeft(dueAt: unknown) {
    const due = new Date(String(dueAt || ""));
    if (Number.isNaN(due.getTime())) return "-";
    const diff = due.getTime() - Date.now();
    const abs = Math.abs(diff);
    const days = Math.floor(abs / 86400000);
    const hours = Math.floor((abs % 86400000) / 3600000);
    return diff < 0 ? `Overdue ${days}d ${hours}h` : `${days}d ${hours}h left`;
  }

  function tenderDueDays(dateValue: unknown) {
    const date = new Date(String(dateValue || ""));
    if (Number.isNaN(date.getTime())) return 0;
    return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
  }

  function tenderStatus(record: Record<string, unknown>) {
    const status = String(record.status || "Tender Pending");
    const start = new Date(String(record.stipulated_work_start_date || ""));
    const finish = new Date(String(record.completion_date || ""));
    const now = new Date();
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(finish.getTime()) && now >= start && now <= finish) return "Work In Progress";
    return status;
  }

  function tenderItemsFromDraft() {
    if (tenderDraft.product_type === "Escalator") {
      const quantity = Math.max(1, Number(tenderDraft.escalator_quantity || 1));
      return Array.from({ length: quantity }, (_, index) => ({ item_no: index + 1, type: "Escalator", location_type: tenderDraft.location_type, degree: tenderDraft.escalator_degree, step_width_mm: tenderDraft.step_width_mm, quoted_price: tenderMoney(tenderDraft.quoted_price), quantity: 1 }));
    }
    const quantity = Math.max(1, Number(tenderDraft.lift_quantity || 1));
    return Array.from({ length: quantity }, (_, index) => ({ item_no: index + 1, type: "Lift", passenger_capacity: tenderDraft.passenger_capacity, number_of_stops: tenderDraft.number_of_stops, speed: tenderDraft.speed, door_finish: tenderDraft.door_finish || "Hairline", cabin_finish: tenderDraft.cabin_finish || "Hairline", door_size: tenderDraft.door_size, door_width_mm: tenderDraft.door_width_mm, door_height_mm: tenderDraft.door_height_mm, quantity: 1, quoted_price: tenderMoney(tenderDraft.quoted_price) }));
  }

  function tenderPayloadFromDraft() {
    return {
      ...tenderDraft,
      title: tenderDraft.party_name || tenderDraft.tender_invited_by || tenderDraft.file_number,
      price_in_nit: tenderMoney(tenderDraft.price_in_nit),
      emd_amount: tenderMoney(tenderDraft.emd_amount),
      emd_deposit_amount: tenderMoney(tenderDraft.emd_deposit_amount),
      total_parties_participated: Number(tenderDraft.total_parties_participated || 0),
      lowest_rates: tenderMoney(tenderDraft.lowest_rates),
      order_value: tenderMoney(tenderDraft.order_value),
      basic_value: tenderMoney(tenderDraft.basic_value),
      gst_amount: tenderMoney(tenderDraft.gst_amount),
      gross_order_amount: tenderMoney(tenderDraft.gross_order_amount),
      items: tenderItemsFromDraft(),
      participants: tenderDraft.party_name_entry.trim() || tenderDraft.quoted_rates_entry.trim() ? [{ party_name: tenderDraft.party_name_entry, quoted_rates: tenderMoney(tenderDraft.quoted_rates_entry) }] : [],
      bills: tenderDraft.bill_number.trim() || tenderDraft.bill_amount.trim() ? [{ our_bill_number: tenderDraft.bill_number, bill_date: tenderDraft.bill_date, amount: tenderMoney(tenderDraft.bill_amount), billing_period: tenderDraft.billing_period, payment_received: tenderDraft.payment_received, payment_received_date: tenderDraft.payment_received_date }] : [],
      emd_records: tenderDraft.emd_amount.trim() || tenderDraft.emd_deposit_amount.trim() ? [{ emd_amount: tenderMoney(tenderDraft.emd_amount), deposited_by: tenderDraft.emd_deposited_by, deposit_date: tenderDraft.emd_deposit_date, deposit_amount: tenderMoney(tenderDraft.emd_deposit_amount), return_status: tenderDraft.status === "EMD Returned" ? "Returned" : "Pending" }] : [],
      sd_records: tenderDraft.sd_amount.trim() ? [{ sd_amount: tenderMoney(tenderDraft.sd_amount), deposited_by: tenderDraft.sd_deposited_by, deposit_date: tenderDraft.sd_deposit_date, amount: tenderMoney(tenderDraft.sd_amount) }] : [],
    };
  }

  async function saveTender() {
    if (!tenderDraft.tender_invited_by.trim() && !tenderDraft.party_name.trim()) {
      const text = "Tender invited by / party name is required.";
      Platform.OS === "web" ? setMessage(text) : Alert.alert("Missing field", text);
      return;
    }
    setLoading(true);
    try {
      const id = tenderDraft.id;
      await apiFetch(id ? `/api/portal/tender/${encodeURIComponent(id)}` : "/api/portal/tender", {
        method: id ? "PATCH" : "POST",
        token,
        body: JSON.stringify(tenderPayloadFromDraft()),
      });
      setTenderDraft(emptyTenderDraft);
      await loadPortal();
      setMessage(id ? "Tender updated." : "Tender saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Tender could not be saved.");
    } finally {
      setLoading(false);
    }
  }

  function editTender(record: Record<string, unknown>) {
    const item = asRecords(record.items)[0] || {};
    const participant = asRecords(record.participants)[0] || {};
    const bill = asRecords(record.bills)[0] || {};
    const sd = asRecords(record.sd_records)[0] || {};
    setTenderDraft({
      ...emptyTenderDraft,
      ...Object.fromEntries(Object.entries(record).map(([key, value]) => [key, String(value ?? "")])),
      id: String(recordIdentity(record) || ""),
      product_type: String(record.product_type || item.type || "Lift"),
      passenger_capacity: String(item.passenger_capacity || ""),
      number_of_stops: String(item.number_of_stops || ""),
      speed: String(item.speed || ""),
      door_finish: String(item.door_finish || "Hairline"),
      cabin_finish: String(item.cabin_finish || "Hairline"),
      lift_quantity: String(item.quantity || "1"),
      location_type: String(item.location_type || "Indoor"),
      escalator_degree: String(item.degree || "30"),
      step_width_mm: String(item.step_width_mm || ""),
      escalator_quantity: String(item.quantity || "1"),
      quoted_price: String(item.quoted_price || record.quoted_price || ""),
      party_name_entry: String(participant.party_name || ""),
      quoted_rates_entry: String(participant.quoted_rates || ""),
      bill_number: String(bill.our_bill_number || ""),
      bill_date: String(bill.bill_date || ""),
      bill_amount: String(bill.amount || ""),
      billing_period: String(bill.billing_period || ""),
      payment_received: String(bill.payment_received || "No"),
      payment_received_date: String(bill.payment_received_date || ""),
      sd_amount: String(sd.sd_amount || sd.amount || ""),
      sd_deposited_by: String(sd.deposited_by || "DD"),
      sd_deposit_date: String(sd.deposit_date || ""),
    });
  }

  async function updateTenderStatus(record: Record<string, unknown>, status: string) {
    const id = recordIdentity(record);
    if (!id) return;
    setLoading(true);
    try {
      await apiFetch(`/api/portal/tender/${encodeURIComponent(id)}`, { method: "PATCH", token, body: JSON.stringify({ status }) });
      await loadPortal();
      setMessage(`Tender marked ${status}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Tender status could not be updated.");
    } finally {
      setLoading(false);
    }
  }

  function renderTenderField(label: string, key: keyof typeof emptyTenderDraft, placeholder = "") {
    return (
      <View style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        <TextInput style={styles.input} value={String(tenderDraft[key] || "")} onChangeText={(value) => setTenderDraft((draft) => ({ ...draft, [key]: value }))} placeholder={placeholder} />
      </View>
    );
  }

  function renderTenderPortal() {
    const tenders = asRecords(data?.tenders);
    const query = tenderSearch.trim().toLowerCase();
    const filtered = tenders.filter((record) => tenderStatusFilter === "All" || tenderStatus(record) === tenderStatusFilter).filter((record) => !query || JSON.stringify(record).toLowerCase().includes(query)).sort((a, b) => String(a.tender_due_at || "").localeCompare(String(b.tender_due_at || "")));
    const statuses = ["All", "Tender Pending", "Tender Submitted", "Tender Opened", "Tender Lost", "Order Pending", "Work In Progress", "Completed", "EMD Pending", "EMD Returned", "SD Pending", "SD Due", "SD Refunded"];
    const pending = tenders.filter((record) => tenderStatus(record) === "Tender Pending");
    const submitted = tenders.filter((record) => ["Tender Submitted", "Tender Opened", "Order Pending", "Work In Progress", "Completed"].includes(tenderStatus(record)));
    const opened = tenders.filter((record) => ["Tender Opened", "Tender Lost", "Order Pending", "Work In Progress", "Completed"].includes(tenderStatus(record)));
    const lost = tenders.filter((record) => tenderStatus(record).includes("Lost") || tenderStatus(record).includes("EMD"));
    const ordersPending = tenders.filter((record) => tenderStatus(record) === "Order Pending");
    const workInProgress = tenders.filter((record) => tenderStatus(record) === "Work In Progress");
    const emdPending = tenders.filter((record) => tenderStatus(record) === "EMD Pending");
    const sdPending = tenders.filter((record) => asRecords(record.sd_records).some((sd) => !String(sd.status || "").toLowerCase().includes("refund")));
    const sdDue = tenders.filter((record) => asRecords(record.sd_records).some((sd) => String(sd.refund_due_date || "") && String(sd.refund_due_date || "") <= new Date().toISOString().slice(0, 10)));
    const competitorRows = new Map<string, { name: string; tenders: number; won: number; lowest: number; fuzi: number }>();
    tenders.forEach((record) => asRecords(record.participants).forEach((party) => {
      const name = String(party.party_name || "").trim();
      if (!name) return;
      const row = competitorRows.get(name) || { name, tenders: 0, won: 0, lowest: 0, fuzi: 0 };
      const rate = tenderMoney(party.quoted_rates);
      row.tenders += 1;
      row.lowest = row.lowest ? Math.min(row.lowest, rate) : rate;
      if (name === String(record.lowest_party_name || "")) row.won += tenderMoney(record.order_value || record.gross_order_amount);
      row.fuzi += tenderMoney(record.quoted_price || record.price_in_nit);
      competitorRows.set(name, row);
    }));
    return (
      <View>
        <View style={styles.moduleHero}>
          <Text style={styles.eyebrow}>Tender Portal</Text>
          <Text style={styles.moduleHeroTitle}>Tender Management Dashboard</Text>
          <Text style={styles.moduleHeroText}>Manage tender pending, submission, opening, order, billing, EMD, SD, rates, and competitor history from one CRM module.</Text>
        </View>
        <View style={styles.metricGrid}>
          {[
            ["Tender pending", pending.length, "Due-date wise tender queue."],
            ["Tender submitted", submitted.length, formatMoney(submitted.reduce((sum, item) => sum + tenderMoney(item.price_in_nit || item.quoted_price), 0))],
            ["Opened", opened.length, `${lost.length} lost`],
            ["Orders pending", ordersPending.length, "Won but order details pending."],
            ["WIP gross value", formatMoney(workInProgress.reduce((sum, item) => sum + tenderMoney(item.gross_order_amount || item.order_value), 0)), "Work in progress order value."],
            ["Payment due", formatMoney(tenders.reduce((sum, item) => sum + tenderMoney(item.total_payment_due), 0)), "Unpaid bill amount."],
            ["EMD pending", formatMoney(emdPending.reduce((sum, item) => sum + tenderMoney(item.emd_amount), 0)), `${emdPending.length} records`],
            ["SD pending/due", formatMoney(sdPending.reduce((sum, item) => sum + asRecords(item.sd_records).reduce((acc, sd) => acc + tenderMoney(sd.amount || sd.sd_amount), 0), 0)), `${sdDue.length} due`],
          ].map(([label, value, detail]) => (
            <View key={String(label)} style={styles.card}>
              <Text style={styles.cardLabel}>{label}</Text>
              <Text style={styles.metricValue}>{value}</Text>
              <Text style={styles.muted}>{detail}</Text>
            </View>
          ))}
        </View>
        <View style={styles.formCard}>
          <Text style={styles.cardLabel}>{tenderDraft.id ? "Edit tender" : "New tender entry"}</Text>
          <View style={styles.formGrid}>
            {renderTenderField("Job Number", "job_number", "Auto if blank")}
            {renderTenderField("File Number", "file_number")}
            {renderTenderField("Tender invited by / Party name", "tender_invited_by")}
            {renderTenderField("Party name", "party_name")}
            {renderTenderField("Tender due date and time", "tender_due_at", "YYYY-MM-DDTHH:mm")}
            {renderTenderField("Status", "status")}
            <View style={styles.field}>
              <Text style={styles.label}>Product type</Text>
              <View style={styles.inlineActions}>
                {["Lift", "Escalator"].map((type) => (
                  <Pressable key={type} style={[styles.smallButton, tenderDraft.product_type === type && styles.selectorPillActive]} onPress={() => setTenderDraft((draft) => ({ ...draft, product_type: type }))}>
                    <Text style={styles.smallButtonText}>{type}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            {renderTenderField("Price in NIT", "price_in_nit")}
            {renderTenderField("Warranty period", "warranty_period")}
            {renderTenderField("DLP period days", "dlp_period")}
            {renderTenderField("EMD amount as per tender", "emd_amount")}
            {renderTenderField("EMD deposited by", "emd_deposited_by", "DD / FDR / BG / eGrass / Online / Other")}
            {renderTenderField("EMD deposit date", "emd_deposit_date")}
            {renderTenderField("EMD deposit amount", "emd_deposit_amount")}
          </View>
          <Text style={styles.sectionTitle}>{tenderDraft.product_type === "Escalator" ? "Escalator Details" : "Lift Details"}</Text>
          <View style={styles.formGrid}>
            {tenderDraft.product_type === "Escalator" ? (
              <>
                {renderTenderField("Location type", "location_type", "Indoor / Semi Outdoor / Fully Outdoor")}
                {renderTenderField("Degree", "escalator_degree", "30 or 35")}
                {renderTenderField("Step width mm", "step_width_mm")}
                {renderTenderField("Quoted price", "quoted_price")}
                {renderTenderField("Quantity", "escalator_quantity")}
              </>
            ) : (
              <>
                {renderTenderField("Passenger capacity", "passenger_capacity")}
                {renderTenderField("Number of stops", "number_of_stops")}
                {renderTenderField("Speed", "speed")}
                {renderTenderField("Door finish", "door_finish", "Hairline / Honeycomb / Moonrock")}
                {renderTenderField("Cabin finish", "cabin_finish", "Hairline / Honeycomb / Moonrock")}
                {renderTenderField("Door size", "door_size")}
                {renderTenderField("Door width mm", "door_width_mm")}
                {renderTenderField("Door height mm", "door_height_mm")}
                {renderTenderField("Quantity", "lift_quantity")}
                {renderTenderField("Quoted price", "quoted_price")}
              </>
            )}
          </View>
          <Text style={styles.sectionTitle}>Opening, Order, Billing, SD</Text>
          <View style={styles.formGrid}>
            {renderTenderField("Opening date", "opening_date")}
            {renderTenderField("Total parties participated", "total_parties_participated")}
            {renderTenderField("Participant party name", "party_name_entry")}
            {renderTenderField("Participant quoted rates", "quoted_rates_entry")}
            {renderTenderField("Lowest party name", "lowest_party_name")}
            {renderTenderField("Lowest rates", "lowest_rates")}
            {renderTenderField("Order number", "order_number")}
            {renderTenderField("Order date", "order_date")}
            {renderTenderField("Order value", "order_value")}
            {renderTenderField("Agreement number", "agreement_number")}
            {renderTenderField("Basic value", "basic_value")}
            {renderTenderField("GST amount", "gst_amount")}
            {renderTenderField("Gross order amount", "gross_order_amount")}
            {renderTenderField("Work start date", "stipulated_work_start_date")}
            {renderTenderField("Completion date as per order", "completion_date")}
            {renderTenderField("Our bill number", "bill_number")}
            {renderTenderField("Bill date", "bill_date")}
            {renderTenderField("Bill amount", "bill_amount")}
            {renderTenderField("Billing period", "billing_period")}
            {renderTenderField("Payment received Yes/No", "payment_received")}
            {renderTenderField("Payment received date", "payment_received_date")}
            {renderTenderField("SD amount", "sd_amount")}
            {renderTenderField("SD deposited by", "sd_deposited_by")}
            {renderTenderField("SD deposit date", "sd_deposit_date")}
          </View>
          <View style={styles.inlineActions}>
            <Pressable style={styles.primaryButtonInline} onPress={saveTender} disabled={loading}>
              <Text style={styles.primaryButtonText}>{tenderDraft.id ? "Update tender" : "Save tender"}</Text>
            </Pressable>
            {!!tenderDraft.id && <Pressable style={styles.secondaryButton} onPress={() => setTenderDraft(emptyTenderDraft)} disabled={loading}><Text style={styles.secondaryButtonText}>Cancel edit</Text></Pressable>}
          </View>
        </View>
        <Text style={styles.sectionTitle}>Tender Pending List</Text>
        <View style={styles.formCard}>
          <TextInput style={styles.input} value={tenderSearch} onChangeText={setTenderSearch} placeholder="Search job, file, party, product, competitor" />
          <View style={styles.inlineActions}>
            {statuses.map((status) => <Pressable key={status} style={[styles.smallButton, tenderStatusFilter === status && styles.selectorPillActive]} onPress={() => setTenderStatusFilter(status)}><Text style={styles.smallButtonText}>{status}</Text></Pressable>)}
          </View>
        </View>
        {filtered.map((record, index) => {
          const status = tenderStatus(record);
          const bills = asRecords(record.bills);
          const sdDueText = asRecords(record.sd_records).map((sd) => String(sd.refund_due_date || "")).filter(Boolean).sort()[0] || "";
          return (
            <View key={`tender-${recordIdentity(record) || index}`} style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardTitleBlock}>
                  <Text style={styles.cardTitle}>{String(record.job_number || record.id || "-")} - {String(record.party_name || record.tender_invited_by || "-")}</Text>
                  <Text style={styles.muted}>File {String(record.file_number || "-")} - {String(record.product_type || "-")} - Due {String(record.tender_due_at || "-")}</Text>
                </View>
                <Text style={styles.statusPill}>{status}</Text>
              </View>
              <Text style={styles.bodyText}>Time left: {tenderTimeLeft(record.tender_due_at)} - Quoted/NIT: {formatMoney(tenderMoney(record.quoted_price || record.price_in_nit))} - Order: {formatMoney(tenderMoney(record.order_value || record.gross_order_amount))}</Text>
              <Text style={styles.bodyText}>Payment due: {formatMoney(tenderMoney(record.total_payment_due))} - Due days: {String(record.payment_due_days || bills.reduce((max, bill) => Math.max(max, tenderDueDays(bill.bill_date)), 0))}</Text>
              <Text style={styles.bodyText}>EMD: {formatMoney(tenderMoney(record.emd_amount))} - SD due: {sdDueText || "-"}</Text>
              <Text style={styles.muted}>Items: {asRecords(record.items).map((item) => `${String(item.type || record.product_type)} x ${String(item.quantity || 1)}`).join(", ") || "-"}</Text>
              <View style={styles.historyPanel}>
                <Text style={styles.cardLabel}>Participants</Text>
                {asRecords(record.participants).map((party, partyIndex) => <Text key={`party-${partyIndex}`} style={styles.muted}>{String(party.party_name || "-")} - {formatMoney(tenderMoney(party.quoted_rates))}</Text>)}
                {!asRecords(record.participants).length && <Text style={styles.muted}>No competitor/participant rates recorded.</Text>}
              </View>
              <View style={styles.inlineActions}>
                <Pressable style={styles.smallButton} onPress={() => editTender(record)} disabled={loading}><Text style={styles.smallButtonText}>Edit</Text></Pressable>
                {["Tender Submitted", "Tender Opened", "Tender Lost", "Order Pending", "Work In Progress", "Completed", "EMD Returned", "SD Refunded"].map((nextStatus) => <Pressable key={`${recordIdentity(record)}-${nextStatus}`} style={styles.smallButton} onPress={() => updateTenderStatus(record, nextStatus)} disabled={loading}><Text style={styles.smallButtonText}>{nextStatus}</Text></Pressable>)}
              </View>
            </View>
          );
        })}
        {!filtered.length && <View style={styles.card}><Text style={styles.cardTitle}>No tenders found</Text><Text style={styles.muted}>Create the first tender above or change filters.</Text></View>}
        <Text style={styles.sectionTitle}>Rate Analysis</Text>
        <View style={styles.analyticsPanel}>
          {filtered.slice(0, 12).map((record, index) => <View key={`rate-${recordIdentity(record) || index}`} style={styles.analyticsRow}><View style={styles.analyticsRowHeader}><Text style={styles.cardTitle}>{String(record.product_type || "-")} - {String(record.party_name || record.tender_invited_by || "-")}</Text><Text style={styles.statusPill}>{formatMoney(tenderMoney(record.quoted_price || record.price_in_nit))}</Text></View><Text style={styles.muted}>{asRecords(record.items).map((item) => `${String(item.passenger_capacity || item.step_width_mm || "-")} / ${String(item.number_of_stops || item.degree || "-")} / ${String(item.speed || item.door_finish || "-")}`).join(" - ")}</Text></View>)}
        </View>
        <Text style={styles.sectionTitle}>Competitor Analysis</Text>
        <View style={styles.metricGrid}>
          {[...competitorRows.values()].slice(0, 12).map((row) => <View key={`competitor-${row.name}`} style={styles.card}><Text style={styles.cardLabel}>{row.name}</Text><Text style={styles.metricValue}>{row.tenders}</Text><Text style={styles.muted}>Won value {formatMoney(row.won)} - Lowest {formatMoney(row.lowest)} - Fuzi comparison {formatMoney(row.fuzi)}</Text></View>)}
          {!competitorRows.size && <View style={styles.card}><Text style={styles.cardTitle}>No competitor rates yet</Text><Text style={styles.muted}>Add tender opening participants to build competitor analytics.</Text></View>}
        </View>
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
        return renderDepartmentProjectDashboard();
      case "installations":
        return renderInstallationPage();
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
      case "marketing":
        return renderMarketingPlatformPage();
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
        return renderPaymentAccountsPage();
      case "commissioning":
        return renderCommissioningPage();
      case "backoffice":
        return renderFeaturePage("Back Office", "Customer, site, product, and document back-office records.", asRecords(data?.customers), ["name"], [["id"], ["address"], ["status"]]);
      case "tender":
        return renderTenderPortal();
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

  async function saveMarketingAsset(openClawAction?: "generate-image" | "draft-ad-copy" | "draft-catalog") {
    if (!marketingDraft.campaign_name.trim()) {
      const text = "Campaign name is required.";
      Platform.OS === "web" ? setMessage(text) : Alert.alert("Missing field", text);
      return;
    }
    setLoading(true);
    try {
      const response = await apiFetch<{ record?: Record<string, unknown> }>("/api/portal/marketing-assets", {
        method: "POST",
        token,
        body: JSON.stringify({
          ...marketingDraft,
          ai_prompt: marketingDraft.ai_prompt || marketingPromptFor(marketingDraft, openClawAction || "generate-image"),
        }),
      });
      const savedId = recordIdentity(response.record || {});
      if (openClawAction && savedId) {
        await apiFetch(`/api/portal/marketing-assets/${encodeURIComponent(savedId)}/openclaw`, {
          method: "POST",
          token,
          body: JSON.stringify({
            action: openClawAction,
            prompt: marketingPromptFor({ ...marketingDraft, ...(response.record || {}) }, openClawAction),
            target: marketingDraft.openclaw_target || "",
          }),
        });
      }
      setMarketingDraft(emptyMarketingDraft);
      await loadPortal();
      setMessage(openClawAction ? "Marketing asset saved and sent to OpenClaw." : "Marketing asset saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Marketing asset could not be saved.");
    } finally {
      setLoading(false);
    }
  }

  async function updateMarketingAsset(record: Record<string, unknown>, patch: Record<string, unknown>) {
    const id = recordIdentity(record);
    if (!id) return;
    setLoading(true);
    try {
      await apiFetch(`/api/portal/marketing-assets/${encodeURIComponent(id)}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(patch),
      });
      await loadPortal();
      setMessage("Marketing asset updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Marketing asset could not be updated.");
    } finally {
      setLoading(false);
    }
  }

  async function requestMarketingOpenClaw(record: Record<string, unknown>, action: "generate-image" | "draft-ad-copy" | "draft-catalog") {
    const id = recordIdentity(record);
    if (!id) return;
    setLoading(true);
    try {
      await apiFetch(`/api/portal/marketing-assets/${encodeURIComponent(id)}/openclaw`, {
        method: "POST",
        token,
        body: JSON.stringify({
          action,
          prompt: marketingPromptFor(record, action),
          target: record.openclaw_target || "",
        }),
      });
      await loadPortal();
      setMessage(action === "generate-image" ? "OpenClaw image generation request sent." : "OpenClaw marketing draft request sent.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "OpenClaw marketing request failed.");
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
    const customerId = String(record.customer_id || "");
    const siteMeasurements = offerMeasurementPayloadFromSiteVisit(siteVisitsForCustomerId(customerId)[0]);
    setOfferDraft({
      ...emptyOfferDraft,
      ...siteMeasurements,
      customer_name: customerName,
      offer_name: customerName,
      offer_type: String(record.lead_type || record.leadtype || "Individual"),
      lead_status: "Costing Pending",
      createdbyname: data?.viewer?.display_name || username,
      customer_id: customerId,
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

  async function sendCustomerOccasionReminders() {
    if (!isAdmin) {
      setMessage("Only admin can send customer occasion reminders.");
      return;
    }
    setLoading(true);
    try {
      const result = await apiFetch<{ count?: number; date?: string }>("/api/portal/customers/occasion-reminders", {
        method: "POST",
        token,
        body: JSON.stringify({}),
      });
      await loadPortal();
      setMessage(`${result.count || 0} customer occasion reminders queued for ${result.date || "today"}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Customer occasion reminders could not be sent.");
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
          body: JSON.stringify(payload),
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
    if (!paymentDraft.customer_id) {
      const text = "Select a customer before saving an accounts payment.";
      Platform.OS === "web" ? setMessage(text) : Alert.alert("Missing field", text);
      return;
    }
    const summary = paymentAccountSummary(paymentDraft as Record<string, unknown>);
    if (!summary.splitMatches) {
      const text = "Basic contract value must equal basic cheque value plus basic cash value plus basic credit card value.";
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
          customer_id: paymentDraft.customer_id || estimate?.customer_id || "",
          customer_name: paymentDraft.customer_name || estimate?.customer_name || "",
          amount: summary.finalContract,
          check_gst_value: summary.checkGst,
          credit_card_charge_value: summary.cardCharge,
          card_charge_paid_by: "Client",
          final_contract_value: summary.finalContract,
          outstanding_check: summary.outstandingCheck,
          outstanding_cash: summary.outstandingCash,
          outstanding_card: summary.outstandingCard,
          outstanding_total: summary.outstandingTotal,
          split_matches_contract: summary.splitMatches,
          next_reminder_date: summary.nextReminder,
          status: summary.outstandingTotal > 0 ? "Outstanding" : "Paid",
        }),
      });
      setPaymentDraft((draft) => ({ ...emptyPaymentDraft, payment_type: draft.payment_type, estimate_id: draft.estimate_id, customer_id: draft.customer_id, customer_name: draft.customer_name }));
      await loadPortal();
      setMessage("Accounts payment saved.");
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
    await updatePaymentRecord(id, { status, paid_date: status === "Paid" ? new Date().toISOString().slice(0, 10) : "" }, `Payment marked ${status}.`);
  }

  async function updatePaymentRecord(id: string, payload: Record<string, unknown>, successMessage = "Payment updated.") {
    setLoading(true);
    try {
      await apiFetch(`/api/portal/payments/${encodeURIComponent(id)}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(payload),
      });
      await loadPortal();
      setMessage(successMessage);
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
    const engineerId = String(member.org_id || member.id || "").trim();
    setBreakdownEngineerTaskDrafts((draft) => {
      const next = { ...draft };
      next[engineerName] = nextTask;
      if (draftKey) next[draftKey] = nextTask;
      return next;
    });
    setLoading(true);
    try {
      await apiFetch("/api/portal/breakdown-engineer-task", {
        method: "PATCH",
        token,
        body: JSON.stringify({
          engineer_id: engineerId,
          engineer: engineerName,
          current_job: nextTask,
        }),
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
          customer_id: fieldText(job, ["customer_id"]),
          unit: fieldText(job, ["unit", "site", "id"]),
          motor_serial_number: fieldText(job, ["motor_serial_number", "motor_serial"]),
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

  async function uploadMotorNameplate(id: string) {
    if (Platform.OS !== "web" || typeof document === "undefined") {
      setMessage("Motor nameplate upload is available in the web portal.");
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        setLoading(true);
        try {
          await apiFetch(`/api/portal/commissioning/${encodeURIComponent(id)}/motor-nameplate`, {
            method: "POST",
            token,
            body: JSON.stringify({
              filename: file.name,
              content_type: file.type || "application/octet-stream",
              data_url: String(reader.result || ""),
            }),
          });
          await loadPortal();
          setMessage("Motor nameplate uploaded and tied to the CRM customer commissioning record.");
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Motor nameplate could not be uploaded.");
        } finally {
          setLoading(false);
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
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
    if (!token || activeTab !== "projects") return;
    const interval = setInterval(() => setProjectNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, [token, activeTab]);

  useEffect(() => {
    setCustomerPage(1);
    setEnquiryPage(1);
    setOfferPage(1);
  }, [crmSearch, crmStageFilter, crmStaffFilter, crmDepartmentFilter, crmTeamFilter, data?.customers?.length]);

  useEffect(() => {
    setInternationalVendorPage(1);
  }, [internationalVendorSearch, internationalVendorFilter, data?.international_vendors?.length]);

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
          <Text style={styles.cardLabel}>Quick username select</Text>
          <Text style={styles.muted}>Click a username, then enter the staff portal password from the private secrets folder.</Text>
          <View style={styles.quickLoginGrid}>
            {quickLoginAccounts.map((account) => (
              <Pressable
                key={account.username}
                style={styles.quickLoginButton}
                onPress={() => {
                  setUsername(account.username);
                  setPassword("");
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
  departmentBoard: { gap: 12, paddingVertical: 4, paddingRight: 12 },
  departmentColumn: { width: 340, minHeight: 420, borderRadius: 8, borderWidth: 1, borderColor: "#dfe4ed", backgroundColor: "#f8fafc", padding: 10, gap: 10 },
  projectCustomerCard: { borderRadius: 8, borderWidth: 1, borderColor: "#e4e7ee", backgroundColor: "#fff", padding: 12, gap: 7 },
  historyPanel: { borderTopWidth: 1, borderTopColor: "#e4e7ee", paddingTop: 8, marginTop: 6, gap: 3 },
  slaOnTrack: { color: "#0f766e", backgroundColor: "#ecfdf5", borderColor: "rgba(15,118,110,0.2)" },
  slaWarning: { color: "#925f00", backgroundColor: "#fff8e5", borderColor: "rgba(146,95,0,0.24)" },
  slaOverdue: { color: "#7a2630", backgroundColor: "#fff1f2", borderColor: "rgba(122,38,48,0.25)" },
  analyticsPanel: { backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#e4e7ee", padding: 14, gap: 12, marginBottom: 10 },
  analyticsRow: { gap: 7 },
  analyticsRowHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  analyticsBarTrack: { height: 10, borderRadius: 999, backgroundColor: "#eef1f5", overflow: "hidden" },
  analyticsBarFill: { height: "100%", borderRadius: 999, backgroundColor: "#e02020" },
  linkedSystemsPanel: { borderWidth: 1, borderColor: "#e4e7ee", borderRadius: 8, backgroundColor: "#f8fafc", padding: 10, marginTop: 8, gap: 4 },
  assignedTeamPanel: { borderWidth: 1, borderColor: "#e4e7ee", borderRadius: 8, backgroundColor: "#f8fafc", padding: 12, gap: 10, marginTop: 12 },
  assignmentRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap", borderTopWidth: 1, borderTopColor: "#e4e7ee", paddingTop: 10 },
  assignmentAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#11131b", alignItems: "center", justifyContent: "center" },
  assignmentAvatarImage: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#e4e7ee" },
  assignmentAvatarText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  assignmentDetails: { flex: 1, minWidth: 190 },
  assignmentName: { color: "#11131b", fontSize: 14, fontWeight: "900" },
  assignmentPicker: { borderTopWidth: 1, borderTopColor: "#e4e7ee", paddingTop: 10, gap: 4 },
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
