package linthost

import "testing"

// TestRuleCorpusUnicornPreferResponseStaticJson verifies
// unicorn/prefer-response-static-json reports
// `new Response(JSON.stringify(value), …)`.
//
// The rule matches `NewExpression`s whose callee is `Response` and
// whose first argument is a `CallExpression` of `JSON.stringify`. This
// fixture pins the canonical positive case so the head/tail identifier
// chain on the first argument stays covered.
//
// 1. Enable unicorn/prefer-response-static-json via an expect annotation.
// 2. Construct `new Response(JSON.stringify({ ok: true }))`.
// 3. Assert the new expression is reported.
func TestRuleCorpusUnicornPreferResponseStaticJson(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/prefer-response-static-json.ts", "// expect: unicorn/prefer-response-static-json error\nconst r = new Response(JSON.stringify({ ok: true }));\nvoid r;\n")
}
