package linthost

import "testing"

/**
 * Verifies testing-library no-render-in-lifecycle: lifecycle hook renders are rejected.
 *
 * Locks the ancestor walk from a `render()` call back to test lifecycle
 * callbacks. The rule must report only when a Testing Library render happens
 * inside hooks such as `beforeEach`.
 *
 * 1. Import `render` from Testing Library.
 * 2. Call `render()` inside a `beforeEach` callback.
 * 3. Assert `no-render-in-lifecycle` reports the render call.
 */
func TestNoRenderInLifecycle(t *testing.T) {
  source := `
import { render } from "@testing-library/react";

beforeEach(() => {
  render(<button>Save</button>);
});
`
  assertTestingLibraryFindings(t, source, RuleConfig{
    "testing-library/no-render-in-lifecycle": SeverityError,
  }, []ruleExpectation{
    {Rule: "testing-library/no-render-in-lifecycle", Severity: SeverityError, Line: 5},
  })
}
