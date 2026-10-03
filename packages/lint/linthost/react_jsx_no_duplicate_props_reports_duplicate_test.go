package linthost

import "testing"

// TestReactJSXNoDuplicatePropsReportsDuplicate verifies duplicate JSX props.
//
// Duplicate prop names are resolved by later props at runtime and are almost
// always accidental.
//
// 1. Parse a JSX element with the same prop twice.
// 2. Enable only `react/jsx-no-duplicate-props`.
// 3. Assert one duplicate-prop diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual React rule engine operations verify duplicate className props produce one report; complete finding counts/identities, message assertions or authored ranges distinguish the defect owned here.
// @evidence contracts/testing.md#independent-expectations Repeated JSX property names overwrite prior values; a singleton does not collide.
// @evidence contracts/testing.md#distinguishing-cases The original reported input remains intact and the adjacent accepted source produces zero findings.
// @evidence contracts/testing.md#execution-ownership TestReactJSXNoDuplicatePropsReportsDuplicate is a named Go unit entry operating on TypeScript/TSX ASTs in the shared engine process without a React installation or product child host.
func TestReactJSXNoDuplicatePropsReportsDuplicate(t *testing.T) {
  assertReactRuleFinds(t, "react/jsx-no-duplicate-props", `const C = () => <div className="a" className="b" />;`, "duplicate")
  assertReactRuleSkips(t, "react/jsx-no-duplicate-props", "const C = () => <div className=\"a\" />;")
}
