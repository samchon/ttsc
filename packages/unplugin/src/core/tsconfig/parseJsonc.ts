import { stripComments } from "./stripComments";
import { stripTrailingCommas } from "./stripTrailingCommas";

/**
 * Parse a JSONC (JSON with Comments) string by stripping comments and trailing
 * commas before handing off to `JSON.parse`. A leading UTF-8 BOM is dropped;
 * `JSON.parse` rejects it, and this reader must not lose `paths` for a config
 * the compiler accepts.
 */
export function parseJsonc(input: string): unknown {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  return JSON.parse(stripTrailingCommas(stripComments(text)));
}
