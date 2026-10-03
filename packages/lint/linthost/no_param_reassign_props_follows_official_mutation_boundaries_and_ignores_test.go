package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoParamReassignPropsFollowsOfficialMutationBoundariesAndIgnores verifies
// props:true reports property mutations rooted at a parameter and honors the
// ignore lists.
//
// With props enabled, writes whose target chain is rooted at the parameter
// report, while reads, aliases and ignored parameter names do not; rebinding an
// ignored parameter still reports.
//
//  1. Parse a function writing the parameter by assignment, update, delete,
//     destructuring targets, loop targets, call-callee and conditional-result
//     chains.
//  2. Run the rule under props:true with each ignore list.
//  3. Assert the exact line, target and message of every rooted write and none for
//     reads, aliases or ignored properties.
//
// @evidence contracts/testing.md#behavioral-verification Checker-backed findings compare each property/direct assignment line, target and exact message under both ignore lists.
// @evidence contracts/testing.md#independent-expectations Authored props/ignore inputs and fixed target names independently distinguish rooted parameter-property mutation from reads, alias effects and ignored-property writes; direct ignored-parameter writes remain forbidden.
// @evidence contracts/testing.md#distinguishing-cases Thirteen property writes rooted at `target` report (assignment, update, delete, array/object/rest destructuring targets, for-in/for-of targets including a destructuring for-in pattern, a write through the call callee `target.get().value`, and a write through a conditional result `(condition ? target : {}).chosen`). Uses of `target` as a computed key, call argument or conditional test, a write through the const alias, and property writes on `ignored` and `regexName` (exempted by the exact and regex ignore lists) stay clean, while the three direct writes to the ignored parameters themselves (lines 21, 26, 27) still report.
// @evidence contracts/testing.md#execution-ownership TestNoParamReassignPropsFollowsOfficialMutationBoundariesAndIgnores is selected in the shared Go unit population. It calls runNoParamReassign with the explicit props and exact/regex ignore JSON, using the real Program/Checker and preserving all source-case failure identities. No consumer install, native artifact build or real host runs.
func TestNoParamReassignPropsFollowsOfficialMutationBoundariesAndIgnores(t *testing.T) {
  source := `const data: any = {};
const sink = (value: any): any => value;
function mutate(target: any, ignored: any, regexName: any, condition: boolean): void {
  target.value = 1;
  target.deep.value++;
  delete target.deleted;
  [target.array] = [];
  ({ value: target.object } = { value: 1 });
  ([...target.arrayRest] = []);
  ({ ...target.objectRest } = {});
  for (target.loop in {});
  for (target.item of []);
  // @ts-ignore -- JavaScript accepts a destructuring for-in target, while TypeScript reports TS2491.
  for ({ value: target.pattern } in {});
  for ([target.element] of []);
  target.get().value = 1;
  (condition ? target : {}).chosen = 1;
  data[target.value] = 1;
  sink(target.value).result = 1;
  (target ? {} : {}).untouched = 1;
  ({ [target.value]: ignored } = {});
  const alias = target;
  alias.value = 1;
  ignored.value = 1;
  regexName.value = 1;
  ignored = {};
  regexName = {};
}
`
  got := runNoParamReassign(
    t,
    source,
    json.RawMessage(`{"props":true,"ignorePropertyModificationsFor":["ignored"],"ignorePropertyModificationsForRegex":["^regex(?:Name)?$"]}`),
  )
  property := func(line int) noParamReassignFinding {
    return noParamReassignFinding{
      line:    line,
      target:  "target",
      message: "Assignment to property of function parameter 'target'.",
    }
  }
  assertNoParamReassignFindings(
    t,
    got,
    property(4),
    property(5),
    property(6),
    property(7),
    property(8),
    property(9),
    property(10),
    property(11),
    property(12),
    property(14),
    property(15),
    property(16),
    property(17),
    noParamReassignFinding{line: 21, target: "ignored", message: "Assignment to function parameter 'ignored'."},
    noParamReassignFinding{line: 26, target: "ignored", message: "Assignment to function parameter 'ignored'."},
    noParamReassignFinding{line: 27, target: "regexName", message: "Assignment to function parameter 'regexName'."},
  )
}
