import { Link } from "react-router-dom";

// Entry page: choose the Administrator or Student portal, each of which leads to
// its own tailored login screen.
export default function Landing() {
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <img src="/oui.png" alt="University logo" className="login-logo" />
          <h1 className="login-school">Oduduwa University</h1>
          <p className="login-tagline">Learning For Human Development</p>
        </div>

        <div className="login-divider" />
        <p className="sub">E-Students QR System — choose how you want to sign in</p>

        <div className="portal-grid">
          <Link to="/admin/login" className="portal-card">
            <span className="portal-ic navy" aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </span>
            <b>Administrator</b>
            <span className="portal-desc">Manage students, approvals &amp; QR verification</span>
          </Link>

          <Link to="/student/login" className="portal-card">
            <span className="portal-ic teal" aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10 12 5 2 10l10 5 10-5z" /><path d="M6 12v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" />
              </svg>
            </span>
            <b>Student</b>
            <span className="portal-desc">View your profile &amp; QR identity card</span>
          </Link>
        </div>

        <p className="muted" style={{textAlign:"center", marginTop:18}}>
          New student? <Link to="/register">Register here</Link>
        </p>
      </div>
    </div>
  );
}
