import { useNavigate } from "react-router-dom";
import { getSession, clearSession } from "../api.js";

export default function TopBar() {
  const nav = useNavigate();
  const s = getSession();
  return (
    <div className="topbar">
      <div className="topbar-brand">
        <img src="/oui.png" alt="University logo" className="topbar-logo" />
        <div className="topbar-title">
          <span className="topbar-school">Oduduwa University</span>
          <span className="topbar-sub">E-Students QR System</span>
        </div>
      </div>
      <div className="right">
        {s && (
          <span className="topbar-user">
            <span className="topbar-identity">
              <span className="topbar-role-label">
                {s.role === "admin" ? "Administrator" : "Student"}
              </span>
              <span className="topbar-name">{s.name}</span>
            </span>
          </span>
        )}
        <button className="btn btn-ghost btn-sm"
          onClick={() => {
            const role = s?.role;
            clearSession();
            nav(role === "admin" ? "/admin/login" : role === "student" ? "/student/login" : "/");
          }}>
          Logout
        </button>
      </div>
    </div>
  );
}
