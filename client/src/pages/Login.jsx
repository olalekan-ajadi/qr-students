import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { api, setSession } from "../api.js";
import PasswordInput from "../components/PasswordInput.jsx";

export default function Login() {
  const { state } = useLocation();
  const [notice, setNotice]     = useState(state?.notice || "");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr]           = useState("");
  const [busy, setBusy]         = useState(false);
  const nav = useNavigate();

  // Surface a notice left by the API layer (e.g. after a session expired).
  useEffect(() => {
    const n = sessionStorage.getItem("authNotice");
    if (n) { setNotice(n); sessionStorage.removeItem("authNotice"); }
  }, []);

  async function submit() {
    setErr(""); setBusy(true);
    try {
      const res = await api.login(email.trim(), password);
      setSession(res, res.role);
      nav(res.role === "admin" ? "/admin" : "/student");
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

        <div className="login-divider" />

        <p className="sub">E-Students QR System — Sign in to continue</p>

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

        <button className="btn btn-primary" style={{width:"100%", marginTop:6}}
          disabled={busy} onClick={submit}>
          {busy ? "Signing in…" : "Sign In"}
        </button>

        <p className="muted" style={{textAlign:"center", marginTop:14}}>
          New student? <Link to="/register">Register here</Link>
        </p>
      </div>
    </div>
  );
}
