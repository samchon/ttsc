package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsFalseReplacementDisablesCompoundMatches verifies that the real engine requires silence for ref and someRef with the explicit false patch.
//
// Disabling a dictionary term independently applies to its standalone and compound matches.
//
// @evidence contracts/testing.md#behavioral-verification The real engine requires silence for ref and someRef with the explicit false patch.
// @evidence contracts/testing.md#independent-expectations Disabling a dictionary term independently applies to its standalone and compound matches.
// @evidence contracts/testing.md#distinguishing-cases Both ref and someRef stay clean under the patch; default dictionary transforms belong to other hosts.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsFalseReplacementDisablesCompoundMatches owns its explicit variants and named subcases where present as a discoverable Go unit entry; Checker-backed rule snapshots and zero-finding comparisons run in the shared Go process with isolated authored fixture files; no installed consumer, native producer or product child host runs.
func TestUnicornPreventAbbreviationsFalseReplacementDisablesCompoundMatches(t *testing.T) {
  source := "const ref = 1;\nconst someRef = ref;\nvoid someRef;\n"
  assertRuleSkipsSourceWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    `{"replacements":{"ref":false}}`,
  )
}
