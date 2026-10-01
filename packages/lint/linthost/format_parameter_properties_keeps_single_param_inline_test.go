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
//  1. Parse a singleton parameter-property constructor and an empty list.
//  2. Run format/parameter-properties.
//  3. Assert the rule reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification The owning parameter-properties rule must report nothing for a singleton private-readonly parameter or an empty constructor list. These assertions detect force-breaking lists below the two-parameter threshold.
// @evidence contracts/testing.md#independent-expectations The supported constructor policy only force-breaks when there is more than one parameter and a parameter property. Literal zero/singleton lists therefore remain unchanged independently of the implementation length guard.
// @evidence contracts/testing.md#distinguishing-cases The original singleton property negative stays and an empty-list negative is added. BreaksMultiParamConstructor supplies the adjacent two-property positive and the plain/decorated hosts distinguish modifier eligibility.
// @evidence contracts/testing.md#execution-ownership TestFormatParameterPropertiesKeepsSingleParamInline owns both literal list-size fixtures in the public Go unit population. The syntax-only owning rule executes in process without consumer installation, native artifact production or starting a real product host.
func TestFormatParameterPropertiesKeepsSingleParamInline(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/parameter-properties",
    "class A {\n  constructor(private readonly x: Foo) {}\n}\n",
    `{"tabWidth":2}`,
  )
  assertRuleSkipsSourceWithOptions(t, "format/parameter-properties",
    "class A {\n  constructor() {}\n}\n", `{"tabWidth":2}`)
}
