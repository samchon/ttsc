package linthost

import (
	"strings"
	"testing"
)

// TestRuleCorpusNoUnnecessaryBooleanLiteralCompare verifies the lint
// rule corpus fixture typescript-no-unnecessary-boolean-literal-compare.ts
// under a real Program.
//
// `typescript/no-unnecessary-boolean-literal-compare` is type-aware: the
// engine's checker-less AST harness used by `assertRuleCorpusCase` skips
// it because Context.Checker is nil. This Go scenario reuses the
// `seedLintProject` shape established by `strict-boolean-expressions`
// and `no-base-to-string`: materialize a tsconfig project, run
// `ttsc lint check`, and assert on the rendered diagnostics.
//
// Fixture-shape parity with
// tests/test-lint/src/cases/typescript-no-unnecessary-boolean-literal-compare.ts
// is enforced by the TypeScript feature corpus; this Go scenario locks
// the minimum-viable trigger (`flag === true` over a pure boolean) so a
// future shim regression surfaces here without depending on the full
// fixture.
//
// 1. Seed a project that compares a `boolean` with the `true` literal.
// 2. Run `check` with typescript/no-unnecessary-boolean-literal-compare
//    enabled as error.
// 3. Assert the command exits non-zero and stderr mentions the rule.
func TestRuleCorpusNoUnnecessaryBooleanLiteralCompare(t *testing.T) {
	root := seedLintProject(t, `declare const flag: boolean;
const yes = flag === true;
JSON.stringify(yes);
`)
	seedLintRules(t, root, map[string]string{"typescript/no-unnecessary-boolean-literal-compare": "error"})

	code, stdout, stderr := captureCommandOutput(t, func() int {
		return run([]string{
			"check",
			"--cwd", root,
			"--plugins-json", lintManifest(t),
		})
	})
	if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/no-unnecessary-boolean-literal-compare]") {
		t.Fatalf("no-unnecessary-boolean-literal-compare diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
}
