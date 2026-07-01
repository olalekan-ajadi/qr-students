import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./styles.css";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import StudentPortal from "./pages/StudentPortal.jsx";
import { getSession, clearSession } from "./api.js";
import { ToastHost } from "./toast.jsx";

function Protected({ role, children }) {
  const s = getSession(role);
  if (!s) return <Navigate to="/login" replace />;
  if (role && s.role !== role) {
    clearSession(role); // wipe stale session so the wrong name/role can't linger
    return <Navigate to="/login" replace />;
  }
  return children;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/admin" element={<Protected role="admin"><AdminDashboard /></Protected>} />
          <Route path="/student" element={<Protected role="student"><StudentPortal /></Protected>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
      <ToastHost />
    </>
  </React.StrictMode>
);
