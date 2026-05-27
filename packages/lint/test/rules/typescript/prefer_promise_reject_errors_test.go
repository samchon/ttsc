package linthost

import (
	"strings"
	"testing"
)

// TestRuleCorpusPreferPromiseRejectErrors verifies the lint rule corpus
// fixture typescript-prefer-promise-reject-errors.ts under a real
// Program.
//
// The rule is type-aware: it inspects the reject argument's type via
// `ctx.Checker.GetTypeAtLocation` and flags primitive rejections. The
// checker-less AST harness used by `assertRuleCorpusCase` skips the
// rule, so this test reuses the `command_*` shape: seed a tsconfig
// project, run `ttsc lint check`, and assert on the rendered
// diagnostics.
//
// 1. Seed a project that rejects with a string literal.
// 2. Run `check` with typescript/prefer-promise-reject-errors enabled as error.
// 3. Assert the command exits non-zero and stderr mentions the rule.
func TestRuleCorpusPreferPromiseRejectErrors(t *testing.T) {
	root := seedLintProject(t, `function bad(): Promise<never> {
  return Promise.reject("boom");
}
void bad();
`)
	seedLintRules(t, root, map[string]string{"typescript/prefer-promise-reject-errors": "error"})

	code, stdout, stderr := captureCommandOutput(t, func() int {
		return run([]string{
			"check",
			"--cwd", root,
			"--plugins-json", lintManifest(t),
		})
	})
	if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/prefer-promise-reject-errors]") {
		t.Fatalf("prefer-promise-reject-errors diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
}
