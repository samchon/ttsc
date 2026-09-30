package linthost

import "testing"

/**
 * Verifies testing-library async handling: Promise-returning helpers must be handled.
 *
 * Locks the AST-only promise-shape checks for `findBy*`, `waitFor`, and
 * user-event calls while also proving synchronous query/event awaits are rejected.
 * These patterns do not need type information because the Testing Library import
 * identifies the helper family.
 *
 * 1. Import `screen`, `waitFor`, `fireEvent`, and `userEvent`.
 * 2. Mix unhandled async helpers with awaited synchronous helpers.
 * 3. Assert the five matching `testing-library/*` diagnostics.
 */
//
// @evidence contracts/testing.md#behavioral-verification The owning engine and Testing Library assertion helpers verify five exact findings distinguish unhandled findBy/waitFor/userEvent promises from incorrectly awaited synchronous getBy/fireEvent calls; exact normalized findings reject extra or missing results.
// @evidence contracts/testing.md#independent-expectations The imported API families define whether a result is asynchronous; literal rule/severity/line triples pin each distinct misuse.
// @evidence contracts/testing.md#distinguishing-cases Positive violations cover async and sync inversions independently. The original violations remain intact and the authored adjacent source is asserted clean.
// @evidence contracts/testing.md#execution-ownership TestAsyncQueryEventAndUtilPromises owns these variants as a named Go unit entry; actual parsing/engine or registry operations execute in the shared Go process, without a DOM runtime, installed consumer or product child host.
func TestAsyncQueryEventAndUtilPromises(t *testing.T) {
  source := `
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

async function testCase() {
  screen.findByText("Saved");
  await screen.getByText("Ready");
  waitFor(() => screen.getByText("Done"));
  await fireEvent.click(screen.getByText("Save"));
  userEvent.click(screen.getByRole("button"));
}
`
  assertTestingLibraryFindings(t, source, RuleConfig{
    "testing-library/await-async-events":    SeverityError,
    "testing-library/await-async-queries":   SeverityError,
    "testing-library/await-async-utils":     SeverityError,
    "testing-library/no-await-sync-events":  SeverityError,
    "testing-library/no-await-sync-queries": SeverityError,
  }, []ruleExpectation{
    {Rule: "testing-library/await-async-queries", Severity: SeverityError, Line: 6},
    {Rule: "testing-library/no-await-sync-queries", Severity: SeverityError, Line: 7},
    {Rule: "testing-library/await-async-utils", Severity: SeverityError, Line: 8},
    {Rule: "testing-library/no-await-sync-events", Severity: SeverityError, Line: 9},
    {Rule: "testing-library/await-async-events", Severity: SeverityError, Line: 10},
  })
  assertTestingLibraryFindings(t, "import { fireEvent, screen, waitFor } from \"@testing-library/react\"; import userEvent from \"@testing-library/user-event\"; async function testCase() { await screen.findByText(\"Saved\"); screen.getByText(\"Ready\"); await waitFor(() => screen.getByText(\"Done\")); fireEvent.click(screen.getByText(\"Save\")); await userEvent.click(screen.getByRole(\"button\")); }\n", RuleConfig{
    "testing-library/await-async-events": SeverityError,
    "testing-library/await-async-queries": SeverityError,
    "testing-library/await-async-utils": SeverityError,
    "testing-library/no-await-sync-events": SeverityError,
    "testing-library/no-await-sync-queries": SeverityError,
  }, nil)
}
