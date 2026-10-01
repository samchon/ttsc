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
//     5. Accept empty and singleton string arrays, preserving the singleton value.
//
// @evidence contracts/testing.md#behavioral-verification asStringSlice rejects a map where a string array is required and rejects a mixed string/integer array, preserving field context and the invalid element index 1; empty and singleton arrays retain their values.
// @evidence contracts/testing.md#independent-expectations String-array config fields require the container and every element to have their declared types; the two authored malformed inputs establish independent rejection oracles.
// @evidence contracts/testing.md#distinguishing-cases Owns wrong-container and wrong-element branches, including a valid first element before the invalid second, plus accepted empty and singleton arrays with exact singleton preservation.
// @evidence contracts/testing.md#execution-ownership This discoverable Go unit passes authored map and array values directly to asStringSlice in the shared lint process, inspecting errors and returned elements without a fixture manifest, script evaluator or child process.
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
  if !strings.Contains(err.Error(), "format.importOrder[1]") {
    t.Errorf("asStringSlice element error should name the field and index, got: %v", err)
  }
  for _, input := range [][]any{{}, {"one"}} {
    got, err := asStringSlice("format.importOrder", input)
    if err != nil || len(got) != len(input) {
      t.Fatalf("valid array %v: value=%v error=%v", input, got, err)
    }
    if len(got) == 1 && got[0] != "one" {
      t.Fatalf("singleton value changed: %v", got)
    }
  }
}
