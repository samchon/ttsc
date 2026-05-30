package linthost

import "testing"

// TestFormatBlockJsdocFalseSkipsRule verifies that `jsDoc: false` in a format
// block does not add a `format/jsdoc` rule entry to the output map.
//
// Locks the `case bool: enabled = j` arm inside expandFormatBlock's jsDoc
// handling. When the bool value is `false`, `enabled` remains false and the
// rule is not added to the output — the field was present but explicitly
// opted out. Confusingly, the field being absent is a different code path (the
// outer `if v, ok := raw["jsDoc"]; ok && v != nil` guard); this test covers
// the bool=false arm explicitly.
//
//  1. Call expandFormatBlock with `jsDoc: false`.
//  2. Assert no error is returned.
//  3. Assert the output map does NOT contain a `format/jsdoc` entry.
func TestFormatBlockJsdocFalseSkipsRule(t *testing.T) {
  out, err := expandFormatBlock(map[string]any{"jsDoc": false})
  if err != nil {
    t.Fatalf("expandFormatBlock(jsDoc:false): unexpected error: %v", err)
  }
  if _, ok := out["format/jsdoc"]; ok {
    t.Fatal("expandFormatBlock(jsDoc:false): formatJsdoc must not be present in output")
  }
}
