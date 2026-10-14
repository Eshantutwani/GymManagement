import { useState } from "react";
import { listTrainers, listMembers, saveTrainer, deleteTrainer } from "../../firebase/services";
import { useLoad } from "../../hooks";
import { errMsg } from "../../utils";
import { Loading, ErrorBox, PageHead, DataTable, Empty, Modal, ConfirmDialog, Field, useToast } from "../../components/ui";

function TrainerForm({ trainer, members, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({ fullName: trainer?.fullName || "", email: trainer?.email || "", phone: trainer?.phone || "", specialization: trainer?.specialization || "", assignedMembers: trainer?.assignedMembers || [] });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggle = (id) => setF({ ...f, assignedMembers: f.assignedMembers.includes(id) ? f.assignedMembers.filter((x) => x !== id) : [...f.assignedMembers, id] });
  async function submit(e) {
    e.preventDefault();
    const v = {};
    if (f.fullName.trim().length < 2) v.fullName = "Enter the trainer's full name";
    if (!/^\S+@\S+\.\S+$/.test(f.email)) v.email = "Enter a valid email address";
    if (!/^[0-9+\-\s]{7,15}$/.test(f.phone)) v.phone = "Enter a valid phone number";
    if (!f.specialization.trim()) v.specialization = "Add a specialization";
    setErr(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    try { await saveTrainer({ ...f, id: trainer?.id }); toast("Trainer saved"); onSaved(); onClose(); }
    catch (x) { toast(errMsg(x), "error"); setBusy(false); }
  }
  return (
    <Modal title={trainer ? "Edit trainer" : "Add trainer"} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <Field label="Full name" error={err.fullName}><input value={f.fullName} onChange={set("fullName")} /></Field>
        <div className="grid2">
          <Field label="Email" error={err.email}><input type="email" value={f.email} onChange={set("email")} /></Field>
          <Field label="Phone" error={err.phone}><input value={f.phone} onChange={set("phone")} /></Field>
        </div>
        <Field label="Specialization" error={err.specialization}><input value={f.specialization} onChange={set("specialization")} /></Field>
        <div className="field"><span>Assigned members ({f.assignedMembers.length})</span>
          <div className="checklist">{members.length ? members.map((m) => <label key={m.id}><input type="checkbox" checked={f.assignedMembers.includes(m.id)} onChange={() => toggle(m.id)} />{m.fullName}</label>) : <span className="muted">No members yet</span>}</div>
        </div>
        <div className="actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" disabled={busy}>{busy ? "Saving…" : "Save trainer"}</button></div>
      </form>
    </Modal>
  );
}

export default function Trainers() {
  const { data, loading, error, reload } = useLoad(async () => ({ trainers: await listTrainers(), members: await listMembers() }));
  const toast = useToast();
  const [modal, setModal] = useState(null);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const name = Object.fromEntries(data.members.map((m) => [m.id, m.fullName]));
  const close = () => setModal(null);
  const del = async () => { try { await deleteTrainer(modal.trainer.id); toast("Trainer removed"); close(); reload(); } catch (x) { toast(errMsg(x), "error"); } };

  return (
    <>
      <PageHead title="Trainers" sub={`${data.trainers.length} on staff`}><button className="btn" onClick={() => setModal({ type: "form" })}>Add trainer</button></PageHead>
      <DataTable rows={data.trainers} empty={<Empty title="No trainers yet" hint="Add a trainer and assign members to them." />}
        columns={[
          { key: "fullName", label: "Name", render: (t) => <><strong>{t.fullName}</strong><div className="muted small">{t.email}</div></> },
          { key: "phone", label: "Phone" },
          { key: "specialization", label: "Specialization" },
          { key: "n", label: "Members", sortValue: (t) => t.assignedMembers?.length || 0, render: (t) => (t.assignedMembers || []).map((id) => name[id]).filter(Boolean).slice(0, 3).join(", ") + ((t.assignedMembers?.length || 0) > 3 ? ` +${t.assignedMembers.length - 3}` : "") || "None" },
          { key: "a", label: "", sortable: false, render: (t) => <div className="row-actions"><button className="btn ghost sm" onClick={() => setModal({ type: "view", trainer: t })}>View</button><button className="btn ghost sm" onClick={() => setModal({ type: "form", trainer: t })}>Edit</button><button className="btn ghost sm" onClick={() => setModal({ type: "delete", trainer: t })}>Remove</button></div> },
        ]} />
      {modal?.type === "form" && <TrainerForm trainer={modal.trainer} members={data.members} onClose={close} onSaved={reload} />}
      {modal?.type === "delete" && <ConfirmDialog title="Remove trainer?" confirmLabel="Remove" message={`Remove ${modal.trainer.fullName}? Their assigned members stay in the system.`} onConfirm={del} onCancel={close} />}
      {modal?.type === "view" && (
        <Modal title={modal.trainer.fullName} onClose={close}>
          <dl className="kv"><dt>Email</dt><dd>{modal.trainer.email}</dd><dt>Phone</dt><dd>{modal.trainer.phone}</dd><dt>Specialization</dt><dd>{modal.trainer.specialization}</dd>
            <dt>Assigned members</dt><dd>{(modal.trainer.assignedMembers || []).map((id) => name[id]).filter(Boolean).join(", ") || "None"}</dd></dl>
          <div className="actions"><button className="btn ghost" onClick={close}>Close</button></div>
        </Modal>
      )}
    </>
  );
}
