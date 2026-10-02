package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoRestrictedSyntaxExposesComputedKeysAndPropertyValuePaths verifies
// selectors expose a property computed flag, key and value type.
//
// A computed key arrow property differs from the plain arrow property beside it.
//
//  1. Parse one object with a computed arrow property and one plain arrow property.
//  2. Run a selector requiring computed true, a named key expression and an
//     ArrowFunction value.
//  3. Assert only the computed property reports.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports only the authored computed key arrow property under the three nested attribute predicates.
// @evidence contracts/testing.md#independent-expectations Literal computed=true, key-expression name key and ArrowFunction value independently distinguish the computed property from plain: () => 0.
// @evidence contracts/testing.md#distinguishing-cases Computed arrow property reports; the original otherwise similar plain arrow property stays unmatched.
// @evidence contracts/testing.md#execution-ownership TestNoRestrictedSyntaxExposesComputedKeysAndPropertyValuePaths is selected in the shared Go unit population. It calls runNoRestrictedSyntax through the owning Engine, retaining every original source/selector/options/target/message and the entry ownership of its in-source variants. No installed consumer, native artifact build or real product host runs.
func TestNoRestrictedSyntaxExposesComputedKeysAndPropertyValuePaths(t *testing.T) {
  source := `const key = "answer";
const record = { [key]: () => 42, plain: () => 0 };
JSON.stringify(record);
`
  selector := `PropertyAssignment[computed=true][key.expression.name='key'][value.type='ArrowFunction']`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+selector+`"`),
    noRestrictedSyntaxExpectation{target: "[key]: () => 42", message: noRestrictedDefaultMessage(selector)},
  )
}
