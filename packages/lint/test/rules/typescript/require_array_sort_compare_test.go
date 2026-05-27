package linthost

import (
	"strings"
	"testing"
)

// TestRuleCorpusRequireArraySortCompare verifies the lint rule corpus fixture
// typescript-require-array-sort-compare.ts under a real Program.
//
// `typescript/require-array-sort-compare` is type-aware: the engine's
// checker-less AST harness used by `assertRuleCorpusCase` skips it because
// Context.Checker is nil. The rule therefore reuses the `command_*` shape
// established by `await-thenable`'s and `no-floating-promises`'s tests:
// materialize a tsconfig project, run `ttsc lint check`, and assert on the
// rendered diagnostics.
//
// Fixture-shape parity with tests/test-lint/src/cases/typescript-require-array-sort-compare.ts
// is enforced by the TypeScript feature corpus; this Go scenario locks the
// minimum-viable trigger (`numbers.sort();`) so a future shim regression
// surfaces here without depending on the full fixture.
//
// 1. Seed a project that declares a number[] and calls .sort() with no args.
// 2. Run `check` with typescript/require-array-sort-compare enabled as error.
// 3. Assert the command exits non-zero and stderr mentions the rule.
func TestRuleCorpusRequireArraySortCompare(t *testing.T) {
	root := seedLintProject(t, `declare const numbers: number[];
numbers.sort();
`)
	seedLintRules(t, root, map[string]string{"typescript/require-array-sort-compare": "error"})

	code, stdout, stderr := captureCommandOutput(t, func() int {
		return run([]string{
			"check",
			"--cwd", root,
			"--plugins-json", lintManifest(t),
		})
	})
	if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/require-array-sort-compare]") {
		t.Fatalf("require-array-sort-compare diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
}
