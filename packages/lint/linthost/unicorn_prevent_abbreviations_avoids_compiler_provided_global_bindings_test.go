package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsAvoidsCompilerProvidedGlobalBindings verifies that the fixer compares the Err class transform with the authored Error_ output.
//
// The independently known compiler-provided Error global occupies that candidate; the supported collision policy preserves it.
//
// @evidence contracts/testing.md#behavioral-verification The fixer compares the Err class transform with the authored Error_ output.
// @evidence contracts/testing.md#independent-expectations The independently known compiler-provided Error global occupies that candidate; the supported collision policy preserves it.
// @evidence contracts/testing.md#distinguishing-cases The class declaration/use become Error_ rather than shadowing the builtin Error binding.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsAvoidsCompilerProvidedGlobalBindings owns its explicit variants and named subcases where present as a discoverable Go unit entry; Checker-backed rule snapshots and actual disk fix application run in the shared Go process with isolated authored fixture files; no installed consumer, native producer or product child host runs.
func TestUnicornPreventAbbreviationsAvoidsCompilerProvidedGlobalBindings(t *testing.T) {
  source := "class Err {}\nvoid Err;\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "class Error_ {}\nvoid Error_;\n",
  )
}
