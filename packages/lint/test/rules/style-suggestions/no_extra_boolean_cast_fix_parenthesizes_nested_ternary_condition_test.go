package linthost

import "testing"

// TestFixNoExtraBooleanCastParenthesizesNestedTernaryCondition verifies the
// `Boolean(a ? b : c) ? a : b` → `(a ? b : c) ? a : b` rewrite — the
// equal-precedence boundary of the wrap branch in a ternary-condition
// context.
//
// A conditional argument sits exactly at the Conditional floor; spliced bare
// it re-associates right (`a ? b : c ? a : b` is `a ? b : (c ? a : b)`), so
// the equality case must parenthesize. This pins the `<=` comparison in the
// ternary context the same way the await case pins it under `!`.
//
// 1. Snapshot `const r = Boolean(a ? b : c) ? a : b;` source.
// 2. Apply `no-extra-boolean-cast` fix.
// 3. Assert the wrapped splice `(a ? b : c) ? a : b`.
func TestFixNoExtraBooleanCastParenthesizesNestedTernaryCondition(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-extra-boolean-cast",
    "function f(a: any, b: any, c: any) {\n  const r = Boolean(a ? b : c) ? a : b;\n  return r;\n}\nJSON.stringify(f);\n",
    "function f(a: any, b: any, c: any) {\n  const r = (a ? b : c) ? a : b;\n  return r;\n}\nJSON.stringify(f);\n",
  )
}
