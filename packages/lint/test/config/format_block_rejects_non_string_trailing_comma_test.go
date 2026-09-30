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
//
// @evidence contracts/testing.md#behavioral-verification expandFormatBlock rejects Boolean trailingComma true and names its field.
// @evidence contracts/testing.md#independent-expectations Trailing comma mode is a string vocabulary rather than a Boolean switch; independently authored true must not be coerced into a mode.
// @evidence contracts/testing.md#distinguishing-cases Owns wrong-type comma mode; invalid string always and valid es5 forwarding separate the next decision steps.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. An authored Boolean trailingComma calls expandFormatBlock directly in-process; its field error observes type validation without rendering commas or compiling a host.
func TestFormatBlockRejectsNonStringTrailingComma(t *testing.T) {
  _, err := expandFormatBlock(map[string]any{"trailingComma": true})
  if err == nil {
    t.Fatal("expected error for non-string format.trailingComma, got nil")
  }
  if !strings.Contains(err.Error(), "format.trailingComma") {
    t.Errorf("expected error to name format.trailingComma, got: %v", err)
  }
}
