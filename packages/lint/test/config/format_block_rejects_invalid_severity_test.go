package linthost

import (
  "strings"
  "testing"
)

// TestFormatBlockRejectsInvalidSeverity verifies that `format.severity` uses
// the same severity parser as rule entries.
//
// The field is optional and defaults to off, but once present it is still a
// user-authored policy knob. Typos must fail at the format-block boundary
// instead of being ignored and silently falling back to off.
//
//  1. Build `format: { severity: "maybe" }`.
//  2. Parse it through `parseExternalConfigStore`.
//  3. Assert the error points at `format.severity`.
//
// @evidence contracts/testing.md#behavioral-verification parseExternalConfigStore rejects format.severity maybe and names that field.
// @evidence contracts/testing.md#independent-expectations The supported severity vocabulary excludes maybe; the literal invalid value and field diagnostic establish rejection independently of parsing.
// @evidence contracts/testing.md#distinguishing-cases Owns an invalid authored severity string; default off and explicit warning are the adjacent accepted states.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. An authored severity maybe object reaches parseExternalConfigStore directly in-process; the field-scoped error is observed without a formatter source walk or child host.
func TestFormatBlockRejectsInvalidSeverity(t *testing.T) {
  _, err := parseExternalConfigStore(map[string]any{
    "format": map[string]any{"severity": "maybe"},
  }, "")
  if err == nil {
    t.Fatal("expected error for invalid format.severity, got nil")
  }
  if !strings.Contains(err.Error(), "format.severity") {
    t.Errorf("expected error to mention format.severity, got %v", err)
  }
}
