package linthost

import "testing"

// TestFixRegexpPreferPlusQuantifierReplacesOpenEndedOne verifies
// `regexp/prefer-plus-quantifier` rewrites every `{1,}` in the literal to `+`.
//
// `+` and `{1,}` are the same quantifier with the same binding, so a trailing
// lazy `?` keeps applying to the rewritten quantifier rather than turning into
// a second one. The scan retains each brace run's span, so the repair replaces
// only the quantifier and leaves the following lazy marker unchanged.
//
//  1. Fix a literal carrying two `{1,}` runs, one of them lazy, so the atomic
//     multi-edit group and the lazy-marker survival are pinned together.
//  2. Assert the result is `/a+?b+/`.
//  3. Assert `{2,}`, `{1,2}`, and the comma-free `{1}` report nothing, so the
//     rewrite cannot reach a quantifier with a different meaning.
//
// @evidence contracts/testing.md#behavioral-verification The plus-quantifier fixer replaces both {1,} runs and retains the lazy marker.
// @evidence contracts/testing.md#independent-expectations Literal a+?b+ output follows open-ended minimum-one quantifier equivalence independently of rule scanning.
// @evidence contracts/testing.md#distinguishing-cases {2,}, {1,2} and comma-free {1} are nearby zero-finding bounds.
// @evidence contracts/testing.md#execution-ownership TestFixRegexpPreferPlusQuantifierReplacesOpenEndedOne calls assertFixSnapshot and three assertRuleSkipsSource controls in one Go process.
func TestFixRegexpPreferPlusQuantifierReplacesOpenEndedOne(t *testing.T) {
  assertFixSnapshot(
    t,
    "regexp/prefer-plus-quantifier",
    "const value = /a{1,}?b{1,}/;\nJSON.stringify(value);\n",
    "const value = /a+?b+/;\nJSON.stringify(value);\n",
  )
  assertRuleSkipsSource(
    t,
    "regexp/prefer-plus-quantifier",
    "const value = /a{2,}/;\nJSON.stringify(value);\n",
  )
  assertRuleSkipsSource(
    t,
    "regexp/prefer-plus-quantifier",
    "const value = /a{1,2}/;\nJSON.stringify(value);\n",
  )
  assertRuleSkipsSource(
    t,
    "regexp/prefer-plus-quantifier",
    "const value = /a{1}/;\nJSON.stringify(value);\n",
  )
}
