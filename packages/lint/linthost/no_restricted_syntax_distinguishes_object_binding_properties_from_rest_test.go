package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoRestrictedSyntaxDistinguishesObjectBindingPropertiesFromRest verifies
// selectors tell a named object binding property from a rest element.
//
// A renamed binding has key and value identity while ...remaining is a rest
// binding without a Property key.
//
//  1. Parse an object binding with a named property and a rest element.
//  2. Run Property and RestElement selectors, one demanding the remaining key.
//  3. Assert the named property and the rest element report their exact ranges and
//     the rest never matches Property.
//
// @evidence contracts/testing.md#behavioral-verification Engine compares the named binding Property and remaining RestElement while rejecting a false Property key remaining.
// @evidence contracts/testing.md#independent-expectations An authored object binding source: local has key/value identity; ...remaining is rest binding without a named Property key.
// @evidence contracts/testing.md#distinguishing-cases Key/value-constrained named binding reports; rest-as-Property remains clean and rest-by-argument reports its exact range.
// @evidence contracts/testing.md#execution-ownership TestNoRestrictedSyntaxDistinguishesObjectBindingPropertiesFromRest is selected in the shared Go unit population. It calls runNoRestrictedSyntax through the owning Engine, retaining every original source/selector/options/target/message and the entry ownership of its in-source variants. No installed consumer, native artifact build or real product host runs.
func TestNoRestrictedSyntaxDistinguishesObjectBindingPropertiesFromRest(t *testing.T) {
  source := `declare const record: { source: number; extra: number };
const { source: local, ...remaining } = record;
JSON.stringify([local, remaining]);
`
  propertySelector := `ObjectPattern > Property[key.name='source'][value.name='local']`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+propertySelector+`"`),
    noRestrictedSyntaxExpectation{target: "source: local", message: noRestrictedDefaultMessage(propertySelector)},
  )
  runNoRestrictedSyntax(t, source, json.RawMessage(`"ObjectPattern > Property[key.name='remaining']"`))

  restSelector := `ObjectPattern > RestElement[argument.name='remaining']`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+restSelector+`"`),
    noRestrictedSyntaxExpectation{target: "...remaining", message: noRestrictedDefaultMessage(restSelector)},
  )
}
