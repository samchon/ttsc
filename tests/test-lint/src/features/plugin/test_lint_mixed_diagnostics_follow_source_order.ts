import { assert, runLint } from "../../internal/config-file";

/**
 * Verifies mixed CLI diagnostics: lint and TypeScript errors share source order
 * instead of retaining the order in which their separate producers collected
 * them.
 *
 * 1. Run a project with no-var on line 1, prefer-const on line 2, and a TypeScript
 *    assignment error on line 5.
 * 2. Read both the rendered stderr stream and its lint-diagnostic parser view.
 * 3. Assert all three output positions follow the source and lint parsing retains
 *    the same rule sequence.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual launcher renders no-var on line 1, prefer-const on line 2 and a TypeScript assignment error on line 5 in source order; the independently parsed lint view retains the exact two rule/line records.
 * @evidence contracts/testing.md#independent-expectations Literal source positions and the TypeScript number/string incompatibility establish expected ordering independently of either diagnostic producer or renderer.
 * @evidence contracts/testing.md#distinguishing-cases Two lint producers precede a distinct TypeScript diagnostic, so missing findings, retained producer order and parser reordering are independently observable.
 * @evidence contracts/testing.md#execution-ownership This named entry runs the real ttsc launcher and examines both rendered stderr and the lint parser view, rather than asserting only an internal diagnostic sort helper.
 * @evidence contracts/e2e.md#necessary-boundary Actual TypeScript and native lint diagnostics must merge through the launcher renderer into one ordered output; direct rule units cannot establish the cross-producer wire and parsing connection.
 * @evidence contracts/e2e.md#shared-execution One project and one launcher call cover all three diagnostics together; its builtin lint producer uses the existing content-keyed shared cache, with no rule-specific native builds.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The source and rule map are immutable for this owned temporary project; only unchanged builtin compiler/plugin artifacts are reusable, and TestLint owns project cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Original nonzero exit, presence of all three rendered errors, both ordering inequalities and the exact parsed lint rule/line list remain executable.
 */
export function test_lint_mixed_diagnostics_follow_source_order(): void {
  const result = runLint({
    name: "mixed-diagnostics-source-order",
    source: [
      "var count = 3;",
      "let total = count;",
      "",
      "",
      'const invalid: number = "wrong";',
      "",
    ].join("\n"),
    rules: {
      "no-var": "error",
      "prefer-const": "error",
    },
  });
  assert.notEqual(result.status, 0, result.stderr);

  const noVar = result.stderr.indexOf("[no-var]");
  const preferConst = result.stderr.indexOf("[prefer-const]");
  const typeError = result.stderr.indexOf(
    "Type 'string' is not assignable to type 'number'.",
  );
  assert.ok(noVar >= 0, result.stderr);
  assert.ok(preferConst >= 0, result.stderr);
  assert.ok(typeError >= 0, result.stderr);
  assert.ok(noVar < preferConst, result.stderr);
  assert.ok(preferConst < typeError, result.stderr);
  assert.deepEqual(
    result.diagnostics.map((diagnostic) => [diagnostic.rule, diagnostic.line]),
    [
      ["no-var", 1],
      ["prefer-const", 2],
    ],
    result.stderr,
  );
}
