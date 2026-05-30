package linthost

import "testing"

// TestFormatParameterPropertiesKeepsSingleParamInline verifies a
// constructor with a single parameter property is NOT broken.
//
// Prettier only force-breaks a parameter-property constructor when it has
// more than one parameter; a lone `constructor(private x: Foo)` stays
// inline. The len < 2 guard pins this so the rule does not gratuitously
// explode one-argument constructors.
//
//  1. Parse a class with a single-parameter-property constructor.
//  2. Run format/parameter-properties.
//  3. Assert the rule reports nothing.
func TestFormatParameterPropertiesKeepsSingleParamInline(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/parameter-properties",
    "class A {\n  constructor(private readonly x: Foo) {}\n}\n",
    `{"tabWidth":2}`,
  )
}
