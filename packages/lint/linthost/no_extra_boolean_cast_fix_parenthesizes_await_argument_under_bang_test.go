package linthost

import "testing"

// TestFixNoExtraBooleanCastParenthesizesAwaitArgumentUnderBang verifies the
// `!Boolean(await p)` → `!(await p)` rewrite — the equal-precedence boundary
// of the wrap branch in an `!`-operand context.
//
// An AwaitExpression sits exactly at the Unary floor; the rule wraps at or
// below the floor, so the equality case is parenthesized rather than spliced
// bare. This pins the `<=` comparison against off-by-one regressions to `<`.
//
// 1. Snapshot `const y = !Boolean(await p);` in an async function.
// 2. Apply `no-extra-boolean-cast` fix.
// 3. Assert the wrapped splice `!(await p)`.
//
// @evidence contracts/testing.md#behavioral-verification Groups awaited value beneath logical not after Boolean removal.
// @evidence contracts/testing.md#independent-expectations The authored !(await p) negates the resolved value. `!await p` is also valid and means the same, so this pins the rule's documented at-or-below-the-floor wrapping policy at the equal-precedence boundary, not a syntactic necessity.
// @evidence contracts/testing.md#distinguishing-cases Await operand complements bare, logical and yield precedence cases and preserves async function source.
// @evidence contracts/testing.md#execution-ownership assertFixSnapshot calls runFixSnapshot and applies the actual no-extra-boolean-cast edits to the fixture. This Test owns the exact independently authored source/output pair, including text outside the replacement. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestFixNoExtraBooleanCastParenthesizesAwaitArgumentUnderBang(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-extra-boolean-cast",
    "async function f(p: Promise<unknown>) {\n  const y = !Boolean(await p);\n  return y;\n}\nJSON.stringify(f);\n",
    "async function f(p: Promise<unknown>) {\n  const y = !(await p);\n  return y;\n}\nJSON.stringify(f);\n",
  )
}
