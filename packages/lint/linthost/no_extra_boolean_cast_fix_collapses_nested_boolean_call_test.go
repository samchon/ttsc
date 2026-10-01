package linthost

import "testing"

// TestFixNoExtraBooleanCastCollapsesNestedBooleanCall verifies the
// `if (Boolean(Boolean(x)))` → `if (Boolean(x))` rewrite — one cascade pass
// over a nested redundant cast.
//
// Only the outer call sits in a boolean context (the inner one is a call
// argument), so a single pass peels exactly one layer; the fix cascade
// re-runs until convergence in the real `ttsc fix` flow. This pins that the
// nested-call splice stays bare — a CallExpression argument binds far above
// any context floor, so #362's wrap must not fire on it.
//
// 1. Snapshot `if (Boolean(Boolean(x)))` source.
// 2. Apply one `no-extra-boolean-cast` fix pass.
// 3. Assert the outer cast collapses to `if (Boolean(x))` without parens.
//
// @evidence contracts/testing.md#behavioral-verification Removes one nested Boolean wrapper while retaining the inner cast.
// @evidence contracts/testing.md#independent-expectations The literal expected Boolean(x) removes the targeted outer redundancy without making an unrequested second rewrite.
// @evidence contracts/testing.md#distinguishing-cases Nested wrappers pin the one-pass edit surface; the simple Boolean-in-if unit owns direct unwrapping.
// @evidence contracts/testing.md#execution-ownership assertFixSnapshot calls runFixSnapshot and applies the actual no-extra-boolean-cast edits to the fixture. This Test owns the exact independently authored source/output pair, including text outside the replacement. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestFixNoExtraBooleanCastCollapsesNestedBooleanCall(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-extra-boolean-cast",
    "function f(x: any) {\n  if (Boolean(Boolean(x))) {\n    return 1;\n  }\n  return 0;\n}\nJSON.stringify(f);\n",
    "function f(x: any) {\n  if (Boolean(x)) {\n    return 1;\n  }\n  return 0;\n}\nJSON.stringify(f);\n",
  )
}
