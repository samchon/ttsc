package linthost

import "testing"

// TestSolidRenderingStylePreferences verifies solid rendering style preferences:
// list, conditional, class, style, and empty JSX forms are flagged.
//
// Pins five authored stylistic TSX patterns in a parsed-source AST pass.
// Each violation is a direct JSX or call expression pattern, so the test does
// not require scope or type services.
//
//  1. Import Solid and define one component returning JSX.
//  2. Use `Array#map`, conditional JSX, `classnames`, camel-cased style, and an empty element.
//  3. Assert each preference rule reports once.
//
// @evidence contracts/testing.md#behavioral-verification The actual owning engine verifies five exact findings identify map, conditional JSX, clsx class, camel-case style and explicit empty element; the assertions below retain the observable identity of every expected result.
// @evidence contracts/testing.md#independent-expectations The supported preference contract selects Solid For/Show/classList, CSS property names and self-closing empty JSX; literal rule/line triples pin each authored violation.
// @evidence contracts/testing.md#distinguishing-cases The reported forms remain independently identifiable; a simple self-closing element with classList and kebab-case style is the accepted control.
// @evidence contracts/testing.md#execution-ownership TestSolidRenderingStylePreferences owns the explicit variants below as one discoverable Go unit entry; its parsed-source engine calls, with an in-process checker when required, execute in the shared process without a Solid installation or native product host.
func TestSolidRenderingStylePreferences(t *testing.T) {
  source := `
import { createSignal } from "solid-js";

function App() {
  const [items] = createSignal([1]);
  const enabled = true;
  return <section>
    {items().map((item) => <span>{item}</span>)}
    {enabled && <strong>Ready</strong>}
    <div class={clsx({ active: enabled })} />
    <span style={{ fontSize: "12px" }} />
    <Icon></Icon>
  </section>;
}
function Icon() {
  return <svg />;
}
`
  assertSolidFindings(t, source, RuleConfig{
    "solid/prefer-classlist":  SeverityError,
    "solid/prefer-for":        SeverityError,
    "solid/prefer-show":       SeverityError,
    "solid/self-closing-comp": SeverityError,
    "solid/style-prop":        SeverityError,
  }, []ruleExpectation{
    {Rule: "solid/prefer-for", Severity: SeverityError, Line: 8},
    {Rule: "solid/prefer-show", Severity: SeverityError, Line: 9},
    {Rule: "solid/prefer-classlist", Severity: SeverityError, Line: 10},
    {Rule: "solid/style-prop", Severity: SeverityError, Line: 11},
    {Rule: "solid/self-closing-comp", Severity: SeverityError, Line: 12},
  })
  assertSolidFindings(t, "import { createSignal } from \"solid-js\"; function App() { createSignal(0); return <div classList={{ active: true }} style={{ \"font-size\": \"12px\" }} />; }\n", RuleConfig{
    "solid/prefer-classlist":  SeverityError,
    "solid/prefer-for":        SeverityError,
    "solid/prefer-show":       SeverityError,
    "solid/self-closing-comp": SeverityError,
    "solid/style-prop":        SeverityError,
  }, nil)
}
