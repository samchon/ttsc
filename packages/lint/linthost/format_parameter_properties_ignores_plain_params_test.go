package linthost

import "testing"

// TestFormatParameterPropertiesIgnoresPlainParams verifies a constructor
// whose parameters carry no parameter-property modifier is left inline.
//
// Only parameter properties trigger Prettier's force-break; a plain
// `constructor(x: Foo, y: Bar)` is governed by ordinary width reflow, so
// this rule must abstain on it.
//
//  1. Parse a class with a two-plain-parameter constructor.
//  2. Run format/parameter-properties.
//  3. Assert the rule reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification The owning parameter-properties rule must return no findings for an ordinary two-parameter constructor. The absence assertion prevents force-breaking lists merely because they have multiple parameters.
// @evidence contracts/testing.md#independent-expectations The supported force-break contract requires at least one parameter property. This constructor has none and leaves width-based choices to other rules, independently of the implementation modifier scan.
// @evidence contracts/testing.md#distinguishing-cases The two plain parameters supply a negative with sufficient list length but no qualifying modifier. BreaksMultiParamConstructor and BreaksOverrideOnlyConstructor supply the corresponding property-positive distinctions.
// @evidence contracts/testing.md#execution-ownership TestFormatParameterPropertiesIgnoresPlainParams owns its literal no-finding fixture in the public Go unit population. The syntax-only owning operation runs in process without a consumer install, native artifact build or real product host.
func TestFormatParameterPropertiesIgnoresPlainParams(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/parameter-properties",
    "class A {\n  constructor(x: Foo, y: Bar) {}\n}\n",
    `{"tabWidth":2}`,
  )
}
