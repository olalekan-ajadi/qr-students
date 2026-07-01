import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { processPhoto } from "../photo.js";
import { NG_STATES, FACULTIES } from "../data.js";
import PasswordInput from "../components/PasswordInput.jsx";
import { toast } from "../toast.jsx";

const EMPTY = {
  matric_no:"", full_name:"", faculty:"", department:"", level:"100",
  dob:"", sex:"", state_of_origin:"", phone:"", address:"",
  email:"", password:"",
};

export default function Register() {
  const nav = useNavigate();
  const [form, setForm]   = useState(EMPTY);
  const [photo, setPhoto] = useState(null);
  const [err, setErr]     = useState("");
  const [busy, setBusy]   = useState(false);

  // Changing faculty resets department so the filtered list stays valid.
  const upd = k => e => setForm(f => {
    const next = { ...f, [k]: e.target.value };
    if (k === "faculty") next.department = "";
    return next;
  });

  const depts = FACULTIES[form.faculty] || [];

  async function onPhoto(e) {
    setErr("");
    const file = e.target.files?.[0];
    if (!file) return;
    try { setPhoto(await processPhoto(file)); }
    catch (ex) { setPhoto(null); e.target.value = ""; setErr(ex.message); toast.error(ex.message); }
  }

  async function submit() {
    setErr("");

    // Client-side: check every required field before hitting the server.
    const required = [
      ["Matric Number",    form.matric_no],
      ["Full Name",        form.full_name],
      ["Faculty",          form.faculty],
      ["Department",       form.department],
      ["Date of Birth",    form.dob],
      ["Sex",              form.sex],
      ["State of Origin",  form.state_of_origin],
      ["Home Address",     form.address],
      ["Email",            form.email],
      ["Phone Number",     form.phone],
      ["Password",         form.password],
    ];
    const missing = required.filter(([, v]) => !v?.trim()).map(([k]) => k);
    if (missing.length) {
      const m = "Please fill in: " + missing.join(", ");
      setErr(m); toast.error(m);
      return;
    }
    if (!photo) { setErr("A valid passport photograph is required"); toast.error("A valid passport photograph is required"); return; }

    setBusy(true);
    try {
      const res = await api.register({ ...form, photo: photo.dataUrl });
      const m = res.message || "Registration received. Your account is awaiting admin approval.";
      toast.success(m);
      nav("/login", { state: { notice: m } });
    } catch (ex) { setErr(ex.message); toast.error(ex.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="login-page" style={{ alignItems: "flex-start", padding: "28px 16px" }}>
      <div className="login-card" style={{ maxWidth: 520, width: "100%", margin: "0 auto" }}>
        <div className="login-brand">
          <img src="/oui.png" alt="University logo" className="login-logo" style={{ width: 52, height: 52 }} />
          <h1 className="login-school" style={{ fontSize: 16 }}>Oduduwa University</h1>
        </div>
        <div className="login-divider" />
        <h1 style={{ fontSize: 18, margin: "0 0 4px", textAlign: "center" }}>Student Registration</h1>
        <p className="sub">Create your account. An administrator will review and activate it.</p>

        {err && <div className="alert err">{err}</div>}

        {/* ── Academic ── */}
        <p className="form-section-label">Academic Information</p>
        <div className="grid2">
          <div className="field">
            <label>Matric Number *</label>
            <input value={form.matric_no} onChange={upd("matric_no")} placeholder="CSC/2021/001" />
          </div>
          <div className="field">
            <label>Level *</label>
            <select value={form.level} onChange={upd("level")}>
              {["100","200","300","400","500"].map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Full Name *</label>
          <input value={form.full_name} onChange={upd("full_name")} placeholder="As it appears on official documents" />
        </div>
        <div className="field">
          <label>Faculty *</label>
          <select value={form.faculty} onChange={upd("faculty")}>
            <option value="">Select faculty…</option>
            {Object.keys(FACULTIES).map(f => <option key={f}>{f}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Department *</label>
          <select value={form.department} onChange={upd("department")} disabled={!form.faculty}>
            <option value="">
              {form.faculty ? "Select department…" : "Select a faculty first"}
            </option>
            {depts.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>

        {/* ── Personal ── */}
        <p className="form-section-label">Personal Information</p>
        <div className="grid2">
          <div className="field">
            <label>Date of Birth *</label>
            <input type="date" value={form.dob} onChange={upd("dob")} />
          </div>
          <div className="field">
            <label>Sex *</label>
            <select value={form.sex} onChange={upd("sex")}>
              <option value="">Select…</option>
              <option>Male</option>
              <option>Female</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label>State of Origin *</label>
          <select value={form.state_of_origin} onChange={upd("state_of_origin")}>
            <option value="">Select state…</option>
            {NG_STATES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Home Address *</label>
          <input value={form.address} onChange={upd("address")} placeholder="Street, City, State" />
        </div>

        {/* ── Contact & Access ── */}
        <p className="form-section-label">Contact & Access</p>
        <div className="grid2">
          <div className="field">
            <label>Email *</label>
            <input type="email" value={form.email} onChange={upd("email")} placeholder="you@university.edu.ng" />
          </div>
          <div className="field">
            <label>Phone Number *</label>
            <input value={form.phone} onChange={upd("phone")} placeholder="+234 800 000 0000" />
          </div>
        </div>
        <div className="field">
          <label>Password * <span className="muted" style={{fontWeight:400}}>(at least 8 characters)</span></label>
          <PasswordInput value={form.password} onChange={upd("password")}
            autoComplete="new-password" />
        </div>

        {/* ── Photo ── */}
        <p className="form-section-label">Passport Photograph *</p>
        <div className="field">
          <label>Upload photo — JPEG or PNG, portrait or square, head and shoulders, at least 300 × 300px, max 2 MB</label>
          <input type="file" accept="image/png,image/jpeg" onChange={onPhoto} />
        </div>
        {photo && (
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <img src={photo.dataUrl} alt="preview"
              style={{ width: 110, height: 110, objectFit: "cover", borderRadius: 10, border: "1px solid var(--line)" }} />
            <p className="muted" style={{ margin: "4px 0 0" }}>Photo looks valid ✓</p>
          </div>
        )}

        <button className="btn btn-primary" style={{ width: "100%", marginTop: 6 }}
          disabled={busy} onClick={submit}>
          {busy ? "Submitting…" : "Submit Registration"}
        </button>
        <p className="muted" style={{ textAlign: "center", marginTop: 14 }}>
          Already activated? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
