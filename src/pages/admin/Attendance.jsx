import { useMemo, useState } from "react";
import { loadAll, checkIn, checkOut } from "../../firebase/services";
import { useLoad } from "../../hooks";
import { fmtTime, errMsg, dateKey, memberStatus } from "../../utils";
import { Loading, ErrorBox, PageHead, StatCard, DataTable, Empty, Field, useToast } from "../../components/ui";

export default function Attendance() {
  const { data, loading, error, reload } = useLoad(() => loadAll(30));
  const toast = useToast();
  const [memberId, setMemberId] = useState("");
  const [day, setDay] = useState(dateKey());
  const [busy, setBusy] = useState(false);
  const name = useMemo(() => Object.fromEntries((data?.members || []).map((m) => [m.id, m.fullName])), [data]);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const today = dateKey();
  const todays = data.attendance.filter((a) => a.date === today);
  const inside = todays.filter((a) => !a.checkOutTime).length;
  const week = data.attendance.filter((a) => a.date >= dateKey(new Date(Date.now() - 6 * 86400000))).length;
  const rows = data.attendance.filter((a) => (day ? a.date === day : true));
  const selected = data.members.find((m) => m.id === (memberId || data.members[0]?.id));

  const run = async (fn, ok) => {
    const id = selected?.id;
    if (!id) return toast("Choose a member first", "error");
    setBusy(true);
    try { await fn(id); toast(ok); reload(); } catch (x) { toast(errMsg(x), "error"); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHead title="Attendance" sub="One check-in per member per day." />
      <div className="stats">
        <StatCard label="Checked in today" value={todays.length} />
        <StatCard label="In the gym now" value={inside} tone="accent" />
        <StatCard label="Check-ins, last 7 days" value={week} />
      </div>
      <div className="panel">
        {!data.members.length ? <Empty title="No members yet" hint="Add members before recording attendance." /> : (
          <div className="toolbar" style={{ alignItems: "flex-end", marginBottom: 0 }}>
            <Field label="Member"><select value={selected?.id || ""} onChange={(e) => setMemberId(e.target.value)}>{data.members.map((m) => <option key={m.id} value={m.id}>{m.fullName}</option>)}</select></Field>
            <button className="btn" style={{ marginBottom: ".9rem" }} disabled={busy} onClick={() => run(checkIn, "Checked in")}>Check in</button>
            <button className="btn ghost" style={{ marginBottom: ".9rem" }} disabled={busy} onClick={() => run(checkOut, "Checked out")}>Check out</button>
            {selected && ["expired", "pending"].includes(memberStatus(selected)) && <span className="muted small" style={{ marginBottom: "1rem" }}>Heads up: this member's plan is {memberStatus(selected) === "pending" ? "not assigned" : "expired"}.</span>}
          </div>
        )}
      </div>
      <div className="toolbar" style={{ alignItems: "center" }}>
        <input type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} aria-label="Filter by date" />
        <button className="btn ghost sm" onClick={() => setDay("")}>Show last 30 days</button>
      </div>
      <DataTable rows={rows} empty={<Empty title="No check-ins for this view" hint="Pick another date or record a check-in above." />}
        columns={[
          { key: "m", label: "Member", sortValue: (a) => name[a.memberId] || "", render: (a) => name[a.memberId] || "Removed member" },
          { key: "date", label: "Date" },
          { key: "in", label: "Check-in", sortable: false, render: (a) => fmtTime(a.checkInTime) },
          { key: "out", label: "Check-out", sortable: false, render: (a) => fmtTime(a.checkOutTime) },
        ]} />
    </>
  );
}
