package linthost

import "testing"

// TestFixNoExtraBooleanCastDropsBooleanCallInBooleanContext verifies the
// `if (Boolean(x))` → `if (x)` rewrite — the Boolean-call branch inside
// a boolean-context detection.
//
// The Boolean-call branch is separate from the double-bang branch; both
// must drop cleanly inside an `if (...)` condition so the `fix` cascade
// converges. This test pins exactly the boolean-context-Boolean-call
// path, including the single-argument check.
//
// 1. Snapshot `if (Boolean(x))` source.
// 2. Apply `no-extra-boolean-cast` fix.
// 3. Assert the result strips the `Boolean(...)` wrapper.
//
// @evidence contracts/testing.md#behavioral-verification Removes Boolean(x) only where if already coerces x to boolean.
// @evidence contracts/testing.md#independent-expectations ECMAScript if performs ToBoolean; authored if(x) preserves branching and all function body/use text.
// @evidence contracts/testing.md#distinguishing-cases Call-form redundant cast contrasts with meaningful boolean conversion outside such contexts.
// @evidence contracts/testing.md#execution-ownership assertFixSnapshot calls runFixSnapshot and applies the actual no-extra-boolean-cast edits to the fixture. This Test owns the exact independently authored source/output pair, including text outside the replacement. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestFixNoExtraBooleanCastDropsBooleanCallInBooleanContext(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-extra-boolean-cast",
    "function f(x: any) {\n  if (Boolean(x)) {\n    return 1;\n  }\n  return 0;\n}\nJSON.stringify(f);\n",
    "function f(x: any) {\n  if (x) {\n    return 1;\n  }\n  return 0;\n}\nJSON.stringify(f);\n",
  )
}
