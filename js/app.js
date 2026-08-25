import { supabase, configured } from "./supabaseClient.js";
import { signInWithGoogle, signOut, getSession, onAuthChange } from "./auth.js";
import { fetchCalendarEvents, formatEventTime } from "./calendar.js";
import { getPlanItems, addPlanItem, togglePlanItem, deletePlanItem } from "./planItems.js";
import { listNotes, createNote, saveNote, deleteNote, togglePin } from "./notes.js";
import {
  listClients, createClient, updateClientField, deleteClient,
  listClientUpdates, addClientUpdate,
} from "./clients.js";
import {
  listMoodboards, createMoodboard, deleteMoodboard, listMoodboardItems,
  uploadImageAndCreateItem, createTextItem, createShapeItem,
  updateItemPosition, updateItemContent, updateItemColor, deleteItem,
} from "./moodboard.js?v=2";

// ---------------- Config gate ----------------

if (!configured) {
  document.getElementById("config-warning").style.display = "block";
  document.getElementById("config-warning").textContent =
    "This app isn't connected to Supabase yet. Add your project URL and anon key to js/config.js, then reload.";
  document.getElementById("google-signin-btn").disabled = true;
}

let currentUser = null;
let currentSession = null;

// ---------------- Boot / auth wiring ----------------

async function boot() {
  document.getElementById("login-screen").style.display = "flex";

  if (!configured) return;

  currentSession = await getSession();
  applyAuthState(currentSession);

  onAuthChange((session) => {
    currentSession = session;
    applyAuthState(session);
    if (session) refreshActiveView();
  });

  document.getElementById("google-signin-btn").addEventListener("click", signInWithGoogle);
  document.getElementById("signout-btn").addEventListener("click", signOut);
}

function applyAuthState(session) {
  const loggedIn = !!session?.user;
  document.getElementById("login-screen").style.display = loggedIn ? "none" : "flex";
  document.getElementById("app").style.display = loggedIn ? "flex" : "none";
  if (!loggedIn) {
    currentUser = null;
    return;
  }
  currentUser = session.user;
  const meta = currentUser.user_metadata || {};
  document.getElementById("user-avatar").src = meta.avatar_url || "";
  document.getElementById("user-name").textContent = meta.full_name || meta.name || currentUser.email;
  document.getElementById("user-email").textContent = currentUser.email || "";
  document.getElementById("today-heading").textContent = greeting(meta.full_name || meta.name);
}

function greeting(name) {
  const hour = new Date().getHours();
  const first = (name || "").split(" ")[0];
  const time = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return first ? `${time}, ${first}` : time;
}

// ---------------- Navigation ----------------

const views = ["today", "upcoming", "notes", "clients", "moodboards"];

document.querySelectorAll(".nav button").forEach((btn) => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});

let activeView = "today";

function switchView(view) {
  activeView = view;
  document.querySelectorAll(".nav button").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === view)
  );
  views.forEach((v) =>
    document.getElementById(`view-${v}`).classList.toggle("active", v === view)
  );
  refreshActiveView();
}

function refreshActiveView() {
  if (!currentUser) return;
  if (activeView === "today") renderToday();
  if (activeView === "upcoming") renderUpcoming();
  if (activeView === "notes") renderNotes();
  if (activeView === "clients") renderClients();
  if (activeView === "moodboards") renderMoodboards();
}

// ==================================================
// TODAY VIEW
// ==================================================

async function renderToday() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const eventsBox = document.getElementById("today-events");
  eventsBox.innerHTML = `<div class="empty-state">Loading…</div>`;

  const { events, issue } = await fetchCalendarEvents(startOfDay, endOfDay);
  renderCalendarIssue("today-calendar-issue", issue);
  renderEventList(eventsBox, events, "Nothing on your calendar today.");

  const items = await getPlanItems(currentUser.id, startOfDay);
  renderPlanItems(items);

  document.getElementById("today-plan-add").onclick = addTodayPlanItem;
  document.getElementById("today-plan-input").onkeydown = (e) => {
    if (e.key === "Enter") addTodayPlanItem();
  };
}

