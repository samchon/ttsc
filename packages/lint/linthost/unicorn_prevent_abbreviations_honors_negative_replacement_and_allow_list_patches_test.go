package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsHonorsNegativeReplacementAndAllowListPatches verifies that the actual fixer checks each authored negative-patch transform and clean default.
//
// Supported false entries remove one replacement or allow-list exemption independently of full-table replacement.
//
// @evidence contracts/testing.md#behavioral-verification The actual fixer checks each authored negative-patch transform and clean default.
// @evidence contracts/testing.md#independent-expectations Supported false entries remove one replacement or allow-list exemption independently of full-table replacement.
// @evidence contracts/testing.md#distinguishing-cases Removing event ambiguity permits e->error; defaultProps is clean by default and changes when its exemption or default list is disabled.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsHonorsNegativeReplacementAndAllowListPatches owns its explicit variants and named subcases where present as a discoverable Go unit entry; Checker-backed rule snapshots and actual disk fix application run in the shared Go process with isolated authored fixture files; no installed consumer, native producer or product child host runs.
func TestUnicornPreventAbbreviationsHonorsNegativeReplacementAndAllowListPatches(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    "const e = new Error();\nvoid e;\n",
    `{"replacements":{"e":{"event":false}}}`,
    "const error = new Error();\nvoid error;\n",
  )

  source := "const defaultProps = {};\nvoid defaultProps;\n"
  assertRuleSkipsSource(t, unicornPreventAbbreviationsRuleName, source)
  assertFixSnapshotWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    `{"allowList":{"defaultProps":false}}`,
    "const defaultProperties = {};\nvoid defaultProperties;\n",
  )
  assertFixSnapshotWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    `{"extendDefaultAllowList":false}`,
    "const defaultProperties = {};\nvoid defaultProperties;\n",
  )
}
