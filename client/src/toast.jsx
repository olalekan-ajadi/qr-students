import { useEffect, useState } from "react";

// Lightweight toast store — no context/prop-drilling. Any module can call
// toast.success(), toast.error() or toast.info(); <ToastHost/> renders them
// in a fixed overlay so feedback is always visible regardless of scroll.
let _id = 0;
const listeners = new Set();
let items = [];

function emit() { listeners.forEach((l) => l([...items])); }
function dismiss(id) { items = items.filter((t) => t.id !== id); emit(); }
function push(type, message, opts = {}) {
  if (!message) return;
  const id = ++_id;
  const ttl = opts.ttl ?? (type === "error" ? 7000 : 3500);
  items = [...items, { id, type, message: String(message) }];
  emit();
  if (ttl) setTimeout(() => dismiss(id), ttl);
  return id;
}

export const toast = {
  success: (m, o) => push("success", m, o),
  error: (m, o) => push("error", m, o),
  info: (m, o) => push("info", m, o),
  dismiss,
};

const ICON = {
  success: <path d="M20 6 9 17l-5-5" />,
  error: <path d="M18 6 6 18M6 6l12 12" />,
  info: <path d="M12 11v5M12 7.5h.01" />,
};

export function ToastHost() {
  const [list, setList] = useState([]);
  useEffect(() => {
    listeners.add(setList);
    return () => listeners.delete(setList);
  }, []);

  return (
    <div className="toast-host" role="region" aria-label="Notifications">
      {list.map((t) => (
        <div key={t.id} className={"toast toast-" + t.type}
             role={t.type === "error" ? "alert" : "status"}>
          <span className="toast-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2.4"
                 strokeLinecap="round" strokeLinejoin="round">
              {t.type === "info" && <circle cx="12" cy="12" r="9" strokeWidth="2" />}
              {ICON[t.type]}
            </svg>
          </span>
          <span className="toast-msg">{t.message}</span>
          <button className="toast-close" aria-label="Dismiss"
                  onClick={() => dismiss(t.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}