async function addTodayPlanItem() {
  const input = document.getElementById("today-plan-input");
  const title = input.value.trim();
  if (!title) return;
  input.value = "";
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  await addPlanItem(currentUser.id, startOfDay, title);
  renderToday();
}

function renderPlanItems(items) {
  const box = document.getElementById("today-plan-items");
  if (!items.length) {
    box.innerHTML = `<div class="empty-state">Nothing planned yet — add something below.</div>`;
    return;
  }
  box.innerHTML = "";
  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "plan-row";
    row.innerHTML = `
      <input type="checkbox" ${item.done ? "checked" : ""} />
      <div class="title ${item.done ? "done" : ""}">${escapeHtml(item.title)}</div>
      <button class="del">✕</button>
    `;
    row.querySelector("input").addEventListener("change", async (e) => {
      await togglePlanItem(item.id, e.target.checked);
      row.querySelector(".title").classList.toggle("done", e.target.checked);
    });
    row.querySelector(".del").addEventListener("click", async () => {
      await deletePlanItem(item.id);
      row.remove();
    });
    box.appendChild(row);
  });
}

function renderEventList(container, events, emptyText) {
  if (!events.length) {
    container.innerHTML = `<div class="empty-state">${emptyText}</div>`;
    return;
  }
  container.innerHTML = "";
  events.forEach((event) => {
    const row = document.createElement("div");
    row.className = "event-row";
    row.innerHTML = `
      <div class="event-time">${formatEventTime(event)}</div>
      <div class="event-dot"></div>
      <div class="event-body">
        <div class="title">${escapeHtml(event.title)}</div>
        <div class="meta">${escapeHtml(event.location || (event.isMeeting ? "Meeting" : ""))}</div>
        ${event.hangoutLink ? `<a class="meet-link" href="${event.hangoutLink}" target="_blank" rel="noopener">Join / view →</a>` : ""}
      </div>
    `;
    container.appendChild(row);
  });
}

function renderCalendarIssue(elId, issue) {
  const el = document.getElementById(elId);
  if (!issue) {
    el.innerHTML = "";
    return;
  }
  if (issue === "not_connected") {
    el.innerHTML = `<div class="calendar-issue">Google Calendar isn't connected yet. <button id="reconnect-${elId}">Connect it</button></div>`;
  } else if (issue === "expired") {
    el.innerHTML = `<div class="calendar-issue">Your Google Calendar connection expired. <button id="reconnect-${elId}">Reconnect</button></div>`;
  } else {
    el.innerHTML = `<div class="calendar-issue">Couldn't load your calendar right now.</div>`;
  }
  const btn = document.getElementById(`reconnect-${elId}`);
  if (btn) btn.addEventListener("click", signInWithGoogle);
}

// ==================================================
// UPCOMING VIEW
// ==================================================

async function renderUpcoming() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);

  const box = document.getElementById("upcoming-list");
  box.innerHTML = `<div class="empty-state">Loading…</div>`;

  const { events, issue } = await fetchCalendarEvents(start, end);
  renderCalendarIssue("upcoming-calendar-issue", issue);

  if (!events.length) {
    box.innerHTML = `<div class="empty-state">Nothing on the horizon for the next two weeks.</div>`;
    return;
  }

  const byDay = new Map();
  events.forEach((event) => {
    const key = event.start.toDateString();
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(event);
  });

  box.innerHTML = "";
  for (const [dayKey, dayEvents] of byDay.entries()) {
    const group = document.createElement("div");
    group.className = "day-group";
    const dayDate = dayEvents[0].start;
    const isToday = dayDate.toDateString() === now.toDateString();
    group.innerHTML = `<h3>${dayDate.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })} ${isToday ? '<span class="sub">Today</span>' : ""}</h3>`;
    const list = document.createElement("div");
    renderEventList(list, dayEvents, "");
    group.appendChild(list);
    box.appendChild(group);
  }
}

