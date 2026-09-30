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
//
// @evidence contracts/testing.md#behavioral-verification The actual fixer must produce exactly !(a || b) and preserve surrounding source rather than emitting !a || b.
// @evidence contracts/testing.md#independent-expectations Logical-or precedence and authored boolean truth values independently require negating the whole condition; the target text is not generated from fixer output.
// @evidence contracts/testing.md#distinguishing-cases This owns a low-precedence OR condition; the identifier companion owns the no-extra-parentheses contrast, and the corpus owns a non-rewritable value ternary.
// @evidence contracts/testing.md#execution-ownership TestFixNoUnneededTernaryRewritesFalseTrueWithLowPrecedenceCondition is selected in the shared Go unit population. It calls assertFixSnapshot for no-unneeded-ternary and applies actual rule edits before full target-source comparison. No installed consumer, native artifact build or real product host runs.
func TestFixNoUnneededTernaryRewritesFalseTrueWithLowPrecedenceCondition(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-unneeded-ternary",
    "function f(a: any, b: any) {\n  return a || b ? false : true;\n}\nJSON.stringify(f);\n",
    "function f(a: any, b: any) {\n  return !(a || b);\n}\nJSON.stringify(f);\n",
  )
}
