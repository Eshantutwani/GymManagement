import { useMemo, useState } from "react";
import { loadAll, recordPayment, deletePayment } from "../../firebase/services";
import { useLoad } from "../../hooks";
import { fmtDate, fmtMoney, errMsg, dateKey, toDate } from "../../utils";
import { Loading, ErrorBox, PageHead, StatCard, DataTable, Empty, Badge, Modal, ConfirmDialog, Field, useToast } from "../../components/ui";

const METHODS = { cash: "Cash", upi: "UPI", card: "Card", bank_transfer: "Bank transfer" };

function PaymentForm({ members, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({ memberId: members[0]?.id || "", amount: "", paymentDate: dateKey(), paymentMethod: "cash", status: "paid" });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    const v = {};
    if (!f.memberId) v.memberId = "Choose a member";
    if (!(Number(f.amount) > 0)) v.amount = "Enter an amount greater than 0";
    if (!f.paymentDate) v.paymentDate = "Choose a date";
    setErr(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    try { await recordPayment(f); toast("Payment recorded"); onSaved(); onClose(); }
    catch (x) { toast(errMsg(x), "error"); setBusy(false); }
  }
  if (!members.length) return <Modal title="Record payment" onClose={onClose}><Empty title="No members yet" hint="Add a member first." /></Modal>;
  return (
    <Modal title="Record payment" onClose={onClose}>
      <p className="muted small">This logs a payment taken at the desk. The app doesn't process online payments.</p>
      <form onSubmit={submit} noValidate>
        <Field label="Member" error={err.memberId}><select value={f.memberId} onChange={set("memberId")}>{members.map((m) => <option key={m.id} value={m.id}>{m.fullName}</option>)}</select></Field>
        <div className="grid2">
          <Field label="Amount (₹)" error={err.amount}><input type="number" min="1" value={f.amount} onChange={set("amount")} /></Field>
          <Field label="Date" error={err.paymentDate}><input type="date" value={f.paymentDate} max={dateKey()} onChange={set("paymentDate")} /></Field>
          <Field label="Method"><select value={f.paymentMethod} onChange={set("paymentMethod")}>{Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Status"><select value={f.status} onChange={set("status")}><option value="paid">Paid</option><option value="pending">Pending</option><option value="failed">Failed</option></select></Field>
        </div>
        <div className="actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" disabled={busy}>{busy ? "Saving…" : "Record payment"}</button></div>
      </form>
    </Modal>
  );
}

export default function Payments() {
  const { data, loading, error, reload } = useLoad(() => loadAll(1));
  const toast = useToast();
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null);
  const name = useMemo(() => Object.fromEntries((data?.members || []).map((m) => [m.id, m.fullName])), [data]);
  const rows = useMemo(() => (data?.payments || []).filter((p) => (name[p.memberId] || "").toLowerCase().includes(q.toLowerCase())), [data, q, name]);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const total = data.payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const pending = data.payments.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0);
  const close = () => setModal(null);
  const del = async () => { try { await deletePayment(modal.payment.id); toast("Payment deleted"); close(); reload(); } catch (x) { toast(errMsg(x), "error"); } };

  return (
    <>
      <PageHead title="Payments" sub="Manually recorded transactions."><button className="btn" onClick={() => setModal({ type: "form" })}>Record payment</button></PageHead>
      <div className="stats">
        <StatCard label="Total revenue (paid)" value={fmtMoney(total)} tone="accent" />
        <StatCard label="Pending" value={fmtMoney(pending)} />
        <StatCard label="Transactions" value={data.payments.length} />
      </div>
      <div className="toolbar"><input placeholder="Search by member" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search payments" /></div>
      <DataTable rows={rows} empty={<Empty title={data.payments.length ? "No payments match" : "No payments yet"} hint="Record a payment or assign a plan with payment from the Members page." />}
        columns={[
          { key: "m", label: "Member", sortValue: (p) => name[p.memberId] || "", render: (p) => name[p.memberId] || "Removed member" },
          { key: "amount", label: "Amount", render: (p) => fmtMoney(p.amount) },
          { key: "paymentDate", label: "Date", sortValue: (p) => toDate(p.paymentDate)?.getTime() || 0, render: (p) => fmtDate(p.paymentDate) },
          { key: "paymentMethod", label: "Method", render: (p) => METHODS[p.paymentMethod] || p.paymentMethod },
          { key: "status", label: "Status", render: (p) => <Badge status={p.status} /> },
          { key: "a", label: "", sortable: false, render: (p) => <button className="btn ghost sm" onClick={() => setModal({ type: "delete", payment: p })}>Delete</button> },
        ]} />
      {modal?.type === "form" && <PaymentForm members={data.members} onClose={close} onSaved={reload} />}
      {modal?.type === "delete" && <ConfirmDialog title="Delete payment?" message={`Remove the ${fmtMoney(modal.payment.amount)} payment for ${name[modal.payment.memberId] || "this member"}? Revenue totals will change.`} onConfirm={del} onCancel={close} />}
    </>
  );
}
