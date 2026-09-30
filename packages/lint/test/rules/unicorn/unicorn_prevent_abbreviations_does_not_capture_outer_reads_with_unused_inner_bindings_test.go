package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsDoesNotCaptureOuterReadsWithUnusedInnerBindings verifies that actual fix execution compares nested cur/curr bindings with the authored output.
//
// An inner generated candidate can capture an outer read even when the inner binding has no own use; that independent lexical relation requires a suffix.
//
// 1. Execute the retained binding, filename, option or command variants.
// 2. Compare the authored diagnostic, edit, helper value or preserved source.
//
// @evidence contracts/testing.md#behavioral-verification Actual fix execution compares nested cur/curr bindings with the authored output.
// @evidence contracts/testing.md#independent-expectations An inner generated candidate can capture an outer read even when the inner binding has no own use; that independent lexical relation requires a suffix.
// @evidence contracts/testing.md#distinguishing-cases Outer cur becomes current and unused inner curr becomes current_, leaving the deepest read bound outside.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsDoesNotCaptureOuterReadsWithUnusedInnerBindings owns its explicit variants and named subcases where present as a discoverable Go unit entry; actual checker/engine/fix/filename/casing operations run in the shared process with isolated fixture files and no installed consumer, native producer or product child host.
func TestUnicornPreventAbbreviationsDoesNotCaptureOuterReadsWithUnusedInnerBindings(t *testing.T) {
  source := "const cur = 1;\n{\n  const curr = 2;\n  {\n    console.log(cur);\n  }\n}\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "const current = 1;\n{\n  const current_ = 2;\n  {\n    console.log(current);\n  }\n}\n",
  )
}
