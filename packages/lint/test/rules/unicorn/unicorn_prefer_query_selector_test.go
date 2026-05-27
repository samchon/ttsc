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
func TestRuleCorpusUnicornPreferQuerySelector(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/prefer-query-selector.ts", "declare const doc: Document;\n// expect: unicorn/prefer-query-selector error\ndoc.getElementById(\"main\");\n")
}
