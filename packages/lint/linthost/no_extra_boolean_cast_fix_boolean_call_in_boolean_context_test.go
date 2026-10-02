package linthost

import "testing"

// TestFixNoExtraBooleanCastDropsBooleanCallInBooleanContext verifies the
// `if (Boolean(x))` → `if (x)` rewrite — the Boolean-call branch inside
// a boolean-context detection.
//
// The Boolean-call branch is separate from the double-bang branch; both
// must drop cleanly inside an `if (...)` condition so the `fix` cascade
// converges. This test pins exactly the boolean-context-Boolean-call
// path. Two negative twins bound it: the same call outside a boolean context
// is not reported, and a call with two arguments is reported but never edited
// because the second argument is not part of the conversion.
//
// 1. Snapshot `if (Boolean(x))` source.
// 2. Apply `no-extra-boolean-cast` fix.
// 3. Assert the result strips the `Boolean(...)` wrapper.
// 4. Assert `const b = Boolean(x);` stays unreported.
// 5. Assert `if (Boolean(x, y))` reports with neither a fix nor a suggestion.
//
// @evidence contracts/testing.md#behavioral-verification Removes Boolean(x) only where if already coerces x to boolean.
// @evidence contracts/testing.md#independent-expectations ECMAScript if performs ToBoolean; authored if(x) preserves branching and all function body/use text.
// @evidence contracts/testing.md#distinguishing-cases The single-argument call in an if condition is fixed; the same call assigned to a variable is not reported, and a two-argument call in the condition is reported without any edit.
// @evidence contracts/testing.md#execution-ownership assertFixSnapshot calls runFixSnapshot and applies the actual no-extra-boolean-cast edits to the fixture. This Test owns the exact independently authored source/output pair, including text outside the replacement. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestFixNoExtraBooleanCastDropsBooleanCallInBooleanContext(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-extra-boolean-cast",
    "function f(x: any) {\n  if (Boolean(x)) {\n    return 1;\n  }\n  return 0;\n}\nJSON.stringify(f);\n",
    "function f(x: any) {\n  if (x) {\n    return 1;\n  }\n  return 0;\n}\nJSON.stringify(f);\n",
  )
  assertRuleSkipsSource(
    t,
    "no-extra-boolean-cast",
    "function f(x: any) {\n  const b = Boolean(x);\n  return b;\n}\nJSON.stringify(f);\n",
  )
  assertReportOnlySnapshot(
    t,
    "no-extra-boolean-cast",
    "function f(x: any, y: any) {\n  if (Boolean(x, y)) {\n    return 1;\n  }\n  return 0;\n}\nJSON.stringify(f);\n",
  )
}
