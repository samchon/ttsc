package linthost

import (
  "encoding/json"
  "testing"
)

//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original if under nested-path type(object) and stays clean for type(undefined).
// @evidence contracts/testing.md#independent-expectations The selector safe-path contract retains an existing null alternate through deeper traversal; JavaScript typeof null is object, independently differing from an absent undefined value.
// @evidence contracts/testing.md#distinguishing-cases Same null alternate matches object and not undefined; both selectors retain identical source and full target range.
// @evidence contracts/testing.md#execution-ownership TestNoRestrictedSyntaxPreservesNullAcrossNestedPaths is selected in the shared Go unit population. It calls runNoRestrictedSyntax through the owning Engine, retaining every original source/selector/options/target/message and the entry ownership of its in-source variants. No installed consumer, native artifact build or real product host runs.
func TestNoRestrictedSyntaxPreservesNullAcrossNestedPaths(t *testing.T) {
  source := `declare const flag: boolean;
if (flag) { void flag; }
`
  selector := `IfStatement[alternate.missing=type(object)]`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+selector+`"`),
    noRestrictedSyntaxExpectation{target: "if (flag) { void flag; }", message: noRestrictedDefaultMessage(selector)},
  )
  runNoRestrictedSyntax(t, source, json.RawMessage(`"IfStatement[alternate.missing=type(undefined)]"`))
}
