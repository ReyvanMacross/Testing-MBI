export function maskGovernmentId(
  value: string | null | undefined,
  visibleStart = 4,
  visibleEnd = 4,
) {
  const normalized = value?.trim() ?? "";

  if (normalized.length < visibleStart + visibleEnd) {
    return normalized ? "••••" : "—";
  }

  return `${normalized.slice(0, visibleStart)}${"x".repeat(
    normalized.length - visibleStart - visibleEnd,
  )}${normalized.slice(-visibleEnd)}`;
}
