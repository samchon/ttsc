package linthost

import "testing"

// TestFixNoUnneededTernaryRewritesFalseTrueWithLowPrecedenceCondition
// verifies the `(a || b) ? false : true` → `!(a || b)` rewrite — the
// parentheses-guard branch.
//
// A low-precedence condition (`||`, `&&`, comma, etc.) must be wrapped
// in parens before being prefixed with `!`; otherwise `!a || b` would
// silently change associativity. This branch is separate from the
// no-parens path and must be exercised independently.
//
// 1. Snapshot `(a || b) ? false : true`.
// 2. Apply `no-unneeded-ternary` fix.
// 3. Assert the result wraps the condition in parens before negating.
func TestFixNoUnneededTernaryRewritesFalseTrueWithLowPrecedenceCondition(t *testing.T) {
	assertFixSnapshot(
		t,
		"no-unneeded-ternary",
		"function f(a: any, b: any) {\n  return a || b ? false : true;\n}\nJSON.stringify(f);\n",
		"function f(a: any, b: any) {\n  return !(a || b);\n}\nJSON.stringify(f);\n",
	)
}
