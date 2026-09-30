package linthost

import "testing"

// TestFixNoExtraBooleanCastSkipsWrapForLogicalTernaryCondition verifies the
// `Boolean(a && b) ? a : b` → `a && b ? a : b` rewrite gains no parentheses —
// the negative twin of the precedence-wrap branch in a ternary-condition
// context.
//
// LogicalAND binds above the Conditional floor, so the bare splice already
// parses as `(a && b) ? a : b`. This pins that the #362 wrap fires only at
// or below the context floor, not on every ternary condition.
//
// 1. Snapshot `const r = Boolean(a && b) ? a : b;` source.
// 2. Apply `no-extra-boolean-cast` fix.
// 3. Assert the bare splice `a && b ? a : b` with no added parentheses.
//
// @evidence contracts/testing.md#behavioral-verification Unwraps Boolean(a&&b) as a&&b in a ternary condition without extra parentheses.
// @evidence contracts/testing.md#independent-expectations Logical conjunction binds more tightly than ?:, so the literal expected a&&b ? a : b retains association independently.
// @evidence contracts/testing.md#distinguishing-cases Contrast with nested ternary, assignment and arrow condition operands that require grouping.
// @evidence contracts/testing.md#execution-ownership assertFixSnapshot calls runFixSnapshot and applies the actual no-extra-boolean-cast edits to the fixture. This Test owns the exact independently authored source/output pair, including text outside the replacement. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestFixNoExtraBooleanCastSkipsWrapForLogicalTernaryCondition(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-extra-boolean-cast",
    "function f(a: any, b: any) {\n  const r = Boolean(a && b) ? a : b;\n  return r;\n}\nJSON.stringify(f);\n",
    "function f(a: any, b: any) {\n  const r = a && b ? a : b;\n  return r;\n}\nJSON.stringify(f);\n",
  )
}
