const searchInput = document.getElementById("globalSearch");
const statusFilter = document.getElementById("statusFilter");
const refreshBtn = document.getElementById("refreshBtn");
const syncTime = document.getElementById("syncTime");
const toast = document.getElementById("toast");
const ticketForm = document.getElementById("ticketForm");
const ticketRows = document.getElementById("ticketRows");
const installWorkspace = document.getElementById("view-installations");
const teamForm = document.getElementById("teamForm");
const teamRows = document.getElementById("teamRows");
const customerForm = document.getElementById("customerForm");
const customerRows = document.getElementById("customerRows");
const accountForm = document.getElementById("accountForm");
const accountRows = document.getElementById("accountRows");
const crmQueryForm = document.getElementById("crmQueryForm");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2800);
}

function filterRows() {
  const query = searchInput.value.trim().toLowerCase();
  const status = statusFilter.value;
  const items = document.querySelectorAll("[data-search]");

  items.forEach((item) => {
    const haystack = item.dataset.search.toLowerCase();
    const itemStatus = item.dataset.status || "";
    const matchesSearch = !query || haystack.includes(query);
    const matchesStatus = status === "all" || itemStatus.includes(status);
    item.classList.toggle("row-hidden", !(matchesSearch && matchesStatus));
  });
}

async function postAction(action, target) {
  const response = await fetch("/api/portal/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, target }),
  });
  const data = await response.json();
  const delivery = data.delivery;
  let message = data.message || "Action finished.";
  if (delivery && delivery.ok === false) {
    const detail = delivery.error ? ` ${delivery.error}` : ` OpenClaw delivery failed at ${delivery.url}.`;
    message = `${message}${detail}`;
  }
  showToast(message);
  if (response.ok && data.refresh) {
    window.setTimeout(() => window.location.reload(), 900);
  }
}

async function refreshFeed() {
  refreshBtn.disabled = true;
  refreshBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Refreshing';

  try {
    const response = await fetch("/api/portal/data");
    const data = await response.json();
    syncTime.textContent = data.synced_at;
    showToast("Portal data refreshed.");
    window.setTimeout(() => window.location.reload(), 500);
  } catch (error) {
    showToast("Refresh failed. Check the Flask server.");
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.innerHTML = '<i class="fa fa-rotate"></i> Refresh feed';
  }
}

