package linthost

import (
  "strings"
  "testing"
)

// TestAsStringRejectsNonStringValue verifies asString returns a typed error
// when given a value that is not a Go string.
//
// Locks the error return path inside asString. asString is used for
// `format.trailingComma` and `format.endOfLine`; providing a non-string
// (e.g. a boolean or integer) must produce a field-named error message.
//
//  1. Call asString("format.trailingComma", 42) — integer, not string.
//  2. Assert an error is returned.
//  3. Assert the error message names the offending field.
//  4. Call asString("format.endOfLine", "lf") — valid string.
//  5. Assert no error and the returned value is "lf".
func TestAsStringRejectsNonStringValue(t *testing.T) {
  _, err := asString("format.trailingComma", 42)
  if err == nil {
    t.Fatal("asString(field, int): expected error, got nil")
  }
  if !strings.Contains(err.Error(), "format.trailingComma") {
    t.Errorf("asString error should name the field, got: %v", err)
  }

  got, err := asString("format.endOfLine", "lf")
  if err != nil {
    t.Fatalf("asString(field, \"lf\"): unexpected error: %v", err)
  }
  if got != "lf" {
    t.Fatalf("asString(field, \"lf\"): expected %q, got %q", "lf", got)
  }
}
