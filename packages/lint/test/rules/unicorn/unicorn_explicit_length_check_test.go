package linthost

import "testing"

// TestRuleCorpusUnicornExplicitLengthCheck verifies the rule reports a
// `.length` property access used as an `if` test.
//
// `if (xs.length) …` reads "is `xs` truthy" rather than "does `xs` have
// elements". The fixture pins the boolean-context branch: a
// `PropertyAccessExpression` whose `Name()` is `length` whose parent is
// the `Expression` slot of a `KindIfStatement`.
//
// 1. Enable unicorn/explicit-length-check via an expect annotation.
// 2. Write `if (xs.length) { … }` against a declared array.
// 3. Assert the property access is reported.
func TestRuleCorpusUnicornExplicitLengthCheck(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/explicit-length-check.ts", "declare const xs: number[];\nif (\n  // expect: unicorn/explicit-length-check error\n  xs.length\n) {\n  void 0;\n}\n")
}
