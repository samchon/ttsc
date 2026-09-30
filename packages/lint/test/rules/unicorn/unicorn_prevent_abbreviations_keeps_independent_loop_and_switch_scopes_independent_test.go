package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsKeepsIndependentLoopAndSwitchScopesIndependent verifies that the real fixer compares the complete authored repeated error bindings in separate loops/switches.
//
// Independent lexical scopes permit reuse without capture, unlike a shared function var scope.
//
// @evidence contracts/testing.md#behavioral-verification The real fixer compares the complete authored repeated error bindings in separate loops/switches.
// @evidence contracts/testing.md#independent-expectations Independent lexical scopes permit reuse without capture, unlike a shared function var scope.
// @evidence contracts/testing.md#distinguishing-cases Two loop and two switch bindings all retain unsuffixed error names in their separate scopes.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsKeepsIndependentLoopAndSwitchScopesIndependent owns its explicit variants and named subcases where present as a discoverable Go unit entry; Checker-backed rule snapshots and actual disk fix application run in the shared Go process with isolated authored fixture files; no installed consumer, native producer or product child host runs.
func TestUnicornPreventAbbreviationsKeepsIndependentLoopAndSwitchScopesIndependent(t *testing.T) {
  source := "function log(errors: string[], first: number, second: number): void {\n  for (const err of errors) console.log(err);\n  for (const err of errors) console.log(err);\n  switch (first) {\n    case 0:\n      const err = \"first\";\n      console.log(err);\n      break;\n  }\n  switch (second) {\n    case 0:\n      const err = \"second\";\n      console.log(err);\n      break;\n  }\n}\nvoid log;\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "function log(errors: string[], first: number, second: number): void {\n  for (const error of errors) console.log(error);\n  for (const error of errors) console.log(error);\n  switch (first) {\n    case 0:\n      const error = \"first\";\n      console.log(error);\n      break;\n  }\n  switch (second) {\n    case 0:\n      const error = \"second\";\n      console.log(error);\n      break;\n  }\n}\nvoid log;\n",
  )
}
