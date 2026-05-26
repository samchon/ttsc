package linthost

import "testing"

/**
 * Verifies testing-library query style: render-result queries should use `screen`.
 *
 * Pins both render-result shapes supported by the AST-only analyzer: destructured
 * query functions and method calls on a variable assigned from `render`. Both are
 * high-confidence because the local names come from the `render()` expression.
 *
 * 1. Import `render` from Testing Library.
 * 2. Call a destructured query and a query method on a render result variable.
 * 3. Assert `prefer-screen-queries` reports both calls.
 */
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
}
