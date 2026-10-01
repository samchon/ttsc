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
//
// @evidence contracts/testing.md#behavioral-verification The actual owning engine verifies three exact findings survive mixed JSX initializers, omitted binding elements, object spread and shorthand nodes; the assertions below retain the observable identity of every expected result.
// @evidence contracts/testing.md#independent-expectations Only actual map/clsx/camel-case style syntax violates these policies; unrelated AST payloads cannot substitute a panic diagnostic or extra report.
// @evidence contracts/testing.md#distinguishing-cases The omitted tuple entry, JSX variable initializer, ordinary class object, spread and shorthand are boundary controls in the same source as the three violations.
// @evidence contracts/testing.md#execution-ownership TestSolidSourceFileRulesHandleJSXInitializers owns the explicit variants below as one discoverable Go unit entry; its parsed-source engine calls, with an in-process checker when required, execute in the shared process without a Solid installation or native product host.
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
