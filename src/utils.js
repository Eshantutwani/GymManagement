export const toDate = (v) => (v?.toDate ? v.toDate() : v ? new Date(v) : null);
export const fmtDate = (v) => {
  const d = toDate(v);
  return d ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
};
export const fmtTime = (v) => {
  const d = toDate(v);
  return d ? d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";
};
export const fmtMoney = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const dateKey = (d = new Date()) => {
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};
export const monthKey = (d) => dateKey(d).slice(0, 7);

// Status is derived from the end date so it never goes stale.
export function memberStatus(m) {
  const end = toDate(m.membershipEndDate);
  if (!end) return "pending";
  const days = (end - new Date()) / 86400000;
  if (days < 0) return "expired";
  if (days <= 7) return "expiring";
  return "active";
}
export const daysLeft = (m) => {
  const end = toDate(m.membershipEndDate);
  return end ? Math.ceil((end - new Date()) / 86400000) : null;
};

export function lastMonths(n) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    return { key: monthKey(d), label: d.toLocaleString("en-IN", { month: "short" }) };
  });
}

export function downloadCSV(name, rows) {
  if (!rows.length) return false;
  const cols = Object.keys(rows[0]);
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
  return true;
}

const MESSAGES = {
  "auth/invalid-credential": "That email and password don't match an account.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/email-already-in-use": "An account with this email already exists. Try signing in.",
  "auth/weak-password": "Use a password with at least 8 characters.",
  "auth/too-many-requests": "Too many attempts. Wait a minute and try again.",
  "auth/network-request-failed": "Can't reach Firebase. Check your connection and try again.",
  "permission-denied": "You don't have permission to do that.",
  unavailable: "Firestore is unreachable right now. Check your connection and try again.",
};
export const errMsg = (e) => MESSAGES[e?.code] || e?.message || "Something went wrong.";
