package linthost

import "testing"

// TestRuleCorpusUnicornPreferStringTrimStartEnd verifies
// unicorn/prefer-string-trim-start-end reports the deprecated `.trimLeft()`
// and `.trimRight()` callsites.
//
// Both deprecated names share one matcher: a `CallExpression` whose callee is
// a `PropertyAccessExpression` ending in `trimLeft` or `trimRight`. This
// fixture covers both `.trimLeft()` and `.trimRight()` against their
// accepted directional replacements.
//
// 1. Enable unicorn/prefer-string-trim-start-end via an expect annotation.
// 2. Call `.trimLeft()` on a padded string literal.
// 3. Assert the call expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies trimLeft uses the legacy directional name; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-string-trim-start-end annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; trimRight also reports, while trimStart and trimEnd use the supported directional names. All four source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferStringTrimStartEnd is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferStringTrimStartEnd(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-string-trim-start-end.ts", "// expect: unicorn/prefer-string-trim-start-end error\nconst s = \"  hi  \".trimLeft();\n")
  assertRuleSkipsSource(t, "unicorn/prefer-string-trim-start-end", "const s = \"  hi  \".trimStart();\n")
  assertRuleCorpusCase(t, "unicorn/prefer-string-trim-right.ts", "// expect: unicorn/prefer-string-trim-start-end error\nconst s = \"  hi  \".trimRight();\n")
  assertRuleSkipsSource(t, "unicorn/prefer-string-trim-start-end", "const s = \"  hi  \".trimEnd();\n")
}
