package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

//
// @evidence contracts/testing.md#behavioral-verification Engine compares every original field/descendant/has/not/subject/adjacent/general-sibling/position target and retains the first-child callee negative.
// @evidence contracts/testing.md#independent-expectations Authored declaration/argument/member orders independently define child fields and sibling positions; marking a selector subject changes which range is reported rather than matching output text.
// @evidence contracts/testing.md#distinguishing-cases Function id/argument and subject parent, variable siblings, call argument siblings and class method siblings report; a callee not owned by the argument child list stays unmatched.
// @evidence contracts/testing.md#execution-ownership TestNoRestrictedSyntaxMatchesCombinatorsFieldsPseudosAndSubjects is selected in the shared Go unit population. It calls runNoRestrictedSyntax through the owning Engine, retaining every original source/selector/options/target/message and the entry ownership of its in-source variants. No installed consumer, native artifact build or real product host runs.
func TestNoRestrictedSyntaxMatchesCombinatorsFieldsPseudosAndSubjects(t *testing.T) {
  functionSource := `function selected(value: number): number {
  return arguments.length;
}
`
  fieldSelector := `FunctionDeclaration > Identifier.id`
  runNoRestrictedSyntax(
    t,
    functionSource,
    json.RawMessage(`"`+fieldSelector+`"`),
    noRestrictedSyntaxExpectation{target: "selected", message: noRestrictedDefaultMessage(fieldSelector)},
  )

  descendantSelector := `FunctionDeclaration ReturnStatement > PropertyAccessExpression.argument`
  runNoRestrictedSyntax(
    t,
    functionSource,
    json.RawMessage(`"`+descendantSelector+`"`),
    noRestrictedSyntaxExpectation{target: "arguments.length", message: noRestrictedDefaultMessage(descendantSelector)},
  )

  hasSelector := `FunctionDeclaration:has(> Identifier.id):not([async=true])`
  runNoRestrictedSyntax(
    t,
    functionSource,
    json.RawMessage(`"`+hasSelector+`"`),
    noRestrictedSyntaxExpectation{target: strings.TrimSpace(functionSource), message: noRestrictedDefaultMessage(hasSelector)},
  )

  subjectSelector := `!FunctionDeclaration > Identifier.id`
  runNoRestrictedSyntax(
    t,
    functionSource,
    json.RawMessage(`"`+subjectSelector+`"`),
    noRestrictedSyntaxExpectation{target: strings.TrimSpace(functionSource), message: noRestrictedDefaultMessage(subjectSelector)},
  )

  siblingSource := `const first = 1, second = 2, third = 3;
JSON.stringify([first, second, third]);
`
  adjacentSelector := `VariableDeclaration + VariableDeclaration[name='second']:nth-child(2)`
  runNoRestrictedSyntax(
    t,
    siblingSource,
    json.RawMessage(`"`+adjacentSelector+`"`),
    noRestrictedSyntaxExpectation{target: "second = 2", message: noRestrictedDefaultMessage(adjacentSelector)},
  )
  siblingSelector := `VariableDeclaration ~ VariableDeclaration[name='third']:last-child`
  runNoRestrictedSyntax(
    t,
    siblingSource,
    json.RawMessage(`"`+siblingSelector+`"`),
    noRestrictedSyntaxExpectation{target: "third = 3", message: noRestrictedDefaultMessage(siblingSelector)},
  )

  callSource := `declare function combine(first: number, second: number): number;
const result = combine(1, 2);
void result;
`
  runNoRestrictedSyntax(
    t,
    callSource,
    json.RawMessage(`"CallExpression > Identifier[name='combine']:first-child"`),
  )
  argumentSelector := `CallExpression > NumericLiteral[value=1]:first-child + NumericLiteral[value=2]:last-child`
  runNoRestrictedSyntax(
    t,
    callSource,
    json.RawMessage(`"`+argumentSelector+`"`),
    noRestrictedSyntaxExpectation{target: "2", message: noRestrictedDefaultMessage(argumentSelector)},
  )

  classSource := `class Pair {
  first(): void {}
  second(): void {}
}
`
  memberSelector := `ClassDeclaration > MethodDeclaration:first-child + MethodDeclaration:last-child`
  runNoRestrictedSyntax(
    t,
    classSource,
    json.RawMessage(`"`+memberSelector+`"`),
    noRestrictedSyntaxExpectation{target: "second(): void {}", message: noRestrictedDefaultMessage(memberSelector)},
  )
}
