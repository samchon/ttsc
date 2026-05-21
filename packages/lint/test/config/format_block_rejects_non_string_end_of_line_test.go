package linthost

import (
  "strings"
  "testing"
)

// TestFormatBlockRejectsNonStringEndOfLine verifies expandFormatBlock returns
// an error when the `endOfLine` field is not a string.
//
// Locks two error paths for the `format.endOfLine` key:
//  1. The `asString` call rejects non-string values (e.g. a boolean).
//  2. The `s != "lf" && s != "crlf"` check rejects strings outside the
//     allowed set (e.g. "windows").
//
// Both paths produce errors with the field name in the message; each is tested
// separately to ensure independent coverage of the asString error and the
// value-validation error branches.
//
//  1. Call expandFormatBlock with `endOfLine: false` (non-string).
//  2. Assert an error naming `format.endOfLine`.
//  3. Call expandFormatBlock with `endOfLine: "windows"` (invalid string).
//  4. Assert an error mentioning `endOfLine`.
func TestFormatBlockRejectsNonStringEndOfLine(t *testing.T) {
  _, err := expandFormatBlock(map[string]any{"endOfLine": false})
  if err == nil {
    t.Fatal("expected error for non-string format.endOfLine, got nil")
  }
  if !strings.Contains(err.Error(), "format.endOfLine") {
    t.Errorf("expected error to name format.endOfLine, got: %v", err)
  }

  _, err = expandFormatBlock(map[string]any{"endOfLine": "windows"})
  if err == nil {
    t.Fatal("expected error for invalid format.endOfLine value, got nil")
  }
  if !strings.Contains(err.Error(), "endOfLine") {
    t.Errorf("expected error to mention endOfLine, got: %v", err)
  }
}
