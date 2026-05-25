package linthost

import "testing"

// TestFixNoUnneededTernaryRewritesBooleanLiteralBranches verifies that the
// noUnneededTernary rule emits an autofix replacing `cond ? true : false`
// with `Boolean(cond)` and the mirror `cond ? false : true` with `!cond`.
//
// The previous implementation only reported the finding, which left the
// `fix` cascade unable to converge on real fixtures (zod, rxjs) and forced
// the benchmark to disable the rule. The fix has to mirror ESLint's
// canonical behavior: a literal-boolean pair collapses to a Boolean coercion
// or a logical negation depending on the branch order. Operator-precedence
// safety means a low-precedence condition must be wrapped in parentheses
// before being prefixed with `!`.
//
//  1. Snapshot the `? true : false` rewrite over a simple identifier.
//  2. Snapshot the `? false : true` rewrite over a low-precedence condition
//     so the parentheses guard branch is exercised.
//  3. Snapshot the `? false : true` rewrite over a simple identifier so the
//     no-parentheses branch is exercised.
func TestFixNoUnneededTernaryRewritesBooleanLiteralBranches(t *testing.T) {
  assertFixSnapshot(
    t,
    "noUnneededTernary",
    "function f(x: any) {\n  return x ? true : false;\n}\nJSON.stringify(f);\n",
    "function f(x: any) {\n  return Boolean(x);\n}\nJSON.stringify(f);\n",
  )
  assertFixSnapshot(
    t,
    "noUnneededTernary",
    "function f(a: any, b: any) {\n  return a || b ? false : true;\n}\nJSON.stringify(f);\n",
    "function f(a: any, b: any) {\n  return !(a || b);\n}\nJSON.stringify(f);\n",
  )
  assertFixSnapshot(
    t,
    "noUnneededTernary",
    "function f(x: any) {\n  return x ? false : true;\n}\nJSON.stringify(f);\n",
    "function f(x: any) {\n  return !x;\n}\nJSON.stringify(f);\n",
  )
}
