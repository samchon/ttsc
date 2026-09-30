package linthost

import "testing"

// TestRuleCorpusUnicornPreferQuerySelector verifies
// unicorn/prefer-query-selector reports `doc.getElementById("main")`.
//
// Identifier-text-driven on the legacy lookup method name with a
// one-string-literal-argument gate; the fixture pins the canonical
// id-lookup shape that the rule redirects to `querySelector`.
//
// 1. Enable unicorn/prefer-query-selector via an expect annotation.
// 2. Call `doc.getElementById("main")` on a declared document.
// 3. Assert the call site is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies getElementById uses a specialized legacy DOM query; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-query-selector annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; querySelector expresses the ID selector. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferQuerySelector is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferQuerySelector(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-query-selector.ts", "declare const doc: Document;\n// expect: unicorn/prefer-query-selector error\ndoc.getElementById(\"main\");\n")
  assertRuleSkipsSource(t, "unicorn/prefer-query-selector", "declare const doc: Document; doc.querySelector(\"#main\");\n")
}
