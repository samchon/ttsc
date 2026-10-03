package linthost

import "testing"

// TestFormatParameterPropertiesIgnoresDecoratedPlainParams verifies a
// constructor whose parameters carry a decorator but no parameter-property
// modifier is left inline.
//
// A decorator is carried in the same modifier list as an accessibility keyword,
// and `ModifierFlagsParameterPropertyModifier` deliberately excludes
// `ModifierFlagsDecorator`. This case pins that boundary against a future
// simplification to "does this parameter carry modifiers at all". The
// independently authored no-finding oracle follows that classification;
// it does not run or observe an installed reference formatter.
//
//  1. Parse a class with `constructor(@Inject() rate: Foo, kind: Bar)`.
//  2. Run format/parameter-properties.
//  3. Assert the rule reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification The owning parameter-properties rule must return no findings for a constructor parameter carrying Inject but no property modifier. The absence oracle detects equating any modifier-list entry with a parameter property.
// @evidence contracts/testing.md#independent-expectations The supported TypeScript parameter-property classification excludes decorators, so this decorated plain list remains outside the force-break rule scope. The local rule no-finding expectation follows that distinction.
// @evidence contracts/testing.md#distinguishing-cases The two-parameter list contains one decorated plain parameter and one ordinary parameter. BreaksOverrideOnlyConstructor supplies a modifier that does qualify, while IgnoresPlainParams covers a modifier-free negative.
// @evidence contracts/testing.md#execution-ownership TestFormatParameterPropertiesIgnoresDecoratedPlainParams owns its literal parsed fixture in the public Go unit population. The syntax-only owning rule executes in process without consumer installation, native artifact production or a real product host.
func TestFormatParameterPropertiesIgnoresDecoratedPlainParams(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/parameter-properties",
    "class A {\n  constructor(@Inject() rate: Foo, kind: Bar) {}\n}\n",
    `{"tabWidth":2}`,
  )
}
