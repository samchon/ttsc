package linthost

import "testing"

// TestFixNoUnneededTernaryRewritesTrueFalseBranches verifies the
// `cond ? true : false` → `!!cond` rewrite.
//
// This pins the automatic rewrite rather than merely a settled cascade:
// a finding without an automatic edit would leave the ternary unchanged.
// Intrinsic double negation preserves true-on-left coercion even when
// a lexical binding shadows the global Boolean function.
//
// 1. Snapshot `x ? true : false`.
// 2. Apply `no-unneeded-ternary` fix.
// 3. Assert the result is `!!x`.
//
// @evidence contracts/testing.md#behavioral-verification The actual fixer must produce exactly !!x and retain the surrounding function and JSON use.
// @evidence contracts/testing.md#independent-expectations The true/false branch order independently performs boolean conversion of x; the literal target supplies the canonical conversion oracle.
// @evidence contracts/testing.md#distinguishing-cases This owns true/false; false/true companions own negation and precedence, and the identifier companion owns a necessary non-boolean ternary with zero findings.
// @evidence contracts/testing.md#execution-ownership TestFixNoUnneededTernaryRewritesTrueFalseBranches is selected in the shared Go unit population. It calls assertFixSnapshot for no-unneeded-ternary, applying real Engine edits and comparing the complete authored output. No installed consumer, native artifact build or real product host runs.
func TestFixNoUnneededTernaryRewritesTrueFalseBranches(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-unneeded-ternary",
    "function f(x: any) {\n  return x ? true : false;\n}\nJSON.stringify(f);\n",
    "function f(x: any) {\n  return !!x;\n}\nJSON.stringify(f);\n",
  )
}