function priorityClass(priority) {
  if (priority === "High") return "critical";
  if (priority === "Medium") return "warning";
  return "info";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function ticketSearchText(ticket) {
  return `${ticket.id} ${ticket.project} ${ticket.title} ${ticket.owner} ${ticket.status} ${ticket.priority}`;
}

function ticketRow(ticket) {
  const tr = document.createElement("tr");
  tr.dataset.ticketId = ticket.id;
  tr.dataset.search = ticketSearchText(ticket);
  tr.dataset.status = ticket.status.toLowerCase();
  const statuses = ["Open", "In Progress", "Blocked", "Closed"];
  tr.innerHTML = `
    <td><strong>${escapeHtml(ticket.id)}</strong><span>${escapeHtml(ticket.title)}</span></td>
    <td>${escapeHtml(ticket.project)}</td>
    <td>${escapeHtml(ticket.owner)}</td>
    <td><mark class="badge ${priorityClass(ticket.priority)}">${escapeHtml(ticket.priority)}</mark></td>
    <td>
      <select class="ticket-status" aria-label="Update ${escapeHtml(ticket.id)} status">
        ${statuses.map((status) => `<option value="${status}" ${ticket.status === status ? "selected" : ""}>${status}</option>`).join("")}
      </select>
    </td>
    <td>${escapeHtml(ticket.due)}</td>
    <td><button class="action-btn small ticket-save" data-ticket-id="${escapeHtml(ticket.id)}"><i class="fa fa-check"></i> Save</button></td>
  `;
  return tr;
}

function memberSearchText(member) {
  return `${member.id} ${member.name} ${member.role} ${(member.skills || []).join(" ")} ${member.availability} ${member.current_job} ${member.shift}`;
}

function teamJobOptions(selectedJob) {
  const existingOptions = document.querySelector(".team-job")?.innerHTML || '<option value="">Unassigned</option>';
  const wrapper = document.createElement("select");
  wrapper.innerHTML = existingOptions;
  [...wrapper.options].forEach((option) => {
    option.selected = option.value === selectedJob;
  });
  return wrapper.innerHTML;
}

function teamMemberRow(member) {
  const tr = document.createElement("tr");
  tr.dataset.memberId = member.id;
  tr.dataset.search = memberSearchText(member);
  tr.dataset.status = member.availability.toLowerCase();
  const availabilityOptions = ["Available", "On Site", "Off Duty", "Blocked"];
  tr.innerHTML = `
    <td><strong>${escapeHtml(member.name)}</strong><span>${escapeHtml(member.id)} · ${escapeHtml(member.phone || "")}</span></td>
    <td>${escapeHtml(member.role)}</td>
    <td><div class="skill-list">${(member.skills || []).map((skill) => `<span>${escapeHtml(skill)}</span>`).join("")}</div></td>
    <td>
      <select class="team-availability" aria-label="Availability for ${escapeHtml(member.name)}">
        ${availabilityOptions.map((availability) => `<option value="${availability}" ${member.availability === availability ? "selected" : ""}>${availability}</option>`).join("")}
      </select>
    </td>
    <td><select class="team-job" aria-label="Current job for ${escapeHtml(member.name)}">${teamJobOptions(member.current_job)}</select></td>
    <td>${escapeHtml(member.shift || "")}</td>
    <td><button class="action-btn small team-save" data-member-id="${escapeHtml(member.id)}"><i class="fa fa-check"></i> Save</button></td>
  `;
  return tr;
}

function customerSearchText(customer) {
  return `${customer.id} ${customer.name} ${customer.contact_person || ""} ${customer.phone || ""} ${customer.email || ""} ${customer.segment || ""} ${customer.status || ""} ${customer.notes || ""}`;
}

function customerRow(customer) {
  const tr = document.createElement("tr");
  tr.dataset.customerId = customer.id;
  tr.dataset.search = customerSearchText(customer);
  tr.dataset.status = String(customer.status || "").toLowerCase();
  const statuses = ["Active", "At Risk", "Renewal Due", "Paused", "Closed"];
  tr.innerHTML = `
    <td><strong>${escapeHtml(customer.name)}</strong><span>${escapeHtml(customer.id)} · ${escapeHtml(customer.address || "")}</span></td>
    <td>${escapeHtml(customer.contact_person || "")}<span>${escapeHtml(customer.phone || "")} · ${escapeHtml(customer.email || "")}</span></td>
    <td>${escapeHtml(customer.segment || "")}</td>
    <td>
      <select class="customer-status" aria-label="Update ${escapeHtml(customer.name)} status">
        ${statuses.map((status) => `<option value="${status}" ${customer.status === status ? "selected" : ""}>${status}</option>`).join("")}
      </select>
    </td>
    <td>${escapeHtml(customer.renewal_date || "Not set")}</td>
    <td><input class="customer-notes" type="text" value="${escapeHtml(customer.notes || "")}" aria-label="Notes for ${escapeHtml(customer.name)}" /></td>
    <td><button class="action-btn small customer-save" data-customer-id="${escapeHtml(customer.id)}"><i class="fa fa-check"></i> Save</button></td>
  `;
  return tr;
}

function accountSearchText(account) {
  return `${account.id} ${account.username} ${account.display_name} ${account.department || ""} ${account.role} ${account.linked_team_member || ""}`;
}

function departmentOptions(selectedDepartment) {
  const existingOptions = document.querySelector(".account-department")?.innerHTML || [
    "Executive Office",
    "Service Control",
    "Project Office",
    "Install Operations",
    "Stores & Procurement",
    "Sales & Renewals",
    "Customer Success",
  ].map((department) => `<option value="${department}">${department}</option>`).join("");
  const wrapper = document.createElement("select");
  wrapper.innerHTML = existingOptions;
  [...wrapper.options].forEach((option) => {
    option.selected = option.value === selectedDepartment;
  });
  return wrapper.innerHTML;
}

function teamMemberOptions(selectedMember) {
  const existingOptions = document.querySelector(".account-member")?.innerHTML || '<option value="">None</option>';
  const wrapper = document.createElement("select");
  wrapper.innerHTML = existingOptions;
  [...wrapper.options].forEach((option) => {
    option.selected = option.value === selectedMember;
  });
  return wrapper.innerHTML;
}

function accountRow(account) {
  const tr = document.createElement("tr");
  tr.dataset.userId = account.id;
  tr.dataset.search = accountSearchText(account);
  tr.dataset.status = account.active ? "active" : "blocked";
  const roles = ["admin", "manager", "technician"];
  tr.innerHTML = `
    <td><strong>${escapeHtml(account.display_name)}</strong><span>${escapeHtml(account.username)} · ${escapeHtml(account.id)}</span></td>
    <td>
      <select class="account-department" aria-label="Department for ${escapeHtml(account.username)}">
        ${departmentOptions(account.department || "Install Operations")}
      </select>
    </td>
    <td>
      <select class="account-role" aria-label="Role for ${escapeHtml(account.username)}">
        ${roles.map((role) => `<option value="${role}" ${account.role === role ? "selected" : ""}>${role[0].toUpperCase()}${role.slice(1)}</option>`).join("")}
      </select>
    </td>
    <td><select class="account-member" aria-label="Linked team member for ${escapeHtml(account.username)}">${teamMemberOptions(account.linked_team_member || "")}</select></td>
    <td>
      <select class="account-active" aria-label="Status for ${escapeHtml(account.username)}">
        <option value="true" ${account.active ? "selected" : ""}>Active</option>
        <option value="false" ${!account.active ? "selected" : ""}>Disabled</option>
      </select>
    </td>
    <td><input class="account-password" type="password" placeholder="New password only" aria-label="Reset password for ${escapeHtml(account.username)}" /></td>
    <td><button class="action-btn small account-save" data-user-id="${escapeHtml(account.id)}"><i class="fa fa-check"></i> Save</button></td>
  `;
  return tr;
}

async function createTicket(event) {
  event.preventDefault();
  const formData = new FormData(ticketForm);
  const payload = Object.fromEntries(formData.entries());

  const response = await fetch("/api/portal/project-tickets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();

  if (!response.ok) {
    showToast(data.message || "Ticket could not be created.");
    return;
  }

  ticketRows.prepend(ticketRow(data.ticket));
  ticketForm.reset();
  document.getElementById("ticketPriority").value = "Medium";
  document.getElementById("ticketStatus").value = "Open";
  filterRows();
  showToast(data.message);
}

async function createTeamMember(event) {
  event.preventDefault();
  const formData = new FormData(teamForm);
  const payload = Object.fromEntries(formData.entries());

  const response = await fetch("/api/portal/install-team", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();

  if (!response.ok) {
    showToast(data.message || "Technician could not be added.");
    return;
  }

  teamRows.prepend(teamMemberRow(data.member));
  teamForm.reset();
  document.getElementById("teamAvailability").value = "Available";
  document.getElementById("teamCurrentJob").value = "";
  filterRows();
  showToast(data.message);
}

async function createCustomer(event) {
  event.preventDefault();
  const formData = new FormData(customerForm);
  const payload = Object.fromEntries(formData.entries());

  const response = await fetch("/api/portal/customers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();

  if (!response.ok) {
    showToast(data.message || "Customer could not be saved.");
    return;
  }

  customerRows.prepend(customerRow(data.customer));
  document.getElementById("customerEmpty")?.remove();
  customerForm.reset();
  document.getElementById("customerSegment").value = "Residential";
  document.getElementById("customerStatus").value = "Active";
  filterRows();
  showToast(data.message);
}

async function createAccount(event) {
  event.preventDefault();
  const formData = new FormData(accountForm);
  const payload = Object.fromEntries(formData.entries());

  const response = await fetch("/api/portal/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();

  if (!response.ok) {
    showToast(data.message || "Account could not be created.");
    return;
  }

  accountRows.prepend(accountRow(data.user));
  accountForm.reset();
  document.getElementById("accountDepartment").value = "Install Operations";
  document.getElementById("accountRole").value = "technician";
  document.getElementById("accountMember").value = "";
  filterRows();
  showToast(data.message);
}

async function sendCrmQuery(event) {
  event.preventDefault();
  if (!crmQueryForm) return;
  const formData = new FormData(crmQueryForm);
  const question = String(formData.get("question") || "").trim();
  if (!question) {
    showToast("Enter a CRM question first.");
    return;
  }

  const response = await fetch("/api/portal/crm-query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  const data = await response.json();

  if (!response.ok) {
    showToast(data.message || "CRM query could not be sent.");
    return;
  }

  let message = data.message || "CRM query sent.";
  if (data.delivery && data.delivery.ok === false) {
    const detail = data.delivery.error ? ` ${data.delivery.error}` : ` OpenClaw delivery failed at ${data.delivery.url}.`;
    message = `${message}${detail}`;
  }
  showToast(message);
}

async function saveTicket(button) {
  const row = button.closest("tr");
  const status = row.querySelector(".ticket-status").value;
  const ticketId = button.dataset.ticketId;

  const response = await fetch(`/api/portal/project-tickets/${ticketId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  const data = await response.json();

  if (!response.ok) {
    showToast(data.message || "Ticket could not be updated.");
    return;
  }

  row.dataset.search = ticketSearchText(data.ticket);
  row.dataset.status = data.ticket.status.toLowerCase();
  filterRows();
  showToast(data.message);
}

async function saveTeamMember(button) {
  const row = button.closest("tr");
  const memberId = button.dataset.memberId;
  const availability = row.querySelector(".team-availability").value;
  const currentJob = row.querySelector(".team-job").value;

  const response = await fetch(`/api/portal/install-team/${memberId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ availability, current_job: currentJob }),
  });
  const data = await response.json();

  if (!response.ok) {
    showToast(data.message || "Team member could not be updated.");
    return;
  }

  row.dataset.search = memberSearchText(data.member);
  row.dataset.status = data.member.availability.toLowerCase();
  filterRows();
  showToast(data.message);
}

async function saveCustomer(button) {
  const row = button.closest("tr");
  const customerId = button.dataset.customerId;
  const status = row.querySelector(".customer-status").value;
  const notes = row.querySelector(".customer-notes").value;

  const response = await fetch(`/api/portal/customers/${customerId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, notes }),
  });
  const data = await response.json();

  if (!response.ok) {
    showToast(data.message || "Customer could not be updated.");
    return;
  }

  row.dataset.search = customerSearchText(data.customer);
  row.dataset.status = data.customer.status.toLowerCase();
  filterRows();
  showToast(data.message);
}

async function saveAccount(button) {
  const row = button.closest("tr");
  const userId = button.dataset.userId;
  const payload = {
    department: row.querySelector(".account-department").value,
    role: row.querySelector(".account-role").value,
    linked_team_member: row.querySelector(".account-member").value,
    active: row.querySelector(".account-active").value === "true",
  };
  const password = row.querySelector(".account-password").value;
  if (password) payload.password = password;

  const response = await fetch(`/api/portal/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();

  if (!response.ok) {
    showToast(data.message || "Account could not be updated.");
    return;
  }

  row.querySelector(".account-password").value = "";
  row.dataset.search = accountSearchText(data.user);
  row.dataset.status = data.user.active ? "active" : "blocked";
  filterRows();
  showToast(data.message);
}

async function saveInstallStage(button) {
  const row = button.closest(".install-stage-row");
  const select = row.querySelector(".install-stage-status");
  const { jobId, stageId } = button.dataset;

  const response = await fetch(`/api/portal/install-jobs/${jobId}/stages/${stageId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: select.value }),
  });
  const data = await response.json();

  if (!response.ok) {
    showToast(data.message || "Install stage could not be updated.");
    return;
  }

  row.dataset.status = select.value.toLowerCase();
  filterRows();
  showToast(data.message);
  if (data.refresh) {
    window.setTimeout(() => window.location.reload(), 700);
  }
}

// ---- Inventory Management ----

const inventoryForm = document.getElementById("inventoryForm");
const inventoryRows = document.getElementById("inventoryRows");
const invCategoryFilter = document.getElementById("invCategoryFilter");
const invStatusFilter = document.getElementById("invStatusFilter");
const invAdjustModal = document.getElementById("invAdjustModal");
let invAdjustItemId = null;

function invStatusClass(status) {
  if (status === "Out of Stock") return "critical";
  if (status === "Low Stock") return "warning";
  if (status === "Ordered") return "info";
  return "healthy";
}

function inventoryRow(item) {
  const tr = document.createElement("tr");
  tr.dataset.itemId = item.id;
  tr.dataset.search = `${item.id} ${item.item_no} ${item.name} ${item.category} ${item.status} ${item.vendor || ""}`;
  tr.dataset.category = item.category;
  tr.dataset.invStatus = item.status;
  const cls = invStatusClass(item.status);
  tr.innerHTML = `
    <td><span class="inv-num">${escapeHtml(String(item.item_no))}</span></td>
    <td><strong>${escapeHtml(item.name)}</strong>${item.notes ? `<span>${escapeHtml(item.notes)}</span>` : ""}</td>
    <td><span class="inv-cat">${escapeHtml(item.category)}</span></td>
    <td class="inv-qty">${escapeHtml(String(item.qty_on_hand))} ${escapeHtml(item.unit)}</td>
    <td>${escapeHtml(String(item.reorder_point))}</td>
    <td>${escapeHtml(item.unit)}</td>
    <td>${escapeHtml(String(item.lead_time_days))}d</td>
    <td><mark class="badge ${cls}">${escapeHtml(item.status)}</mark></td>
    <td class="inv-actions">
      <button class="action-btn small inv-adjust-btn"
        data-item-id="${escapeHtml(item.id)}"
        data-item-name="${escapeHtml(item.name)}"
        data-item-unit="${escapeHtml(item.unit)}"
        data-item-qty="${escapeHtml(String(item.qty_on_hand))}">
        <i class="fa fa-plus-minus"></i> Adjust
      </button>
    </td>
  `;
  return tr;
}

function filterInventoryRows() {
  const cat = invCategoryFilter ? invCategoryFilter.value : "all";
  const status = invStatusFilter ? invStatusFilter.value : "all";
  document.querySelectorAll("#inventoryRows tr").forEach((row) => {
    const matchCat = cat === "all" || row.dataset.category === cat;
    const matchStatus = status === "all" || row.dataset.invStatus === status;
    row.classList.toggle("row-hidden", !(matchCat && matchStatus));
  });
}

function openAdjustModal(button) {
  invAdjustItemId = button.dataset.itemId;
  document.getElementById("invAdjustName").textContent = button.dataset.itemName;
  document.getElementById("invAdjustCurrent").textContent = button.dataset.itemQty;
  document.getElementById("invAdjustUnit").textContent = button.dataset.itemUnit;
  document.getElementById("invAdjustDelta").value = "0";
  document.getElementById("invAdjustReason").value = "";
  invAdjustModal.style.display = "flex";
}

async function confirmAdjust() {
  if (!invAdjustItemId) return;
  const delta = parseInt(document.getElementById("invAdjustDelta").value || "0", 10);
  const reason = document.getElementById("invAdjustReason").value.trim() || "Manual adjustment";
  const response = await fetch(`/api/portal/inventory/${invAdjustItemId}/adjust`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ delta, reason }),
  });
  const data = await response.json();
  invAdjustModal.style.display = "none";
  showToast(data.message || "Quantity adjusted.");
  if (response.ok) window.setTimeout(() => window.location.reload(), 700);
}

async function createInventoryItem(event) {
  event.preventDefault();
  const formData = new FormData(inventoryForm);
  const payload = Object.fromEntries(formData.entries());
  const response = await fetch("/api/portal/inventory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) { showToast(data.message || "Could not add part."); return; }
  showToast(data.message);
  if (inventoryRows && data.item) {
    inventoryRows.insertBefore(inventoryRow(data.item), inventoryRows.firstChild);
    filterInventoryRows();
  }
  inventoryForm.reset();
}

async function raisePOForFlagged() {
  const checked = [...document.querySelectorAll(".inv-po-check:checked")].map((el) => el.value);
  if (!checked.length) { showToast("No items selected for PO."); return; }
  const response = await fetch("/api/portal/inventory/raise-po", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_ids: checked }),
  });
  const data = await response.json();
  showToast(data.message || "PO raised.");
  if (response.ok) window.setTimeout(() => window.location.reload(), 800);
}

if (invCategoryFilter) invCategoryFilter.addEventListener("change", filterInventoryRows);
if (invStatusFilter) invStatusFilter.addEventListener("change", filterInventoryRows);
if (inventoryForm) inventoryForm.addEventListener("submit", createInventoryItem);

const invRaisePOBtn = document.getElementById("invRaisePOBtn");
const invConfirmPOBtn = document.getElementById("invConfirmPOBtn");
const invAdjustConfirm = document.getElementById("invAdjustConfirm");
const invAdjustCancel = document.getElementById("invAdjustCancel");

if (invRaisePOBtn) invRaisePOBtn.addEventListener("click", raisePOForFlagged);
if (invConfirmPOBtn) invConfirmPOBtn.addEventListener("click", raisePOForFlagged);
if (invAdjustConfirm) invAdjustConfirm.addEventListener("click", confirmAdjust);
if (invAdjustCancel) invAdjustCancel.addEventListener("click", () => { invAdjustModal.style.display = "none"; });

if (inventoryRows) {
  inventoryRows.addEventListener("click", (event) => {
    const button = event.target.closest(".inv-adjust-btn");
    if (button) openAdjustModal(button);
  });
}

// ---- End Inventory ----

// ---- Org Chart & Attendance ----

const orgChartDataEl = document.getElementById("orgChartData");
const orgNodes = orgChartDataEl ? JSON.parse(orgChartDataEl.textContent || "[]") : [];
const orgTreeWrap = document.getElementById("orgTreeWrap");
const orgModal = document.getElementById("orgModal");
const orgAddBtn = document.getElementById("orgAddBtn");
const orgModalSave = document.getElementById("orgModalSave");
const orgModalCancel = document.getElementById("orgModalCancel");
const orgModalDelete = document.getElementById("orgModalDelete");

function orgInitials(name) {
  return name.split(" ").slice(0, 2).map((w) => w[0] || "").join("").toUpperCase();
}

function orgDeptColor(dept) {
  const map = {
    "Executive Office": "#e02020",
    "Service Control": "#2563eb",
    "Project Office": "#7c3aed",
    "Install Operations": "#c47a00",
    "Stores & Procurement": "#14865f",
    "Sales & Renewals": "#0891b2",
    "Customer Success": "#9333ea",
  };
  return map[dept] || "#747b8d";
}

function buildOrgTree(nodes) {
  const map = {};
  nodes.forEach((n) => { map[n.id] = { ...n, children: [] }; });
  const roots = [];
  nodes.forEach((n) => {
    if (n.reports_to && map[n.reports_to]) {
      map[n.reports_to].children.push(map[n.id]);
    } else {
      roots.push(map[n.id]);
    }
  });
  return roots;
}

function renderOrgNode(node, isAdmin) {
  const color = orgDeptColor(node.department);
  const initials = orgInitials(node.name);
  const editBtn = isAdmin
    ? `<button class="org-node-edit" data-node-id="${escapeHtml(node.id)}" title="Edit"><i class="fa fa-pen"></i></button>`
    : "";
  const childrenHtml = node.children && node.children.length
    ? `<div class="org-children">${node.children.map((c) => renderOrgNode(c, isAdmin)).join("")}</div>`
    : "";
  return `
    <div class="org-node-wrap">
      <div class="org-node" data-node-id="${escapeHtml(node.id)}">
        <div class="org-avatar" style="background:${color}">${escapeHtml(initials)}</div>
        <div class="org-node-body">
          <strong>${escapeHtml(node.name)}</strong>
          <span>${escapeHtml(node.title || "")}</span>
          <em>${escapeHtml(node.department || "")}</em>
          ${node.phone ? `<small><i class="fa fa-phone"></i> ${escapeHtml(node.phone)}</small>` : ""}
        </div>
        ${editBtn}
      </div>
      ${childrenHtml}
    </div>`;
}

function populateReportsToSelect(excludeId) {
  const sel = document.getElementById("orgModalReportsTo");
  sel.innerHTML = '<option value="">— none (top level) —</option>';
  orgNodes.forEach((n) => {
    if (n.id === excludeId) return;
    const opt = document.createElement("option");
    opt.value = n.id;
    opt.textContent = `${n.name} (${n.department || n.title || n.id})`;
    sel.appendChild(opt);
  });
}

function openOrgModal(nodeId) {
  const node = nodeId ? orgNodes.find((n) => n.id === nodeId) : null;
  document.getElementById("orgModalTitle").innerHTML = node
    ? '<i class="fa fa-pen"></i> Edit Person'
    : '<i class="fa fa-user-plus"></i> Add Person';
  document.getElementById("orgModalId").value = nodeId || "";
  document.getElementById("orgModalName").value = node ? node.name : "";
  document.getElementById("orgModalTitle2").value = node ? node.title : "";
  document.getElementById("orgModalDept").value = node ? node.department : "";
  document.getElementById("orgModalPhone").value = node ? node.phone : "";
  document.getElementById("orgModalEmail").value = node ? node.email : "";
  populateReportsToSelect(nodeId);
  document.getElementById("orgModalReportsTo").value = node ? (node.reports_to || "") : "";
  orgModalDelete.style.display = node ? "inline-flex" : "none";
  orgModal.style.display = "flex";
}

function closeOrgModal() { orgModal.style.display = "none"; }

async function saveOrgNode() {
  const nodeId = document.getElementById("orgModalId").value;
  const payload = {
    name: document.getElementById("orgModalName").value.trim(),
    title: document.getElementById("orgModalTitle2").value.trim(),
    department: document.getElementById("orgModalDept").value,
    reports_to: document.getElementById("orgModalReportsTo").value || null,
    phone: document.getElementById("orgModalPhone").value.trim(),
    email: document.getElementById("orgModalEmail").value.trim(),
  };
  if (!payload.name) { showToast("Name is required."); return; }
  const url = nodeId ? `/api/portal/org-chart/${nodeId}` : "/api/portal/org-chart";
  const method = nodeId ? "PATCH" : "POST";
  const resp = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await resp.json();
  if (!resp.ok || !data.ok) { showToast(data.message || "Save failed."); return; }
  showToast(nodeId ? "Person updated." : "Person added.");
  closeOrgModal();
  window.setTimeout(() => window.location.reload(), 600);
}

async function deleteOrgNode() {
  const nodeId = document.getElementById("orgModalId").value;
  if (!nodeId) return;
  if (!window.confirm("Remove this person from the org chart?")) return;
  const resp = await fetch(`/api/portal/org-chart/${nodeId}`, { method: "DELETE" });
  const data = await resp.json();
  if (!resp.ok || !data.ok) { showToast(data.message || "Delete failed."); return; }
  showToast("Person removed.");
  closeOrgModal();
  window.setTimeout(() => window.location.reload(), 600);
}

function renderOrgChart() {
  if (!orgTreeWrap) return;
  const isAdmin = document.body.dataset.defaultView !== undefined
    && document.querySelector(".side-link[data-view='accounts']") !== null;
  const roots = buildOrgTree(orgNodes);
  if (!roots.length) {
    orgTreeWrap.innerHTML = '<p style="padding:2rem;color:var(--muted)">No people in the org chart yet. Add the first person.</p>';
    return;
  }
  orgTreeWrap.innerHTML = `<div class="org-tree">${roots.map((r) => renderOrgNode(r, isAdmin)).join("")}</div>`;
  orgTreeWrap.querySelectorAll(".org-node-edit").forEach((btn) => {
    btn.addEventListener("click", (e) => { e.stopPropagation(); openOrgModal(btn.dataset.nodeId); });
  });
}

if (orgAddBtn) orgAddBtn.addEventListener("click", () => openOrgModal(null));
if (orgModalSave) orgModalSave.addEventListener("click", saveOrgNode);
if (orgModalCancel) orgModalCancel.addEventListener("click", closeOrgModal);
if (orgModalDelete) orgModalDelete.addEventListener("click", deleteOrgNode);
if (orgModal) orgModal.addEventListener("click", (e) => { if (e.target === orgModal) closeOrgModal(); });

renderOrgChart();

// ---- Attendance ----

const attDateInput = document.getElementById("attDate");
const attRows = document.getElementById("attRows");
const attSaveAll = document.getElementById("attSaveAll");
const attSummaryEl = document.getElementById("attSummary");
const attTodayDataEl = document.getElementById("attendanceTodayData");
let attendanceRecords = attTodayDataEl ? JSON.parse(attTodayDataEl.textContent || "[]") : [];

const ATT_STATUSES = ["present", "late", "absent", "wfh", "leave", "holiday"];
const ATT_STATUS_CLASS = { present: "healthy", late: "warning", absent: "critical", wfh: "info", leave: "info", holiday: "info" };

if (!attDateInput.value) {
  attDateInput.value = new Date().toISOString().split("T")[0];
}

function attStatusBadge(status) {
  const cls = ATT_STATUS_CLASS[status] || "info";
  return `<mark class="badge ${cls}">${status}</mark>`;
}

function buildAttRows(records, nodes) {
  if (!attRows) return;
  const recordMap = {};
  records.forEach((r) => { recordMap[r.person_id] = r; });

  attRows.innerHTML = "";
  nodes.forEach((node) => {
    const rec = recordMap[node.id] || {};
    const status = rec.status || "";
    const tr = document.createElement("tr");
    tr.dataset.nodeId = node.id;
    tr.dataset.recordId = rec.id || "";
    tr.innerHTML = `
      <td><strong>${escapeHtml(node.name)}</strong></td>
      <td>${escapeHtml(node.title || "")}</td>
      <td>${escapeHtml(node.department || "")}</td>
      <td>
        <select class="att-status-sel" aria-label="Status for ${escapeHtml(node.name)}">
          <option value="">— not marked —</option>
          ${ATT_STATUSES.map((s) => `<option value="${s}" ${status === s ? "selected" : ""}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join("")}
        </select>
      </td>
      <td><input class="att-checkin" type="time" value="${escapeHtml(rec.check_in || "")}" /></td>
      <td><input class="att-checkout" type="time" value="${escapeHtml(rec.check_out || "")}" /></td>
      <td><input class="att-notes" type="text" value="${escapeHtml(rec.notes || "")}" placeholder="Optional note" /></td>
    `;
    attRows.appendChild(tr);
  });
  updateAttSummary();
}

function updateAttSummary() {
  if (!attSummaryEl || !attRows) return;
  const statuses = [...attRows.querySelectorAll(".att-status-sel")].map((s) => s.value).filter(Boolean);
  const counts = {};
  statuses.forEach((s) => { counts[s] = (counts[s] || 0) + 1; });
  const parts = [];
  if (counts.present) parts.push(`<span class="badge healthy">${counts.present} Present</span>`);
  if (counts.late) parts.push(`<span class="badge warning">${counts.late} Late</span>`);
  if (counts.absent) parts.push(`<span class="badge critical">${counts.absent} Absent</span>`);
  if (counts.wfh) parts.push(`<span class="badge info">${counts.wfh} WFH</span>`);
  if (counts.leave) parts.push(`<span class="badge info">${counts.leave} Leave</span>`);
  attSummaryEl.innerHTML = parts.join(" ");
}

async function loadAttendanceForDate(date) {
  const resp = await fetch(`/api/portal/attendance?date=${date}`);
  const data = await resp.json();
  if (data.ok) {
    attendanceRecords = data.records;
    buildAttRows(attendanceRecords, orgNodes);
  }
}

async function saveAllAttendance() {
  if (!attRows) return;
  const date = attDateInput ? attDateInput.value : new Date().toISOString().split("T")[0];
  const rows = attRows.querySelectorAll("tr[data-node-id]");
  let saved = 0;
  for (const row of rows) {
    const personId = row.dataset.nodeId;
    const recordId = row.dataset.recordId;
    const status = row.querySelector(".att-status-sel").value;
    if (!status) continue;
    const payload = {
      person_id: personId,
      date,
      status,
      check_in: row.querySelector(".att-checkin").value,
      check_out: row.querySelector(".att-checkout").value,
      notes: row.querySelector(".att-notes").value,
    };
    const url = recordId ? `/api/portal/attendance/${recordId}` : "/api/portal/attendance";
    const method = recordId ? "PATCH" : "POST";
    const resp = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await resp.json();
    if (data.ok) {
      row.dataset.recordId = data.record.id;
      saved++;
    }
  }
  showToast(`Attendance saved for ${saved} staff member${saved !== 1 ? "s" : ""}.`);
  updateAttSummary();
}

if (attDateInput) attDateInput.addEventListener("change", () => loadAttendanceForDate(attDateInput.value));
if (attSaveAll) attSaveAll.addEventListener("click", saveAllAttendance);
if (attRows) attRows.addEventListener("change", (e) => { if (e.target.classList.contains("att-status-sel")) updateAttSummary(); });

buildAttRows(attendanceRecords, orgNodes);

// ---- Org tabs ----
document.querySelectorAll(".org-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".org-tab").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".org-tab-panel").forEach((p) => { p.style.display = "none"; });
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).style.display = "block";
  });
});

// ---- End Org Chart & Attendance ----

// ---- Costing Estimator ----

const estimatorForm = document.getElementById("estimatorForm");
const estCalcBtn = document.getElementById("estCalcBtn");
const estBaseVal = document.getElementById("estBaseVal");
const estAddonsVal = document.getElementById("estAddonsVal");
const estSubtotalVal = document.getElementById("estSubtotalVal");
const estTotalVal = document.getElementById("estTotalVal");
const estMargin = document.getElementById("estMargin");

function fmtINR(n) {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

function collectEstimatorPayload() {
  if (!estimatorForm) return {};
  const fd = new FormData(estimatorForm);
  const addons = [...estimatorForm.querySelectorAll('input[name="addons"]:checked')].map(el => el.value);
  return {
    customer_name: fd.get("customer_name") || "",
    customer_id: fd.get("customer_id") || "",
    site: fd.get("site") || "",
    elevator_type: fd.get("elevator_type") || "",
    make: fd.get("make") || "Fuzi",
    capacity: fd.get("capacity") || "",
    num_floors: parseInt(fd.get("num_floors") || "4", 10),
    motor_type: fd.get("motor_type") || "",
    speed: fd.get("speed") || "",
    floor_height_mm: parseInt(fd.get("floor_height_mm") || "3000", 10),
    pit_depth_mm: parseInt(fd.get("pit_depth_mm") || "1200", 10),
    overhead_mm: parseInt(fd.get("overhead_mm") || "4200", 10),
    cabin_finish: fd.get("cabin_finish") || "",
    door_type: fd.get("door_type") || "",
    door_construction: fd.get("door_construction") || "",
    door_panels: parseInt(fd.get("door_panels") || "2", 10),
    door_opening_type: fd.get("door_opening_type") || "",
    door_vision: fd.get("door_vision") || "",
    door_width_mm: parseInt(fd.get("door_width_mm") || "700", 10),
    door_height_mm: parseInt(fd.get("door_height_mm") || "2000", 10),
    door_arrangement: fd.get("door_arrangement") || "",
    control_type: fd.get("control_type") || "",
    remark_1: fd.get("remark_1") || "",
    remark_2: fd.get("remark_2") || "",
    remark_3: fd.get("remark_3") || "",
    remark_4: fd.get("remark_4") || "",
    addons,
    margin_percent: parseFloat(fd.get("margin_percent") || "20"),
    sent_to_email: fd.get("sent_to_email") || "",
    valid_until: fd.get("valid_until") || "",
    notes: fd.get("notes") || "",
  };
}

async function calculateEstimate() {
  if (!estimatorForm) return null;
  const payload = collectEstimatorPayload();
  const resp = await fetch("/api/portal/estimates/calculate", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  const data = await resp.json();
  if (data.ok) {
    if (estBaseVal) estBaseVal.textContent = fmtINR(data.base_cost);
    if (estAddonsVal) estAddonsVal.textContent = fmtINR(data.addons_cost);
    if (estSubtotalVal) estSubtotalVal.textContent = fmtINR(data.subtotal);
    if (estTotalVal) estTotalVal.textContent = fmtINR(data.total_cost);
  }
  return data;
}

if (estCalcBtn) estCalcBtn.addEventListener("click", calculateEstimate);
if (estMargin) estMargin.addEventListener("change", calculateEstimate);
if (estimatorForm) {
  [
    "estType", "estCapacityPax", "estCapacityGoods", "estFloors", "estMotor", "estSpeed",
    "estFinish", "estDoor", "estDoorConstruction", "estDoorPanels", "estDoorOpeningType",
    "estDoorVision", "estDoorWidth", "estDoorHeight", "estDoorArrangement",
    "estControl", "estFloorHeight", "estMake",
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", calculateEstimate);
  });
  estimatorForm.querySelectorAll('input[name="addons"]').forEach(el => el.addEventListener("change", calculateEstimate));
}

// Capacity toggle: show passenger or goods capacity based on elevator type
(function() {
  const typeEl = document.getElementById("estType");
  const paxWrap = document.getElementById("estCapacityPaxWrap");
  const goodsWrap = document.getElementById("estCapacityGoodsWrap");
  const paxSel = document.getElementById("estCapacityPax");
  const goodsSel = document.getElementById("estCapacityGoods");
  if (!typeEl || !paxWrap || !goodsWrap) return;
  function syncCapacity() {
    const isGoods = typeEl.value === "Goods" || typeEl.value === "Dumbwaiter";
    paxWrap.style.display = isGoods ? "none" : "";
    goodsWrap.style.display = isGoods ? "" : "none";
    if (paxSel) paxSel.disabled = isGoods;
    if (goodsSel) goodsSel.disabled = !isGoods;
  }
  typeEl.addEventListener("change", syncCapacity);
  syncCapacity();
})();

if (estimatorForm) {
  estimatorForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = collectEstimatorPayload();
    if (!payload.customer_name) { showToast("Customer name is required."); return; }
    const resp = await fetch("/api/portal/estimates", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (!resp.ok || !data.ok) { showToast("Failed to save estimate."); return; }
    showToast(`Estimate ${data.estimate.id} saved — total ${fmtINR(data.estimate.total_cost)}`);
    window.setTimeout(() => window.location.reload(), 900);
  });
}

// Estimate send buttons
document.querySelectorAll(".est-send-btn").forEach(btn => {
  btn.addEventListener("click", async () => {
    const estId = btn.dataset.estId;
    let email = btn.dataset.estEmail || "";
    if (!email) email = window.prompt("Enter recipient email for this estimate:");
    if (!email) return;
    const resp = await fetch(`/api/portal/estimates/${estId}/send`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
    });
    const data = await resp.json();
    if (data.ok && data.method === "mailto") {
      const subject = encodeURIComponent(`FUZI Elevators — Quotation ${estId}`);
      const body = encodeURIComponent(`Please find your elevator quotation attached. View the full report at: ${window.location.origin}/api/portal/estimates/${estId}/report`);
      window.open(`mailto:${email}?subject=${subject}&body=${body}`);
      showToast("Email client opened. Estimate marked as Sent.");
    } else if (data.ok) {
      showToast(`Report sent to ${email}.`);
    } else {
      showToast(data.message || "Send failed.");
    }
    if (data.ok) window.setTimeout(() => window.location.reload(), 1000);
  });
});

// Grant Portal Access
const grantPortalModal = document.getElementById("grantPortalModal");
const grantPortalSave = document.getElementById("grantPortalSave");
const grantPortalCancel = document.getElementById("grantPortalCancel");
const grantResult = document.getElementById("grantResult");

document.querySelectorAll(".grant-portal-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.getElementById("grantCustomerId").value = btn.dataset.customerId;
    document.getElementById("grantDisplayName").value = btn.dataset.customerName || "";
    document.getElementById("grantEmail").value = btn.dataset.customerEmail || "";
    const slug = (btn.dataset.customerName || "").toLowerCase().replace(/[^a-z0-9]+/g, ".");
    document.getElementById("grantUsername").value = slug;
    if (grantResult) { grantResult.style.display = "none"; grantResult.textContent = ""; }
    if (grantPortalModal) grantPortalModal.style.display = "flex";
  });
});

