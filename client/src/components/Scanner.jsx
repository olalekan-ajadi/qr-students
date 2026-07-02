import { useEffect, useRef, useState } from "react";

// QR scanner with a live back-camera preview.
// Primary path: getUserMedia + the native BarcodeDetector (fast, real-time,
// works on Android Chrome). Fallback: the html5-qrcode library for browsers
// without BarcodeDetector (e.g. iOS Safari, Firefox). Camera errors are shown
// to the user instead of being swallowed.
export default function Scanner({ onScan }) {
  const videoRef = useRef(null);
  const fallbackId = useRef("reader-" + Math.random().toString(36).slice(2));
  const onScanRef = useRef(onScan);
  const [mode, setMode] = useState(null);        // 'native' | 'fallback'
  const [status, setStatus] = useState("starting"); // starting | live | error
  const [error, setError] = useState("");
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  useEffect(() => {
    let stopped = false, stream = null, timer = null, html5 = null;

    const friendly = (e) => {
      const n = e?.name || "";
      if (n === "NotAllowedError" || n === "SecurityError")
        return "Camera permission is blocked. Tap the site-settings (padlock) icon in your browser, allow Camera for this site, then reopen the scanner.";
      if (n === "NotFoundError" || n === "OverconstrainedError")
        return "No suitable camera was found on this device.";
      if (n === "NotReadableError")
        return "The camera is in use by another app. Close it and try again.";
      return "Could not start the camera. " + (e?.message || "You can paste the QR payload below instead.");
    };

    async function startNative() {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } }, audio: false,
      });
      if (stopped) return;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play().catch(() => {});
      setStatus("live");
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const tick = async () => {
        if (stopped) return;
        if (video.readyState >= 2) {
          try {
            const codes = await detector.detect(video);
            if (codes && codes.length) onScanRef.current(codes[0].rawValue);
          } catch { /* transient decode error — keep scanning */ }
        }
        timer = setTimeout(tick, 150);
      };
      tick();
    }

    async function startFallback() {
      const { Html5Qrcode } = await import("html5-qrcode");
      html5 = new Html5Qrcode(fallbackId.current, { verbose: false });
      const cfg = { fps: 10, qrbox: { width: 230, height: 230 } };
      const ok = (t) => onScanRef.current(t);
      try {
        await html5.start({ facingMode: { ideal: "environment" } }, cfg, ok, () => {});
      } catch {
        const cams = await Html5Qrcode.getCameras();
        if (!cams || !cams.length) throw new Error("No camera found");
        const back = cams.find(c => /back|rear|environment/i.test(c.label)) || cams[cams.length - 1];
        await html5.start(back.id, cfg, ok, () => {});
      }
      setStatus("live");
    }

    async function begin() {
      if (!window.isSecureContext) {
        setStatus("error"); setError("The camera needs a secure (https) connection."); return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("error"); setError("This browser does not support camera access. Please paste the QR payload below."); return;
      }
      let useNative = false;
      if ("BarcodeDetector" in window) {
        try {
          const fmts = await window.BarcodeDetector.getSupportedFormats();
          useNative = fmts.includes("qr_code");
        } catch { useNative = false; }
      }
      try {
        if (useNative) { setMode("native"); await startNative(); }
        else { setMode("fallback"); await startFallback(); }
      } catch (e) {
        // If the native path failed unexpectedly, try the library once.
        if (useNative && !stopped) {
          try {
            if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
            setMode("fallback"); await startFallback(); return;
          } catch (e2) { setStatus("error"); setError(friendly(e2)); return; }
        }
        setStatus("error"); setError(friendly(e));
      }
    }
    begin();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (html5) { try { html5.stop().then(() => html5.clear()).catch(() => {}); } catch { /* noop */ } }
    };
  }, []);

  return (
    <div className="scanner-region">
      <video ref={videoRef} className="scanner-video"
             style={{ display: mode === "fallback" ? "none" : "block" }}
             muted playsInline autoPlay />
      <div id={fallbackId.current}></div>
      {status === "starting" && <p className="muted scanner-hint">Starting camera…</p>}
      {status === "error" && <div className="alert err" style={{ marginTop: 10 }}>{error}</div>}
    </div>
  );
}

// Photo-capture fallback for devices where live camera scanning is blocked
// (notably iPhones — iOS browsers don't allow reliable live getUserMedia in
// every context). Uses the native camera to take a still photo, then decodes
// the QR from that image with html5-qrcode's scanFile (no live stream needed).
export function PhotoScan({ onDecode, onError, label }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    setBusy(true);
    let el;
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const tmpId = "photoscan-" + Math.random().toString(36).slice(2);
      el = document.createElement("div");
      el.id = tmpId;
      el.style.display = "none";
      document.body.appendChild(el);
      const h = new Html5Qrcode(tmpId, { verbose: false });
      const text = await h.scanFile(file, false);
      await h.clear().catch(() => {});
      onDecode(text);
    } catch {
      onError?.("No QR code was found in that photo. Fill the frame with the code, hold steady, and try again.");
    } finally {
      if (el) el.remove();
      setBusy(false);
    }
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" capture="environment"
             onChange={handleFile} style={{ display: "none" }} />
      <button type="button" className="btn btn-outline" style={{ width: "100%" }}
              disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? "Reading photo…" : (label || "Take a photo of the QR code")}
      </button>
    </>
  );
}
