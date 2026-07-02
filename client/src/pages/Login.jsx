import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api, setSession, clearSession } from "../api.js";
import PasswordInput from "../components/PasswordInput.jsx";

// Role-aware login. Rendered as two distinct interfaces:
//   /admin/login   → <Login role="admin" />
//   /student/login → <Login role="student" />
// Each only accepts its own account type and only the student screen offers
// registration.
const ROLE = {
  admin: {
    title: "Administrator Login",
    sub: "Staff access — manage students, approvals and QR verification.",
    accent: "navy",
    btn: "btn-primary",
    other: { label: "I'm a student", to: "/student/login" },
  },
  student: {
    title: "Student Login",
    sub: "Sign in to view your profile and QR identity card.",
    accent: "teal",
    btn: "btn-teal",
    other: { label: "I'm an administrator", to: "/admin/login" },
  },
};

const ShieldIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);
const CapIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10 12 5 2 10l10 5 10-5z" /><path d="M6 12v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" />
  </svg>
);

export default function Login({ role = "student" }) {
  const cfg = ROLE[role] || ROLE.student;
  const [notice, setNotice]     = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr]           = useState("");
  const [busy, setBusy]         = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    const n = sessionStorage.getItem("authNotice");
    if (n) { setNotice(n); sessionStorage.removeItem("authNotice"); }
  }, []);

  async function submit() {
    setErr(""); setNotice(""); setBusy(true);
    try {
      const res = await api.login(email.trim(), password);
      if (res.role !== role) {
        clearSession(res.role);
        setErr(role === "admin"
          ? "Those credentials belong to a student account. Please use the Student login."
          : "Those credentials belong to an administrator account. Please use the Administrator login.");
        return;
      }
      setSession(res, res.role);
      nav(role === "admin" ? "/admin" : "/student");
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <img src="/oui.png" alt="University logo" className="login-logo" />
          <h1 className="login-school">Oduduwa University</h1>
          <p className="login-tagline">Learning For Human Development</p>
        </div>

        <div className={"role-banner " + cfg.accent}>
          <span className="role-ic" aria-hidden="true">
            {role === "admin" ? <ShieldIcon /> : <CapIcon />}
          </span>
          {cfg.title}
        </div>

        <p className="sub" style={{marginTop:14}}>{cfg.sub}</p>

        {notice && <div className="alert ok" style={{marginBottom:14}}>{notice}</div>}
        {err    && <div className="alert err" style={{marginBottom:14}}>{err}</div>}

        <div className="field">
          <label>Email</label>
          <input value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
            placeholder="you@university.edu.ng" autoComplete="email" />
        </div>
        <div className="field">
          <label>Password</label>
          <PasswordInput value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
            autoComplete="current-password" />
        </div>

        <button className={"btn " + cfg.btn} style={{width:"100%", marginTop:6}}
          disabled={busy} onClick={submit}>
          {busy ? "Signing in…" : "Sign In"}
        </button>

        {role === "student" && (
          <p className="muted" style={{textAlign:"center", marginTop:14}}>
            New student? <Link to="/register">Register here</Link>
          </p>
        )}

        <div className="login-alt">
          <Link to={cfg.other.to}>{cfg.other.label}</Link>
          <span>·</span>
          <Link to="/">Home</Link>
        </div>
      </div>
    </div>
  );
}
