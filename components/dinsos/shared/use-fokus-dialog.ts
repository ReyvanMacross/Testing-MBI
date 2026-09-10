"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function useFokusDialog<T extends HTMLElement>(restoreSelector?: string) {
  const dialogRef = useRef<T>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const frame = window.requestAnimationFrame(() => {
      const first = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? dialogRef.current)?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.setTimeout(() => {
        const previous = previousFocusRef.current?.isConnected
          ? previousFocusRef.current
          : restoreSelector
            ? document.querySelector<HTMLElement>(restoreSelector)
            : null;
        previous?.focus();
      }, 0);
    };
  }, [restoreSelector]);

  return dialogRef;
}
