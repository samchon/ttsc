package linthost

import "testing"

// TestSolidSourceFileRulesHandleJSXInitializers verifies Solid collection narrows mixed initializer and attribute nodes.
//
// Every Solid rule shares one source-file collector. JSX-valued variables and
// non-call class expressions, object spreads, and shorthand properties carry
// typed payloads that are not the nodes the rules otherwise expect.
// TypeScript-Go represents the first hole in `const [, setter]` as an
// OmittedExpression rather than a BindingElement, so every access must narrow
// its node first.
//
//  1. Parse a Solid fixture with mixed binding, initializer, class, and style nodes.
//  2. Enable the list, class, and style preference rules.
//  3. Assert only the valid positives report and no panic diagnostic replaces them.
func TestSolidSourceFileRulesHandleJSXInitializers(t *testing.T) {
  source := `
import { createSignal } from "solid-js";
const [items] = createSignal([1]);
const [, setItems] = createSignal([1]);
const shared = {}, color = "red";
const tree = (
  <section>
    {items().map((item) => <span>{item}</span>)}
    <div class={clsx({ active: true })} />
    <div class={{ active: true }} />
    <div style={{ ...shared, color, fontSize: "12px" }} />
  </section>
);
void setItems;
`
  assertSolidFindings(t, source, RuleConfig{
    "solid/prefer-classlist": SeverityError,
    "solid/prefer-for":       SeverityError,
    "solid/style-prop":       SeverityError,
  }, []ruleExpectation{
    {Rule: "solid/prefer-for", Severity: SeverityError, Line: 8},
    {Rule: "solid/prefer-classlist", Severity: SeverityError, Line: 9},
    {Rule: "solid/style-prop", Severity: SeverityError, Line: 11},
  })
}
