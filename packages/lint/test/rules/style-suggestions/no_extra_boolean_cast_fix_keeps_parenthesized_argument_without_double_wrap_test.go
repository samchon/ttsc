package linthost

import "testing"

// TestFixNoExtraBooleanCastKeepsParenthesizedArgumentWithoutDoubleWrap
// verifies the `!Boolean((a && b))` → `!(a && b)` rewrite — the boundary
// where the argument already carries its own parentheses.
//
// A ParenthesizedExpression binds at the highest precedence, so the #362
// wrap must not fire again; double-wrapping would emit `!((a && b))`. The
// splice keeps the author's parens verbatim and adds none.
//
// 1. Snapshot `const y = !Boolean((a && b));` source.
// 2. Apply `no-extra-boolean-cast` fix.
// 3. Assert exactly one paren pair survives: `!(a && b)`.
//
// @evidence contracts/testing.md#behavioral-verification Retains existing logical-argument parentheses once instead of doubling them after unwrapping Boolean.
// @evidence contracts/testing.md#independent-expectations The literal !(a && b) keeps logical conjunction inside negation; extra wrapping is unnecessary and whole-output comparison detects it.
// @evidence contracts/testing.md#distinguishing-cases An already parenthesized argument distinguishes reuse of grouping from adding required new grouping.
// @evidence contracts/testing.md#execution-ownership assertFixSnapshot calls runFixSnapshot and applies the actual no-extra-boolean-cast edits to the fixture. This Test owns the exact independently authored source/output pair, including text outside the replacement. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestFixNoExtraBooleanCastKeepsParenthesizedArgumentWithoutDoubleWrap(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-extra-boolean-cast",
    "function f(a: any, b: any) {\n  const y = !Boolean((a && b));\n  return y;\n}\nJSON.stringify(f);\n",
    "function f(a: any, b: any) {\n  const y = !(a && b);\n  return y;\n}\nJSON.stringify(f);\n",
  )
}
