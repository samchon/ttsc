package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsFalseReplacementDisablesCompoundMatches verifies that the real engine requires silence for ref and someRef with the explicit false patch.
//
// Disabling a dictionary term independently applies to its standalone and compound matches.
//
// 1. Execute the retained binding, filename, option or command variants.
// 2. Compare the authored diagnostic, edit, helper value or preserved source.
//
// @evidence contracts/testing.md#behavioral-verification The real engine requires silence for ref and someRef with the explicit false patch.
// @evidence contracts/testing.md#independent-expectations Disabling a dictionary term independently applies to its standalone and compound matches.
// @evidence contracts/testing.md#distinguishing-cases Both ref and someRef stay clean under the patch; default dictionary transforms belong to other hosts.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsFalseReplacementDisablesCompoundMatches owns its explicit variants and named subcases where present as a discoverable Go unit entry; actual checker/engine/fix/filename/casing operations run in the shared process with isolated fixture files and no installed consumer, native producer or product child host.
func TestUnicornPreventAbbreviationsFalseReplacementDisablesCompoundMatches(t *testing.T) {
  source := "const ref = 1;\nconst someRef = ref;\nvoid someRef;\n"
  assertRuleSkipsSourceWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    `{"replacements":{"ref":false}}`,
  )
}
