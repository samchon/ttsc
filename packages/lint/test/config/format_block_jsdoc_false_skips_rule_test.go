package linthost

import "testing"

// TestFormatBlockJsdocFalseSkipsRule verifies that `jsdoc: false` in a format
// block does not add a `formatJsdoc` rule entry to the output map.
//
// Locks the `case bool: enabled = j` arm inside expandFormatBlock's jsdoc
// handling. When the bool value is `false`, `enabled` remains false and the
// rule is not added to the output — the field was present but explicitly
// opted out. Confusingly, the field being absent is a different code path (the
// outer `if v, ok := raw["jsdoc"]; ok && v != nil` guard); this test covers
// the bool=false arm explicitly.
//
//  1. Call expandFormatBlock with `jsdoc: false`.
//  2. Assert no error is returned.
//  3. Assert the output map does NOT contain a `formatJsdoc` entry.
func TestFormatBlockJsdocFalseSkipsRule(t *testing.T) {
  out, err := expandFormatBlock(map[string]any{"jsdoc": false})
  if err != nil {
    t.Fatalf("expandFormatBlock(jsdoc:false): unexpected error: %v", err)
  }
  if _, ok := out["formatJsdoc"]; ok {
    t.Fatal("expandFormatBlock(jsdoc:false): formatJsdoc must not be present in output")
  }
}
