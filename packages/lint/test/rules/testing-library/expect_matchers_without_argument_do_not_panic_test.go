package linthost

import "testing"

/**
 * Verifies testing-library expect matcher rules: empty expect calls do not panic.
 *
 * Locks the nil-argument guard around matcher rules that inspect the first
 * `expect` argument. A bare `expect()` is invalid test code, but linting it
 * should still return diagnostics instead of crashing the lint run.
 *
 * 1. Import a Testing Library async utility so the rule family is active.
 * 2. Use matcher calls with `expect()` and no first argument.
 * 3. Assert the enabled matcher preference rules complete without panicking.
 */
func TestExpectMatchersWithoutArgumentDoNotPanic(t *testing.T) {
  source := `
import { waitFor } from "@testing-library/react";

async function testCase() {
  expect().toBeInTheDocument();
  await waitFor(() => expect().not.toBeInTheDocument());
  expect().toBeNull();
}
`
  runTestingLibraryRules(t, source, RuleConfig{
    "testing-library/prefer-presence-queries":       SeverityError,
    "testing-library/prefer-query-by-disappearance": SeverityError,
    "testing-library/prefer-query-matchers":         SeverityError,
  })
}
