package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsPreservesCanonicalUpperFirstForUncasedPrefixes verifies that actual fix execution checks the authored Failure replacement for the $err binding.
//
// The supported upstream upper-first compatibility policy independently determines the literal replacement for this uncased-prefix name.
//
// 1. Execute the retained binding, filename, option or command variants.
// 2. Compare the authored diagnostic, edit, helper value or preserved source.
//
// @evidence contracts/testing.md#behavioral-verification Actual fix execution checks the authored Failure replacement for the $err binding.
// @evidence contracts/testing.md#independent-expectations The supported upstream upper-first compatibility policy independently determines the literal replacement for this uncased-prefix name.
// @evidence contracts/testing.md#distinguishing-cases The $err declaration/use become Failure consistently, retaining the prefix-casing boundary.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsPreservesCanonicalUpperFirstForUncasedPrefixes owns its explicit variants and named subcases where present as a discoverable Go unit entry; actual checker/engine/fix/filename/casing operations run in the shared process with isolated fixture files and no installed consumer, native producer or product child host.
func TestUnicornPreventAbbreviationsPreservesCanonicalUpperFirstForUncasedPrefixes(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    "const $err = new Error();\nvoid $err;\n",
    `{"extendDefaultReplacements":false,"replacements":{"$err":{"failure":true}}}`,
    "const Failure = new Error();\nvoid Failure;\n",
  )
}
