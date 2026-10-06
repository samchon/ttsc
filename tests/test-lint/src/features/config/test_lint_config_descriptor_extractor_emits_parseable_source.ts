import assert from "node:assert/strict";
import ts from "ts-legacy";

import { TTSX_EXTRACTOR_SCRIPT } from "../../../../../packages/lint/src/createTtscPlugin";

/**
 * Verifies the extractor's generated TypeScript parses after its input
 * substitution.
 *
 * Template escape consumption can insert a raw newline into a generated
 * literal. A real TypeScript parser validates what the evaluator receives,
 * rather than a quote-counting approximation of the emitted grammar.
 *
 * 1. Substitute POSIX and Windows-shaped import, output and root values, including
 *    a quote and backslashes, into the extractor template.
 * 2. Parse each result with the TypeScript parser and require no syntax
 *    diagnostics.
 * 3. Parse a literal containing a raw newline and require diagnostics, so the
 *    oracle detects the failure it guards.
 *
 * @evidence contracts/testing.md#behavioral-verification The authored extractor template is instantiated with quoted file URL and path inputs and parsed by the independent TypeScript parser; syntax diagnostics must be absent.
 * @evidence contracts/testing.md#independent-expectations TypeScript syntax defines validity independently of the emitter. Literal placeholder tokens are the documented substitution interface, and an intentionally broken string must produce a parser diagnostic.
 * @evidence contracts/testing.md#distinguishing-cases POSIX and Windows path strings containing quotes and backslashes must parse after JSON quoting; a raw newline inside a quoted literal is rejected by the same parser. Import, output, root and inherited-chain substitutions must exist before replacement.
 * @evidence contracts/testing.md#execution-ownership This named source unit reads the authored generated value and invokes a parser in process without a built descriptor, config evaluator, consumer installation or native producer. Real config evaluation remains in E2E.
 */
export function test_lint_config_descriptor_extractor_emits_parseable_source(): void {
  for (const values of [
    ["file:///project/lint.config.ts", "/project/result.json", "/project"],
    [
      "file:///C:/project/lint.config.ts",
      'C:\\project\\quoted"result.json',
      "C:\\project",
    ],
  ]) {
    let source = TTSX_EXTRACTOR_SCRIPT;
    for (const [index, token] of [
      "%CONFIG_IMPORT%",
      "%CONFIG_OUTPUT%",
      "%CONFIG_ROOT%",
    ].entries()) {
      assert.ok(source.includes(token), token);
      source = source.replace(token, JSON.stringify(values[index]));
    }
    assert.ok(source.includes("%CONFIG_CHAIN%"));
    source = source.replace("%CONFIG_CHAIN%", JSON.stringify([values[2] + "/lint.config.ts"]));
    assert.deepEqual(parseDiagnostics(source), []);
  }
  assert.notEqual(parseDiagnostics('const broken = "raw\nnewline";').length, 0);
}

function parseDiagnostics(source: string): readonly ts.Diagnostic[] {
  const parsed = ts.createSourceFile(
    "extractor.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  return (
    parsed as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }
  ).parseDiagnostics;
}
