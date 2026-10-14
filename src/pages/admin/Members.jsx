import { useMemo, useState } from "react";
import { loadAll, addMember, updateMember, deleteMember, assignPlan } from "../../firebase/services";
import { useLoad } from "../../hooks";
import { fmtDate, fmtMoney, memberStatus, errMsg, dateKey, toDate } from "../../utils";
import { Loading, ErrorBox, PageHead, DataTable, Empty, Badge, Modal, ConfirmDialog, Field, useToast } from "../../components/ui";

function MemberForm({ member, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({
    fullName: member?.fullName || "", email: member?.email || "", phone: member?.phone || "",
    dateOfBirth: member?.dateOfBirth || "", gender: member?.gender || "", address: member?.address || "",
  });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    const v = {};
    if (f.fullName.trim().length < 2) v.fullName = "Enter the member's full name";
    if (!/^\S+@\S+\.\S+$/.test(f.email)) v.email = "Enter a valid email address";
    if (!/^[0-9+\-\s]{7,15}$/.test(f.phone)) v.phone = "Enter a valid phone number";
    if (f.dateOfBirth && new Date(f.dateOfBirth) > new Date()) v.dateOfBirth = "Date of birth can't be in the future";
    setErr(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    const data = { ...f, fullName: f.fullName.trim(), email: f.email.trim(), phone: f.phone.trim(), address: f.address.trim() };
    try {
      member ? await updateMember(member.id, data) : await addMember(data);
      toast(member ? "Member updated" : "Member added");
      onSaved(); onClose();
    } catch (x) { toast(errMsg(x), "error"); setBusy(false); }
  }
  return (
    <Modal title={member ? "Edit member" : "Add member"} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <Field label="Full name" error={err.fullName}><input value={f.fullName} onChange={set("fullName")} /></Field>
        <div className="grid2">
          <Field label="Email" error={err.email}><input type="email" value={f.email} onChange={set("email")} /></Field>
          <Field label="Phone" error={err.phone}><input value={f.phone} onChange={set("phone")} /></Field>
          <Field label="Date of birth" error={err.dateOfBirth}><input type="date" value={f.dateOfBirth} onChange={set("dateOfBirth")} /></Field>
          <Field label="Gender (optional)"><select value={f.gender} onChange={set("gender")}><option value="">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select></Field>
        </div>
        <Field label="Address (optional)"><input value={f.address} onChange={set("address")} /></Field>
        <div className="actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" disabled={busy}>{busy ? "Saving…" : "Save member"}</button></div>
      </form>
    </Modal>
  );
}

function AssignForm({ member, plans, onClose, onSaved }) {
  const toast = useToast();
  const active = plans.filter((p) => p.isActive);
  const [planId, setPlanId] = useState(active[0]?.id || "");
  const [start, setStart] = useState(dateKey());
  const [record, setRecord] = useState(true);
  const [method, setMethod] = useState("cash");
  const [busy, setBusy] = useState(false);
  const plan = plans.find((p) => p.id === planId);
  const end = plan ? new Date(new Date(start).getTime() + plan.durationInDays * 86400000) : null;

  async function submit(e) {
    e.preventDefault();
    if (!plan) return toast("Choose a plan first", "error");
    if (!start) return toast("Choose a start date", "error");
    setBusy(true);
    try {
      await assignPlan({ member, plan, startDate: start, payment: record ? { amount: plan.price, paymentMethod: method } : null });
      toast("Plan assigned"); onSaved(); onClose();
    } catch (x) { toast(errMsg(x), "error"); setBusy(false); }
  }
  if (!active.length) return <Modal title="Assign plan" onClose={onClose}><Empty title="No active plans" hint="Create a plan under Memberships first." /></Modal>;
  return (
    <Modal title={`Assign plan to ${member.fullName}`} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Plan"><select value={planId} onChange={(e) => setPlanId(e.target.value)}>{active.map((p) => <option key={p.id} value={p.id}>{p.planName} · {fmtMoney(p.price)} · {p.durationInDays} days</option>)}</select></Field>
        <Field label="Start date"><input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <p className="muted">Expires on <strong style={{ color: "var(--text)" }}>{fmtDate(end)}</strong></p>
        <label className="field" style={{ flexDirection: "row", gap: ".5rem" }}><input type="checkbox" checked={record} onChange={(e) => setRecord(e.target.checked)} /><span>Record a payment of {fmtMoney(plan?.price)} now</span></label>
        {record && <Field label="Payment method"><select value={method} onChange={(e) => setMethod(e.target.value)}><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="bank_transfer">Bank transfer</option></select></Field>}
        <div className="actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" disabled={busy}>{busy ? "Assigning…" : "Assign plan"}</button></div>
      </form>
    </Modal>
  );
}

export default function Members() {
  const { data, loading, error, reload } = useLoad(() => loadAll(30));
  const toast = useToast();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [modal, setModal] = useState(null); // {type, member}

  const planName = useMemo(() => Object.fromEntries((data?.plans || []).map((p) => [p.id, p.planName])), [data]);
  const rows = useMemo(() => (data?.members || [])
    .map((m) => ({ ...m, _status: memberStatus(m) }))
    .filter((m) => (filter === "all" || m._status === filter) && `${m.fullName} ${m.email} ${m.phone}`.toLowerCase().includes(q.toLowerCase())), [data, q, filter]);

  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const close = () => setModal(null);
  const del = async () => {
    try { await deleteMember(modal.member.id); toast("Member deleted"); close(); reload(); }
    catch (x) { toast(errMsg(x), "error"); }
  };
  const counts = (m) => data.payments.filter((p) => p.memberId === m.id).length;
  const visits = (m) => data.attendance.filter((a) => a.memberId === m.id).length;

  return (
    <>
      <PageHead title="Members" sub={`${data.members.length} registered`}><button className="btn" onClick={() => setModal({ type: "form" })}>Add member</button></PageHead>
      <div className="toolbar">
        <input placeholder="Search name, email or phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search members" />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by status">
          <option value="all">All statuses</option><option value="active">Active</option><option value="expiring">Expiring soon</option><option value="expired">Expired</option><option value="pending">No plan</option>
        </select>
      </div>
      <DataTable rows={rows} empty={<Empty title={data.members.length ? "No members match" : "No members yet"} hint={data.members.length ? "Try a different search or filter." : "Add your first member to get started."} />}
        columns={[
          { key: "fullName", label: "Name", render: (m) => <><strong>{m.fullName}</strong><div className="muted small">{m.email}</div></> },
          { key: "phone", label: "Phone" },
          { key: "plan", label: "Plan", sortValue: (m) => planName[m.membershipId] || "", render: (m) => planName[m.membershipId] || "—" },
          { key: "start", label: "Starts", sortValue: (m) => toDate(m.membershipStartDate)?.getTime() || 0, render: (m) => fmtDate(m.membershipStartDate) },
          { key: "end", label: "Ends", sortValue: (m) => toDate(m.membershipEndDate)?.getTime() || 0, render: (m) => fmtDate(m.membershipEndDate) },
          { key: "_status", label: "Status", render: (m) => <Badge status={m._status} /> },
          { key: "actions", label: "", sortable: false, render: (m) => (
            <div className="row-actions">
              <button className="btn ghost sm" onClick={() => setModal({ type: "view", member: m })}>View</button>
              <button className="btn ghost sm" onClick={() => setModal({ type: "form", member: m })}>Edit</button>
              <button className="btn ghost sm" onClick={() => setModal({ type: "assign", member: m })}>Assign plan</button>
              <button className="btn ghost sm" onClick={() => setModal({ type: "delete", member: m })}>Delete</button>
            </div>) },
        ]} />
      {modal?.type === "form" && <MemberForm member={modal.member} onClose={close} onSaved={reload} />}
      {modal?.type === "assign" && <AssignForm member={modal.member} plans={data.plans} onClose={close} onSaved={reload} />}
      {modal?.type === "delete" && <ConfirmDialog title="Delete member?" message={`This permanently removes ${modal.member.fullName} along with their payments and attendance records. It can't be undone.`} onConfirm={del} onCancel={close} />}
      {modal?.type === "view" && (
        <Modal title={modal.member.fullName} onClose={close}>
          <dl className="kv">
            <dt>Email</dt><dd>{modal.member.email}</dd><dt>Phone</dt><dd>{modal.member.phone}</dd>
            <dt>Date of birth</dt><dd>{modal.member.dateOfBirth || "—"}</dd><dt>Gender</dt><dd>{modal.member.gender || "—"}</dd>
            <dt>Address</dt><dd>{modal.member.address || "—"}</dd><dt>Joined</dt><dd>{fmtDate(modal.member.joinedAt)}</dd>
            <dt>Plan</dt><dd>{planName[modal.member.membershipId] || "No plan"}</dd>
            <dt>Membership</dt><dd>{fmtDate(modal.member.membershipStartDate)} to {fmtDate(modal.member.membershipEndDate)}</dd>
            <dt>Status</dt><dd><Badge status={memberStatus(modal.member)} /></dd>
            <dt>Portal login</dt><dd>{modal.member.uid ? "Linked account" : "Walk-in (no login)"}</dd>
            <dt>Payments</dt><dd>{counts(modal.member)}</dd><dt>Visits (30 days)</dt><dd>{visits(modal.member)}</dd>
          </dl>
          <div className="actions"><button className="btn ghost" onClick={close}>Close</button></div>
        </Modal>
      )}
    </>
  );
}
