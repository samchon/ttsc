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
//
// @evidence contracts/testing.md#behavioral-verification The owning engine and Testing Library assertion helpers verify render inside beforeEach is reported; exact normalized findings reject extra or missing results.
// @evidence contracts/testing.md#independent-expectations The policy requires render to belong to an individual test rather than a lifecycle hook.
// @evidence contracts/testing.md#distinguishing-cases The same render inside an it callback is accepted. The original violations remain intact and the authored adjacent source is asserted clean.
// @evidence contracts/testing.md#execution-ownership TestNoRenderInLifecycle assertTestingLibraryFindings parses the source as TSX under a virtual component.test.tsx path and runs NewEngineWithResolver over it with only no-render-in-lifecycle enabled: the beforeEach source must yield one exact triple and the it-callback source in the second call must yield none. No DOM runtime, installed consumer, native build or product child host runs.
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
  assertTestingLibraryFindings(t, "import { render } from \"@testing-library/react\"; it(\"owns render\", () => { render(<button>Save</button>); });\n", RuleConfig{
    "testing-library/no-render-in-lifecycle": SeverityError,
  }, nil)
}
