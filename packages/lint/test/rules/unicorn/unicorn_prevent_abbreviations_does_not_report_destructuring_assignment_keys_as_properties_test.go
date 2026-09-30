package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsDoesNotReportDestructuringAssignmentKeysAsProperties verifies that actual rule execution requires zero findings for the retained assignment-pattern key.
//
// A destructuring assignment property key is not a property declaration/use target under this rule, independently requiring silence.
//
// @evidence contracts/testing.md#behavioral-verification Actual rule execution requires zero findings for the retained assignment-pattern key.
// @evidence contracts/testing.md#independent-expectations A destructuring assignment property key is not a property declaration/use target under this rule, independently requiring silence.
// @evidence contracts/testing.md#distinguishing-cases The err key assigns into local but stays clean under properties-only mode.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsDoesNotReportDestructuringAssignmentKeysAsProperties owns its explicit variants and named subcases where present as a discoverable Go unit entry; Checker-backed rule snapshots and zero-finding comparisons run in the shared Go process with isolated authored fixture files; no installed consumer, native producer or product child host runs.
func TestUnicornPreventAbbreviationsDoesNotReportDestructuringAssignmentKeysAsProperties(t *testing.T) {
  source := "const source = {} as Record<string, number>;\nlet local = 0;\n({ err: local } = source);\nvoid local;\n"
  assertRuleSkipsSourceWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    `{"checkVariables":false,"checkProperties":true}`,
  )
}
