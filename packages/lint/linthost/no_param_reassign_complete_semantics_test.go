package linthost

import "testing"

// TestNoParamReassignResolvesEveryParameterBindingAndWriteForm verifies
// no-param-reassign reports every write form against every parameter binding
// shape.
//
// The default props:false policy forbids rebinding a parameter, including
// through destructured and rest bindings; the checker resolves each write to its
// parameter symbol.
//
//  1. Parse one function with simple, object-destructured, nested,
//     array-destructured and rest parameters, each written by assignment, compound,
//     logical, update, destructuring, rest, loop and closure-captured forms.
//  2. Run no-param-reassign with default options on the type-checked program.
//  3. Assert the fifteen exact line, target and message triples and that no finding
//     carries an edit.
//
// @evidence contracts/testing.md#behavioral-verification Actual Checker-backed rule findings must match all fifteen authored line/target/message triples and offer no edits.
// @evidence contracts/testing.md#independent-expectations Fixed line numbers and binding names independently follow the default prohibition on modifying parameter references, including destructured and rest bindings.
// @evidence contracts/testing.md#distinguishing-cases Plain/compound/logical/update/destructuring/rest/loop/captured writes report on simple, object, deep, array and rest parameters; UsesCheckerIdentityAcrossNestedScopes owns clean shadow counterparts.
// @evidence contracts/testing.md#execution-ownership TestNoParamReassignResolvesEveryParameterBindingAndWriteForm is selected in the shared Go unit population. It calls runNoParamReassign through runRuleFindingsSnapshot with a real Program/Checker; this entry owns the full fifteen-site source matrix. No consumer install, native artifact build or real host runs.
func TestNoParamReassignResolvesEveryParameterBindingAndWriteForm(t *testing.T) {
  source := `function writes(
  simple: any,
  { object = 0, nested: { deep = 0 } = {} }: any = {},
  [arrayValue = 0]: any[] = [],
  ...rest: any[]
): void {
  simple = 1;
  simple += 1;
  simple &&= 1;
  simple ||= 1;
  simple ??= 1;
  ++simple;
  simple--;
  ({ value: simple } = { value: 1 });
  [arrayValue = 1] = [];
  ({ object } = { object: 1 });
  ({ nested: { deep } } = { nested: { deep: 1 } });
  [...rest] = [];
  for (simple in {});
  for (arrayValue of []);
  (() => { object = 2; })();
}
`
  got := runNoParamReassign(t, source, nil)
  direct := func(line int, name string) noParamReassignFinding {
    return noParamReassignFinding{
      line:    line,
      target:  name,
      message: "Assignment to function parameter '" + name + "'.",
    }
  }
  assertNoParamReassignFindings(
    t,
    got,
    direct(7, "simple"),
    direct(8, "simple"),
    direct(9, "simple"),
    direct(10, "simple"),
    direct(11, "simple"),
    direct(12, "simple"),
    direct(13, "simple"),
    direct(14, "simple"),
    direct(15, "arrayValue"),
    direct(16, "object"),
    direct(17, "deep"),
    direct(18, "rest"),
    direct(19, "simple"),
    direct(20, "arrayValue"),
    direct(21, "object"),
  )
}
