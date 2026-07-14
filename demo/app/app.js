import {
  load,
  reset,
  saveState,
  statusOf,
  daysLeft,
  daysToGraceEnd,
  dashboardStats,
  recordScan,
  renewMember,
  addMember,
  toggleSuspend,
  deleteMember,
  attendanceWithMembers,
  last7DaysAttendance,
} from "./data.js";

let state = load();

// ---- Toast helper ----

function toast({ title, body, tone = "success", ttlMs = 4000 }) {
  const el = document.createElement("div");
  el.className = `toast toast-${tone}`;
  el.innerHTML = `<div class="toast-title"></div><div class="toast-body"></div>`;
  el.querySelector(".toast-title").textContent = title;
  el.querySelector(".toast-body").textContent = body;
  document.getElementById("toasts").appendChild(el);
  setTimeout(() => el.remove(), ttlMs);
}

// ---- Escape helper (prevent XSS from mock names) ----
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ---- Currency + date formatters ----
const FMT_MONEY = new Intl.NumberFormat(undefined, { style: "currency", currency: "PKR", maximumFractionDigits: 0 });
function fmtMoney(n) { return FMT_MONEY.format(n); }
function fmtDate(iso) { return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }); }
function fmtTime(iso) { return new Date(iso).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }

// ---- Views ----

function viewDashboard() {
  const stats = dashboardStats(state);
  const chartData = last7DaysAttendance(state);
  const chartMax = Math.max(1, ...chartData.map((d) => d.count));
  const recent = attendanceWithMembers(state, 10);
  return `
    <div class="page-header">
      <div>
        <h1>Dashboard</h1>
        <p>Live overview of members, packages, and scans.</p>
      </div>
    </div>
    <div class="grid grid-4">
      <div class="stat"><div class="stat-label">Total members</div><div class="stat-value">${stats.total}</div></div>
      <div class="stat stat-success"><div class="stat-label">Active</div><div class="stat-value">${stats.active}</div></div>
      <div class="stat stat-warning"><div class="stat-label">In grace</div><div class="stat-value">${stats.grace}</div></div>
      <div class="stat stat-danger"><div class="stat-label">Expired</div><div class="stat-value">${stats.expired}</div></div>
      <div class="stat"><div class="stat-label">Suspended</div><div class="stat-value">${stats.suspended}</div></div>
      <div class="stat"><div class="stat-label">Scans today</div><div class="stat-value">${stats.todayScans}</div></div>
      <div class="stat"><div class="stat-label">Revenue (all-time)</div><div class="stat-value">${fmtMoney(stats.totalRevenue)}</div></div>
      <div class="stat"><div class="stat-label">Packages</div><div class="stat-value">${state.packages.length}</div></div>
    </div>
    <div class="card" style="margin-top:20px">
      <h2>Attendance — last 7 days</h2>
      <div class="bar-chart">
        ${chartData.map((d) => `
          <div class="bar">
            <div class="bar-value">${d.count}</div>
            <div class="bar-fill" style="height:${(d.count / chartMax) * 100}%"></div>
            <div class="bar-label">${esc(d.label)}</div>
          </div>
        `).join("")}
      </div>
    </div>
    <div class="card" style="margin-top:20px">
      <div class="hstack" style="margin-bottom:12px">
        <h2 style="margin:0">Recent scans</h2>
        <div class="spacer"></div>
        <a href="#/attendance" class="btn btn-sm">View all →</a>
      </div>
      ${recent.length === 0 ? `<div class="empty-state">No scans yet. Go to Scanner and simulate one.</div>` : `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Time</th><th>Member</th><th>Code</th><th>Result</th></tr></thead>
          <tbody>${recent.map((r) => `
            <tr>
              <td>${fmtTime(r.at)}</td>
              <td>${esc(r.memberName)}</td>
              <td class="text-muted">${esc(r.memberCode)}</td>
              <td><span class="badge badge-${r.result === "ALLOWED" ? "allowed" : "denied"}">${r.result}</span></td>
            </tr>
          `).join("")}</tbody>
        </table>
      </div>`}
    </div>
  `;
}

function renderStatusBadge(status) {
  return `<span class="badge badge-${status.toLowerCase()}">${status}</span>`;
}

