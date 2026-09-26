import fs from "node:fs";

import { ConfigJsonText } from "./ConfigJsonText";
import { parseJsonc } from "./parseJsonc";

/**
 * Read and parse a JSONC (JSON with comments and trailing commas) configuration
 * file — tsconfig.json, jsconfig.json — naming it on failure.
 *
 * The root must be an object, as the compiler requires (its TS5092). A root of
 * `null`, an array, or a primitive is valid JSONC but not a configuration, and
 * is reported here with the compiler's wording instead of surfacing later as a
 * property read on a non-object.
 */
export function readJsoncFile(file: string): Record<string, unknown> {
  const text = fs.readFileSync(file, "utf8");
  let parsed: unknown;
  try {
    parsed = parseJsonc(text);
  } catch (error) {
    throw new Error(
      `ttsc: failed to parse ${file}: ${ConfigJsonText.describe(error)}`,
    );
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(
      `ttsc: failed to parse ${file}: The root value of a 'tsconfig.json' file must be an object.`,
    );
  }
  return parsed as Record<string, unknown>;
}
