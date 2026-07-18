package linthost

import "testing"

// TestFixRegexpPreferQuestionQuantifierReplacesZeroToOne verifies
// `regexp/prefer-question-quantifier` rewrites `{0,1}` to `?`.
//
// The lazy arm is the interesting one: `/a{0,1}?/` is a lazy optional, and `?`
// is both the shorthand and the lazy marker, so the correct output stutters to
// `/a??/`. Emitting a single `?` would silently make the quantifier greedy.
//
//  1. Fix a literal whose `{0,1}` carries a lazy marker.
//  2. Assert the result is `/a??/`, taken from the quantifier semantics rather
//     than from what reads naturally.
//  3. Assert `{0,2}`, `{1,1}`, and `{0,}` report nothing.
func TestFixRegexpPreferQuestionQuantifierReplacesZeroToOne(t *testing.T) {
  assertFixSnapshot(
    t,
    "regexp/prefer-question-quantifier",
    "const value = /a{0,1}?/;\nJSON.stringify(value);\n",
    "const value = /a??/;\nJSON.stringify(value);\n",
  )
  assertRuleSkipsSource(
    t,
    "regexp/prefer-question-quantifier",
    "const value = /a{0,2}/;\nJSON.stringify(value);\n",
  )
  assertRuleSkipsSource(
    t,
    "regexp/prefer-question-quantifier",
    "const value = /a{1,1}/;\nJSON.stringify(value);\n",
  )
  assertRuleSkipsSource(
    t,
    "regexp/prefer-question-quantifier",
    "const value = /a{0,}/;\nJSON.stringify(value);\n",
  )
}
