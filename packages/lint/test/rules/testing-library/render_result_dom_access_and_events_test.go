package linthost

import "testing"

/**
 * Verifies testing-library DOM access: container, node traversal, debugging, and fireEvent are flagged.
 *
 * Pins the high-signal React Testing Library anti-patterns that are visible
 * from direct AST traversal. The rule implementation intentionally requires a
 * Testing Library import so ordinary DOM code outside tests is not reported.
 *
 * 1. Destructure `container` and `debug` from `render`.
 * 2. Query through `container`, traverse from a `screen` result, debug output, and use `fireEvent`.
 * 3. Assert each enabled rule reports its matching AST pattern.
 */
func TestRenderResultDomAccessAndEvents(t *testing.T) {
  source := `
import { fireEvent, render, screen } from "@testing-library/react";

function testCase() {
  const { container, debug } = render(<button>Save</button>);
  container.querySelector(".save");
  screen.getByText("Save").parentElement;
  debug();
  fireEvent.click(screen.getByText("Save"));
}
`
  assertTestingLibraryFindings(t, source, RuleConfig{
    "testing-library/no-container":       SeverityError,
    "testing-library/no-debugging-utils": SeverityError,
    "testing-library/no-node-access":     SeverityError,
    "testing-library/prefer-user-event":  SeverityError,
  }, []ruleExpectation{
    {Rule: "testing-library/no-container", Severity: SeverityError, Line: 5},
    {Rule: "testing-library/no-container", Severity: SeverityError, Line: 6},
    {Rule: "testing-library/no-node-access", Severity: SeverityError, Line: 6},
    {Rule: "testing-library/no-node-access", Severity: SeverityError, Line: 7},
    {Rule: "testing-library/no-debugging-utils", Severity: SeverityError, Line: 8},
    {Rule: "testing-library/prefer-user-event", Severity: SeverityError, Line: 9},
  })
}
