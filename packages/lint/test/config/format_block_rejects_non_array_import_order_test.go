package linthost

import (
  "strings"
  "testing"
)

// TestFormatBlockRejectsNonArrayImportOrder verifies expandFormatBlock returns
// an error when the `importOrder` field is not an array.
//
// Locks the `asStringSlice` error path for `format.importOrder`. The field
// activates `format/sort-imports`; a non-array value (e.g. a string) must be
// rejected at the format-block boundary so the rule engine is never given an
// invalid options blob.
//
//  1. Call expandFormatBlock with `importOrder: "auto"` (string, not array).
//  2. Assert an error is returned.
//  3. Assert the error message names the offending field `format.importOrder`.
func TestFormatBlockRejectsNonArrayImportOrder(t *testing.T) {
  _, err := expandFormatBlock(map[string]any{"importOrder": "auto"})
  if err == nil {
    t.Fatal("expected error for non-array format.importOrder, got nil")
  }
  if !strings.Contains(err.Error(), "format.importOrder") {
    t.Errorf("expected error to name format.importOrder, got: %v", err)
  }
}