function viewMembers() {
  const rows = state.members.map((m) => {
    const s = statusOf(m);
    return { ...m, computedStatus: s };
  });
  return `
    <div class="page-header">
      <div>
        <h1>Members</h1>
        <p>${state.members.length} members registered.</p>
      </div>
      <div class="hstack">
        <input id="q" placeholder="Search name, phone, code…" class="btn" style="min-width:220px" />
        <button class="btn btn-primary" data-action="new-member">+ New member</button>
      </div>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Package</th>
              <th>Expires</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="member-rows">
            ${rows.map((m) => `
              <tr data-member-id="${m.id}">
                <td class="text-muted">${esc(m.code)}</td>
                <td><a href="#/members/${m.id}">${esc(m.name)}</a></td>
                <td>${esc(m.phone)}</td>
                <td>${esc(m.package)}</td>
                <td>${fmtDate(m.endDate)}</td>
                <td>${renderStatusBadge(m.computedStatus)}</td>
                <td class="row-actions">
                  <a href="#/members/${m.id}" class="btn btn-sm">View</a>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function viewMemberDetail(id) {
  const m = state.members.find((x) => x.id === Number(id));
  if (!m) return `<div class="empty-state">Member not found. <a href="#/members">Back to list</a></div>`;
  const s = statusOf(m);
  const daysMsg = s === "ACTIVE" ? `${daysLeft(m)} days left`
    : s === "GRACE" ? `${daysToGraceEnd(m)} days to renew`
    : s === "EXPIRED" ? "Access denied - renewal required"
    : "Member is suspended";
  const memberScans = attendanceWithMembers(state).filter((a) => a.memberId === m.id).slice(0, 10);
  const pkgOpts = state.packages.map((p) => `<option value="${esc(p.name)}">${esc(p.name)} — ${fmtMoney(p.price)}</option>`).join("");
  return `
    <div class="page-header">
      <div>
        <h1>${esc(m.name)}</h1>
        <p>${esc(m.code)} · ${esc(m.phone)}</p>
      </div>
      <div class="hstack">
        <a href="#/members" class="btn btn-sm">← Back</a>
      </div>
    </div>
    <div class="grid grid-3">
      <div class="stat"><div class="stat-label">Status</div><div class="stat-value">${renderStatusBadge(s)}</div><div class="stat-sub">${daysMsg}</div></div>
      <div class="stat"><div class="stat-label">Package</div><div class="stat-value" style="font-size:18px">${esc(m.package)}</div><div class="stat-sub">${fmtDate(m.startDate)} → ${fmtDate(m.endDate)}</div></div>
      <div class="stat"><div class="stat-label">Paid</div><div class="stat-value">${fmtMoney(m.paid)}</div></div>
    </div>
    <div class="card" style="margin-top:20px">
      <h2>Actions</h2>
      <div class="hstack" style="flex-wrap:wrap;gap:8px">
        <button class="btn btn-primary" data-action="renew" data-member-id="${m.id}">Renew package</button>
        <button class="btn" data-action="scan" data-member-id="${m.id}">Simulate scan</button>
        <button class="btn ${m.status === "SUSPENDED" ? "btn-primary" : ""}" data-action="toggle-suspend" data-member-id="${m.id}">
          ${m.status === "SUSPENDED" ? "Reactivate" : "Suspend"}
        </button>
        <button class="btn btn-danger" data-action="delete" data-member-id="${m.id}">Delete</button>
      </div>
    </div>
    <div class="card" style="margin-top:20px">
      <h2>Recent scans for this member</h2>
      ${memberScans.length === 0 ? `<div class="empty-state">No scans yet.</div>` : `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Time</th><th>Result</th></tr></thead>
          <tbody>${memberScans.map((r) => `
            <tr><td>${fmtTime(r.at)}</td><td><span class="badge badge-${r.result === "ALLOWED" ? "allowed" : "denied"}">${r.result}</span></td></tr>
          `).join("")}</tbody>
        </table>
      </div>`}
    </div>
    <!-- Renew modal template kept as HTML for the modal opener -->
    <template id="renew-tpl">
      <div class="modal-backdrop" data-close-on-click>
        <div class="modal" onclick="event.stopPropagation()">
          <h2>Renew ${esc(m.name)}</h2>
          <p class="text-muted" style="margin:0 0 12px">Pick a new package. Existing membership will be replaced.</p>
          <div class="field">
            <label for="pkg">Package</label>
            <select id="pkg">${pkgOpts}</select>
          </div>
          <div class="modal-actions">
            <button class="btn" data-close>Cancel</button>
            <button class="btn btn-primary" id="confirm-renew">Confirm renewal</button>
          </div>
        </div>
      </div>
    </template>
  `;
}

function viewAttendance() {
  const rows = attendanceWithMembers(state, 100);
  return `
    <div class="page-header">
      <div>
        <h1>Attendance</h1>
        <p>All check-ins across every device. Newest first.</p>
      </div>
    </div>
    <div class="card">
      ${rows.length === 0 ? `<div class="empty-state">No attendance yet.</div>` : `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Time</th><th>Member</th><th>Code</th><th>Result</th></tr></thead>
          <tbody>${rows.map((r) => `
            <tr>
              <td>${fmtTime(r.at)}</td>
              <td>${esc(r.memberName)}</td>
              <td class="text-muted">${esc(r.memberCode)}</td>
              <td><span class="badge badge-${r.result === "ALLOWED" ? "allowed" : "denied"}">${r.result}</span></td>
            </tr>`).join("")}</tbody>
        </table>
      </div>`}
    </div>
  `;
}

function viewScanner() {
  // Random member simulator - "place any finger"
  return `
    <div class="page-header">
      <div>
        <h1>Scanner (simulated)</h1>
        <p>Click the pad to simulate a fingerprint scan on the ZKTeco device.</p>
      </div>
    </div>
    <div class="card scanner-panel">
      <div class="scanner-pad" id="scanner-pad" title="Click to simulate scan">🖐️</div>
      <div class="scanner-status" id="scanner-status">
        Ready. Click the pad above to simulate a random member's fingerprint scan. In the real app this fires automatically when someone places a finger on the ZKTeco scanner and GMS decides whether to open the door.
      </div>
    </div>
    <div class="card" style="margin-top:20px">
      <h2>Or scan for a specific member</h2>
      <p class="text-muted" style="margin:0 0 12px">Pick a member to simulate their scan and see the access decision.</p>
      <div class="field" style="max-width:400px">
        <label for="pick-member">Member</label>
        <select id="pick-member">
          ${state.members.map((m) => `<option value="${m.id}">${esc(m.code)} · ${esc(m.name)}</option>`).join("")}
        </select>
      </div>
      <button class="btn btn-primary" id="scan-specific">Simulate scan for selected</button>
    </div>
  `;
}

function viewReports() {
  const packageRevenue = {};
  for (const m of state.members) {
    packageRevenue[m.package] = (packageRevenue[m.package] || 0) + (m.paid || 0);
  }
  const rows = Object.entries(packageRevenue).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((s, [, v]) => s + v, 0);
  return `
    <div class="page-header">
      <div>
        <h1>Reports</h1>
        <p>Revenue breakdown by package. Full app has daily/weekly/monthly views + CSV export.</p>
      </div>
    </div>
    <div class="card">
      <h2>Revenue by package</h2>
      ${rows.length === 0 ? `<div class="empty-state">No revenue yet.</div>` : `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Package</th><th>Members</th><th>Revenue</th><th>% of total</th></tr></thead>
          <tbody>
            ${rows.map(([name, rev]) => {
              const count = state.members.filter((m) => m.package === name).length;
              const pct = total > 0 ? ((rev / total) * 100).toFixed(1) : "0";
              return `<tr>
                <td>${esc(name)}</td>
                <td>${count}</td>
                <td>${fmtMoney(rev)}</td>
                <td>${pct}%</td>
              </tr>`;
            }).join("")}
          </tbody>
          <tfoot><tr><th>Total</th><th>${state.members.length}</th><th>${fmtMoney(total)}</th><th>100%</th></tr></tfoot>
        </table>
      </div>`}
    </div>
  `;
}

function viewSettings() {
  return `
    <div class="page-header">
      <div>
        <h1>Settings</h1>
        <p>General settings. Real app has ~30 toggles; this demo shows the pattern.</p>
      </div>
    </div>
    <div class="card">
      <h2>Demo controls</h2>
      <p class="text-muted" style="margin:0 0 12px">This demo stores state in your browser (localStorage). Nothing goes to a server.</p>
      <button class="btn btn-danger" data-action="reset">Reset demo data</button>
    </div>
    <div class="card" style="margin-top:20px">
      <h2>Membership expiry policy (mock)</h2>
      <div class="field">
        <label for="policy">When a member's package expires past grace:</label>
        <select id="policy">
          <option>Do nothing (deny at scan time only)</option>
          <option>Suspend member (keep fingerprint, deny scans)</option>
          <option>Delete fingerprint from device</option>
        </select>
      </div>
      <p class="text-muted" style="font-size:12px">In the real app this is enforced automatically on every scan and every renewal.</p>
    </div>
  `;
}

// ---- Router ----

const routes = {
  "": viewDashboard,
  dashboard: viewDashboard,
  members: viewMembers,
  "members/:id": (params) => viewMemberDetail(params.id),
  attendance: viewAttendance,
  scanner: viewScanner,
  reports: viewReports,
  settings: viewSettings,
};

function resolveRoute(hash) {
  const path = hash.replace(/^#\/?/, "");
  for (const key of Object.keys(routes)) {
    const parts = key.split("/");
    const pParts = path.split("/");
    if (parts.length !== pParts.length) continue;
    const params = {};
    let match = true;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].startsWith(":")) {
        params[parts[i].slice(1)] = pParts[i];
      } else if (parts[i] !== pParts[i]) {
        match = false; break;
      }
    }
    if (match) return { fn: routes[key], params, base: key.split("/")[0] };
  }
  return { fn: viewDashboard, params: {}, base: "dashboard" };
}

