import { readFile } from "node:fs/promises";
import path from "node:path";

import { PROJECT_ROOT } from "./lib/project-env.mjs";

const INPUT_PATH = path.join(
  PROJECT_ROOT,
  "data/reference/bandung-kelurahan-boundary.raw.geojson",
);

async function main() {
  const source = JSON.parse(await readFile(INPUT_PATH, "utf8"));

  if (source.type !== "FeatureCollection" || !Array.isArray(source.features)) {
    throw new Error("Boundary source is not a GeoJSON FeatureCollection.");
  }

  const propertyKeys = [
    ...new Set(
      source.features.flatMap((feature) =>
        Object.keys(feature.properties ?? {}),
      ),
    ),
  ].sort();
  const geometryTypes = [
    ...new Set(
      source.features.map((feature) => feature.geometry?.type ?? "NULL"),
    ),
  ].sort();

  console.log(`Feature count: ${source.features.length}`);
  console.log(`Property keys: ${propertyKeys.join(", ")}`);
  console.log(`Geometry types: ${geometryTypes.join(", ")}`);
  console.log("Property samples:");

  for (const feature of source.features.slice(0, 10)) {
    console.log(JSON.stringify(feature.properties ?? {}));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});