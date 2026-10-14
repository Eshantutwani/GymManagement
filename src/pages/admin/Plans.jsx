import { useMemo, useState } from "react";
import { loadAll, savePlan, deletePlan, addDefaultPlans } from "../../firebase/services";
import { useLoad } from "../../hooks";
import { fmtDate, fmtMoney, memberStatus, errMsg, toDate, daysLeft } from "../../utils";
import { Loading, ErrorBox, PageHead, DataTable, Empty, Badge, Modal, ConfirmDialog, Field, useToast } from "../../components/ui";

function PlanForm({ plan, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({ planName: plan?.planName || "", durationInDays: plan?.durationInDays || 30, price: plan?.price ?? "", description: plan?.description || "", isActive: plan?.isActive ?? true });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    const v = {};
    if (!f.planName.trim()) v.planName = "Name the plan";
    if (!Number.isInteger(Number(f.durationInDays)) || Number(f.durationInDays) < 1) v.durationInDays = "Enter a whole number of days (1 or more)";
    if (f.price === "" || Number(f.price) < 0) v.price = "Enter a price of 0 or more";
    setErr(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    try { await savePlan({ ...f, id: plan?.id }); toast("Plan saved"); onSaved(); onClose(); }
    catch (x) { toast(errMsg(x), "error"); setBusy(false); }
  }
  return (
    <Modal title={plan ? "Edit plan" : "New plan"} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <Field label="Plan name" error={err.planName}><input value={f.planName} onChange={set("planName")} placeholder="Monthly" /></Field>
        <div className="grid2">
          <Field label="Duration (days)" error={err.durationInDays}><input type="number" min="1" value={f.durationInDays} onChange={set("durationInDays")} /></Field>
          <Field label="Price (₹)" error={err.price}><input type="number" min="0" value={f.price} onChange={set("price")} /></Field>
        </div>
        <Field label="Description"><textarea rows="2" value={f.description} onChange={set("description")} /></Field>
        <label className="field" style={{ flexDirection: "row", gap: ".5rem" }}><input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /><span>Available to assign and shown on the website</span></label>
        <div className="actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" disabled={busy}>{busy ? "Saving…" : "Save plan"}</button></div>
      </form>
    </Modal>
  );
}

export default function Plans() {
  const { data, loading, error, reload } = useLoad(() => loadAll(1));
  const toast = useToast();
  const [modal, setModal] = useState(null);
  const [tab, setTab] = useState("all");
  const planName = useMemo(() => Object.fromEntries((data?.plans || []).map((p) => [p.id, p.planName])), [data]);
  const subs = useMemo(() => (data?.members || []).filter((m) => m.membershipId).map((m) => ({ ...m, _status: memberStatus(m) })).filter((m) => tab === "all" || m._status === tab), [data, tab]);

  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const close = () => setModal(null);
  const used = (p) => data.members.filter((m) => m.membershipId === p.id).length;
  const del = async () => {
    try { await deletePlan(modal.plan.id); toast("Plan deleted"); close(); reload(); } catch (x) { toast(errMsg(x), "error"); }
  };
  const seed = async () => { try { await addDefaultPlans(); toast("Default plans added"); reload(); } catch (x) { toast(errMsg(x), "error"); } };

  return (
    <>
      <PageHead title="Memberships" sub="Plans, pricing and who is on them."><button className="btn" onClick={() => setModal({ type: "form" })}>New plan</button></PageHead>
      <div className="panel"><h3>Plans</h3>
        <DataTable rows={data.plans} empty={<Empty title="No plans yet" hint="Add the four standard plans, or create your own." action={<button className="btn" onClick={seed}>Add Monthly, Quarterly, Half-Yearly and Annual</button>} />}
          columns={[
            { key: "planName", label: "Plan", render: (p) => <strong>{p.planName}</strong> },
            { key: "durationInDays", label: "Duration", render: (p) => `${p.durationInDays} days` },
            { key: "price", label: "Price", render: (p) => fmtMoney(p.price) },
            { key: "users", label: "Members", sortValue: used, render: used },
            { key: "isActive", label: "Status", render: (p) => <Badge status={p.isActive ? "active" : "expired"} /> },
            { key: "a", label: "", sortable: false, render: (p) => <div className="row-actions"><button className="btn ghost sm" onClick={() => setModal({ type: "form", plan: p })}>Edit</button><button className="btn ghost sm" onClick={() => setModal({ type: "delete", plan: p })}>Delete</button></div> },
          ]} />
      </div>
      <div className="panel"><h3>Memberships by status</h3>
        <div className="toolbar">
          <select value={tab} onChange={(e) => setTab(e.target.value)} aria-label="Filter memberships">
            <option value="all">All</option><option value="active">Active</option><option value="expiring">Expiring soon</option><option value="expired">Expired</option>
          </select>
        </div>
        <DataTable rows={subs} empty={<Empty title="No memberships in this view" hint="Assign a plan from the Members page." />}
          columns={[
            { key: "fullName", label: "Member", render: (m) => <strong>{m.fullName}</strong> },
            { key: "plan", label: "Plan", sortValue: (m) => planName[m.membershipId] || "", render: (m) => planName[m.membershipId] || "Deleted plan" },
            { key: "end", label: "Ends", sortValue: (m) => toDate(m.membershipEndDate)?.getTime() || 0, render: (m) => fmtDate(m.membershipEndDate) },
            { key: "left", label: "Days left", sortValue: (m) => daysLeft(m) ?? 0, render: (m) => { const d = daysLeft(m); return d < 0 ? "Ended" : d; } },
            { key: "_status", label: "Status", render: (m) => <Badge status={m._status} /> },
          ]} />
      </div>
      {modal?.type === "form" && <PlanForm plan={modal.plan} onClose={close} onSaved={reload} />}
      {modal?.type === "delete" && <ConfirmDialog title="Delete plan?" message={used(modal.plan) ? `${used(modal.plan)} member(s) are on ${modal.plan.planName}. They keep their dates, but the plan name will show as deleted. Consider marking it inactive instead.` : `Delete ${modal.plan.planName}? This can't be undone.`} onConfirm={del} onCancel={close} />}
    </>
  );
}
