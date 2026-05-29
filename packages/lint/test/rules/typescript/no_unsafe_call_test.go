package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusNoUnsafeCall verifies the lint rule corpus fixture
// typescript-no-unsafe-call.ts under a real Program.
//
// `typescript/no-unsafe-call` is type-aware: it asks the Checker for the
// callee's static type at each `CallExpression`, `NewExpression`, and
// `TaggedTemplateExpression`, and flags invocations on an `any` value.
// The engine's checker-less AST harness used by `assertRuleCorpusCase`
// skips the rule because Context.Checker is nil, so this Go scenario
// reuses the `seedLintProject` shape established by `no-floating-promises`
// and `no-for-in-array`: materialize a tsconfig project, run `ttsc lint
// check`, and assert on the rendered diagnostics.
//
// Fixture-shape parity with
// tests/test-lint/src/cases/typescript-no-unsafe-call.ts is enforced by
// the TypeScript feature corpus; this Go scenario locks the
// minimum-viable trigger (`anyValue()`) so a future shim regression
// surfaces here without depending on the full fixture.
//
// 1. Seed a project that calls an `any`-typed value as a function.
// 2. Run `check` with typescript/no-unsafe-call enabled as error.
// 3. Assert the command exits non-zero and stderr mentions the rule.
func TestRuleCorpusNoUnsafeCall(t *testing.T) {
  root := seedLintProject(t, `declare const anyValue: any;
anyValue();
`)
  seedLintRules(t, root, map[string]string{"typescript/no-unsafe-call": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/no-unsafe-call]") {
    t.Fatalf("no-unsafe-call diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
