package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoRestrictedSyntaxMatchesAttributesNestedPathsRegexTypesAndLengths
// verifies attribute selectors combine nested paths, case-insensitive regex,
// type, length and operator predicates.
//
// Compound predicates must select the intended call and expression and exclude
// look-alike nodes.
//
//  1. Parse a DANGER call, a JSON.stringify call and an in expression.
//  2. Run compound selectors over callee regex and type, arguments length and
//     operator.
//  3. Assert the DANGER call and the in expression report with their messages and
//     the other nodes do not.
//
// @evidence contracts/testing.md#behavioral-verification Engine compares the original DANGER call and in expression ranges/messages under independent compound selectors.
// @evidence contracts/testing.md#independent-expectations Authored case-insensitive regex, string type, argument length and operator literal predicates independently select the call and binary expression, excluding other original nodes.
// @evidence contracts/testing.md#distinguishing-cases Nested callee regex/type and length conjunction select DANGER but not JSON.stringify; the in operator selects only the original membership expression.
// @evidence contracts/testing.md#execution-ownership TestNoRestrictedSyntaxMatchesAttributesNestedPathsRegexTypesAndLengths is selected in the shared Go unit population. It calls runNoRestrictedSyntax through the owning Engine, retaining every original source/selector/options/target/message and the entry ownership of its in-source variants. No installed consumer, native artifact build or real product host runs.
func TestNoRestrictedSyntaxMatchesAttributesNestedPathsRegexTypesAndLengths(t *testing.T) {
  source := `declare function DANGER(first: number, second: number): void;
const target = { key: true };
const present = "key" in target;
DANGER(1, 2);
JSON.stringify(present);
`
  selector := `CallExpression[callee.name=/^danger$/iu][callee.name=type(string)][arguments.length>=2]`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`{"selector":"`+selector+`","message":"Dangerous call."}`),
    noRestrictedSyntaxExpectation{target: "DANGER(1, 2)", message: "Dangerous call."},
  )

  binarySelector := `BinaryExpression[operator='in']`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+binarySelector+`"`),
    noRestrictedSyntaxExpectation{target: `"key" in target`, message: noRestrictedDefaultMessage(binarySelector)},
  )
}
