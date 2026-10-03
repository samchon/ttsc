package linthost

import (
  "strings"
  "testing"
)

// TestFormatBlockRejectsNonBoolSortImportsOptions verifies the boolean
// sub-options of sortImports reject non-boolean values.
//
// Locks the asBool error paths for every boolean option. A non-bool value must
// be surfaced at the format-block boundary
// rather than coerced.
//
//  1. For each boolean sub-option, build sortImports with a non-bool value.
//  2. Call expandFormatBlock.
//  3. Assert an error naming the offending field.
//
// @evidence contracts/testing.md#behavioral-verification expandFormatBlock rejects caseSensitive yes, combineTypeAndValue 1, and unsafeSortRuntimeImports yes with their individual nested field names.
// @evidence contracts/testing.md#independent-expectations Each of these public sort controls is Boolean; three independently authored wrong values and field paths establish rejection independently of option expansion.
// @evidence contracts/testing.md#distinguishing-cases Owns all three Boolean sub-option error routes with string and integer counterexamples; valid true propagation is the companion case.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. Three authored malformed sort control fields call expandFormatBlock directly in the shared Go process; each named nested error is observed without sorting imports or native compilation.
func TestFormatBlockRejectsNonBoolSortImportsOptions(t *testing.T) {
  cases := []struct {
    key       string
    val       any
    wantInErr string
  }{
    {"caseSensitive", "yes", "format.sortImports.caseSensitive"},
    {"combineTypeAndValue", 1, "format.sortImports.combineTypeAndValue"},
    {"unsafeSortRuntimeImports", "yes", "format.sortImports.unsafeSortRuntimeImports"},
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
