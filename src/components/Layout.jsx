import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../firebase/auth";
import { Icon } from "./ui";

const ADMIN_NAV = [
  ["/admin", "Dashboard", "dash", true],
  ["/admin/members", "Members", "users"],
  ["/admin/plans", "Memberships", "tag"],
  ["/admin/payments", "Payments", "card"],
  ["/admin/attendance", "Attendance", "cal"],
  ["/admin/trainers", "Trainers", "dumbbell"],
  ["/admin/reports", "Reports", "chart"],
];

export default function Layout({ admin }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const signOut = async () => { await logout(); nav("/"); };
  return (
    <div className="shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand">Forge<span>Fitness Club</span></div>
        <nav onClick={() => setOpen(false)}>
          {admin
            ? ADMIN_NAV.map(([to, label, icon, end]) => <NavLink key={to} to={to} end={end}><Icon name={icon} />{label}</NavLink>)
            : <NavLink to="/member" end><Icon name="dash" />My membership</NavLink>}
        </nav>
        <div className="side-foot">
          <span className="muted small">{user?.displayName || user?.email}</span>
          <button className="btn ghost sm" onClick={signOut}><Icon name="out" size={16} />Log out</button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="btn ghost sm menu-btn" onClick={() => setOpen(!open)} aria-label="Toggle navigation"><Icon name="menu" /></button>
          <span className="brand-mini">Forge</span>
        </header>
        <main className="content"><Outlet /></main>
      </div>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
    </div>
  );
}
