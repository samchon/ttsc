package linthost

import (
  "strings"
  "testing"
)

// TestFormatBlockRejectsNonBoolSingleQuote verifies expandFormatBlock returns
// an error when the `singleQuote` field is not a boolean.
//
// Locks the `asBool` error path for the `format.singleQuote` key. The field
// controls whether quotes default to single or double; a non-bool value (such
// as an integer) must be rejected at the boundary with a clear error message.
//
//  1. Call expandFormatBlock with `singleQuote: 1` (integer, not bool).
//  2. Assert an error is returned.
//  3. Assert the error message names the offending field `format.singleQuote`.
func TestFormatBlockRejectsNonBoolSingleQuote(t *testing.T) {
  _, err := expandFormatBlock(map[string]any{"singleQuote": 1})
  if err == nil {
    t.Fatal("expected error for non-bool format.singleQuote, got nil")
  }
  if !strings.Contains(err.Error(), "format.singleQuote") {
    t.Errorf("expected error to name format.singleQuote, got: %v", err)
  }
}
