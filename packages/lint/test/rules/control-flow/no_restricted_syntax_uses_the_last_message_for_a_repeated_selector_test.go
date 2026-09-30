package linthost

import (
  "encoding/json"
  "testing"
)

//
// @evidence contracts/testing.md#behavioral-verification Engine requires one debugger finding carrying exactly Final message rather than duplicate findings or superseded/default text.
// @evidence contracts/testing.md#independent-expectations The authored ordered entries establish the last-selector-message precedence contract independently of dispatch output.
// @evidence contracts/testing.md#distinguishing-cases Structured/string/structured entries for the same selector collapse to the final message; field-uniqueness and duplicate-validation tests own option-identity boundaries.
// @evidence contracts/testing.md#execution-ownership TestNoRestrictedSyntaxUsesTheLastMessageForARepeatedSelector is selected in the shared Go unit population. It calls runNoRestrictedSyntax through the owning Engine, retaining every original source/selector/options/target/message and the entry ownership of its in-source variants. No installed consumer, native artifact build or real product host runs.
func TestNoRestrictedSyntaxUsesTheLastMessageForARepeatedSelector(t *testing.T) {
  source := `debugger;
`
  options := json.RawMessage(`[
    {"selector":"DebuggerStatement","message":"Superseded message."},
    "DebuggerStatement",
    {"selector":"DebuggerStatement","message":"Final message."}
  ]`)
  runNoRestrictedSyntax(
    t,
    source,
    options,
    noRestrictedSyntaxExpectation{target: "debugger;", message: "Final message."},
  )
}
