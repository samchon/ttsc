package linthost

import "testing"

// TestNoParamReassignDefaultPropsLeavesPropertyWritesAlone verifies the default
// props:false policy ignores writes to parameter properties and reports only
// rebinding.
//
// Mutating the object a parameter refers to is allowed by default while
// replacing the parameter itself is not.
//
//  1. Parse a function whose parameter has property assignment, update, delete,
//     destructuring and loop writes, then a final rebinding.
//  2. Run no-param-reassign with default options.
//  3. Assert only the final rebinding reports, at line seven, with the parameter
//     named.
//
// @evidence contracts/testing.md#behavioral-verification Checker-backed findings require exactly the one direct target reassignment, with its independent line/target/message triple.
// @evidence contracts/testing.md#independent-expectations Default props false permits mutation of the referenced object while forbidding replacement of the parameter binding; line seven independently identifies that distinction.
// @evidence contracts/testing.md#distinguishing-cases Property assignment/update/delete/destructuring/loop writes stay clean; replacing target itself reports. The enabled props case supplies the option-changing counterpart.
// @evidence contracts/testing.md#execution-ownership TestNoParamReassignDefaultPropsLeavesPropertyWritesAlone is selected in the shared Go unit population. It calls runNoParamReassign with default options against the actual Program/Checker and owns the five property-write sites (assignment, prefix update, delete, array-destructuring target, for-of target) and the one binding replacement `target = {}`. No consumer install, native artifact build or real host runs.
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
