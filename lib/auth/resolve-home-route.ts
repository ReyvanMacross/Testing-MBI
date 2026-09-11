export type HomeRouteProfile = {
  role: string;
  opdCode: string | null;
};

export function resolveHomeRoute(profile: HomeRouteProfile) {
  if (profile.role === "Admin Diskominfo") return "/diskominfo";
  if (profile.role === "Operator Kecamatan") return "/kecamatan";
  if (profile.role === "INTERVENSI" && profile.opdCode === "DINSOS") {
    return "/dinsos";
  }
  if (profile.role === "INTERVENSI" && profile.opdCode === "DISNAKER") {
    return "/disnaker";
  }
  if (profile.role === "INTERVENSI" && profile.opdCode === "DISKOP") {
    return "/diskop";
  }
  if (profile.role === "INTERVENSI" && profile.opdCode === "DISDIK") {
    return "/disdik";
  }
  if (profile.role === "INTERVENSI" && profile.opdCode === "DP3A") {
    return "/dp3a";
  }
  if (profile.role === "INTERVENSI" && profile.opdCode === "DISDAGIN") {
    return "/disdagin";
  }
  if (profile.role === "INTERVENSI" && profile.opdCode === "DKPP") {
    return "/dkpp";
  }
  if (profile.role === "INTERVENSI" && profile.opdCode === "DISBUDPAR") {
    return "/disbudpar";
  }
  if (profile.role === "INTERVENSI" && profile.opdCode === "CIPTA_BINTAR") {
    return "/cipta-bintar";
  }
  return null;
}
