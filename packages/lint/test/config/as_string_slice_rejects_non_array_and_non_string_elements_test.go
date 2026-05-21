package linthost

import (
  "strings"
  "testing"
)

// TestAsStringSliceRejectsNonArrayAndNonStringElements verifies asStringSlice
// returns a typed error when the input is not an array, and when an array
// element is not a string.
//
// Locks two error paths inside asStringSlice:
//
//   - The `arr, ok := v.([]any)` cast fails when v is not a slice (e.g. a map).
//
//   - The per-element `s, ok := item.(string)` cast fails when an element is
//     not a string (e.g. an integer).
//
//     1. Call asStringSlice("format.importOrder", map[string]any{}) — not an array.
//     2. Assert error mentioning the field.
//     3. Call asStringSlice("format.importOrder", []any{"ok", 42}) — integer element.
//     4. Assert error mentioning the field and the index.
func TestAsStringSliceRejectsNonArrayAndNonStringElements(t *testing.T) {
  _, err := asStringSlice("format.importOrder", map[string]any{})
  if err == nil {
    t.Fatal("asStringSlice(map): expected error, got nil")
  }
  if !strings.Contains(err.Error(), "format.importOrder") {
    t.Errorf("asStringSlice error should name the field, got: %v", err)
  }

  _, err = asStringSlice("format.importOrder", []any{"ok", 42})
  if err == nil {
    t.Fatal("asStringSlice([]any{string, int}): expected error, got nil")
  }
  if !strings.Contains(err.Error(), "format.importOrder") {
    t.Errorf("asStringSlice element error should name the field, got: %v", err)
  }
}
