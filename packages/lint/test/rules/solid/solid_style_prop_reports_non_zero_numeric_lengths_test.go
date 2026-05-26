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
}
