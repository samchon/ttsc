package linthost

import (
	"strings"
	"testing"
)

// TestRuleCorpusNonNullableTypeAssertionStyle verifies the lint rule corpus
// fixture non-nullable-type-assertion-style.ts under a real Program.
//
// `typescript/non-nullable-type-assertion-style` is type-aware: it consults
// the Checker via `GetTypeAtLocation`, `GetNonNullableType`, and
// `GetTypeFromTypeNode`, so the engine's checker-less AST harness used by
// `assertRuleCorpusCase` skips it because Context.Checker is nil. This Go
// scenario therefore reuses the seedLintProject shape established by
// `no-floating-promises` and `await-thenable`: materialize a tsconfig
// project, run `ttsc lint check`, and assert on the rendered diagnostics.
//
// 1. Seed a project whose source assertion strips `undefined` and is
//    therefore equivalent to a `!` non-null assertion.
// 2. Run `check` with typescript/non-nullable-type-assertion-style enabled
//    as error.
// 3. Assert the command exits non-zero and stderr mentions the rule.
func TestRuleCorpusNonNullableTypeAssertionStyle(t *testing.T) {
	root := seedLintProject(t, `declare const maybeUndefined: string | undefined;
const value = maybeUndefined as string;
JSON.stringify(value);
`)
	seedLintRules(t, root, map[string]string{
		"typescript/non-nullable-type-assertion-style": "error",
	})

	code, stdout, stderr := captureCommandOutput(t, func() int {
		return run([]string{
			"check",
			"--cwd", root,
			"--plugins-json", lintManifest(t),
		})
	})
	if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/non-nullable-type-assertion-style]") {
		t.Fatalf("non-nullable-type-assertion-style diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
}
