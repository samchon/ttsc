package linthost

import (
  "strings"
  "testing"
)

// TestFormatBlockRejectsNonStringTrailingComma verifies expandFormatBlock
// returns an error when the `trailingComma` field is not a string.
//
// Locks the `asString` error path for the `format.trailingComma` key. The
// field accepts "all", "es5", or "none"; any non-string value (such as a bool)
// must be rejected at the format-block boundary before the switch statement
// inspects the value.
//
//  1. Call expandFormatBlock with `trailingComma: true` (a bool, not a string).
//  2. Assert an error is returned.
//  3. Assert the error message names the offending field `format.trailingComma`.
func TestFormatBlockRejectsNonStringTrailingComma(t *testing.T) {
  _, err := expandFormatBlock(map[string]any{"trailingComma": true})
  if err == nil {
    t.Fatal("expected error for non-string format.trailingComma, got nil")
  }
  if !strings.Contains(err.Error(), "format.trailingComma") {
    t.Errorf("expected error to name format.trailingComma, got: %v", err)
  }
}
