import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrCode({ value }: { value: string }) {
  const [svg, setSvg] = useState("");

  useEffect(() => {
    let cancelled = false;
    void QRCode.toString(value, {
      type: "svg",
      margin: 1,
      width: 220,
      color: { dark: "#111827", light: "#ffffff" },
    }).then((nextSvg) => {
      if (!cancelled) setSvg(nextSvg);
    });
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (!svg) {
    return <div className="bg-muted size-[220px] animate-pulse rounded-lg" />;
  }

  return <div className="rounded-lg bg-white p-3" dangerouslySetInnerHTML={{ __html: svg }} />;
}
