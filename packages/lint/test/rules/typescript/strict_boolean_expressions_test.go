package linthost

import (
	"strings"
	"testing"
)

// TestRuleCorpusStrictBooleanExpressions verifies the lint rule corpus
// fixture typescript-strict-boolean-expressions.ts under a real Program.
//
// `typescript/strict-boolean-expressions` is type-aware: the engine's
// checker-less AST harness used by `assertRuleCorpusCase` skips it
// because Context.Checker is nil. This Go scenario therefore reuses
// the `seedLintProject` shape established by `no-misused-promises`
// and `no-for-in-array`: materialize a tsconfig project, run
// `ttsc lint check`, and assert on the rendered diagnostics.
//
// Fixture-shape parity with
// tests/test-lint/src/cases/typescript-strict-boolean-expressions.ts is
// enforced by the TypeScript feature corpus; this Go scenario locks
// the minimum-viable trigger (`if (someNumber)` over a `number`) so a
// future shim regression surfaces here without depending on the full
// fixture.
//
// 1. Seed a project that places a `number` in an `if` condition.
// 2. Run `check` with typescript/strict-boolean-expressions enabled as error.
// 3. Assert the command exits non-zero and stderr mentions the rule.
func TestRuleCorpusStrictBooleanExpressions(t *testing.T) {
	root := seedLintProject(t, `declare const count: number;
if (count) {
  JSON.stringify(count);
}
`)
	seedLintRules(t, root, map[string]string{"typescript/strict-boolean-expressions": "error"})

	code, stdout, stderr := captureCommandOutput(t, func() int {
		return run([]string{
			"check",
			"--cwd", root,
			"--plugins-json", lintManifest(t),
		})
	})
	if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/strict-boolean-expressions]") {
		t.Fatalf("strict-boolean-expressions diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
}
