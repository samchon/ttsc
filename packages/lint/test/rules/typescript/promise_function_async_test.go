package linthost

import (
	"strings"
	"testing"
)

// TestRuleCorpusPromiseFunctionAsync verifies the lint rule corpus fixture
// typescript-promise-function-async.ts under a real Program.
//
// `typescript/promise-function-async` is type-aware: the engine's
// checker-less AST harness used by `assertRuleCorpusCase` skips it because
// Context.Checker is nil. This Go scenario reuses the `seedLintProject`
// shape established by the surrounding async family — materialize a
// tsconfig project, run `ttsc lint check`, and assert on the rendered
// diagnostics — to lock the minimum-viable trigger (a function declaration
// whose return type is `Promise<T>` without the `async` keyword) so a
// future shim regression surfaces here without depending on the full
// fixture.
//
// 1. Seed a project with a function returning `Promise<number>` that
//    forwards another Promise without being declared `async`.
// 2. Run `check` with typescript/promise-function-async enabled as error.
// 3. Assert the command exits non-zero and stderr mentions the rule.
func TestRuleCorpusPromiseFunctionAsync(t *testing.T) {
	root := seedLintProject(t, `declare function getPromise(): Promise<number>;
function makePromise(): Promise<number> {
  return getPromise();
}
JSON.stringify(makePromise);
`)
	seedLintRules(t, root, map[string]string{"typescript/promise-function-async": "error"})

	code, stdout, stderr := captureCommandOutput(t, func() int {
		return run([]string{
			"check",
			"--cwd", root,
			"--plugins-json", lintManifest(t),
		})
	})
	if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/promise-function-async]") {
		t.Fatalf("promise-function-async diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
}