function render() {
  const { fn, params, base } = resolveRoute(location.hash);
  document.getElementById("view").innerHTML = fn(params);
  document.querySelectorAll(".nav-item").forEach((a) => {
    a.classList.toggle("active", a.dataset.route === base || (base === "" && a.dataset.route === "dashboard"));
  });
  wireEvents();
}

// ---- Event wiring ----

function wireEvents() {
  // Global click delegation for [data-action]
  document.getElementById("view").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const memberId = Number(btn.dataset.memberId);
    if (action === "new-member") openNewMemberModal();
    else if (action === "renew") openRenewModal(memberId);
    else if (action === "scan") doScan(memberId);
    else if (action === "toggle-suspend") {
      toggleSuspend(state, memberId);
      const m = state.members.find((x) => x.id === memberId);
      toast({ title: m.status === "SUSPENDED" ? "Member suspended" : "Member reactivated", body: m.name, tone: m.status === "SUSPENDED" ? "warning" : "success" });
      render();
    } else if (action === "delete") {
      if (!confirm("Delete this member and all their attendance? This cannot be undone.")) return;
      const m = state.members.find((x) => x.id === memberId);
      deleteMember(state, memberId);
      toast({ title: "Member deleted", body: m?.name ?? "", tone: "warning" });
      location.hash = "#/members";
    } else if (action === "reset") {
      if (!confirm("Reset all demo data back to seed?")) return;
      state = reset();
      toast({ title: "Demo reset", body: "Fresh seed data loaded.", tone: "success" });
      render();
    }
  });

  // Search on members list
  const q = document.getElementById("q");
  if (q) {
    q.addEventListener("input", () => {
      const term = q.value.trim().toLowerCase();
      document.querySelectorAll("#member-rows tr").forEach((tr) => {
        const t = tr.textContent.toLowerCase();
        tr.style.display = term && !t.includes(term) ? "none" : "";
      });
    });
  }

  // Scanner
  const pad = document.getElementById("scanner-pad");
  if (pad) {
    pad.addEventListener("click", () => {
      pad.classList.add("scanning");
      setTimeout(() => {
        pad.classList.remove("scanning");
        // Pick a random member
        const m = state.members[Math.floor(Math.random() * state.members.length)];
        doScan(m.id);
      }, 700);
    });
    document.getElementById("scan-specific")?.addEventListener("click", () => {
      const id = Number(document.getElementById("pick-member").value);
      doScan(id);
    });
  }
}

