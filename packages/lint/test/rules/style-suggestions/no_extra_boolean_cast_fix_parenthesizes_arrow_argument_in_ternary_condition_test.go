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
func TestFixNoExtraBooleanCastParenthesizesArrowArgumentInTernaryCondition(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-extra-boolean-cast",
    "function f(a: any, b: any) {\n  const r = Boolean(() => a) ? a : b;\n  return r;\n}\nJSON.stringify(f);\n",
    "function f(a: any, b: any) {\n  const r = (() => a) ? a : b;\n  return r;\n}\nJSON.stringify(f);\n",
  )
}