if (grantPortalCancel) grantPortalCancel.addEventListener("click", () => { if (grantPortalModal) grantPortalModal.style.display = "none"; });
if (grantPortalModal) grantPortalModal.addEventListener("click", e => { if (e.target === grantPortalModal) grantPortalModal.style.display = "none"; });

if (grantPortalSave) {
  grantPortalSave.addEventListener("click", async () => {
    const payload = {
      customer_id: document.getElementById("grantCustomerId").value,
      username: document.getElementById("grantUsername").value.trim(),
      display_name: document.getElementById("grantDisplayName").value.trim(),
      email: document.getElementById("grantEmail").value.trim(),
      temp_password: document.getElementById("grantTempPw").value.trim(),
    };
    if (!payload.username) { showToast("Username is required."); return; }
    const resp = await fetch("/api/portal/customer-users", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (!resp.ok || !data.ok) { showToast(data.message || "Failed."); return; }
    if (grantResult) {
      grantResult.innerHTML = `<strong>Access created!</strong><br>
        Username: <code>${escapeHtml(data.customer_user.username)}</code><br>
        Temp password: <code>${escapeHtml(data.temp_password)}</code><br>
        Portal URL: <code>${window.location.origin}/customer/login</code>`;
      grantResult.style.display = "block";
    }
    grantPortalSave.disabled = true;
  });
}

// ---- Payment Ledger ----

const payEstSelect = document.getElementById("payEstSelect");
const payToolbarActions = document.getElementById("payToolbarActions");
const paySummaryCards = document.getElementById("paySummaryCards");
const payTableWrap = document.getElementById("payTableWrap");
const payRows = document.getElementById("payRows");
const payForm = document.getElementById("payForm");
const payEmptyMsg = document.getElementById("payEmptyMsg");
const payAutoScheduleBtn = document.getElementById("payAutoScheduleBtn");
const payAddBtn = document.getElementById("payAddBtn");
const payFormSave = document.getElementById("payFormSave");
const payFormCancel = document.getElementById("payFormCancel");

const PAY_STATUS_CLASS = { Paid: "healthy", Overdue: "critical", Partial: "warning", Due: "warning", Waived: "info" };

function fmtINR2(n) { return "₹" + Math.round(n).toLocaleString("en-IN"); }

function updatePaySummary(summary) {
  if (!paySummaryCards) return;
  document.getElementById("payCardContract").textContent = fmtINR2(summary.contract_value);
  document.getElementById("payCardReceived").textContent = fmtINR2(summary.received);
  document.getElementById("payCardOutstanding").textContent = fmtINR2(summary.outstanding);
  document.getElementById("payCardOverdue").textContent = fmtINR2(summary.overdue);
  paySummaryCards.style.display = "grid";
}

function renderPayRows(payments) {
  if (!payRows) return;
  payRows.innerHTML = "";
  if (!payments || !payments.length) {
    if (payTableWrap) payTableWrap.style.display = "none";
    return;
  }
  if (payTableWrap) payTableWrap.style.display = "block";
  payments.forEach(p => {
    const cls = PAY_STATUS_CLASS[p.status] || "info";
    const tr = document.createElement("tr");
    tr.dataset.payId = p.id;
    tr.innerHTML = `
      <td><strong>${escapeHtml(p.id)}</strong></td>
      <td>${escapeHtml(p.milestone)}</td>
      <td><strong>${fmtINR2(p.amount)}</strong></td>
      <td>${escapeHtml(p.due_date || "—")}</td>
      <td><mark class="badge ${cls}">${escapeHtml(p.status)}</mark></td>
      <td>${escapeHtml(p.paid_date || "—")}</td>
      <td>${escapeHtml(p.payment_method || "")}</td>
      <td>${escapeHtml(p.reference || "")}</td>
      <td>${escapeHtml(p.notes || "")}</td>
      <td style="white-space:nowrap">
        <button class="action-btn small pay-edit-btn" data-pay-id="${escapeHtml(p.id)}"><i class="fa fa-pen"></i> Edit</button>
        <button class="action-btn small pay-paid-btn ${p.status === 'Paid' ? 'quiet' : 'healthy-btn'}" data-pay-id="${escapeHtml(p.id)}" ${p.status === 'Paid' ? 'disabled' : ''} title="Mark as Paid"><i class="fa fa-check"></i></button>
        <button class="action-btn small quiet pay-del-btn" data-pay-id="${escapeHtml(p.id)}" title="Delete"><i class="fa fa-trash"></i></button>
      </td>`;
    payRows.appendChild(tr);
  });
}

async function loadPaymentsForEstimate(estimateId) {
  if (!estimateId) {
    if (payToolbarActions) payToolbarActions.style.display = "none";
    if (paySummaryCards) paySummaryCards.style.display = "none";
    if (payTableWrap) payTableWrap.style.display = "none";
    if (payForm) payForm.style.display = "none";
    if (payEmptyMsg) { payEmptyMsg.style.display = "block"; payEmptyMsg.textContent = "Select an estimate above to view or add payment records."; }
    return;
  }
  const resp = await fetch(`/api/portal/payments?estimate_id=${estimateId}`);
  const data = await resp.json();
  if (!data.ok) return;
  if (payToolbarActions) payToolbarActions.style.display = "flex";
  if (payEmptyMsg) payEmptyMsg.style.display = "none";
  renderPayRows(data.payments);
  // Compute summary from rows
  const payments = data.payments;
  const estOpt = payEstSelect ? [...payEstSelect.options].find(o => o.value === estimateId) : null;
  const totalMatch = estOpt ? estOpt.textContent.match(/₹([\d,]+)/) : null;
  const contractValue = totalMatch ? parseInt(totalMatch[1].replace(/,/g, ""), 10) : 0;
  const received = payments.filter(p => p.status === "Paid").reduce((s, p) => s + p.amount, 0);
  const outstanding = payments.filter(p => ["Due", "Overdue", "Partial"].includes(p.status)).reduce((s, p) => s + p.amount, 0);
  const overdue = payments.filter(p => p.status === "Overdue").reduce((s, p) => s + p.amount, 0);
  updatePaySummary({ contract_value: contractValue, received, outstanding, overdue });
}

function openPayForm(payment) {
  if (!payForm) return;
  document.getElementById("payFormTitle").innerHTML = payment
    ? '<i class="fa fa-pen"></i> Edit Payment'
    : '<i class="fa fa-plus"></i> Add Payment';
  document.getElementById("payFormId").value = payment ? payment.id : "";
  document.getElementById("payMilestone").value = payment ? payment.milestone : "";
  document.getElementById("payAmount").value = payment ? payment.amount : "";
  document.getElementById("payDueDate").value = payment ? payment.due_date : "";
  document.getElementById("payStatus").value = payment ? payment.status : "Due";
  document.getElementById("payPaidDate").value = payment ? payment.paid_date : "";
  document.getElementById("payMethod").value = payment ? payment.payment_method : "";
  document.getElementById("payRef").value = payment ? payment.reference : "";
  document.getElementById("payNotes").value = payment ? payment.notes : "";
  payForm.style.display = "block";
  payForm.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function closePayForm() { if (payForm) payForm.style.display = "none"; }

async function savePayment() {
  const estimateId = payEstSelect ? payEstSelect.value : "";
  if (!estimateId) { showToast("Select an estimate first."); return; }
  const payId = document.getElementById("payFormId").value;
  const payload = {
    estimate_id: estimateId,
    milestone: document.getElementById("payMilestone").value.trim(),
    amount: parseFloat(document.getElementById("payAmount").value) || 0,
    due_date: document.getElementById("payDueDate").value,
    status: document.getElementById("payStatus").value,
    paid_date: document.getElementById("payPaidDate").value,
    payment_method: document.getElementById("payMethod").value,
    reference: document.getElementById("payRef").value.trim(),
    notes: document.getElementById("payNotes").value.trim(),
  };
  const url = payId ? `/api/portal/payments/${payId}` : "/api/portal/payments";
  const method = payId ? "PATCH" : "POST";
  const resp = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await resp.json();
  if (!resp.ok || !data.ok) { showToast(data.message || "Save failed."); return; }
  showToast(payId ? "Payment updated." : "Payment added.");
  closePayForm();
  renderPayRows(data.summary.payments);
  updatePaySummary(data.summary);
}

if (payEstSelect) payEstSelect.addEventListener("change", () => loadPaymentsForEstimate(payEstSelect.value));
if (payAddBtn) payAddBtn.addEventListener("click", () => openPayForm(null));
if (payFormSave) payFormSave.addEventListener("click", savePayment);
if (payFormCancel) payFormCancel.addEventListener("click", closePayForm);

if (payAutoScheduleBtn) {
  payAutoScheduleBtn.addEventListener("click", async () => {
    const estimateId = payEstSelect ? payEstSelect.value : "";
    if (!estimateId) { showToast("Select an estimate first."); return; }
    const startDate = new Date().toISOString().split("T")[0];
    const resp = await fetch("/api/portal/payments/auto-schedule", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estimate_id: estimateId, start_date: startDate }),
    });
    const data = await resp.json();
    if (!resp.ok || !data.ok) { showToast(data.message || "Auto-schedule failed."); return; }
    showToast(`4 payment milestones created (30/30/30/10 split).`);
    renderPayRows(data.summary.payments);
    updatePaySummary(data.summary);
  });
}

