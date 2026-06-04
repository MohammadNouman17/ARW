const state = {
  people: [],
  saving: false,
  lastLoadedAt: null,
};

const els = {
  form: document.getElementById("add-form"),
  name: document.getElementById("inp-name"),
  mobile: document.getElementById("inp-mobile"),
  loc: document.getElementById("inp-loc"),
  cans: document.getElementById("inp-cans"),
  search: document.getElementById("inp-search"),
  refresh: document.getElementById("btn-refresh"),
  export: document.getElementById("btn-export"),
  list: document.getElementById("person-list"),
  listCount: document.getElementById("list-count"),
  statPeople: document.getElementById("stat-people"),
  statCans: document.getElementById("stat-cans"),
  sync: document.getElementById("sync-state"),
  toast: document.getElementById("toast"),
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}

function initials(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 1800);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

function updateStats() {
  const totalCans = state.people.reduce((sum, person) => sum + Number(person.cans || 0), 0);
  els.statPeople.textContent = state.people.length;
  els.statCans.textContent = totalCans;
}

function render() {
  const query = els.search.value.trim().toLowerCase();
  const filtered = state.people.filter((person) => {
    return person.name.toLowerCase().includes(query)
      || (person.mobile || "").toLowerCase().includes(query)
      || (person.loc || "").toLowerCase().includes(query);
  });

  updateStats();
  els.listCount.textContent = `People (${filtered.length})`;

  if (filtered.length === 0) {
    els.list.innerHTML = `<div class="empty">${state.people.length === 0 ? "No people added yet." : "No results found."}</div>`;
    return;
  }

  els.list.innerHTML = filtered.map((person) => {
    const id = Number(person.id);
    const name = escapeHtml(person.name);
    const mobile = escapeHtml(person.mobile || "");
    const mobileHref = escapeHtml(String(person.mobile || "").replace(/[^\d+]/g, ""));
    const loc = escapeHtml(person.loc || "No location");
    const cans = Number(person.cans || 0);
    return `
      <article class="person-card" data-id="${id}">
        <div class="person-top">
          <div class="avatar" aria-hidden="true">${escapeHtml(initials(person.name))}</div>
          <div>
            <div class="person-name">${name}</div>
            ${mobile ? `<a class="person-mobile" href="tel:${mobileHref}">${mobile}</a>` : ""}
            <div class="person-loc">${loc}</div>
          </div>
          <div class="can-badge">
            <div class="can-count">${cans}</div>
            <div class="can-lbl">can${cans === 1 ? "" : "s"}</div>
          </div>
        </div>
        <div class="actions">
          <button class="btn-ctrl" type="button" data-action="decrease" aria-label="Remove one can from ${name}">-</button>
          <input class="qty-input" type="number" min="0" inputmode="numeric" value="${cans}" data-action="set" aria-label="Can count for ${name}">
          <button class="btn-ctrl" type="button" data-action="increase" aria-label="Add one can to ${name}">+</button>
          <button class="btn-ctrl danger" type="button" data-action="delete" aria-label="Delete ${name}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v1.6H4V5h4l1-2Zm-2.5 5h11l-.7 12H7.2L6.5 8Zm2.1 1.6.5 8.8h5.8l.5-8.8H8.6Z"/></svg>
          </button>
        </div>
      </article>
    `;
  }).join("");
}

async function loadPeople({ quiet = false } = {}) {
  try {
    if (!quiet) els.sync.textContent = "Syncing with database...";
    const data = await api("/api/people");
    state.people = data.people || [];
    state.lastLoadedAt = new Date();
    els.sync.textContent = "Synced across devices";
    render();
  } catch (error) {
    els.sync.textContent = "Database connection failed";
    els.list.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
  }
}

async function addPerson(event) {
  event.preventDefault();
  const name = els.name.value.trim();
  const mobile = els.mobile.value.trim();
  const loc = els.loc.value.trim();
  const cans = Math.max(0, Number.parseInt(els.cans.value || "0", 10) || 0);
  if (!name) {
    els.name.focus();
    return;
  }
  const button = els.form.querySelector("button");
  button.disabled = true;
  try {
    const data = await api("/api/people", {
      method: "POST",
      body: JSON.stringify({ name, mobile, loc, cans }),
    });
    state.people.push(data.person);
    state.people.sort((a, b) => a.name.localeCompare(b.name));
    els.form.reset();
    els.name.focus();
    render();
    showToast(`Added ${name}`);
  } catch (error) {
    showToast(error.message);
  } finally {
    button.disabled = false;
  }
}

async function updatePerson(id, patch, message) {
  const original = state.people.map((person) => ({ ...person }));
  state.people = state.people.map((person) => person.id === id ? { ...person, ...patch } : person);
  render();
  try {
    const data = await api(`/api/people/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    state.people = state.people.map((person) => person.id === id ? data.person : person);
    render();
    if (message) showToast(message);
  } catch (error) {
    state.people = original;
    render();
    showToast(error.message);
  }
}

async function deletePerson(id) {
  const person = state.people.find((item) => item.id === id);
  if (!person) return;
  if (!confirm(`Delete ${person.name}?`)) return;
  const original = state.people;
  state.people = state.people.filter((item) => item.id !== id);
  render();
  try {
    await api(`/api/people/${id}`, { method: "DELETE" });
    showToast(`Deleted ${person.name}`);
  } catch (error) {
    state.people = original;
    render();
    showToast(error.message);
  }
}

function exportCsv() {
  const header = ["Name", "Mobile", "Location", "Cans"];
  const rows = state.people.map((person) => [person.name, person.mobile || "", person.loc || "", person.cans]);
  const csv = [header, ...rows]
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `water-can-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

els.form.addEventListener("submit", addPerson);
els.search.addEventListener("input", render);
els.refresh.addEventListener("click", () => loadPeople());
els.export.addEventListener("click", exportCsv);

els.list.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const card = button.closest(".person-card");
  const id = Number(card?.dataset.id);
  const person = state.people.find((item) => item.id === id);
  if (!person) return;
  if (button.dataset.action === "increase") {
    updatePerson(id, { cans: Number(person.cans || 0) + 1 });
  }
  if (button.dataset.action === "decrease") {
    updatePerson(id, { cans: Math.max(0, Number(person.cans || 0) - 1) });
  }
  if (button.dataset.action === "delete") {
    deletePerson(id);
  }
});

els.list.addEventListener("change", (event) => {
  if (event.target.dataset.action !== "set") return;
  const card = event.target.closest(".person-card");
  const id = Number(card?.dataset.id);
  const cans = Math.max(0, Number.parseInt(event.target.value || "0", 10) || 0);
  updatePerson(id, { cans });
});

window.addEventListener("focus", () => loadPeople({ quiet: true }));
setInterval(() => loadPeople({ quiet: true }), 15000);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

loadPeople();
