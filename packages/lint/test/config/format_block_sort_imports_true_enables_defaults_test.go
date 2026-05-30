package linthost

import "testing"

// TestFormatBlockSortImportsTrueEnablesDefaults verifies `sortImports: true`
// enables the rule with an empty options blob (rule-side defaults apply).
//
// The boolean shorthand is the zero-config on switch; it must register the
// rule without forcing the user to spell out an `order` array.
//
//  1. Build a format block with sortImports set to the boolean true.
//  2. Call expandFormatBlock.
//  3. Assert the rule entry is present.
func TestFormatBlockSortImportsTrueEnablesDefaults(t *testing.T) {
  out, err := expandFormatBlock(map[string]any{"sortImports": true})
  if err != nil {
    t.Fatalf("expandFormatBlock: unexpected error: %v", err)
  }
  if _, ok := out["format/sort-imports"]; !ok {
    t.Fatal("format/sort-imports should be enabled by sortImports: true")
  }
}