// ==================================================
// NOTES VIEW
// ==================================================

let notesCache = [];
let openNoteId = null;

async function renderNotes() {
  const grid = document.getElementById("notes-grid");
  grid.innerHTML = `<div class="empty-state">Loading…</div>`;
  notesCache = await listNotes(currentUser.id);

  if (!notesCache.length) {
    grid.innerHTML = `<div class="empty-state">No notes yet — create your first one.</div>`;
  } else {
    grid.innerHTML = "";
    notesCache.forEach((note) => {
      const card = document.createElement("div");
      card.className = "note-card";
      card.innerHTML = `
        <div class="title">${escapeHtml(note.title || "Untitled note")}</div>
        <div class="preview">${escapeHtml(note.content || "")}</div>
        <div class="footer">
          <span>${new Date(note.updated_at).toLocaleDateString()}</span>
          <button class="pin" title="Pin">${note.pinned ? "📌" : "📍"}</button>
        </div>
      `;
      card.addEventListener("click", (e) => {
        if (e.target.closest(".pin")) return;
        openNoteEditor(note.id);
      });
      card.querySelector(".pin").addEventListener("click", async (e) => {
        e.stopPropagation();
        await togglePin(note.id, !note.pinned);
        renderNotes();
      });
      grid.appendChild(card);
    });
  }
}

document.getElementById("new-note-btn").addEventListener("click", async () => {
  const note = await createNote(currentUser.id);
  if (note) {
    notesCache.unshift(note);
    openNoteEditor(note.id);
  }
});

function openNoteEditor(id) {
  const note = notesCache.find((n) => n.id === id);
  if (!note) return;
  openNoteId = id;
  document.getElementById("note-title-input").value = note.title;
  document.getElementById("note-content-input").value = note.content;
  document.getElementById("note-editor-overlay").style.display = "flex";
  document.getElementById("note-title-input").focus();
}

async function closeNoteEditor() {
  if (openNoteId) {
    const title = document.getElementById("note-title-input").value.trim() || "Untitled note";
    const content = document.getElementById("note-content-input").value;
    await saveNote(openNoteId, { title, content });
  }
  openNoteId = null;
  document.getElementById("note-editor-overlay").style.display = "none";
  renderNotes();
}

document.getElementById("note-close-btn").addEventListener("click", closeNoteEditor);
document.getElementById("note-editor-overlay").addEventListener("click", (e) => {
  if (e.target.id === "note-editor-overlay") closeNoteEditor();
});
document.getElementById("note-delete-btn").addEventListener("click", async () => {
  if (!openNoteId) return;
  if (!confirm("Delete this note?")) return;
  await deleteNote(openNoteId);
  openNoteId = null;
  document.getElementById("note-editor-overlay").style.display = "none";
  renderNotes();
});

// ==================================================
// CLIENTS VIEW
// ==================================================

let clientsCache = [];
let openClientId = null;

const CLIENT_FIELD_DEFS = [
  { key: "email", label: "Email", kind: "email" },
  { key: "phone", label: "Phone", kind: "phone" },
  { key: "address", label: "Address", kind: "text" },
  { key: "city", label: "City", kind: "text" },
  { key: "state", label: "State", kind: "text" },
  { key: "postal_code", label: "Postal code", kind: "text" },
];

async function renderClients() {
  const list = document.getElementById("clients-list");
  list.innerHTML = `<div class="empty-state">Loading…</div>`;
  clientsCache = await listClients(currentUser.id);
  renderClientsList(document.getElementById("client-search-input").value);
}

document.getElementById("client-search-input").addEventListener("input", (e) => {
  renderClientsList(e.target.value);
});

