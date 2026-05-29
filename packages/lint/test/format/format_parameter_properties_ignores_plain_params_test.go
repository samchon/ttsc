package linthost

import "testing"

// TestFormatParameterPropertiesIgnoresPlainParams verifies a constructor
// whose parameters carry no accessibility/readonly modifier is left
// inline.
//
// Only parameter properties trigger Prettier's force-break; a plain
// `constructor(x: Foo, y: Bar)` is governed by ordinary width reflow, so
// this rule must abstain on it.
//
//  1. Parse a class with a two-plain-parameter constructor.
//  2. Run format/parameter-properties.
//  3. Assert the rule reports nothing.
func TestFormatParameterPropertiesIgnoresPlainParams(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/parameter-properties",
    "class A {\n  constructor(x: Foo, y: Bar) {}\n}\n",
    `{"tabWidth":2}`,
  )
}
