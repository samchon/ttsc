package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsFalseReplacementStopsCaseVariantFallback verifies that the actual engine accepts err under a false entry despite an enabled differently cased key.
//
// The supported exact false override independently prevents case-variant fallback from reviving the disabled spelling.
//
// 1. Execute the retained binding, filename, option or command variants.
// 2. Compare the authored diagnostic, edit, helper value or preserved source.
//
// @evidence contracts/testing.md#behavioral-verification The actual engine accepts err under a false entry despite an enabled differently cased key.
// @evidence contracts/testing.md#independent-expectations The supported exact false override independently prevents case-variant fallback from reviving the disabled spelling.
// @evidence contracts/testing.md#distinguishing-cases err:false stays clean beside Err:failure; this contrasts with ordinary case expansion.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsFalseReplacementStopsCaseVariantFallback owns its explicit variants and named subcases where present as a discoverable Go unit entry; actual checker/engine/fix/filename/casing operations run in the shared process with isolated fixture files and no installed consumer, native producer or product child host.
func TestUnicornPreventAbbreviationsFalseReplacementStopsCaseVariantFallback(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    "const err = new Error();\nvoid err;\n",
    `{"replacements":{"err":false,"Err":{"failure":true}}}`,
  )
}
