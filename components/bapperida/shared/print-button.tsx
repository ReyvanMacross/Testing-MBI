"use client";

import { Download } from "lucide-react";

export function PrintButton({ label = "Unduh Laporan" }: { label?: string }) {
  return <button type="button" onClick={() => window.print()}><Download size={17} />{label}</button>;
}
