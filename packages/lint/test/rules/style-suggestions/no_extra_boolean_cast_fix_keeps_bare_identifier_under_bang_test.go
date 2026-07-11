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
func TestFixNoExtraBooleanCastKeepsBareIdentifierUnderBang(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-extra-boolean-cast",
    "function f(x: any) {\n  const y = !Boolean(x);\n  return y;\n}\nJSON.stringify(f);\n",
    "function f(x: any) {\n  const y = !x;\n  return y;\n}\nJSON.stringify(f);\n",
  )
}
