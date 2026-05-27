package linthost

import (
	"strings"
	"testing"
)

// TestRuleCorpusNoUnnecessaryCondition verifies the lint rule corpus
// fixture typescript-no-unnecessary-condition.ts under a real Program.
//
// `typescript/no-unnecessary-condition` is type-aware: the engine's
// checker-less AST harness used by `assertRuleCorpusCase` skips it
// because Context.Checker is nil. This Go scenario reuses the
// `seedLintProject` shape established by `strict-boolean-expressions`
// and `switch-exhaustiveness-check`: materialize a tsconfig project,
// run `ttsc lint check`, and assert on the rendered diagnostics.
//
// Fixture-shape parity with
// tests/test-lint/src/cases/typescript-no-unnecessary-condition.ts is
// enforced by the TypeScript feature corpus; this Go scenario locks the
// minimum-viable trigger (`if (obj)` over a non-nullable object type)
// so a future shim regression surfaces here without depending on the
// full fixture.
//
// 1. Seed a project that places a non-nullable `{ value: number }`
//    object in an `if` condition.
// 2. Run `check` with typescript/no-unnecessary-condition enabled as error.
// 3. Assert the command exits non-zero and stderr mentions the rule.
func TestRuleCorpusNoUnnecessaryCondition(t *testing.T) {
	root := seedLintProject(t, `declare const obj: { value: number };
if (obj) {
  JSON.stringify(obj);
}
`)
	seedLintRules(t, root, map[string]string{"typescript/no-unnecessary-condition": "error"})

	code, stdout, stderr := captureCommandOutput(t, func() int {
		return run([]string{
			"check",
			"--cwd", root,
			"--plugins-json", lintManifest(t),
		})
	})
	if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/no-unnecessary-condition]") {
		t.Fatalf("no-unnecessary-condition diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
}
