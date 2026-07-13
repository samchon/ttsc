package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusNoFloatingPromises verifies the lint rule corpus fixture
// no-floating-promises.ts under a real Program.
//
// `typescript/no-floating-promises` is type-aware: the engine's checker-less
// AST harness used by `assertRuleCorpusCase` skips it because Context.Checker
// is nil. The rule therefore uses the command-test shape for type-aware rules:
// materialize a tsconfig project, run `ttsc lint check`, and assert on the
// rendered diagnostics.
//
// Fixture-shape parity with tests/test-lint/src/cases/no-floating-promises.ts
// is enforced by the TypeScript feature corpus; this Go scenario locks the
// minimum-viable trigger (`getPromise();`) so a future shim regression
// surfaces here without depending on the full fixture.
//
// 1. Seed a project that defines getPromise() and discards its return.
// 2. Run `check` with typescript/no-floating-promises enabled as error.
// 3. Assert the command exits non-zero and stderr mentions the rule.
func TestRuleCorpusNoFloatingPromises(t *testing.T) {
  root := seedLintProject(t, `declare function getPromise(): Promise<number>;
getPromise();
`)
  seedLintRules(t, root, map[string]string{"typescript/no-floating-promises": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/no-floating-promises]") {
    t.Fatalf("no-floating-promises diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
