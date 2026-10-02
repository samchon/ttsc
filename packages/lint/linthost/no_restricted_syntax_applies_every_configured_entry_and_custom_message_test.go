package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoRestrictedSyntaxAppliesEveryConfiguredEntryAndCustomMessage verifies
// no-restricted-syntax applies every configured entry and its custom message.
//
// String and structured selector entries are independent policy entries.
//
//  1. Configure a string selector and a structured entry with a custom message.
//  2. Run the rule over source holding a with statement and a labeled statement.
//  3. Assert both complete ranges report at error severity, one with the default
//     message template and one with the custom label message, and no edits.
//
// @evidence contracts/testing.md#behavioral-verification Engine compares both complete with/label ranges, rule/error severity, default with message and authored custom label message with no edits.
// @evidence contracts/testing.md#independent-expectations Literal selected AST kinds independently identify the two statements; the fixed custom message and supported default message template supply separate oracles.
// @evidence contracts/testing.md#distinguishing-cases String and structured selector entries both report; HasNoImplicitDenylist owns the exact-source empty-policy counterpart.
// @evidence contracts/testing.md#execution-ownership TestNoRestrictedSyntaxAppliesEveryConfiguredEntryAndCustomMessage is selected in the shared Go unit population. It calls runNoRestrictedSyntax through the owning Engine, retaining every original source/selector/options/target/message and the entry ownership of its in-source variants. No installed consumer, native artifact build or real product host runs.
func TestNoRestrictedSyntaxAppliesEveryConfiguredEntryAndCustomMessage(t *testing.T) {
  source := `function legacy(target: any): void {
  with (target) { target.value = 1; }
  outer: for (;;) { break outer; }
}
`
  options := json.RawMessage(`[
    "WithStatement",
    {"selector":"LabeledStatement","message":"Labels obscure control flow."}
  ]`)
  runNoRestrictedSyntax(
    t,
    source,
    options,
    noRestrictedSyntaxExpectation{
      target:  `with (target) { target.value = 1; }`,
      message: noRestrictedDefaultMessage("WithStatement"),
    },
    noRestrictedSyntaxExpectation{
      target:  `outer: for (;;) { break outer; }`,
      message: "Labels obscure control flow.",
    },
  )
}
