package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsDoesNotTreatDestructuringPropertyKeysAsCollisions verifies that actual fix execution compares the original property-key binding source with its authored output.
//
// A destructuring property key is not a local error binding and independently must not force a suffix.
//
// @evidence contracts/testing.md#behavioral-verification Actual fix execution compares the original property-key binding source with its authored output.
// @evidence contracts/testing.md#independent-expectations A destructuring property key is not a local error binding and independently must not force a suffix.
// @evidence contracts/testing.md#distinguishing-cases The error property key remains intact while err declaration/use can become unsuffixed error.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsDoesNotTreatDestructuringPropertyKeysAsCollisions owns its explicit variants and named subcases where present as a discoverable Go unit entry; Checker-backed rule snapshots and actual disk fix application run in the shared Go process with isolated authored fixture files; no installed consumer, native producer or product child host runs.
func TestUnicornPreventAbbreviationsDoesNotTreatDestructuringPropertyKeysAsCollisions(t *testing.T) {
  source := "function render(err: string, source: { error: string }): string {\n  const { error: value } = source;\n  return err + value;\n}\nvoid render;\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "function render(error: string, source: { error: string }): string {\n  const { error: value } = source;\n  return error + value;\n}\nvoid render;\n",
  )
}
