package linthost

import (
  "encoding/json"
  "testing"
)

//
// @evidence contracts/testing.md#behavioral-verification Engine compares debugger then with ranges and canonical messages despite reverse selector configuration order.
// @evidence contracts/testing.md#independent-expectations Authored source order independently precedes option enumeration; the literal target sequence detects configuration-order output.
// @evidence contracts/testing.md#distinguishing-cases Two different selected statement kinds report in file order, not configured order; the all-entry case owns custom messages.
// @evidence contracts/testing.md#execution-ownership TestNoRestrictedSyntaxReportsMatchesInSourceOrder is selected in the shared Go unit population. It calls runNoRestrictedSyntax through the owning Engine, retaining every original source/selector/options/target/message and the entry ownership of its in-source variants. No installed consumer, native artifact build or real product host runs.
func TestNoRestrictedSyntaxReportsMatchesInSourceOrder(t *testing.T) {
  source := `debugger;
with ({ value: 1 }) { void value; }
`
  options := json.RawMessage(`["WithStatement","DebuggerStatement"]`)
  runNoRestrictedSyntax(
    t,
    source,
    options,
    noRestrictedSyntaxExpectation{target: "debugger;", message: noRestrictedDefaultMessage("DebuggerStatement")},
    noRestrictedSyntaxExpectation{
      target:  "with ({ value: 1 }) { void value; }",
      message: noRestrictedDefaultMessage("WithStatement"),
    },
  )
}
