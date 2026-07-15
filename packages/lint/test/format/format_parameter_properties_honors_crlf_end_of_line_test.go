package linthost

import "testing"

// TestFormatParameterPropertiesHonorsCRLFEndOfLine verifies the constructor
// parameter-property break synthesizes CRLF breaks under endOfLine:"crlf".
//
// Regression shield for issue #616: the builder emitted literal "(\n" and '\n'
// and ignored endOfLine entirely (its options struct had no such field), so a
// broken constructor on an otherwise-CRLF file gained lone LFs. Bound to the
// CRLF oracle (LF twin: format_parameter_properties_breaks_multi_param_
// constructor_test.go); the helper asserts zero lone LFs.
//
//  1. Parse a CRLF class with a two-parameter-property constructor.
//  2. Apply format/parameter-properties with {"endOfLine":"crlf"}.
//  3. Assert each parameter breaks with "\r\n" and no lone LF remains.
func TestFormatParameterPropertiesHonorsCRLFEndOfLine(t *testing.T) {
  assertFixCRLFConsistentWithOptions(
    t,
    "format/parameter-properties",
    "class A {\r\n  constructor(private x: Foo, public y: Bar) {}\r\n}\r\n",
    `{"tabWidth":2,"endOfLine":"crlf"}`,
    "class A {\r\n  constructor(\r\n    private x: Foo,\r\n    public y: Bar\r\n  ) {}\r\n}\r\n",
  )
}
