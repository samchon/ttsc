package linthost

import "testing"

//
// @evidence contracts/testing.md#behavioral-verification Checker-backed findings compare exact line/target/message triples for captured and merged parameter writes while requiring unrelated shadows to stay silent.
// @evidence contracts/testing.md#independent-expectations Independently authored target identities distinguish lexical parameter references from same-spelled local/catch/class members; the literal finding list does not reuse checker symbols as its oracle.
// @evidence contracts/testing.md#distinguishing-cases Nested closure/class capture, inner parameters, var merge, constructor/method/setter/arrow/expression parameters report; block/catch/local/static-field shadows and ordinary aliases stay clean.
// @evidence contracts/testing.md#execution-ownership TestNoParamReassignUsesCheckerIdentityAcrossNestedScopes is selected in the shared Go unit population. It calls runNoParamReassign with a real Program/Checker for the unchanged nested-scope matrix and retains every original assertion. No consumer install, native artifact build or real host runs.
func TestNoParamReassignUsesCheckerIdentityAcrossNestedScopes(t *testing.T) {
  source := `function scopes(value: any): void {
  { let value = 0; value = 1; }
  try { throw 0; } catch (value) { value = 1; }
  class Shadows {
    value = 1;
    field = (() => { let value = 0; value = 1; return value; })();
    static { let value = 0; value = 1; }
  }
  function local(): void { let value = 0; value = 1; }
  function captured(): void { value = 2; }
  class Captures {
    field = (value = 3);
    static { value = 4; }
  }
  const alias = value;
  const holder = { alias };
  JSON.stringify([Shadows, Captures, captured, holder]);
}
function nestedParameter(value: any): void {
  function inner(value: any): void { value = 5; }
  inner(value);
}
function mergedVar(value: any): void {
  var value;
  value = 6;
}
class FunctionKinds {
  constructor(public value: any) { value = 7; }
  method(value: any): void { value = 8; }
  set property(value: any) { value = 9; }
}
const arrowKind = (value: any): void => { value = 10; };
const expressionKind = function (value: any): void { value = 11; };
JSON.stringify([FunctionKinds, arrowKind, expressionKind]);
`
  got := runNoParamReassign(t, source, nil)
  assertNoParamReassignFindings(
    t,
    got,
    noParamReassignFinding{line: 10, target: "value", message: "Assignment to function parameter 'value'."},
    noParamReassignFinding{line: 12, target: "value", message: "Assignment to function parameter 'value'."},
    noParamReassignFinding{line: 13, target: "value", message: "Assignment to function parameter 'value'."},
    noParamReassignFinding{line: 20, target: "value", message: "Assignment to function parameter 'value'."},
    noParamReassignFinding{line: 25, target: "value", message: "Assignment to function parameter 'value'."},
    noParamReassignFinding{line: 28, target: "value", message: "Assignment to function parameter 'value'."},
    noParamReassignFinding{line: 29, target: "value", message: "Assignment to function parameter 'value'."},
    noParamReassignFinding{line: 30, target: "value", message: "Assignment to function parameter 'value'."},
    noParamReassignFinding{line: 32, target: "value", message: "Assignment to function parameter 'value'."},
    noParamReassignFinding{line: 33, target: "value", message: "Assignment to function parameter 'value'."},
  )
}
