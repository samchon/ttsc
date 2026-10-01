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
//
// @evidence contracts/testing.md#behavioral-verification The actual owning engine verifies three exact findings locate div in p, nested anchor and input in button; the assertions below retain the observable identity of every expected result.
// @evidence contracts/testing.md#independent-expectations HTML content models disallow these nestings; literal line expectations identify the inner invalid elements independently of the rule.
// @evidence contracts/testing.md#distinguishing-cases Three different container families remain checked; phrasing text in p and a standalone button form an accepted nesting control.
// @evidence contracts/testing.md#execution-ownership TestSolidValidateJSXNesting owns the explicit variants below as one discoverable Go unit entry; its parsed-source engine calls, with an in-process checker when required, execute in the shared process without a Solid installation or native product host.
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
  assertSolidFindings(t, "import { createSignal } from \"solid-js\"; function App() { createSignal(0); return <section><p><span>text</span></p><button>Save</button></section>; }\n", RuleConfig{
    "solid/validate-jsx-nesting": SeverityError,
  }, nil)
}
