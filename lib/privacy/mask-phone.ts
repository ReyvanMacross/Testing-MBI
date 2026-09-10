export function maskPhone(phone: string | null | undefined) {
  const value = phone?.trim() ?? "";
  if (value.length < 7) return value ? "••••" : "—";
  const digits = value.replace(/\D/g, "");
  if (digits.length < 7) return "••••";
  return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-xxxx`;
}
