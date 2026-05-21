package linthost

import (
  "strings"
  "testing"
)

// TestFormatBlockRejectsNonBoolUseTabs verifies expandFormatBlock returns an
// error when the `useTabs` field is not a boolean.
//
// Locks the `asBool` error path for the `format.useTabs` key. The field
// toggles between tab and space indentation; a non-bool value (e.g. an
// integer) must be rejected at the format-block boundary.
//
//  1. Call expandFormatBlock with `useTabs: 0` (integer, not bool).
//  2. Assert an error is returned.
//  3. Assert the error message names the offending field `format.useTabs`.
func TestFormatBlockRejectsNonBoolUseTabs(t *testing.T) {
  _, err := expandFormatBlock(map[string]any{"useTabs": 0})
  if err == nil {
    t.Fatal("expected error for non-bool format.useTabs, got nil")
  }
  if !strings.Contains(err.Error(), "format.useTabs") {
    t.Errorf("expected error to name format.useTabs, got: %v", err)
  }
}
