import { TTSX_EXTRACTOR_SCRIPT } from "../../../../../packages/lint/src/index";
import { assert } from "../../internal/config-file";

/**
 * Verifies the descriptor extractor is emitted as source that can parse.
 *
 * Three loaders are generated from literals, and the two on the Go side are
 * already checked at their generators. This one is the most dangerous of the
 * three and was the only one unchecked: it lives inside a template literal, so
 * the template consumes its own escapes before anything is emitted, and a
 * dropped backslash there turns an escape into the character it was escaping —
 * a real newline or a NUL inside a JavaScript string. That produces source
 * which does not parse and takes every descriptor load with it, the same defect
 * that already shipped once on the Go side and was caught only by review.
 *
 * The emitted string is what is inspected, not this repository's text. Reading
 * the source file would check characters no consumer ever executes, and the
 * defect this exists for is invisible there.
 *
 * 1. Take the extractor's emitted source.
 * 2. Assert no line leaves a string literal open, and none carries a control
 *    character a string cannot hold.
 * 3. Assert the placeholders the caller substitutes survive.
 */
export const test_lint_config_descriptor_extractor_emits_parseable_source =
  (): void => {
    for (const line of TTSX_EXTRACTOR_SCRIPT.split("\n")) {
      assert.equal(
        quotesPair(line),
        true,
        `the extractor leaves a string literal open: ${line}`,
      );
      assert.equal(
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(line),
        false,
        `the extractor emitted a raw control character: ${JSON.stringify(line)}`,
      );
    }
    for (const placeholder of [
      "%CONFIG_IMPORT%",
      "%CONFIG_OUTPUT%",
      "%CONFIG_ROOT%",
    ]) {
      assert.equal(
        TTSX_EXTRACTOR_SCRIPT.includes(placeholder),
        true,
        `the extractor lost ${placeholder}`,
      );
    }
  };

/**
 * Whether a line's double quotes pair, ignoring escapes and line comments.
 *
 * Every literal in the emitted script opens and closes on one line, so counting
 * is enough, and stopping at a comment keeps prose carrying a lone quote from
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
