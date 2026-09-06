import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DISTRICT_ORDER = [
  "Sukasari",
  "Coblong",
  "Babakan Ciparay",
  "Bojongloa Kaler",
  "Andir",
  "Cicendo",
  "Sukajadi",
  "Cidadap",
  "Bandung Wetan",
  "Astana Anyar",
  "Regol",
  "Batununggal",
  "Lengkong",
  "Cibeunying Kidul",
  "Bandung Kulon",
  "Kiaracondong",
  "Bojongloa Kidul",
  "Cibeunying Kaler",
  "Sumur Bandung",
  "Antapani",
  "Bandung Kidul",
  "Buahbatu",
  "Rancasari",
  "Arcamanik",
  "Cibiru",
  "Ujungberung",
  "Gedebage",
  "Panyileukan",
  "Mandalajati",
  "Cinambo",
];

const COBLONG_KELURAHAN_ORDER = [
  "Lebak Siliwangi",
  "Lebak Gede",
  "Cipaganti",
  "Sekeloa",
  "Dago",
  "Sadang Serang",
];

const MAP_COLORS = new Set([
  "#991B1B",
  "#EF4444",
  "#F97316",
  "#EAB308",
  "#10B981",
]);

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const sourceDirectory = path.join(projectRoot, "tools", "map-source");
const outputDirectory = path.join(
  projectRoot,
  "lib",
  "diskominfo",
  "map-assets",
);

function decodeXmlEntities(value) {
  return value.replace(
    /&(?:quot|apos|amp|lt|gt|#\d+|#x[\da-f]+);/gi,
    (entity) => {
      const namedEntities = {
        "&quot;": '"',
        "&apos;": "'",
        "&amp;": "&",
        "&lt;": "<",
        "&gt;": ">",
      };
      const namedValue = namedEntities[entity.toLowerCase()];

      if (namedValue) {
        return namedValue;
      }

      const isHex = entity.toLowerCase().startsWith("&#x");
      const numericValue = Number.parseInt(
        entity.slice(isHex ? 3 : 2, -1),
        isHex ? 16 : 10,
      );

      return Number.isFinite(numericValue)
        ? String.fromCodePoint(numericValue)
        : entity;
    },
  );
}

function parseAttributes(tag) {
  const attributes = new Map();
  const attributePattern = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

  for (const match of tag.matchAll(attributePattern)) {
    attributes.set(
      match[1].toLowerCase(),
      decodeXmlEntities(match[2] ?? match[3] ?? ""),
    );
  }

  return attributes;
}

function getPathFill(attributes) {
  const directFill = attributes.get("fill");

  if (directFill) {
    return directFill.trim().toUpperCase();
  }

  const style = attributes.get("style");

  if (!style) {
    return null;
  }

  const fillDeclaration = style
    .split(";")
    .map((declaration) => declaration.split(":"))
    .find(([property]) => property?.trim().toLowerCase() === "fill");

  return fillDeclaration?.[1]?.trim().toUpperCase() ?? null;
}

function referencesClip(attributes, clipId) {
  if (!clipId) {
    return false;
  }

  return (
    attributes.get("id") === clipId ||
    attributes.get("clip-path")?.includes(`#${clipId}`) === true
  );
}

export function extractColoredPaths(svg, clipId = null) {
  const paths = [];
  const groupScopes = [];
  const svgTokenPattern = /<\/g\s*>|<g\b[^>]*>|<path\b[^>]*\/?\s*>/gi;

  for (const match of svg.matchAll(svgTokenPattern)) {
    const token = match[0];

    if (/^<\/g/i.test(token)) {
      groupScopes.pop();
      continue;
    }

    if (/^<g\b/i.test(token)) {
      const parentIsInScope = groupScopes.at(-1) ?? false;
      const attributes = parseAttributes(token);

      groupScopes.push(
        parentIsInScope || referencesClip(attributes, clipId),
      );
      continue;
    }

    if (clipId && groupScopes.at(-1) !== true) {
      continue;
    }

    const attributes = parseAttributes(token);
    const fill = getPathFill(attributes);
    const pathData = attributes.get("d")?.replace(/\s+/g, " ").trim();

    if (fill && MAP_COLORS.has(fill) && pathData) {
      paths.push(pathData);
    }
  }

  return paths;
}

function readSource(filename) {
  const sourcePath = path.join(sourceDirectory, filename);

  if (!existsSync(sourcePath)) {
    throw new Error(`Missing map source: ${sourcePath}`);
  }

  return readFileSync(sourcePath, "utf8");
}

export function createSemanticAreas(paths, areaNames, areaType) {
  if (paths.length !== areaNames.length) {
    throw new Error(
      `Expected ${areaNames.length} ${areaType} paths, got ${paths.length}`,
    );
  }

  return areaNames.map((name, index) => ({
    name,
    d: paths[index],
  }));
}

function writeJson(filename, data) {
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(
    path.join(outputDirectory, filename),
    `${JSON.stringify(data, null, 2)}\n`,
    "utf8",
  );
}

function main() {
  const bandungSvg = readSource("peta-sebaran-desil-full.svg");
  const coblongSvg = readSource("coblong-kelurahan.svg");

  const districts = createSemanticAreas(
    extractColoredPaths(bandungSvg, "clip1_251_2526"),
    DISTRICT_ORDER,
    "district",
  );
  const coblongSubdistricts = createSemanticAreas(
    extractColoredPaths(coblongSvg),
    COBLONG_KELURAHAN_ORDER,
    "kelurahan",
  );

  writeJson("bandung-kecamatan.json", districts);
  writeJson("coblong-kelurahan.json", coblongSubdistricts);

  console.log(`bandung-kecamatan.json: ${districts.length} entries`);
  console.log(`coblong-kelurahan.json: ${coblongSubdistricts.length} entries`);
}

const isDirectExecution =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
