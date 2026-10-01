package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsFalseReplacementStopsCaseVariantFallback verifies that the actual engine accepts err under a false entry despite an enabled differently cased key.
//
// The supported exact false override independently prevents case-variant fallback from reviving the disabled spelling.
//
// @evidence contracts/testing.md#behavioral-verification The actual engine accepts err under a false entry despite an enabled differently cased key.
// @evidence contracts/testing.md#independent-expectations The supported exact false override independently prevents case-variant fallback from reviving the disabled spelling.
// @evidence contracts/testing.md#distinguishing-cases err:false stays clean beside Err:failure; this contrasts with ordinary case expansion.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsFalseReplacementStopsCaseVariantFallback owns its explicit variants and named subcases where present as a discoverable Go unit entry; Checker-backed rule snapshots and zero-finding comparisons run in the shared Go process with isolated authored fixture files; no installed consumer, native producer or product child host runs.
func TestUnicornPreventAbbreviationsFalseReplacementStopsCaseVariantFallback(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    "const err = new Error();\nvoid err;\n",
    `{"replacements":{"err":false,"Err":{"failure":true}}}`,
  )
}
