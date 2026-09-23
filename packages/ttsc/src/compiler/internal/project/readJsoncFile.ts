import fs from "node:fs";

import { ConfigJsonText } from "./ConfigJsonText";
import { parseJsonc } from "./parseJsonc";

/**
 * Read and parse a JSONC (JSON with comments and trailing commas) configuration
 * file — tsconfig.json, jsconfig.json — naming it on failure.
 */
export function readJsoncFile(file: string): unknown {
  const text = fs.readFileSync(file, "utf8");
  try {
    return parseJsonc(text);
  } catch (error) {
    throw new Error(
      `ttsc: failed to parse ${file}: ${ConfigJsonText.describe(error)}`,
    );
  }
}
