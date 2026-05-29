package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusPreferReduceTypeParameter verifies the lint rule corpus
// fixture typescript-prefer-reduce-type-parameter.ts under a real Program.
//
// `typescript/prefer-reduce-type-parameter` is type-aware: the engine's
// checker-less AST harness used by `assertRuleCorpusCase` skips it because
// Context.Checker is nil. This Go scenario reuses the `seedLintProject`
// shape established by `prefer-includes` and `no-base-to-string`:
// materialize a tsconfig project, run `ttsc lint check`, and assert on
// the rendered diagnostics.
//
// Fixture-shape parity with
// tests/test-lint/src/cases/typescript-prefer-reduce-type-parameter.ts is
// enforced by the TypeScript feature corpus; this Go scenario locks the
// minimum-viable trigger (`arr.reduce(cb, [] as string[])`) so a future
// shim regression surfaces here without depending on the full fixture.
//
//  1. Seed a project that calls `.reduce` on a `number[]` with an
//     `as`-asserted accumulator seed.
//  2. Run `check` with typescript/prefer-reduce-type-parameter enabled as
//     error.
//  3. Assert the command exits non-zero and stderr mentions the rule.
func TestRuleCorpusPreferReduceTypeParameter(t *testing.T) {
  root := seedLintProject(t, `declare const list: number[];
const collected = list.reduce(
  (acc, value) => {
    acc.push(String(value));
    return acc;
  },
  [] as string[],
);
JSON.stringify(collected);
`)
  seedLintRules(t, root, map[string]string{"typescript/prefer-reduce-type-parameter": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/prefer-reduce-type-parameter]") {
    t.Fatalf("prefer-reduce-type-parameter diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
