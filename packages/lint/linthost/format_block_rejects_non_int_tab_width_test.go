package linthost

import (
  "strings"
  "testing"
)

// TestFormatBlockRejectsNonIntTabWidth verifies expandFormatBlock returns an
// error when the `tabWidth` field cannot be coerced to an integer.
//
// Locks the `asInt` error path for the `format.tabWidth` key. A fractional
// float (e.g. 2.5) has no meaningful interpretation as a tab width and must
// be rejected; the error message must identify the field so the user can fix
// the config typo.
//
//  1. Call expandFormatBlock with `tabWidth: 2.5` (fractional float64).
//  2. Assert an error is returned.
//  3. Assert the error message names the offending field `format.tabWidth`.
//
// @evidence contracts/testing.md#behavioral-verification expandFormatBlock rejects fractional tabWidth2.5 and names the field.
// @evidence contracts/testing.md#independent-expectations A tab occupies an integral width, so an authored fractional value has no valid option meaning and must not truncate.
// @evidence contracts/testing.md#distinguishing-cases Owns fractional numeric width; integral tab4 forwarding and nonnumeric print-width rejection execute separately.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. An authored fractional tabWidth calls expandFormatBlock directly in-process; its field error observes integer validation without layout formatting or a child evaluator.
func TestFormatBlockRejectsNonIntTabWidth(t *testing.T) {
  _, err := expandFormatBlock(map[string]any{"tabWidth": 2.5})
  if err == nil {
    t.Fatal("expected error for fractional format.tabWidth, got nil")
  }
  if !strings.Contains(err.Error(), "format.tabWidth") {
    t.Errorf("expected error to name format.tabWidth, got: %v", err)
  }
}
