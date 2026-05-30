package linthost

import "testing"

// TestFormatParameterPropertiesIdempotentOnBrokenList verifies the rule
// abstains once the parameter list is already multi-line, so the cascade
// converges.
//
// An already-broken list contains a newline in the `(...)` region; the
// rule must not re-break it (which would loop the cascade or fight the
// trailing-comma rule that finishes the shape).
//
//  1. Parse a class whose parameter-property constructor is already
//     broken one-per-line.
//  2. Run format/parameter-properties.
//  3. Assert the rule reports nothing.
func TestFormatParameterPropertiesIdempotentOnBrokenList(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/parameter-properties",
    "class A {\n  constructor(\n    private x: Foo,\n    public y: Bar,\n  ) {}\n}\n",
    `{"tabWidth":2}`,
  )
}
