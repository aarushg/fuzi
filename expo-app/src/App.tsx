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
  | "fleet"
  | "tickets"
  | "projects"
  | "installations"
  | "team"
  | "accounts"
  | "messages"
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
  | "comms";

type ModuleConfig = {
  route: string;
  titleLabel: string;
  titleKey: string;
  customerKey?: string;
  notesKey?: string;
};

const navItems: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: "overview", label: "Overview", icon: "⌂" },
  { key: "modules", label: "Platform Modules", icon: "▦" },
  { key: "customers", label: "Customers", icon: "◉" },
  { key: "fleet", label: "Fleet Monitor", icon: "◆" },
  { key: "tickets", label: "Project Tickets", icon: "✓" },
  { key: "projects", label: "Projects", icon: "◇" },
  { key: "installations", label: "Installations", icon: "⇧" },
  { key: "team", label: "Install Team", icon: "☷" },
  { key: "accounts", label: "Team Accounts", icon: "◌" },
  { key: "messages", label: "Service Agent", icon: "✉" },
  { key: "renewals", label: "Renewals", icon: "↻" },
  { key: "workorders", label: "Work Orders", icon: "▤" },
  { key: "inventory", label: "Inventory", icon: "▣" },
  { key: "orgchart", label: "Staff & Attendance", icon: "◍" },
  { key: "installation_dept", label: "Installation Dept", icon: "⚙" },
  { key: "breakdown", label: "Breakdown Portal", icon: "⚡" },
  { key: "service", label: "Service", icon: "✚" },
  { key: "gad", label: "GAD Drawings", icon: "⌖" },
  { key: "finance", label: "Accounts", icon: "₹" },
  { key: "commissioning", label: "Commissioning", icon: "◎" },
  { key: "backoffice", label: "Back Office", icon: "◫" },
  { key: "tender", label: "Tender", icon: "◈" },
  { key: "factory", label: "Factory", icon: "▧" },
  { key: "comms", label: "Dept Comms", icon: "☰" },
];

const quickLoginAccounts = [
  { label: "Admin", username: "admin", password: "fuzi2026" },
  { label: "CEO", username: "atul.singhal", password: "ChangeMe123!" },
  { label: "Installation Head", username: "ashwani.kumar", password: "ChangeMe123!" },
  { label: "Breakdown Head", username: "bhanwar.choudhary", password: "ChangeMe123!" },
  { label: "Service Head", username: "jitendra.choudhary", password: "ChangeMe123!" },
  { label: "GAD Head", username: "diyanshu.bansal", password: "ChangeMe123!" },
  { label: "Accounts Head", username: "sandeep.sharma", password: "ChangeMe123!" },
  { label: "Commissioning Head", username: "vishram.kumawat", password: "ChangeMe123!" },
  { label: "Tender Head", username: "bharat.singh.choudhary", password: "ChangeMe123!" },
  { label: "Factory Head", username: "roopchand.gurjar", password: "ChangeMe123!" },
  { label: "Back Office Head", username: "jitendra.singh.hada", password: "ChangeMe123!" },
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
  comms: { route: "/api/portal/comms", titleLabel: "Subject", titleKey: "subject", customerKey: "department", notesKey: "message" },
};

const emptyModuleDraft = { title: "", customer: "", customer_id: "", status: "Open", notes: "" };
const emptyServiceDraft = {
  customer: "",
  phone: "",
  channel: "Phone",
  priority: "Normal",
  assigned_to: "",
  text: "",
  next_action: "",
};
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
  notes: "",
};
const emptyOfferDraft = {
  job_no: "",
  offer_date: new Date().toISOString().slice(0, 10),
  customer_name: "",
  offer_name: "",
  offer_type: "Individual",
  lead_status: "Costing Pending",
  total_cost: "",
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
  { key: "floor_height_profile", label: "Floor / FF height / lintel height", multiline: true },
  { key: "site_offer_type", label: "Offer to be given" },
  { key: "site_motor_required", label: "Motor required" },
  { key: "site_finish_required", label: "Finish required" },
  { key: "site_door_required", label: "Door required" },
  { key: "site_number_of_openings", label: "Number of openings" },
  { key: "site_stops", label: "Stops", keyboard: "numeric" },
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
];

function formatMoney(value?: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);
}

