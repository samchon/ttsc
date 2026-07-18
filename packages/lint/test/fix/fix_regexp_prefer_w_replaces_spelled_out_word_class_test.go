package linthost

import "testing"

// TestFixRegexpPreferWReplacesSpelledOutWordClass verifies `regexp/prefer-w`
// rewrites both accepted spellings of the word class to `\w`.
//
// The rule accepts `[A-Za-z0-9_]` and `[a-zA-Z0-9_]`, so the fix has to cover
// both orderings rather than the one the check happens to test first. `\w` is
// equivalent to the spelled-out class under every flag combination, including
// `iu`, where the flag widens both sides to the same two extra code points.
//
//  1. Fix a literal holding one class in each accepted spelling.
//  2. Assert both become `\w`.
//  3. Assert the same class missing its underscore reports nothing, since that
//     one is genuinely narrower than `\w`.
func TestFixRegexpPreferWReplacesSpelledOutWordClass(t *testing.T) {
  assertFixSnapshot(
    t,
    "regexp/prefer-w",
    "const value = /[A-Za-z0-9_]-[a-zA-Z0-9_]/;\nJSON.stringify(value);\n",
    "const value = /\\w-\\w/;\nJSON.stringify(value);\n",
  )
  assertRuleSkipsSource(
    t,
    "regexp/prefer-w",
    "const value = /[A-Za-z0-9]/;\nJSON.stringify(value);\n",
  )
  assertRuleSkipsSource(
    t,
    "regexp/prefer-w",
    "const value = /[A-Za-z_]/;\nJSON.stringify(value);\n",
  )
}
