package linthost

import "testing"

// TestFormatBlockJsdocFalseSkipsRule verifies that `jsDoc: false` in a format
// block does not add a `format/jsdoc` rule entry to the output map.
//
// Locks the `case bool: jdEnabled = j` arm inside expandFormatBlock's jsDoc
// handling. format/jsdoc is on by default, so `jsDoc: false` is the explicit
// opt-out: jdEnabled becomes false and the rule is left out of the output. A
// missing key keeps the default (on), which is a different code path; this test
// covers the bool=false opt-out explicitly.
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
