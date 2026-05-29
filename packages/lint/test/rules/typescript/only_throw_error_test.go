package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusOnlyThrowError verifies the lint rule corpus fixture
// only-throw-error.ts under a real Program.
//
// The rule is type-aware: it inspects the throw expression's type via
// `ctx.Checker.GetTypeAtLocation` and flags primitive throws. The
// checker-less AST harness used by `assertRuleCorpusCase` skips the
// rule, so this test reuses the `command_*` shape: seed a tsconfig
// project, run `ttsc lint check`, and assert on the rendered
// diagnostics.
//
// 1. Seed a project that throws a string literal.
// 2. Run `check` with typescript/only-throw-error enabled as error.
// 3. Assert the command exits non-zero and stderr mentions the rule.
func TestRuleCorpusOnlyThrowError(t *testing.T) {
  root := seedLintProject(t, `function bad(): never {
  throw "boom";
}
void bad();
`)
  seedLintRules(t, root, map[string]string{"typescript/only-throw-error": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/only-throw-error]") {
    t.Fatalf("only-throw-error diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
