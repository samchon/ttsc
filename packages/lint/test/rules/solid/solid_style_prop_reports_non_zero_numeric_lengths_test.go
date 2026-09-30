package linthost

import "testing"

/**
 * Verifies solid style-prop: non-zero numeric length values require units.
 *
 * Locks the numeric-literal branch for object style props. Solid permits
 * unitless zeroes, but non-zero CSS length numbers need explicit units instead
 * of silently passing through as raw numeric literals.
 *
 * 1. Import Solid so the Solid rule family is active.
 * 2. Render one style object with a non-zero `width` and a zero `height`.
 * 3. Assert only the non-zero numeric length is reported.
 */
//
// @evidence contracts/testing.md#behavioral-verification The actual owning engine verifies numeric width 4 reports while height 0 stays clean; the assertions below retain the observable identity of every expected result.
// @evidence contracts/testing.md#independent-expectations CSS length zero may omit units while a nonzero length requires a unit.
// @evidence contracts/testing.md#distinguishing-cases The same style object crosses the zero/nonzero boundary; a unit-bearing width and zero height form an accepted control.
// @evidence contracts/testing.md#execution-ownership TestSolidStylePropReportsNonZeroNumericLengths owns the explicit variants below as one discoverable Go unit entry; its parsed-source engine calls, with an in-process checker when required, execute in the shared process without a Solid installation or native product host.
func TestSolidStylePropReportsNonZeroNumericLengths(t *testing.T) {
  source := `
import { createSignal } from "solid-js";

function App() {
  createSignal(0);
  return <div style={{ width: 4, height: 0 }} />;
}
`
  assertSolidFindings(t, source, RuleConfig{
    "solid/style-prop": SeverityError,
  }, []ruleExpectation{
    {Rule: "solid/style-prop", Severity: SeverityError, Line: 6},
  })
  assertSolidFindings(t, "import { createSignal } from \"solid-js\"; function App() { createSignal(0); return <div style={{ width: \"4px\", height: 0 }} />; }\n", RuleConfig{
    "solid/style-prop": SeverityError,
  }, nil)
}
