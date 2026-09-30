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
//
// @evidence contracts/testing.md#behavioral-verification expandFormatBlock rejects endOfLine false and the unsupported string windows, with field context for both failures.
// @evidence contracts/testing.md#independent-expectations Line ending accepts only lf or crlf string values; independently authored Boolean false and string windows exercise distinct type and vocabulary violations.
// @evidence contracts/testing.md#distinguishing-cases Owns wrong type and correct-type invalid spelling; crlf propagation to layout and import sorting provides the accepted counterpart.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. An authored Boolean and an invalid string endOfLine call expandFormatBlock directly in-process; two field errors observe type and vocabulary boundaries without rendering source line endings.
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
