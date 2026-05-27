package linthost

import "testing"

/**
 * Verifies solid validate-jsx-nesting: rejects HTML-illegal JSX nestings.
 *
 * The HTML parser restructures forbidden nestings at runtime, so the rendered
 * DOM no longer matches the JSX tree the component produced. The fixture
 * stacks one violation per container family — `<p>` with a `<div>` child,
 * `<a>` inside `<a>`, and `<button>` wrapping an `<input>` — so each finding
 * lands on its own line for stable assertions.
 *
 * 1. Import Solid so the family gate is active.
 * 2. Render `<p><div/></p>`, `<a><a/></a>`, `<button><input/></button>`.
 * 3. Assert one validate-jsx-nesting finding per inner element.
 */
func TestSolidValidateJSXNesting(t *testing.T) {
  source := `
import { createSignal } from "solid-js";

function App() {
  createSignal(0);
  return (
    <section>
      <p>
        <div>nope</div>
      </p>
      <a href="/x">
        <a href="/y">inner</a>
      </a>
      <button>
        <input />
      </button>
    </section>
  );
}
`
  assertSolidFindings(t, source, RuleConfig{
    "solid/validate-jsx-nesting": SeverityError,
  }, []ruleExpectation{
    {Rule: "solid/validate-jsx-nesting", Severity: SeverityError, Line: 9},
    {Rule: "solid/validate-jsx-nesting", Severity: SeverityError, Line: 12},
    {Rule: "solid/validate-jsx-nesting", Severity: SeverityError, Line: 15},
  })
}
