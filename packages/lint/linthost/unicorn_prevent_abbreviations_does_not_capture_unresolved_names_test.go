package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsDoesNotCaptureUnresolvedNames verifies that the real fixer checks the authored error_ output beside an unresolved error read.
//
// A rename must not capture an unresolved reference; that lexical preservation independently requires the underscore candidate.
//
// @evidence contracts/testing.md#behavioral-verification The real fixer checks the authored error_ output beside an unresolved error read.
// @evidence contracts/testing.md#independent-expectations A rename must not capture an unresolved reference; that lexical preservation independently requires the underscore candidate.
// @evidence contracts/testing.md#distinguishing-cases The unresolved error read stays unchanged while err declaration/use become error_.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsDoesNotCaptureUnresolvedNames owns its explicit variants and named subcases where present as a discoverable Go unit entry; Checker-backed rule snapshots and actual disk fix application run in the shared Go process with isolated authored fixture files; no installed consumer, native producer or product child host runs.
func TestUnicornPreventAbbreviationsDoesNotCaptureUnresolvedNames(t *testing.T) {
  source := "function render(err: string): string {\n  console.log(error);\n  return err;\n}\nvoid render;\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "function render(error_: string): string {\n  console.log(error);\n  return error_;\n}\nvoid render;\n",
  )
}
