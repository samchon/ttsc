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
//
// @evidence contracts/testing.md#behavioral-verification expandFormatBlock rejects numeric useTabs 0 and names format.useTabs.
// @evidence contracts/testing.md#independent-expectations Indentation mode is Boolean, so false-looking numeric input must not be accepted by coercion; literal zero supplies the independent invalid value.
// @evidence contracts/testing.md#distinguishing-cases Owns numeric-versus-Boolean indentation choice; true useTabs translation is exercised by the complete mapping case.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. An authored numeric useTabs setting calls expandFormatBlock directly in-process; its field error observes Boolean validation without indent formatting or a child host.
func TestFormatBlockRejectsNonBoolUseTabs(t *testing.T) {
  _, err := expandFormatBlock(map[string]any{"useTabs": 0})
  if err == nil {
    t.Fatal("expected error for non-bool format.useTabs, got nil")
  }
  if !strings.Contains(err.Error(), "format.useTabs") {
    t.Errorf("expected error to name format.useTabs, got: %v", err)
  }
}
