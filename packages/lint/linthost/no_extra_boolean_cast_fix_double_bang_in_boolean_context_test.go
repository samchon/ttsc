package linthost

import "testing"

// TestFixNoExtraBooleanCastDropsDoubleBangInBooleanContext verifies the
// `if (!!x)` → `if (x)` rewrite — the double-bang branch inside a
// boolean-context detection.
//
// The rewrite removes the reported redundant syntax rather than leaving it
// unchanged when no automatic edit is available. This fixture pins the
// if-condition double-bang path separately from the Boolean-call branch.
//
// 1. Snapshot `if (!!x)` source.
// 2. Apply `no-extra-boolean-cast` fix.
// 3. Assert the result drops the `!!` coercion.
//
// @evidence contracts/testing.md#behavioral-verification Removes !! in an if condition while preserving branch behavior.
// @evidence contracts/testing.md#independent-expectations If already applies ToBoolean, so the independently authored if(x) keeps truthiness and all surrounding returns.
// @evidence contracts/testing.md#distinguishing-cases Double-bang positive contrasts with the explicit outside-boolean-context negative and comment seam refusal.
// @evidence contracts/testing.md#execution-ownership assertFixSnapshot calls runFixSnapshot and applies the actual no-extra-boolean-cast edits to the fixture. This Test owns the exact independently authored source/output pair, including text outside the replacement. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestFixNoExtraBooleanCastDropsDoubleBangInBooleanContext(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-extra-boolean-cast",
    "function f(x: any) {\n  if (!!x) {\n    return 1;\n  }\n  return 0;\n}\nJSON.stringify(f);\n",
    "function f(x: any) {\n  if (x) {\n    return 1;\n  }\n  return 0;\n}\nJSON.stringify(f);\n",
  )
}
