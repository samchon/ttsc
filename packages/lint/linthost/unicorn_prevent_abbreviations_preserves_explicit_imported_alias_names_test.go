package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsPreservesExplicitImportedAliasNames verifies that the fixer compares an authored err-as-error import and use output.
//
// The imported export name belongs to the module contract, while the local alias can rename independently.
//
// @evidence contracts/testing.md#behavioral-verification The fixer compares an authored err-as-error import and use output.
// @evidence contracts/testing.md#independent-expectations The imported export name belongs to the module contract, while the local alias can rename independently.
// @evidence contracts/testing.md#distinguishing-cases The imported err key stays intact and both local alias/use become error.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsPreservesExplicitImportedAliasNames owns its explicit variants and named subcases where present as a discoverable Go unit entry; Checker-backed rule snapshots and actual disk fix application run in the shared Go process with isolated authored fixture files; no installed consumer, native producer or product child host runs.
func TestUnicornPreventAbbreviationsPreservesExplicitImportedAliasNames(t *testing.T) {
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    "import { err as err } from \"external\";\nvoid err;\n",
    "import { err as error } from \"external\";\nvoid error;\n",
  )
}
