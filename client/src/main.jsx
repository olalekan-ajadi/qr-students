import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./styles.css";
import Login from "./pages/Login.jsx";
import Landing from "./pages/Landing.jsx";
import VerifyResult from "./pages/VerifyResult.jsx";
import Register from "./pages/Register.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import StudentPortal from "./pages/StudentPortal.jsx";
import { getSession, clearSession } from "./api.js";
import { ToastHost } from "./toast.jsx";
import { ConfirmHost } from "./confirm.jsx";

function Protected({ role, children }) {
  const s = getSession(role);
  const loginPath = role === "admin" ? "/admin/login" : "/student/login";
  if (!s) return <Navigate to={loginPath} replace />;
  if (role && s.role !== role) {
    clearSession(role); // wipe stale session so the wrong name/role can't linger
    return <Navigate to={loginPath} replace />;
  }
  return children;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/verify" element={<VerifyResult />} />
          <Route path="/admin/login" element={<Login role="admin" />} />
          <Route path="/student/login" element={<Login role="student" />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/register" element={<Register />} />
          <Route path="/admin" element={<Protected role="admin"><AdminDashboard /></Protected>} />
          <Route path="/student" element={<Protected role="student"><StudentPortal /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <ToastHost />
      <ConfirmHost />
    </>
  </React.StrictMode>
);
