package linthost

import "testing"

// TestFormatParameterPropertiesBreaksMultiParamConstructor verifies a
// constructor with two-plus parameters and at least one parameter
// property is broken one-parameter-per-line even when the flat form fits.
//
// Prettier 3 force-breaks such a constructor regardless of width. The
// rule rewrites only the `(...)` region and emits no trailing comma; the
// trailing comma is added by format/trailing-comma once the list is
// multi-line, so this fixture asserts only the line breaks and indent.
//
//  1. Parse a class with a two-parameter-property constructor.
//  2. Apply format/parameter-properties (tabWidth 2).
//  3. Assert each parameter lands on its own indented line.
//
// @evidence contracts/testing.md#behavioral-verification The owning parameter-properties rule must break the two parameter properties onto separate four-space lines while preserving constructor and class tokens. Complete output catches missing force-break or damaging modifier/type spelling.
// @evidence contracts/testing.md#independent-expectations The supported parameter-property policy, matching Prettier constructor layout, force-breaks a multi-parameter list. This dedicated rule emits no final trailing comma because the sibling comma rule owns it; literal output reflects that scope.
// @evidence contracts/testing.md#distinguishing-cases This positive has two explicit parameter properties under tabWidth two. The singleton, plain-parameter and decorated-plain hosts provide negatives, and CRLF and override hosts cover other decisions.
// @evidence contracts/testing.md#execution-ownership TestFormatParameterPropertiesBreaksMultiParamConstructor owns its literal source/options/output in the public Go unit population. The syntax-only owning rule and edit application run in process without installing a consumer, building native artifacts or starting a product host.
func TestFormatParameterPropertiesBreaksMultiParamConstructor(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/parameter-properties",
    "class A {\n  constructor(private x: Foo, public y: Bar) {}\n}\n",
    `{"tabWidth":2}`,
    "class A {\n  constructor(\n    private x: Foo,\n    public y: Bar\n  ) {}\n}\n",
  )
}
