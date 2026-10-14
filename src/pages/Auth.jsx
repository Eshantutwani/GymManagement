import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../firebase/auth";
import { Field, useToast } from "../components/ui";
import { errMsg } from "../utils";

function useRedirect() {
  const { user, isAdmin, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (!loading && user) nav(isAdmin ? "/admin" : "/member", { replace: true }); }, [user, isAdmin, loading, nav]);
}
const EMAIL = /^\S+@\S+\.\S+$/;

export function Login() {
  useRedirect();
  const { login } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ email: "", password: "" });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    const v = {};
    if (!EMAIL.test(f.email)) v.email = "Enter a valid email address";
    if (!f.password) v.password = "Enter your password";
    setErr(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    try { await login(f.email.trim(), f.password); } catch (x) { toast(errMsg(x), "error"); setBusy(false); }
  }
  return (
    <div className="auth"><div className="auth-card">
      <h2>Log in</h2><p className="muted">Admins and members sign in here.</p>
      <form onSubmit={submit} noValidate>
        <Field label="Email" error={err.email}><input type="email" autoComplete="email" value={f.email} onChange={set("email")} /></Field>
        <Field label="Password" error={err.password}><input type="password" autoComplete="current-password" value={f.password} onChange={set("password")} /></Field>
        <button className="btn" disabled={busy}>{busy ? "Signing in…" : "Log in"}</button>
      </form>
      <p className="muted small" style={{ marginTop: "1rem" }}>New here? <Link to="/register">Create an account</Link> · <Link to="/">Back to home</Link></p>
    </div></div>
  );
}

export function Register() {
  useRedirect();
  const { register } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ fullName: "", email: "", phone: "", dateOfBirth: "", password: "", confirm: "" });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    const v = {};
    if (f.fullName.trim().length < 2) v.fullName = "Enter your full name";
    if (!EMAIL.test(f.email)) v.email = "Enter a valid email address";
    if (!/^[0-9+\-\s]{7,15}$/.test(f.phone)) v.phone = "Enter a valid phone number";
    if (f.dateOfBirth && new Date(f.dateOfBirth) > new Date()) v.dateOfBirth = "Date of birth can't be in the future";
    if (f.password.length < 8) v.password = "Use at least 8 characters";
    if (f.confirm !== f.password) v.confirm = "Passwords don't match";
    setErr(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      await register({ fullName: f.fullName.trim(), email: f.email.trim(), phone: f.phone.trim(), dateOfBirth: f.dateOfBirth, password: f.password });
      toast("Account created");
    } catch (x) { toast(errMsg(x), "error"); setBusy(false); }
  }
  return (
    <div className="auth"><div className="auth-card">
      <h2>Create your account</h2><p className="muted">The front desk will assign your plan after you join.</p>
      <form onSubmit={submit} noValidate>
        <Field label="Full name" error={err.fullName}><input value={f.fullName} onChange={set("fullName")} autoComplete="name" /></Field>
        <Field label="Email" error={err.email}><input type="email" value={f.email} onChange={set("email")} autoComplete="email" /></Field>
        <div className="grid2">
          <Field label="Phone" error={err.phone}><input value={f.phone} onChange={set("phone")} autoComplete="tel" /></Field>
          <Field label="Date of birth" error={err.dateOfBirth}><input type="date" value={f.dateOfBirth} onChange={set("dateOfBirth")} /></Field>
        </div>
        <Field label="Password" error={err.password}><input type="password" value={f.password} onChange={set("password")} autoComplete="new-password" /></Field>
        <Field label="Confirm password" error={err.confirm}><input type="password" value={f.confirm} onChange={set("confirm")} autoComplete="new-password" /></Field>
        <button className="btn" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
      </form>
      <p className="muted small" style={{ marginTop: "1rem" }}>Already a member? <Link to="/login">Log in</Link> · <Link to="/">Back to home</Link></p>
    </div></div>
  );
}
