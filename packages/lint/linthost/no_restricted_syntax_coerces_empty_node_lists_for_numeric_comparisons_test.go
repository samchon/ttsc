package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoRestrictedSyntaxCoercesEmptyNodeListsForNumericComparisons verifies an
// empty node list coerces to zero in numeric selector comparisons.
//
// Under JavaScript comparison semantics an empty argument list is 0.
//
//  1. Parse a call with no arguments.
//  2. Run selectors comparing the arguments length against one and zero.
//  3. Assert arguments < 1 reports and arguments > 0 reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports empty() for arguments < 1 and reports nothing for arguments > 0 on the same source.
// @evidence contracts/testing.md#independent-expectations Under the supported JavaScript-style comparison contract an empty argument list coerces to zero; fixed selector inequalities independently distinguish the results.
// @evidence contracts/testing.md#distinguishing-cases Zero arguments matches less-than-one and fails greater-than-zero, preserving the explicit comparison counterpart.
// @evidence contracts/testing.md#execution-ownership TestNoRestrictedSyntaxCoercesEmptyNodeListsForNumericComparisons is selected in the shared Go unit population. It calls runNoRestrictedSyntax through the owning Engine, retaining every original source/selector/options/target/message and the entry ownership of its in-source variants. No installed consumer, native artifact build or real product host runs.
func TestNoRestrictedSyntaxCoercesEmptyNodeListsForNumericComparisons(t *testing.T) {
  source := `const empty = (): void => {};
empty();
`
  selector := `CallExpression[arguments<1]`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+selector+`"`),
    noRestrictedSyntaxExpectation{target: "empty()", message: noRestrictedDefaultMessage(selector)},
  )
  runNoRestrictedSyntax(t, source, json.RawMessage(`"CallExpression[arguments>0]"`))
}
