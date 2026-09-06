"use client";

import { useEffect } from "react";

export function PrintOnLoad() {
  useEffect(() => {
    window.print();
  }, []);
  return null;
}

export function PrintButton() {
  return <button type="button" onClick={() => window.print()}>Cetak kembali</button>;
}
