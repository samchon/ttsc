package linthost

import "testing"

// TestRuleCorpusUnicornPreferStringReplaceAll verifies
// unicorn/prefer-string-replace-all reports `.replace(/literal/g, …)`.
//
// The rule reads the regex literal's raw source text (via `nodeText`) to detect
// the `g` flag because the AST does not split pattern from flags. This fixture
// pins the simplest globally-flagged literal so regressions in the raw-text
// accessor or in the flag-block scan surface immediately.
//
// 1. Enable unicorn/prefer-string-replace-all via an expect annotation.
// 2. Call `.replace(/a/g, "x")` on a string literal.
// 3. Assert the call expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies replace receives a global regex for replacing every match; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-string-replace-all annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; replaceAll states the all-matches operation explicitly. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferStringReplaceAll is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferStringReplaceAll(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-string-replace-all.ts", "// expect: unicorn/prefer-string-replace-all error\nconst out = \"abc\".replace(/a/g, \"x\");\n")
  assertRuleSkipsSource(t, "unicorn/prefer-string-replace-all", "const out = \"abc\".replaceAll(\"a\", \"x\");\n")
}
