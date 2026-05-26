package linthost

import "testing"

/**
 * Verifies testing-library no-container: unrelated container bindings are ignored.
 *
 * Locks the render-origin check for object bindings named `container`. User
 * fixtures often carry unrelated data with that property name, and the lint
 * rule should not treat those bindings as Testing Library render results.
 *
 * 1. Import `render` so the Testing Library rule family is active.
 * 2. Destructure `container` from ordinary props and query through it.
 * 3. Assert `no-container` does not report the unrelated binding or access.
 */
func TestNoContainerIgnoresUnrelatedContainerBinding(t *testing.T) {
  source := `
import { render } from "@testing-library/react";

function testCase(props) {
  const { container } = props;
  container.querySelector(".outside");
  render(<button>Save</button>);
}
`
  assertTestingLibraryFindings(t, source, RuleConfig{
    "testing-library/no-container": SeverityError,
  }, nil)
}
