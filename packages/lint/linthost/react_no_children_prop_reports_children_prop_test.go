package linthost

import "testing"

// TestReactNoChildrenPropReportsChildrenProp verifies children are nested.
//
// Passing `children` as a normal prop fights JSX's primary child syntax and is
// a direct AST-level smell.
//
// 1. Parse a JSX element with a children prop.
// 2. Enable only `react/no-children-prop`.
// 3. Assert the prop is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual React rule engine operations verify an explicit children prop reports; complete finding counts/identities, message assertions or authored ranges distinguish the defect owned here.
// @evidence contracts/testing.md#independent-expectations Nested JSX children express the supported child ownership.
// @evidence contracts/testing.md#distinguishing-cases The original reported input remains intact and the adjacent accepted source produces zero findings.
// @evidence contracts/testing.md#execution-ownership TestReactNoChildrenPropReportsChildrenProp is a named Go unit entry operating on TypeScript/TSX ASTs in the shared engine process without a React installation or product child host.
func TestReactNoChildrenPropReportsChildrenProp(t *testing.T) {
  assertReactRuleFinds(t, "react/no-children-prop", `const C = () => <div children="text" />;`, "children")
  assertReactRuleSkips(t, "react/no-children-prop", "const C = () => <div>text</div>;")
}
