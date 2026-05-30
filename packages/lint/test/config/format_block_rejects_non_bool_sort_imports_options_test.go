package linthost

import (
  "strings"
  "testing"
)

// TestFormatBlockRejectsNonBoolSortImportsOptions verifies the boolean
// sub-options of sortImports reject non-boolean values.
//
// Locks the asBool error paths for caseSensitive and combineTypeAndValue. A
// non-bool value for either must be surfaced at the format-block boundary
// rather than coerced.
//
//  1. For each boolean sub-option, build sortImports with a non-bool value.
//  2. Call expandFormatBlock.
//  3. Assert an error naming the offending field.
func TestFormatBlockRejectsNonBoolSortImportsOptions(t *testing.T) {
  cases := []struct {
    key       string
    val       any
    wantInErr string
  }{
    {"caseSensitive", "yes", "format.sortImports.caseSensitive"},
    {"combineTypeAndValue", 1, "format.sortImports.combineTypeAndValue"},
  }
  for _, tc := range cases {
    _, err := expandFormatBlock(map[string]any{
      "sortImports": map[string]any{tc.key: tc.val},
    })
    if err == nil {
      t.Errorf("sortImports.%s=%v: expected error, got nil", tc.key, tc.val)
      continue
    }
    if !strings.Contains(err.Error(), tc.wantInErr) {
      t.Errorf("sortImports.%s=%v: want error containing %q, got %v", tc.key, tc.val, tc.wantInErr, err)
    }
  }
}
