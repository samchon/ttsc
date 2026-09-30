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
//
// @evidence contracts/testing.md#behavioral-verification Groups yielded value beneath logical not after Boolean removal.
// @evidence contracts/testing.md#independent-expectations The independently authored !(yield p) retains generator suspension and negates the resumed value, rather than yielding a negated argument.
// @evidence contracts/testing.md#distinguishing-cases Yield precedence and generator body complement await and logical operand boundaries.
// @evidence contracts/testing.md#execution-ownership assertFixSnapshot calls runFixSnapshot and applies the actual no-extra-boolean-cast edits to the fixture. This Test owns the exact independently authored source/output pair, including text outside the replacement. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestFixNoExtraBooleanCastParenthesizesYieldArgumentUnderBang(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-extra-boolean-cast",
    "function* g(p: any) {\n  const y = !Boolean(yield p);\n  return y;\n}\nJSON.stringify(g);\n",
    "function* g(p: any) {\n  const y = !(yield p);\n  return y;\n}\nJSON.stringify(g);\n",
  )
}
