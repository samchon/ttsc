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
 */
export const test_lint_mixed_diagnostics_follow_source_order = (): void => {
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
};
