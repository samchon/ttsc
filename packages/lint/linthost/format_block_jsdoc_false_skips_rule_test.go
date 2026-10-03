package linthost

import "testing"

// TestFormatBlockJsdocFalseSkipsRule verifies that `jsDoc: false` in a format
// block does not add a `format/jsdoc` rule entry to the output map.
//
// Locks the `case bool: jdEnabled = j` arm inside expandFormatBlock's jsDoc
// handling. format/jsdoc is on by default, so `jsDoc: false` is the explicit
// opt-out: jdEnabled becomes false and the rule is left out of the output. A
// missing key keeps the default (on), which is checked as the distinguishing
// positive control before the bool=false opt-out.
//
//  1. Expand an empty block and require the default JSDoc entry.
//  2. Call expandFormatBlock with `jsDoc: false` without error.
//  3. Assert the output map does NOT contain a `format/jsdoc` entry.
//
// @evidence contracts/testing.md#behavioral-verification expandFormatBlock omits the format/jsdoc entry when jsDoc is explicitly false.
// @evidence contracts/testing.md#independent-expectations The public false opt-out disables JSDoc formatting; literal absence of the known output rule is independent of the implementation branch.
// @evidence contracts/testing.md#distinguishing-cases Owns explicit false versus default-enabled formatter expansion; object customization is exercised by sortTags propagation.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry directly expands an authored empty block and jsDoc false object in-process; entry presence and absence observe default enablement and opt-out without JSDoc source formatting or a native host.
func TestFormatBlockJsdocFalseSkipsRule(t *testing.T) {
  defaults, err := expandFormatBlock(map[string]any{})
  if err != nil {
    t.Fatalf("expandFormatBlock(defaults): unexpected error: %v", err)
  }
  if _, ok := defaults["format/jsdoc"]; !ok {
    t.Fatal("expandFormatBlock(defaults): format/jsdoc must be present")
  }
  out, err := expandFormatBlock(map[string]any{"jsDoc": false})
  if err != nil {
    t.Fatalf("expandFormatBlock(jsDoc:false): unexpected error: %v", err)
  }
  if _, ok := out["format/jsdoc"]; ok {
    t.Fatal("expandFormatBlock(jsDoc:false): formatJsdoc must not be present in output")
  }
}
