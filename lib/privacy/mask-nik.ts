export function maskNik(nik: string | null | undefined) {
  const value = nik?.trim() ?? "";
  if (value.length < 8) return "••••";
  return `${value.slice(0, 4)}${"x".repeat(value.length - 8)}${value.slice(-4)}`;
}
