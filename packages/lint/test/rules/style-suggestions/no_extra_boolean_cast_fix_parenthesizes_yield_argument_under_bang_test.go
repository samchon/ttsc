package linthost

import "testing"

// TestFixNoExtraBooleanCastParenthesizesYieldArgumentUnderBang verifies the
// `!Boolean(yield p)` → `!(yield p)` rewrite — the wrap branch for a yield
// argument in an `!`-operand context.
//
// A bare splice would emit `!yield p`, which is not even parseable: `yield`
// cannot appear as an unparenthesized unary operand. The YieldExpression's
// precedence is far below the Unary floor, so the wrap must fire.
//
// 1. Snapshot `const y = !Boolean(yield p);` in a generator function.
// 2. Apply `no-extra-boolean-cast` fix.
// 3. Assert the wrapped splice `!(yield p)`.
func TestFixNoExtraBooleanCastParenthesizesYieldArgumentUnderBang(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-extra-boolean-cast",
    "function* g(p: any) {\n  const y = !Boolean(yield p);\n  return y;\n}\nJSON.stringify(g);\n",
    "function* g(p: any) {\n  const y = !(yield p);\n  return y;\n}\nJSON.stringify(g);\n",
  )
}
