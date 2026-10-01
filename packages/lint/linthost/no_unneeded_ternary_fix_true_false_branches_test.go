package linthost

import "testing"

// TestFixNoUnneededTernaryRewritesTrueFalseBranches verifies the
// `cond ? true : false` → `!!cond` rewrite.
//
// Without this fix the `fix` cascade could not converge on real
// fixtures (zod, rxjs), forcing the benchmark to disable the rule.
// Intrinsic double negation preserves true-on-left coercion even when
// a lexical binding shadows the global Boolean function.
//
// 1. Snapshot `x ? true : false`.
// 2. Apply `no-unneeded-ternary` fix.
// 3. Assert the result is `!!x`.
//
// @evidence contracts/testing.md#behavioral-verification The actual fixer must produce exactly !!x and retain the surrounding function and JSON use.
// @evidence contracts/testing.md#independent-expectations The true/false branch order independently performs boolean conversion of x; the literal target supplies the canonical conversion oracle.
// @evidence contracts/testing.md#distinguishing-cases This owns true/false; false/true companions own negation and precedence, and the corpus owns the necessary non-boolean ternary control.
// @evidence contracts/testing.md#execution-ownership TestFixNoUnneededTernaryRewritesTrueFalseBranches is selected in the shared Go unit population. It calls assertFixSnapshot for no-unneeded-ternary, applying real Engine edits and comparing the complete authored output. No installed consumer, native artifact build or real product host runs.
func TestFixNoUnneededTernaryRewritesTrueFalseBranches(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-unneeded-ternary",
    "function f(x: any) {\n  return x ? true : false;\n}\nJSON.stringify(f);\n",
    "function f(x: any) {\n  return !!x;\n}\nJSON.stringify(f);\n",
  )
}
