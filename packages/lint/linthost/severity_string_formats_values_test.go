package linthost

import "testing"

// TestSeverityStringFormatsValues verifies severity values render stable text.
//
// Severity values flow into debug output and assertion failures. Keeping their
// String form explicit makes config tests easier to diagnose and prevents
// unknown integer values from masquerading as supported rule levels.
//
// This scenario covers every Severity branch directly instead of relying on
// incidental formatting from larger config tests.
//
// 1. Format the supported off, warning, and error severities.
// 2. Format an unknown numeric severity.
// 3. Assert each string matches the command/config vocabulary.
//
// @evidence contracts/testing.md#behavioral-verification Severity.String returns the public spellings for off, warning and error and returns unknown for an unsupported enum value.
// @evidence contracts/testing.md#independent-expectations Literal public spellings are the formatting contract; the 9999 sentinel deliberately lies outside the supported enum.
// @evidence contracts/testing.md#distinguishing-cases Every valid enum value is compared with an invalid adjacent domain class; ParseRules cases separately own input parsing rather than enum formatting.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. Four authored Severity values call String directly in the shared Go process; literal rendered vocabulary is observed without config parsing, compiler invocation or native compilation.
func TestSeverityStringFormatsValues(t *testing.T) {
  cases := map[Severity]string{
    SeverityOff:    "off",
    SeverityWarn:   "warning",
    SeverityError:  "error",
    Severity(9999): "unknown",
  }
  for severity, expected := range cases {
    if actual := severity.String(); actual != expected {
      t.Fatalf("%v.String(): want %q, got %q", int(severity), expected, actual)
    }
  }
}
