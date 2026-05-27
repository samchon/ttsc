package linthost

import "testing"

// TestRuleCorpusUnicornPreferPrototypeMethods verifies
// unicorn/prefer-prototype-methods reports `[].slice`-style empty-literal
// property accesses used to borrow a prototype method.
//
// The rule matches `PropertyAccessExpression` nodes whose receiver is an
// empty `[]` or `{}` literal. This fixture pins the array-arm with the
// canonical `[].slice` shorthand so the empty-elements guard stays
// covered.
//
// 1. Enable unicorn/prefer-prototype-methods via an expect annotation.
// 2. Read `[].slice` to borrow `Array.prototype.slice`.
// 3. Assert the property-access expression is reported.
func TestRuleCorpusUnicornPreferPrototypeMethods(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/prefer-prototype-methods.ts", "// expect: unicorn/prefer-prototype-methods error\nconst slice = [].slice;\nvoid slice;\n")
}
