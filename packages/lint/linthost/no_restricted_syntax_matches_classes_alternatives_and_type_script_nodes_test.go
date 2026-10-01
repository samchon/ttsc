package linthost

import (
  "encoding/json"
  "testing"
)

//
// @evidence contracts/testing.md#behavioral-verification Engine compares both TS assertion/satisfies alternative ranges, the return-bearing function class and true/null Literal expression ranges.
// @evidence contracts/testing.md#independent-expectations Authored AST forms independently satisfy alternatives and function/expression class aliases; fixed source snippets specify complete matches.
// @evidence contracts/testing.md#distinguishing-cases As and satisfies alternatives both report; case-insensitive FUNCTION with return selects only the function, and Literal:expression selects true/null rather than unrelated typed declarations.
// @evidence contracts/testing.md#execution-ownership TestNoRestrictedSyntaxMatchesClassesAlternativesAndTypeScriptNodes is selected in the shared Go unit population. It calls runNoRestrictedSyntax through the owning Engine, retaining every original source/selector/options/target/message and the entry ownership of its in-source variants. No installed consumer, native artifact build or real product host runs.
func TestNoRestrictedSyntaxMatchesClassesAlternativesAndTypeScriptNodes(t *testing.T) {
  source := `type Text = string;
declare const input: unknown;
const asserted = input as Text;
const satisfied = input satisfies unknown;
function returns(): unknown { return asserted; }
JSON.stringify([satisfied, returns]);
`
  selector := `:matches(TSAsExpression, TSSatisfiesExpression)`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+selector+`"`),
    noRestrictedSyntaxExpectation{target: "input as Text", message: noRestrictedDefaultMessage(selector)},
    noRestrictedSyntaxExpectation{target: "input satisfies unknown", message: noRestrictedDefaultMessage(selector)},
  )

  classSelector := `:FUNCTION:has(ReturnStatement)`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+classSelector+`"`),
    noRestrictedSyntaxExpectation{target: "function returns(): unknown { return asserted; }", message: noRestrictedDefaultMessage(classSelector)},
  )

  literalSource := `const values = [true, null];
void values;
`
  expressionSelector := `Literal:expression`
  runNoRestrictedSyntax(
    t,
    literalSource,
    json.RawMessage(`"`+expressionSelector+`"`),
    noRestrictedSyntaxExpectation{target: "true", message: noRestrictedDefaultMessage(expressionSelector)},
    noRestrictedSyntaxExpectation{target: "null", message: noRestrictedDefaultMessage(expressionSelector)},
  )
}
