import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assert } from "../../internal/config-file";

/**
 * Verifies the descriptor extractor is emitted as source that can parse.
 *
 * Three loaders are generated from literals, and the two on the Go side are
 * already checked at their generators. This one is the most dangerous of the
 * three and was the only one unchecked: it lives inside a template literal, so
 * the template consumes escapes before anything is emitted, and a `"\n"` typed
 * there becomes a real newline inside a JavaScript string. That produces source
 * which does not parse, and it takes every descriptor load with it — the same
 * defect already shipped once on the Go side and was caught only by review.
 *
 * 1. Read the extractor template out of the plugin source.
 * 2. Assert no emitted line leaves a string literal open.
 * 3. Assert the placeholders the caller substitutes are still present.
 */
export const test_lint_config_descriptor_extractor_emits_parseable_source =
  (): void => {
    const source = fs.readFileSync(pluginSourcePath(), "utf8");
    const opening = source.indexOf("const TTSX_EXTRACTOR_SCRIPT = `");
    assert.notEqual(opening, -1, "the extractor template moved or was renamed");
    const body = source.slice(source.indexOf("`", opening) + 1);
    const script = body.slice(0, closingBacktick(body));

    for (const line of script.split("\n")) {
      assert.equal(
        quotesPair(line),
        true,
        `the extractor leaves a string literal open: ${line}`,
      );
    }
    for (const placeholder of [
      "%CONFIG_IMPORT%",
      "%CONFIG_OUTPUT%",
      "%CONFIG_ROOT%",
    ]) {
      assert.equal(
        script.includes(placeholder),
        true,
        `the extractor lost ${placeholder}`,
      );
    }
  };

function pluginSourcePath(): string {
  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "..",
    "..",
    "..",
    "packages",
    "lint",
    "src",
    "index.ts",
  );
}

/** The first backtick the template's own escaping did not neutralize. */
function closingBacktick(body: string): number {
  for (let index = 0; index < body.length; index++) {
    if (body[index] === "\\") {
      index++;
      continue;
    }
    if (body[index] === "`") return index;
  }
  return body.length;
}

/**
 * Whether a line's double quotes pair, ignoring escapes and line comments.
 *
 * Every literal in this template opens and closes on one line, so counting is
 * enough, and stopping at a comment keeps prose carrying a lone quote from
 * failing as if it were code.
 */
function quotesPair(line: string): boolean {
  let quotes = 0;
  for (let index = 0; index < line.length; index++) {
    if (line[index] === "\\") {
      index++;
      continue;
    }
    if (quotes % 2 === 0 && line.startsWith("//", index)) break;
    if (line[index] === '"') quotes++;
  }
  return quotes % 2 === 0;
}
