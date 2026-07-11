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
func TestFixNoExtraBooleanCastKeepsParenthesizedArgumentWithoutDoubleWrap(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-extra-boolean-cast",
    "function f(a: any, b: any) {\n  const y = !Boolean((a && b));\n  return y;\n}\nJSON.stringify(f);\n",
    "function f(a: any, b: any) {\n  const y = !(a && b);\n  return y;\n}\nJSON.stringify(f);\n",
  )
}
