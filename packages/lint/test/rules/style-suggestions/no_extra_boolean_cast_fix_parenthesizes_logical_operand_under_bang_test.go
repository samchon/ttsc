package linthost

import "testing"

// TestFixNoExtraBooleanCastParenthesizesLogicalOperandUnderBang verifies the
// `!Boolean(a && b)` → `!(a && b)` rewrite — the precedence-wrap branch of
// the Boolean-call fixer in an `!`-operand context.
//
// The raw splice `!a && b` re-associates to `(!a) && b`, a different value
// (#362). Upstream ESLint's fixer parenthesizes by precedence; this test pins
// the wrap branch for an argument (LogicalAND) below the Unary floor.
//
// 1. Snapshot `const y = !Boolean(a && b);` source.
// 2. Apply `no-extra-boolean-cast` fix.
// 3. Assert the argument is spliced with parentheses: `!(a && b)`.
func TestFixNoExtraBooleanCastParenthesizesLogicalOperandUnderBang(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-extra-boolean-cast",
    "function f(a: any, b: any) {\n  const y = !Boolean(a && b);\n  return y;\n}\nJSON.stringify(f);\n",
    "function f(a: any, b: any) {\n  const y = !(a && b);\n  return y;\n}\nJSON.stringify(f);\n",
  )
}
