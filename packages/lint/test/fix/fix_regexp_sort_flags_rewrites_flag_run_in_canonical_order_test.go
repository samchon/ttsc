package linthost

import "testing"

// TestFixRegexpSortFlagsRewritesFlagRunInCanonicalOrder verifies
// `regexp/sort-flags` emits the sorted flag run it already built to decide the
// finding.
//
// The check sorted the flags into ECMAScript's `dgimsuvy` order and compared
// the result against the source, then discarded it; the correction was computed
// on every report and never offered. A permutation of a flag run cannot change
// what the literal matches, which is why this is an automatic fix and not a
// suggestion.
//
//  1. Fix a literal whose five flags are fully scrambled, so the assertion
//     pins the order rather than a single swap.
//  2. Assert the emitted run is `gimuy`.
//  3. Assert the already-sorted twin, a single flag, and no flags at all report
//     nothing, so the fix cannot be reached by a literal that is already
//     canonical.
//
// @evidence contracts/testing.md#behavioral-verification regexp/sort-flags changes ygimu to gimuy and leaves canonical, singleton and empty flag runs alone.
// @evidence contracts/testing.md#independent-expectations The literal gimuy result follows the canonical flag order, retaining the regex body and surrounding source.
// @evidence contracts/testing.md#distinguishing-cases Scrambled five-flag input must change; already-sorted, one-flag and no-flag inputs must emit zero findings.
// @evidence contracts/testing.md#execution-ownership TestFixRegexpSortFlagsRewritesFlagRunInCanonicalOrder calls assertFixSnapshot and three assertRuleSkipsSource controls in the Go process.
func TestFixRegexpSortFlagsRewritesFlagRunInCanonicalOrder(t *testing.T) {
  assertFixSnapshot(
    t,
    "regexp/sort-flags",
    "const value = /a/ygimu;\nJSON.stringify(value);\n",
    "const value = /a/gimuy;\nJSON.stringify(value);\n",
  )
  assertRuleSkipsSource(
    t,
    "regexp/sort-flags",
    "const value = /a/gimuy;\nJSON.stringify(value);\n",
  )
  assertRuleSkipsSource(
    t,
    "regexp/sort-flags",
    "const value = /a/i;\nJSON.stringify(value);\n",
  )
  assertRuleSkipsSource(
    t,
    "regexp/sort-flags",
    "const value = /a/;\nJSON.stringify(value);\n",
  )
}
