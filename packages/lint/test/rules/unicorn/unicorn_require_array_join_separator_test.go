package linthost

import "testing"

// TestRuleCorpusUnicornRequireArrayJoinSeparator verifies
// unicorn/require-array-join-separator reports a zero-argument
// `.join()` call on an array literal.
//
// The rule visits every `CallExpression` and matches purely on the
// property-access callee's method name plus the zero-arg shape; the
// receiver is not type-checked, so an inline array literal is enough
// to exercise the rule's only firing branch.
//
// 1. Enable unicorn/require-array-join-separator via an expect annotation.
// 2. Call `.join()` on an inline array literal with no arguments.
// 3. Assert the call expression is reported.
func TestRuleCorpusUnicornRequireArrayJoinSeparator(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/require-array-join-separator.ts", "// expect: unicorn/require-array-join-separator error\nconst s = [1, 2, 3].join();\n")
}
