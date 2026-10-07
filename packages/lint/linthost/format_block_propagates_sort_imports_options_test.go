package linthost

import (
  "encoding/json"
  "testing"
)

// TestFormatBlockPropagatesSortImportsOptions verifies the `sortImports` object
// form forwards its `order`, `caseSensitive`, `combineTypeAndValue`, and
// `unsafeSortRuntimeImports` fields into the format/sort-imports rule entry.
//
// Locks the success arms inside expandSortImportsBlock. The error-path tests
// prove validation rejects bad values; this proves valid values populate the
// emitted options blob rather than being silently dropped.
//
//  1. Build a format block with sortImports set to an object exercising all
//     four fields.
//  2. Call expandFormatBlock.
//  3. Assert no error and the rule entry carries every field verbatim.
//
// @evidence contracts/testing.md#behavioral-verification expandFormatBlock preserves the complete three-element import order and all three true Boolean sort options in its emitted tuple.
// @evidence contracts/testing.md#independent-expectations Public sort-import object options must reach the rule unchanged; exact authored order including an empty separator and literal true flags provide independent expectations.
// @evidence contracts/testing.md#distinguishing-cases Owns object form, order length and every entry, case sensitivity, type/value combination and unsafe runtime sorting; false shorthand and malformed fields execute separately.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. The authored complete sortImports object reaches expandFormatBlock and independent JSON tuple decoding in-process; exact order and flags are observed without running a sorter or building a native host.
func TestFormatBlockPropagatesSortImportsOptions(t *testing.T) {
  out, err := expandFormatBlock(map[string]any{
    "sortImports": map[string]any{
      "order":                    []any{"<TYPES>", "", "^[./]"},
      "caseSensitive":            true,
      "combineTypeAndValue":      true,
      "unsafeSortRuntimeImports": true,
    },
  })
  if err != nil {
    t.Fatalf("expandFormatBlock: unexpected error: %v", err)
  }
  entry, ok := out["format/sort-imports"]
  if !ok {
    t.Fatal("format/sort-imports not present in output")
  }
  raw, err := json.Marshal(entry)
  if err != nil {
    t.Fatalf("marshal entry: %v", err)
  }
  var tuple []json.RawMessage
  if err := json.Unmarshal(raw, &tuple); err != nil || len(tuple) < 2 {
    t.Fatalf("entry not a [severity, opts] tuple: %v", err)
  }
  var o struct {
    Order                    []string `json:"order"`
    CaseSensitive            bool     `json:"caseSensitive"`
    CombineTypeAndValue      bool     `json:"combineTypeAndValue"`
    UnsafeSortRuntimeImports bool     `json:"unsafeSortRuntimeImports"`
  }
  if err := json.Unmarshal(tuple[1], &o); err != nil {
    t.Fatalf("decode sort-imports opts: %v", err)
  }
  if len(o.Order) != 3 || o.Order[0] != "<TYPES>" || o.Order[1] != "" || o.Order[2] != "^[./]" {
    t.Errorf("order mismatch: %+v", o.Order)
  }
  if !o.CaseSensitive {
    t.Error("caseSensitive should be true")
  }
  if !o.CombineTypeAndValue {
    t.Error("combineTypeAndValue should be true")
  }
  if !o.UnsafeSortRuntimeImports {
    t.Error("unsafeSortRuntimeImports should be true")
  }
}
