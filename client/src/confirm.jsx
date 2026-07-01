import { useEffect, useState } from "react";

// Custom confirmation modal that replaces the browser's confirm(). Call
// `await confirmDialog({ title, message, confirmLabel, danger })` anywhere; it
// resolves to true (confirmed) or false (cancelled). <ConfirmHost/> is mounted
// once and renders the dialog.
let resolver = null;
let current = null;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l(current));

export function confirmDialog(opts = {}) {
  return new Promise((resolve) => {
    if (resolver) { resolver(false); resolver = null; } // cancel any open one
    resolver = resolve;
    current = {
      title: opts.title || "Are you sure?",
      message: opts.message || "",
      confirmLabel: opts.confirmLabel || "Confirm",
      cancelLabel: opts.cancelLabel || "Cancel",
      danger: opts.danger !== false, // most confirmations here are destructive
    };
    emit();
  });
}

function settle(result) {
  if (resolver) { resolver(result); resolver = null; }
  current = null;
  emit();
}

export function ConfirmHost() {
  const [dlg, setDlg] = useState(null);
  useEffect(() => {
    listeners.add(setDlg);
    return () => listeners.delete(setDlg);
  }, []);
  useEffect(() => {
    if (!dlg) return;
    const onKey = (e) => {
      if (e.key === "Escape") settle(false);
      else if (e.key === "Enter") settle(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dlg]);

  if (!dlg) return null;
  return (
    <div className="confirm-overlay" onClick={() => settle(false)}>
      <div className="confirm-card" role="alertdialog" aria-modal="true"
           aria-labelledby="confirm-title" onClick={(e) => e.stopPropagation()}>
        <div className={"confirm-icon " + (dlg.danger ? "danger" : "info")} aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            {dlg.danger ? (
              <>
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </>
            ) : (
              <>
                <circle cx="12" cy="12" r="9" />
                <line x1="12" y1="11" x2="12" y2="16" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </>
            )}
          </svg>
        </div>
        <h3 id="confirm-title" className="confirm-title">{dlg.title}</h3>
        {dlg.message && <p className="confirm-message">{dlg.message}</p>}
        <div className="confirm-actions">
          <button className="btn btn-outline" onClick={() => settle(false)}>{dlg.cancelLabel}</button>
          <button className={"btn " + (dlg.danger ? "btn-danger-solid" : "btn-primary")}
                  autoFocus onClick={() => settle(true)}>{dlg.confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
