package linthost

import "testing"

// TestFixRegexpPreferDReplacesSpelledOutDigitClass verifies `regexp/prefer-d`
// rewrites every `[0-9]` character class in the literal to `\d`.
//
// The fix is located by the character-class walk rather than by the substring
// test that decides the finding, and the difference is load-bearing: in
// `/\[0-9]/` the bracket is escaped, so there is no class there at all and a
// substring-driven splice would emit `/\\d/`, a literal backslash followed by
// `d`. That literal keeps its (pre-existing) report and gets no edit.
//
//  1. Fix a literal holding two separate `[0-9]` classes.
//  2. Assert both become `\d`.
//  3. Assert the escaped-bracket literal applies no edit, and that `[0-9a]`
//     and the negated `[^0-9]` report nothing.
func TestFixRegexpPreferDReplacesSpelledOutDigitClass(t *testing.T) {
  assertFixSnapshot(
    t,
    "regexp/prefer-d",
    "const value = /[0-9]-[0-9]+/;\nJSON.stringify(value);\n",
    "const value = /\\d-\\d+/;\nJSON.stringify(value);\n",
  )
  assertNoFixSnapshot(
    t,
    "regexp/prefer-d",
    "const value = /\\[0-9]/;\nJSON.stringify(value);\n",
  )
  assertRuleSkipsSource(
    t,
    "regexp/prefer-d",
    "const value = /[0-9a]/;\nJSON.stringify(value);\n",
  )
  assertRuleSkipsSource(
    t,
    "regexp/prefer-d",
    "const value = /[^0-9]/;\nJSON.stringify(value);\n",
  )
}
