import { loadAll } from "../../firebase/services";
import { useLoad } from "../../hooks";
import { dateKey, downloadCSV, fmtDate, lastMonths, memberStatus, monthKey, toDate } from "../../utils";
import { Loading, ErrorBox, PageHead, useToast } from "../../components/ui";
import { BarChart, DonutChart, LineChart, COLORS } from "../../components/charts";

export default function Reports() {
  const { data, loading, error, reload } = useLoad(() => loadAll(30));
  const toast = useToast();
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const { members, payments, attendance, plans } = data;
  const name = Object.fromEntries(members.map((m) => [m.id, m.fullName]));
  const plan = Object.fromEntries(plans.map((p) => [p.id, p.planName]));

  const months = lastMonths(6);
  const paid = payments.filter((p) => p.status === "paid");
  const revenue = months.map((m) => paid.filter((p) => monthKey(toDate(p.paymentDate)) === m.key).reduce((s, p) => s + p.amount, 0));
  const regs = months.map((m) => members.filter((x) => x.joinedAt && monthKey(toDate(x.joinedAt)) === m.key).length);
  const counts = { active: 0, expiring: 0, expired: 0, pending: 0 };
  members.forEach((m) => counts[memberStatus(m)]++);
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (13 - i)); return { key: dateKey(d), label: `${d.getDate()}/${d.getMonth() + 1}` }; });
  const perDay = days.map((d) => attendance.filter((a) => a.date === d.key).length);

  const exp = (file, rows) => (downloadCSV(file, rows) ? toast("Report downloaded") : toast("Nothing to export yet", "error"));
  const exportMembers = () => exp("members.csv", members.map((m) => ({ Name: m.fullName, Email: m.email, Phone: m.phone, Plan: plan[m.membershipId] || "", Start: fmtDate(m.membershipStartDate), End: fmtDate(m.membershipEndDate), Status: memberStatus(m) })));
  const exportPayments = () => exp("payments.csv", payments.map((p) => ({ Member: name[p.memberId] || "Removed member", Amount: p.amount, Date: fmtDate(p.paymentDate), Method: p.paymentMethod, Status: p.status })));
  const exportAttendance = () => exp("attendance-last-30-days.csv", attendance.map((a) => ({ Member: name[a.memberId] || "Removed member", Date: a.date, CheckIn: a.checkInTime?.toDate?.().toLocaleTimeString() || "", CheckOut: a.checkOutTime?.toDate?.().toLocaleTimeString() || "" })));

  return (
    <>
      <PageHead title="Reports" sub="Charts use live Firestore data.">
        <button className="btn ghost" onClick={exportMembers}>Export members</button>
        <button className="btn ghost" onClick={exportPayments}>Export payments</button>
        <button className="btn ghost" onClick={exportAttendance}>Export attendance</button>
      </PageHead>
      <div className="cols">
        <div className="panel"><h3>Monthly revenue (paid)</h3><div className="chart-box"><BarChart labels={months.map((m) => m.label)} data={revenue} label="Revenue" money /></div></div>
        <div className="panel"><h3>Active vs expired memberships</h3><div className="chart-box"><DonutChart labels={["Active", "Expiring soon", "Expired", "No plan"]} data={[counts.active, counts.expiring, counts.expired, counts.pending]} colors={[COLORS.active, COLORS.expiring, COLORS.expired, COLORS.pending]} /></div></div>
        <div className="panel"><h3>Attendance, last 14 days</h3><div className="chart-box"><LineChart labels={days.map((d) => d.label)} data={perDay} label="Check-ins" /></div></div>
        <div className="panel"><h3>New members per month</h3><div className="chart-box"><BarChart labels={months.map((m) => m.label)} data={regs} label="New members" /></div></div>
      </div>
    </>
  );
}
