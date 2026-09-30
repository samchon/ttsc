package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsSeparatesGeneratedNamesAtCrossScopeReads verifies that the fixer checks authored suffix placement when an inner scope reads the outer binding.
//
// Renaming the inner declaration to the same candidate would capture the outer read, independently requiring an inner suffix.
//
// 1. Execute the retained binding, filename, option or command variants.
// 2. Compare the authored diagnostic, edit, helper value or preserved source.
//
// @evidence contracts/testing.md#behavioral-verification The fixer checks authored suffix placement when an inner scope reads the outer binding.
// @evidence contracts/testing.md#independent-expectations Renaming the inner declaration to the same candidate would capture the outer read, independently requiring an inner suffix.
// @evidence contracts/testing.md#distinguishing-cases Outer errCb becomes errorCallback and inner errorCb becomes errorCallback_, preserving the outer read.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsSeparatesGeneratedNamesAtCrossScopeReads owns its explicit variants and named subcases where present as a discoverable Go unit entry; actual checker/engine/fix/filename/casing operations run in the shared process with isolated fixture files and no installed consumer, native producer or product child host.
func TestUnicornPreventAbbreviationsSeparatesGeneratedNamesAtCrossScopeReads(t *testing.T) {
  source := "const errCb = \"outer\";\n{\n  console.log(errCb);\n  const errorCb = \"inner\";\n  console.log(errorCb);\n}\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "const errorCallback = \"outer\";\n{\n  console.log(errorCallback);\n  const errorCallback_ = \"inner\";\n  console.log(errorCallback_);\n}\n",
  )
}
