package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoRestrictedSyntaxDistinguishesRestAndSpreadAliases verifies selectors
// keep binding rest and value spread aliases distinct.
//
// A rest parameter and runtime spreads have different roles and ESTree aliases.
//
//  1. Parse a typed rest parameter with array and object spreads.
//  2. Run RestElement, SpreadElement and Property selectors with argument-name
//     constraints.
//  3. Assert each form reports only under its own alias and spreads never match
//     Property.
//
// @evidence contracts/testing.md#behavioral-verification Engine compares the original typed rest parameter and both runtime spread ranges while keeping Property unmatched.
// @evidence contracts/testing.md#independent-expectations Binding rest and value spread have independently distinct ESTree aliases; explicit argument-name and target snippets identify their different roles.
// @evidence contracts/testing.md#distinguishing-cases Rest parameter with and without argument-name constraint reports only items; array/object spreads report values/record; spreads do not become Property aliases.
// @evidence contracts/testing.md#execution-ownership TestNoRestrictedSyntaxDistinguishesRestAndSpreadAliases is selected in the shared Go unit population. It calls runNoRestrictedSyntax through the owning Engine, retaining every original source/selector/options/target/message and the entry ownership of its in-source variants. No installed consumer, native artifact build or real product host runs.
func TestNoRestrictedSyntaxDistinguishesRestAndSpreadAliases(t *testing.T) {
  source := `declare const record: Record<string, number>;
function collect(...items: number[]): number[] { const values = items; return [...values]; }
const clone = { ...record };
JSON.stringify([collect, clone]);
`
  restSelector := `RestElement`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+restSelector+`"`),
    noRestrictedSyntaxExpectation{target: "...items: number[]", message: noRestrictedDefaultMessage(restSelector)},
  )

  restArgumentSelector := `RestElement[argument.name='items']`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+restArgumentSelector+`"`),
    noRestrictedSyntaxExpectation{target: "...items: number[]", message: noRestrictedDefaultMessage(restArgumentSelector)},
  )

  spreadSelector := `SpreadElement`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+spreadSelector+`"`),
    noRestrictedSyntaxExpectation{target: "...values", message: noRestrictedDefaultMessage(spreadSelector)},
    noRestrictedSyntaxExpectation{target: "...record", message: noRestrictedDefaultMessage(spreadSelector)},
  )
  runNoRestrictedSyntax(t, source, json.RawMessage(`"Property"`))
}
