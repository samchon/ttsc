package linthost

import (
  "strings"
  "testing"
)

// TestFormatBlockRejectsNonBoolImportOrderOptions verifies expandFormatBlock
// returns an error when the importOrderSeparation, importOrderSortSpecifiers,
// or importOrderCaseInsensitive fields are not booleans.
//
// Locks the `asBool` error paths for the three boolean sub-options of the
// `importOrder` family. Each sub-option is only evaluated when `importOrder`
// is present (it is the activation key); providing a non-bool value for any
// of them must be surfaced at the format-block boundary.
//
//  1. Call expandFormatBlock with a valid importOrder and
//     `importOrderSeparation: "yes"` (non-bool).
//  2. Assert an error naming `format.importOrderSeparation`.
//  3. Call with a valid importOrder and `importOrderSortSpecifiers: 1`.
//  4. Assert an error naming `format.importOrderSortSpecifiers`.
//  5. Call with a valid importOrder and `importOrderCaseInsensitive: "true"`.
//  6. Assert an error naming `format.importOrderCaseInsensitive`.
func TestFormatBlockRejectsNonBoolImportOrderOptions(t *testing.T) {
  base := map[string]any{
    "importOrder": []any{"^[./]"},
  }

  cases := []struct {
    key       string
    val       any
    wantInErr string
  }{
    {"importOrderSeparation", "yes", "format.importOrderSeparation"},
    {"importOrderSortSpecifiers", 1, "format.importOrderSortSpecifiers"},
    {"importOrderCaseInsensitive", "true", "format.importOrderCaseInsensitive"},
  }

  for _, tc := range cases {
    raw := map[string]any{
      "importOrder": base["importOrder"],
      tc.key:        tc.val,
    }
    _, err := expandFormatBlock(raw)
    if err == nil {
      t.Errorf("expandFormatBlock with %s=%v: expected error, got nil", tc.key, tc.val)
      continue
    }
    if !strings.Contains(err.Error(), tc.wantInErr) {
      t.Errorf("expandFormatBlock with %s=%v: want error containing %q, got %v", tc.key, tc.val, tc.wantInErr, err)
    }
  }
}
