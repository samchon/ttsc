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
func TestRuleCorpusUnicornPreferStringReplaceAll(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-string-replace-all.ts", "// expect: unicorn/prefer-string-replace-all error\nconst out = \"abc\".replace(/a/g, \"x\");\n")
}
