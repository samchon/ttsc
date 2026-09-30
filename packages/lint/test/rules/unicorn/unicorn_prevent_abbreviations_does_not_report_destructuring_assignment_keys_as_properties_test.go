package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsDoesNotReportDestructuringAssignmentKeysAsProperties verifies that actual rule execution requires zero findings for the retained assignment-pattern key.
//
// A destructuring assignment property key is not a property declaration/use target under this rule, independently requiring silence.
//
// 1. Execute the retained binding, filename, option or command variants.
// 2. Compare the authored diagnostic, edit, helper value or preserved source.
//
// @evidence contracts/testing.md#behavioral-verification Actual rule execution requires zero findings for the retained assignment-pattern key.
// @evidence contracts/testing.md#independent-expectations A destructuring assignment property key is not a property declaration/use target under this rule, independently requiring silence.
// @evidence contracts/testing.md#distinguishing-cases The err key assigns into local but stays clean under properties-only mode.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsDoesNotReportDestructuringAssignmentKeysAsProperties owns its explicit variants and named subcases where present as a discoverable Go unit entry; actual checker/engine/fix/filename/casing operations run in the shared process with isolated fixture files and no installed consumer, native producer or product child host.
func TestUnicornPreventAbbreviationsDoesNotReportDestructuringAssignmentKeysAsProperties(t *testing.T) {
  source := "const source = {} as Record<string, number>;\nlet local = 0;\n({ err: local } = source);\nvoid local;\n"
  assertRuleSkipsSourceWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    `{"checkVariables":false,"checkProperties":true}`,
  )
}
