package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusNoUnsafeReturn verifies the lint rule corpus fixture
// typescript-no-unsafe-return.ts under a real Program.
//
// `typescript/no-unsafe-return` is type-aware: the engine's checker-less
// AST harness used by `assertRuleCorpusCase` skips it because
// Context.Checker is nil. This Go scenario reuses the `seedLintProject`
// shape established by `no-base-to-string` and `restrict-plus-operands`:
// materialize a tsconfig project, run `ttsc lint check`, and assert on
// the rendered diagnostics.
//
// Fixture-shape parity with
// tests/test-lint/src/cases/typescript-no-unsafe-return.ts is enforced
// by the TypeScript feature corpus; this Go scenario locks the
// minimum-viable trigger (returning an `any`-typed value from a function
// whose declared return type is `number`) so a future shim regression
// surfaces here without depending on the full fixture.
//
//  1. Seed a project that returns an `any`-typed value from a function
//     declared to return `number`.
//  2. Run `check` with typescript/no-unsafe-return enabled as error.
//  3. Assert the command exits non-zero and stderr mentions the rule.
func TestRuleCorpusNoUnsafeReturn(t *testing.T) {
  root := seedLintProject(t, `declare const anyValue: any;
function asNumber(): number {
  return anyValue;
}
JSON.stringify(asNumber());
`)
  seedLintRules(t, root, map[string]string{"typescript/no-unsafe-return": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/no-unsafe-return]") {
    t.Fatalf("no-unsafe-return diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