function doScan(memberId) {
  const result = recordScan(state, memberId);
  if (!result) return;
  const { row, member, status } = result;
  if (row.result === "ALLOWED") {
    const detail = status === "GRACE"
      ? `In grace period · ${daysToGraceEnd(member)} days to renew`
      : `${daysLeft(member)} days left`;
    toast({ title: `Granted access — ${member.name}`, body: detail, tone: status === "GRACE" ? "warning" : "success" });
  } else {
    toast({ title: `Denied — ${member.name}`, body: status === "EXPIRED" ? "Membership expired. Renewal required." : "Member is suspended.", tone: "danger" });
  }
  // If we're on dashboard/attendance/member detail, refresh the view
  const base = resolveRoute(location.hash).base;
  if (["dashboard", "attendance", "members"].includes(base) || location.hash.includes("/members/")) {
    render();
  }
  // Also update the scanner status text
  const status2 = document.getElementById("scanner-status");
  if (status2) {
    status2.textContent = row.result === "ALLOWED"
      ? `✓ ${member.name} — access granted (${status})`
      : `✗ ${member.name} — access denied (${status})`;
  }
}

// ---- Modals ----

function openModal(html) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = html;
  document.body.appendChild(backdrop);
  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  backdrop.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
  return { backdrop, close };
}

