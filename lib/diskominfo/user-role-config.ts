export const USER_ROLE_RULES = {
  "Admin Diskominfo": {
    label: "Admin Utama",
    requiresWilayah: false,
    allowedWilayahTypes: [],
  },
  "Operator Lapangan": {
    label: "Operator Lapangan",
    requiresWilayah: true,
    allowedWilayahTypes: ["KECAMATAN"],
  },
  "Operator Kelurahan": {
    label: "Operator Kelurahan",
    requiresWilayah: true,
    allowedWilayahTypes: ["KELURAHAN"],
  },
} as const;

export type ManagedUserRole = keyof typeof USER_ROLE_RULES;
export type ManagedWilayahType = "KECAMATAN" | "KELURAHAN";

export const MANAGED_USER_ROLES = Object.keys(
  USER_ROLE_RULES,
) as ManagedUserRole[];

export function isManagedUserRole(value: string): value is ManagedUserRole {
  return value in USER_ROLE_RULES;
}

export function getUserRoleLabel(role: string) {
  return isManagedUserRole(role) ? USER_ROLE_RULES[role].label : role;
}
