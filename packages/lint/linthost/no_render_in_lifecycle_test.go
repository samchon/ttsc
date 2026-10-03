package linthost

import "testing"

// TestNoRenderInLifecycle verifies testing-library no-render-in-lifecycle
// reports render inside a lifecycle hook.
//
// Lifecycle callbacks must not contain render calls.
//
//  1. Import render and call it inside beforeEach.
//  2. Run only the rule through the testing-library assertion helper.
//  3. Assert the exact finding, then that render inside an it callback reports
//     nothing.
//
// @evidence contracts/testing.md#behavioral-verification The owning engine and Testing Library assertion helpers verify render inside beforeEach is reported; exact normalized findings reject extra or missing results.
// @evidence contracts/testing.md#independent-expectations The authored beforeEach callback is a forbidden render owner; the it callback is a clean counterpart.
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
