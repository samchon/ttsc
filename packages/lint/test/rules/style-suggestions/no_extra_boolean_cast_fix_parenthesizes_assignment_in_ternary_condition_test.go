package linthost

import "testing"

// TestFixNoExtraBooleanCastParenthesizesAssignmentInTernaryCondition verifies
// the `Boolean(x = a) ? a : b` → `(x = a) ? a : b` rewrite — the
// precedence-wrap branch in a ternary-condition context.
//
// The raw splice `x = a ? a : b` re-associates the whole ternary into the
// assignment's right-hand side (#362). An assignment binds below the
// Conditional floor, so the replacement must keep its own parentheses.
//
// 1. Snapshot `const r = Boolean(x = a) ? a : b;` source.
// 2. Apply `no-extra-boolean-cast` fix.
// 3. Assert the condition is spliced with parentheses: `(x = a) ? a : b`.
func TestFixNoExtraBooleanCastParenthesizesAssignmentInTernaryCondition(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-extra-boolean-cast",
    "function f(x: any, a: any, b: any) {\n  const r = Boolean(x = a) ? a : b;\n  return [r, x];\n}\nJSON.stringify(f);\n",
    "function f(x: any, a: any, b: any) {\n  const r = (x = a) ? a : b;\n  return [r, x];\n}\nJSON.stringify(f);\n",
  )
}
