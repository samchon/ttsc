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
func TestFormatBlockRejectsNonIntPrintWidth(t *testing.T) {
  _, err := expandFormatBlock(map[string]any{"printWidth": "wide"})
  if err == nil {
    t.Fatal("expected error for non-int format.printWidth, got nil")
  }
  if !strings.Contains(err.Error(), "format.printWidth") {
    t.Errorf("expected error to name format.printWidth, got: %v", err)
  }
}