export default function App() {
  const { width } = useWindowDimensions();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("fuzi2026");
  const [token, setToken] = useState("");
  const [data, setData] = useState<PortalData | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [showPortalLogin, setShowPortalLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [customerDraft, setCustomerDraft] = useState<Partial<Customer>>(emptyCustomer);
  const [siteVisitDraft, setSiteVisitDraft] = useState<Partial<SiteVisit>>(emptySiteVisit);
  const [siteVisitEditorOpen, setSiteVisitEditorOpen] = useState(false);
  const [moduleDraft, setModuleDraft] = useState(emptyModuleDraft);
  const [serviceDraft, setServiceDraft] = useState(emptyServiceDraft);
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
  const [inventoryEdits, setInventoryEdits] = useState<Record<string, { reorder_point: string; target_stock: string }>>({});
  const [salesInquiryDraft, setSalesInquiryDraft] = useState(emptySalesInquiryDraft);
  const [offerDraft, setOfferDraft] = useState(emptyOfferDraft);
  const [costingEditorOpen, setCostingEditorOpen] = useState(false);
  const [breakdownCustomerDropdownOpen, setBreakdownCustomerDropdownOpen] = useState(false);
  const [breakdownCustomerSearch, setBreakdownCustomerSearch] = useState("");

  const isSignedIn = Boolean(token);
  const isWide = width >= 920;
  const asRecords = (value: unknown): Array<Record<string, unknown>> => (Array.isArray(value) ? (value as Array<Record<string, unknown>>) : []);
  const visibleNavItems = useMemo(() => {
    const allowed = data?.access?.allowed_views;
    if (!allowed?.length) return navItems;
    const allowedSet = new Set(allowed);
    return navItems.filter((item) => allowedSet.has(item.key));
  }, [data?.access]);
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
    const team = asRecords(data?.install_team).map((member) => ({
      id: String(member.id || member.name || ""),
      name: String(member.name || ""),
      role: String(member.role || "Technician"),
      phone: String(member.phone || ""),
      availability: String(member.availability || ""),
    }));
    const technicians = asRecords(data?.users)
      .filter((user) => String(user.role || "").toLowerCase().includes("technician"))
      .map((user) => ({
        id: String(user.id || user.username || ""),
        name: String(user.display_name || user.username || ""),
        role: String(user.department || "Technician"),
        phone: "",
        availability: String(user.active === false ? "Inactive" : "Available"),
      }));
    const seen = new Set<string>();
    return [...team, ...technicians].filter((member) => {
      const key = member.name.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [data]);

  function fieldText(record: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
      const value = record[key];
      if (value !== undefined && value !== null && String(value).trim()) {
        return String(value);
      }
    }
    return "-";
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


  function renderRecordCards(records: Array<Record<string, unknown>>, titleKeys: string[], detailKeys: string[][], config?: ModuleConfig) {
    if (!records.length) {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>No records found</Text>
          <Text style={styles.muted}>Use the form on this page to add the first record, or refresh after another department updates this module.</Text>
        </View>
      );
    }
    return records.slice(0, 30).map((record, index) => (
      <View key={String(record.id || record.name || index)} style={styles.card}>
        <Text style={styles.cardTitle}>{fieldText(record, titleKeys)}</Text>
        {detailKeys.map((keys) => (
          <Text key={keys.join("-")} style={styles.bodyText}>{fieldText(record, keys)}</Text>
        ))}
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
    ));
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

  function renderModuleForm(config: ModuleConfig) {
    const needsCustomer = config.route === "/api/portal/install-jobs";
    return (
      <View style={styles.formCard}>
        <Text style={styles.cardLabel}>Add / update module data</Text>
        {needsCustomer && (
          <View style={styles.field}>
            <Text style={styles.label}>Select customer</Text>
            {!data?.customers.length && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Add a customer first</Text>
                <Text style={styles.muted}>Installation jobs must be linked to a saved customer ID before they can be created.</Text>
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
                    style={[styles.selectorPill, moduleDraft.customer_id === customer.id && styles.selectorPillActive]}
                    onPress={() => setModuleDraft((draft) => ({ ...draft, customer_id: customer.id, customer: customer.name }))}
                  >
                    <Text style={[styles.selectorText, moduleDraft.customer_id === customer.id && styles.selectorTextActive]}>
                      {customer.id} - {customer.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
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
            <Text style={styles.label}>{config.customerKey === "department" ? "Department" : "Customer / owner"}</Text>
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

  function renderServiceAgentPage() {
    const messages = asRecords((data as Record<string, unknown> | null)?.messages);
    const openMessages = messages.filter((item) => !["closed", "resolved", "done"].includes(String(item.status || item.state || "").toLowerCase()));
    const urgentMessages = messages.filter((item) => ["urgent", "high", "critical"].includes(String(item.priority || item.severity || "").toLowerCase()));
    return (
      <View>
        <View style={styles.moduleHero}>
          <Text style={styles.eyebrow}>Service Agent</Text>
          <Text style={styles.moduleHeroTitle}>Customer Service Inbox</Text>
          <Text style={styles.moduleHeroText}>Capture WhatsApp, phone, email, and web-chat requests, triage priority, assign ownership, and convert real issues into work orders.</Text>
        </View>

        <View style={styles.metricGrid}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Open inbox</Text>
            <Text style={styles.metricValue}>{openMessages.length}</Text>
            <Text style={styles.muted}>Messages waiting for follow-up or dispatch.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>High priority</Text>
            <Text style={styles.metricValue}>{urgentMessages.length}</Text>
            <Text style={styles.muted}>Urgent customer requests and escalations.</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.cardLabel}>New service intake</Text>
          <View style={styles.formGrid}>
            {[
              ["customer", "Customer / building"],
              ["phone", "Mobile phone"],
              ["channel", "Channel"],
              ["priority", "Priority"],
              ["assigned_to", "Assigned to"],
              ["next_action", "Next action"],
            ].map(([key, label]) => (
              <View key={key} style={styles.field}>
                <Text style={styles.label}>{label}</Text>
                <TextInput
                  style={styles.input}
                  value={String(serviceDraft[key as keyof typeof serviceDraft] || "")}
                  onChangeText={(value) => setServiceDraft((draft) => ({ ...draft, [key]: value }))}
                />
              </View>
            ))}
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Customer message</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={serviceDraft.text}
              onChangeText={(value) => setServiceDraft((draft) => ({ ...draft, text: value }))}
              multiline
            />
          </View>
          <Pressable style={styles.primaryButton} onPress={saveServiceMessage} disabled={loading}>
            <Text style={styles.primaryButtonText}>Save service message</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Inbox & Triage</Text>
        {!messages.length && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Inbox is clear</Text>
            <Text style={styles.muted}>New customer calls, WhatsApp notes, web-chat requests, and email follow-ups will appear here.</Text>
          </View>
        )}
        {messages.slice(0, 40).map((item, index) => {
          const id = recordIdentity(item) || String(item.id || `MSG-LEGACY-${index + 1}`);
          return (
            <View key={id} style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>{fieldText(item, ["customer", "from", "channel"])}</Text>
                <Text style={styles.statusPill}>{fieldText(item, ["priority", "severity"])}</Text>
              </View>
              <Text style={styles.muted}>{fieldText(item, ["channel"])} - {fieldText(item, ["status", "state"])}</Text>
              <Text style={styles.bodyText}>{fieldText(item, ["text", "message", "body", "summary"])}</Text>
              <Text style={styles.bodyText}>Owner: {fieldText(item, ["assigned_to", "owner"])} - Next: {fieldText(item, ["next_action", "action"])}</Text>
              {!!item.work_order_id && <Text style={styles.bodyText}>Work order: {String(item.work_order_id)}</Text>}
              <View style={styles.inlineActions}>
                <Pressable style={styles.smallButton} onPress={() => updateServiceMessage(id, "Contacted")} disabled={loading}>
                  <Text style={styles.smallButtonText}>Contacted</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => createServiceWorkOrder(id)} disabled={loading}>
                  <Text style={styles.smallButtonText}>Create work order</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => updateServiceMessage(id, "Closed")} disabled={loading}>
                  <Text style={styles.smallButtonText}>Close</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
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
    return (
      <View>
        <View style={styles.moduleHero}>
          <Text style={styles.eyebrow}>Breakdown Portal</Text>
          <Text style={styles.moduleHeroTitle}>Emergency Breakdown Control</Text>
          <Text style={styles.moduleHeroText}>Log trapped-passenger calls, assign an engineer, track dispatch, and close breakdowns from the mobile/web portal.</Text>
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
            <Text style={styles.label}>Assign staff</Text>
            <View style={styles.selectorList}>
              {assignableStaff.map((member) => (
                <Pressable
                  key={member.id}
                  style={[styles.selectorPill, breakdownDraft.engineer === member.name && styles.selectorPillActive]}
                  onPress={() => setBreakdownDraft((draft) => ({ ...draft, engineer: member.name }))}
                >
                  <Text style={[styles.selectorText, breakdownDraft.engineer === member.name && styles.selectorTextActive]}>
                    {member.name} - {member.role}{member.availability ? ` - ${member.availability}` : ""}
                  </Text>
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
              <Text style={styles.bodyText}>Trapped passenger: {fieldText(item, ["trapped_passenger", "passenger_trapped"])}</Text>
              <Text style={styles.label}>Assign staff</Text>
              <View style={styles.inlineActions}>
                {assignableStaff.slice(0, 6).map((member) => (
                  <Pressable key={`${id}-${member.id}`} style={styles.smallButton} onPress={() => updateBreakdown(id, "Assigned", member.name)} disabled={loading}>
                    <Text style={styles.smallButtonText}>{member.name}</Text>
                  </Pressable>
                ))}
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
                  {["present", "absent", "half-day", "leave"].map((statusOption) => (
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

        <View style={styles.formGrid}>
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
        </View>

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

  function openCostingForCustomer(customer: Customer) {
    setOfferDraft({
      ...emptyOfferDraft,
      customer_id: customer.id,
      customer_name: customer.name,
      offer_name: customer.name,
      offer_type: customer.segment || "Passenger",
      lead_status: "Costing Pending",
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
      lead_status: "Costing Pending",
      createdbyname: data?.viewer?.display_name || username,
      customer_id: String(record.customer_id || ""),
      source_inquiry_id: recordIdentity(record) || String(record.enquiry_no || ""),
      notes: String(record.enquiry_remark || record.requirement || ""),
    });
    setCostingEditorOpen(true);
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
            <Text style={styles.muted}>{offers.length} costing estimates tied into CRM.</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.cardLabel}>{customerDraft.id ? "Edit customer account" : "New account / lead"}</Text>
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
          <Pressable style={styles.primaryButton} onPress={saveCustomer} disabled={loading}>
            <Text style={styles.primaryButtonText}>{customerDraft.id ? "Update customer" : "Save customer"}</Text>
          </Pressable>
          {!!customerDraft.id && (
            <Pressable
              style={styles.secondaryButton}
              onPress={() => {
                setCustomerDraft(emptyCustomer);
                setSiteVisitEditorOpen(false);
              }}
              disabled={loading}
            >
              <Text style={styles.secondaryButtonText}>Cancel edit</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.formCard}>
          <Text style={styles.cardLabel}>Sales enquiry intake</Text>
          <Text style={styles.muted}>New enquiries are captured in CRM using the same fields as the enquiry report.</Text>
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
            <Pressable style={styles.secondaryButton} onPress={() => setSalesInquiryDraft(emptySalesInquiryDraft)} disabled={loading}>
              <Text style={styles.secondaryButtonText}>Cancel enquiry edit</Text>
            </Pressable>
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
                <Text style={styles.bodyText}>Costing estimates: {customerEstimates.length}{latestEstimate ? ` - Latest ${String(latestEstimate.job_no || latestEstimate.id || "-")} - ${String(latestEstimate.offer_date || latestEstimate.created_at || "-")} - ${formatMoney(Number(latestEstimate.total_cost || 0))}` : ""}</Text>
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
                    <Text style={styles.smallButtonText}>New costing</Text>
                  </Pressable>
                  <Pressable
                    style={styles.smallButton}
                    onPress={() => openSiteVisitForCustomer(customer)}
                    disabled={loading}
                  >
                    <Text style={styles.smallButtonText}>{existingSiteVisit ? "Edit site visit" : "Start site visit"}</Text>
                  </Pressable>
                  <Pressable style={styles.dangerButton} onPress={() => deleteCustomer(customer)} disabled={loading}>
                    <Text style={styles.dangerButtonText}>Remove</Text>
                  </Pressable>
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
                <Text style={[styles.statusPill, { color: salesInquiryStatusTone(costingStatus === "No costing" ? status : costingStatus) }]}>{costingStatus}</Text>
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
                  <Text style={styles.bodyText}>Costing: {latestEstimate ? `${String(latestEstimate.job_no || latestEstimate.id || "-")} - ${String(latestEstimate.offer_type || latestEstimate.elevator_type || "-")} - ${String(latestEstimate.offer_date || latestEstimate.created_at || "-")} - ${formatMoney(Number(latestEstimate.total_cost || 0))}` : "No costing estimate yet"}</Text>
                  {!!(item.requirement || item.enquiry_remark || item.notes) && <Text style={styles.muted}>{String(item.requirement || item.enquiry_remark || item.notes)}</Text>}
                  <View style={styles.inlineActions}>
                    <Pressable style={styles.smallButton} onPress={() => editSalesInquiry(item)} disabled={loading}>
                      <Text style={styles.smallButtonText}>Edit</Text>
                    </Pressable>
                    <Pressable style={styles.smallButton} onPress={() => markFollowedUp(item)} disabled={loading}>
                      <Text style={styles.smallButtonText}>Followed up</Text>
                    </Pressable>
                    {[3, 7, 14, 30].map((days) => (
                      <Pressable key={`${id}-followup-${days}`} style={styles.smallButton} onPress={() => scheduleFollowUp(item, days)} disabled={loading}>
                        <Text style={styles.smallButtonText}>+{days}d</Text>
                      </Pressable>
                    ))}
                    <Pressable style={styles.smallButton} onPress={() => openSiteVisitForInquiry(item)} disabled={loading}>
                      <Text style={styles.smallButtonText}>{existingSiteVisit ? "Edit site visit" : "Site Visit"}</Text>
                    </Pressable>
                    <Pressable style={styles.smallButton} onPress={() => openCostingForInquiry(item)} disabled={loading}>
                      <Text style={styles.smallButtonText}>New costing</Text>
                    </Pressable>
                    <Pressable
                      style={styles.smallButton}
                      onPress={() => openSiteVisitForInquiry(item)}
                      disabled={loading}
                    >
                      <Text style={styles.smallButtonText}>{existingSiteVisit ? "Edit site visit" : "Start site visit"}</Text>
                    </Pressable>
                    <Pressable style={styles.smallButton} onPress={() => updateSalesInquiry(item, { lead_status: "Lost", status: "Lost" })} disabled={loading}>
                      <Text style={styles.smallButtonText}>Lost</Text>
                    </Pressable>
                    <Pressable style={styles.dangerButton} onPress={() => deleteSalesInquiry(item)} disabled={loading}>
                      <Text style={styles.dangerButtonText}>Remove</Text>
                    </Pressable>
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
                  <Text style={styles.cardLabel}>New customer costing</Text>
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
                    <Text style={styles.label}>Costing / job no</Text>
                    <TextInput style={styles.input} value={offerDraft.job_no} onChangeText={(value) => setOfferDraft((draft) => ({ ...draft, job_no: value }))} placeholder="Auto if blank" />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>Costing date</Text>
                    <TextInput style={styles.input} value={offerDraft.offer_date} onChangeText={(value) => setOfferDraft((draft) => ({ ...draft, offer_date: value }))} placeholder="YYYY-MM-DD" />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>Customer name</Text>
                    <TextInput style={styles.input} value={offerDraft.customer_name} onChangeText={(value) => setOfferDraft((draft) => ({ ...draft, customer_name: value, offer_name: value }))} />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>Lift / costing type</Text>
                    <TextInput style={styles.input} value={offerDraft.offer_type} onChangeText={(value) => setOfferDraft((draft) => ({ ...draft, offer_type: value }))} />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>Costing status</Text>
                    <TextInput style={styles.input} value={offerDraft.lead_status} onChangeText={(value) => setOfferDraft((draft) => ({ ...draft, lead_status: value }))} />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>Estimated value</Text>
                    <TextInput style={styles.input} value={offerDraft.total_cost} onChangeText={(value) => setOfferDraft((draft) => ({ ...draft, total_cost: value }))} keyboardType="numeric" />
                  </View>
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Costing notes</Text>
                  <TextInput style={[styles.input, styles.textarea]} value={offerDraft.notes} onChangeText={(value) => setOfferDraft((draft) => ({ ...draft, notes: value }))} multiline />
                </View>
              </ScrollView>
              <View style={styles.modalActions}>
                <Pressable style={styles.secondaryButton} onPress={() => setCostingEditorOpen(false)} disabled={loading}>
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.primaryButtonInline} onPress={saveOffer} disabled={loading || !offerDraft.customer_name.trim()}>
                  <Text style={styles.primaryButtonText}>Save costing</Text>
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
                        onChangeText={(value) => setSiteVisitDraft((draft) => ({ ...draft, [field.key]: value }))}
                        keyboardType={field.keyboard || "default"}
                        multiline={field.multiline}
                      />
                    </View>
                  ))}
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
        {(data?.site_visits || []).map((visit) => (
          <View key={visit.id} style={styles.card}>
            <Text style={styles.cardTitle}>{visit.id} - {visit.customer_name || visit.customer_id}</Text>
            <Text style={styles.muted}>{visit.customer_id} - {visit.address || "No address"}</Text>
            <Text style={styles.bodyText}>Site: {visit.site_person_name || "Not set"} - {visit.site_person_mobile || "No mobile"}</Text>
            <Text style={styles.bodyText}>Pit {visit.pit_size_mm || "-"} mm - Machine room {visit.machine_room_available || "N"}</Text>
            <Text style={styles.bodyText}>Offer {visit.site_offer_type || "-"} - Stops {visit.site_stops || "-"}</Text>
          </View>
        ))}
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
                    password: "ChangeMe123!",
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
            <Text style={styles.muted}>{fieldText(user, ["username"])} - {fieldText(user, ["department"])} - {fieldText(user, ["role"])}</Text>
            <Text style={styles.bodyText}>Linked org node: {fieldText(user, ["linked_org_node", "linked_team_member"])}</Text>
            <Text style={styles.bodyText}>Password change required: {String(user.must_change_password || false)}</Text>
            {isAdmin && (
              <View style={styles.inlineActions}>
                <Pressable style={styles.smallButton} onPress={() => editAccount(user)} disabled={loading}>
                  <Text style={styles.smallButtonText}>Edit</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => updateAccount(String(user.id), { password: "ChangeMe123!" })} disabled={loading}>
                  <Text style={styles.smallButtonText}>Reset password</Text>
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

  function renderInventoryPage() {
    const inventory = asRecords(data?.inventory);
    const reorderItems = inventory.filter((item) => inventoryAvailable(item) <= inventoryQuantity(item, "reorder_point", inventoryQuantity(item, "min_stock")));
    const onOrderItems = inventory.filter((item) => inventoryDisplayStatus(item) === "On Order");
    const totalAvailable = inventory.reduce((sum, item) => sum + inventoryAvailable(item), 0);
    return (
      <View>
        <View style={styles.moduleHero}>
          <Text style={styles.eyebrow}>Warehouse Inventory</Text>
          <Text style={styles.moduleHeroTitle}>Stock Control & Reorder Triggers</Text>
          <Text style={styles.moduleHeroText}>Manage warehouse parts, reserved stock, bin locations, vendor details, and reorder points that trigger purchase orders before stock runs out.</Text>
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
        </View>

        <View style={styles.formCard}>
          <Text style={styles.cardLabel}>Add warehouse item</Text>
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
          <View style={styles.field}>
            <Text style={styles.label}>Notes</Text>
            <TextInput style={[styles.input, styles.textarea]} value={inventoryDraft.notes} onChangeText={(value) => setInventoryDraft((draft) => ({ ...draft, notes: value }))} multiline />
          </View>
          <Pressable style={styles.primaryButton} onPress={saveInventoryItem} disabled={loading || !inventoryDraft.name.trim()}>
            <Text style={styles.primaryButtonText}>Save warehouse item</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Reorder Watchlist</Text>
        {!reorderItems.length && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>All reorder triggers are clear</Text>
            <Text style={styles.muted}>Available stock is above every configured reorder point.</Text>
          </View>
        )}
        {reorderItems.slice(0, 12).map((item, index) => renderInventoryCard(item, index, true))}

        <Text style={styles.sectionTitle}>Warehouse Stock</Text>
        {inventory.slice(0, 80).map((item, index) => renderInventoryCard(item, index, false))}
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
      case "fleet":
        return renderFeaturePage("Fleet Monitor", "Live unit health, fault/watch status, and FSM signals.", asRecords(data?.fleet), ["unit", "id", "name"], [["status", "state"], ["location", "site"], ["ticket", "notes"]]);
      case "tickets":
        return renderFeaturePage("Project Tickets", "Project-office tickets and SLA risk tracking.", asRecords(data?.project_tickets), ["title", "id"], [["project"], ["status"], ["owner"]]);
      case "projects":
        return renderFeaturePage("Projects", "Installation project progress and stage status.", asRecords(data?.install_jobs), ["job_id", "id"], [["customer"], ["site"], ["status"]]);
      case "installations":
        return renderFeaturePage("Installations", "Field installation jobs, active stages, and target handover data.", asRecords(data?.install_jobs), ["job_id", "id"], [["customer"], ["current_stage", "stage"], ["target_handover"]]);
      case "team":
        return renderInstallTeamPage();
      case "accounts":
        return renderAccountsPage();
      case "messages":
        return renderServiceAgentPage();
      case "renewals":
        return renderRenewalsPage();
      case "workorders":
        return renderFeaturePage("Work Orders", "Site walkthrough and work order queue.", asRecords(data?.work_orders), ["title", "id"], [["customer"], ["status"], ["assigned_to", "owner"]]);
      case "inventory":
        return renderInventoryPage();
      case "orgchart":
        return renderStaffManagementPage();
      case "sales":
        return renderCustomerCrmPage();
      case "installation_dept":
        return renderFeaturePage("Installation Dept", "Department view for active installation execution.", asRecords(data?.install_jobs), ["job_id", "id"], [["customer"], ["site"], ["status"]]);
      case "breakdown":
        return renderBreakdownPage();
      case "service":
        return renderFeaturePage("Service", "Service records, technician updates, and customer comments.", asRecords((data as Record<string, unknown> | null)?.service_records), ["job_number", "id"], [["customer"], ["status"], ["technician"]]);
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

  async function saveCustomer() {
    if (!customerDraft.name?.trim()) {
      const text = "Customer name is required.";
      Platform.OS === "web" ? setMessage(text) : Alert.alert("Missing field", text);
      return;
    }
    setLoading(true);
    try {
      const id = String(customerDraft.id || "");
      await apiFetch(id ? `/api/portal/customers/${encodeURIComponent(id)}` : "/api/portal/customers", {
        method: id ? "PATCH" : "POST",
        token,
        body: JSON.stringify(customerDraft),
      });
      setCustomerDraft(emptyCustomer);
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
    setLoading(true);
    try {
      const siteVisitId = String(siteVisitDraft.id || "");
      await apiFetch(siteVisitId ? `/api/portal/site-visits/${encodeURIComponent(siteVisitId)}` : "/api/portal/site-visits", {
        method: siteVisitId ? "PATCH" : "POST",
        token,
        body: JSON.stringify(siteVisitDraft),
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

  async function saveSalesInquiry() {
    if (!salesInquiryDraft.customer.trim()) {
      const text = "Lead/customer name is required.";
      Platform.OS === "web" ? setMessage(text) : Alert.alert("Missing field", text);
      return;
    }
    setLoading(true);
    try {
      const id = salesInquiryDraft.id || "";
      await apiFetch(id ? `/api/portal/sales/inquiries/${encodeURIComponent(id)}` : "/api/portal/sales/inquiries", {
        method: id ? "PATCH" : "POST",
        token,
        body: JSON.stringify(salesInquiryDraft),
      });
      setSalesInquiryDraft(emptySalesInquiryDraft);
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
      notes: String(record.notes || ""),
    });
    setSiteVisitDraft((draft) => ({ ...draft, customer_id: customerId, site_enquiry_no: enquiryNo || draft.site_enquiry_no }));
    setSiteVisitEditorOpen(false);
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
    setMessage(`Costing draft prepared for ${customerName}. Complete the costing form and save.`);
  }

  async function saveOffer() {
    if (!offerDraft.customer_name.trim()) {
      const text = "Customer name is required for costing.";
      Platform.OS === "web" ? setMessage(text) : Alert.alert("Missing field", text);
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...offerDraft,
        offer_name: offerDraft.offer_name || offerDraft.customer_name,
        status: offerDraft.lead_status || "Costing Pending",
        total_cost: Number(offerDraft.total_cost || 0),
        source: "CRM costing",
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
      setMessage("Costing saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Costing could not be saved.");
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
      setMessage("Costing updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Costing could not be updated.");
    } finally {
      setLoading(false);
    }
  }

  async function saveServiceMessage() {
    if (!serviceDraft.text.trim()) {
      const text = "Customer message is required.";
      Platform.OS === "web" ? setMessage(text) : Alert.alert("Missing field", text);
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/api/portal/service-agent/messages", {
        method: "POST",
        token,
        body: JSON.stringify(serviceDraft),
      });
      setServiceDraft(emptyServiceDraft);
      await loadPortal();
      setMessage("Service message saved to the inbox.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Service message could not be saved.");
    } finally {
      setLoading(false);
    }
  }

  async function updateServiceMessage(id: string, status: string) {
    setLoading(true);
    try {
      await apiFetch(`/api/portal/service-agent/messages/${encodeURIComponent(id)}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status, state: status }),
      });
      await loadPortal();
      setMessage(`Service message marked ${status}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Service message could not be updated.");
    } finally {
      setLoading(false);
    }
  }

  async function createServiceWorkOrder(id: string) {
    setLoading(true);
    try {
      await apiFetch(`/api/portal/service-agent/messages/${encodeURIComponent(id)}/work-order`, {
        method: "POST",
        token,
        body: JSON.stringify({}),
      });
      await loadPortal();
      setMessage("Work order created from service message.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Work order could not be created.");
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
          body: JSON.stringify({ ...payload, password: accountDraft.password || "ChangeMe123!" }),
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
        body: JSON.stringify({ ...breakdownDraft, assigned_to: breakdownDraft.engineer, status: "Open" }),
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
        body: JSON.stringify({ status, ...(staffName ? { engineer: staffName, assigned_to: staffName } : {}) }),
      });
      await loadPortal();
      setMessage(staffName ? `Breakdown assigned to ${staffName}.` : `Breakdown marked ${status}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Breakdown could not be updated.");
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
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={styles.mobileNavRail}>
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
                <Text style={styles.quickLoginSub}>{account.username}</Text>
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
        {activeTab === "overview" && (
          <View>
            <View style={styles.commandBand}>
              <View style={styles.commandCopy}>
                <Text style={styles.eyebrow}>24/7 agentic operations layer</Text>
                <Text style={styles.commandTitle}>Coordinate service, sales, site visits, and estimates from one dashboard.</Text>
                <Text style={styles.commandText}>Built for daily use across service, sales, installation, accounts, and back-office teams.</Text>
              </View>
            </View>
            <Text style={styles.sectionTitle}>Live Operations</Text>
            <View style={styles.metricGrid}>
              {(data?.metrics || []).map((metric) => (
                <View key={metric.label} style={styles.card}>
                  <Text style={styles.cardLabel}>{metric.label}</Text>
                  <Text style={styles.metricValue}>{metric.value}</Text>
                  <Text style={styles.muted}>{metric.delta}</Text>
                </View>
              ))}
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Stock watch</Text>
              <Text style={styles.metricValue}>{lowStock.length}</Text>
              <Text style={styles.muted}>Items at or below reorder threshold.</Text>
            </View>
            <Pressable style={styles.portalShortcut} onPress={() => setActiveTab("breakdown")}>
              <Text style={styles.cardLabel}>Emergency access</Text>
              <Text style={styles.cardTitle}>Open Breakdown Portal</Text>
              <Text style={styles.muted}>Log a call, mark trapped-passenger priority, dispatch an engineer, and close the case.</Text>
            </Pressable>
          </View>
        )}

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
  mobileNavRail: { gap: 8, padding: 12 },
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
  alertCard: { borderColor: "rgba(224,32,32,0.4)", backgroundColor: "#fffafa" },
  portalShortcut: { backgroundColor: "#fff", borderRadius: 8, borderWidth: 2, borderColor: "#e02020", padding: 16, marginBottom: 10, gap: 6 },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" },
  cardTitleBlock: { flex: 1, minWidth: 220 },
  formCard: { backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#e4e7ee", padding: 16, gap: 11, marginBottom: 12 },
  formGrid: { gap: 10 },
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
  homeLinkButton: { minHeight: 40, borderRadius: 8, borderWidth: 1, borderColor: "#d5dae4", backgroundColor: "#fff", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  homeLinkText: { color: "#2d3240", fontWeight: "900", fontSize: 13 },
  error: { color: "#b91414", fontWeight: "800" },
  hint: { color: "#747b8d", fontSize: 12 },
});
