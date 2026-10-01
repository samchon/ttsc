package linthost

import "testing"

// TestFixNoExtraBooleanCastSkipsWrapInsideExplicitParensUnderBang verifies
// the `!(Boolean(a && b))` → `!(a && b)` rewrite — a cast explicitly
// parenthesized by the author needs no added parentheses.
//
// The edit replaces only the call inside the author's parens, and those
// parens already contain the result; the context floor keys off the direct
// parent (the ParenthesizedExpression), so #362's wrap must not fire and
// emit `!((a && b))`.
//
// 1. Snapshot `const y = !(Boolean(a && b));` source.
// 2. Apply `no-extra-boolean-cast` fix.
// 3. Assert the splice lands bare inside the existing parens: `!(a && b)`.
//
// @evidence contracts/testing.md#behavioral-verification Reuses existing outer parentheses when unwrapping Boolean below logical not.
// @evidence contracts/testing.md#independent-expectations The literal !(a && b) preserves the conjunction under ! without introducing a second layer of parentheses.
// @evidence contracts/testing.md#distinguishing-cases Outer existing grouping differs from a parenthesized argument inside the call; both exact-source variants have separate ownership.
// @evidence contracts/testing.md#execution-ownership assertFixSnapshot calls runFixSnapshot and applies the actual no-extra-boolean-cast edits to the fixture. This Test owns the exact independently authored source/output pair, including text outside the replacement. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestFixNoExtraBooleanCastSkipsWrapInsideExplicitParensUnderBang(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-extra-boolean-cast",
    "function f(a: any, b: any) {\n  const y = !(Boolean(a && b));\n  return y;\n}\nJSON.stringify(f);\n",
    "function f(a: any, b: any) {\n  const y = !(a && b);\n  return y;\n}\nJSON.stringify(f);\n",
  )
}
