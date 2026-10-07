package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoRestrictedSyntaxHasNoImplicitDenylist verifies no-restricted-syntax has
// no implicit deny policy.
//
// Without a configured selector nothing is restricted.
//
//  1. Parse source holding a with statement and a labeled statement.
//  2. Run the rule with absent options and with an empty list.
//  3. Assert both configurations report nothing.
//
// @evidence contracts/testing.md#behavioral-verification Actual Engine findings are empty for both absent options and an empty list on the original with/label source.
// @evidence contracts/testing.md#independent-expectations No user selector means no deny policy; the independently authored empty expectation does not infer restrictions from syntax names.
// @evidence contracts/testing.md#distinguishing-cases Both nil and empty-list inputs stay clean; AppliesEveryConfiguredEntryAndCustomMessage runs the same forbidden-policy source with selectors enabled.
// @evidence contracts/testing.md#execution-ownership TestNoRestrictedSyntaxHasNoImplicitDenylist is selected in the shared Go unit population. It calls runNoRestrictedSyntax through the owning Engine, retaining every original source/selector/options/target/message and the entry ownership of its in-source variants. No installed consumer, native artifact build or real product host runs.
func TestNoRestrictedSyntaxHasNoImplicitDenylist(t *testing.T) {
  source := `function legacy(target: any): void {
  with (target) { target.value = 1; }
  outer: for (;;) { break outer; }
}
`
  runNoRestrictedSyntax(t, source, nil)
  runNoRestrictedSyntax(t, source, json.RawMessage(`[]`))
}
