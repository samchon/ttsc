package linthost

import "testing"

// TestFixNoExtraBooleanCastParenthesizesArrowArgumentInTernaryCondition
// verifies the `Boolean(() => a) ? a : b` → `(() => a) ? a : b` rewrite —
// the wrap branch for an arrow-function argument in a ternary-condition
// context.
//
// Spliced bare, `() => a ? a : b` swallows the whole ternary into the arrow
// body (`() => (a ? a : b)`), silently changing the branch into an
// always-truthy function value. Arrows bind at Assignment precedence, below
// the Conditional floor, so the wrap must fire.
//
// 1. Snapshot `const r = Boolean(() => a) ? a : b;` source.
// 2. Apply `no-extra-boolean-cast` fix.
// 3. Assert the wrapped splice `(() => a) ? a : b`.
//
// @evidence contracts/testing.md#behavioral-verification Adds parentheses around an arrow operand when removing Boolean from a ternary condition.
// @evidence contracts/testing.md#independent-expectations Arrow grammar requires the authored (() => a) grouping to remain the condition instead of absorbing the ternary body.
// @evidence contracts/testing.md#distinguishing-cases Arrow precedence boundary complements assignment, nested conditional and logical condition cases.
// @evidence contracts/testing.md#execution-ownership assertFixSnapshot calls runFixSnapshot and applies the actual no-extra-boolean-cast edits to the fixture. This Test owns the exact independently authored source/output pair, including text outside the replacement. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestFixNoExtraBooleanCastParenthesizesArrowArgumentInTernaryCondition(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-extra-boolean-cast",
    "function f(a: any, b: any) {\n  const r = Boolean(() => a) ? a : b;\n  return r;\n}\nJSON.stringify(f);\n",
    "function f(a: any, b: any) {\n  const r = (() => a) ? a : b;\n  return r;\n}\nJSON.stringify(f);\n",
  )
}
