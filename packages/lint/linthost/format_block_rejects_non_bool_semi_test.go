package linthost

import (
  "strings"
  "testing"
)

// TestFormatBlockRejectsNonBoolSemi verifies expandFormatBlock returns an
// error when the `semi` field is not a boolean.
//
// Locks the `asBool` error path for the `format.semi` key in expandFormatBlock.
// The `semi` key always calls asBool; passing a non-bool value (e.g., a string)
// must be caught at the format-block boundary with a typed error message rather
// than silently using the default or panicking downstream.
//
//  1. Call expandFormatBlock with `semi: "yes"` (a string, not a bool).
//  2. Assert an error is returned.
//  3. Assert the error message names the offending field `format.semi`.
//
// @evidence contracts/testing.md#behavioral-verification expandFormatBlock rejects semi string yes with format.semi context.
// @evidence contracts/testing.md#independent-expectations The semi option is Boolean and must not coerce truthy strings; independently authored yes is outside that type contract.
// @evidence contracts/testing.md#distinguishing-cases Owns wrong Boolean type for semicolons; semi false translation is the accepted counterpart.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. An authored semi string calls expandFormatBlock directly in-process; its field error observes Boolean validation without formatting source or invoking a host.
func TestFormatBlockRejectsNonBoolSemi(t *testing.T) {
  _, err := expandFormatBlock(map[string]any{"semi": "yes"})
  if err == nil {
    t.Fatal("expected error for non-bool format.semi, got nil")
  }
  if !strings.Contains(err.Error(), "format.semi") {
    t.Errorf("expected error to name format.semi, got: %v", err)
  }
}
