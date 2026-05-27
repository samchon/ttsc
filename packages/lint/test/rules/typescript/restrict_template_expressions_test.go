package linthost

import (
	"strings"
	"testing"
)

// TestRuleCorpusRestrictTemplateExpressions verifies the lint rule corpus
// fixture typescript-restrict-template-expressions.ts under a real Program.
//
// `typescript/restrict-template-expressions` is type-aware: it reads each
// `${expr}` slot's static type via `ctx.Checker.GetTypeAtLocation` and
// flags anything outside the string / number / bigint / boolean union.
// The checker-less AST harness used by `assertRuleCorpusCase` skips the
// rule because Context.Checker is nil, so this Go scenario reuses the
// `seedLintProject` shape from `only-throw-error` and
// `require-array-sort-compare`: materialize a tsconfig project, run
// `ttsc lint check`, and assert on the rendered diagnostics.
//
// 1. Seed a project that interpolates an object value into a template.
// 2. Run `check` with typescript/restrict-template-expressions enabled.
// 3. Assert the command exits non-zero and stderr mentions the rule.
func TestRuleCorpusRestrictTemplateExpressions(t *testing.T) {
	root := seedLintProject(t, `declare const obj: { id: number };
const s = `+"`"+`value=${obj}`+"`"+`;
JSON.stringify({ s });
`)
	seedLintRules(t, root, map[string]string{"typescript/restrict-template-expressions": "error"})

	code, stdout, stderr := captureCommandOutput(t, func() int {
		return run([]string{
			"check",
			"--cwd", root,
			"--plugins-json", lintManifest(t),
		})
	})
	if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/restrict-template-expressions]") {
		t.Fatalf("restrict-template-expressions diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
}
