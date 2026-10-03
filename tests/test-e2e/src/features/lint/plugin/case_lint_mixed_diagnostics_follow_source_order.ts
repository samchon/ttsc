import { assert, runLint } from "../../../internal/lint/internal/config-file";

/**
 * Verifies the authored mixed CLI diagnostics appear in source order. This
 * input's lint-then-TypeScript order does not independently distinguish a
 * producer concatenation that already has that same order.
 *
 * 1. Run a project with no-var on line 1, prefer-const on line 2, and a TypeScript
 *    assignment error on line 5.
 * 2. Read both the rendered stderr stream and its lint-diagnostic parser view.
 * 3. Assert all three output positions follow the source and lint parsing retains
 *    the same rule sequence.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual launcher renders no-var on line 1, prefer-const on line 2 and a TypeScript assignment error on line 5 in source order; the independently parsed lint view retains the exact two rule/line records.
 * @evidence contracts/testing.md#independent-expectations Literal source positions and the TypeScript number/string incompatibility establish expected ordering independently of either diagnostic producer or renderer.
 * @evidence contracts/testing.md#distinguishing-cases Two lint diagnostics precede the distinct TypeScript diagnostic; missing markers, either asserted order inversion or changed parsed lint rows are observable. Because this input also permits a producer collection order already matching source order, it does not independently reject every unsorted concatenation or establish interleaving for other source positions.
 * @evidence contracts/testing.md#execution-ownership This named entry runs the real ttsc launcher and examines both rendered stderr and the lint parser view, rather than asserting only an internal diagnostic sort helper.
 * @evidence contracts/e2e.md#necessary-boundary Actual TypeScript and native lint diagnostics must merge through the launcher renderer into one ordered output; direct rule units cannot establish the cross-producer wire and parsing connection.
 * @evidence contracts/e2e.md#shared-execution One runLint call shares the actual project/launcher route for all three diagnostics and uses the configured shared producer cache. Parent calls do not establish actual cache hits, native child or Program counts; no rule-specific producer is deliberately prepared here.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Original source and rule inputs remain unchanged through the call. runLint retains a thrown launcher operation alongside an owned project cleanup error; LintWorkspace retains the parent root until release. A sync result is not descendant-join or loaded-image proof, and cache validity is not inferred from a selected path.
 * @evidence contracts/e2e.md#preserved-coverage Original nonzero status, all three markers, both ordering inequalities and exact no-var1/prefer-const2 parser rows remain. This input's already-aligned producer-order limitation is explicit; consolidated registration, runtime survival and cost measurement remain unverified.
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
