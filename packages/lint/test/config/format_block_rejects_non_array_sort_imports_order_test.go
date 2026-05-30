package linthost

import (
  "strings"
  "testing"
)

// TestFormatBlockRejectsNonArraySortImportsOrder verifies a non-array `order`
// value is rejected at the format-block boundary.
//
// Locks the asStringSlice error path for format.sortImports.order. A string
// where an array is expected must be surfaced before the rule engine is handed
// an invalid options blob.
//
//  1. Call expandFormatBlock with sortImports.order set to a string.
//  2. Assert an error naming format.sortImports.order.
func TestFormatBlockRejectsNonArraySortImportsOrder(t *testing.T) {
  _, err := expandFormatBlock(map[string]any{
    "sortImports": map[string]any{"order": "auto"},
  })
  if err == nil {
    t.Fatal("expected error for non-array order, got nil")
  }
  if !strings.Contains(err.Error(), "format.sortImports.order") {
    t.Errorf("expected error to name format.sortImports.order, got: %v", err)
  }
}
