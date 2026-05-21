package linthost

import (
  "strings"
  "testing"
)

// TestFormatBlockRejectsInvalidTrailingCommaValue verifies expandFormatBlock
// returns an error when `trailingComma` is a string but not one of the
// allowed values ("all", "es5", "none").
//
// Locks the `default:` branch of the trailingComma switch inside
// expandFormatBlock. After `asString` succeeds, the value is validated against
// the three allowed modes; any other value (e.g. "always") must be rejected
// with an error that names the field and lists the allowed options.
//
//  1. Call expandFormatBlock with `trailingComma: "always"`.
//  2. Assert an error is returned.
//  3. Assert the error message mentions the bad value.
func TestFormatBlockRejectsInvalidTrailingCommaValue(t *testing.T) {
  _, err := expandFormatBlock(map[string]any{"trailingComma": "always"})
  if err == nil {
    t.Fatal("expected error for invalid format.trailingComma value, got nil")
  }
  if !strings.Contains(err.Error(), "trailingComma") {
    t.Errorf("expected error to mention trailingComma, got: %v", err)
  }
}
