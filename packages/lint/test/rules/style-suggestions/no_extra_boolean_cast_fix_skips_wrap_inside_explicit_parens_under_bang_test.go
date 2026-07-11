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
func TestFixNoExtraBooleanCastSkipsWrapInsideExplicitParensUnderBang(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-extra-boolean-cast",
    "function f(a: any, b: any) {\n  const y = !(Boolean(a && b));\n  return y;\n}\nJSON.stringify(f);\n",
    "function f(a: any, b: any) {\n  const y = !(a && b);\n  return y;\n}\nJSON.stringify(f);\n",
  )
}
