package linthost

import (
  "strings"
  "testing"
)

// TestFormatBlockRejectsEmptySortImportsOrder verifies an empty `order` array
// is rejected with an instructive error.
//
// An empty `order` is the rule's "no groups configured" state and would
// silently enable a no-op grouping; the boundary check steers the user to omit
// the field to fall back on the default order instead.
//
//  1. Build `sortImports: { order: [] }`.
//  2. Parse it through parseExternalConfigStore.
//  3. Assert the error names format.sortImports.order and suggests omitting it.
//
// @evidence contracts/testing.md#behavioral-verification parseExternalConfigStore rejects an explicitly empty sort-import order and names the field plus omission remedy.
// @evidence contracts/testing.md#independent-expectations An order must contain a grouping entry; omitting it requests defaults whereas an empty list is invalid, establishing the independent diagnostic requirement.
// @evidence contracts/testing.md#distinguishing-cases Owns empty-array boundary; true shorthand and populated order are positive cases, wrong-container validation is separate.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. An authored empty order array reaches parseExternalConfigStore directly in-process; nested field and omission errors are observed without formatting source or evaluating a script config.
func TestFormatBlockRejectsEmptySortImportsOrder(t *testing.T) {
  _, err := parseExternalConfigStore(map[string]any{
    "format": map[string]any{"sortImports": map[string]any{"order": []any{}}},
  }, "")
  if err == nil {
    t.Fatal("expected error for empty order, got nil")
  }
  if !strings.Contains(err.Error(), "format.sortImports.order") {
    t.Errorf("expected error to mention format.sortImports.order, got %v", err)
  }
  if !strings.Contains(err.Error(), "omit") {
    t.Errorf("expected error to suggest omitting the field, got %v", err)
  }
}
