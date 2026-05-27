package linthost

import (
	"strings"
	"testing"
)

// TestRuleCorpusPreferIncludes verifies the lint rule corpus fixture
// typescript-prefer-includes.ts under a real Program.
//
// `typescript/prefer-includes` is type-aware: the engine's checker-less
// AST harness used by `assertRuleCorpusCase` skips it because
// Context.Checker is nil. This Go scenario therefore reuses the
// `seedLintProject` shape established by `require-array-sort-compare`
// and `no-for-in-array`: materialize a tsconfig project, run
// `ttsc lint check`, and assert on the rendered diagnostics.
//
// Fixture-shape parity with
// tests/test-lint/src/cases/typescript-prefer-includes.ts is enforced by
// the TypeScript feature corpus; this Go scenario locks the
// minimum-viable trigger (`arr.indexOf(x) !== -1` on a `string[]`) so a
// future shim regression surfaces here without depending on the full
// fixture.
//
// 1. Seed a project that calls `.indexOf` on a `string[]` and compares
//    against `-1`.
// 2. Run `check` with typescript/prefer-includes enabled as error.
// 3. Assert the command exits non-zero and stderr mentions the rule.
func TestRuleCorpusPreferIncludes(t *testing.T) {
	root := seedLintProject(t, `declare const arr: string[];
const found = arr.indexOf("a") !== -1;
JSON.stringify(found);
`)
	seedLintRules(t, root, map[string]string{"typescript/prefer-includes": "error"})

	code, stdout, stderr := captureCommandOutput(t, func() int {
		return run([]string{
			"check",
			"--cwd", root,
			"--plugins-json", lintManifest(t),
		})
	})
	if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/prefer-includes]") {
		t.Fatalf("prefer-includes diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
}
