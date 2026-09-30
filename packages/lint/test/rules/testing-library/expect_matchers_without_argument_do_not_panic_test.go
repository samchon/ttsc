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
//
// @evidence contracts/testing.md#behavioral-verification The owning engine and Testing Library assertion helpers verify empty expect arguments produce no matcher-preference findings or swallowed panic diagnostics; exact normalized findings reject extra or missing results.
// @evidence contracts/testing.md#independent-expectations With no actual argument, none of these query-specific preferences has a qualifying query to report.
// @evidence contracts/testing.md#distinguishing-cases Three original matcher shapes exercise absent arguments; named scalar, object-member and nested-expect controls reject non-query AST casts. The presence/query/disappearance tests own matching actual-query positives.
// @evidence contracts/testing.md#execution-ownership TestExpectMatchersWithoutArgumentDoNotPanic owns these variants as a named Go unit entry; actual parsing/engine or registry operations execute in the shared Go process, without a DOM runtime, installed consumer or product child host.
func TestExpectMatchersWithoutArgumentDoNotPanic(t *testing.T) {
  source := `
import { waitFor } from "@testing-library/react";

async function testCase() {
  expect().toBeInTheDocument();
  await waitFor(() => expect().not.toBeInTheDocument());
  expect().toBeNull();
}
`
  assertTestingLibraryFindings(t, source, RuleConfig{
    "testing-library/prefer-presence-queries":       SeverityError,
    "testing-library/prefer-query-by-disappearance": SeverityError,
    "testing-library/prefer-query-matchers":         SeverityError,
  }, nil)
  t.Run("non-query matcher arguments", func(t *testing.T) {
    assertTestingLibraryFindings(t, `import { waitFor } from "@testing-library/react";
declare const state: { value: unknown };
async function testCase() {
  expect(1).toBeNull();
  expect(state.value).toBeFalsy();
  expect(expect()).toBeTruthy();
  await waitFor(() => expect(state.value).not.toBeInTheDocument());
}
`, RuleConfig{
      "testing-library/prefer-presence-queries": SeverityError,
      "testing-library/prefer-query-by-disappearance": SeverityError,
      "testing-library/prefer-query-matchers": SeverityError,
    }, nil)
  })
}
