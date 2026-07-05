const BASE = "/api";

// Sessions are namespaced per role ("session:admin" / "session:student") so
// that signing in as one role never overwrites the other. Each dashboard reads
// the session that matches its route, which means both can be logged in at once
// (e.g. admin and student in two tabs) and a refresh keeps you signed in.
function roleFromPath() {
  const p = window.location.pathname;
  if (p.startsWith("/admin")) return "admin";
  if (p.startsWith("/student")) return "student";
  return null;
}
const keyFor = (role) => "session:" + role;

// One-time migration from the old single "session" key.
(function migrate() {
  try {
    const old = localStorage.getItem("session");
    if (old) {
      const s = JSON.parse(old);
      if (s?.role) localStorage.setItem(keyFor(s.role), old);
      localStorage.removeItem("session");
    }
  } catch {}
})();

export function getSession(role) {
  role = role || roleFromPath();
  if (!role) return null;
  const raw = localStorage.getItem(keyFor(role));
  return raw ? JSON.parse(raw) : null;
}
export function setSession(s, role) {
  role = role || s.role || roleFromPath();
  if (role) localStorage.setItem(keyFor(role), JSON.stringify(s));
}
export function clearSession(role) {
  role = role || roleFromPath();
  if (role) localStorage.removeItem(keyFor(role));
  else { localStorage.removeItem("session:admin"); localStorage.removeItem("session:student"); }
}

async function request(path, { method = "GET", body } = {}) {
  const role = roleFromPath();
  const session = role ? getSession(role) : null;
  const headers = { "Content-Type": "application/json" };
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;
  const res = await fetch(BASE + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  // A 401 (expired/invalid token) or a role-mismatch 403 ("Access denied" from
  // the auth middleware) means the stored session is no longer usable on this
  // route — most often because the single browser session was overwritten by
  // signing in as the other role in another tab. Rather than flashing a cryptic
  // "Access denied", clear the session and send the user to a clean sign-in.
  // Business-logic 403s (e.g. "Account is not active") keep their own message,
  // and /auth/ routes are excluded so login errors surface normally.
  const authFailure =
    res.status === 401 ||
    (res.status === 403 && data.error === "Access denied");
  if (authFailure && !path.startsWith("/auth/")) {
    if (role) clearSession(role);
    try {
      sessionStorage.setItem(
        "authNotice",
        "Your session has expired or no longer has access. Please sign in again."
      );
    } catch {}
    if (!window.location.pathname.endsWith("/login")) {
      window.location.href =
        role === "admin" ? "/admin/login" : role === "student" ? "/student/login" : "/";
    }
    throw new Error("Please sign in again");
  }
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export const api = {
  register: (s) => request("/auth/register", { method: "POST", body: s }),
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }),
  // admin
  listStudents: () => request("/students"),
  listPending: () => request("/students/pending"),
  listRejected: () => request("/students/rejected"),
  approve: (id) => request(`/students/${id}/approve`, { method: "POST" }),
  reject: (id) => request(`/students/${id}/reject`, { method: "POST" }),
  restoreStudent: (id) => request(`/students/${id}/restore`, { method: "POST" }),
  deleteStudent: (id) => request(`/students/${id}`, { method: "DELETE" }),
  getQR: (id) => request(`/students/${id}/qr`),
  getStudentDetail: (id) => request(`/students/${id}/detail`),
  editStudent: (id, data) => request(`/students/${id}`, { method: "PUT", body: data }),
  createStudent: (data) => request("/students/create", { method: "POST", body: data }),
  verifyPublic: (t) => request(`/students/verify-public?t=${encodeURIComponent(t)}`),
  // student
  myProfile: () => request("/students/me/profile"),
  updateProfile: (d) => request("/students/me/profile", { method: "PUT", body: d }),
  regenerateQR: () => request("/students/me/qr/regenerate", { method: "POST" }),
};