if (payRows) {
  payRows.addEventListener("click", async (e) => {
    const editBtn = e.target.closest(".pay-edit-btn");
    const paidBtn = e.target.closest(".pay-paid-btn");
    const delBtn = e.target.closest(".pay-del-btn");

    if (editBtn) {
      const payId = editBtn.dataset.payId;
      const resp = await fetch(`/api/portal/payments?estimate_id=${payEstSelect ? payEstSelect.value : ""}`);
      const data = await resp.json();
      const payment = data.payments.find(p => p.id === payId);
      if (payment) openPayForm(payment);
    }

    if (paidBtn && !paidBtn.disabled) {
      const payId = paidBtn.dataset.payId;
      const today = new Date().toISOString().split("T")[0];
      const resp = await fetch(`/api/portal/payments/${payId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Paid", paid_date: today }),
      });
      const data = await resp.json();
      if (data.ok) { showToast("Marked as Paid."); renderPayRows(data.summary.payments); updatePaySummary(data.summary); }
    }

    if (delBtn) {
      if (!window.confirm("Delete this payment record?")) return;
      const payId = delBtn.dataset.payId;
      const resp = await fetch(`/api/portal/payments/${payId}`, { method: "DELETE" });
      const data = await resp.json();
      if (data.ok) { showToast("Payment deleted."); renderPayRows(data.summary.payments); updatePaySummary(data.summary); }
    }
  });
}

// Initialise empty state
if (payEmptyMsg) { payEmptyMsg.style.display = "block"; }

// ---- End Payment Ledger ----

// ===== Department Module Helpers =====
function parseDeptData(id) {
  const el = document.getElementById(id);
  try { return el ? JSON.parse(el.textContent) : []; } catch { return []; }
}

function fmtDate(iso) {
  if (!iso) return "—";
  return iso.replace("T", " ").substring(0, 16);
}

function statusBadge(status, map) {
  const cls = (map && map[status]) || "badge-info";
  return `<span class="badge ${cls}">${status || "—"}</span>`;
}

async function deptPost(url, body) {
  const resp = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await resp.json();
  if (data.ok) { showToast(data.message || "Saved."); return data; }
  showToast(data.error || "Error saving.");
  return null;
}

async function deptPatch(url, body) {
  const resp = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await resp.json();
  if (data.ok) { showToast(data.message || "Updated."); return data; }
  showToast(data.error || "Error updating.");
  return null;
}

// ===== Sales Inquiries =====
function openSalesModal() { document.getElementById("salesModal").style.display = "flex"; }
function closeSalesModal() { document.getElementById("salesModal").style.display = "none"; }

function renderSalesRows(inquiries) {
  const tbody = document.getElementById("salesRows");
  if (!tbody) return;
  const map = { "New": "badge-info", "Follow-up": "badge-warn", "Order Received": "badge-success", "Closed": "badge-success" };
  tbody.innerHTML = inquiries.map(r => `<tr>
    <td>${r.id}</td><td>${r.customer || "—"}</td><td>${r.site || "—"}</td>
    <td>${r.elevator_type || "—"}</td><td>${statusBadge(r.status, map)}</td>
    <td>${fmtDate(r.created_at)}</td>
    <td>
      <button class="btn-xs" onclick="salesFollowUp('${r.id}')">Follow-up</button>
      <button class="btn-xs" onclick="salesOrderReceived('${r.id}')">Order Rcvd</button>
    </td>
  </tr>`).join("");
}

async function submitSalesInquiry() {
  const body = {
    customer: document.getElementById("siqCustomer").value.trim(),
    site: document.getElementById("siqSite").value.trim(),
    elevator_type: document.getElementById("siqType").value,
    notes: document.getElementById("siqNotes").value.trim(),
  };
  if (!body.customer) { showToast("Customer name is required."); return; }
  const res = await deptPost("/api/portal/sales/inquiries", body);
  if (res) { closeSalesModal(); renderSalesRows(res.data); }
}

async function salesFollowUp(id) {
  const res = await deptPatch(`/api/portal/sales/inquiries/${id}`, { action: "followup" });
  if (res) renderSalesRows(res.data);
}

async function salesOrderReceived(id) {
  const res = await deptPatch(`/api/portal/sales/inquiries/${id}`, { action: "order_received" });
  if (res) renderSalesRows(res.data);
}

// ===== Breakdown =====
function openBreakdownModal() { document.getElementById("breakdownModal").style.display = "flex"; }
function closeBreakdownModal() { document.getElementById("breakdownModal").style.display = "none"; }

function renderBreakdownRows(records) {
  const tbody = document.getElementById("breakdownRows");
  if (!tbody) return;
  const map = { "Open": "badge-warn", "Attended": "badge-info", "Closed": "badge-success" };
  tbody.innerHTML = records.map(r => `<tr>
    <td>${r.id}</td><td>${r.unit || "—"}</td><td>${r.customer || "—"}</td>
    <td>${fmtDate(r.reported_at)}</td><td>${fmtDate(r.attended_at)}</td>
    <td>${fmtDate(r.closed_at)}</td><td>${statusBadge(r.status, map)}</td>
    <td>
      ${r.status === "Open" ? `<button class="btn-xs" onclick="brkAttend('${r.id}')">Attend</button>` : ""}
      ${r.status === "Attended" ? `<button class="btn-xs" onclick="brkResolve('${r.id}')">Resolve</button>` : ""}
      ${r.status === "Resolved" ? `<button class="btn-xs" onclick="brkClose('${r.id}')">Close</button>` : ""}
    </td>
  </tr>`).join("");
}

async function submitBreakdown() {
  const body = {
    unit: document.getElementById("brkUnit").value.trim(),
    customer: document.getElementById("brkCustomer").value.trim(),
    site: document.getElementById("brkSite").value.trim(),
    fault: document.getElementById("brkFault").value.trim(),
    contract_type: document.getElementById("brkWarranty").value,
  };
  if (!body.unit) { showToast("Unit ID is required."); return; }
  const res = await deptPost("/api/portal/breakdown", body);
  if (res) { closeBreakdownModal(); renderBreakdownRows(res.data); }
}

async function brkAttend(id) {
  const res = await deptPatch(`/api/portal/breakdown/${id}`, { action: "attend" });
  if (res) renderBreakdownRows(res.data);
}

async function brkResolve(id) {
  const notes = window.prompt("Resolution notes:");
  const res = await deptPatch(`/api/portal/breakdown/${id}`, { action: "resolve", resolution: notes || "" });
  if (res) renderBreakdownRows(res.data);
}

async function brkClose(id) {
  const res = await deptPatch(`/api/portal/breakdown/${id}`, { action: "close" });
  if (res) renderBreakdownRows(res.data);
}

// ===== Service =====
function openServiceModal() { document.getElementById("serviceModal").style.display = "flex"; }
function closeServiceModal() { document.getElementById("serviceModal").style.display = "none"; }

function renderServiceRows(records) {
  const tbody = document.getElementById("serviceRows");
  if (!tbody) return;
  const map = { "Scheduled": "badge-info", "Completed": "badge-success", "Overdue": "badge-warn" };
  tbody.innerHTML = records.map(r => `<tr>
    <td>${r.id}</td><td>${r.unit || "—"}</td><td>${r.customer || "—"}</td>
    <td>${r.scheduled_date || "—"}</td><td>${r.technician || "—"}</td>
    <td>${statusBadge(r.status, map)}</td><td>${fmtDate(r.completed_at)}</td>
    <td>${r.status !== "Completed" ? `<button class="btn-xs" onclick="svcComplete('${r.id}')">Complete</button>` : ""}</td>
  </tr>`).join("");
}

async function submitService() {
  const body = {
    unit: document.getElementById("svcUnit").value.trim(),
    customer: document.getElementById("svcCustomer").value.trim(),
    scheduled_date: document.getElementById("svcDate").value,
    technician: document.getElementById("svcTech").value.trim(),
    notes: document.getElementById("svcNotes").value.trim(),
  };
  if (!body.unit) { showToast("Unit ID is required."); return; }
  const res = await deptPost("/api/portal/service", body);
  if (res) { closeServiceModal(); renderServiceRows(res.data); }
}

async function svcComplete(id) {
  const notes = window.prompt("Service completion notes:");
  const res = await deptPatch(`/api/portal/service/${id}`, { action: "complete", notes: notes || "" });
  if (res) renderServiceRows(res.data);
}

// ===== GAD =====
function openGADModal() { document.getElementById("gadModal").style.display = "flex"; }
function closeGADModal() { document.getElementById("gadModal").style.display = "none"; }

function renderGADRows(records) {
  const tbody = document.getElementById("gadRows");
  if (!tbody) return;
  const map = { "Pending": "badge-warn", "In Progress": "badge-info", "Submitted": "badge-success", "Revised": "badge-info" };
  tbody.innerHTML = records.map(r => `<tr>
    <td>${r.id}</td><td>${r.ref_type || "—"}</td><td>${r.ref_no || "—"}</td>
    <td>${r.customer || "—"}</td><td>${r.drawing_no || "—"}</td>
    <td>${statusBadge(r.status, map)}</td><td>${fmtDate(r.submitted_at)}</td>
    <td>
      ${r.status !== "Submitted" ? `<button class="btn-xs" onclick="gadSubmit('${r.id}')">Submit</button>` : ""}
      <button class="btn-xs" onclick="gadRevise('${r.id}')">Revise</button>
    </td>
  </tr>`).join("");
}

async function submitGAD() {
  const body = {
    ref_type: document.getElementById("gadRefType").value,
    ref_no: document.getElementById("gadRefNo").value.trim(),
    customer: document.getElementById("gadCustomer").value.trim(),
    drawing_no: document.getElementById("gadDrawingNo").value.trim(),
    notes: document.getElementById("gadNotes").value.trim(),
  };
  if (!body.customer) { showToast("Customer is required."); return; }
  const res = await deptPost("/api/portal/gad", body);
  if (res) { closeGADModal(); renderGADRows(res.data); }
}

async function gadSubmit(id) {
  const res = await deptPatch(`/api/portal/gad/${id}`, { action: "submit" });
  if (res) renderGADRows(res.data);
}

async function gadRevise(id) {
  const notes = window.prompt("Revision notes:");
  const res = await deptPatch(`/api/portal/gad/${id}`, { action: "revise", notes: notes || "" });
  if (res) renderGADRows(res.data);
}

// ===== Commissioning =====
function openCommissioningModal() { document.getElementById("commissioningModal").style.display = "flex"; }
function closeCommissioningModal() { document.getElementById("commissioningModal").style.display = "none"; }

function renderCommissioningRows(records) {
  const tbody = document.getElementById("commissioningRows");
  if (!tbody) return;
  const map = { "Pending": "badge-warn", "In Progress": "badge-info", "Handed Over": "badge-success" };
  tbody.innerHTML = records.map(r => `<tr>
    <td>${r.id}</td><td>${r.customer || "—"}</td><td>${r.unit || "—"}</td>
    <td>${fmtDate(r.start_date)}</td><td>${fmtDate(r.handover_date)}</td>
    <td>${statusBadge(r.status, map)}</td>
    <td>
      ${r.status === "Pending" ? `<button class="btn-xs" onclick="commStart('${r.id}')">Start</button>` : ""}
      ${r.status === "In Progress" ? `<button class="btn-xs" onclick="commHandover('${r.id}')">Handover</button>` : ""}
    </td>
  </tr>`).join("");
}

async function submitCommissioning() {
  const body = {
    customer: document.getElementById("comCustomer").value.trim(),
    unit: document.getElementById("comUnit").value.trim(),
    job_ref: document.getElementById("comJobRef").value.trim(),
    start_date: document.getElementById("comStart").value,
    notes: document.getElementById("comNotes").value.trim(),
  };
  if (!body.customer) { showToast("Customer is required."); return; }
  const res = await deptPost("/api/portal/commissioning", body);
  if (res) { closeCommissioningModal(); renderCommissioningRows(res.data); }
}

async function commStart(id) {
  const res = await deptPatch(`/api/portal/commissioning/${id}`, { action: "start" });
  if (res) renderCommissioningRows(res.data);
}

async function commHandover(id) {
  const res = await deptPatch(`/api/portal/commissioning/${id}`, { action: "handover" });
  if (res) renderCommissioningRows(res.data);
}

// ===== Factory Jobs =====
function openFactoryModal() { document.getElementById("factoryModal").style.display = "flex"; }
function closeFactoryModal() { document.getElementById("factoryModal").style.display = "none"; }

function renderFactoryRows(records) {
  const tbody = document.getElementById("factoryRows");
  if (!tbody) return;
  const map = { "Material Procurement": "badge-warn", "Fabrication": "badge-info", "Assembly": "badge-info", "Testing": "badge-warn", "Ready to Dispatch": "badge-success", "Dispatched": "badge-success" };
  tbody.innerHTML = records.map(r => `<tr>
    <td>${r.id}</td><td>${r.order_ref || "—"}</td><td>${r.customer || "—"}</td>
    <td>${statusBadge(r.stage, map)}</td><td>${(r.materials || "—").substring(0, 40)}${r.materials && r.materials.length > 40 ? "…" : ""}</td>
    <td>${fmtDate(r.dispatched_at)}</td>
    <td>${r.stage !== "Dispatched" ? `<button class="btn-xs" onclick="facDispatch('${r.id}')">Dispatch</button>` : "Dispatched"}</td>
  </tr>`).join("");
}

async function submitFactoryJob() {
  const body = {
    order_ref: document.getElementById("facOrderRef").value.trim(),
    customer: document.getElementById("facCustomer").value.trim(),
    stage: document.getElementById("facStage").value,
    materials: document.getElementById("facMaterials").value.trim(),
    notes: document.getElementById("facNotes").value.trim(),
  };
  if (!body.order_ref) { showToast("Order reference is required."); return; }
  const res = await deptPost("/api/portal/factory", body);
  if (res) { closeFactoryModal(); renderFactoryRows(res.data); }
}

async function facDispatch(id) {
  const res = await deptPatch(`/api/portal/factory/${id}`, { action: "dispatch" });
  if (res) renderFactoryRows(res.data);
}

// ===== Tender =====
function openTenderModal() { document.getElementById("tenderModal").style.display = "flex"; }
function closeTenderModal() { document.getElementById("tenderModal").style.display = "none"; }

function renderTenderRows(records) {
  const tbody = document.getElementById("tenderRows");
  if (!tbody) return;
  const map = { "Submitted": "badge-info", "Won": "badge-success", "Lost": "badge-warn", "Pending": "badge-info" };
  tbody.innerHTML = records.map(r => `<tr>
    <td>${r.id}</td><td>${r.name || "—"}</td><td>${r.party || "—"}</td>
    <td>${r.source || "—"}</td><td>${r.submitted_date || "—"}</td>
    <td>${r.qty || 1}</td><td>₹${Number(r.value || 0).toLocaleString("en-IN")}</td>
    <td>${statusBadge(r.result, map)}</td>
    <td>
      <button class="btn-xs" onclick="tdrResult('${r.id}','Won')">Won</button>
      <button class="btn-xs" onclick="tdrResult('${r.id}','Lost')">Lost</button>
    </td>
  </tr>`).join("");
}

async function submitTender() {
  const body = {
    name: document.getElementById("tdrName").value.trim(),
    party: document.getElementById("tdrParty").value.trim(),
    source: document.getElementById("tdrSource").value,
    submitted_date: document.getElementById("tdrDate").value,
    qty: parseInt(document.getElementById("tdrQty").value, 10) || 1,
    value: parseFloat(document.getElementById("tdrValue").value) || 0,
    notes: document.getElementById("tdrNotes").value.trim(),
  };
  if (!body.name) { showToast("Tender name is required."); return; }
  const res = await deptPost("/api/portal/tender", body);
  if (res) { closeTenderModal(); renderTenderRows(res.data); }
}

async function tdrResult(id, result) {
  const res = await deptPatch(`/api/portal/tender/${id}`, { result });
  if (res) renderTenderRows(res.data);
}

// ===== Department Comms =====
function renderCommsList(msgs) {
  const el = document.getElementById("commsList");
  if (!el) return;
  if (!msgs.length) { el.innerHTML = '<p style="color:var(--muted);font-size:12px">No messages yet.</p>'; return; }
  el.innerHTML = msgs.map(m => `<div class="comms-msg${m.read ? "" : " unread"}">
    <div class="msg-from">${m.from_dept || "System"} → ${(m.to_depts || []).join(", ")} · ${fmtDate(m.sent_at || m.timestamp)}</div>
    <div class="msg-subject">${m.subject || "(no subject)"}</div>
    <div class="msg-body">${m.body || ""}</div>
  </div>`).join("");
}

async function sendCommsMessage() {
  const toDepts = Array.from(document.querySelectorAll('#commsToDepts input[name="toDept"]:checked')).map(el => el.value);
  const body = {
    to_depts: toDepts,
    subject: document.getElementById("commsSubject").value.trim(),
    body: document.getElementById("commsBody").value.trim(),
  };
  if (!toDepts.length) { showToast("Select at least one recipient department."); return; }
  if (!body.body) { showToast("Message body is required."); return; }
  const res = await deptPost("/api/portal/comms", body);
  if (res) {
    document.getElementById("commsSubject").value = "";
    document.getElementById("commsBody").value = "";
    document.querySelectorAll('#commsToDepts input[name="toDept"]').forEach(el => { el.checked = false; });
    renderCommsList(res.data);
  }
}

// Init all department module tables from embedded JSON
(function initDeptModules() {
  renderSalesRows(parseDeptData("salesInquiriesData"));
  renderBreakdownRows(parseDeptData("breakdownsData"));
  renderServiceRows(parseDeptData("serviceRecordsData"));
  renderGADRows(parseDeptData("gadRecordsData"));
  renderCommissioningRows(parseDeptData("commissioningsData"));
  renderFactoryRows(parseDeptData("factoryJobsData"));
  renderTenderRows(parseDeptData("tendersData"));
  renderCommsList(parseDeptData("deptCommsData"));
})();

function viewInstallJob(id) { switchView("installations"); }

function switchView(view) {
  const showAll = view === "overview";
  document.querySelectorAll(".view-section").forEach((section) => {
    const isTarget = section.id === `view-${view}`;
    section.classList.toggle("is-hidden", !(showAll || isTarget));
  });
  document.querySelectorAll(".side-link").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("view", view);
  window.history.replaceState({}, "", nextUrl);
}

searchInput.addEventListener("input", filterRows);
statusFilter.addEventListener("change", filterRows);
refreshBtn.addEventListener("click", refreshFeed);
ticketForm.addEventListener("submit", createTicket);
teamForm.addEventListener("submit", createTeamMember);
customerForm.addEventListener("submit", createCustomer);
accountForm.addEventListener("submit", createAccount);
if (crmQueryForm) crmQueryForm.addEventListener("submit", sendCrmQuery);

ticketRows.addEventListener("click", (event) => {
  const button = event.target.closest(".ticket-save");
  if (button) saveTicket(button);
});

installWorkspace.addEventListener("click", (event) => {
  const button = event.target.closest(".install-stage-save");
  if (button) saveInstallStage(button);
});

teamRows.addEventListener("click", (event) => {
  const button = event.target.closest(".team-save");
  if (button) saveTeamMember(button);
});

customerRows.addEventListener("click", (event) => {
  const button = event.target.closest(".customer-save");
  if (button) saveCustomer(button);
});

accountRows.addEventListener("click", (event) => {
  const button = event.target.closest(".account-save");
  if (button) saveAccount(button);
});

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => {
    postAction(button.dataset.action, button.dataset.target);
  });
});

document.querySelectorAll(".side-link").forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});

const initialView = document.body.dataset.defaultView || "overview";
if (document.querySelector(`.side-link[data-view="${initialView}"]`) || initialView === "overview") {
  switchView(initialView);
}

window.setInterval(() => {
  refreshFeed();
}, 300000);
