package linthost

import (
	"strings"
	"testing"
)

// TestRuleCorpusNoForInArray verifies the lint rule corpus fixture
// no-for-in-array.ts under a real Program.
//
// `typescript/no-for-in-array` is type-aware: the engine's checker-less AST
// harness used by `assertRuleCorpusCase` skips it because Context.Checker is
// nil. This Go scenario therefore reuses the `seedLintProject` shape
// established by `no-floating-promises` and `non-nullable-type-assertion-style`:
// materialize a tsconfig project, run `ttsc lint check`, and assert on the
// rendered diagnostics.
//
// Fixture-shape parity with tests/test-lint/src/cases/typescript-no-for-in-array.ts
// is enforced by the TypeScript feature corpus; this Go scenario locks the
// minimum-viable trigger (`for (const k in arr)` over a `number[]`) so a
// future shim regression surfaces here without depending on the full fixture.
//
// 1. Seed a project that iterates a typed `number[]` with `for...in`.
// 2. Run `check` with typescript/no-for-in-array enabled as error.
// 3. Assert the command exits non-zero and stderr mentions the rule.
func TestRuleCorpusNoForInArray(t *testing.T) {
	root := seedLintProject(t, `declare const arr: number[];
for (const key in arr) {
  JSON.stringify(key);
}
`)
	seedLintRules(t, root, map[string]string{"typescript/no-for-in-array": "error"})

	code, stdout, stderr := captureCommandOutput(t, func() int {
		return run([]string{
			"check",
			"--cwd", root,
			"--plugins-json", lintManifest(t),
		})
	})
	if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/no-for-in-array]") {
		t.Fatalf("no-for-in-array diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
}
