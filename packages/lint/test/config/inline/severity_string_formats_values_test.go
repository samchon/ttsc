package main

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
