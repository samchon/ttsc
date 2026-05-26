package linthost

import "testing"

/**
 * Verifies testing-library waitFor guards: assertions, side effects, snapshots, and getBy waits are rejected.
 *
 * Locks the callback-body traversal shared by the `waitFor` rules. The scenario
 * keeps all violations in one callback so the rules must inspect descendants,
 * not only the immediate arrow expression.
 *
 * 1. Import `fireEvent`, `screen`, and `waitFor`.
 * 2. Put two assertions, a fire event, a snapshot matcher, and `getBy*` queries inside one callback.
 * 3. Assert each enabled `waitFor` rule reports the callback violation.
 */
func TestWaitForAssertionAndSideEffectGuards(t *testing.T) {
  source := `
import { fireEvent, screen, waitFor } from "@testing-library/react";

async function testCase() {
  await waitFor(() => {
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toMatchSnapshot();
    fireEvent.click(screen.getByText("Go"));
  });
}
`
  assertTestingLibraryFindings(t, source, RuleConfig{
    "testing-library/no-wait-for-multiple-assertions": SeverityError,
    "testing-library/no-wait-for-side-effects":        SeverityError,
    "testing-library/no-wait-for-snapshot":            SeverityError,
    "testing-library/prefer-find-by":                  SeverityError,
  }, []ruleExpectation{
    {Rule: "testing-library/no-wait-for-multiple-assertions", Severity: SeverityError, Line: 1},
    {Rule: "testing-library/no-wait-for-side-effects", Severity: SeverityError, Line: 1},
    {Rule: "testing-library/no-wait-for-snapshot", Severity: SeverityError, Line: 1},
    {Rule: "testing-library/prefer-find-by", Severity: SeverityError, Line: 1},
  })
}
