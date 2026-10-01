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
//
// @evidence contracts/testing.md#behavioral-verification The equal-bound regex fixer changes {10,10}/{2,2}/{0,0} to the corresponding single bounds.
// @evidence contracts/testing.md#independent-expectations Literal {10}/{2}/{0} expected patterns derive from equal repetition bounds, retaining multi-digit counts and surrounding atoms.
// @evidence contracts/testing.md#distinguishing-cases Two-digit, ordinary and zero equal bounds fix; unequal, open-ended and already-collapsed bounds stay silent.
// @evidence contracts/testing.md#execution-ownership TestFixRegexpNoUselessTwoNumsQuantifierCollapsesEqualBounds calls assertFixSnapshot for both equal-bound inputs and assertRuleSkipsSource for all three unequal/open/collapsed controls.
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
