package linthost

import "testing"

// TestFixNoExtraBooleanCastKeepsBareIdentifierUnderBang verifies the
// `!Boolean(x)` → `!x` rewrite gains no parentheses — the negative twin of
// the precedence-wrap branch in an `!`-operand context.
//
// An identifier binds at Primary precedence, far above the Unary floor, so
// wrapping would be pure noise (`!(x)`). This pins that the #362 fix wraps
// only when the argument actually re-associates.
//
// 1. Snapshot `const y = !Boolean(x);` source.
// 2. Apply `no-extra-boolean-cast` fix.
// 3. Assert the bare splice `!x` with no added parentheses.
//
// @evidence contracts/testing.md#behavioral-verification Replaces !Boolean(x) with !x without adding unnecessary parentheses.
// @evidence contracts/testing.md#independent-expectations Logical not itself applies ToBoolean; the literal expected !x preserves negation and its simple operand precedence.
// @evidence contracts/testing.md#distinguishing-cases Bare identifier is the minimum precedence boundary beside logical/await/yield grouping tests.
// @evidence contracts/testing.md#execution-ownership assertFixSnapshot calls runFixSnapshot and applies the actual no-extra-boolean-cast edits to the fixture. This Test owns the exact independently authored source/output pair, including text outside the replacement. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestFixNoExtraBooleanCastKeepsBareIdentifierUnderBang(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-extra-boolean-cast",
    "function f(x: any) {\n  const y = !Boolean(x);\n  return y;\n}\nJSON.stringify(f);\n",
    "function f(x: any) {\n  const y = !x;\n  return y;\n}\nJSON.stringify(f);\n",
  )
}
