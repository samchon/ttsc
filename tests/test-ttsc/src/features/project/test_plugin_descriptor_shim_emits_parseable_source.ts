import assert from "node:assert/strict";
import ts from "ts-legacy";

import { COMMONJS_PLUGIN_DESCRIPTOR_SHIM_SOURCE } from "../../../../../packages/ttsc/src/plugin/internal/load/COMMONJS_PLUGIN_DESCRIPTOR_SHIM_SOURCE";
import { PLUGIN_DESCRIPTOR_SHIM_SOURCE } from "../../../../../packages/ttsc/src/plugin/internal/load/PLUGIN_DESCRIPTOR_SHIM_SOURCE";

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
 * 3. Parse the complete emitted program with the independent TypeScript parser.
 *
 * @evidence contracts/testing.md#behavioral-verification Parses both actual emitted shim programs using TypeScript transpileModule with syntax diagnostics enabled and retains per-line quote/control-character guards.
 * @evidence contracts/testing.md#independent-expectations An independently maintained language parser must report zero diagnostics for the complete generated programs; separately authored unterminated strings and missing expressions must be rejected by the same oracle.
 * @evidence contracts/testing.md#distinguishing-cases Both exported shim source constants are parsed as ESM with the TypeScript parser and checked line by line, while a string literal broken by a raw newline and an incomplete expression are control inputs that the same parser must report as errors, so the check is not a quote-count alone. Whether the shims behave correctly when run is not tested here.
 * @evidence contracts/testing.md#execution-ownership A unit test that reads two source-text constants from production code and parses them in process with the TypeScript transpiler; no descriptor is loaded, no ttsx run and no native build.
 */
export const test_plugin_descriptor_shim_emits_parseable_source = (): void => {
  for (const source of [
    PLUGIN_DESCRIPTOR_SHIM_SOURCE,
    COMMONJS_PLUGIN_DESCRIPTOR_SHIM_SOURCE,
  ]) {
    const parsed = ts.transpileModule(source, {
      fileName: "descriptor-shim.mts",
      reportDiagnostics: true,
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ESNext,
      },
    });
    assert.deepEqual(parsed.diagnostics, [], "complete emitted shim must parse");
    for (const line of source.split("\n")) {
      assert.equal(
        quotesPair(line),
        true,
        `the shim leaves a string literal open: ${line}`,
      );
      assert.equal(
        // A carriage return is in the class even though a newline is not: the
        // split above already turns a stray newline into an unterminated literal
        // the scanner catches, while a stray carriage return neither splits the
        // line nor unbalances a quote - and it is still a syntax error.
        /[\u0000-\u0008\u000b\u000c\r\u000e-\u001f]/.test(line),
        false,
        `the shim emitted a raw control character: ${JSON.stringify(line)}`,
      );
    }
  }
  for (const malformed of ['process.stderr.write("broken\n");', "const incomplete = ;"]) {
    const parsed = ts.transpileModule(malformed, {
      fileName: "malformed-shim.mts",
      reportDiagnostics: true,
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ESNext,
      },
    });
    assert.ok(parsed.diagnostics!.length > 0, "language oracle must reject invalid source");
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
