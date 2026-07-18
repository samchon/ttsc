package linthost

import "testing"

// TestFixRegexpNoUselessTwoNumsQuantifierCollapsesEqualBounds verifies
// `regexp/no-useless-two-nums-quantifier` rewrites `{n,n}` to `{n}`.
//
// The count is reprinted from the parsed minimum rather than sliced out of the
// source, so a multi-digit bound has to survive the round trip; `{10,10}` would
// come back as `{1}` under a one-character assumption. The braces stay in
// place, so unlike the `{1}` deletion nothing can fuse with a neighbour.
//
//  1. Fix a literal carrying a two-digit and a one-digit equal-bound run.
//  2. Assert the result is `/a{10}b{2}/`.
//  3. Assert the zero boundary collapses to `{0}` as well, and that `{2,3}`,
//     `{2,}`, and the already-collapsed `{2}` report nothing.
func TestFixRegexpNoUselessTwoNumsQuantifierCollapsesEqualBounds(t *testing.T) {
  assertFixSnapshot(
    t,
    "regexp/no-useless-two-nums-quantifier",
    "const value = /a{10,10}b{2,2}/;\nJSON.stringify(value);\n",
    "const value = /a{10}b{2}/;\nJSON.stringify(value);\n",
  )
  assertFixSnapshot(
    t,
    "regexp/no-useless-two-nums-quantifier",
    "const value = /a{0,0}/;\nJSON.stringify(value);\n",
    "const value = /a{0}/;\nJSON.stringify(value);\n",
  )
  assertRuleSkipsSource(
    t,
    "regexp/no-useless-two-nums-quantifier",
    "const value = /a{2,3}/;\nJSON.stringify(value);\n",
  )
  assertRuleSkipsSource(
    t,
    "regexp/no-useless-two-nums-quantifier",
    "const value = /a{2,}/;\nJSON.stringify(value);\n",
  )
  assertRuleSkipsSource(
    t,
    "regexp/no-useless-two-nums-quantifier",
    "const value = /a{2}/;\nJSON.stringify(value);\n",
  )
}
