package linthost

import "testing"

// TestReactStylePropObjectReportsStringStyle verifies style strings are
// rejected.
//
// React's `style` prop expects an object; string literals are always the wrong
// shape.
//
// 1. Parse a JSX element with a string style prop.
// 2. Enable only `react/style-prop-object`.
// 3. Assert the style prop is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual React rule engine operations verify string style prop reports; complete finding counts/identities, message assertions or authored ranges distinguish the defect owned here.
// @evidence contracts/testing.md#independent-expectations React style is an object map, not a CSS text string.
// @evidence contracts/testing.md#distinguishing-cases The original reported input remains intact and the adjacent accepted source produces zero findings.
// @evidence contracts/testing.md#execution-ownership TestReactStylePropObjectReportsStringStyle is a named Go unit entry operating on TypeScript/TSX ASTs in the shared engine process without a React installation or product child host.
func TestReactStylePropObjectReportsStringStyle(t *testing.T) {
  assertReactRuleFinds(t, "react/style-prop-object", `const C = () => <div style="color: red" />;`, "Style")
  assertReactRuleSkips(t, "react/style-prop-object", "const C = () => <div style={{ color: \"red\" }} />;")
}
