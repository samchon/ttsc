package linthost

import "testing"

// TestFormatParameterPropertiesIgnoresDecoratedPlainParams verifies a
// constructor whose parameters carry a decorator but no parameter-property
// modifier is left inline.
//
// This is the negative twin of the `override` case. A decorated parameter has a
// non-empty modifier list, so a check that merely asks "does this parameter
// carry modifiers?" would over-match it. `ModifierFlagsParameterPropertyModifier`
// excludes `ModifierFlagsDecorator`, and this case is what keeps that
// distinction pinned.
//
//  1. Parse a class with `constructor(@Inject() rate: number, kind: string)`.
//  2. Run format/parameter-properties.
//  3. Assert the rule reports nothing.
func TestFormatParameterPropertiesIgnoresDecoratedPlainParams(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/parameter-properties",
    "class A {\n  constructor(@Inject() rate: Foo, kind: Bar) {}\n}\n",
    `{"tabWidth":2}`,
  )
}
