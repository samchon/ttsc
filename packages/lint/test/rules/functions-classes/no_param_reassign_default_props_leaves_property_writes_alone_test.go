package linthost

import "testing"

//
// @evidence contracts/testing.md#behavioral-verification Checker-backed findings require exactly the one direct target reassignment, with its independent line/target/message triple.
// @evidence contracts/testing.md#independent-expectations Default props false permits mutation of the referenced object while forbidding replacement of the parameter binding; line seven independently identifies that distinction.
// @evidence contracts/testing.md#distinguishing-cases Property assignment/update/delete/destructuring/loop writes stay clean; replacing target itself reports. The enabled props case supplies the option-changing counterpart.
// @evidence contracts/testing.md#execution-ownership TestNoParamReassignDefaultPropsLeavesPropertyWritesAlone is selected in the shared Go unit population. It calls runNoParamReassign with default options against the actual Program/Checker and owns all original property versus binding sites. No consumer install, native artifact build or real host runs.
func TestNoParamReassignDefaultPropsLeavesPropertyWritesAlone(t *testing.T) {
  source := `function mutate(target: any): void {
  target.value = 1;
  ++target.other;
  delete target.deleted;
  [target.array] = [];
  for (target.item of []);
  target = {};
}
`
  got := runNoParamReassign(t, source, nil)
  assertNoParamReassignFindings(
    t,
    got,
    noParamReassignFinding{line: 7, target: "target", message: "Assignment to function parameter 'target'."},
  )
}
