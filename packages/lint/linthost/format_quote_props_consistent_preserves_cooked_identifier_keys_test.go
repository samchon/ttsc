package linthost

import "testing"

// TestFormatQuotePropsConsistentPreservesCookedIdentifierKeys verifies that
// adding quotes preserves the identifier's property name rather than its raw
// escape spelling.
//
// Identifier escapes are decoded by the language before selecting the key.
// Quoting a raw backslash with another backslash instead creates a different
// property. A neighboring key requiring quotes activates consistent mode.
//
// 1. Run the real consistent quote-props fixer on two escaped identifiers.
// 2. Require quoted output to contain their decoded property names.
// 3. Keep ordinary ASCII and literal Unicode identifier controls equivalent.
//
// @evidence contracts/testing.md#behavioral-verification assertFixSnapshotWithOptions runs format/quote-props under consistent mode, applies its real edits and compares complete output for fixed-width and braced identifier escapes plus plain ASCII and literal Unicode controls.
// @evidence contracts/testing.md#independent-expectations ECMAScript decodes identifier Unicode escapes before defining the property; the authored quoted foo and alpha keys independently name those decoded values. Doubling a raw backslash would define an unrelated key.
// @evidence contracts/testing.md#distinguishing-cases Fixed-width and braced escapes both need decoding; ordinary ASCII and literal Unicode spellings need no decoding. A bar-baz sibling requires consistent quoting in every row, while the untouched surrounding source detects accidental edits.
// @evidence contracts/testing.md#execution-ownership This discoverable Go Test and four named subtests call assertFixSnapshotWithOptions, which executes the owning Engine and applies actual fixes to private fixture files in the same process. No consumer installation, native build or real product host runs.
func TestFormatQuotePropsConsistentPreservesCookedIdentifierKeys(t *testing.T) {
  rows := []struct {
    name string
    source string
    expected string
  }{
    {"fixed-width", "const value = { f\\u006fo: 1, \"bar-baz\": 2 };\n", "const value = { \"foo\": 1, \"bar-baz\": 2 };\n"},
    {"braced", "const value = { \\u{66}oo: 1, \"bar-baz\": 2 };\n", "const value = { \"foo\": 1, \"bar-baz\": 2 };\n"},
    {"plain-ascii", "const value = { foo: 1, \"bar-baz\": 2 };\n", "const value = { \"foo\": 1, \"bar-baz\": 2 };\n"},
    {"literal-unicode", "const value = { α: 1, \"bar-baz\": 2 };\n", "const value = { \"α\": 1, \"bar-baz\": 2 };\n"},
  }
  for _, row := range rows {
    t.Run(row.name, func(t *testing.T) {
      assertFixSnapshotWithOptions(t, "format/quote-props", row.source, `{"mode":"consistent"}`, row.expected)
    })
  }
}
