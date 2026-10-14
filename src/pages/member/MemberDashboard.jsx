import { useEffect, useState } from "react";
import { useAuth } from "../../firebase/auth";
import { subscribeMember, listPlans, listMemberPayments, listMemberAttendance } from "../../firebase/services";
import { useLoad } from "../../hooks";
import { daysLeft, fmtDate, fmtMoney, fmtTime, memberStatus } from "../../utils";
import { Loading, ErrorBox, PageHead, StatCard, DataTable, Empty, Badge } from "../../components/ui";

export default function MemberDashboard() {
  const { user } = useAuth();
  const [member, setMember] = useState(undefined); // undefined = loading, null = no profile
  const [subError, setSubError] = useState(null);

  // Real-time listener: updates the moment the front desk assigns a plan.
  useEffect(() => subscribeMember(user.uid, setMember, setSubError), [user.uid]);

  const { data, loading, error, reload } = useLoad(async () => {
    const [plans, payments, attendance] = await Promise.all([listPlans(), listMemberPayments(user.uid), listMemberAttendance(user.uid)]);
    return { plans, payments, attendance };
  }, [user.uid, member?.membershipEndDate?.seconds]);

  if (subError) return <ErrorBox error={subError} />;
  if (member === undefined || (loading && !data)) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (member === null) return <Empty title="No member profile found" hint="Your login works, but the gym hasn't set up a member record for you yet. Ask the front desk." />;

  const status = memberStatus(member);
  const left = daysLeft(member);
  const plan = data.plans.find((p) => p.id === member.membershipId);

  return (
    <>
      <PageHead title={`Hi, ${member.fullName.split(" ")[0]}`} sub="Your membership at a glance." />
      {status === "expiring" && <div className="banner">Your membership ends in {left} day{left === 1 ? "" : "s"} ({fmtDate(member.membershipEndDate)}). Visit the front desk to renew.</div>}
      {status === "expired" && <div className="banner bad">Your membership expired on {fmtDate(member.membershipEndDate)}. Visit the front desk to renew.</div>}
      {status === "pending" && <div className="banner">You don't have a plan yet. The front desk will assign one after your first visit.</div>}
      <div className="stats">
        <StatCard label="Status" value={<Badge status={status} />} />
        <StatCard label="Plan" value={plan?.planName || "—"} />
        <StatCard label="Expires" value={fmtDate(member.membershipEndDate)} hint={left > 0 ? `${left} days left` : undefined} tone="accent" />
        <StatCard label="Total visits" value={data.attendance.length} />
      </div>
      <div className="panel"><h3>Profile</h3>
        <dl className="kv"><dt>Name</dt><dd>{member.fullName}</dd><dt>Email</dt><dd>{member.email}</dd><dt>Phone</dt><dd>{member.phone}</dd><dt>Joined</dt><dd>{fmtDate(member.joinedAt)}</dd></dl>
      </div>
      <div className="cols">
        <div className="panel"><h3>Payment history</h3>
          <DataTable pageSize={5} rows={data.payments} empty={<Empty title="No payments yet" />} columns={[
            { key: "d", label: "Date", sortable: false, render: (p) => fmtDate(p.paymentDate) },
            { key: "amount", label: "Amount", render: (p) => fmtMoney(p.amount) },
            { key: "paymentMethod", label: "Method" },
            { key: "status", label: "Status", sortable: false, render: (p) => <Badge status={p.status} /> },
          ]} />
        </div>
        <div className="panel"><h3>Attendance history</h3>
          <DataTable pageSize={5} rows={data.attendance} empty={<Empty title="No visits recorded yet" />} columns={[
            { key: "date", label: "Date" },
            { key: "in", label: "In", sortable: false, render: (a) => fmtTime(a.checkInTime) },
            { key: "out", label: "Out", sortable: false, render: (a) => fmtTime(a.checkOutTime) },
          ]} />
        </div>
      </div>
    </>
  );
}
