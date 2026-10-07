package linthost

import "testing"

// TestWaitForAssertionAndSideEffectGuards verifies testing-library waitFor
// guards: assertions, side effects, snapshots, and getBy waits are rejected.
//
// Locks the callback-body traversal shared by the `waitFor` rules. The scenario
// keeps all violations in one callback so the rules must inspect descendants,
// not only the immediate arrow expression.
//
//  1. Import `fireEvent`, `screen`, and `waitFor`.
//  2. Put two assertions, a fire event, a snapshot matcher, and `getBy*` queries inside one callback.
//  3. Assert each enabled `waitFor` rule reports the callback violation.
//
// @evidence contracts/testing.md#behavioral-verification The owning engine and Testing Library assertion helpers verify one waitFor callback produces four exact reports for repeated assertions, snapshot, side effect and getBy waiting; exact normalized findings reject extra or missing results.
// @evidence contracts/testing.md#independent-expectations A retry callback must avoid side effects and snapshots, limit assertions, and use the supported async-query pattern.
// @evidence contracts/testing.md#distinguishing-cases A single callback intentionally triggers all four independent policies; their exact rule/line assertions preserve each failure identity. One queryBy assertion without a snapshot or event is accepted under the same four rules.
// @evidence contracts/testing.md#execution-ownership TestWaitForAssertionAndSideEffectGuards assertTestingLibraryFindings parses the source as TSX under a virtual component.test.tsx path and runs NewEngineWithResolver over it with the four waitFor rules enabled: the one-callback source must yield four exact triples on the same source line and the queryBy-only source in the second call must yield none. No DOM runtime, installed consumer, native build or product child host runs.
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
    {Rule: "testing-library/no-wait-for-multiple-assertions", Severity: SeverityError, Line: 5},
    {Rule: "testing-library/no-wait-for-side-effects", Severity: SeverityError, Line: 5},
    {Rule: "testing-library/no-wait-for-snapshot", Severity: SeverityError, Line: 5},
    {Rule: "testing-library/prefer-find-by", Severity: SeverityError, Line: 5},
  })
  assertTestingLibraryFindings(t, `import { screen, waitFor } from "@testing-library/react";
async function testCase() {
  await waitFor(() => {
    expect(screen.queryByText("A")).toBeInTheDocument();
  });
}
`, RuleConfig{
    "testing-library/no-wait-for-multiple-assertions": SeverityError,
    "testing-library/no-wait-for-side-effects":        SeverityError,
    "testing-library/no-wait-for-snapshot":            SeverityError,
    "testing-library/prefer-find-by":                  SeverityError,
  }, nil)
}
