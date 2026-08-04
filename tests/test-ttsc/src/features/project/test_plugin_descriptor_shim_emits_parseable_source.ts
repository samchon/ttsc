import assert from "node:assert/strict";

import { PLUGIN_DESCRIPTOR_SHIM_SOURCE } from "../../../../../packages/ttsc/lib/plugin/internal/loadProjectPlugins.js";

/**
 * Verifies the plugin-descriptor shim is emitted as source that can parse.
 *
 * The shim is built from a list of template literals, so the template consumes
 * its own escapes before anything reaches disk: a `\n` written where `\\n` was
 * meant becomes a real line terminator inside a JavaScript string literal, and
 * the emitted `.mts` stops parsing. Nothing about that failure points at the
 * cause — every descriptor load fails at the build gate, including the ones
 * that would have succeeded — and it has now shipped twice in this repository,
 * on the Go side and here. `@ttsc/lint`'s extractor has carried this guard
 * since the first time; this is its twin.
 *
 * The emitted string is what is inspected, not this repository's text. Reading
 * the source file would check characters no consumer ever executes, and the
 * defect this exists for is invisible there.
 *
 * 1. Take the shim's emitted source.
 * 2. Assert no line leaves a string literal open, and none carries a control
 *    character a string cannot hold.
 * 3. Assert the environment variables the parent supplies survive.
 */
export const test_plugin_descriptor_shim_emits_parseable_source = (): void => {
  for (const line of PLUGIN_DESCRIPTOR_SHIM_SOURCE.split("\n")) {
    assert.equal(
      quotesPair(line),
      true,
      `the shim leaves a string literal open: ${line}`,
    );
    assert.equal(
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(line),
      false,
      `the shim emitted a raw control character: ${JSON.stringify(line)}`,
    );
  }
  for (const variable of [
    "TTSC_PLUGIN_ENTRY",
    "TTSC_PLUGIN_CONTEXT",
    "TTSC_PLUGIN_DESCRIPTOR_OUT",
  ]) {
    assert.equal(
      PLUGIN_DESCRIPTOR_SHIM_SOURCE.includes(variable),
      true,
      `the shim lost ${variable}`,
    );
  }
};

/**
 * Whether a line's double quotes pair, ignoring escapes and line comments.
 *
 * Every literal in the emitted shim opens and closes on one line, so counting
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
