package linthost

import "testing"

// TestFormatBlockSortImportsFalseKeepsRuleOff verifies `sortImports: false`
// leaves the rule unregistered.
//
// The rule is opt-in; the explicit boolean false must behave the same as
// omitting the key, never emitting a no-op rule entry.
//
//  1. Build a format block with sortImports set to the boolean false.
//  2. Call expandFormatBlock.
//  3. Assert the rule entry is absent.
func TestFormatBlockSortImportsFalseKeepsRuleOff(t *testing.T) {
  out, err := expandFormatBlock(map[string]any{"sortImports": false})
  if err != nil {
    t.Fatalf("expandFormatBlock: unexpected error: %v", err)
  }
  if _, ok := out["format/sort-imports"]; ok {
    t.Fatal("format/sort-imports should stay off under sortImports: false")
  }
}
