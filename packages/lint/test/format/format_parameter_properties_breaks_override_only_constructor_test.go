package linthost

import "testing"

// TestFormatParameterPropertiesBreaksOverrideOnlyConstructor verifies a
// constructor whose only parameter-property modifier is `override` is broken
// one-parameter-per-line.
//
// `override` is the fifth member of TypeScript's
// `ModifierFlagsParameterPropertyModifier` mask, and the rule used to restate
// the mask as four keywords. A constructor carrying only `override` therefore
// read as having no parameter property at all, so the rule abstained where
// Prettier 3.8.3 force-breaks (#1131).
//
//  1. Parse a derived class with `constructor(override rate: number, kind: string)`.
//  2. Apply format/parameter-properties (tabWidth 2).
//  3. Assert each parameter lands on its own indented line.
func TestFormatParameterPropertiesBreaksOverrideOnlyConstructor(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/parameter-properties",
    "class Ctrl extends Base {\n  constructor(override rate: number, kind: string) {}\n}\n",
    `{"tabWidth":2}`,
    "class Ctrl extends Base {\n  constructor(\n    override rate: number,\n    kind: string\n  ) {}\n}\n",
  )
}
