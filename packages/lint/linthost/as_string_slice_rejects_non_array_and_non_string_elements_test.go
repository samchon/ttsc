package linthost

import (
  "strings"
  "testing"
)

// TestAsStringSliceRejectsNonArrayAndNonStringElements verifies rejection
// of a map and a string/integer array, plus empty/singleton acceptance.
//
// The mixed input requires an error naming index 1 after its valid first
// element. The literal one must survive the singleton conversion. These
// direct helper inputs use format.importOrder as an authored diagnostic
// label, not as a claim that it is a supported config property.
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
