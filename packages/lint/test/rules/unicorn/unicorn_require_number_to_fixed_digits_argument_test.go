package linthost

import "testing"

// TestRuleCorpusUnicornRequireNumberToFixedDigitsArgument verifies
// unicorn/require-number-to-fixed-digits-argument reports a
// zero-argument `.toFixed()` call.
//
// The rule visits every `CallExpression` and matches purely on the
// property-access callee's method name plus the zero-arg shape; the
// receiver is not type-checked, so a parenthesized numeric literal is
// enough to exercise the rule's only firing branch.
//
// 1. Enable unicorn/require-number-to-fixed-digits-argument via an expect annotation.
// 2. Call `.toFixed()` on a numeric literal with no arguments.
// 3. Assert the call expression is reported.
func TestRuleCorpusUnicornRequireNumberToFixedDigitsArgument(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/require-number-to-fixed-digits-argument.ts", "// expect: unicorn/require-number-to-fixed-digits-argument error\nconst s = (1.234).toFixed();\n")
}
