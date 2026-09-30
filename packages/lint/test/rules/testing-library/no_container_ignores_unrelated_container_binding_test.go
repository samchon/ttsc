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
//
// @evidence contracts/testing.md#behavioral-verification The owning engine and Testing Library assertion helpers verify an ordinary props.container binding stays free of no-container findings; exact normalized findings reject extra or missing results.
// @evidence contracts/testing.md#independent-expectations Only render-produced container bindings belong to this rule; the local property name alone is insufficient.
// @evidence contracts/testing.md#distinguishing-cases The render import activates the family but does not confer origin on props.container; TestRenderResultDomAccessAndEvents owns actual render containers.
// @evidence contracts/testing.md#execution-ownership TestNoContainerIgnoresUnrelatedContainerBinding owns these variants as a named Go unit entry; actual parsing/engine or registry operations execute in the shared Go process, without a DOM runtime, installed consumer or product child host.
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
