import assert from "node:assert/strict";

import { loadProjectEnvironment } from "./lib/project-env.mjs";

await loadProjectEnvironment();
const baseUrl = "http://localhost:3000";
const originHeaders = {
  Origin: process.env.APP_ORIGIN ?? baseUrl,
  "Sec-Fetch-Site": "same-origin",
};

const login = await fetch(`${baseUrl}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...originHeaders },
  body: JSON.stringify({
    identifier: "admin.mbi",
    password: process.env.SUPABASE_TEST_PASSWORD,
  }),
});
assert.equal(login.status, 200);
const cookie = login.headers
  .getSetCookie()
  .map((value) => value.split(";", 1)[0])
  .join("; ");

const routes = [
  "/diskominfo",
  "/diskominfo/peta",
  "/diskominfo/peta?kecamatan=Coblong",
  "/diskominfo/pengguna",
  "/diskominfo/log-aktivitas",
  "/diskominfo/integrasi-api",
];
for (const route of routes) {
  const response = await fetch(`${baseUrl}${route}`, {
    headers: { Cookie: cookie },
    redirect: "manual",
  });
  assert.equal(response.status, 200, route);
}

const refresh = await fetch(`${baseUrl}/diskominfo/integrasi-api`, {
  headers: { Cookie: cookie, ...originHeaders },
  redirect: "manual",
});
assert.equal(refresh.status, 200);

const logout = await fetch(`${baseUrl}/api/auth/logout`, {
  method: "POST",
  headers: { Cookie: cookie, ...originHeaders },
});
assert.equal(logout.status, 200);

const protectedWithoutSession = await fetch(`${baseUrl}/diskominfo/integrasi-api`, {
  redirect: "manual",
});
assert.ok([303, 307, 308].includes(protectedWithoutSession.status));
assert.equal(new URL(protectedWithoutSession.headers.get("location"), baseUrl).pathname, "/login");

const loginAgain = await fetch(`${baseUrl}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...originHeaders },
  body: JSON.stringify({
    identifier: "admin.mbi",
    password: process.env.SUPABASE_TEST_PASSWORD,
  }),
});
assert.equal(loginAgain.status, 200);

console.log(JSON.stringify({ protectedRoutes: routes.length, refresh: refresh.status, logout: logout.status, unauthenticatedRedirect: protectedWithoutSession.status, loginAgain: loginAgain.status }, null, 2));
