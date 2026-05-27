package linthost

import (
	"strings"
	"testing"
)

// TestRuleCorpusPreferStringStartsEndsWith verifies the lint rule corpus
// fixture typescript-prefer-string-starts-ends-with.ts under a real
// Program.
//
// `typescript/prefer-string-starts-ends-with` is type-aware: the
// engine's checker-less AST harness used by `assertRuleCorpusCase`
// skips it because Context.Checker is nil. This Go scenario therefore
// reuses the `seedLintProject` shape established by `prefer-includes`
// and `no-for-in-array`: materialize a tsconfig project, run
// `ttsc lint check`, and assert on the rendered diagnostics.
//
// Fixture-shape parity with
// tests/test-lint/src/cases/typescript-prefer-string-starts-ends-with.ts
// is enforced by the TypeScript feature corpus; this Go scenario locks
// the minimum-viable trigger (`str.indexOf(p) === 0`) so a future
// shim regression surfaces here without depending on the full fixture.
//
// 1. Seed a project that compares `str.indexOf(needle) === 0` against
//    a `string` receiver.
// 2. Run `check` with typescript/prefer-string-starts-ends-with
//    enabled as error.
// 3. Assert the command exits non-zero and stderr mentions the rule.
func TestRuleCorpusPreferStringStartsEndsWith(t *testing.T) {
	root := seedLintProject(t, `declare const text: string;
declare const needle: string;
const startsWith = text.indexOf(needle) === 0;
JSON.stringify(startsWith);
`)
	seedLintRules(t, root, map[string]string{"typescript/prefer-string-starts-ends-with": "error"})

	code, stdout, stderr := captureCommandOutput(t, func() int {
		return run([]string{
			"check",
			"--cwd", root,
			"--plugins-json", lintManifest(t),
		})
	})
	if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/prefer-string-starts-ends-with]") {
		t.Fatalf("prefer-string-starts-ends-with diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
}
