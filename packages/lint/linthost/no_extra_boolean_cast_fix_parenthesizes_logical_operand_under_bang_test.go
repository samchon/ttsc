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
//
// @evidence contracts/testing.md#behavioral-verification Groups a&&b beneath logical not after removing Boolean.
// @evidence contracts/testing.md#independent-expectations The independently authored !(a && b) negates the conjunction; !a && b would change branch meaning.
// @evidence contracts/testing.md#distinguishing-cases A lower-precedence logical operand differs from the no-wrap bare identifier.
// @evidence contracts/testing.md#execution-ownership assertFixSnapshot calls runFixSnapshot and applies the actual no-extra-boolean-cast edits to the fixture. This Test owns the exact independently authored source/output pair, including text outside the replacement. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestFixNoExtraBooleanCastParenthesizesLogicalOperandUnderBang(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-extra-boolean-cast",
    "function f(a: any, b: any) {\n  const y = !Boolean(a && b);\n  return y;\n}\nJSON.stringify(f);\n",
    "function f(a: any, b: any) {\n  const y = !(a && b);\n  return y;\n}\nJSON.stringify(f);\n",
  )
}
