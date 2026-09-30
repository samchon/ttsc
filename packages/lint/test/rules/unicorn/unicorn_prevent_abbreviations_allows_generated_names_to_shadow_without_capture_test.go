package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsAllowsGeneratedNamesToShadowWithoutCapture verifies that actual fix execution checks two independent nested errorCallback bindings against full output.
//
// Safe lexical shadowing without cross-scope references independently permits the same candidate in both scopes.
//
// 1. Execute the retained binding, filename, option or command variants.
// 2. Compare the authored diagnostic, edit, helper value or preserved source.
//
// @evidence contracts/testing.md#behavioral-verification Actual fix execution checks two independent nested errorCallback bindings against full output.
// @evidence contracts/testing.md#independent-expectations Safe lexical shadowing without cross-scope references independently permits the same candidate in both scopes.
// @evidence contracts/testing.md#distinguishing-cases Both errCb declarations/uses rename without an unnecessary suffix; cross-scope-read hosts own capture risks.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsAllowsGeneratedNamesToShadowWithoutCapture owns its explicit variants and named subcases where present as a discoverable Go unit entry; actual checker/engine/fix/filename/casing operations run in the shared process with isolated fixture files and no installed consumer, native producer or product child host.
func TestUnicornPreventAbbreviationsAllowsGeneratedNamesToShadowWithoutCapture(t *testing.T) {
  source := "const errCb = \"outer\";\n{\n  const errCb = \"inner\";\n  console.log(errCb);\n}\nconsole.log(errCb);\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "const errorCallback = \"outer\";\n{\n  const errorCallback = \"inner\";\n  console.log(errorCallback);\n}\nconsole.log(errorCallback);\n",
  )
}
