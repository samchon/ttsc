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
//
// @evidence contracts/testing.md#behavioral-verification expandFormatBlock rejects numeric singleQuote 1 with its field context.
// @evidence contracts/testing.md#independent-expectations Quote preference is controlled by a Boolean option rather than numeric truthiness; literal 1 must not be coerced.
// @evidence contracts/testing.md#distinguishing-cases Owns numeric-versus-Boolean quote selection; singleQuote true payload propagation executes separately.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. An authored numeric singleQuote setting calls expandFormatBlock directly in-process; its field error observes Boolean validation without quote formatting or a child evaluator.
func TestFormatBlockRejectsNonBoolSingleQuote(t *testing.T) {
  _, err := expandFormatBlock(map[string]any{"singleQuote": 1})
  if err == nil {
    t.Fatal("expected error for non-bool format.singleQuote, got nil")
  }
  if !strings.Contains(err.Error(), "format.singleQuote") {
    t.Errorf("expected error to name format.singleQuote, got: %v", err)
  }
}
