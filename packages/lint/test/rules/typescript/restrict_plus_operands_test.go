package linthost

import (
	"strings"
	"testing"
)

// TestRuleCorpusRestrictPlusOperands verifies the lint rule corpus fixture
// typescript-restrict-plus-operands.ts under a real Program.
//
// `typescript/restrict-plus-operands` is type-aware: it queries
// `GetTypeAtLocation` on both operands of `+`, so the engine's
// checker-less AST harness used by `assertRuleCorpusCase` skips it
// because Context.Checker is nil. This Go scenario therefore reuses the
// `seedLintProject` shape established by `no-floating-promises` and
// `no-for-in-array`: materialize a tsconfig project, run `ttsc lint
// check`, and assert on the rendered diagnostics.
//
// Fixture-shape parity with tests/test-lint/src/cases/typescript-restrict-plus-operands.ts
// is enforced by the TypeScript feature corpus; this Go scenario locks
// the minimum-viable trigger (`1 + "a"`) so a future shim regression
// surfaces here without depending on the full fixture.
//
// 1. Seed a project that adds a number literal to a string literal.
// 2. Run `check` with typescript/restrict-plus-operands enabled as error.
// 3. Assert the command exits non-zero and stderr mentions the rule.
func TestRuleCorpusRestrictPlusOperands(t *testing.T) {
	root := seedLintProject(t, `const mixed = 1 + "a";
JSON.stringify(mixed);
`)
	seedLintRules(t, root, map[string]string{"typescript/restrict-plus-operands": "error"})

	code, stdout, stderr := captureCommandOutput(t, func() int {
		return run([]string{
			"check",
			"--cwd", root,
			"--plugins-json", lintManifest(t),
		})
	})
	if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/restrict-plus-operands]") {
		t.Fatalf("restrict-plus-operands diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
}
