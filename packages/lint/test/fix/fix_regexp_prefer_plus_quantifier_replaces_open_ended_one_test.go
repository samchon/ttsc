package linthost

import "testing"

// TestFixRegexpPreferPlusQuantifierReplacesOpenEndedOne verifies
// `regexp/prefer-plus-quantifier` rewrites every `{1,}` in the literal to `+`.
//
// `+` and `{1,}` are the same quantifier with the same binding, so a trailing
// lazy `?` keeps applying to the rewritten quantifier rather than turning into
// a second one. The scan already located each brace run; only the span was
// thrown away.
//
//  1. Fix a literal carrying two `{1,}` runs, one of them lazy, so the atomic
//     multi-edit group and the lazy-marker survival are pinned together.
//  2. Assert the result is `/a+?b+/`.
//  3. Assert `{2,}`, `{1,2}`, and the comma-free `{1}` report nothing, so the
//     rewrite cannot reach a quantifier with a different meaning.
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
