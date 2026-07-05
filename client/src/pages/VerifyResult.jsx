import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api.js";

// Public page reached by scanning a student's QR with any phone camera.
// The encrypted token arrives in ?t=; the server decrypts it and returns the
// verification result plus a minimal, non-sensitive set of student details.
export default function VerifyResult() {
  const [params] = useSearchParams();
  const token = params.get("t");
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let alive = true;
    if (!token) { setState({ loading: false, res: { result: "invalid" } }); return; }
    api.verifyPublic(token)
      .then(res => { if (alive) setState({ loading: false, res }); })
      .catch(() => { if (alive) setState({ loading: false, error: true }); });
    return () => { alive = false; };
  }, [token]);

  const { loading, res, error } = state;
  const result = res?.result;
  const s = res?.student;

  const badge = {
    verified:  { cls: "vr-ok",   title: "Verified",     note: "This is a valid, active student ID." },
    inactive:  { cls: "vr-warn", title: "Not Active",   note: "This ID exists but the account is not currently active." },
    not_found: { cls: "vr-bad",  title: "Not Found",    note: "No student matches this code." },
    invalid:   { cls: "vr-bad",  title: "Invalid Code", note: "This QR was not issued by this system." },
  }[result] || { cls: "vr-bad", title: "Could Not Verify", note: "Something went wrong. Please try again." };

  return (
    <div className="vr-page">
      <div className="vr-card">
        <div className="vr-brand">
          <img src="/oui.png" alt="" className="vr-logo" />
          <div>
            <div className="vr-school">Oduduwa University</div>
            <div className="vr-sub">Student ID Verification</div>
          </div>
        </div>

        {loading ? (
          <p className="vr-loading">Verifying…</p>
        ) : error ? (
          <div className="vr-status vr-bad">
            <div className="vr-badge">Could Not Verify</div>
            <p className="vr-note">Please check your connection and try again.</p>
          </div>
        ) : (
          <>
            <div className={"vr-status " + badge.cls}>
              <div className="vr-badge">{badge.title}</div>
              <p className="vr-note">{badge.note}</p>
            </div>

            {s && (result === "verified" || result === "inactive") && (
              <div className="vr-student">
                {s.photo
                  ? <img src={s.photo} alt={s.full_name} className="vr-photo" />
                  : <div className="vr-photo vr-photo-empty">?</div>}
                <div className="vr-fields">
                  <div className="vr-name">{s.full_name}</div>
                  <div className="vr-matric">{s.matric_no}</div>
                  <div className="vr-meta">
                    {s.faculty && <span>{s.faculty}</span>}
                    {s.department && <span>{s.department}</span>}
                    {s.level && <span>{s.level} Level</span>}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <div className="vr-foot">Verified electronically · Oduduwa University</div>
      </div>
    </div>
  );
}
