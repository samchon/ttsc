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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies Response manually wraps JSON.stringify; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-response-static-json annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; Response.json directly constructs the JSON response. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferResponseStaticJson is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferResponseStaticJson(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-response-static-json.ts", "// expect: unicorn/prefer-response-static-json error\nconst r = new Response(JSON.stringify({ ok: true }));\nvoid r;\n")
  assertRuleSkipsSource(t, "unicorn/prefer-response-static-json", "const r = Response.json({ ok: true });\n")
}