function renderClientsList(query) {
  const list = document.getElementById("clients-list");
  const q = (query || "").trim().toLowerCase();

  const filtered = !q
    ? clientsCache
    : clientsCache.filter((c) => {
        const first = (c.first_name || "").toLowerCase();
        const last = (c.last_name || "").toLowerCase();
        const full = `${first} ${last}`.trim();
        return (
          first.includes(q) ||
          last.includes(q) ||
          full.includes(q) ||
          String(c.client_number).includes(q)
        );
      });

  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state">${
      clientsCache.length ? "No clients match your search." : "No clients yet — add your first one."
    }</div>`;
    return;
  }

  list.innerHTML = "";
  filtered.forEach((client) => {
    const row = document.createElement("div");
    row.className = "client-row";
    row.innerHTML = `
      <span class="client-row-id">#${client.client_number}</span>
      <span class="client-row-name">${escapeHtml(client.first_name)} ${escapeHtml(client.last_name)}</span>
    `;
    row.addEventListener("click", () => openClientDetail(client.id));
    list.appendChild(row);
  });
}

document.getElementById("new-client-btn").addEventListener("click", () => {
  const form = document.getElementById("new-client-form");
  const showing = form.style.display !== "none";
  form.style.display = showing ? "none" : "flex";
  if (!showing) document.getElementById("new-client-first").focus();
});

document.getElementById("new-client-cancel").addEventListener("click", () => {
  document.getElementById("new-client-form").style.display = "none";
  document.getElementById("new-client-first").value = "";
  document.getElementById("new-client-last").value = "";
});

async function submitNewClient() {
  const firstInput = document.getElementById("new-client-first");
  const lastInput = document.getElementById("new-client-last");
  const first = firstInput.value.trim();
  const last = lastInput.value.trim();
  if (!first || !last) {
    alert("Please enter both a first and last name.");
    return;
  }
  const client = await createClient(currentUser.id, first, last);
  if (client) {
    clientsCache.push(client);
    firstInput.value = "";
    lastInput.value = "";
    document.getElementById("new-client-form").style.display = "none";
    renderClientsList(document.getElementById("client-search-input").value);
  }
}

document.getElementById("new-client-save").addEventListener("click", submitNewClient);
document.getElementById("new-client-first").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    document.getElementById("new-client-last").focus();
  }
});
document.getElementById("new-client-last").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    submitNewClient();
  }
});

async function openClientDetail(id) {
  const client = clientsCache.find((c) => c.id === id);
  if (!client) return;
  openClientId = id;
  document.getElementById("client-detail-name").textContent = `${client.first_name} ${client.last_name}`;
  document.getElementById("client-detail-number").textContent = `Client #${client.client_number}`;
  renderClientFields(client);
  document.getElementById("client-update-input").value = "";
  document.getElementById("client-detail-overlay").style.display = "flex";
  await renderClientUpdates(id);
}

function closeClientDetail() {
  openClientId = null;
  document.getElementById("client-detail-overlay").style.display = "none";
}

document.getElementById("client-detail-close").addEventListener("click", closeClientDetail);
document.getElementById("client-detail-overlay").addEventListener("click", (e) => {
  if (e.target.id === "client-detail-overlay") closeClientDetail();
});

document.getElementById("client-delete-btn").addEventListener("click", async () => {
  if (!openClientId) return;
  const client = clientsCache.find((c) => c.id === openClientId);
  if (!client) return;
  if (!confirm(`Delete ${client.first_name} ${client.last_name}? This also removes their updates.`)) return;
  await deleteClient(openClientId);
  clientsCache = clientsCache.filter((c) => c.id !== openClientId);
  closeClientDetail();
  renderClientsList(document.getElementById("client-search-input").value);
});

function renderClientFields(client) {
  const box = document.getElementById("client-detail-fields");
  box.innerHTML = "";
  CLIENT_FIELD_DEFS.forEach((def) => {
    const row = document.createElement("div");
    row.className = "client-field-row";
    box.appendChild(row);
    renderFieldView(row, client, def);
  });
}

