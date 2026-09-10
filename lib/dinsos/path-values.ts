export const DINSOS_PATHS = [
  "PEKERJA",
  "WIRAUSAHA",
  "PENGUATAN_DASAR",
] as const;

export type DinsosPath = (typeof DINSOS_PATHS)[number];

export const APP_PATH_TO_DB_PATH = {
  PEKERJA: "PEKERJA",
  WIRAUSAHA: "WIRAUSAHA",
  PENGUATAN_DASAR: "PENGUATAN_DASAR",
} as const satisfies Record<DinsosPath, string>;

export function dinsosPathLabel(path: DinsosPath) {
  const labels: Record<DinsosPath, string> = {
    PEKERJA: "Jalur Pekerja",
    WIRAUSAHA: "Jalur Wirausaha",
    PENGUATAN_DASAR: "Penguatan Dasar",
  };

  return labels[path];
}

export function isDinsosPath(value: unknown): value is DinsosPath {
  return typeof value === "string" && DINSOS_PATHS.includes(value as DinsosPath);
}
