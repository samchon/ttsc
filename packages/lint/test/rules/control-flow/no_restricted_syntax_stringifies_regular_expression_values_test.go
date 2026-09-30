package linthost

import (
  "encoding/json"
  "testing"
)

//
// @evidence contracts/testing.md#behavioral-verification Engine compares the exact /danger/mi literal range under normalized value, raw text and object-type attributes, with a mismatched normalized-value control remaining clean.
// @evidence contracts/testing.md#independent-expectations RegExp value stringification orders flags as im while source raw text retains mi; fixed authored strings independently define these separate attributes.
// @evidence contracts/testing.md#distinguishing-cases Matching normalized value/raw/type conjunction reports; swapped normalized-value spelling does not match.
// @evidence contracts/testing.md#execution-ownership TestNoRestrictedSyntaxStringifiesRegularExpressionValues is selected in the shared Go unit population. It calls runNoRestrictedSyntax through the owning Engine, retaining every original source/selector/options/target/message and the entry ownership of its in-source variants. No installed consumer, native artifact build or real product host runs.
func TestNoRestrictedSyntaxStringifiesRegularExpressionValues(t *testing.T) {
  source := `const pattern = /danger/mi;
void pattern;
`
  selector := `RegularExpressionLiteral[value='/danger/im'][raw='/danger/mi'][value=type(object)]`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+selector+`"`),
    noRestrictedSyntaxExpectation{target: "/danger/mi", message: noRestrictedDefaultMessage(selector)},
  )

  runNoRestrictedSyntax(t, source, json.RawMessage(`"RegularExpressionLiteral[value='/danger/mi']"`))
}