function renderFieldView(row, client, def) {
  const value = client[def.key] || "";
  let valueHtml;
  if (!value) {
    valueHtml = `<span class="client-field-empty">Not set</span>`;
  } else if (def.kind === "email") {
    const gmailUrl = "https://mail.google.com/mail/?view=cm&fs=1&to=" + encodeURIComponent(value);
    valueHtml = `<a href="${gmailUrl}" target="_blank" rel="noopener" class="client-field-link">${escapeHtml(value)}</a>`;
  } else if (def.kind === "phone") {
    valueHtml = `<a href="tel:${encodeURIComponent(value)}" class="client-field-link">${escapeHtml(value)}</a>`;
  } else {
    valueHtml = `<span>${escapeHtml(value)}</span>`;
  }
  row.innerHTML = `
    <div class="client-field-label">${def.label}</div>
    <div class="client-field-value">${valueHtml}</div>
    <button class="client-field-edit" title="Edit ${def.label}">✎</button>
  `;
  row.querySelector(".client-field-edit").addEventListener("click", () => renderFieldEdit(row, client, def));
}

function renderFieldEdit(row, client, def) {
  row.innerHTML = `
    <div class="client-field-label">${def.label}</div>
    <input type="text" class="client-field-input" />
    <button class="client-field-save">Save</button>
  `;
  const input = row.querySelector(".client-field-input");
  input.value = client[def.key] || "";
  input.focus();
  input.select();

  const save = async () => {
    const newValue = input.value.trim();
    client[def.key] = newValue;
    await updateClientField(client.id, def.key, newValue);
    renderFieldView(row, client, def);
  };

  row.querySelector(".client-field-save").addEventListener("click", save);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    }
    if (e.key === "Escape") renderFieldView(row, client, def);
  });
}

async function renderClientUpdates(clientId) {
  const box = document.getElementById("client-updates-list");
  box.innerHTML = `<div class="empty-state">Loading…</div>`;
  const updates = await listClientUpdates(clientId);
  if (!updates.length) {
    box.innerHTML = `<div class="empty-state">No updates yet.</div>`;
    return;
  }
  box.innerHTML = "";
  updates.forEach((u) => {
    const row = document.createElement("div");
    row.className = "client-update-row";
    row.innerHTML = `
      <div class="client-update-meta">${new Date(u.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</div>
      <div class="client-update-body">${escapeHtml(u.body)}</div>
    `;
    box.appendChild(row);
  });
}

async function sendClientUpdate() {
  const input = document.getElementById("client-update-input");
  const body = input.value.trim();
  if (!body || !openClientId) return;
  input.value = "";
  await addClientUpdate(currentUser.id, openClientId, body);
  await renderClientUpdates(openClientId);
}

document.getElementById("client-update-send").addEventListener("click", sendClientUpdate);
document.getElementById("client-update-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    sendClientUpdate();
  }
});

// ==================================================
// MOODBOARDS VIEW
// ==================================================

let boardsCache = [];
let activeBoardId = null;

async function renderMoodboards() {
  boardsCache = await listMoodboards(currentUser.id);

  if (!boardsCache.length) {
    const board = await createMoodboard(currentUser.id, "My moodboard");
    if (board) boardsCache = [board];
  }

  if (!activeBoardId || !boardsCache.find((b) => b.id === activeBoardId)) {
    activeBoardId = boardsCache[0]?.id || null;
  }

  renderBoardTabs();
  await renderBoardCanvas();
}

function renderBoardTabs() {
  const tabs = document.getElementById("board-tabs");
  tabs.innerHTML = "";
  boardsCache.forEach((board) => {
    const tab = document.createElement("div");
    tab.className = "board-tab-item" + (board.id === activeBoardId ? " active" : "");
    tab.innerHTML = `
      <span class="board-tab-label">${escapeHtml(board.name)}</span>
      <button class="board-tab-delete" title="Delete this moodboard">✕</button>
    `;
    tab.querySelector(".board-tab-label").addEventListener("click", () => {
      activeBoardId = board.id;
      renderBoardTabs();
      renderBoardCanvas();
    });
    tab.querySelector(".board-tab-delete").addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm(`Delete "${board.name}"? This removes everything on it.`)) return;
      await deleteMoodboard(board.id);
      boardsCache = boardsCache.filter((b) => b.id !== board.id);
      if (activeBoardId === board.id) {
        activeBoardId = boardsCache[0]?.id || null;
      }
      if (!boardsCache.length) {
        const fresh = await createMoodboard(currentUser.id, "My moodboard");
        if (fresh) {
          boardsCache = [fresh];
          activeBoardId = fresh.id;
        }
      }
      renderBoardTabs();
      renderBoardCanvas();
    });
    tabs.appendChild(tab);
  });
}

