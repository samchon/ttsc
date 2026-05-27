package linthost

import (
	"strings"
	"testing"
)

// TestRuleCorpusNoDeprecated verifies the lint rule corpus fixture
// typescript-no-deprecated.ts under a real Program.
//
// `typescript/no-deprecated` is type-aware: the engine's checker-less
// AST harness used by `assertRuleCorpusCase` skips it because
// Context.Checker is nil. This Go scenario reuses the `seedLintProject`
// shape established by the other type-aware ts rules: materialize a
// tsconfig project, run `ttsc lint check`, and assert on the rendered
// diagnostics.
//
// 1. Seed a project that declares a deprecated function and then calls
//    it.
// 2. Run `check` with typescript/no-deprecated enabled as error.
// 3. Assert the command exits non-zero and stderr mentions the rule.
func TestRuleCorpusNoDeprecated(t *testing.T) {
	root := seedLintProject(t, `/** @deprecated Use newFn instead. */
declare function oldFn(): number;
const a = oldFn();
JSON.stringify(a);
`)
	seedLintRules(t, root, map[string]string{"typescript/no-deprecated": "error"})

	code, stdout, stderr := captureCommandOutput(t, func() int {
		return run([]string{
			"check",
			"--cwd", root,
			"--plugins-json", lintManifest(t),
		})
	})
	if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/no-deprecated]") {
		t.Fatalf("no-deprecated diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
}
