package linthost

import "testing"

/**
 * Verifies solid rendering style preferences: list, conditional, class, style, and empty JSX forms are flagged.
 *
 * Pins the stylistic TSX rules that are still high-signal in a native AST pass.
 * Each violation is a direct JSX or call expression pattern, so the test does
 * not require scope or type services.
 *
 * 1. Import Solid and define one component returning JSX.
 * 2. Use `Array#map`, conditional JSX, `classnames`, camel-cased style, and an empty element.
 * 3. Assert each preference rule reports once.
 */
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
    {Rule: "solid/prefer-classlist", Severity: SeverityError, Line: 1},
    {Rule: "solid/prefer-for", Severity: SeverityError, Line: 1},
    {Rule: "solid/prefer-show", Severity: SeverityError, Line: 1},
    {Rule: "solid/self-closing-comp", Severity: SeverityError, Line: 1},
    {Rule: "solid/style-prop", Severity: SeverityError, Line: 1},
  })
}
