export const DESIL_COLORS = {
  1: "#991B1B",
  2: "#EF4444",
  3: "#F97316",
  4: "#EAB308",
  5: "#10B981",
} as const;

export const NO_DATA_COLOR = "#D1D5DB";

export type DesilLevel = keyof typeof DESIL_COLORS;
