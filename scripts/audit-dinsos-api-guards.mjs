import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { PROJECT_ROOT } from "./lib/project-env.mjs";

async function routeFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await routeFiles(target)));
    if (entry.isFile() && entry.name === "route.ts") files.push(target);
  }
  return files;
}

const apiRoot = path.join(PROJECT_ROOT, "app", "api", "dinsos");
const failures = [];
const capabilityRules = [
  { route: /\/warga(?:\/\[wargaId\])?\/route\.ts$/u, capability: "DINSOS_WARGA_EDIT" },
  { route: /\/assessments\/\[assessmentId\]\/review\/route\.ts$/u, capability: "DINSOS_ASSESSMENT_REVIEW" },
  { route: /\/result\/override\/route\.ts$/u, capability: "DINSOS_DESIL_OVERRIDE" },
  { route: /\/path\/publish\/route\.ts$/u, capability: "DINSOS_PATH_OVERRIDE" },
];

for (const file of await routeFiles(apiRoot)) {
  const source = await readFile(file, "utf8");
  const relative = path.relative(PROJECT_ROOT, file).replaceAll("\\", "/");
  const mutations = [...source.matchAll(/export\s+async\s+function\s+(POST|PATCH|PUT|DELETE)\b/gu)].map((match) => match[1]);
  if (!mutations.length) continue;

  for (const guard of ["assertSameOrigin", "assertBodySize", "requireDinsosActor"]) {
    if (!source.includes(`${guard}(`)) failures.push(`${relative}: missing ${guard}`);
  }
  for (const rule of capabilityRules) {
    if (rule.route.test(`/${relative}`) && !source.includes(`"${rule.capability}"`)) {
      failures.push(`${relative}: missing ${rule.capability}`);
    }
  }
  if (
    /transition_referral_status|received_at|processing_started_at|completed_at/iu.test(source)
  ) {
    failures.push(`${relative}: exposes target-OPD referral lifecycle`);
  }
}

if (failures.length) {
  console.error(["DINSOS API GUARD BLOCKERS", ...failures.map((item) => `- ${item}`)].join("\n"));
  process.exitCode = 1;
} else {
  console.log("DINSOS API GUARDS: PASS");
  console.log("DINSOS target-OPD lifecycle exposure: 0 routes PASS");
}
