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
//
// @evidence contracts/testing.md#behavioral-verification expandFormatBlock rejects string auto as sortImports.order and names the nested field.
// @evidence contracts/testing.md#independent-expectations Import order is a string array rather than a scalar shorthand; the authored scalar is independently invalid under the public option contract.
// @evidence contracts/testing.md#distinguishing-cases Owns wrong-container order; empty-array and populated-array cases distinguish cardinality and accepted value paths.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. An authored scalar sortImports.order calls expandFormatBlock directly in-process; the nested field error is observed without running import sorting or a script evaluator.
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
