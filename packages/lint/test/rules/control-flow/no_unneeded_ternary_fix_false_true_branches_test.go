package linthost

import "testing"

// TestFixNoUnneededTernaryRewritesFalseTrueBranches verifies the
// `cond ? false : true` → `!cond` rewrite for a simple identifier
// condition — the no-parens branch.
//
// A high-precedence condition (identifier, member access, call) does
// not need a parens guard before `!`; the rewriter must emit the bare
// `!cond` form. This complements the low-precedence variant and pins
// that the precedence check fires correctly.
//
// 1. Snapshot `x ? false : true`.
// 2. Apply `no-unneeded-ternary` fix.
// 3. Assert the result is `!x` with no parens.
func TestFixNoUnneededTernaryRewritesFalseTrueBranches(t *testing.T) {
	assertFixSnapshot(
		t,
		"no-unneeded-ternary",
		"function f(x: any) {\n  return x ? false : true;\n}\nJSON.stringify(f);\n",
		"function f(x: any) {\n  return !x;\n}\nJSON.stringify(f);\n",
	)
}
