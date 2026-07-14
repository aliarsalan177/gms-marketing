// Mock data source for the GMS demo. All state lives in localStorage
// (namespaced under gms_demo_*) so refreshes preserve the user's
// clicks, but a "Reset demo" button wipes it back to the seed. Every
// mutation still goes through this module so screens stay consistent.

const NS = "gms_demo_v1";

function today() {
  return new Date().toISOString().slice(0, 10);
}
function addDays(iso, days) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function nowIso() {
  return new Date().toISOString();
}

const SEED_MEMBERS = [
  { id: 1, code: "M-0001", name: "Ali Khan", phone: "0300-1112221", pkg: "1-Month Standard", start: "-25", days: 30, grace: 5, paid: 3500, price: 3500 },
  { id: 2, code: "M-0002", name: "Sara Ahmed", phone: "0300-1112222", pkg: "3-Month Standard", start: "-90", days: 90, grace: 7, paid: 9000, price: 9000 },
  { id: 3, code: "M-0003", name: "Bilal Hussain", phone: "0300-1112223", pkg: "1-Month Standard", start: "-40", days: 30, grace: 5, paid: 3500, price: 3500 },
  { id: 4, code: "M-0004", name: "Fatima Iqbal", phone: "0300-1112224", pkg: "6-Month Premium", start: "-120", days: 180, grace: 7, paid: 18000, price: 18000 },
  { id: 5, code: "M-0005", name: "Usman Sheikh", phone: "0300-1112225", pkg: "1-Month Standard", start: "-3", days: 30, grace: 5, paid: 3500, price: 3500 },
  { id: 6, code: "M-0006", name: "Ayesha Malik", phone: "0300-1112226", pkg: "3-Month Standard", start: "-45", days: 90, grace: 7, paid: 9000, price: 9000 },
  { id: 7, code: "M-0007", name: "Hassan Raza", phone: "0300-1112227", pkg: "1-Month Standard", start: "-15", days: 30, grace: 5, paid: 3500, price: 3500 },
  { id: 8, code: "M-0008", name: "Zainab Farooq", phone: "0300-1112228", pkg: "1-Month Standard", start: "-32", days: 30, grace: 5, paid: 3500, price: 3500 },
  { id: 9, code: "M-0009", name: "Ahmed Nawaz", phone: "0300-1112229", pkg: "6-Month Premium", start: "-8", days: 180, grace: 7, paid: 18000, price: 18000 },
  { id: 10, code: "M-0010", name: "Maryam Yousaf", phone: "0300-1112230", pkg: "3-Month Standard", start: "-60", days: 90, grace: 7, paid: 9000, price: 9000 },
  { id: 11, code: "M-0011", name: "Kamran Ali", phone: "0300-1112231", pkg: "1-Month Standard", start: "-1", days: 30, grace: 5, paid: 3500, price: 3500 },
  { id: 12, code: "M-0012", name: "Sadia Rehman", phone: "0300-1112232", pkg: "1-Month Standard", start: "-22", days: 30, grace: 5, paid: 3500, price: 3500 },
];

const SEED_PACKAGES = [
  { id: 1, name: "1-Month Standard", days: 30, grace: 5, price: 3500 },
  { id: 2, name: "3-Month Standard", days: 90, grace: 7, price: 9000 },
  { id: 3, name: "6-Month Premium", days: 180, grace: 7, price: 18000 },
  { id: 4, name: "12-Month Premium", days: 365, grace: 14, price: 32000 },
];

// Seed a few attendance rows so the reports + dashboard look alive
function seedAttendance() {
  const rows = [];
  for (let i = 0; i < 40; i++) {
    const memberIdx = Math.floor(Math.random() * SEED_MEMBERS.length);
    const daysAgo = Math.floor(Math.random() * 14);
    const hour = 6 + Math.floor(Math.random() * 15);
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hour, Math.floor(Math.random() * 60), 0, 0);
    rows.push({
      id: i + 1,
      memberId: SEED_MEMBERS[memberIdx].id,
      at: d.toISOString(),
      result: "ALLOWED",
    });
  }
  return rows.sort((a, b) => (a.at < b.at ? 1 : -1));
}

function seed() {
  const members = SEED_MEMBERS.map((m) => {
    const startIso = addDays(today(), Number(m.start));
    const endIso = addDays(startIso, m.days);
    const graceEnd = addDays(endIso, m.grace);
    return {
      id: m.id,
      code: m.code,
      name: m.name,
      phone: m.phone,
      status: "ACTIVE",
      joinDate: startIso,
      package: m.pkg,
      startDate: startIso,
      endDate: endIso,
      graceEnd,
      paid: m.paid,
      price: m.price,
    };
  });
  const state = {
    packages: SEED_PACKAGES,
    members,
    attendance: seedAttendance(),
    nextMemberId: 13,
    nextAttendanceId: 41,
  };
  save(state);
  return state;
}

