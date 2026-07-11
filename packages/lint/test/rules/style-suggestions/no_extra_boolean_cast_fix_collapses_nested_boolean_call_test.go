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
func TestFixNoExtraBooleanCastCollapsesNestedBooleanCall(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-extra-boolean-cast",
    "function f(x: any) {\n  if (Boolean(Boolean(x))) {\n    return 1;\n  }\n  return 0;\n}\nJSON.stringify(f);\n",
    "function f(x: any) {\n  if (Boolean(x)) {\n    return 1;\n  }\n  return 0;\n}\nJSON.stringify(f);\n",
  )
}
