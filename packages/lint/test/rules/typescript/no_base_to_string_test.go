package linthost

import (
	"strings"
	"testing"
)

// TestRuleCorpusNoBaseToString verifies the lint rule corpus fixture
// typescript-no-base-to-string.ts under a real Program.
//
// `typescript/no-base-to-string` is type-aware: the engine's checker-less
// AST harness used by `assertRuleCorpusCase` skips it because
// Context.Checker is nil. This Go scenario reuses the `seedLintProject`
// shape established by `no-floating-promises` and `no-for-in-array`:
// materialize a tsconfig project, run `ttsc lint check`, and assert on
// the rendered diagnostics.
//
// Fixture-shape parity with
// tests/test-lint/src/cases/typescript-no-base-to-string.ts is enforced
// by the TypeScript feature corpus; this Go scenario locks the
// minimum-viable trigger (`String(obj)` on a plain object literal) so a
// future shim regression surfaces here without depending on the full
// fixture.
//
// 1. Seed a project that calls `String(obj)` on a plain `{ id: number }`
//    object.
// 2. Run `check` with typescript/no-base-to-string enabled as error.
// 3. Assert the command exits non-zero and stderr mentions the rule.
func TestRuleCorpusNoBaseToString(t *testing.T) {
	root := seedLintProject(t, `declare const obj: { id: number };
const out = String(obj);
JSON.stringify(out);
`)
	seedLintRules(t, root, map[string]string{"typescript/no-base-to-string": "error"})

	code, stdout, stderr := captureCommandOutput(t, func() int {
		return run([]string{
			"check",
			"--cwd", root,
			"--plugins-json", lintManifest(t),
		})
	})
	if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/no-base-to-string]") {
		t.Fatalf("no-base-to-string diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
}