function save(state) {
  localStorage.setItem(NS, JSON.stringify(state));
}

export function load() {
  const raw = localStorage.getItem(NS);
  if (!raw) return seed();
  try { return JSON.parse(raw); } catch { return seed(); }
}

export function reset() {
  localStorage.removeItem(NS);
  return seed();
}

export function saveState(state) {
  save(state);
}

// ---- Domain queries ----

/** Compute the derived status of a member given today's date. */
export function statusOf(member) {
  const t = today();
  if (member.status === "SUSPENDED") return "SUSPENDED";
  if (t <= member.endDate) return "ACTIVE";
  if (t <= member.graceEnd) return "GRACE";
  return "EXPIRED";
}

export function daysLeft(member) {
  const t = new Date(today());
  const end = new Date(member.endDate);
  return Math.max(0, Math.round((end - t) / 86400000));
}
export function daysToGraceEnd(member) {
  const t = new Date(today());
  const gEnd = new Date(member.graceEnd);
  return Math.max(0, Math.round((gEnd - t) / 86400000));
}

/** Stats for the dashboard tiles. */
export function dashboardStats(state) {
  let active = 0, grace = 0, expired = 0, suspended = 0;
  for (const m of state.members) {
    const s = statusOf(m);
    if (s === "ACTIVE") active++;
    else if (s === "GRACE") grace++;
    else if (s === "EXPIRED") expired++;
    else if (s === "SUSPENDED") suspended++;
  }
  const t = today();
  const todayScans = state.attendance.filter((a) => a.at.startsWith(t)).length;
  const totalRevenue = state.members.reduce((s, m) => s + (m.paid ?? 0), 0);
  return {
    total: state.members.length,
    active,
    grace,
    expired,
    suspended,
    todayScans,
    totalRevenue,
  };
}

/** Add a new attendance row. Returns the row so the caller can toast. */
export function recordScan(state, memberId) {
  const m = state.members.find((x) => x.id === memberId);
  if (!m) return null;
  const status = statusOf(m);
  const result = status === "ACTIVE" || status === "GRACE" ? "ALLOWED" : "DENIED";
  const row = {
    id: state.nextAttendanceId++,
    memberId,
    at: nowIso(),
    result,
  };
  state.attendance.unshift(row);
  save(state);
  return { row, member: m, status };
}

/** Renew a member's package - creates a new period, resets suspended. */
export function renewMember(state, memberId, packageName) {
  const m = state.members.find((x) => x.id === memberId);
  if (!m) return null;
  const pkg = state.packages.find((p) => p.name === packageName) ?? state.packages[0];
  const start = today();
  m.package = pkg.name;
  m.startDate = start;
  m.endDate = addDays(start, pkg.days);
  m.graceEnd = addDays(m.endDate, pkg.grace);
  m.status = "ACTIVE";
  m.paid = (m.paid ?? 0) + pkg.price;
  m.price = pkg.price;
  save(state);
  return m;
}

/** Add a brand-new member with a chosen package. */
export function addMember(state, { name, phone, packageName }) {
  const pkg = state.packages.find((p) => p.name === packageName) ?? state.packages[0];
  const id = state.nextMemberId++;
  const code = "M-" + String(id).padStart(4, "0");
  const start = today();
  const m = {
    id,
    code,
    name,
    phone,
    status: "ACTIVE",
    joinDate: start,
    package: pkg.name,
    startDate: start,
    endDate: addDays(start, pkg.days),
    graceEnd: addDays(addDays(start, pkg.days), pkg.grace),
    paid: pkg.price,
    price: pkg.price,
  };
  state.members.push(m);
  save(state);
  return m;
}

/** Toggle a member's suspended status. */
export function toggleSuspend(state, memberId) {
  const m = state.members.find((x) => x.id === memberId);
  if (!m) return null;
  m.status = m.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
  save(state);
  return m;
}

/** Delete a member (and their attendance). */
export function deleteMember(state, memberId) {
  state.members = state.members.filter((m) => m.id !== memberId);
  state.attendance = state.attendance.filter((a) => a.memberId !== memberId);
  save(state);
}

/** Attendance rows with member name resolved, most recent first. */
export function attendanceWithMembers(state, limit = 100) {
  return state.attendance.slice(0, limit).map((a) => {
    const m = state.members.find((x) => x.id === a.memberId);
    return {
      ...a,
      memberName: m ? m.name : "(deleted)",
      memberCode: m ? m.code : "—",
    };
  });
}

/** Group attendance rows by day for the last 7 days - for the chart. */
export function last7DaysAttendance(state) {
  const buckets = [];
  const t = new Date(today());
  for (let i = 6; i >= 0; i--) {
    const d = new Date(t);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const count = state.attendance.filter((a) => a.at.startsWith(iso)).length;
    buckets.push({
      label: d.toLocaleDateString(undefined, { weekday: "short" }),
      count,
    });
  }
  return buckets;
}
