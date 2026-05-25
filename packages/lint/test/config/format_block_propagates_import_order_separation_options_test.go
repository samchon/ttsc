package linthost

import (
  "encoding/json"
  "testing"
)

// TestFormatBlockPropagatesImportOrderSeparationOptions verifies that
// importOrderSeparation, importOrderSortSpecifiers, and importOrderCaseInsensitive
// boolean options are accepted and forwarded to the formatSortImports rule entry
// when provided alongside a valid importOrder array.
//
// Locks the success arms (`siOpts["importOrderSeparation"] = b` et al.) inside
// expandFormatBlock. The existing error-path tests prove the validation rejects
// non-bool values; this test proves that valid bool values DO populate the
// output map rather than being silently dropped.
//
//  1. Build a format block with importOrder and all three boolean sub-options set.
//  2. Call expandFormatBlock.
//  3. Assert no error.
//  4. Assert formatSortImports options contain all three boolean sub-options.
func TestFormatBlockPropagatesImportOrderSeparationOptions(t *testing.T) {
  out, err := expandFormatBlock(map[string]any{
    "importOrder":                []any{"^[./]"},
    "importOrderSeparation":      true,
    "importOrderSortSpecifiers":  false,
    "importOrderCaseInsensitive": true,
  })
  if err != nil {
    t.Fatalf("expandFormatBlock: unexpected error: %v", err)
  }

  entry, ok := out["formatSortImports"]
  if !ok {
    t.Fatal("formatSortImports not present in output")
  }
  raw, err := json.Marshal(entry)
  if err != nil {
    t.Fatalf("marshal entry: %v", err)
  }

  type opts struct {
    ImportOrderSeparation      bool `json:"importOrderSeparation"`
    ImportOrderSortSpecifiers  bool `json:"importOrderSortSpecifiers"`
    ImportOrderCaseInsensitive bool `json:"importOrderCaseInsensitive"`
  }
  // The entry is []any{"off", {options}}.
  var tuple []json.RawMessage
  if err := json.Unmarshal(raw, &tuple); err != nil || len(tuple) < 2 {
    t.Fatalf("entry not a [severity, opts] tuple: %v", err)
  }
  var o opts
  if err := json.Unmarshal(tuple[1], &o); err != nil {
    t.Fatalf("decode sort-imports opts: %v", err)
  }
  if !o.ImportOrderSeparation {
    t.Error("importOrderSeparation should be true")
  }
  if o.ImportOrderSortSpecifiers {
    t.Error("importOrderSortSpecifiers should be false")
  }
  if !o.ImportOrderCaseInsensitive {
    t.Error("importOrderCaseInsensitive should be true")
  }
}
