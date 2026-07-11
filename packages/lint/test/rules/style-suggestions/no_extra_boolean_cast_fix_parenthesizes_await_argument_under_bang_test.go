package linthost

import "testing"

// TestFixNoExtraBooleanCastParenthesizesAwaitArgumentUnderBang verifies the
// `!Boolean(await p)` → `!(await p)` rewrite — the equal-precedence boundary
// of the wrap branch in an `!`-operand context.
//
// An AwaitExpression sits exactly at the Unary floor; the wrap fires at or
// below the floor, so the equality case must parenthesize rather than splice
// bare. This pins the `<=` comparison against off-by-one regressions to `<`.
//
// 1. Snapshot `const y = !Boolean(await p);` in an async function.
// 2. Apply `no-extra-boolean-cast` fix.
// 3. Assert the wrapped splice `!(await p)`.
func TestFixNoExtraBooleanCastParenthesizesAwaitArgumentUnderBang(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-extra-boolean-cast",
    "async function f(p: Promise<unknown>) {\n  const y = !Boolean(await p);\n  return y;\n}\nJSON.stringify(f);\n",
    "async function f(p: Promise<unknown>) {\n  const y = !(await p);\n  return y;\n}\nJSON.stringify(f);\n",
  )
}
