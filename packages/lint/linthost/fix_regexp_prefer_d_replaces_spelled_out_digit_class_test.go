package linthost

import "testing"

// TestFixRegexpPreferDReplacesSpelledOutDigitClass verifies `regexp/prefer-d`
// rewrites every `[0-9]` character class in the literal to `\d`.
//
// In `/\[0-9]/` the bracket is escaped, so there is no class there at all: the
// rule must not report it, and a substring-driven splice would emit `/\\d/`, a
// literal backslash followed by `d`. An escaped bracket inside a real class, as
// in `/[\[0-9]/`, likewise holds no `[0-9]` class.
//
//  1. Fix a literal holding two separate `[0-9]` classes.
//  2. Assert both become `\d`.
//  3. Assert the two escaped-bracket literals, `[0-9a]` and the negated
//     `[^0-9]` report nothing.
//
// @evidence contracts/testing.md#behavioral-verification regexp/prefer-d changes both real [0-9] classes to backslash-d and reports nothing for an escaped bracket.
// @evidence contracts/testing.md#independent-expectations Literal two-class output preserves the separator and quantifier; the escaped-bracket sources require zero findings because they contain no character class.
// @evidence contracts/testing.md#distinguishing-cases Real classes fix, and the escaped-bracket lookalikes and extended/negated classes stay silent.
// @evidence contracts/testing.md#execution-ownership TestFixRegexpPreferDReplacesSpelledOutDigitClass calls assertFixSnapshot for both real classes and assertRuleSkipsSource for the escaped-bracket, extended and negated sources.
func TestFixRegexpPreferDReplacesSpelledOutDigitClass(t *testing.T) {
  assertFixSnapshot(
    t,
    "regexp/prefer-d",
    "const value = /[0-9]-[0-9]+/;\nJSON.stringify(value);\n",
    "const value = /\\d-\\d+/;\nJSON.stringify(value);\n",
  )
  assertRuleSkipsSource(
    t,
    "regexp/prefer-d",
    "const value = /\\[0-9]/;\nJSON.stringify(value);\n",
  )
  assertRuleSkipsSource(
    t,
    "regexp/prefer-d",
    "const value = /[\\[0-9]/;\nJSON.stringify(value);\n",
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
