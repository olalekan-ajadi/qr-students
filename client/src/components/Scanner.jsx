import { useEffect, useRef, useState } from "react";

// Decode a QR from an image File without needing any visible DOM element.
// Draws the photo to a canvas, then reads it with the native BarcodeDetector
// (Android/Chrome) or falls back to the jsQR decoder (iOS Safari, Firefox).
export async function decodeImageFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise((res, rej) => {
      img.onload = res; img.onerror = () => rej(new Error("Could not read that image"));
      img.src = url;
    });
    const maxDim = 1600; // downscale big phone photos for reliable, fast decoding
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);

    if ("BarcodeDetector" in window) {
      try {
        const fmts = await window.BarcodeDetector.getSupportedFormats();
        if (fmts.includes("qr_code")) {
          const det = new window.BarcodeDetector({ formats: ["qr_code"] });
          const codes = await det.detect(canvas);
          if (codes && codes.length) return codes[0].rawValue;
        }
      } catch { /* fall through to jsQR */ }
    }
    const { default: jsQR } = await import("jsqr");
    const data = ctx.getImageData(0, 0, w, h);
    const result = jsQR(data.data, w, h, { inversionAttempts: "attemptBoth" });
    return result?.data || null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Photo-capture fallback. Opens the native camera to take a still photo, then
// decodes the QR from that image. Works on every phone (including iPhones,
// where live camera scanning is blocked by iOS browsers).
export function PhotoScan({ onDecode, onError, label }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    setBusy(true);
    try {
      const text = await decodeImageFile(file);
      if (text) onDecode(text);
      else onError?.("No QR code was found in that photo. Fill the frame with the code, hold steady, and try again.");
    } catch {
      onError?.("Could not read that photo. Please try again.");
    } finally {
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

// Live QR scanner with a back-camera preview. Primary path: getUserMedia + the
// native BarcodeDetector (Android Chrome). Fallback: html5-qrcode. If the live
// camera can't start (notably on iPhones), a "Take a photo" option is offered
// right in the error, so there is only ever one scan action to start with.
export default function Scanner({ onScan }) {
  const videoRef = useRef(null);
  const fallbackId = useRef("reader-" + Math.random().toString(36).slice(2));
  const onScanRef = useRef(onScan);
  const [mode, setMode] = useState(null);          // 'native' | 'fallback'
  const [status, setStatus] = useState("starting"); // starting | live | error
  const [error, setError] = useState("");
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  useEffect(() => {
    let stopped = false, stream = null, timer = null, html5 = null;

    const friendly = (e) => {
      const n = e?.name || "";
      if (n === "NotAllowedError" || n === "SecurityError")
        return "Camera permission is blocked. Allow Camera for this site in your browser settings, or use the photo option below.";
      if (n === "NotFoundError" || n === "OverconstrainedError")
        return "No suitable camera was found on this device.";
      if (n === "NotReadableError")
        return "The camera is in use by another app. Close it and try again.";
      return "This device won’t open a live camera in the browser (common on iPhone). Use the photo option below instead.";
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
          } catch { /* transient */ }
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
        setStatus("error"); setError("This browser can’t open a live camera. Use the photo option below."); return;
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
      {status !== "error" && (
        <>
          <video ref={videoRef} className="scanner-video"
                 style={{ display: mode === "fallback" ? "none" : "block" }}
                 muted playsInline autoPlay />
          <div id={fallbackId.current}></div>
          {status === "starting" && <p className="muted scanner-hint">Starting camera…</p>}
        </>
      )}
      {status === "error" && (
        <div>
          <div className="alert err" style={{ marginBottom: 10 }}>{error}</div>
          <PhotoScan onDecode={(t) => onScanRef.current(t)} onError={setError}
                     label="Take a photo of the QR code" />
        </div>
      )}
    </div>
  );
}
