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
//  4. Require the default off severity and empty options object.
//
// @evidence contracts/testing.md#behavioral-verification expandFormatBlock includes format/sort-imports for true shorthand with an off-severity tuple and an empty options object, without requiring an explicit order.
// @evidence contracts/testing.md#independent-expectations The public true shorthand retains default check severity off and delegates sorting options to rule defaults; independently authored off and zero-option expectations distinguish correct configuration from mere output presence.
// @evidence contracts/testing.md#distinguishing-cases Owns true shorthand entry presence; false absence and explicit object payload are separately tested.
// @evidence contracts/testing.md#execution-ownership This discoverable Go unit directly expands sortImports true and observes its emitted tuple and options map in the shared lint process; actual sorter output is owned by formatting behavior tests, without adding a native producer here.
func TestFormatBlockSortImportsTrueEnablesDefaults(t *testing.T) {
  out, err := expandFormatBlock(map[string]any{"sortImports": true})
  if err != nil {
    t.Fatalf("expandFormatBlock: unexpected error: %v", err)
  }
  entry, ok := out["format/sort-imports"]
  if !ok {
    t.Fatal("format/sort-imports should be enabled by sortImports: true")
  }
  tuple, ok := entry.([]any)
  if !ok || len(tuple) != 2 || tuple[0] != "off" {
    t.Fatalf("sortImports true must retain the default severity tuple: %v", entry)
  }
  options, ok := tuple[1].(map[string]any)
  if !ok || len(options) != 0 {
    t.Fatalf("sortImports true must leave rule-side defaults intact: %v", tuple[1])
  }
}
