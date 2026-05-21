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
func TestFormatBlockRejectsNonIntTabWidth(t *testing.T) {
  _, err := expandFormatBlock(map[string]any{"tabWidth": 2.5})
  if err == nil {
    t.Fatal("expected error for fractional format.tabWidth, got nil")
  }
  if !strings.Contains(err.Error(), "format.tabWidth") {
    t.Errorf("expected error to name format.tabWidth, got: %v", err)
  }
}
