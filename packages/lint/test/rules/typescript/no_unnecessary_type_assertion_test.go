package linthost

import (
	"strings"
	"testing"
)

// TestRuleCorpusNoUnnecessaryTypeAssertion verifies the lint rule corpus
// fixture typescript-no-unnecessary-type-assertion.ts under a real Program.
//
// `typescript/no-unnecessary-type-assertion` is type-aware: it consults
// the Checker via `GetTypeAtLocation`, `GetTypeFromTypeNode`, and
// `IsTypeAssignableTo`, so the engine's checker-less AST harness used by
// `assertRuleCorpusCase` skips it because Context.Checker is nil. This Go
// scenario therefore reuses the seedLintProject shape established by
// `non-nullable-type-assertion-style`: materialize a tsconfig project,
// run `ttsc lint check`, and assert on the rendered diagnostics.
//
// 1. Seed a project that asserts a `string` value back to `string`.
// 2. Run `check` with typescript/no-unnecessary-type-assertion enabled
//    as error.
// 3. Assert the command exits non-zero and stderr mentions the rule.
func TestRuleCorpusNoUnnecessaryTypeAssertion(t *testing.T) {
	root := seedLintProject(t, `declare const definitelyString: string;
const value = definitelyString as string;
JSON.stringify(value);
`)
	seedLintRules(t, root, map[string]string{
		"typescript/no-unnecessary-type-assertion": "error",
	})

	code, stdout, stderr := captureCommandOutput(t, func() int {
		return run([]string{
			"check",
			"--cwd", root,
			"--plugins-json", lintManifest(t),
		})
	})
	if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/no-unnecessary-type-assertion]") {
		t.Fatalf("no-unnecessary-type-assertion diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
}
