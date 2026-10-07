package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoRestrictedSyntaxExposesSwitchCaseTestAndConsequent verifies selectors
// expose a switch case test and consequent.
//
// A tested case and the default clause differ in test presence and consequent
// length.
//
//  1. Parse a switch with a two-statement case one and a one-statement default.
//  2. Run a selector requiring test value one and consequent length two.
//  3. Assert only the case-one clause reports.
//
// @evidence contracts/testing.md#behavioral-verification Engine compares the exact original case-one clause under test value one and consequent length two.
// @evidence contracts/testing.md#independent-expectations The authored clause has assignment plus break and numeric test one; the default clause has no test and only one consequent statement.
// @evidence contracts/testing.md#distinguishing-cases Two-statement tested case reports; the original default clause remains unmatched by the same conjunction.
// @evidence contracts/testing.md#execution-ownership TestNoRestrictedSyntaxExposesSwitchCaseTestAndConsequent is selected in the shared Go unit population. It calls runNoRestrictedSyntax through the owning Engine, retaining every original source/selector/options/target/message and the entry ownership of its in-source variants. No installed consumer, native artifact build or real product host runs.
func TestNoRestrictedSyntaxExposesSwitchCaseTestAndConsequent(t *testing.T) {
  source := `let output = 0;
switch (output) {
  case 1: output = 1; break;
  default: break;
}
`
  selector := `CaseClause[test.value=1][consequent.length=2]`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+selector+`"`),
    noRestrictedSyntaxExpectation{target: "case 1: output = 1; break;", message: noRestrictedDefaultMessage(selector)},
  )
}
