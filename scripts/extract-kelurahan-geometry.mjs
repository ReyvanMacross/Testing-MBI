import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { PROJECT_ROOT } from "./lib/project-env.mjs";

const INPUT_PATH = path.join(
  PROJECT_ROOT,
  "tools/map-source/bandung-kelurahan-all.svg",
);
const OUTPUT_PATH = path.join(
  PROJECT_ROOT,
  "lib/diskominfo/map-assets/bandung-kelurahan-geometry.json",
);

function decodeXmlEntities(value) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

async function main() {
  const svg = await readFile(INPUT_PATH, "utf8");
  const paths = [...svg.matchAll(/<path\b[^>]*\/?>/giu)].map(
    (match, pathIndex) => {
      const pathTag = match[0];
      const pathDataMatch = pathTag.match(/\bd\s*=\s*(?:"([^"]*)"|'([^']*)')/iu);
      const pathData = decodeXmlEntities(
        pathDataMatch?.[1] ?? pathDataMatch?.[2] ?? "",
      )
        .replace(/\s+/gu, " ")
        .trim();

      if (!pathData) {
        throw new Error(`Path ${pathIndex} does not contain valid d data.`);
      }

      return { pathIndex, d: pathData };
    },
  );

  if (paths.length !== 151) {
    throw new Error(
      `Expected 151 kelurahan paths, got ${paths.length}`,
    );
  }

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(
    OUTPUT_PATH,
    `${JSON.stringify(paths, null, 2)}\n`,
    "utf8",
  );

  console.log(`bandung-kelurahan-geometry.json: ${paths.length} paths`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});