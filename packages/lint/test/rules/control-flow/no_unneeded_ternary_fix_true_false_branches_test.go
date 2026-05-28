package linthost

import "testing"

// TestFixNoUnneededTernaryRewritesTrueFalseBranches verifies the
// `cond ? true : false` → `Boolean(cond)` rewrite.
//
// Without this fix the `fix` cascade could not converge on real
// fixtures (zod, rxjs), forcing the benchmark to disable the rule.
// The fix mirrors ESLint's canonical behavior for the true-on-left
// branch ordering.
//
// 1. Snapshot `x ? true : false`.
// 2. Apply `no-unneeded-ternary` fix.
// 3. Assert the result is `Boolean(x)`.
func TestFixNoUnneededTernaryRewritesTrueFalseBranches(t *testing.T) {
	assertFixSnapshot(
		t,
		"no-unneeded-ternary",
		"function f(x: any) {\n  return x ? true : false;\n}\nJSON.stringify(f);\n",
		"function f(x: any) {\n  return Boolean(x);\n}\nJSON.stringify(f);\n",
	)
}
