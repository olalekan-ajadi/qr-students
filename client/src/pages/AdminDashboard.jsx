import { useEffect, useState, useRef } from "react";
import TopBar from "../components/TopBar.jsx";
import Scanner from "../components/Scanner.jsx";
import { api } from "../api.js";
import { toast } from "../toast.jsx";
import PasswordInput from "../components/PasswordInput.jsx";
import { processPhoto } from "../photo.js";
import { NG_STATES, FACULTIES } from "../data.js";

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" });
}

export default function AdminDashboard() {
  const [tab, setTab] = useState("pending");
  return (
    <>
      <TopBar />
      <div className="wrap">
        <div className="tabs">
          {[["pending","Pending Approvals"],["rejected","Rejected"],["students","Students"],["verify","Verify QR"],["logs","Scan Logs"]].map(([k,l]) => (
            <div key={k} className={"tab"+(tab===k?" active":"")} onClick={() => setTab(k)}>{l}</div>
          ))}
        </div>
        {tab==="pending"  && <Pending />}
        {tab==="rejected" && <Rejected />}
        {tab==="students" && <Students />}
        {tab==="verify"   && <Verify />}
        {tab==="logs"     && <Logs />}
      </div>
    </>
  );
}

// ── Pending Approvals ─────────────────────────────────────
function Pending() {
  const [list, setList]       = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { setList(await api.listPending()); }
    catch(e) { toast.error(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function approve(id) {
    try { await api.approve(id); toast.success("Student approved and QR generated."); load(); }
    catch(e) { toast.error(e.message); }
  }
  async function reject(id) {
    if (!confirm("Reject this registration?")) return;
    try { await api.reject(id); toast.success("Registration rejected."); load(); }
    catch(e) { toast.error(e.message); }
  }

  return (
    <div className="card">
      <h2>Pending Registrations</h2>
      {loading && <p className="muted">Loading…</p>}
      {!loading && list.length===0 && <p className="muted">No pending registrations.</p>}
      <div className="pending-grid">
        {list.map(s => (
          <div className="pending-item" key={s.student_id}>
            {s.photo
              ? <img src={s.photo} alt={s.full_name} className="passport"/>
              : <div className="passport-placeholder">?</div>}
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"baseline",gap:8,flexWrap:"wrap"}}>
                <b style={{fontSize:15}}>{s.full_name}</b>
                <span className="muted" style={{fontSize:12}}>{s.matric_no}</span>
              </div>
              <div className="pending-meta">
                {s.faculty && <span>{s.faculty}</span>}
                <span>{s.department}</span>
                <span>{s.level}L</span>
              </div>
              <div className="pending-meta">
                {s.dob && <span>DOB: {fmtDate(s.dob)}</span>}
                {s.sex && <span>{s.sex}</span>}
                {s.state_of_origin && <span>{s.state_of_origin}</span>}
              </div>
              <div className="pending-meta">
                <span>{s.email}</span>
                {s.phone && <span>{s.phone}</span>}
              </div>
              <div style={{marginTop:10, display:"flex", gap:8}}>
                <button className="btn btn-teal btn-sm" onClick={() => approve(s.student_id)}>Approve</button>
                <button className="btn btn-danger btn-sm" onClick={() => reject(s.student_id)}>Reject</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
// ── Rejected Registrations ────────────────────────────────
function Rejected() {
  const [list, setList]       = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { setList(await api.listRejected()); }
    catch(e) { toast.error(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function restore(id) {
    try { await api.restoreStudent(id); toast.success("Moved back to pending approvals."); load(); }
    catch(e) { toast.error(e.message); }
  }
  async function remove(id) {
    if (!confirm("Permanently delete this rejected registration? This cannot be undone.")) return;
    try { await api.deleteStudent(id); toast.success("Registration permanently deleted."); load(); }
    catch(e) { toast.error(e.message); }
  }

  return (
    <div className="card">
      <h2>Rejected Registrations</h2>
      <p className="muted" style={{marginTop:-8,marginBottom:16}}>
        Rejected applications are kept here for reference. You can restore one to
        pending, or delete it permanently. A rejected applicant can still register
        again with the same details.
      </p>
      {loading && <p className="muted">Loading…</p>}
      {!loading && list.length===0 && <p className="muted">No rejected registrations.</p>}
      <div className="pending-grid">
        {list.map(s => (
          <div className="pending-item" key={s.student_id}>
            {s.photo
              ? <img src={s.photo} alt={s.full_name} className="passport"/>
              : <div className="passport-placeholder">?</div>}
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"baseline",gap:8,flexWrap:"wrap"}}>
                <b style={{fontSize:15}}>{s.full_name}</b>
                <span className="muted" style={{fontSize:12}}>{s.matric_no}</span>
                <span className="badge inactive">rejected</span>
              </div>
              <div className="pending-meta">
                {s.faculty && <span>{s.faculty}</span>}
                <span>{s.department}</span>
                <span>{s.level}L</span>
              </div>
              <div className="pending-meta">
                <span>{s.email}</span>
                {s.phone && <span>{s.phone}</span>}
              </div>
              <div style={{marginTop:10, display:"flex", gap:8}}>
                <button className="btn btn-outline btn-sm" onClick={() => restore(s.student_id)}>Restore to pending</button>
                <button className="btn btn-danger btn-sm" onClick={() => remove(s.student_id)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
// ── Students ──────────────────────────────────────────────
function Students() {
  const [list, setList]       = useState([]);
  const [loading, setLoading] = useState(true);
  // panel: null | { mode:"detail"|"edit"|"create", student?:{} }
  const [panel, setPanel]     = useState(null);

  async function load() {
    setLoading(true);
    try { setList(await api.listStudents()); }
    catch(e) { toast.error(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function openDetail(s) {
    try {
      const full = await api.getStudentDetail(s.student_id);
      setPanel({ mode:"detail", student: full });
    } catch(e) { toast.error(e.message); }
  }
  async function openEdit(s) {
    // Always load the full record — the table row omits DOB, sex, state,
    // phone and address, which would otherwise show as blank in the form.
    try {
      const full = await api.getStudentDetail(s.student_id);
      setPanel({ mode:"edit", student: full });
    } catch(e) { toast.error(e.message); }
  }
  function openCreate() { setPanel({ mode:"create" }); }
  function closePanel() { setPanel(null); }

  async function handleEdit(id, data) {
    await api.editStudent(id, data);
    load();
    const updated = await api.getStudentDetail(id);
    setPanel({ mode:"detail", student: updated });
    toast.success("Student details updated.");
  }
  async function handleCreate(data) {
    await api.createStudent(data);
    load();
    closePanel();
    toast.success("Student created and activated.");
  }
  async function del(id) {
    if (!confirm("Permanently delete this student?")) return;
    try { await api.deleteStudent(id); toast.success("Student deleted."); closePanel(); load(); }
    catch(e) { toast.error(e.message); }
  }

  const hasPanel = !!panel;
  const colSpan  = 7;

  return (
    <div className={hasPanel ? "grid2 students-grid" : ""}>
      {/* ── Table ── */}
      <div className="card" style={{minWidth:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <h2 style={{marginBottom:0}}>Active Students</h2>
          <button className="btn btn-primary btn-sm" onClick={openCreate}>+ Add Student</button>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Matric No</th><th>Name</th><th>Faculty</th><th>Dept</th>
                <th>Level</th><th>QR</th><th style={{minWidth:120}}></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={colSpan} className="muted">Loading…</td></tr>}
              {!loading && list.length===0 && <tr><td colSpan={colSpan} className="muted">No active students yet.</td></tr>}
              {list.map(s => (
                <tr key={s.student_id}
                    className={panel?.student?.student_id === s.student_id ? "row-selected" : ""}>
                  <td>{s.matric_no}</td>
                  <td>{s.full_name}</td>
                  <td>{s.faculty || "—"}</td>
                  <td>{s.department}</td>
                  <td>{s.level}</td>
                  <td>{s.qr_valid
                    ? <span className="badge verified">valid</span>
                    : <span className="badge mismatch">stale</span>}</td>
                  <td style={{whiteSpace:"nowrap"}}>
                    <button className="btn btn-outline btn-sm" onClick={() => openDetail(s)}>View</button>{" "}
                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(s)}>Edit</button>{" "}
                    <button className="btn btn-danger btn-sm" onClick={() => del(s.student_id)}>Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Side panel ── */}
      {hasPanel && (
        <div className="card side-panel" style={{minWidth:0}}>
          {panel.mode==="detail" && (
            <StudentDetail
              student={panel.student}
              onEdit={() => openEdit(panel.student)}
              onDelete={() => del(panel.student.student_id)}
              onClose={closePanel}
            />
          )}
          {panel.mode==="edit" && (
            <StudentForm
              title="Edit Student"
              initial={panel.student}
              onSave={data => handleEdit(panel.student.student_id, data)}
              onCancel={closePanel}
            />
          )}
          {panel.mode==="create" && (
            <StudentForm
              title="Add New Student"
              onSave={handleCreate}
              onCancel={closePanel}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Student Detail Panel ──────────────────────────────────
function StudentDetail({ student: s, onEdit, onDelete, onClose }) {
  const [qr, setQr] = useState(null);
  useEffect(() => {
    if (s.qr_valid)
      api.getQR(s.student_id).then(r => setQr(r.qr)).catch(() => {});
  }, [s.student_id, s.qr_valid]);

  return (
    <>
      <div className="panel-header">
        <h2 style={{marginBottom:0}}>Student Details</h2>
        <div style={{display:"flex",gap:6}}>
          <button className="btn btn-primary btn-sm" onClick={onEdit}>Edit</button>
          <button className="btn btn-danger btn-sm" onClick={onDelete}>Delete</button>
          <button className="btn btn-outline btn-sm" onClick={onClose}>✕</button>
        </div>
      </div>

      <div style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:18}}>
        {s.photo
          ? <img src={s.photo} alt={s.full_name}
              style={{width:90,height:90,objectFit:"cover",borderRadius:10,border:"1px solid var(--line)",flexShrink:0}}/>
          : <div className="passport-placeholder" style={{width:90,height:90,fontSize:28}}>?</div>}
        <div style={{minWidth:0}}>
          <div style={{fontSize:17,fontWeight:700,lineHeight:1.3}}>{s.full_name}</div>
          <div className="muted" style={{marginTop:2}}>{s.matric_no}</div>
          <div style={{marginTop:6}}>
            <span className="badge verified">active</span>
            {s.sex && <span className="badge" style={{background:"var(--light)",color:"var(--grey)",marginLeft:6}}>{s.sex}</span>}
          </div>
        </div>
      </div>

      <div className="detail-section">
        <div className="detail-heading">Academic</div>
        {[
          ["Faculty",    s.faculty],
          ["Department", s.department],
          ["Level",      s.level ? s.level+"L" : null],
          ["Enrolled",   fmtDate(s.created_at)],
        ].map(([k,v]) => v && (
          <div className="kv" key={k}><span>{k}</span><b>{v}</b></div>
        ))}
      </div>

      <div className="detail-section">
        <div className="detail-heading">Personal</div>
        {[
          ["Date of Birth",   fmtDate(s.dob)],
          ["Sex",             s.sex],
          ["State of Origin", s.state_of_origin],
          ["Address",         s.address],
        ].map(([k,v]) => v && v !== "—" && (
          <div className="kv" key={k}><span>{k}</span><b style={{maxWidth:160,textAlign:"right"}}>{v}</b></div>
        ))}
      </div>

      <div className="detail-section">
        <div className="detail-heading">Contact</div>
        {[
          ["Email", s.email],
          ["Phone", s.phone],
        ].map(([k,v]) => v && (
          <div className="kv" key={k}><span>{k}</span><b style={{wordBreak:"break-all"}}>{v}</b></div>
        ))}
      </div>

      {qr && (
        <div style={{textAlign:"center",marginTop:16}}>
          <div className="detail-heading" style={{marginBottom:8}}>QR Code</div>
          <img src={qr} alt="QR"
            style={{width:160,height:160,borderRadius:8,border:"1px solid var(--line)"}}/>
          <div style={{marginTop:8}}>
            <a className="btn btn-teal btn-sm" href={qr}
              download={`${s.matric_no.replace(/\//g,"-")}.png`}
              style={{textDecoration:"none"}}>Download QR</a>
          </div>
        </div>
      )}
      {!s.qr_valid && (
        <p className="muted" style={{marginTop:12,textAlign:"center"}}>
          No valid QR — student should log in to regenerate.
        </p>
      )}
    </>
  );
}

// ── Shared Student Form (Create & Edit) ──────────────────
function StudentForm({ title, initial = {}, onSave, onCancel }) {
  const blank = {
    matric_no:"", full_name:"", faculty:"", department:"", level:"100",
    dob:"", sex:"", state_of_origin:"", phone:"", address:"", email:"", password:"",
  };
  const toForm = s => ({
    ...blank,
    matric_no:       s.matric_no       || "",
    full_name:       s.full_name       || "",
    faculty:         s.faculty         || "",
    department:      s.department      || "",
    level:           s.level           || "100",
    dob:             s.dob ? s.dob.slice(0,10) : "",
    sex:             s.sex             || "",
    state_of_origin: s.state_of_origin || "",
    phone:           s.phone           || "",
    address:         s.address         || "",
    email:           s.email           || "",
    password:        "",
  });

  const [form, setForm]   = useState(() => toForm(initial));
  const [photo, setPhoto] = useState(initial.photo ? { dataUrl: initial.photo } : null);
  const [busy, setBusy]   = useState(false);
  const isEdit = !!initial.student_id;

  // Changing faculty clears department so the filtered list stays consistent.
  const upd = k => e => setForm(f => {
    const next = { ...f, [k]: e.target.value };
    if (k === "faculty") next.department = "";
    return next;
  });

  const depts = FACULTIES[form.faculty] || [];

  // Ensure a previously-saved value still appears as an option even if it is
  // not in the current list (e.g. a department from another faculty).
  const withCurrent = (opts, val) =>
    val && !opts.includes(val) ? [val, ...opts] : opts;

  async function onPhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const p = await processPhoto(file);
      setPhoto({ dataUrl: p.dataUrl });
    } catch (ex) {
      e.target.value = "";
      setPhoto(null);
      toast.error(ex.message);
    }
  }

  async function submit() {
    const required = [
      ["Matric Number", form.matric_no],
      ["Full Name",     form.full_name],
      ["Faculty",       form.faculty],
      ["Department",    form.department],
      ["Email",         form.email],
    ];
    if (!isEdit) required.push(["Initial Password", form.password]);
    const missing = required.filter(([, v]) => !String(v || "").trim()).map(([k]) => k);
    if (missing.length) { toast.error("Please fill in: " + missing.join(", ")); return; }
    if (!isEdit && form.password.length < 8) { toast.error("Password must be at least 8 characters."); return; }

    setBusy(true);
    try {
      const payload = { ...form };
      if (photo) payload.photo = photo.dataUrl;
      if (!payload.dob) delete payload.dob;
      await onSave(payload);
    } catch (ex) { toast.error(ex.message); }
    finally { setBusy(false); }
  }

  return (
    <>
      <div className="panel-header">
        <h2 style={{marginBottom:0}}>{title}</h2>
        <button className="btn btn-outline btn-sm" onClick={onCancel}>✕</button>
      </div>

      <p className="form-section-label">Academic</p>
      <div className="grid2">
        <div className="field">
          <label>Matric Number *</label>
          <input value={form.matric_no} onChange={upd("matric_no")}
            placeholder="CSC/2021/001"/>
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
        <input value={form.full_name} onChange={upd("full_name")}/>
      </div>
      <div className="field">
        <label>Faculty *</label>
        <select value={form.faculty} onChange={upd("faculty")}>
          <option value="">Select faculty…</option>
          {withCurrent(Object.keys(FACULTIES), form.faculty).map(f => <option key={f}>{f}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Department *</label>
        <select value={form.department} onChange={upd("department")} disabled={!form.faculty}>
          <option value="">
            {form.faculty ? "Select department…" : "Select a faculty first"}
          </option>
          {withCurrent(depts, form.department).map(d => <option key={d}>{d}</option>)}
        </select>
      </div>

      <p className="form-section-label">Personal</p>
      <div className="grid2">
        <div className="field">
          <label>Date of Birth</label>
          <input type="date" value={form.dob} onChange={upd("dob")}/>
        </div>
        <div className="field">
          <label>Sex</label>
          <select value={form.sex} onChange={upd("sex")}>
            <option value="">Select…</option>
            <option>Male</option><option>Female</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label>State of Origin</label>
        <select value={form.state_of_origin} onChange={upd("state_of_origin")}>
          <option value="">Select state…</option>
          {withCurrent(NG_STATES, form.state_of_origin).map(st => <option key={st}>{st}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Address</label>
        <input value={form.address} onChange={upd("address")} placeholder="Street, City, State"/>
      </div>

      <p className="form-section-label">Contact {isEdit ? "" : "& Access"}</p>
      <div className="grid2">
        <div className="field">
          <label>Email *</label>
          <input type="email" value={form.email} onChange={upd("email")}/>
        </div>
        <div className="field">
          <label>Phone</label>
          <input value={form.phone} onChange={upd("phone")} placeholder="+234 800 000 0000"/>
        </div>
      </div>
      {!isEdit && (
        <div className="field">
          <label>Initial Password * <span className="muted" style={{fontWeight:400}}>(min 8 chars)</span></label>
          <PasswordInput value={form.password} onChange={upd("password")}
            placeholder="Student will use this to log in" autoComplete="new-password"/>
        </div>
      )}

      <p className="form-section-label">Passport Photo</p>
      <div className="field">
        <label>{isEdit ? "Replace photo (optional)" : "Upload photo"} — JPEG/PNG, portrait or square, min 300×300px</label>
        <input type="file" accept="image/png,image/jpeg" onChange={onPhotoChange}/>
      </div>
      {photo && (
        <div style={{textAlign:"center",marginBottom:12}}>
          <img src={photo.dataUrl} alt="preview"
            style={{width:90,height:90,objectFit:"cover",borderRadius:10,border:"1px solid var(--line)"}}/>
        </div>
      )}

      <div style={{display:"flex",gap:8,marginTop:8}}>
        <button className="btn btn-primary" style={{flex:1}} disabled={busy} onClick={submit}>
          {busy ? "Saving…" : (isEdit ? "Save Changes" : "Create Student")}
        </button>
        <button className="btn btn-outline" onClick={onCancel}>Cancel</button>
      </div>
    </>
  );
}

// ── Verify QR ─────────────────────────────────────────────
function Verify() {
  const [payload, setPayload]   = useState("");
  const [res, setRes]           = useState(null);
  const [err, setErr]           = useState("");
  const [scanning, setScanning] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const lastScanAt = useRef(0);

  async function run(text) {
    if (!text?.trim()) return;
    setErr(""); setRes(null); setVerifying(true);
    try { setRes(await api.verify(text)); }
    catch(e) { setErr(e.message); }
    finally { setVerifying(false); }
  }

  // Camera scan callback — stays open, debounces at 3 s so the same
  // QR is not re-submitted while the result is still on screen.
  function onScan(text) {
    const now = Date.now();
    if (now - lastScanAt.current < 3000) return;
    lastScanAt.current = now;
    setPayload(text);
    run(text);
  }

  // Cancel resets the entire verify state and closes the camera.
  function cancel() {
    setScanning(false);
    setRes(null);
    setErr("");
    setPayload("");
    lastScanAt.current = 0;
  }

  return (
    <div className="grid2" style={{alignItems:"start"}}>
      {/* ── Left: scanner / paste area ── */}
      <div className="card">
        <h2>Verify QR Code</h2>

        {!scanning ? (
          <button className="btn btn-teal" style={{width:"100%"}}
            onClick={() => setScanning(true)}>
            Open Camera Scanner
          </button>
        ) : (
          <div className="scanner-wrap">
            <Scanner onScan={onScan}/>
            <p className="muted" style={{margin:"8px 0 4px",fontSize:12,textAlign:"center"}}>
              Camera active — present student QR code. Results update automatically.
            </p>
            <button className="btn btn-danger" style={{width:"100%"}} onClick={cancel}>
              ✕ Cancel Scan
            </button>
          </div>
        )}

        <p className="muted" style={{margin:"18px 0 6px"}}>Or paste the QR payload manually:</p>
        <textarea value={payload} onChange={e => setPayload(e.target.value)}
          placeholder="Paste encoded QR data here…" rows={3}/>
        <button className="btn btn-primary" style={{marginTop:8,width:"100%"}}
          disabled={verifying} onClick={() => run(payload)}>
          {verifying ? "Verifying…" : "Verify"}
        </button>
        {err && <div className="alert err" style={{marginTop:12}}>{err}</div>}
      </div>

      {/* ── Right: result ── */}
      <div className="card">
        <h2>Result</h2>
        {!res && !verifying && <p className="muted">Scan a QR code or paste a payload to see the result.</p>}
        {verifying && <p className="muted">Checking…</p>}
        {res && (
          <div className={"result-card " + (res.valid ? "good" : "bad")}>
            {/* Status header */}
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
              <span style={{fontSize:28}}>{res.valid ? "✓" : "✗"}</span>
              <div>
                <div style={{fontWeight:700,fontSize:16}}>
                  {res.valid ? "Student Verified" : "Not Verified"}
                </div>
                <span className={"badge " + res.result}>{res.result}</span>
              </div>
              {res.student?.photo && (
                <img src={res.student.photo} alt={res.student.full_name}
                  style={{width:64,height:64,objectFit:"cover",borderRadius:8,
                          border:"2px solid "+(res.valid?"#2A9D8F":"#d9534f"),
                          marginLeft:"auto",flexShrink:0}}/>
              )}
            </div>

            {res.student ? (
              <>
                <div className="kv"><span>Matric No</span><b>{res.student.matric_no}</b></div>
                <div className="kv"><span>Name</span><b>{res.student.full_name}</b></div>
                {res.student.faculty &&
                  <div className="kv"><span>Faculty</span><b>{res.student.faculty}</b></div>}
                <div className="kv"><span>Department</span><b>{res.student.department}</b></div>
                <div className="kv"><span>Level</span><b>{res.student.level}L</b></div>
                {res.student.sex &&
                  <div className="kv"><span>Sex</span><b>{res.student.sex}</b></div>}
                {res.student.state_of_origin &&
                  <div className="kv"><span>State</span><b>{res.student.state_of_origin}</b></div>}

                {res.cardUrl && (
                  <a href={res.cardUrl} target="_blank" rel="noreferrer"
                    className="btn btn-teal btn-sm"
                    style={{textDecoration:"none",display:"inline-block",marginTop:14}}>
                    View PDF Card
                  </a>
                )}
              </>
            ) : (
              <p className="muted">No matching student record found.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Scan Logs ─────────────────────────────────────────────
function Logs() {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.logs().then(setLogs).catch(() => {}).finally(() => setLoading(false));
  }, []);
  return (
    <div className="card">
      <h2>Recent Scan Logs</h2>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Time</th><th>Matric No</th><th>Name</th><th>Result</th><th>Scanned By</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan="5" className="muted">Loading…</td></tr>}
            {!loading && logs.length===0 && <tr><td colSpan="5" className="muted">No scans recorded.</td></tr>}
            {logs.map(l => (
              <tr key={l.log_id}>
                <td>{new Date(l.scanned_at).toLocaleString()}</td>
                <td>{l.matric_no||"—"}</td>
                <td>{l.full_name||"—"}</td>
                <td><span className={"badge "+l.result}>{l.result}</span></td>
                <td>{l.scanned_by}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