document.getElementById("new-board-btn").addEventListener("click", async () => {
  const name = prompt("Name your moodboard", "New moodboard");
  if (name === null) return;
  const board = await createMoodboard(currentUser.id, name);
  if (board) {
    boardsCache.push(board);
    activeBoardId = board.id;
    renderBoardTabs();
    renderBoardCanvas();
  }
});

document.getElementById("image-input").addEventListener("change", async (e) => {
  const files = Array.from(e.target.files || []);
  e.target.value = "";
  if (!activeBoardId || !files.length) return;
  for (const file of files) {
    const x = 30 + Math.random() * 120;
    const y = 30 + Math.random() * 80;
    await uploadImageAndCreateItem(currentUser.id, activeBoardId, file, { x, y });
  }
  renderBoardCanvas();
});

function randomBoardPosition() {
  return { x: 30 + Math.random() * 120, y: 30 + Math.random() * 80 };
}

document.getElementById("add-text-btn").addEventListener("click", async () => {
  if (!activeBoardId) return;
  const item = await createTextItem(currentUser.id, activeBoardId, randomBoardPosition());
  if (item) renderBoardCanvas();
});

document.getElementById("add-box-btn").addEventListener("click", async () => {
  if (!activeBoardId) return;
  const item = await createShapeItem(currentUser.id, activeBoardId, "box", randomBoardPosition());
  if (item) renderBoardCanvas();
});

document.getElementById("add-line-btn").addEventListener("click", async () => {
  if (!activeBoardId) return;
  const item = await createShapeItem(currentUser.id, activeBoardId, "line", randomBoardPosition());
  if (item) renderBoardCanvas();
});

document.getElementById("add-arrow-btn").addEventListener("click", async () => {
  if (!activeBoardId) return;
  const item = await createShapeItem(currentUser.id, activeBoardId, "arrow", randomBoardPosition());
  if (item) renderBoardCanvas();
});

async function renderBoardCanvas() {
  const canvas = document.getElementById("board-canvas");
  canvas.innerHTML = "";
  if (!activeBoardId) return;

  const items = await listMoodboardItems(activeBoardId);
  const hint = document.getElementById("empty-board-hint") || document.createElement("div");
  if (!items.length) {
    canvas.innerHTML = `<div class="empty-board-hint">Add an image to get started</div>`;
    return;
  }

  items.forEach((item) => mountMoodboardItem(canvas, item));
}

