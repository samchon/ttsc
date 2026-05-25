package linthost

import (
  "strings"
  "testing"
)

// TestFormatBlockRejectsEmptyImportOrder verifies the loader rejects
// `format: { importOrder: [] }` with an instructive error.
//
// Setting `importOrder` opts into `format/sort-imports`; an empty
// array is the rule's "no groups configured" state and would
// silently enable a no-op rule. The doc-contract says "omit the
// field to keep formatSortImports off"; the boundary check
// enforces it.
//
//  1. Build `format: { importOrder: [] }`.
//  2. Parse it through `parseExternalConfigStore`.
//  3. Assert the error mentions both `format.importOrder` and the
//     "omit" remediation.
func TestFormatBlockRejectsEmptyImportOrder(t *testing.T) {
  _, err := parseExternalConfigStore(map[string]any{
    "format": map[string]any{"importOrder": []any{}},
  }, "")
  if err == nil {
    t.Fatal("expected error for empty importOrder, got nil")
  }
  if !strings.Contains(err.Error(), "format.importOrder") {
    t.Errorf("expected error to mention format.importOrder, got %v", err)
  }
  if !strings.Contains(err.Error(), "omit") {
    t.Errorf("expected error to suggest omitting the field, got %v", err)
  }
}
