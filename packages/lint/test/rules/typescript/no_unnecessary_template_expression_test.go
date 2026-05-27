package linthost

import (
	"strings"
	"testing"
)

// TestRuleCorpusNoUnnecessaryTemplateExpression verifies the lint rule
// corpus fixture typescript-no-unnecessary-template-expression.ts under
// a real Program.
//
// `typescript/no-unnecessary-template-expression` is type-aware: it
// queries `GetTypeAtLocation` on the single template-span expression to
// decide whether `` `${x}` `` collapses to a regular string literal,
// so the engine's checker-less AST harness used by
// `assertRuleCorpusCase` skips the rule because Context.Checker is nil.
// This Go scenario reuses the `seedLintProject` shape established by
// `restrict-template-expressions` and `no-base-to-string`: materialize a
// tsconfig project, run `ttsc lint check`, and assert on the rendered
// diagnostics.
//
// 1. Seed a project whose `` `${name}` `` template wraps a single
//    string-typed value with empty surrounding chars.
// 2. Run `check` with typescript/no-unnecessary-template-expression
//    enabled as error.
// 3. Assert the command exits non-zero and stderr mentions the rule.
func TestRuleCorpusNoUnnecessaryTemplateExpression(t *testing.T) {
	root := seedLintProject(t, `declare const label: string;
const s = `+"`${label}`"+`;
JSON.stringify({ s });
`)
	seedLintRules(t, root, map[string]string{"typescript/no-unnecessary-template-expression": "error"})

	code, stdout, stderr := captureCommandOutput(t, func() int {
		return run([]string{
			"check",
			"--cwd", root,
			"--plugins-json", lintManifest(t),
		})
	})
	if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/no-unnecessary-template-expression]") {
		t.Fatalf("no-unnecessary-template-expression diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
}
