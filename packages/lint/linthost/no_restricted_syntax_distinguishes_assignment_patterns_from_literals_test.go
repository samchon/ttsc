package linthost

import (
  "encoding/json"
  "testing"
)

//
// @evidence contracts/testing.md#behavioral-verification Engine compares assignment array/object rest, value array/object spread and the outer assignment-pattern range with an internal-assignment negative.
// @evidence contracts/testing.md#independent-expectations Destructuring assignment contexts independently establish Pattern aliases, while authored literals establish Expression aliases; default entries do not become ordinary nested AssignmentExpression nodes.
// @evidence contracts/testing.md#distinguishing-cases Both pattern-rest and value-spread forms retain distinct exact matches; inner assignment selector remains empty and the outer assignment selects the full array pattern.
// @evidence contracts/testing.md#execution-ownership TestNoRestrictedSyntaxDistinguishesAssignmentPatternsFromLiterals is selected in the shared Go unit population. It calls runNoRestrictedSyntax through the owning Engine, retaining every original source/selector/options/target/message and the entry ownership of its in-source variants. No installed consumer, native artifact build or real product host runs.
func TestNoRestrictedSyntaxDistinguishesAssignmentPatternsFromLiterals(t *testing.T) {
  source := `let first = 0;
let assignedRest: number[] = [];
const rest: number[] = [];
let value = 0;
let assignedOthers: Record<string, number> = {};
const others: Record<string, number> = {};
[first = 1, ...assignedRest] = [1, 2];
({ value, ...assignedOthers } = { value: 1 });
const array = [...rest];
const object = { ...others };
JSON.stringify([first, value, array, object]);
`
  arrayPatternSelector := `ArrayPattern > RestElement`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+arrayPatternSelector+`"`),
    noRestrictedSyntaxExpectation{target: "...assignedRest", message: noRestrictedDefaultMessage(arrayPatternSelector)},
  )

  objectPatternSelector := `ObjectPattern > RestElement`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+objectPatternSelector+`"`),
    noRestrictedSyntaxExpectation{target: "...assignedOthers", message: noRestrictedDefaultMessage(objectPatternSelector)},
  )

  arrayExpressionSelector := `ArrayExpression > SpreadElement`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+arrayExpressionSelector+`"`),
    noRestrictedSyntaxExpectation{target: "...rest", message: noRestrictedDefaultMessage(arrayExpressionSelector)},
  )

  objectExpressionSelector := `ObjectExpression > SpreadElement`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+objectExpressionSelector+`"`),
    noRestrictedSyntaxExpectation{target: "...others", message: noRestrictedDefaultMessage(objectExpressionSelector)},
  )

  runNoRestrictedSyntax(t, source, json.RawMessage(`"ArrayPattern AssignmentExpression"`))
  outerAssignmentSelector := `AssignmentExpression > ArrayPattern`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+outerAssignmentSelector+`"`),
    noRestrictedSyntaxExpectation{
      target:  "[first = 1, ...assignedRest]",
      message: noRestrictedDefaultMessage(outerAssignmentSelector),
    },
  )
}
