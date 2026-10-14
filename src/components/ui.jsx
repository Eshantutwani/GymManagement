import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";

/* ---------- icons ---------- */
const PATHS = {
  dash: "M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  tag: "M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8zM7 7h.01",
  card: "M2 5h20v14H2zM2 10h20",
  cal: "M3 4h18v18H3zM16 2v4M8 2v4M3 10h18",
  dumbbell: "M6 6v12M18 6v12M3 9v6M21 9v6M6 12h12",
  chart: "M3 3v18h18M7 15l4-4 3 3 5-6",
  out: "M9 21H5V3h4M16 17l5-5-5-5M21 12H9",
  menu: "M3 6h18M3 12h18M3 18h18",
  plus: "M12 5v14M5 12h14",
};
export const Icon = ({ name, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={PATHS[name]} />
  </svg>
);

/* ---------- toasts ---------- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, type = "ok") => {
    const id = Math.random();
    setItems((x) => [...x, { id, message, type }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- modal + confirm ---------- */
export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><h3>{title}</h3><button className="btn ghost sm" onClick={onClose} aria-label="Close">✕</button></div>
        {children}
      </div>
    </div>
  );
}
export function ConfirmDialog({ title, message, confirmLabel = "Delete", onConfirm, onCancel }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="muted">{message}</p>
      <div className="actions">
        <button className="btn ghost" onClick={onCancel}>Cancel</button>
        <button className="btn danger" disabled={busy} onClick={async () => { setBusy(true); await onConfirm(); setBusy(false); }}>{busy ? "Working…" : confirmLabel}</button>
      </div>
    </Modal>
  );
}

/* ---------- small pieces ---------- */
export const Loading = ({ label = "Loading…" }) => <div className="center-note"><span className="spinner" />{label}</div>;
export const ErrorBox = ({ error, onRetry }) => (
  <div className="errorbox">
    <strong>Couldn't load this page.</strong>
    <span>{error?.code === "permission-denied" ? "Your account doesn't have access to this data." : error?.message}</span>
    {onRetry && <button className="btn sm" onClick={onRetry}>Try again</button>}
  </div>
);
export const Empty = ({ title, hint, action }) => (
  <div className="empty"><h4>{title}</h4>{hint && <p className="muted">{hint}</p>}{action}</div>
);
export const StatCard = ({ label, value, hint, tone }) => (
  <div className={`stat ${tone || ""}`}><span className="stat-label">{label}</span><span className="stat-value">{value}</span>{hint && <span className="stat-hint">{hint}</span>}</div>
);
export const Badge = ({ status }) => <span className={`badge ${status}`}>{{ expiring: "expiring soon" }[status] || status}</span>;
export const Field = ({ label, error, children }) => (
  <label className="field"><span>{label}</span>{children}{error && <em className="field-error">{error}</em>}</label>
);
export const PageHead = ({ title, sub, children }) => (
  <div className="page-head"><div><h1>{title}</h1>{sub && <p className="muted">{sub}</p>}</div><div className="head-actions">{children}</div></div>
);

/* ---------- sortable, paginated table ---------- */
export function DataTable({ columns, rows, pageSize = 8, empty }) {
  const [sort, setSort] = useState(null);
  const [page, setPage] = useState(0);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    const val = (r) => { const v = col.sortValue ? col.sortValue(r) : r[col.key]; return typeof v === "string" ? v.toLowerCase() : v ?? 0; };
    return [...rows].sort((a, b) => { const x = val(a), y = val(b); const c = x > y ? 1 : x < y ? -1 : 0; return sort.dir === "asc" ? c : -c; });
  }, [rows, sort, columns]);
  useEffect(() => setPage(0), [rows.length]);
  if (!rows.length) return empty || <Empty title="Nothing here yet" />;
  const pages = Math.ceil(sorted.length / pageSize);
  const slice = sorted.slice(page * pageSize, (page + 1) * pageSize);
  const toggle = (c) => c.sortable !== false && setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === "asc" ? "desc" : "asc" } : { key: c.key, dir: "asc" }));
  return (
    <div className="table-wrap">
      <div className="table-scroll">
        <table>
          <thead><tr>{columns.map((c) => (
            <th key={c.key} onClick={() => toggle(c)} className={c.sortable === false ? "" : "sortable"} aria-sort={sort?.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
              {c.label}{sort?.key === c.key ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
            </th>))}</tr></thead>
          <tbody>{slice.map((r) => <tr key={r.id}>{columns.map((c) => <td key={c.key} data-label={c.label}>{c.render ? c.render(r) : r[c.key]}</td>)}</tr>)}</tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="pager">
          <span className="muted">{page * pageSize + 1}–{Math.min((page + 1) * pageSize, rows.length)} of {rows.length}</span>
          <div><button className="btn ghost sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
          <button className="btn ghost sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button></div>
        </div>
      )}
    </div>
  );
}
