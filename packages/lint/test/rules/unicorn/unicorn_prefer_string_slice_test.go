package linthost

import "testing"

// TestRuleCorpusUnicornPreferStringSlice verifies unicorn/prefer-string-slice
// reports `.substr(…)` and `.substring(…)` callsites.
//
// The rule treats both names as banned regardless of receiver type — `substr`
// is deprecated and `substring` has surprising swap-arguments semantics — so
// the AST-only callee match is sufficient. This fixture pins the `.substr`
// arm and separately checks `.substring` as the other supported legacy API.
//
// 1. Enable unicorn/prefer-string-slice via an expect annotation.
// 2. Call `.substr(0, 3)` on a string literal.
// 3. Assert the call expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies substr is used instead of the supported slice API; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-string-slice annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; substring also reports, while slice uses the corresponding start and end bounds without a legacy method. All three source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferStringSlice is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferStringSlice(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-string-slice.ts", "// expect: unicorn/prefer-string-slice error\nconst s = \"hello\".substr(0, 3);\n")
  assertRuleSkipsSource(t, "unicorn/prefer-string-slice", "const s = \"hello\".slice(0,3);\n")
  assertRuleCorpusCase(t, "unicorn/prefer-string-slice-substring.ts", "// expect: unicorn/prefer-string-slice error\nconst s = \"hello\".substring(0,3);\n")
}
