package linthost

import "testing"

// TestFormatParameterPropertiesIgnoresDecoratedPlainParams verifies a
// constructor whose parameters carry a decorator but no parameter-property
// modifier is left inline.
//
// A decorator is carried in the same modifier list as an accessibility keyword,
// and `ModifierFlagsParameterPropertyModifier` deliberately excludes
// `ModifierFlagsDecorator`. This case pins that boundary against a future
// simplification to "does this parameter carry modifiers at all". Prettier
// 3.8.3 leaves the same constructor inline, so the abstention is the oracle's,
// not the implementation's.
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
