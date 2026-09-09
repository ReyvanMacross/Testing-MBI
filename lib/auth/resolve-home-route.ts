export type HomeRouteProfile = {
  role: string;
  opdCode: string | null;
};

export function resolveHomeRoute(profile: HomeRouteProfile) {
  if (profile.role === "Admin Diskominfo") return "/diskominfo";
  if (profile.role === "INTERVENSI" && profile.opdCode === "DINSOS") {
    return "/dinsos";
  }
  if (profile.role === "INTERVENSI" && profile.opdCode === "DISNAKER") {
    return "/disnaker";
  }
  return null;
}
