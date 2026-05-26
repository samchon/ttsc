package linthost

import "testing"

/**
 * Verifies solid JSX attribute guards: DOM prop shapes stay Solid-specific.
 *
 * Covers the direct JSX attribute rules that prevent React carry-over and unsafe
 * DOM behavior. The fixture imports Solid so the family is active, then keeps
 * every violation on separate JSX attributes for stable line-level assertions.
 *
 * 1. Render one DOM element with duplicate, React-style, unsafe, namespaced, and array handler props.
 * 2. Enable the JSX attribute rules.
 * 3. Assert each rule reports its own high-confidence attribute pattern.
 */
func TestSolidJSXAttributeGuards(t *testing.T) {
  source := `
import { createSignal } from "solid-js";

function App() {
  const [enabled] = createSignal(false);
  return <div
    onclick="save"
    onClick={[enabled, () => enabled()]}
    className="primary"
    htmlFor="field"
    key="save"
    innerHTML={enabled()}
    href="javascript:alert(1)"
    foo:bar="x"
    id="a"
    id="b"
  />;
}
`
  assertSolidFindings(t, source, RuleConfig{
    "solid/event-handlers":          SeverityError,
    "solid/jsx-no-duplicate-props":  SeverityError,
    "solid/jsx-no-script-url":       SeverityError,
    "solid/no-array-handlers":       SeverityError,
    "solid/no-innerhtml":            SeverityError,
    "solid/no-react-specific-props": SeverityError,
    "solid/no-unknown-namespaces":   SeverityError,
  }, []ruleExpectation{
    {Rule: "solid/event-handlers", Severity: SeverityError, Line: 7},
    {Rule: "solid/jsx-no-duplicate-props", Severity: SeverityError, Line: 8},
    {Rule: "solid/no-array-handlers", Severity: SeverityError, Line: 8},
    {Rule: "solid/no-react-specific-props", Severity: SeverityError, Line: 9},
    {Rule: "solid/no-react-specific-props", Severity: SeverityError, Line: 10},
    {Rule: "solid/no-react-specific-props", Severity: SeverityError, Line: 11},
    {Rule: "solid/no-innerhtml", Severity: SeverityError, Line: 12},
    {Rule: "solid/jsx-no-script-url", Severity: SeverityError, Line: 13},
    {Rule: "solid/no-unknown-namespaces", Severity: SeverityError, Line: 14},
    {Rule: "solid/jsx-no-duplicate-props", Severity: SeverityError, Line: 16},
  })
}