function mountMoodboardItem(canvas, item) {
  const type = item.item_type || "image";
  const color = item.color || "#d97757";

  const el = document.createElement("div");
  el.className = "moodboard-item item-" + type;
  el.style.left = item.x + "px";
  el.style.top = item.y + "px";
  el.style.width = item.width + "px";
  el.style.height = item.height + "px";
  el.style.transform = `rotate(${item.rotation || 0}deg)`;
  el.style.zIndex = item.z_index || 1;
  el.style.setProperty("--item-color", color);

  let inner = "";
  if (type === "image") {
    inner = `<img src="${item.url}" alt="" draggable="false" />`;
  } else if (type === "text") {
    inner = `<div class="text-content" style="color:${color}">${escapeHtml(item.content || "Double-click to edit")}</div>`;
  }
  el.innerHTML = `
    ${inner}
    <button class="item-color" title="Change color"></button>
    <input type="color" class="color-input" value="${toHexColor(color)}" />
    <button class="item-remove">✕</button>
    <div class="resize-handle"></div>
  `;
  canvas.appendChild(el);

  el.querySelector(".item-remove").addEventListener("click", async (e) => {
    e.stopPropagation();
    await deleteItem(item.id, item.image_path);
    el.remove();
  });

  const colorBtn = el.querySelector(".item-color");
  const colorInput = el.querySelector(".color-input");
  colorBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    colorInput.click();
  });
  colorInput.addEventListener("click", (e) => e.stopPropagation());
  colorInput.addEventListener("input", (e) => {
    const newColor = e.target.value;
    el.style.setProperty("--item-color", newColor);
    const textEl = el.querySelector(".text-content");
    if (textEl) textEl.style.color = newColor;
  });
  colorInput.addEventListener("change", async (e) => {
    await updateItemColor(item.id, e.target.value);
  });

  el.addEventListener("pointerdown", () => {
    document.querySelectorAll(".moodboard-item.selected").forEach((n) => n.classList.remove("selected"));
    el.classList.add("selected");
  });

  if (type === "text") {
    const textEl = el.querySelector(".text-content");
    textEl.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      textEl.setAttribute("contenteditable", "true");
      el.classList.add("editing");
      textEl.focus();
      document.execCommand("selectAll", false, null);
    });
    textEl.addEventListener("blur", async () => {
      textEl.removeAttribute("contenteditable");
      el.classList.remove("editing");
      const content = textEl.textContent.trim() || "Double-click to edit";
      textEl.textContent = content;
      await updateItemContent(item.id, content);
    });
    textEl.addEventListener("keydown", (e) => {
      if (e.key === "Escape") textEl.blur();
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        textEl.blur();
      }
    });
  }

  makeDraggable(el, item, canvas);
  makeResizable(el, item, canvas);
}

function toHexColor(color) {
  // <input type="color"> requires a #rrggbb value; fall back to the accent color.
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#d97757";
}

function makeDraggable(el, item, canvas) {
  let dragging = false;
  let startX, startY, origX, origY;

  el.addEventListener("pointerdown", (e) => {
    if (
      e.target.classList.contains("resize-handle") ||
      e.target.classList.contains("item-remove") ||
      e.target.classList.contains("item-color") ||
      e.target.classList.contains("color-input")
    ) return;
    if (el.classList.contains("editing")) return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    origX = parseFloat(el.style.left);
    origY = parseFloat(el.style.top);
    el.setPointerCapture(e.pointerId);
  });

  el.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const canvasRect = canvas.getBoundingClientRect();
    let newX = origX + (e.clientX - startX);
    let newY = origY + (e.clientY - startY);
    newX = Math.max(0, Math.min(newX, canvasRect.width - el.offsetWidth));
    newY = Math.max(0, Math.min(newY, canvasRect.height - el.offsetHeight));
    el.style.left = newX + "px";
    el.style.top = newY + "px";
  });

  el.addEventListener("pointerup", async () => {
    if (!dragging) return;
    dragging = false;
    await updateItemPosition(item.id, {
      x: parseFloat(el.style.left),
      y: parseFloat(el.style.top),
    });
  });
}

function makeResizable(el, item, canvas) {
  const handle = el.querySelector(".resize-handle");
  let resizing = false;
  let startX, startY, origW, origH;

  handle.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    resizing = true;
    startX = e.clientX;
    startY = e.clientY;
    origW = el.offsetWidth;
    origH = el.offsetHeight;
    handle.setPointerCapture(e.pointerId);
  });

  handle.addEventListener("pointermove", (e) => {
    if (!resizing) return;
    const newW = Math.max(60, origW + (e.clientX - startX));
    const newH = Math.max(60, origH + (e.clientY - startY));
    el.style.width = newW + "px";
    el.style.height = newH + "px";
  });

  handle.addEventListener("pointerup", async () => {
    if (!resizing) return;
    resizing = false;
    await updateItemPosition(item.id, {
      width: parseFloat(el.style.width),
      height: parseFloat(el.style.height),
    });
  });
}

// ---------------- Utilities ----------------

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

boot();
