package linthost

import "testing"

// TestFormatBlockSortImportsFalseKeepsRuleOff verifies `sortImports: false`
// leaves the rule absent from the expanded configuration.
//
// The rule is opt-in; the explicit boolean false must behave the same as
// omitting the key, never emitting a no-op rule entry.
//
//  1. Build a format block with sortImports set to the boolean false.
//  2. Call expandFormatBlock.
//  3. Assert the rule entry is absent.
//
// @evidence contracts/testing.md#behavioral-verification expandFormatBlock omits format/sort-imports for explicit sortImports false.
// @evidence contracts/testing.md#independent-expectations The false shorthand opts out of import sorting; output absence independently establishes that it was not configured.
// @evidence contracts/testing.md#distinguishing-cases Owns explicit false; true shorthand and object customization are positive counterparts.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. An authored sortImports false object calls expandFormatBlock directly in-process; emitted rule absence observes opt-out without running source sorting or building a native host.
func TestFormatBlockSortImportsFalseKeepsRuleOff(t *testing.T) {
  out, err := expandFormatBlock(map[string]any{"sortImports": false})
  if err != nil {
    t.Fatalf("expandFormatBlock: unexpected error: %v", err)
  }
  if _, ok := out["format/sort-imports"]; ok {
    t.Fatal("format/sort-imports should stay off under sortImports: false")
  }
}
