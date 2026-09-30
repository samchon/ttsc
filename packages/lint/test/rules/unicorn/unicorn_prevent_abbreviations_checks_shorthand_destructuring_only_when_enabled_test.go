package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsChecksShorthandDestructuringOnlyWhenEnabled verifies that the engine/fixer checks clean default destructuring and the authored enabled rewrite.
//
// The public shorthand-property opt-in independently allows expansion while preserving the original property key.
//
// 1. Execute the retained binding, filename, option or command variants.
// 2. Compare the authored diagnostic, edit, helper value or preserved source.
//
// @evidence contracts/testing.md#behavioral-verification The engine/fixer checks clean default destructuring and the authored enabled rewrite.
// @evidence contracts/testing.md#independent-expectations The public shorthand-property opt-in independently allows expansion while preserving the original property key.
// @evidence contracts/testing.md#distinguishing-cases The default shorthand err is clean; enabled mode produces err:error and updates the reference.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsChecksShorthandDestructuringOnlyWhenEnabled owns its explicit variants and named subcases where present as a discoverable Go unit entry; actual checker/engine/fix/filename/casing operations run in the shared process with isolated fixture files and no installed consumer, native producer or product child host.
func TestUnicornPreventAbbreviationsChecksShorthandDestructuringOnlyWhenEnabled(t *testing.T) {
  source := "declare const source: { err: Error };\nconst { err } = source;\nconsole.error(err);\n"
  assertRuleSkipsSource(t, unicornPreventAbbreviationsRuleName, source)
  assertFixSnapshotWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    `{"checkShorthandProperties":true}`,
    "declare const source: { err: Error };\nconst { err: error } = source;\nconsole.error(error);\n",
  )
}
