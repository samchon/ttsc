package linthost

import "testing"

// TestSortKeysComparesAcrossAComputedKeyAndResetsAtASpread verifies that a
// computed dynamic key is skipped without resetting the sort baseline, while a
// spread starts a new group.
//
// This native rule skips the computed identifier `[k]`, preserving `b` as its
// baseline, while a spread ends the group. ESLint also compares identifier key
// spellings for computed properties, so this fixture does not certify parity.
//
//  1. Run the rule over `{ b: 1, [k]: 2, a: 3 }` and assert `a` is reported
//     against `b` across the computed key.
//  2. Run it over `{ b: 1, ...rest, a: 3 }` and assert nothing is reported.
//
// @evidence contracts/testing.md#behavioral-verification sort-keys must report a static key that is out of order relative to the static key before a dynamic computed key and must not report across a spread.
// @evidence contracts/testing.md#independent-expectations The authored native policy compares the surrounding static keys across an unclassified computed identifier and restarts at a spread; the literal expected range a: 3 and zero-finding control are independent of the returned findings.
// @evidence contracts/testing.md#distinguishing-cases The two objects keep b before a while changing the middle entry from [k] to ...rest; their separate declarations prepare those inputs. Resetting at both or at neither fails one of the full-result assertions.
// @evidence contracts/testing.md#execution-ownership TestSortKeysComparesAcrossAComputedKeyAndResetsAtASpread parses virtual sources and calls the actual engine in the shared Go unit process; no consumer install or native build runs.
func TestSortKeysComparesAcrossAComputedKeyAndResetsAtASpread(t *testing.T) {
  assertRuleFindingRanges(
    t,
    "sort-keys",
    "const k = 'k';\nconst o = { b: 1, [k]: 2, a: 3 };\nJSON.stringify(o);\n",
    "a: 3",
  )
  assertRuleSkipsSource(
    t,
    "sort-keys",
    "const rest: Record<string, number> = {};\nconst o = { b: 1, ...rest, a: 3 };\nJSON.stringify(o);\n",
  )
}
