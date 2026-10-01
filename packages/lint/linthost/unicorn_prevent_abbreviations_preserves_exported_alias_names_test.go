package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsPreservesExportedAliasNames verifies that the actual fixer compares three authored export forms with full output.
//
// Public export keys are module contract names, independently preserved while their local bindings rename.
//
// @evidence contracts/testing.md#behavioral-verification The actual fixer compares three authored export forms with full output.
// @evidence contracts/testing.md#independent-expectations Public export keys are module contract names, independently preserved while their local bindings rename.
// @evidence contracts/testing.md#distinguishing-cases Shorthand export, explicit same-name alias and publicError alias retain their original exported spelling.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsPreservesExportedAliasNames owns its explicit variants and named subcases where present as a discoverable Go unit entry; Checker-backed rule snapshots and actual disk fix application run in the shared Go process with isolated authored fixture files; no installed consumer, native producer or product child host runs.
func TestUnicornPreventAbbreviationsPreservesExportedAliasNames(t *testing.T) {
  source := "const err = new Error();\nexport { err };\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "const error = new Error();\nexport { error as err };\n",
  )
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    "const err = new Error();\nexport { err as err };\n",
    "const error = new Error();\nexport { error as err };\n",
  )
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    "const err = new Error();\nexport { err as publicError };\n",
    "const error = new Error();\nexport { error as publicError };\n",
  )
}
