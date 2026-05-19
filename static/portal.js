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
  showToast(data.message);
}

async function refreshFeed() {
  refreshBtn.disabled = true;
  refreshBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Refreshing';

  try {
    const response = await fetch("/api/portal/data");
    const data = await response.json();
    syncTime.textContent = data.synced_at;
    showToast("Portal data refreshed.");
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
  return `${account.id} ${account.username} ${account.display_name} ${account.role} ${account.linked_team_member || ""}`;
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
  document.getElementById("accountRole").value = "technician";
  document.getElementById("accountMember").value = "";
  filterRows();
  showToast(data.message);
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
}

function switchView(view) {
  const showAll = view === "overview";
  document.querySelectorAll(".view-section").forEach((section) => {
    const isTarget = section.id === `view-${view}`;
    section.classList.toggle("is-hidden", !(showAll || isTarget));
  });
  document.querySelectorAll(".side-link").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
}

searchInput.addEventListener("input", filterRows);
statusFilter.addEventListener("change", filterRows);
refreshBtn.addEventListener("click", refreshFeed);
ticketForm.addEventListener("submit", createTicket);
teamForm.addEventListener("submit", createTeamMember);
customerForm.addEventListener("submit", createCustomer);
accountForm.addEventListener("submit", createAccount);

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
