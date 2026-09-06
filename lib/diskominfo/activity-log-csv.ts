import type { ActivityLog } from "@/lib/diskominfo/activity-logs";

export function csvEscape(value: unknown) {
  let text = String(value ?? "");

  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

export function createActivityLogCsv(logs: ActivityLog[]) {
  const header = [
    "Waktu",
    "Nama Pengguna",
    "Role",
    "Aktivitas",
    "Modul",
    "Status",
  ];
  const formatter = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const rows = [
    header,
    ...logs.map((log) => [
      formatter.format(new Date(log.created_at)),
      log.nama_pengguna,
      log.role_pengguna,
      log.aktivitas,
      log.modul,
      log.status,
    ]),
  ];

  return `\uFEFF${rows.map((row) => row.map(csvEscape).join(",")).join("\r\n")}`;
}
