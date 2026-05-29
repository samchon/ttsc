package linthost

import "testing"

// TestRuleCorpusUnicornPreferCodePoint verifies the rule reports a
// `"a".charCodeAt(0)` call.
//
// The rule keys on the method-name identifier (`charCodeAt` /
// `fromCharCode`) of a property-access call. For `charCodeAt` the
// receiver is anything — a string literal is the smallest legible
// positive shape and matches the canonical legacy pattern that splits
// astral characters into surrogate pairs.
//
// 1. Enable unicorn/prefer-code-point via an expect annotation.
// 2. Call `"a".charCodeAt(0)` on a string literal.
// 3. Assert the call site is reported.
func TestRuleCorpusUnicornPreferCodePoint(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-code-point.ts", "// expect: unicorn/prefer-code-point error\nconst code = \"a\".charCodeAt(0);\nvoid code;\n")
}
