package linthost

import (
  "encoding/json"
  "testing"
)

//
// @evidence contracts/testing.md#behavioral-verification Checker-backed findings compare each property/direct assignment line, target and exact message under both ignore lists.
// @evidence contracts/testing.md#independent-expectations Authored props/ignore inputs and fixed target names independently distinguish rooted parameter-property mutation from reads, alias effects and ignored-property writes; direct ignored-parameter writes remain forbidden.
// @evidence contracts/testing.md#distinguishing-cases Assignment/update/delete/destructuring/rest/loop/conditional rooted writes report; reads, call-result/alias mutations and ignored properties stay clean, while direct ignored binding writes still report.
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
