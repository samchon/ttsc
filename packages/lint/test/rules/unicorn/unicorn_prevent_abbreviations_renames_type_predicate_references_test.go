package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsRenamesTypePredicateReferences verifies that the actual fixer compares authored ordinary/assertion predicate parameter and predicate-reference outputs.
//
// Type predicate references name the parameter binding, independently requiring both declaration and predicate references to rename together.
//
// 1. Execute the retained binding, filename, option or command variants.
// 2. Compare the authored diagnostic, edit, helper value or preserved source.
//
// @evidence contracts/testing.md#behavioral-verification The actual fixer compares authored ordinary/assertion predicate parameter and predicate-reference outputs.
// @evidence contracts/testing.md#independent-expectations Type predicate references name the parameter binding, independently requiring both declaration and predicate references to rename together.
// @evidence contracts/testing.md#distinguishing-cases Ordinary val-is-string and asserts-val-is-string forms retain their distinct full outputs.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsRenamesTypePredicateReferences owns its explicit variants and named subcases where present as a discoverable Go unit entry; actual checker/engine/fix/filename/casing operations run in the shared process with isolated fixture files and no installed consumer, native producer or product child host.
func TestUnicornPreventAbbreviationsRenamesTypePredicateReferences(t *testing.T) {
  source := "function isString(val: unknown): val is string {\n  return typeof val === \"string\";\n}\ntype AssertString = (val: unknown) => asserts val is string;\nvoid isString;\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "function isString(value: unknown): value is string {\n  return typeof value === \"string\";\n}\ntype AssertString = (value: unknown) => asserts value is string;\nvoid isString;\n",
  )
}
