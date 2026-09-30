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
//
// @evidence contracts/testing.md#behavioral-verification The owning parameter-properties rule must force-break a two-parameter constructor when override is its only parameter-property modifier. Complete source catches a hardcoded accessibility-only modifier set and retains the derived class and both parameters.
// @evidence contracts/testing.md#independent-expectations The supported TypeScript parameter-property modifier contract includes override, and installed Prettier 3.8.3 breaks this list. The literal local-rule output preserves types and omits the final comma owned by a sibling rule.
// @evidence contracts/testing.md#distinguishing-cases The first parameter has override while the second is plain, so one eligible property must suffice. IgnoresDecoratedPlainParams distinguishes a decorator modifier that must not trigger the same decision.
// @evidence contracts/testing.md#execution-ownership TestFormatParameterPropertiesBreaksOverrideOnlyConstructor owns its literal derived-class fixture in the public Go unit population. The syntax-only owning operation and edit harness execute in process without consumer installation, native production or a real product host.
func TestFormatParameterPropertiesBreaksOverrideOnlyConstructor(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/parameter-properties",
    "class Ctrl extends Base {\n  constructor(override rate: number, kind: string) {}\n}\n",
    `{"tabWidth":2}`,
    "class Ctrl extends Base {\n  constructor(\n    override rate: number,\n    kind: string\n  ) {}\n}\n",
  )
}
