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
 *
 * @evidence contracts/common.md#principled-implementation The shared JSONC parser establishes literal syntax, and an explicit object/non-null/non-array guard establishes the compiler config's object root before returning a record to project readers.
 * @evidence contracts/common.md#clear-and-simple-design This boundary owns file reading, filename attribution and config-root validation; lexical parsing remains in parseJsonc so consumers share one grammar.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Invalid syntax and root shapes remain named errors rather than being replaced by empty configs that could hide user configuration mistakes.
 * @evidence contracts/common.md#meaningful-documentation Separate paragraphs explain file attribution and the distinction between valid JSONC values and permitted config roots, following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Node reads the supplied native path as UTF-8; parsing counts text line terminators independently of OS newline conventions, and no path spelling is converted into a case assumption.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources readJsoncFile acquires no handle, buffer or cache and retains nothing after it returns.
 * @evidenceExclude contracts/performance.md#efficient-algorithms readJsoncFile performs a fixed number of steps with no loop or recursion over caller data.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work readJsoncFile computes one result per call, so there is no repeated work to share.
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
