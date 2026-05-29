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
func TestFormatParameterPropertiesBreaksMultiParamConstructor(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/parameter-properties",
    "class A {\n  constructor(private x: Foo, public y: Bar) {}\n}\n",
    `{"tabWidth":2}`,
    "class A {\n  constructor(\n    private x: Foo,\n    public y: Bar\n  ) {}\n}\n",
  )
}
