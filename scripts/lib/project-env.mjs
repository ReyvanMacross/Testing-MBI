import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));

export const PROJECT_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");

function parseEnvFile(content) {
  const values = new Map();

  for (const sourceLine of content.replace(/^\uFEFF/, "").split(/\r?\n/u)) {
    const line = sourceLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");

    if (separator < 1) {
      continue;
    }

    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values.set(name, value);
  }

  return values;
}

export async function loadProjectEnvironment() {
  const files = [".env.test.local", ".env.local", ".env"];

  for (const file of files) {
    try {
      const content = await readFile(path.join(PROJECT_ROOT, file), "utf8");

      for (const [name, value] of parseEnvFile(content)) {
        if (process.env[name] === undefined) {
          process.env[name] = value;
        }
      }
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
    }
  }
}

export function getSupabaseAdminEnvironment() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.",
    );
  }

  return { supabaseUrl, supabaseSecretKey };
}
