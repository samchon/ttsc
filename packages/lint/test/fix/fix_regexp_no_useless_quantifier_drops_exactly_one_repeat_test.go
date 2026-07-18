package linthost

import "testing"

// TestFixRegexpNoUselessQuantifierDropsExactlyOneRepeat verifies
// `regexp/no-useless-quantifier` deletes a `{1}` only where the neighbouring
// characters leave the deletion meaning-preserving.
//
// Both unsafe shapes still parse after the edit, so the engine's own regexp
// parser cannot catch them and the rule has to decline on its own:
// `/a{1}?/` is "exactly one, lazily" and would become the optional `/a?/`, and
// `/\1{1}2/` would fuse into `\12`, backreference twelve rather than
// backreference one followed by a literal `2`.
//
//  1. Fix a `{1}` between two ordinary atoms and one following a group.
//  2. Assert both collapse to the bare atom.
//  3. Assert the lazy and backreference neighbours still report but apply no
//     edit, and that `{1,}` and `{2}` do not report at all.
func TestFixRegexpNoUselessQuantifierDropsExactlyOneRepeat(t *testing.T) {
  assertFixSnapshot(
    t,
    "regexp/no-useless-quantifier",
    "const value = /a{1}b/;\nJSON.stringify(value);\n",
    "const value = /ab/;\nJSON.stringify(value);\n",
  )
  assertFixSnapshot(
    t,
    "regexp/no-useless-quantifier",
    "const value = /(?:ab){1}c/;\nJSON.stringify(value);\n",
    "const value = /(?:ab)c/;\nJSON.stringify(value);\n",
  )
  assertNoFixSnapshot(
    t,
    "regexp/no-useless-quantifier",
    "const value = /a{1}?/;\nJSON.stringify(value);\n",
  )
  assertNoFixSnapshot(
    t,
    "regexp/no-useless-quantifier",
    "const value = /(a)\\1{1}2/;\nJSON.stringify(value);\n",
  )
  assertRuleSkipsSource(
    t,
    "regexp/no-useless-quantifier",
    "const value = /a{1,}/;\nJSON.stringify(value);\n",
  )
  assertRuleSkipsSource(
    t,
    "regexp/no-useless-quantifier",
    "const value = /a{2}/;\nJSON.stringify(value);\n",
  )
}
