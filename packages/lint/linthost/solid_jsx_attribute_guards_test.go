package linthost

import "testing"

// TestSolidJSXAttributeGuards verifies solid JSX attribute guards: DOM prop
// shapes stay Solid-specific.
//
// Covers the direct JSX attribute lint policies for React-style names and unsafe
// attribute spellings. The fixture imports Solid so the family is active, then keeps
// every violation on separate JSX attributes for stable line-level assertions.
//
//  1. Parse one JSX element with duplicate, React-style, unsafe, namespaced, and array handler props.
//  2. Enable the JSX attribute rules.
//  3. Assert each rule reports its authored attribute pattern.
//
// @evidence contracts/testing.md#behavioral-verification The actual owning engine verifies ten exact findings identify duplicate/React/unsafe/namespaced/array-handler attributes; the assertions below retain the observable identity of every expected result.
// @evidence contracts/testing.md#independent-expectations Authored lint expectations require event-name casing, reject case-insensitive duplicate names, React-style prop names, array handlers, innerHTML, script URLs and the foo namespace. Literal rule/severity/line triples are independent of findings; callable handler types or actual DOM behavior are not asserted.
// @evidence contracts/testing.md#distinguishing-cases Case variants onclick/onClick and repeated id attributes are independently reported; normal event, class, for, href and singleton id form the accepted control.
// @evidence contracts/testing.md#execution-ownership TestSolidJSXAttributeGuards owns the explicit variants below as one discoverable Go unit entry; its parsed-source engine calls, with an in-process checker when required, execute in the shared process without a Solid installation or native product host.
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
  assertSolidFindings(t, "import { createSignal } from \"solid-js\"; const view = <a onClick={() => {}} class=\"primary\" for=\"field\" href=\"/safe\" id=\"a\" />; void createSignal;\n", RuleConfig{
    "solid/event-handlers": SeverityError,
    "solid/jsx-no-duplicate-props": SeverityError,
    "solid/jsx-no-script-url": SeverityError,
    "solid/no-array-handlers": SeverityError,
    "solid/no-innerhtml": SeverityError,
    "solid/no-react-specific-props": SeverityError,
    "solid/no-unknown-namespaces": SeverityError,
  }, nil)
}
