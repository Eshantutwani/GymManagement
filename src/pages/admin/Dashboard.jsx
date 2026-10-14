import { loadAll } from "../../firebase/services";
import { useLoad } from "../../hooks";
import { fmtDate, fmtMoney, fmtTime, lastMonths, memberStatus, monthKey, toDate } from "../../utils";
import { Loading, ErrorBox, StatCard, PageHead, DataTable, Empty, Badge } from "../../components/ui";
import { BarChart, DonutChart, COLORS } from "../../components/charts";

export default function Dashboard() {
  const { data, loading, error, reload } = useLoad(() => loadAll(30));
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const { members, payments, trainers, attendance } = data;
  const name = Object.fromEntries(members.map((m) => [m.id, m.fullName]));
  const counts = { active: 0, expiring: 0, expired: 0, pending: 0 };
  members.forEach((m) => counts[memberStatus(m)]++);
  const paid = payments.filter((p) => p.status === "paid");
  const thisMonth = monthKey(new Date());
  const revMonth = paid.filter((p) => monthKey(toDate(p.paymentDate)) === thisMonth).reduce((s, p) => s + p.amount, 0);
  const revTotal = paid.reduce((s, p) => s + p.amount, 0);
  const months = lastMonths(6);
  const monthly = months.map((m) => paid.filter((p) => monthKey(toDate(p.paymentDate)) === m.key).reduce((s, p) => s + p.amount, 0));

  return (
    <>
      <PageHead title="Dashboard" sub="Live numbers from Firestore." />
      <div className="stats">
        <StatCard label="Registered members" value={members.length} />
        <StatCard label="Active memberships" value={counts.active + counts.expiring} hint={`${counts.expiring} expiring within 7 days`} />
        <StatCard label="Expired memberships" value={counts.expired} />
        <StatCard label="Trainers" value={trainers.length} />
        <StatCard label="Revenue this month" value={fmtMoney(revMonth)} tone="accent" hint={`${fmtMoney(revTotal)} all time`} />
      </div>
      <div className="cols">
        <div className="panel"><h3>Membership distribution</h3>
          {members.length ? <div className="chart-box"><DonutChart labels={["Active", "Expiring soon", "Expired", "No plan"]} data={[counts.active, counts.expiring, counts.expired, counts.pending]} colors={[COLORS.active, COLORS.expiring, COLORS.expired, COLORS.pending]} /></div> : <Empty title="No members yet" />}
        </div>
        <div className="panel"><h3>Monthly revenue</h3>
          <div className="chart-box"><BarChart labels={months.map((m) => m.label)} data={monthly} label="Revenue" money /></div>
        </div>
      </div>
      <div className="cols">
        <div className="panel"><h3>Recent payments</h3>
          <DataTable pageSize={5} rows={payments.slice(0, 5)} empty={<Empty title="No payments recorded" />} columns={[
            { key: "m", label: "Member", sortable: false, render: (p) => name[p.memberId] || "Removed member" },
            { key: "amount", label: "Amount", render: (p) => fmtMoney(p.amount) },
            { key: "d", label: "Date", sortable: false, render: (p) => fmtDate(p.paymentDate) },
            { key: "status", label: "Status", sortable: false, render: (p) => <Badge status={p.status} /> },
          ]} />
        </div>
        <div className="panel"><h3>Recent attendance</h3>
          <DataTable pageSize={5} rows={attendance.slice(0, 5)} empty={<Empty title="No check-ins yet" />} columns={[
            { key: "m", label: "Member", sortable: false, render: (a) => name[a.memberId] || "Removed member" },
            { key: "date", label: "Date", sortable: false },
            { key: "in", label: "In", sortable: false, render: (a) => fmtTime(a.checkInTime) },
            { key: "out", label: "Out", sortable: false, render: (a) => fmtTime(a.checkOutTime) },
          ]} />
        </div>
      </div>
    </>
  );
}