function openNewMemberModal() {
  const pkgOpts = state.packages.map((p) => `<option value="${esc(p.name)}">${esc(p.name)} — ${fmtMoney(p.price)}</option>`).join("");
  const { backdrop, close } = openModal(`
    <div class="modal" onclick="event.stopPropagation()">
      <h2>New member</h2>
      <div class="field"><label for="nm-name">Name</label><input id="nm-name" required /></div>
      <div class="field"><label for="nm-phone">Phone</label><input id="nm-phone" required /></div>
      <div class="field"><label for="nm-pkg">Package</label><select id="nm-pkg">${pkgOpts}</select></div>
      <div class="modal-actions">
        <button class="btn" data-close>Cancel</button>
        <button class="btn btn-primary" id="nm-save">Register</button>
      </div>
    </div>
  `);
  backdrop.querySelector("#nm-save").addEventListener("click", () => {
    const name = backdrop.querySelector("#nm-name").value.trim();
    const phone = backdrop.querySelector("#nm-phone").value.trim();
    const packageName = backdrop.querySelector("#nm-pkg").value;
    if (!name || !phone) { alert("Name and phone are required."); return; }
    const m = addMember(state, { name, phone, packageName });
    close();
    toast({ title: "Member registered", body: `${m.name} — ${m.code}`, tone: "success" });
    render();
  });
}

function openRenewModal(memberId) {
  const m = state.members.find((x) => x.id === memberId);
  if (!m) return;
  const pkgOpts = state.packages.map((p) => `<option value="${esc(p.name)}">${esc(p.name)} — ${fmtMoney(p.price)}</option>`).join("");
  const { backdrop, close } = openModal(`
    <div class="modal" onclick="event.stopPropagation()">
      <h2>Renew ${esc(m.name)}</h2>
      <div class="field"><label for="rn-pkg">Package</label><select id="rn-pkg">${pkgOpts}</select></div>
      <div class="modal-actions">
        <button class="btn" data-close>Cancel</button>
        <button class="btn btn-primary" id="rn-save">Confirm renewal</button>
      </div>
    </div>
  `);
  backdrop.querySelector("#rn-save").addEventListener("click", () => {
    const packageName = backdrop.querySelector("#rn-pkg").value;
    renewMember(state, memberId, packageName);
    close();
    toast({ title: "Membership renewed", body: `${m.name} — ${packageName}`, tone: "success" });
    render();
  });
}

// ---- Startup ----

window.addEventListener("hashchange", render);
document.getElementById("btn-reset").addEventListener("click", () => {
  if (!confirm("Reset all demo data back to seed?")) return;
  state = reset();
  toast({ title: "Demo reset", body: "Fresh seed data loaded.", tone: "success" });
  render();
});

if (!location.hash) location.hash = "#/dashboard";
render();
