package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsAllowsGeneratedNamesToShadowWithoutCapture verifies that actual fix execution checks two independent nested errorCallback bindings against full output.
//
// Safe lexical shadowing without cross-scope references independently permits the same candidate in both scopes.
//
// @evidence contracts/testing.md#behavioral-verification Actual fix execution checks two independent nested errorCallback bindings against full output.
// @evidence contracts/testing.md#independent-expectations Safe lexical shadowing without cross-scope references independently permits the same candidate in both scopes.
// @evidence contracts/testing.md#distinguishing-cases Both errCb declarations/uses rename without an unnecessary suffix; cross-scope-read hosts own capture risks.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsAllowsGeneratedNamesToShadowWithoutCapture owns its explicit variants and named subcases where present as a discoverable Go unit entry; Checker-backed rule snapshots and actual disk fix application run in the shared Go process with isolated authored fixture files; no installed consumer, native producer or product child host runs.
func TestUnicornPreventAbbreviationsAllowsGeneratedNamesToShadowWithoutCapture(t *testing.T) {
  source := "const errCb = \"outer\";\n{\n  const errCb = \"inner\";\n  console.log(errCb);\n}\nconsole.log(errCb);\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "const errorCallback = \"outer\";\n{\n  const errorCallback = \"inner\";\n  console.log(errorCallback);\n}\nconsole.log(errorCallback);\n",
  )
}
