package linthost

import (
  "strings"
  "testing"
)

// TestFormatBlockRejectsNonIntPrintWidth verifies expandFormatBlock returns an
// error when the `printWidth` field cannot be coerced to an integer.
//
// Locks the `asInt` error path for the `format.printWidth` key. The field
// accepts integer-shaped values; a string like "wide" must be rejected at the
// format-block boundary with a typed error that identifies the field.
//
//  1. Call expandFormatBlock with `printWidth: "wide"` (a string, not an int).
//  2. Assert an error is returned.
//  3. Assert the error message names the offending field `format.printWidth`.
//
// @evidence contracts/testing.md#behavioral-verification expandFormatBlock rejects printWidth string wide and names the field.
// @evidence contracts/testing.md#independent-expectations Print width is an integer-valued option, excluding nonnumeric words; the authored wide input establishes invalidity independently of coercion.
// @evidence contracts/testing.md#distinguishing-cases Owns unsupported string width; integer100 propagation and fractional tab-width rejection are complementary cases.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. An authored printWidth word calls expandFormatBlock directly in-process; its field error observes integer validation without layout formatting or a native producer.
func TestFormatBlockRejectsNonIntPrintWidth(t *testing.T) {
  _, err := expandFormatBlock(map[string]any{"printWidth": "wide"})
  if err == nil {
    t.Fatal("expected error for non-int format.printWidth, got nil")
  }
  if !strings.Contains(err.Error(), "format.printWidth") {
    t.Errorf("expected error to name format.printWidth, got: %v", err)
  }
}
