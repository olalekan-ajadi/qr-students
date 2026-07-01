import { useEffect, useState } from "react";
import TopBar from "../components/TopBar.jsx";
import { api } from "../api.js";
import { toast } from "../toast.jsx";

export default function StudentPortal() {
  const [me, setMe] = useState(null);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ full_name:"", department:"", level:"100" });
  const [busy, setBusy] = useState(false);

  async function load(){
    try{
      const data = await api.myProfile();
      setMe(data);
      setForm({ full_name:data.full_name, department:data.department, level:data.level });
    }catch(e){ setErr(e.message); }
  }
  useEffect(()=>{ load(); }, []);

  async function save(){
    if (!form.full_name.trim() || !form.department.trim()) {
      toast.error("Name and department are required."); return;
    }
    setBusy(true);
    try{
      const res = await api.updateProfile(form);
      setEditing(false);
      toast.success(res.message || "Details updated.");
      load();
    }catch(e){ toast.error(e.message); }
    finally{ setBusy(false); }
  }
  async function regenerate(){
    setBusy(true);
    try{ await api.regenerateQR(); toast.success("QR code regenerated."); load(); }
    catch(e){ toast.error(e.message); }
    finally{ setBusy(false); }
  }
  const upd = k => e => setForm({ ...form, [k]: e.target.value });

  if (err) return (<><TopBar/><div className="wrap"><div className="alert err">{err}</div></div></>);
  if (!me) return (<><TopBar/><div className="wrap"><p className="muted">Loading…</p></div></>);

  return (
    <>
      <TopBar />
      <div className="wrap grid2" style={{alignItems:"start"}}>
        <div className="card">
          <div style={{display:"flex",gap:16,alignItems:"center",marginBottom:14}}>
            {me.photo && <img src={me.photo} alt="passport" className="passport"/>}
            <div><h2 style={{margin:0}}>My Profile</h2><span className="muted">{me.matric_no}</span></div>
          </div>
          {!editing ? (
            <>
              <div className="kv"><span>Full Name</span><b>{me.full_name}</b></div>
              <div className="kv"><span>Department</span><b>{me.department}</b></div>
              <div className="kv"><span>Level</span><b>{me.level}</b></div>
              <div className="kv"><span>Email</span><b>{me.email}</b></div>
              <button className="btn btn-primary btn-sm" style={{marginTop:14}} onClick={()=>setEditing(true)}>Edit Details</button>
            </>
          ) : (
            <>
              <div className="field"><label>Full Name</label><input value={form.full_name} onChange={upd("full_name")}/></div>
              <div className="field"><label>Department</label><input value={form.department} onChange={upd("department")}/></div>
              <div className="field"><label>Level</label>
                <select value={form.level} onChange={upd("level")}>{["100","200","300","400","500"].map(l=><option key={l}>{l}</option>)}</select>
              </div>
              <button className="btn btn-primary btn-sm" disabled={busy} onClick={save}>Save</button>{" "}
              <button className="btn btn-danger btn-sm" onClick={()=>{setEditing(false);setForm({full_name:me.full_name,department:me.department,level:me.level});}}>Cancel</button>
              <p className="muted" style={{marginTop:10}}>Your QR code stays valid after editing — it always reflects your current details.</p>
            </>
          )}
        </div>

        <div className="card qr-box">
          <h2>My QR Code</h2>
          {me.qr ? (
            <>
              <img src={me.qr} alt="My QR code"/>
              <p className="muted">Present this code for verification.</p>
              <a className="btn btn-teal btn-sm" href={me.qr} download={`${me.matric_no}.png`} style={{textDecoration:"none"}}>Download</a>
            </>
          ) : (
            <>
              <div className="qr-empty">No valid QR code</div>
              <p className="muted">No code has been generated yet.</p>
              <button className="btn btn-teal btn-sm" disabled={busy} onClick={regenerate}>Regenerate QR Code</button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
