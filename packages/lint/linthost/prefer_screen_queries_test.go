package linthost

import "testing"

// TestPreferScreenQueries verifies testing-library query style: render-result queries should use `screen`.
//
// Pins both render-result shapes supported by the AST-only analyzer: destructured
// query functions and method calls on a variable assigned from `render`. Both are
// high-confidence because the local names come from the `render()` expression.
//
// 1. Import `render` from Testing Library.
// 2. Call a destructured query and a query method on a render result variable.
// 3. Assert `prefer-screen-queries` reports both calls.
//
// @evidence contracts/testing.md#behavioral-verification The owning engine and Testing Library assertion helpers verify destructured and member queries from render results both report; exact normalized findings reject extra or missing results.
// @evidence contracts/testing.md#independent-expectations screen owns the shared query API rather than each render result.
// @evidence contracts/testing.md#distinguishing-cases Both reported binding forms differ from a direct screen query. The original violations remain intact and the authored adjacent source is asserted clean.
// @evidence contracts/testing.md#execution-ownership TestPreferScreenQueries assertTestingLibraryFindings parses the source as TSX under a virtual component.test.tsx path and runs NewEngineWithResolver over it with only prefer-screen-queries enabled: the destructured-query and render-result-member source must yield two exact triples and the screen-query source must yield none. No DOM runtime, installed consumer, native build or product child host runs.
func TestPreferScreenQueries(t *testing.T) {
  source := `
import { render } from "@testing-library/react";

function testCase() {
  const { getByText } = render(<button>Save</button>);
  getByText("Save");
  const view = render(<button>Cancel</button>);
  view.getByRole("button");
}
`
  assertTestingLibraryFindings(t, source, RuleConfig{
    "testing-library/prefer-screen-queries": SeverityError,
  }, []ruleExpectation{
    {Rule: "testing-library/prefer-screen-queries", Severity: SeverityError, Line: 6},
    {Rule: "testing-library/prefer-screen-queries", Severity: SeverityError, Line: 8},
  })
  assertTestingLibraryFindings(t, "import { screen } from \"@testing-library/react\"; function testCase() { screen.getByText(\"Save\"); screen.getByRole(\"button\"); }\n", RuleConfig{
    "testing-library/prefer-screen-queries": SeverityError,
  }, nil)
}
