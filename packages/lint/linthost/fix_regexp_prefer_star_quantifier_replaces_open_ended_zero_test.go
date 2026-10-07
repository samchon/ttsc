package linthost

import "testing"

// TestFixRegexpPreferStarQuantifierReplacesOpenEndedZero verifies
// `regexp/prefer-star-quantifier` rewrites `{0,}` to `*`.
//
// The sibling of the `+` rewrite, separated so an over-match in one shorthand
// cannot hide behind the other: `{0,}` and `{1,}` differ only in the minimum,
// and the scan reports the two through the same code path.
//
//  1. Fix a literal whose `{0,}` follows a group, so the rewrite is pinned on
//     an atom wider than one character.
//  2. Assert the result is `/(?:ab)*c/`.
//  3. Assert `{1,}`, `{0,1}`, and the comma-free `{0}` report nothing.
//
// @evidence contracts/testing.md#behavioral-verification The star-quantifier fixer changes a grouped {0,} repetition to star without altering its group or following c.
// @evidence contracts/testing.md#independent-expectations Literal (?:ab)*c derives from minimum-zero unbounded repetition, retaining multi-byte group syntax.
// @evidence contracts/testing.md#distinguishing-cases {1,}, {0,1} and {0} differ in the lower/upper bound and must not report.
// @evidence contracts/testing.md#execution-ownership TestFixRegexpPreferStarQuantifierReplacesOpenEndedZero owns its assertFixSnapshot and three assertRuleSkipsSource cases.
func TestFixRegexpPreferStarQuantifierReplacesOpenEndedZero(t *testing.T) {
  assertFixSnapshot(
    t,
    "regexp/prefer-star-quantifier",
    "const value = /(?:ab){0,}c/;\nJSON.stringify(value);\n",
    "const value = /(?:ab)*c/;\nJSON.stringify(value);\n",
  )
  assertRuleSkipsSource(
    t,
    "regexp/prefer-star-quantifier",
    "const value = /a{1,}/;\nJSON.stringify(value);\n",
  )
  assertRuleSkipsSource(
    t,
    "regexp/prefer-star-quantifier",
    "const value = /a{0,1}/;\nJSON.stringify(value);\n",
  )
  assertRuleSkipsSource(
    t,
    "regexp/prefer-star-quantifier",
    "const value = /a{0}/;\nJSON.stringify(value);\n",
  )
}
