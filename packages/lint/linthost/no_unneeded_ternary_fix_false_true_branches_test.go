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
//
// @evidence contracts/testing.md#behavioral-verification The actual fixer must produce exactly !x from the original false/true ternary while preserving all surrounding source bytes.
// @evidence contracts/testing.md#independent-expectations Boolean branch truth values independently establish negation of x; an identifier needs no added precedence parentheses.
// @evidence contracts/testing.md#distinguishing-cases This owns false/true with an identifier and a necessary non-boolean ternary with zero findings; companions own low-precedence grouping and true/false conversion.
// @evidence contracts/testing.md#execution-ownership TestFixNoUnneededTernaryRewritesFalseTrueBranches is selected in the shared Go unit population. It calls assertFixSnapshot for no-unneeded-ternary, runs the actual Engine/fix application and compares the full authored target source. No installed consumer, native artifact build or real product host runs.
func TestFixNoUnneededTernaryRewritesFalseTrueBranches(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-unneeded-ternary",
    "function f(x: any) {\n  return x ? false : true;\n}\nJSON.stringify(f);\n",
    "function f(x: any) {\n  return !x;\n}\nJSON.stringify(f);\n",
  )
  assertRuleSkipsSource(
    t,
    "no-unneeded-ternary",
    "function f(x: any) { return x ? 1 : 2; }\nJSON.stringify(f);\n",
  )
}
