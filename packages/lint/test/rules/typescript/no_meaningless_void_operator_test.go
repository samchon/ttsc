package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusNoMeaninglessVoidOperator verifies the lint rule corpus
// fixture typescript-no-meaningless-void-operator.ts under a real Program.
//
// `typescript/no-meaningless-void-operator` is type-aware: it queries
// `GetTypeAtLocation` on the `void X` operand to decide whether the
// operand is already typed `void`, so the engine's checker-less AST
// harness used by `assertRuleCorpusCase` skips it because
// Context.Checker is nil. This Go scenario reuses the `seedLintProject`
// shape established by `no-base-to-string` and `restrict-plus-operands`:
// materialize a tsconfig project, run `ttsc lint check`, and assert on
// the rendered diagnostics.
//
//  1. Seed a project whose `void X` operand calls a `void`-returning
//     function so the operand is statically typed `void`.
//  2. Run `check` with typescript/no-meaningless-void-operator enabled as
//     error.
//  3. Assert the command exits non-zero and stderr mentions the rule.
func TestRuleCorpusNoMeaninglessVoidOperator(t *testing.T) {
  root := seedLintProject(t, `function fn(): void {
  JSON.stringify({});
}
void fn();
`)
  seedLintRules(t, root, map[string]string{"typescript/no-meaningless-void-operator": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/no-meaningless-void-operator]") {
    t.Fatalf("no-meaningless-void-operator diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
