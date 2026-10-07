import fs from "node:fs";
import path from "node:path";

import { ConfigJsonText } from "./ConfigJsonText";
import { parseJsonc } from "./parseJsonc";

/**
 * Read and parse a JSONC (JSON with comments and trailing commas) configuration
 * file — tsconfig.json, jsconfig.json — naming parse and root-shape failures.
 * Native file-read failures propagate from Node unchanged.
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
 * @evidence contracts/portability.md#os-neutral-implementation Node reads the supplied native path as UTF-8; native basename selects jsconfig.json root wording only for that exact filename, matching the compiler's choice. Parsing counts text line terminators independently of OS newline conventions, with no path-case assumption.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Node owns the synchronous file-read handle lifecycle; text and parser state are local, while the caller owns the returned config tree. Successful return or failure makes local state reclaimable without a forced engine-reclamation deadline; no historical config population or live observer is retained here.
 * @evidence contracts/performance.md#efficient-algorithms A native UTF-8 read delegates path lookup and byte decoding, then the shared parser consumes text, constructs a value and can scan the original text for a failure position. Work and temporary/output storage depend on file content and parser nesting; one reader call does not make that delegated parsing constant. Root-shape checks are fixed, and filename attribution formats path/error text.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This reader coordinates no completed or in-flight configs across requests; current file parsing and fresh mutable output belong to its caller, which must own any higher-level validity proof.
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
    const name =
      path.basename(file) === "jsconfig.json"
        ? "jsconfig.json"
        : "tsconfig.json";
    throw new Error(
      `ttsc: failed to parse ${file}: The root value of a '${name}' file must be an object.`,
    );
  }
  return parsed as Record<string, unknown>;
}
