import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

export default function Scanner({ onScan }) {
  const idRef = useRef("reader-" + Math.random().toString(36).slice(2));
  const onScanRef = useRef(onScan);
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  useEffect(() => {
    const scanner = new Html5Qrcode(idRef.current);
    scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 250 },
      (text) => { onScanRef.current(text); },
      () => {}
    ).catch(() => {});
    return () => { scanner.stop().catch(() => {}); };
  }, []);

  return <div className="scanner-region"><div id={idRef.current}></div></div>;
}
